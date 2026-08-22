// 許可する form_type(ホワイトリスト、CLAUDE.md の 13 フォームと同期)
const ALLOWED_FORM_TYPES = new Set([
  'DM基本',
  '1型糖尿病',
  '高血圧・脂質異常症',
  '内分泌',
  '妊娠糖尿病',
  '反応性低血糖',
  '小児1型糖尿病',
  '睡眠時無呼吸症候群',
  '甲状腺（バセドウ初診）',
  '甲状腺（バセドウ継続）',
  '甲状腺（橋本病）',
  '甲状腺（腫大異常なし）',
  '甲状腺（腺腫経過観察）',
  '甲状腺（腺腫悪性疑い）',
])

// form_data のサイズ上限(JSON 文字列のバイト数)。
// 通常の問診入力は 20KB 程度で収まる想定、余裕を持って 100KB。
// 巨大ペイロード送信による Anthropic API コスト膨張を防ぐ。
const MAX_FORM_DATA_SIZE = 100 * 1024

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { form_data, form_type } = req.body
  if (!form_data) return res.status(400).json({ error: 'form_data is required' })

  // form_type ホワイトリスト検証
  if (!form_type || !ALLOWED_FORM_TYPES.has(form_type)) {
    return res.status(400).json({
      error: `form_type must be one of: ${[...ALLOWED_FORM_TYPES].join(', ')}`,
    })
  }

  // form_data は object 型であること(string 等の不正型を拒否)
  if (typeof form_data !== 'object' || Array.isArray(form_data)) {
    return res.status(400).json({ error: 'form_data must be an object' })
  }

  // form_data のサイズ検証(巨大ペイロード拒否)
  const formDataSize = JSON.stringify(form_data).length
  if (formDataSize > MAX_FORM_DATA_SIZE) {
    return res.status(413).json({
      error: `form_data too large (${formDataSize} bytes, max ${MAX_FORM_DATA_SIZE})`,
    })
  }

  const d = form_data

  // ── 共通ヘルパー ──────────────────────────────────────

  const getCurrentMonth = () => {
    const now = new Date()
    return `R${now.getFullYear() - 2018}.${now.getMonth() + 1}`
  }

  const ALCOHOL_TYPES = [
    { key: 'beer',   label: 'ビール' },
    { key: 'happo',  label: '発泡酒' },
    { key: 'wine',   label: 'ワイン' },
    { key: 'shochu', label: '焼酎' },
    { key: 'sake',   label: '日本酒' },
    { key: 'whisky', label: 'ウイスキー' },
  ]

  const buildAlcohol = () => {
    if (!d.history) return ''
    if (d.history.alcoholNone) return 'なし'
    const items = (d.history.alcoholItems || []).filter(a => a.type && a.amount)
    if (!items.length) return ''
    return items.map(a => {
      const t = ALCOHOL_TYPES.find(x => x.key === a.type)
      return `${t?.label || a.type}${a.amount}${a.freq ? `（${a.freq}）` : ''}`
    }).join('、')
  }

  const buildSmoking = () => {
    if (!d.history) return ''
    const s = d.history
    if (s.smoking === 'なし') return 'なし'
    const base = `${s.smokingAmount}本×${s.smokingYears}年（${s.smokingStartAge}歳〜）`
    return s.smoking === '禁煙済' ? `${base}、${s.smokingQuitEra}${s.smokingQuitYear}年に禁煙` : base
  }

  const buildLiving = () => {
    // DM基本は d.lifestyle、T1D/HTHL/RH/GDM は d.history に格納
    const src = d.lifestyle || d.history || {}
    if (!src.livingSpouse && !(src.livingOther && ((Array.isArray(src.livingOther) && src.livingOther.length) || (!Array.isArray(src.livingOther) && src.livingOther)))) return ''
    const { livingSpouse, livingOther, livingCustom } = src
    const hasSpouse = livingSpouse === '配偶者あり'
    const arr = Array.isArray(livingOther) ? livingOther : (livingOther ? [livingOther] : [])
    const others = arr.filter(x => x && x !== '子供と同居なし')
    const other = others.join('・')
    const custom = livingCustom || ''
    let base = ''
    if (hasSpouse && !other) base = '夫婦2人暮らし'
    else if (hasSpouse && other) base = `夫婦2人暮らし＋${other}`
    else if (!hasSpouse && other) base = other
    else if (livingSpouse) base = livingSpouse
    return [base, custom].filter(Boolean).join('（') + (base && custom ? '）' : '')
  }

  const dmOnsetText = () => {
    if (!d.disease) return ''
    if (d.disease.dmOnsetUnknown) return ''
    if (!d.disease.dmOnset) return ''
    return `（${d.disease.dmOnsetEra}${d.disease.dmOnset}年）`
  }

  const echoLine = (neck, abdomen) => {
    const conv = v =>
      v === '行っていない' ? '当院で施行予定'
      : v === '他院で施行済' ? '他院施行済'
      : v === '健診で施行済' ? '健診施行済'
      : v || '当院で施行予定'
    return `頚部エコー：${conv(neck)}　腹部エコー：${conv(abdomen)}`
  }

  const buildWeekday = () => {
    const days = d.body?.preferredDays || []
    if (!days.length) return '曜希望'
    if (days.includes('指定なし')) return '曜希望：指定なし'
    return `${days.join('・')}曜希望`
  }

  const buildJobStr = () => {
    const src = d.lifestyle || d.history || {}
    const jobs = Array.isArray(src.job) ? src.job : (src.job ? [src.job] : [])
    const note = src.jobNote || ''
    return [jobs.join('、'), note].filter(Boolean).join('・')
  }

  const buildChildInfo = () => {
    const src = d.lifestyle || d.history || {}
    const { childInfo, childLocation, childGender } = src
    const parts = []
    if (childLocation) {
      if (childLocation === '子供なし') parts.push('子供なし')
      else {
        const who = (childGender || []).includes('両方') ? '息子・娘' : (childGender || []).join('・')
        parts.push(`${who || '子供'}は${childLocation}`)
      }
    }
    if (childInfo) parts.push(childInfo)
    return parts.join('、')
  }

  const doctorGender = d.body?.doctorGender || '指定なし'
  const doctorFlagLabel = doctorGender === '院長（初回のみ）' ? '院長希望（初回のみ）' : doctorGender
  const patientFlag  = d.body?.patientFlag || '通常'
  const doubleSlot   = d.body?.doubleSlot ? '取得済' : 'なし'

  const bmiNow = d.body?.height && d.body?.weightNow
    ? (parseFloat(d.body.weightNow) / Math.pow(parseFloat(d.body.height) / 100, 2)).toFixed(1)
    : null
  const bmiSuffix = bmiNow ? `（BMI ${bmiNow}）` : ''

  const STAFF_FLAGS = `（新患2枠取得済の場合）□新患2枠取得済み
（医師希望指定ありの場合）□${doctorFlagLabel}
（患者フラグが「○患者疑い（話が長い方）」の場合）□○患者疑い（対応注意）
（患者フラグが「●患者疑い（出禁対象）」の場合）□●患者疑い（出禁対象・要確認）`

  // 音声入力からのAI整形済み現病歴・既往歴
  // (患者/事務スタッフの自由発話 → Web Speech API → Claude 整形済み)
  // フォーム入力と同等以上に重視して受診理由サマリー / 既往歴セクションに統合
  const voiceMemoBlock = d.voiceMemo?.aiSummary
    ? `\n【音声入力からのAI整形済み現病歴(必ず受診理由サマリーに統合)】\n${d.voiceMemo.aiSummary}\n`
    : ''
  const voiceMemoNote = d.voiceMemo?.aiSummary
    ? '。音声入力AI整形済みテキストがある場合はそれを優先・統合して使用'
    : ''
  // 既往歴用 voice block (♯既往疾患のリストとして統合)
  const voicePastHistoryBlock = d.voicePastHistory?.aiSummary
    ? `\n【音声入力からのAI整形済み既往歴(♯既往疾患セクションに統合、内容に応じて他院管理表記等も補完)】\n${d.voicePastHistory.aiSummary}\n`
    : ''

  // 現病歴：要DR確認フラグ (申し送り事項に追加)
  const voiceMemoNeedsReviewBlock = d.voiceMemo?.needsDoctorReview
    ? `\n【現病歴：要DR確認フラグ(申し送り事項に「□現病歴：問診時間の関係で一部省略、要DR確認」を必ず追加)】\nスタッフが時間制約により現病歴を完全聴取できなかった、または患者発話を完全には拾えなかったと判定。\n`
    : ''

  // 既往歴：要ドクター確認フラグ (申し送り事項に追加)
  const needsDoctorReviewBlock = d.voicePastHistory?.needsDoctorReview
    ? `\n【既往歴：要ドクター確認フラグ(申し送り事項に「□ 既往歴：要ドクター確認」を必ず追加)】\nスタッフが既往歴の確認で医師の判断が必要と判定。\n`
    : ''

  const COMMON_FOOTER = `${getCurrentMonth()}：HbA1c　　%　CPR（　）　※GAD陽性の場合は甲状腺項目追加してください　CPR0.5以下の方は今後半年ごとCPR測定を入れてください。




（アレルギー薬がある場合のみ「⚠️○○アレルギー⚠️」と1行で記載。HTMLタグ・style属性は絶対に出力しない。プレーンテキストのみ）
目標HbA1c　　　　%　目標体重　　　次回検討薬：`

  // ── フォームタイプ別プロンプト生成 ──────────────────────

  let prompt = ''
  let max_tokens = 1500

  // ────── DM基本 ──────
  if (form_type === 'DM基本') {
    const echoNeck = d.disease?.echoNeck === '行っていない' ? '当院で施行予定' : d.disease?.echoNeck || '未記入'
    const echoAbdomen = d.disease?.echoAbdomen === '行っていない' ? '当院で施行予定' : d.disease?.echoAbdomen || '未記入'

    prompt = `あなたはまつもと糖尿病クリニックの電子カルテ記載AIです。
以下の患者情報をもとに、クリニックのフォーマット通りにカルテ記載文を生成してください。

【ルール】
- 注意書き・内部メモは出力しない
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③他院管理疾患が複数あっても他院管理同士は連続列挙し空行なし ④他院管理疾患の最終行と【アレルギー歴】の間は空行なし（直接続ける） ⑤【事前聴取時 申し送り事項】の最終□行と【診察にあたっての要望】の間も空行なし（連続）
- 体重減少ありの場合は一番上に【⚠️ 体重減少あり・早急なインスリン導入を検討】と記載
- 60歳未満はワクチン歴を省略、70歳未満は子供の状況を省略
- 喫煙歴は「○本×○年（○歳〜）」の形式
- 重要既往歴には「治療した病院 → 現在通院先」を記載
- ＃糖尿病の右に発症時期を記載（例：＃糖尿病（令和2年））
- 受診理由の直後に改行なしで＃糖尿病を続ける
- 受診理由が「糖尿病か気になる」(reason.dmConcern=true)の場合、＃糖尿病ではなく「＃糖尿病 or IGT or 正常耐糖能」と記載（検査前の暫定診断）。発症時期は付けない。

【整形済みデータ】
飲酒歴：${buildAlcohol()}
喫煙歴：${buildSmoking()}
生活情報：${buildLiving()}
子供の状況：${buildChildInfo()}
職業：${buildJobStr()}
発症時期テキスト：${dmOnsetText()}
頚部エコー：${echoNeck}
腹部エコー：${echoAbdomen}
希望曜日：${buildWeekday()}
医師希望：${doctorGender}
患者フラグ：${patientFlag}
新患2枠取得：${doubleSlot}

【患者情報JSON】
${JSON.stringify(d, null, 2)}

【追加情報】
現在日時：${getCurrentMonth()}
体重減少：${d.alert?.weightLoss || ''}
HTあり：${d.disease?.ht || false}
HLあり：${d.disease?.hl || false}
${voiceMemoBlock}${voicePastHistoryBlock}${voiceMemoNeedsReviewBlock}${needsDoctorReviewBlock}
【出力フォーマット（必ずこの順序で。該当なければ省略）】
（体重減少が「あり」かつ3kg以上の場合のみ）【⚠️ 体重減少あり・早急なインスリン導入を検討】

${getCurrentMonth()}：（受診理由サマリー1〜2行。記載なければ省略${voiceMemoNote}）
${d.reason?.dmConcern ? '＃糖尿病 or IGT or 正常耐糖能' : `＃糖尿病${dmOnsetText()}`}（サマリーの直後、空行なし）
＃HT（該当時のみ）
＃HL（該当時のみ）
◎甲状腺3項目追加済（HL+甲状腺追加済の場合のみ）

♯胃癌（胃切除後：治療種類・範囲・時期・治療病院→通院先・内服薬）（該当時のみ）
♯膵臓癌（術後：治療種類・切除範囲・時期・治療病院→通院先・内服薬）（該当時のみ）
♯IHD：PCI後（時期・治療病院→通院先・抗血小板薬）（該当時のみ）
♯脳梗塞後（時期・治療病院→通院先・抗血小板薬）（該当時のみ）
（その他既往があれば記載）

【アレルギー歴】（アレルギーなしなら「なし」、ありなら内容をそのまま同じ行に記載）
【FH】DM(-/+) HT(-/+) APO(-/+) IHD(-/+)（FH DMの場合は誰かも記載）
【飲酒歴】（整形済みテキスト）
【喫煙歴】（整形済みテキスト）
【眼科通院歴】（眼底検査を受けている場合：眼科名・網膜症の状況・緑内障の有無を記載。受けていない場合は「未受診」と記載）
【健診】
【ワクチン歴】（60歳以上のみ）
【生活情報】（整形済みテキスト。70歳以上は子供の状況も含む）
【仕事】職業・活動量
---------------------------------------------
頚部エコー：${echoNeck}　腹部エコー：${echoAbdomen}（必ず1行に横配置）
---------------------------------------------
身長:○cm　初診時:○kg${bmiSuffix}　20歳時:○kg　max体重○kg(○歳)
---------------------------------------------
【事前聴取時　申し送り事項】
□通院のご案内をお渡し済
（現病歴：要DR確認フラグありの場合のみ）□現病歴：問診時間の関係で一部省略、要DR確認
（既往歴：要ドクター確認フラグありの場合のみ）□既往歴：要ドクター確認
（眼底検査=受けていない or 連携手帳=持っていない の場合）□糖尿病-眼科連携手帳をお渡し
（体重減少ありかつ3kg以上の場合）□体重減少あり（3ヶ月以内に3kg以上）インスリン導入要検討
（HTありの場合）□HTの確認のため、血圧手帳をお渡ししています。
（HLありの場合）□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。
（インスリン未使用の場合）□生活習慣病療養計画書を作成済
（糖尿病か気になるで受診=reason.dmConcern=true の場合）□血糖、HbA1cの結果により上段の診断を確定してください
${STAFF_FLAGS}
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${COMMON_FOOTER}
DM基本セット
1月follow
${buildWeekday()}
LINE登録ご案内→済　登録確認未・登録できない`
    max_tokens = 1500

  // ────── 1型糖尿病 ──────
  } else if (form_type === '1型糖尿病') {
    prompt = `あなたは糖尿病専門クリニックの電子カルテ記載AIです。以下の患者情報をもとに、1型糖尿病のカルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③他院管理疾患が複数あっても他院管理同士は連続列挙し空行なし ④他院管理疾患の最終行と【アレルギー歴】の間は空行なし（直接続ける） ⑤【事前聴取時 申し送り事項】の最終□行と【診察にあたっての要望】の間も空行なし（連続）
- 体重減少ありの場合は一番上に【⚠️ 体重減少あり・早急なインスリン導入を検討】と記載
- 受診理由の直後、空行なしで＃1型糖尿病を続ける
- ＃1型糖尿病・＃HT・＃HLは空行なしで続ける
- 60歳未満はワクチン歴を省略、70歳未満は子供の状況を省略
- 喫煙歴は「○本×○年（○歳〜）」の形式
- 採血項目：GAD抗体・CPR・甲状腺3項目は初診時必須として記載

【整形済みデータ】
飲酒歴：${buildAlcohol()}
喫煙歴：${buildSmoking()}
生活情報：${buildLiving()}
子供の状況：${buildChildInfo()}
職業：${buildJobStr()}
発症時期：${dmOnsetText()}
希望曜日：${buildWeekday()}
医師希望：${doctorGender}
患者フラグ：${patientFlag}
新患2枠取得：${doubleSlot}

【患者情報JSON】
${JSON.stringify(d, null, 2)}
${voiceMemoBlock}${voicePastHistoryBlock}${voiceMemoNeedsReviewBlock}${needsDoctorReviewBlock}
【出力フォーマット】
（体重減少ありなら）【⚠️ 体重減少あり・早急なインスリン導入を検討】

${getCurrentMonth()}：（受診理由1〜2行${voiceMemoNote}）
＃1型糖尿病（${d.disease?.dm1type || 'タイプ不明'}）${dmOnsetText()}
・GAD抗体：（初診時採血）
・CPR：（初診時採血）
・甲状腺検査：（${d.disease?.thyroidChecked ? '初診時採血済' : '初診時採血'}）
・障害年金：DM診断時厚生年金加入（${d.disease?.pensionKosei === 'はい（加入していた）' ? '有' : d.disease?.pensionKosei === 'いいえ（未加入）' ? '無' : '不明'}）→${d.disease?.pensionStatus === '受給中' ? '受給中' : d.disease?.pensionKosei === 'はい（加入していた）' ? 'CPR次第' : '受給困難（×）'}

＃HT（HTありの場合のみ、空行なし）
＃HL（HLありの場合のみ、空行なし）

【アレルギー歴】（アレルギーなしなら「なし」、ありなら内容をそのまま同じ行に記載）
【FH】DM(-/+) HT(-/+) APO(-/+) IHD(-/+)（FH DMの場合は誰かも記載）
【飲酒歴】（整形済みテキスト）
【喫煙歴】（整形済みテキスト）
【眼科通院歴】（眼底検査を受けている場合：眼科名・網膜症の状況・緑内障の有無を記載。受けていない場合は「未受診」と記載）
【健診】
【ワクチン歴】（60歳以上のみ）
【生活情報】（整形済みテキスト。70歳以上は子供の状況も含む）
【仕事】職業・活動量
---------------------------------------------
頚部エコー：当院で施行予定　腹部エコー：当院で施行予定（必ず1行に横配置）
---------------------------------------------
身長:○cm　初診時:○kg${bmiSuffix}　20歳時:○kg　max体重○kg(○歳)
---------------------------------------------
【事前聴取時　申し送り事項】
□通院のご案内をお渡し済
（現病歴：要DR確認フラグありの場合のみ）□現病歴：問診時間の関係で一部省略、要DR確認
（既往歴：要ドクター確認フラグありの場合のみ）□既往歴：要ドクター確認
（眼底検査=受けていない or 連携手帳=持っていない の場合）□糖尿病-眼科連携手帳をお渡し
（体重減少ありの場合）□体重減少あり（3ヶ月以内に3kg以上）インスリン導入要検討
（障害年金：厚生年金加入あり かつ 受給中ではない場合のみ）□障害年金の可能性あり→CPR結果を確認してください
□甲状腺3項目・GAD抗体・CPRを初診時採血
（インスリン未使用の場合）□初回療養計画書を作成済
（CGM希望がある場合）□CGM：${d.reason?.cgmCurrent && d.reason.cgmCurrent !== '使用していない' ? d.reason.cgmCurrent + '使用中→' : ''}${d.reason?.cgmWish && d.reason.cgmWish !== '希望なし' ? d.reason.cgmWish : ''}
（ポンプ希望がある場合）□インスリンポンプ：${d.reason?.pumpCurrent && d.reason.pumpCurrent !== '使用していない' ? d.reason.pumpCurrent + '使用中→' : ''}${d.reason?.pumpWish && d.reason.pumpWish !== '希望なし' ? d.reason.pumpWish : ''}
${STAFF_FLAGS}
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${COMMON_FOOTER}
DM基本セット
1月follow
${buildWeekday()}
LINE登録ご案内→済　登録確認未・登録できない`
    max_tokens = 1500

  // ────── 高血圧・脂質異常症 ──────
  } else if (form_type === '高血圧・脂質異常症') {
    const otherDiseasesText = (d.disease?.otherDiseases || [])
      .filter(x => x.name)
      .map(x => x.name + (x.hospital ? `（${x.hospital}）` : ''))
      .join('、') || 'なし'

    prompt = `あなたはまつもと糖尿病クリニックの電子カルテ記載AIです。以下の患者情報をもとに、高血圧・脂質異常症のカルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③他院管理疾患が複数あっても他院管理同士は連続列挙し空行なし ④他院管理疾患の最終行と【アレルギー歴】の間は空行なし（直接続ける） ⑤【事前聴取時 申し送り事項】の最終□行と【診察にあたっての要望】の間も空行なし（連続）
- 60歳未満はワクチン歴を省略、70歳未満は子供の状況を省略
- 喫煙歴は「○本×○年（○歳〜）」の形式
- HLで甲状腺追加済の場合は「◎甲状腺3項目追加済」を記載

【整形済みデータ】
飲酒歴：${buildAlcohol()}
喫煙歴：${buildSmoking()}
生活情報：${buildLiving()}
子供の状況：${buildChildInfo()}
職業：${buildJobStr()}
頚部エコー：${d.disease?.echoNeck || '未選択'}
腹部エコー：${d.disease?.echoAbdomen || '未選択'}
その他の病名・既往歴：${otherDiseasesText}
希望曜日：${buildWeekday()}
医師希望：${doctorGender}
患者フラグ：${patientFlag}
新患2枠取得：${doubleSlot}

【患者情報JSON】
${JSON.stringify(d, null, 2)}
${voiceMemoBlock}${voicePastHistoryBlock}${voiceMemoNeedsReviewBlock}${needsDoctorReviewBlock}
【出力フォーマット】
${getCurrentMonth()}：（受診理由1〜2行。「気になって受診」の場合は気になる理由も含めて記載${voiceMemoNote}）
＃IGT（該当時のみ、受診理由の直後、空行なし）
＃HT（該当時のみ、空行なし）
＃HL（該当時のみ、空行なし）
◎甲状腺3項目追加済（HL+甲状腺追加済の場合のみ）
（その他病名があれば「♯病名（通院先）」の形式で記載、空行なし）

【アレルギー歴】（アレルギーなしなら「なし」、ありなら内容をそのまま同じ行に記載）
【FH】DM(-/+) HT(-/+) HL(-/+) APO(-/+) IHD(-/+)（FH DMの場合は誰かも記載）
【飲酒歴】（整形済みテキスト）
【喫煙歴】（整形済みテキスト）
【健診】
【ワクチン歴】（60歳以上のみ）
【生活情報】（整形済みテキスト。70歳以上は子供の状況も含む）
【仕事】職業・活動量
---------------------------------------------
${echoLine(d.disease?.echoNeck, d.disease?.echoAbdomen)}（必ず1行に横配置）
---------------------------------------------
身長:○cm　初診時:○kg${bmiSuffix}　20歳時:○kg　max体重○kg(○歳)
---------------------------------------------
【事前聴取時　申し送り事項】
□通院のご案内をお渡し済
（現病歴：要DR確認フラグありの場合のみ）□現病歴：問診時間の関係で一部省略、要DR確認
（既往歴：要ドクター確認フラグありの場合のみ）□既往歴：要ドクター確認
（HLありの場合）□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。
□初回療養計画書を作成済
${STAFF_FLAGS}
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${getCurrentMonth()}：




（アレルギー薬がある場合のみ「⚠️○○アレルギー⚠️」と1行で記載。HTMLタグ・style属性は絶対に出力しない。プレーンテキストのみ）
目標HbA1c　　　　%　目標体重　　　次回検討薬：
基本採血なし
1月follow
${buildWeekday()}
LINE登録ご案内→済　登録確認未・登録できない`
    max_tokens = 1500

  // ────── 内分泌 ──────
  // 高血圧・脂質異常症 と同一構成。主病名（＃）の選択欄は持たない
  // （内分泌はバリエーションが豊富なため、医師が診察時に直接問診して記載する）
  } else if (form_type === '内分泌') {
    const otherDiseasesText = (d.disease?.otherDiseases || [])
      .filter(x => x.name)
      .map(x => x.name + (x.hospital ? `（${x.hospital}）` : ''))
      .join('、') || 'なし'

    prompt = `あなたはまつもと糖尿病クリニックの電子カルテ記載AIです。以下の患者情報をもとに、内分泌疾患のカルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- 主病名（＃）は医師が診察時に確定するため、問診では聴取していない。＃で始まる主病名の行は絶対に推測して出力しない
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③他院管理疾患が複数あっても他院管理同士は連続列挙し空行なし ④他院管理疾患の最終行と【アレルギー歴】の間は空行なし（直接続ける） ⑤【事前聴取時 申し送り事項】の最終□行と【診察にあたっての要望】の間も空行なし（連続）
- 60歳未満はワクチン歴を省略、70歳未満は子供の状況を省略
- 喫煙歴は「○本×○年（○歳〜）」の形式

【整形済みデータ】
家族歴（自由記入）：${d.history?.fhOther || 'なし'}
飲酒歴：${buildAlcohol()}
喫煙歴：${buildSmoking()}
生活情報：${buildLiving()}
子供の状況：${buildChildInfo()}
職業：${buildJobStr()}
頚部エコー：${d.disease?.echoNeck || '未選択'}
腹部エコー：${d.disease?.echoAbdomen || '未選択'}
その他の病名・既往歴：${otherDiseasesText}
希望曜日：${buildWeekday()}
医師希望：${doctorGender}
患者フラグ：${patientFlag}
新患2枠取得：${doubleSlot}

【患者情報JSON】
${JSON.stringify(d, null, 2)}
${voiceMemoBlock}${voicePastHistoryBlock}${voiceMemoNeedsReviewBlock}${needsDoctorReviewBlock}
【ルール追加】
- 「診察にあたっての要望」は必ず【】付きで記載。記載なければ「なし」と記載
- その他の病名がある場合は既往歴として記載
- 頚部エコー・腹部エコーの情報を記載

【出力フォーマット】
${getCurrentMonth()}：（受診理由1〜2行。「気になって受診」の場合は気になる理由も含めて記載。自由記入欄の内容も含める${voiceMemoNote}）
（主病名の＃行は出力しない。医師が診察時に記載する）
（その他病名があれば「♯病名（通院先）」の形式で記載、空行なし）

【アレルギー歴】（アレルギーなしなら「なし」、ありなら内容をそのまま同じ行に記載）
【FH】DM(-/+) HT(-/+) HL(-/+) APO(-/+) IHD(-/+)（FH DMの場合は誰かも記載。家族歴の自由記入があれば、同じ行の末尾に全角スペース区切りでそのまま続けて記載。例「【FH】DM(+：母) HT(-) HL(-) APO(-) IHD(-)　母：バセドウ病」。自由記入がなければ何も足さない）
【飲酒歴】（整形済みテキスト）
【喫煙歴】（整形済みテキスト）
【健診】
【ワクチン歴】（60歳以上のみ）
【生活情報】（整形済みテキスト。70歳以上は子供の状況も含む）
【仕事】職業・活動量
---------------------------------------------
${echoLine(d.disease?.echoNeck, d.disease?.echoAbdomen)}（必ず1行に横配置）
---------------------------------------------
身長:○cm　初診時:○kg${bmiSuffix}　20歳時:○kg　max体重○kg(○歳)
---------------------------------------------
【事前聴取時　申し送り事項】
□通院のご案内をお渡し済
（現病歴：要DR確認フラグありの場合のみ）□現病歴：問診時間の関係で一部省略、要DR確認
（既往歴：要ドクター確認フラグありの場合のみ）□既往歴：要ドクター確認
□主病名：医師の診察時に確定・記載
□初回療養計画書を作成済
${STAFF_FLAGS}
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${getCurrentMonth()}：




（アレルギー薬がある場合のみ「⚠️○○アレルギー⚠️」と1行で記載。HTMLタグ・style属性は絶対に出力しない。プレーンテキストのみ）
目標HbA1c　　　　%　目標体重　　　次回検討薬：
基本採血なし
1月follow
${buildWeekday()}
LINE登録ご案内→済　登録確認未・登録できない`
    max_tokens = 1500

  // ────── 妊娠糖尿病 ──────
  } else if (form_type === '妊娠糖尿病') {
    prompt = `あなたは糖尿病専門クリニックの電子カルテ記載AIです。以下の患者情報をもとに、妊娠糖尿病のカルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③他院管理疾患が複数あっても他院管理同士は連続列挙し空行なし ④他院管理疾患の最終行と【アレルギー歴】の間は空行なし（直接続ける） ⑤【事前聴取時 申し送り事項】の最終□行と【診察にあたっての要望】の間も空行なし（連続）
- 妊娠糖尿病の場合は眼科通院歴・健診・ワクチン歴は記載不要
- 糖尿病合併妊娠の場合はGAD追加を記載し、眼科通院歴も記載する
- HLで甲状腺追加済の場合は「◎甲状腺3項目追加済」を記載
- 受診理由の直後、空行なしで＃妊娠糖尿病または＃糖尿病合併妊娠を続ける
- 各項目間に空行を入れない

【整形済みデータ】
生活情報：${buildLiving()}
職業：${buildJobStr()}
希望曜日：${buildWeekday()}
医師希望：${doctorGender}
患者フラグ：${patientFlag}
新患2枠取得：${doubleSlot}

【患者情報JSON】
${JSON.stringify({ disease: d.disease, history: d.history, body: d.body, reason: d.reason }, null, 2)}
${voiceMemoBlock}${voicePastHistoryBlock}${voiceMemoNeedsReviewBlock}${needsDoctorReviewBlock}
【出力フォーマット】
${getCurrentMonth()}：（受診理由1〜2行${voiceMemoNote}）
＃妊娠糖尿病（または＃糖尿病合併妊娠）
　現在${d.disease?.currentWeek || ''}週、${d.disease?.dueDateEra || '令和'}${d.disease?.dueDateYear || ''}年${d.disease?.dueDateMonth || ''}月
　産科通院先：${d.disease?.obHospital === 'その他' ? d.disease?.obHospitalOther || '' : d.disease?.obHospital || ''}
　過去の妊娠糖尿病歴：（あれば記載）
＃HT（該当時のみ）
＃HL（該当時のみ）
◎甲状腺3項目追加済（該当時のみ）

【アレルギー歴】（アレルギーなしなら「なし」、ありなら内容をそのまま同じ行に記載）
【FH】DM(-/+) HT(-/+) APO(-/+) IHD(-/+)
【飲酒歴】なし（妊娠中）
【喫煙歴】（記載）
（糖尿病合併妊娠の場合のみ）【眼科通院歴】（眼底検査を受けている場合：眼科名・網膜症の状況・緑内障の有無を記載。受けていない場合は「未受診」と記載）
【生活情報】（整形済みテキスト）
【仕事】職業・活動量
---------------------------------------------
${echoLine(d.disease?.echoNeck, d.disease?.echoAbdomen)}（必ず1行に横配置）
---------------------------------------------
身長:○cm　初診時:○kg${bmiSuffix}　妊娠前:○kg　20歳時:○kg　max体重○kg(○歳)
---------------------------------------------
【事前聴取時　申し送り事項】
□通院のご案内をお渡し済
（現病歴：要DR確認フラグありの場合のみ）□現病歴：問診時間の関係で一部省略、要DR確認
（既往歴：要ドクター確認フラグありの場合のみ）□既往歴：要ドクター確認
（糖尿病合併妊娠の場合のみ：眼底検査=受けていない or 連携手帳=持っていない の場合）□糖尿病-眼科連携手帳をお渡し
□リブレ（自費CGM）取り付けに同意済
（喫煙「あり」の場合）□喫煙確認あり・指導必要
${STAFF_FLAGS}
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${COMMON_FOOTER}
DM基本セット
1月follow
${buildWeekday()}
LINE登録ご案内→済　登録確認未・登録できない`
    max_tokens = 2000

  // ────── 反応性低血糖 ──────
  } else if (form_type === '反応性低血糖') {
    prompt = `あなたは糖尿病専門クリニックの電子カルテ記載AIです。以下の患者情報をもとに、反応性低血糖のカルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（♯【】）を使用する
- 甲状腺3項目追加済の場合は申し送り事項に記載
- CGM/リブレ装着情報も申し送り事項に記載
- 60歳未満はワクチン歴を省略、70歳未満は子供の状況を省略

【整形済みデータ】
飲酒歴：${buildAlcohol()}
喫煙歴：${buildSmoking()}
生活情報：${buildLiving()}
子供の状況：${buildChildInfo()}
職業：${buildJobStr()}
希望曜日：${buildWeekday()}
医師希望：${doctorGender}
患者フラグ：${patientFlag}
新患2枠取得：${doubleSlot}

【患者情報JSON】
${JSON.stringify(d, null, 2)}
${voiceMemoBlock}${voicePastHistoryBlock}${voiceMemoNeedsReviewBlock}${needsDoctorReviewBlock}
【出力フォーマット】
${getCurrentMonth()}：${voiceMemoNote ? '（' + voiceMemoNote.replace(/^。/, '') + '）' : ''}
♯反応性低血糖疑い
・低血糖が生じるタイミング：${(d.symptom?.timing || []).join('、')}${d.symptom?.timingNote ? `（${d.symptom.timingNote}）` : ''}
・症状：${(d.symptom?.symptoms || []).join('、')}${d.symptom?.symptomsNote ? `（${d.symptom.symptomsNote}）` : ''}
・思い当たる原因：${(d.symptom?.cause || []).join('、')}${d.symptom?.causeNote ? `（${d.symptom.causeNote}）` : ''}

【アレルギー歴】（アレルギーなしなら「なし」、ありなら内容をそのまま同じ行に記載）
【FH】DM(-/+) HT(-/+) HL(-/+) APO(-/+) IHD(-/+)
【飲酒歴】（整形済みテキスト）
【喫煙歴】（整形済みテキスト）
【健診】
【ワクチン歴】（60歳以上のみ）
【生活情報】（整形済みテキスト。70歳以上は子供の状況も含む）
【仕事】職業・活動量
---------------------------------------------
頚部エコー：当院で施行予定　腹部エコー：当院で施行予定（必ず1行に横配置）
---------------------------------------------
身長:○cm　初診時:○kg${bmiSuffix}　20歳時:○kg　max体重○kg(○歳)
---------------------------------------------
【事前聴取時　申し送り事項】
□通院のご案内をお渡し済
（現病歴：要DR確認フラグありの場合のみ）□現病歴：問診時間の関係で一部省略、要DR確認
□自費CGM（リブレ）装着済（反応性低血糖疑いは全例必須記載）
（既往歴：要ドクター確認フラグありの場合のみ）□既往歴：要ドクター確認
（甲状腺3項目追加済の場合）□甲状腺3項目追加採血済
${STAFF_FLAGS}
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${COMMON_FOOTER}
DM基本セット
1月follow
${buildWeekday()}
LINE登録ご案内→済　登録確認未・登録できない`
    max_tokens = 1500

  // ────── 小児1型糖尿病 ──────
  } else if (form_type === '小児1型糖尿病') {
    prompt = `あなたは糖尿病専門クリニックの電子カルテ記載AIです。以下の患者情報をもとに、小児1型糖尿病のカルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯・）を使用する
- 小児慢性申請状況を必ず記載する
- 受診理由の直後、空行なしで＃1型糖尿病を続ける
- 各項目（・GAD抗体、・CPR等）の間は空行なし
- 【アレルギー歴】【FH】【眼科通院歴】【協力体制】【本人のスケジュール】【親のスケジュール】【注射・血糖測定の自立度】【生活情報】の間は全て空行なし
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③他院管理疾患が複数あっても他院管理同士は連続列挙し空行なし ④他院管理疾患の最終行と【アレルギー歴】の間は空行なし（直接続ける） ⑤【事前聴取時 申し送り事項】の最終□行と【診察にあたっての要望】の間も空行なし（連続）
- ＃HT・＃HLは必ず＃1型糖尿病の直後に記載し、末尾には絶対に記載しない
- アレルギー薬の記載以降は指定フォーマットのみを出力し、病名・診断名を追記しない

【整形済みデータ】
希望曜日：${buildWeekday()}
医師希望：${doctorGender}
患者フラグ：${patientFlag}
新患2枠取得：${doubleSlot}

【患者情報JSON】
${JSON.stringify({ disease: d.disease, history: d.history, body: d.body, reason: d.reason, support: d.support, chronic: d.chronic }, null, 2)}
${voiceMemoBlock}${voicePastHistoryBlock}${voiceMemoNeedsReviewBlock}${needsDoctorReviewBlock}
【出力フォーマット（空行は一切入れないこと）】
${getCurrentMonth()}：（受診理由1〜2行${voiceMemoNote}）
＃1型糖尿病（タイプ）（発症時期）
＃HT（HTありの場合のみ。当院管理なら「＃HT」、他院管理なら「＃HT（他院管理）」）
＃HL（HLありの場合のみ。当院管理なら「＃HL」、他院管理なら「＃HL（他院管理）」）
・GAD抗体：（初診時採血）
・CPR：（初診時採血）
・甲状腺検査：（確認済/初診時採血）
・バクスミー希望：あり/なし
・小児慢性特定疾病助成制度：（申請状況）（申請ありの場合：出生体重・出生週数・出生時住民登録地・手帳取得内容）
・書類関係：（選択された書類を全て記載）（「学校生活管理指導表」が含まれる場合）□4月頃に処方
・居住地：（市町村）
---------------------------------------------
【アレルギー歴】（なしまたは内容を同じ行に）
【FH】DM(-/+、誰かも記載) 1型糖尿病(-/+、誰かも記載) 膠原病(-/+、誰が・どの病気かも記載) HT(-/+) APO(-/+) IHD(-/+)
【眼科通院歴】（眼底検査を受けている場合：眼科名・網膜症の状況・緑内障の有無を記載。受けていない場合は「未受診」と記載）
【協力体制】
①家族の協力体制：（内容）
②学校の協力体制：（内容）
③学校でサポートしてくれる人：（内容）
④周囲への開示：（内容）
【本人のスケジュール】（内容）
【親のスケジュール】（内容）
【注射・血糖測定の自立度】（内容）
【生活情報】家族構成・キーパーソン：（内容）
---------------------------------------------
身長:○cm　初診時:○kg${bmiSuffix}
---------------------------------------------
【事前聴取時　申し送り事項】
□通院のご案内をお渡し済
（現病歴：要DR確認フラグありの場合のみ）□現病歴：問診時間の関係で一部省略、要DR確認
（既往歴：要ドクター確認フラグありの場合のみ）□既往歴：要ドクター確認
（眼底検査=受けていない or 連携手帳=持っていない の場合）□糖尿病-眼科連携手帳をお渡し
□甲状腺3項目・GAD抗体・CPRを初診時採血
（HTありの場合）□HTの確認のため、血圧手帳をお渡ししています。
（HLありの場合）□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。
（書類関係で「学校生活管理指導表」を選択した場合）□4月頃に処方
（小児慢性申請済の場合）□小児慢性申請済・窓口負担を確認し算定へ連絡
（母子手帳「忘れた」の場合）□次回以降、母子手帳を確認してください
${STAFF_FLAGS}
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${getCurrentMonth()}：HbA1c　　%　CPR（　）　※GAD陽性の場合は甲状腺項目追加してください　CPR0.5以下の方は今後半年ごとCPR測定を入れてください。




（アレルギー薬がある場合のみ「⚠️○○アレルギー⚠️」と1行で記載。HTMLタグ・style属性は絶対に出力しない。プレーンテキストのみ）
目標HbA1c　　　　%　目標体重　　　次回検討薬：
DM基本セット
1月follow
${buildWeekday()}
LINE登録ご案内→済　登録確認未・登録できない`
    max_tokens = 2000

  // ────── 睡眠時無呼吸症候群 ──────
  } else if (form_type === '睡眠時無呼吸症候群') {
    const sasCategory = d.reason?.sasCategory || ''
    const sasCategoryLabel = sasCategory === 'cpap' ? 'CPAP治療の継続希望'
      : sasCategory === 'screening' ? '睡眠時無呼吸症候群の検査希望（簡易PSG予定）'
      : '未選択'
    const cpapPriorClinic = d.reason?.cpapPriorClinic || ''
    const cpapConfirmed = d.reason?.cpapPriorRecordsConfirmed === true
    const purposesText = (d.reason?.purposes || []).join('、') + (d.reason?.purposeOther ? `（その他: ${d.reason.purposeOther}）` : '')
    const knowSourceText = (d.reason?.knowSource || []).join('、') + (d.reason?.knowSourceOther ? `（その他: ${d.reason.knowSourceOther}）` : '')

    const sasSelected = d.symptom?.sasSymptoms?.selected || []
    const sasOther = (d.symptom?.sasSymptoms?.otherText || '').trim()
    const sasItems = sasSelected.includes('その他') && sasOther
      ? [...sasSelected.filter(s => s !== 'その他'), `その他: ${sasOther}`]
      : sasSelected
    const sasSymptomsText = sasItems.join('・')

    const otherDiseasesText = (d.disease?.otherDiseases || [])
      .filter(x => x.name)
      .map(x => x.name + (x.hospital ? `（${x.hospital}${x.dept ? `・${x.dept}` : ''}）` : ''))
      .join('、') || 'なし'

    // dmDiff: 採血で DM 判明後にスタッフが追記したセクション
    const dm = d.dmDiff || {}
    const hasDmDiff = dm.completed === true

    const dmDiffBlock = hasDmDiff ? `
【DM差分問診（採血で DM 判明後にスタッフが追加聴取）】
体重減少：${dm.weightLoss || '未入力'}
糖尿病の症状：${(dm.dmSymptoms?.selected || []).join('・') || 'なし'}${dm.dmSymptoms?.otherText ? `（その他: ${dm.dmSymptoms.otherText}）` : ''}
過去のHbA1c/血糖指摘歴：${dm.pastHbA1c || 'なし'}
糖尿病発症時期：${dm.diabetesOnsetUnknown ? '不明' : (dm.diabetesOnsetEra && dm.diabetesOnsetYear ? `${dm.diabetesOnsetEra}${dm.diabetesOnsetYear}年（${dm.diabetesOnsetNote || '今回判明'}）` : '今回採血で判明')}
インスリン使用：${dm.insulinUse ? 'あり' : 'なし'}
家族歴(DM)：${dm.fhDm ? 'あり' : 'なし'}${dm.fhDmWho?.length ? `（${dm.fhDmWho.join('・')}）` : ''}
家族歴(HL)：${dm.fhHl ? 'あり' : 'なし'}
眼底検査：${dm.eyeFundusCheck || '未入力'}　糖尿病-眼科連携手帳：${dm.eyeNotebook || '未入力'}　眼科：${dm.eyeClinic || ''}　網膜症：${dm.retinopathy || '未入力'}
重要既往歴：${[dm.importantPast?.gastricCancer && '胃癌', dm.importantPast?.pancreasCancer && '膵癌', dm.importantPast?.ihd && '虚血性心疾患', dm.importantPast?.stroke && '脳梗塞'].filter(Boolean).join('・') || 'なし'}${dm.importantPast?.detail ? `（詳細: ${dm.importantPast.detail}）` : ''}
治療希望：${dm.treatmentWish || '未入力'}
自由記載：${dm.freeText || ''}
` : ''

    const sasMainName = sasCategory === 'screening'
      ? '＃SAS疑い（簡易PSG予定）'
      : sasCategory === 'cpap'
        ? `＃SAS（${cpapPriorClinic ? `前医：${cpapPriorClinic}、` : ''}CPAP継続）`
        : '＃SAS'

    prompt = `あなたはまつもと糖尿病クリニックの電子カルテ記載AIです。以下の患者情報をもとに、睡眠時無呼吸症候群（SAS）のカルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③他院管理疾患同士は連続列挙し空行なし ④他院管理疾患の最終行と【アレルギー歴】の間は空行なし ⑤【事前聴取時 申し送り事項】の最終□行と【診察にあたっての要望】の間も空行なし
- 60歳未満はワクチン歴を省略、70歳未満は子供の状況を省略
- 喫煙歴は「○本×○年（○歳〜）」の形式
- ＃SASの記載: ${sasMainName} を必ず受診理由サマリーの直後に空行なしで記載
- SAS症状チェックがある場合のみ【SASの症状】セクションを【FH】の前に挿入し、「・」区切りで横一列に記載
${hasDmDiff ? `- 【DM差分情報】が下に提供されている: ＃糖尿病（採血で判明）を ＃SAS の直下（HT/HLよりも前）に追加し、必要なら発症時期も記載。【糖尿病の症状】セクションも【SASの症状】の下に追加（チェックがある場合のみ）。重要既往（胃癌・膵癌・IHD・脳梗塞）があれば♯行で記載。家族歴のDM/HLにも反映。
- DM判明患者の場合、申し送り事項に必ず「□採血で DM判明 → DM初期評価追加実施済」を含める。
- DM患者ならフッターを「DM基本セット」に変更（基本採血なし → DM基本セット）。` : ''}

【整形済みデータ】
受診理由：${purposesText || '未選択'}
現通院先：${d.reason?.currentClinic || 'なし/未記入'}
SAS区分：${sasCategoryLabel}
CPAP前医情報提供書：${sasCategory === 'cpap' ? (cpapConfirmed ? '確認済' : '未確認') : '対象外'}
当院を知ったきっかけ：${knowSourceText || '未選択'}
SAS症状チェック：${sasSymptomsText || 'なし'}
飲酒歴：${buildAlcohol()}
喫煙歴：${buildSmoking()}
生活情報：${buildLiving()}
子供の状況：${buildChildInfo()}
職業：${buildJobStr()}
頚部エコー：${d.disease?.echoNeck || '未選択'}
腹部エコー：${d.disease?.echoAbdomen || '未選択'}
その他の病名・既往歴：${otherDiseasesText}
希望曜日：${buildWeekday()}
医師希望：${doctorGender}
患者フラグ：${patientFlag}
新患2枠取得：${doubleSlot}
${dmDiffBlock}
【患者情報JSON】
${JSON.stringify(d, null, 2)}
${voiceMemoBlock}${voicePastHistoryBlock}${voiceMemoNeedsReviewBlock}${needsDoctorReviewBlock}
【出力フォーマット】
${getCurrentMonth()}：（受診理由サマリー1〜2行。SAS区分（CPAP継続/検査希望）も含める${voiceMemoNote}${hasDmDiff ? '。採血でDM判明したことも触れる' : ''}）
${sasMainName}（受診理由の直後、空行なし）${hasDmDiff ? '\n＃糖尿病（採血で判明、発症時期はDM差分情報に従う）' : ''}
＃HT（該当時のみ、空行なし）
＃HL（該当時のみ、空行なし）
（その他病名があれば「♯病名（通院先）」の形式、空行なし）

${sasSymptomsText ? '【SASの症状】（チェックされた症状を「・」で横一列に記載。「その他」がある場合は末尾に「その他: ○○」を追加）\n' : ''}${hasDmDiff && dm.dmSymptoms?.selected?.length ? '【糖尿病の症状】（チェックされた症状を「・」で横一列に記載）\n' : ''}【アレルギー歴】（なしまたは内容を同じ行に）
【FH】DM(-/+) HT(-/+) HL(-/+) APO(-/+) IHD(-/+)（FH DMの場合は誰かも記載）
【飲酒歴】（整形済みテキスト）
【喫煙歴】（整形済みテキスト）
【健診】
【ワクチン歴】（60歳以上のみ）
【生活情報】（整形済みテキスト。70歳以上は子供の状況も含む）
【仕事】職業・活動量
---------------------------------------------
${echoLine(d.disease?.echoNeck, d.disease?.echoAbdomen)}（必ず1行に横配置）
---------------------------------------------
身長:○cm　初診時:○kg${bmiSuffix}　20歳時:○kg　max体重○kg(○歳)
---------------------------------------------
【事前聴取時　申し送り事項】
□通院のご案内をお渡し済
（現病歴：要DR確認フラグありの場合のみ）□現病歴：問診時間の関係で一部省略、要DR確認
（既往歴：要ドクター確認フラグありの場合のみ）□既往歴：要ドクター確認
（SAS区分が検査希望の場合）□SAS 簡易PSG発送手配 要
（SAS区分がCPAP継続 かつ 前医情報提供書未確認の場合）□CPAP継続：前医情報提供書 確認要
（SAS区分がCPAP継続 かつ 前医情報提供書確認済の場合）□CPAP継続：前医情報提供書 確認済
${hasDmDiff ? '□採血で DM判明 → DM初期評価追加実施済\n' : ''}（HLありの場合）□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。
${hasDmDiff && (dm.eyeFundusCheck === '受けていない' || dm.eyeNotebook === '持っていない') ? '□糖尿病-眼科連携手帳をお渡し\n' : ''}${hasDmDiff && dm.weightLoss === 'あり（3kg以上）' ? '□体重減少あり（3ヶ月以内に3kg以上）インスリン導入要検討\n' : ''}□初回療養計画書を作成済
${STAFF_FLAGS}
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${hasDmDiff ? COMMON_FOOTER : `${getCurrentMonth()}：

\n\n\n（アレルギー薬がある場合のみ「⚠️○○アレルギー⚠️」と1行で記載。HTMLタグ・style属性は絶対に出力しない。プレーンテキストのみ）
目標HbA1c　　　　%　目標体重　　　次回検討薬：`}
${hasDmDiff ? 'DM基本セット' : '基本採血なし'}
1月follow
${buildWeekday()}
LINE登録ご案内→済　登録確認未・登録できない`
    max_tokens = 1800

  // ────── 甲状腺関連 ──────
  } else if ([
    '甲状腺（バセドウ初診）', '甲状腺（バセドウ継続）', '甲状腺（橋本病）',
    '甲状腺（腫大異常なし）', '甲状腺（腺腫経過観察）', '甲状腺（腺腫悪性疑い）',
  ].includes(form_type)) {
    const tTypeMap = {
      '甲状腺（バセドウ初診）': 'basedow-new',
      '甲状腺（バセドウ継続）': 'basedow-cont',
      '甲状腺（橋本病）': 'hashimoto',
      '甲状腺（腫大異常なし）': 'nodule-normal',
      '甲状腺（腺腫経過観察）': 'adenoma',
      '甲状腺（腺腫悪性疑い）': 'malignant',
    }
    const tType = tTypeMap[form_type]
    const is2step = tType === 'nodule-normal' || tType === 'malignant'
    const isNodule = ['adenoma', 'nodule-normal', 'malignant'].includes(tType)

    let diagnosisName = ''
    if (tType === 'basedow-new')   diagnosisName = '＃バセドウ病疑い（エコー上の疑い）'
    else if (tType === 'basedow-cont') {
      const dYear = d.history?.diagnosisYear
        ? `${d.history?.diagnosisEra || '令和'}${d.history.diagnosisYear}年`
        : '診断時期不明'
      diagnosisName = `＃バセドウ病　甲状腺機能亢進症（診断時期：${dYear}）`
    }
    else if (tType === 'hashimoto')     diagnosisName = '＃橋本病疑い（エコー上の疑い）'
    else if (tType === 'nodule-normal') diagnosisName = '＃甲状腺腫大（エコー上異常なし）'
    else if (tType === 'adenoma')       diagnosisName = '＃甲状腺腺腫（経過観察）疑い'
    else if (tType === 'malignant')     diagnosisName = '＃甲状腺腺腫（悪性疑い）'

    const thySmoke = (() => {
      if (!d.history) return ''
      const s = d.history
      if (s.smoking === 'なし') return 'なし'
      const base = `${s.smokingAmount}本×${s.smokingYears}年（${s.smokingStartAge}歳〜）`
      return s.smoking === '禁煙済' ? `${base}、${s.smokingQuitEra}${s.smokingQuitYear}年に禁煙` : base
    })()

    const thyWeekday = (() => {
      const days = d.body?.preferredDays || []
      if (!days.length) return '曜希望'
      if (days.includes('指定なし')) return '曜希望：指定なし'
      return `${days.join('・')}曜希望`
    })()

    const thySymptoms = (d.symptom?.selected || []).join('・') + (d.symptom?.otherText ? `（その他: ${d.symptom.otherText}）` : '')

    const thyJobText = (() => {
      if (!d.history) return ''
      const jobs = Array.isArray(d.history.job) ? d.history.job : (d.history.job ? [d.history.job] : [])
      const note = d.history.jobNote || ''
      return [jobs.join('、'), note].filter(Boolean).join('・')
    })()

    const thyBmi = d.body?.height && d.body?.weightNow
      ? (parseFloat(d.body.weightNow) / Math.pow(parseFloat(d.body.height) / 100, 2)).toFixed(1)
      : null

    let shinsokuLines = ''
    if (tType === 'basedow-new' || tType === 'hashimoto') {
      shinsokuLines = '□甲状腺3項目＋甲状腺抗体3項目の結果を後日確認\n□あくまでエコー上の疑いであり、確定診断は医師が行いカルテ記載を完了する'
    } else if (tType === 'basedow-cont') {
      shinsokuLines = '□甲状腺3項目＋甲状腺抗体3項目の結果を後日確認\n□あくまでエコー上の所見であり、確定診断は医師が行いカルテ記載を完了する'
    } else if (tType === 'nodule-normal') {
      shinsokuLines = '□甲状腺3項目＋抗Tg抗体＋抗TPO抗体の結果を後日確認\n□本日初診にて診察（終診の可能性あり）'
    } else if (tType === 'adenoma') {
      shinsokuLines = '□甲状腺3項目＋抗Tg抗体＋抗TPO抗体の結果を後日確認\n□あくまでエコー上の所見であり、確定診断は医師が行いカルテ記載を完了する'
    } else if (tType === 'malignant') {
      shinsokuLines = '□当日、初事前診察に変更し専門医療機関へ紹介\n□当院は終診'
    }

    let footerBloodTest = ''
    if (tType === 'basedow-new') footerBloodTest = '甲状腺3項目：　TRAb：　TPO抗体：　抗Tg抗体：'
    else if (tType === 'hashimoto') footerBloodTest = '甲状腺3項目＋甲状腺抗体3項目'
    else if (tType === 'basedow-cont') footerBloodTest = '甲状腺3項目：　TRAb：　抗Tg抗体：　抗TPO抗体：'
    else if (tType === 'nodule-normal') footerBloodTest = '甲状腺3項目：　TRAb：　抗Tg抗体：　抗TPO抗体：'
    else if (tType === 'adenoma') footerBloodTest = '甲状腺3項目：　TRAb：　抗Tg抗体：　抗TPO抗体：'

    const thyDoctorLabel = d.body?.doctorGender === '院長（初回のみ）' ? '院長希望（初回のみ）' : (d.body?.doctorGender || '指定なし')

    // basedow-new/cont/hashimoto 共通: エコー所見テキスト・受診理由テキストを事前構築
    const contMedsText = (d.history?.medications || []).join('・')
    const contTimeline = (() => {
      if (tType !== 'basedow-cont' || !contMedsText) return ''
      const year = d.history?.diagnosisYear
      const month = d.history?.diagnosisMonth
      const era = d.history?.diagnosisEra || '令和'
      if (!year) return `（${contMedsText}）内服にて症状安定`
      const dateStr = era === '令和'
        ? `R${year}${month ? `/${month}` : ''}`
        : `${era}${year}年${month ? `${month}月` : ''}`
      return `${dateStr}に（${contMedsText}）内服にて症状安定`
    })()
    const thyContSurgeryText = (() => {
      if (!d.history?.surgeryHistory) return 'なし'
      const yr = d.history?.surgeryYear
      const mo = d.history?.surgeryMonth
      const type = d.history?.surgeryType || ''
      const dateStr = yr ? `R${yr}${mo ? `/${mo}` : ''}` : ''
      return `あり（${[dateStr, type].filter(Boolean).join(' ')}）`
    })()
    const thyContSideEffectText = (() => {
      const parts = []
      if (d.history?.sideEffectMmz) parts.push('メルカゾール')
      if (d.history?.sideEffectPtz) parts.push('プロパジール')
      return parts.length ? `${parts.join('・')}副作用あり` : 'なし'
    })()

    // 全6フォーム共通: 甲状腺ベース所見 3軸（サイズ/血流/実質エコー）
    const thyBaseFindings = [
      d.echo?.thyroidSize === '腫大'         && '甲状腺腫大(+)',
      d.echo?.thyroidSize === '萎縮'         && '甲状腺萎縮(+)',
      d.echo?.thyroidBloodFlow === '豊富'    && '血流豊富(+)',
      d.echo?.thyroidBloodFlow === '低下'    && '血流低下(+)',
      d.echo?.thyroidParenchyma === '整'     && '実質エコー整(+)',
      d.echo?.thyroidParenchyma === '不整'   && '実質エコー不整(+)',
      d.echo?.thyroidParenchyma === '不均一' && '実質エコー不均一(+)',
    ].filter(Boolean)
    const thyBaseFindingsText = thyBaseFindings.join('、')

    // フォーム別: メイン「当院エコーにて...」結語行
    const thyEchoConclusion = (() => {
      if (tType === 'malignant')     return '当院エコーにて悪性を疑う所見を認め当日紹介。'
      if (tType === 'adenoma')       return '当院エコーにて結節を認めたため、エコー定期followとする。'
      if (tType === 'nodule-normal') return thyBaseFindings.length > 0
        ? `当院エコーにて${thyBaseFindingsText}を認める`
        : '当院エコーにて明らかな異常所見なし'
      if (thyBaseFindings.length === 0) return ''
      if (tType === 'basedow-new')   return `当院エコーにて${thyBaseFindingsText}を認めバセドウ病を疑う`
      if (tType === 'basedow-cont')  return `当院エコーにて${thyBaseFindingsText}を認める`
      if (tType === 'hashimoto')     return `当院エコーにて${thyBaseFindingsText}を認め橋本病を疑う`
      return ''
    })()

    // 結節フォーム（adenoma/malignant）でベース所見がある場合の補助行
    const thyBaseExtraLine = (tType === 'malignant' || tType === 'adenoma') && thyBaseFindings.length > 0
      ? `${thyBaseFindingsText}を認める`
      : ''

    // 結節所見1行（hasNodule==='あり'のときのみ）
    const noduleEchoLine = (() => {
      if (d.echo?.hasNodule !== 'あり') return ''
      const parts = []
      const loc = d.echo?.noduleLocation
      const w = d.echo?.noduleSizeW
      const dep = d.echo?.noduleSizeD
      const noduleWord = d.echo?.noduleCount === '多発' ? '多発結節' : '結節'
      if (loc && (w || dep)) {
        parts.push(`${loc}に最大${w || '○'}×${dep || '○'}㎜大の${noduleWord}あり`)
      } else if (loc) {
        parts.push(`${loc}に${noduleWord}あり`)
      } else if (w || dep) {
        parts.push(`最大${w || '○'}×${dep || '○'}㎜大の${noduleWord}あり`)
      }
      if (d.echo?.calcification) parts.push(`石灰化${d.echo.calcification}`)
      if (d.echo?.noduleBloodFlow === '豊富') parts.push('血流豊富')
      else if (d.echo?.noduleBloodFlow === '乏しい') parts.push('血流に乏しい')
      if (d.echo?.noduleType) parts.push(d.echo.noduleType)
      if (d.echo?.noduleOther) parts.push(d.echo.noduleOther)
      return parts.join('、')
    })()
    const thyReasonText = (() => {
      const r = d.reason || {}
      const parts = []
      if (r.thyroidConcern) {
        const reasonsArr = Array.isArray(r.thyroidConcernReason) ? r.thyroidConcernReason : (r.thyroidConcernReason ? [r.thyroidConcernReason] : [])
        const noOther = reasonsArr.filter(x => x !== 'その他')
        const otherText = reasonsArr.includes('その他') && r.thyroidConcernNote ? r.thyroidConcernNote : ''
        const reasonText = [...noOther, otherText].filter(Boolean).join('・')
        parts.push(reasonText ? `甲状腺疾患が気になって受診（${reasonText}）` : '甲状腺疾患が気になって受診')
      } else if (r.type === '紹介') {
        const ref = [r.referralFrom, r.referralDept].filter(Boolean).join('・')
        if (ref) parts.push(`${ref}より紹介`)
        if (r.referralDetail) parts.push(r.referralDetail)
      } else if (r.type === '検診異常') {
        parts.push(`${r.checkupType || '健診'}にて甲状腺異常を指摘`)
      } else if (r.type === '自主転院') {
        if (r.transferFrom) parts.push(`${r.transferFrom}より転院`)
        if (r.transferDetail) parts.push(r.transferDetail)
      }
      if (r.summary) parts.push(r.summary)
      return parts.join('、')
    })()

    prompt = `あなたはまつもと糖尿病クリニックの電子カルテ記載AIです。以下の患者情報をもとに、甲状腺外来の初診カルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③【事前聴取時 申し送り事項】の最終□行と【診察にあたっての要望】の間も空行なし
- 追加の空行ルール（厳守）: ④条件付きで該当しない項目（空文字に展開された行）はその行ごと完全に省略し、空行を残さない ⑤エコー所見ブロック（＃診断名・結語・結節所見・ベース所見）と【アレルギー歴】の間のみ1行空ける、それ以外のセクション間（【アレルギー歴】【FH】【喫煙歴】【健診】【仕事】など）は全て空行なし ⑥フッター「R8.5：採血項目」の直下、アレルギー薬警告が該当しない場合はその行ごと省略し、フォローアップ行（"1月follow" "6か月follow" "（当日紹介、当院終診）" 等）に直接続ける ⑦区切り線（---------）は連続させず、その間に必ず1行以上の内容を入れる
- 注意書き・内部メモは出力しない。HTMLタグ・style属性は絶対に出力しない
- バセドウ初診の「甲状腺エコー：」行は後ろに何も追記せず「甲状腺エコー：」のみ出力する

【患者情報】
受診理由：${thyReasonText || d.reason?.summary || '（未記入）'}
${d.reason?.thyroidConcern ? '※「甲状腺疾患が気になって受診」の患者です。受診理由サマリーは検査前の暫定的な経緯として記載してください。' : ''}
${tType === 'basedow-cont' ? `診断時期：${d.history?.diagnosisEra || '令和'}${d.history?.diagnosisYear || '（不明）'}年\n内服薬：${contMedsText || '（未選択）'}` : ''}
甲状腺ベース所見：${thyBaseFindingsText || '（未選択 or 全て正常）'}
${tType === 'basedow-new' && d.echo?.ecg ? `ECG：${d.echo.ecg}` : ''}
結節について：${d.echo?.hasNodule || '未選択'}
${d.echo?.hasNodule === 'あり' && noduleEchoLine ? `結節所見（整形済み）：${noduleEchoLine}` : ''}
症状：${thySymptoms || 'なし'}
年齢：${d.history?.age || '未記入'}歳
アレルギー：${d.history?.allergy === 'なし' ? 'なし' : (d.history?.allergyDetail || 'あり')}
${!is2step ? `家族歴（甲状腺）：${d.history?.fh?.thyroid ? ('あり' + (d.history.fh.thyroidWho?.length ? `（${d.history.fh.thyroidWho.join('・')}）` : '')) : 'なし'}
家族歴（DM）：${d.history?.fh?.dm ? ('あり' + (d.history.fh.dmWho?.length ? `（${d.history.fh.dmWho.join('・')}）` : '')) : 'なし'}
喫煙歴：${thySmoke}
健診：${(d.history?.checkup || []).join('・') || 'なし'}
仕事：${thyJobText || '未記入'}
活動量：${d.history?.activity || '未記入'}` : ''}
${tType === 'basedow-cont' ? `手術歴：${thyContSurgeryText}
アイソトープ治療歴：${d.history?.isotopeHistory ? 'あり' : 'なし'}
薬の副作用歴：${thyContSideEffectText}
眼科通院歴：${d.history?.eyeHistory ? ('あり' + (d.history.eyeClinic ? `（${d.history.eyeClinic}）` : '')) : 'なし'}` : ''}
${tType === 'hashimoto' && d.history?.treatmentHistory ? `治療経緯：${d.history.treatmentHistory}` : ''}
医師希望：${d.body?.doctorGender || '指定なし'}
患者フラグ：${d.body?.patientFlag || '通常'}
診察への要望：${d.body?.concern || 'なし'}

${(() => {
  // 出力フォーマットを空行が混ざらないよう配列で組み立てて join する
  const reasonLine = `${getCurrentMonth()}：（受診理由サマリー1〜2行。${thySymptoms ? `自覚症状チェックあり: ${thySymptoms} → サマリー末尾に「${thySymptoms}の訴えあり。」を必ず追記し、＃診断名の上に位置するようにする` : '自覚症状なしの場合は症状追記は省略'}）`
  const diagnosisLine = `${diagnosisName}（サマリーの直後、空行なし）`
  const echoBlock = [
    tType === 'basedow-cont' && contTimeline ? contTimeline : '',
    tType === 'basedow-cont' ? `手術歴：${thyContSurgeryText}　アイソトープ歴：${d.history?.isotopeHistory ? 'あり' : 'なし'}　副作用歴：${thyContSideEffectText}　眼科：${d.history?.eyeHistory ? ('あり' + (d.history.eyeClinic ? `（${d.history.eyeClinic}）` : '')) : 'なし'}` : '',
    thyEchoConclusion,
    thyBaseExtraLine,
    noduleEchoLine,
    tType === 'basedow-new' && d.echo?.ecg ? `ECG：${d.echo.ecg}` : '',
  ].filter(Boolean).join('\n')

  const fhBlock = !is2step ? [
    '【FH】甲状腺(-/+) DM(-/+)（該当者名も記載）',
    `【喫煙歴】${thySmoke}`,
    `【健診】${(d.history?.checkup || []).join('・') || '未記入'}`,
    tType !== 'adenoma' ? `【仕事】${thyJobText}` : '',
  ].filter(Boolean).join('\n') : ''

  const dividerEchoLine = (tType === 'malignant' || tType === 'nodule-normal' || tType === 'adenoma')
    ? '空欄：検査技師が後ほど貼り付けます。'
    : `甲状腺エコー：${tType === 'basedow-new' ? '' : (() => {
        const segs = []
        if (thyBaseFindingsText) segs.push(thyBaseFindingsText)
        if (noduleEchoLine) segs.push(noduleEchoLine)
        return segs.length ? segs.join('　') : '本日施行'
      })()}`

  const heightBlock = (tType === 'malignant' || tType === 'adenoma') ? '' : `身長:${d.body?.height || '○'}cm　初診時:${d.body?.weightNow || '○'}kg${thyBmi ? `（BMI ${thyBmi}）` : ''}\n---------------------------------------------`

  const shinsokuItems = [
    tType === 'malignant' ? '' : '□通院のご案内をお渡し済',
    shinsokuLines,
    '（新患2枠取得済の場合）□新患2枠取得済み',
    `（医師希望指定ありの場合）□${thyDoctorLabel}`,
    '（患者フラグが「○患者疑い」の場合）□○患者疑い（対応注意）',
    '（患者フラグが「●患者疑い」の場合）□●患者疑い（出禁対象・要確認）',
  ].filter(Boolean).join('\n')

  const footerTrailing = tType === 'malignant'
    ? '（当日紹介、当院終診）'
    : tType === 'adenoma'
      ? `6か月follow\n${thyWeekday}\nLINE登録ご案内→済　登録確認未・登録できない`
      : `1月follow\n${thyWeekday}\nLINE登録ご案内→済　登録確認未・登録できない`

  return `【出力フォーマット】
${reasonLine}
${diagnosisLine}
${echoBlock}

【アレルギー歴】（なしまたは内容を同じ行に）
${fhBlock ? fhBlock + '\n' : ''}---------------------------------------------
${dividerEchoLine}
---------------------------------------------
${heightBlock ? heightBlock + '\n' : ''}【事前聴取時　申し送り事項】
${shinsokuItems}
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${getCurrentMonth()}：${footerBloodTest}

（アレルギー薬がある場合のみ「⚠️○○アレルギー⚠️」と1行で記載。HTMLタグ・style属性は絶対に出力しない。プレーンテキストのみ）
${footerTrailing}`
})()}`
    max_tokens = 1200

  } else {
    return res.status(400).json({ error: `未対応のform_type: ${form_type}` })
  }

  // ── API呼び出し ──────────────────────────────────────

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const rawKarte = data.content?.[0]?.text || '生成に失敗しました'
    // 連続する空行を最大1行に圧縮（条件付き行が空展開された箇所のクリーンアップ、甲状腺フォームで特に効果）
    const karte = rawKarte
      .split('\n').map(l => l.replace(/[ 　\t]+$/, '')).join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    return res.status(200).json({ karte })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

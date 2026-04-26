// 許可する form_type(ホワイトリスト、CLAUDE.md の 6 フォームと同期)
const ALLOWED_FORM_TYPES = new Set([
  'DM基本',
  '1型糖尿病',
  '高血圧・脂質異常症',
  '妊娠糖尿病',
  '反応性低血糖',
  '小児1型糖尿病',
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
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③他院管理疾患が複数あっても他院管理同士は連続列挙し空行なし ④他院管理疾患の最終行と【アレルギー歴】の間は空行なし（直接続ける）
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
${voiceMemoBlock}${voicePastHistoryBlock}${needsDoctorReviewBlock}
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
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③他院管理疾患が複数あっても他院管理同士は連続列挙し空行なし ④他院管理疾患の最終行と【アレルギー歴】の間は空行なし（直接続ける）
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
${voiceMemoBlock}${voicePastHistoryBlock}${needsDoctorReviewBlock}
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
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③他院管理疾患が複数あっても他院管理同士は連続列挙し空行なし ④他院管理疾患の最終行と【アレルギー歴】の間は空行なし（直接続ける）
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
${voiceMemoBlock}${voicePastHistoryBlock}${needsDoctorReviewBlock}
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

  // ────── 妊娠糖尿病 ──────
  } else if (form_type === '妊娠糖尿病') {
    prompt = `あなたは糖尿病専門クリニックの電子カルテ記載AIです。以下の患者情報をもとに、妊娠糖尿病のカルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③他院管理疾患が複数あっても他院管理同士は連続列挙し空行なし ④他院管理疾患の最終行と【アレルギー歴】の間は空行なし（直接続ける）
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
${voiceMemoBlock}${voicePastHistoryBlock}${needsDoctorReviewBlock}
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
${voiceMemoBlock}${voicePastHistoryBlock}${needsDoctorReviewBlock}
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
（既往歴：要ドクター確認フラグありの場合のみ）□既往歴：要ドクター確認
（甲状腺3項目追加済の場合）□甲状腺3項目追加採血済
（リブレ装着済の場合）□自費CGM（リブレ）装着済
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
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③他院管理疾患が複数あっても他院管理同士は連続列挙し空行なし ④他院管理疾患の最終行と【アレルギー歴】の間は空行なし（直接続ける）
- ＃HT・＃HLは必ず＃1型糖尿病の直後に記載し、末尾には絶対に記載しない
- アレルギー薬の記載以降は指定フォーマットのみを出力し、病名・診断名を追記しない

【整形済みデータ】
希望曜日：${buildWeekday()}
医師希望：${doctorGender}
患者フラグ：${patientFlag}
新患2枠取得：${doubleSlot}

【患者情報JSON】
${JSON.stringify({ disease: d.disease, history: d.history, body: d.body, reason: d.reason, support: d.support, chronic: d.chronic }, null, 2)}
${voiceMemoBlock}${voicePastHistoryBlock}${needsDoctorReviewBlock}
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
    const karte = data.content?.[0]?.text || '生成に失敗しました'
    return res.status(200).json({ karte })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

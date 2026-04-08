export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { form_data, form_type } = req.body
  if (!form_data) return res.status(400).json({ error: 'form_data is required' })

  const d = form_data

  const getCurrentMonth = () => {
    const now = new Date()
    const reiwaYear = now.getFullYear() - 2018
    return `R${reiwaYear}.${now.getMonth() + 1}`
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
    if (!d.lifestyle) return ''
    const { livingSpouse, livingOther, livingCustom } = d.lifestyle
    const hasSpouse = livingSpouse === '配偶者あり'
    const other = (livingOther === '子供と同居なし' || !livingOther) ? '' : livingOther
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

  const echoNeck = d.disease?.echoNeck === '行っていない' ? '当院で施行予定' : d.disease?.echoNeck || '未記入'
  const echoAbdomen = d.disease?.echoAbdomen === '行っていない' ? '当院で施行予定' : d.disease?.echoAbdomen || '未記入'

  const prompt = `あなたはまつもと糖尿病クリニックの電子カルテ記載AIです。
以下の患者情報をもとに、クリニックのフォーマット通りにカルテ記載文を生成してください。

【ルール】
- 注意書き・内部メモは出力しない
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- 体重減少ありの場合は一番上に【⚠️ 体重減少あり・早急なインスリン導入を検討】と記載
- 60歳未満はワクチン歴を省略、70歳未満は子供の状況を省略
- 喫煙歴は「○本×○年（○歳〜）」の形式
- 重要既往歴には「治療した病院 → 現在通院先」を記載
- 甲状腺追加済の場合は HL の後に「◎甲状腺3項目追加済」を記載
- ＃糖尿病の右に発症時期を記載（例：＃糖尿病（令和2年））
- 受診理由の直後に改行なしで＃糖尿病を続ける

【整形済みデータ】
飲酒歴：${buildAlcohol()}
喫煙歴：${buildSmoking()}
生活情報：${buildLiving()}
発症時期テキスト：${dmOnsetText()}
頚部エコー：${echoNeck}
腹部エコー：${echoAbdomen}

【患者情報JSON】
${JSON.stringify(d, null, 2)}

【追加情報】
現在日時：${getCurrentMonth()}
体重減少：${d.alert?.weightLoss || ''}
HTあり：${d.disease?.ht || false}
HLあり：${d.disease?.hl || false}

【出力フォーマット（必ずこの順序で。該当なければ省略）】
（体重減少が「あり」かつ3kg以上の場合のみ）【⚠️ 体重減少あり・早急なインスリン導入を検討】

${getCurrentMonth()}：（受診理由サマリー1〜2行。記載なければ省略）
＃糖尿病${dmOnsetText()}（サマリーの直後、空行なし）
＃HT（該当時のみ）
＃HL（該当時のみ）
◎甲状腺3項目追加済（HL+甲状腺追加済の場合のみ）

♯胃癌（胃切除後：治療種類・範囲・時期・治療病院→通院先・内服薬）（該当時のみ）
♯膵臓癌（術後：治療種類・時期・治療病院→通院先・内服薬）（該当時のみ）
♯IHD：PCI後（時期・治療病院→通院先・抗血小板薬）（該当時のみ）
♯脳梗塞後（時期・治療病院→通院先・抗血小板薬）（該当時のみ）
（その他既往があれば記載）

【アレルギー歴】（アレルギーなしなら「なし」、ありなら内容をそのまま同じ行に記載）
【FH】DM(-/+) HT(-/+) APO(-/+) IHD(-/+)（FH DMの場合は誰かも記載）
【飲酒歴】（整形済みテキスト）
【喫煙歴】（整形済みテキスト）
【眼科通院歴】
【健診】
【ワクチン歴】（60歳以上のみ）
【生活情報】（整形済みテキスト。70歳以上は子供の状況も含む）
【仕事】職業・活動量
---------------------------------------------
頚部エコー：（他院で施行済の場合「他院施行済」、健診で施行済の場合「健診施行済」、行っていない場合「当院で施行予定」と記載）
腹部エコー：（他院で施行済の場合「他院施行済」、健診で施行済の場合「健診施行済」、行っていない場合「当院で施行予定」と記載）
---------------------------------------------
身長:○cm　初診時:○kg　20歳時:○kg　max体重○kg(○歳)
---------------------------------------------
【事前聴取時　申し送り事項】
（体重減少ありかつ3kg以上の場合）□体重減少あり（3ヶ月以内に3kg以上）インスリン導入要検討
（HTありの場合）□HTの確認のため、血圧手帳をお渡ししています。
（HLありの場合）□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。
□生活習慣病療養計画書を作成済
【診察にあたっての要望】（あれば記載。なければ省略）
---------------------------------------------
${getCurrentMonth()}：HbA1c　　%　CPR（　）　※GAD陽性の場合は甲状腺項目追加してください　CPR0.5以下の方は今後半年ごとCPR測定を入れてください。




アレルギー薬あれば赤字14フォント太字
目標HbA1c　　　　%　目標体重　　　次回検討薬：
DM基本セット
1月follow
曜希望
LINE登録ご案内→済　登録確認未・登録できない
`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
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

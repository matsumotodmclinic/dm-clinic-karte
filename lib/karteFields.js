// form_data から「カルテに載る項目の文字列」を作る純粋関数。
//
// もともと lib/buildKartePrompt.js の中にあった（プロンプトの【整形済みデータ】を作るため）。
// 2026-09-06 に AI フリー版のカルテ組立（lib/buildKarteTemplate.js）を足すにあたって切り出した。
// プロンプト用と AI フリー版で同じ実装を使う = 表記がズレようがない。
//
// 全て d（= form_data）を受け取る純粋関数。セクションの格納先はフォームごとに違う
// （DM基本は lifestyle、T1D/HTHL/RH/GDM は history）ので、そこは各関数が吸収する。

const ALCOHOL_TYPES = [
  { key: 'beer',   label: 'ビール' },
  { key: 'happo',  label: '発泡酒' },
  { key: 'wine',   label: 'ワイン' },
  { key: 'shochu', label: '焼酎' },
  { key: 'sake',   label: '日本酒' },
  { key: 'whisky', label: 'ウイスキー' },
]

// 今日の和暦月（R8.9 形式）
export function getCurrentMonth(now = new Date()) {
  return `R${now.getFullYear() - 2018}.${now.getMonth() + 1}`
}

export function buildAlcohol(d) {
  if (!d?.history) return ''
  if (d.history.alcoholNone) return 'なし'
  const items = (d.history.alcoholItems || []).filter(a => a.type && a.amount)
  if (!items.length) return ''
  return items.map(a => {
    const t = ALCOHOL_TYPES.find(x => x.key === a.type)
    return `${t?.label || a.type}${a.amount}${a.freq ? `（${a.freq}）` : ''}`
  }).join('、')
}

export function buildSmoking(d) {
  if (!d?.history) return ''
  const s = d.history
  if (s.smoking === 'なし') return 'なし'
  const base = `${s.smokingAmount}本×${s.smokingYears}年（${s.smokingStartAge}歳〜）`
  return s.smoking === '禁煙済' ? `${base}、${s.smokingQuitEra}${s.smokingQuitYear}年に禁煙` : base
}

export function buildLiving(d) {
  // DM基本は d.lifestyle、T1D/HTHL/RH/GDM は d.history に格納
  const src = d?.lifestyle || d?.history || {}
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

export function buildChildInfo(d) {
  const src = d?.lifestyle || d?.history || {}
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

export function buildJobStr(d) {
  const src = d?.lifestyle || d?.history || {}
  const jobs = Array.isArray(src.job) ? src.job : (src.job ? [src.job] : [])
  const note = src.jobNote || ''
  return [jobs.join('、'), note].filter(Boolean).join('・')
}

// ＃糖尿病の右に付ける発症時期（例：（令和2年））
export function dmOnsetText(d) {
  if (!d?.disease) return ''
  if (d.disease.dmOnsetUnknown) return ''
  if (!d.disease.dmOnset) return ''
  return `（${d.disease.dmOnsetEra}${d.disease.dmOnset}年）`
}

export function buildWeekday(d) {
  const days = d?.body?.preferredDays || []
  if (!days.length) return '曜希望'
  if (days.includes('指定なし')) return '曜希望：指定なし'
  return `${days.join('・')}曜希望`
}

export function buildBmi(d) {
  return d?.body?.height && d?.body?.weightNow
    ? (parseFloat(d.body.weightNow) / Math.pow(parseFloat(d.body.height) / 100, 2)).toFixed(1)
    : null
}

// 糖尿病の症状（DM基本 / 1型 / 小児1型）。「・」区切りの横一列。
export function buildDmSymptoms(sym) {
  const sel = sym?.selected || []
  if (sel.length === 0) return ''
  const items = sel.filter(s => s !== 'その他')
  const other = (sym?.otherText || '').trim()
  if (sel.includes('その他') && other) items.push(`その他: ${other}`)
  return items.join('・')
}

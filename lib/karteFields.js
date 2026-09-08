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

// 選択肢の「その他」はカルテに書いても情報がゼロ（「その他の科」「その他の職業」）。
// 自由入力欄がある項目はそちらが入るので、選択値としての「その他」は落とす。
// 2026-09-08 まで「上尾中央総合病院 その他」「○○病院・その他より紹介」のように
// そのまま出ていた（2026-08-22 の hospitalOther バグと同じ「その他」漏れ）。
export function dropOther(v) {
  if (Array.isArray(v)) return v.filter(x => x && x !== 'その他')
  return v === 'その他' ? '' : (v || '')
}

// ★種類・量・頻度は 3 つとも任意入力。1 つでも埋まっていれば書く。
//   2026-09-08 まで「種類 かつ 量」が揃った行だけを採用していたため、
//   「焼酎・毎日（量は聞けなかった）」のような行が丸ごと落ちていた。
export function buildAlcohol(d) {
  if (!d?.history) return ''
  if (d.history.alcoholNone) return 'なし'
  const items = (d.history.alcoholItems || []).filter(a => a?.type || a?.amount)
  if (!items.length) return ''
  return items.map(a => {
    const t = ALCOHOL_TYPES.find(x => x.key === a.type)
    const label = t?.label || a.type || ''
    return `${label}${a.amount || ''}${a.freq ? `（${a.freq}）` : ''}`
  }).join('、')
}

// ★本数・年数・開始年齢・禁煙年は任意入力。埋まっている分だけ書く。
//   2026-09-08 まで無条件にテンプレートへ埋めていたため、詳細を聞けなかった回に
//   「本×年（歳〜）、年に禁煙」という壊れた文字列がカルテに載っていた。
export function buildSmoking(d) {
  if (!d?.history) return ''
  const s = d.history
  if (s.smoking === 'なし') return 'なし'
  if (!s.smoking) return ''
  const detail = [
    s.smokingAmount ? `${s.smokingAmount}本` : '',
    s.smokingYears ? `×${s.smokingYears}年` : '',
    s.smokingStartAge ? `（${s.smokingStartAge}歳〜）` : '',
  ].join('')
  const quit = s.smoking === '禁煙済'
    ? (s.smokingQuitYear ? `${s.smokingQuitEra || '令和'}${s.smokingQuitYear}年に禁煙` : '禁煙済')
    : ''
  // 詳細も禁煙時期も無ければ、選んだ区分（あり）だけを残す
  return [detail || (quit ? '' : s.smoking), quit].filter(Boolean).join('、')
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
  const jobs = dropOther(Array.isArray(src.job) ? src.job : (src.job ? [src.job] : []))
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

// 身長 0 や打ち間違いで Infinity / NaN がカルテに載らないようにする
export function buildBmi(d) {
  const h = parseFloat(d?.body?.height)
  const w = parseFloat(d?.body?.weightNow)
  if (!(h > 0) || !(w > 0)) return null
  const v = w / Math.pow(h / 100, 2)
  return Number.isFinite(v) ? v.toFixed(1) : null
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

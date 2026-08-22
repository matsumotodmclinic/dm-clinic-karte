// 「その他の病名・既往歴」の 病名（通院先）テキスト組み立て（全フォーム共通）
//
// 各フォームの otherDiseases は { name, hospital, hospitalOther, dept } の配列。
// 病院プルダウンで「その他」を選ぶと hospitalOther に病院名を自由入力する UI だが、
// 2026-08-22 まで prompt 側が hospital しか見ておらず「（その他）」と出力されていた。
// 通院先の取り違えはカルテの実害に直結するため、全フォームでこの関数に統一する。
//
// 例:
//   子宮筋腫（鰐坂医院）                       ← hospital='その他', hospitalOther='鰐坂医院'
//   慢性腎臓病（上尾中央総合病院 腎臓内科）    ← hospital + dept
//   うつ病（通院なし）
//   甲状腺疾患                                  ← 通院先未選択
export function buildOtherDiseasesText(list) {
  const items = (list || [])
    .filter(x => x && x.name && String(x.name).trim())
    .map(x => {
      const name = String(x.name).trim()
      const hosp = (x.hospital === 'その他' ? (x.hospitalOther || '') : (x.hospital || '')).trim()
      if (!hosp) return name
      if (hosp === '通院なし') return `${name}（通院なし）`
      return `${name}（${[hosp, (x.dept || '').trim()].filter(Boolean).join(' ')}）`
    })
  return items.join('、') || 'なし'
}

// form_data 内の otherDiseases の在り処はフォームによって違う
// （DM/HTHL/SAS/内分泌 は disease 配下、T1D/小児1型/GDM/RH は history 配下）
export function pickOtherDiseases(d) {
  const fromDisease = d?.disease?.otherDiseases
  if (Array.isArray(fromDisease) && fromDisease.some(x => x && x.name)) return fromDisease
  const fromHistory = d?.history?.otherDiseases
  if (Array.isArray(fromHistory)) return fromHistory
  return Array.isArray(fromDisease) ? fromDisease : []
}

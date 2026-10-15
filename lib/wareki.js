// 和暦の換算。**元号の表はここだけ**に置く。
//
// ■ なぜ切り出したか（2026-10-16）
// 元号の表は 3 箇所から要る: カルテ本文（`lib/buildKarteTemplate.js` の装着日・予約日）/
// 音声整形の「○年前」の換算（`lib/voiceSummary.js`）/ 印刷の貼り付けの西暦→和暦（`lib/printKarte.js`）。
// もとは印刷用のファイルに置いてあり、音声整形がそこから import していた。
// 表を写すと**写した先だけ直し忘れる**ので、印刷に依らない 1 枚にした。
//
// 元号の切り替わりは「日」まで見ないと決まらないが、問診に出るのは年月がほとんどなので
// **月で判定**する（令和=2019年5月〜 / 平成=1989年1月〜2019年4月 / 昭和=1926年〜1988年）。
// 1989年1月は昭和64年(1/1-1/7)と平成元年が混在するが、検査年月の実用上は平成とする。
// from = 元号が始まった「年*12+月」。base = 元年にあたる西暦。
// ★base は from から割り出さないこと。昭和は 12 月始まりなので、割り算すると 1 年ずれる
//   （実測: 1988年12月 が S62.12 になった。正しくは S63.12）。
const ERAS = [
  { code: 'R', name: '令和', from: 2019 * 12 + 5, base: 2019 },
  { code: 'H', name: '平成', from: 1989 * 12 + 1, base: 1989 },
  { code: 'S', name: '昭和', from: 1926 * 12 + 12, base: 1926 },
]

/** 西暦の年月（1 始まりの月）を `R8.10` の形にする。範囲外なら null */
export function toWareki(year, month) {
  const y = Number(year)
  const m = Number(month)
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null
  if (y < 1926 || y > 2100) return null   // 明らかに年でないものは触らない
  const key = y * 12 + m
  const era = ERAS.find(e => key >= e.from)
  if (!era) return null
  return { code: era.code, name: era.name, year: y - era.base + 1, month: m }
}

/**
 * 日付ピッカーの値（`2026-10-16`）を `R8.10.16` にする。読めなければ '' を返す。
 *
 * ★カルテは和暦のみ（CLAUDE.md の和暦統一ルール）。画面の入力は `<input type="date">` なので
 *   必ず西暦で来る。**ここを通さずに値をそのままカルテに置かないこと。**
 */
export function toWarekiYmd(value) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(value || '').trim())
  if (!m) return ''
  const w = toWareki(m[1], m[2])
  if (!w) return ''
  const day = Number(m[3])
  if (!(day >= 1 && day <= 31)) return ''
  return `${w.code}${w.year}.${w.month}.${day}`
}

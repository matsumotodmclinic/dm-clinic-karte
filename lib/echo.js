// エコー検査（頚部・腹部）の カルテ表記 変換（全フォーム共通）
//
// 選択肢はフォームごとに少しずつ違うが、カルテ表記への変換ルールは共通。
// 2026-08-22 まで各フォームが個別に三項演算子を書いており、
// 「希望なし」を追加した際に HTHL / SAS / 内分泌 の頚部エコーで
// 「希望なし」→「当院で施行予定」に化ける不具合が出ていた（未知の値を
// 全部 当院で施行予定 に潰す実装だったため）。ここに集約して再発を防ぐ。
//
// 変換:
//   他院で施行済 → 他院施行済
//   健診で施行済 → 健診施行済
//   行っていない → 当院で施行予定
//   希望あり / 希望なし → そのまま（未知の選択肢もそのまま通す）
//   未選択（空） → fallback（フォーム・項目ごとに意味が違うので呼び出し側で指定）
//
// fallback の使い分け:
//   頚部エコー … 「当院で施行」ボタンが無く、未選択＝当院で実施 が既定 → '当院で施行予定'
//   腹部エコー … 希望あり/なし を聞くフォームでは 未選択＝未聴取 → '未選択'
//   DM は 行っていない ボタンがあるので 未選択＝未記入 → '未記入'
export function formatEcho(value, fallback = '当院で施行予定') {
  const v = (value || '').trim()
  if (!v) return fallback
  if (v === '行っていない') return '当院で施行予定'
  if (v === '他院で施行済') return '他院施行済'
  if (v === '健診で施行済') return '健診施行済'
  return v
}

// カルテ本文の「頚部エコー：○○　腹部エコー：○○」1行（全角スペース区切り）
export function buildEchoLine(neck, abdomen, opts = {}) {
  const neckFallback = opts.neckFallback || '当院で施行予定'
  const abdomenFallback = opts.abdomenFallback || '当院で施行予定'
  return `頚部エコー：${formatEcho(neck, neckFallback)}　腹部エコー：${formatEcho(abdomen, abdomenFallback)}`
}

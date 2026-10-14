// ドクターキューブ（患者が来院前に入力する事前WEB問診）の貼り付けテキストの扱い。
// 院長依頼 2026-10-14「貼り付けする欄を用意してくれればそちらに貼り付けしたい。A4 は 1 枚で」。
//
// ■ どこで使うか
//   貼り付け  = 詳細画面（form_data.drQube.text に保存）
//   出すところ = 印刷用 A4 だけ（左=カルテ / 右=ドクターキューブ の横並び）
// ★カルテ本文（電子カルテに貼る文）には入れない（院長確定）。
//   生成カルテは書式を検査しているので、患者の生文を混ぜると検査の外側が増えるため。

// ドクターキューブの出力は「【項目】→ 値」の繰り返し。
// 【 で始まる行を区切りにして塊に分け、塊ごとに間を空けて出す。
// ベタ打ちのまま流すと、狭い段では項目の切れ目が読み取れないため。
//
// ★もとは「A4 に収めるため貼り付け欄を 2 段組みにしたら、段の変わり目で項目が真っ二つになった」
//   （実測: 【HbA1c】の続きだけが右段の先頭に出た）のが発端。
//   その後 院長案で **左右の横並び**にしたので段組みは無くなったが、
//   塊に分けること自体は読みやすさのために残している。
//
// 【 が 3 つ未満なら、ドクターキューブ以外の形式が貼られたとみなして分割しない（null を返す）。
// 勝手に切らないための歯止め。
export function splitDrQube(text) {
  const src = String(text || '').replace(/\r\n/g, '\n')
  const chunks = []
  for (const line of src.split('\n')) {
    if (line.startsWith('【') || !chunks.length) chunks.push([line])
    else chunks[chunks.length - 1].push(line)
  }
  const blocks = chunks.map(c => c.join('\n').replace(/\n+$/, '')).filter(b => b.trim())
  return blocks.length >= 3 ? blocks : null
}

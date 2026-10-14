// ドクターキューブ（患者が来院前に入力する事前WEB問診）の貼り付けテキストの扱い。
// 院長依頼 2026-10-14「貼り付けする欄を用意してくれればそちらに貼り付けしたい。A4 は 1 枚で」。
//
// ■ どこで使うか
//   貼り付け  = 詳細画面（form_data.drQube.text に保存）
//   出すところ = 印刷用 A4 だけ
// ★カルテ本文（電子カルテに貼る文）には入れない（院長確定）。
//   生成カルテは書式を検査しているので、患者の生文を混ぜると検査の外側が増えるため。

// ドクターキューブの出力は「【項目】→ 値」の繰り返し。
// A4 を 1 枚に収めるため 2 段組みにするが、素の 2 段組みだと段の変わり目で項目が
// 真っ二つになる（実測で確認: 【HbA1c】の続きだけが右段の先頭に出た）。
// そこで【 で始まる行を区切りにして塊に分け、塊の途中では段を変えさせない
// （CSS 側の .kp-print-dq-block { break-inside: avoid }）。
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

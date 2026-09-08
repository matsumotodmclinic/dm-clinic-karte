// 本文を Shift-JIS (CP932) のバイト列に変換する — QR の「Shift-JIS」モード用 (2026-09-08)
//
// なぜ必要か: qrcode の Kanji mode (toSJISFunc) に任せると、英数字に挟まれた 1 文字だけの
//   日本語記号 (＃ → 、 × 等) を「byte mode の UTF-8 の方が小さい」と最適化して UTF-8 で入れてしまい、
//   Shift-JIS 前提のリーダー (BC-NL3000UⅡ 等) でそこだけ化けた (院長の実機テスト 2026-09-08)。
//   → 本文全体を Shift-JIS バイト列として byte mode 1 セグメントで入れれば一貫して解釈される。
//
// 変換表は qrcode 同梱の helper/to-sjis を借りる (呼び出し側が動的 import して渡す)。
// JIS X 0208 に無い文字は FALLBACK で近い表記に置換し、それも無ければ 〓 (0x81AC) にする。
// 紹介状アプリ apps/voice/lib/shiftJis.ts と同一実装。

const FALLBACK = {
  '²': '2', '³': '3', 'µ': 'μ', '≥': '≧', '≤': '≦', '〜': '～', '−': '－',
  '–': '-', '—': '―', '‐': '-', '’': "'", '‘': "'", '“': '"', '”': '"',
  '㎎': 'mg', '㎏': 'kg', '㎝': 'cm', '㎜': 'mm', '㎡': 'm2', '㎖': 'mL', '㏄': 'cc',
  '①': '(1)', '②': '(2)', '③': '(3)', '④': '(4)', '⑤': '(5)',
  '⑥': '(6)', '⑦': '(7)', '⑧': '(8)', '⑨': '(9)', '⑩': '(10)',
  'Ⅰ': 'I', 'Ⅱ': 'II', 'Ⅲ': 'III', 'Ⅳ': 'IV', 'ⅰ': 'i', 'ⅱ': 'ii', 'ⅲ': 'iii', 'ⅳ': 'iv',
  ' ': ' ', '​': '',
};

export function toShiftJisBytes(text, toSJIS) {
  const out = [];
  const replaced = new Map();
  const dropped = new Set();

  const push = (ch) => {
    const cp = ch.codePointAt(0) || 0;
    if (cp < 0x80) { out.push(cp); return true; }
    if (cp >= 0xff61 && cp <= 0xff9f) { out.push(cp - 0xff61 + 0xa1); return true; } // 半角カナ
    const code = toSJIS(ch);
    if (typeof code === 'number') { out.push(code >> 8, code & 0xff); return true; }
    return false;
  };

  for (const ch of text) {
    if (push(ch)) continue;
    const fb = FALLBACK[ch];
    if (fb !== undefined) {
      let ok = true;
      const start = out.length;
      for (const c of fb) ok = push(c) && ok;
      if (ok) { if (fb !== '') replaced.set(ch, fb); continue; }
      out.length = start;
    }
    out.push(0x81, 0xac); // 〓
    dropped.add(ch);
  }

  return { bytes: new Uint8Array(out), replaced: [...replaced], dropped: [...dropped] };
}

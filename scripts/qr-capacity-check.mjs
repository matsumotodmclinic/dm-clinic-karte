// カルテ文が QR コード 1 枚に収まるかを測る (2026-09-07)
//   node scripts/qr-capacity-check.mjs
//
// ゴールデンのカルテ本文スナップショット (全14フォーム) を実データとして使う。
//
// ★ QR は「表示サイズ」ではなく「モジュール数（バージョン）」で情報量が決まる。
//   画面で小さく表示しても**中身は 1 文字も減らない**。減るのは 1 モジュールあたりの
//   ピクセル数で、小さすぎると**読めなくなる**（読めれば誤り訂正により完全に正しく読める）。
//   実用の目安は **1 モジュール 2〜3px 以上**。
//     スマホ幅 375px の場合: v25 (117) → 3.2px / v33 (149) → 2.5px / v40 (177) → 2.1px
//
// 容量 (UTF-8 バイナリ): 誤り訂正 M = 2,331B / L = 2,953B

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';

// cwd に依存しないようスクリプト自身の位置を基準にする
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, 'golden', '__snapshots__');
const files = fs.readdirSync(DIR).filter((f) => f.startsWith('カルテ_') && f.endsWith('.txt'));

console.log('');
console.log('QR 容量チェック（カルテ本文スナップショット）');
console.log('');
let ng = 0;
const rows = [];
for (const f of files.sort()) {
  const text = fs.readFileSync(path.join(DIR, f), 'utf8');
  const bytes = Buffer.byteLength(text, 'utf8');
  let done = null;
  for (const level of ['M', 'L']) {
    try {
      const qr = QRCode.create(text, { errorCorrectionLevel: level });
      done = { level, version: qr.version, modules: qr.modules.size };
      break;
    } catch {
      // 次のレベルで再試行
    }
  }
  if (!done) ng++;
  rows.push({ name: f.replace(/^カルテ_|\.txt$/g, ''), chars: text.replace(/\s/g, '').length, bytes, ...done });
}

const w = Math.max(...rows.map((r) => r.name.length));
for (const r of rows.sort((a, b) => b.bytes - a.bytes)) {
  if (!r.version) {
    console.log(`  ✗ ${r.name.padEnd(w)} ${String(r.bytes).padStart(5)}B  1枚に収まらない`);
    continue;
  }
  // スマホ幅 375px で表示したときの 1 モジュールあたりのピクセル数
  const px = (375 / r.modules).toFixed(1);
  const mark = r.version >= 33 ? '△' : '✅';
  console.log(
    `  ${mark} ${r.name.padEnd(w)} ${String(r.bytes).padStart(5)}B  誤り訂正${r.level} v${String(r.version).padStart(2)} (${r.modules}マス) ` +
      `スマホ375pxで 1マス${px}px`
  );
}
console.log('');
console.log(ng === 0 ? '  ✅ 全フォームが QR 1 枚に収まる' : `  ✗ ${ng} 件が収まらない`);
console.log('  △ = バージョン33以上。読み取りにくい場合は端末を横向きにするか拡大する');
console.log('');

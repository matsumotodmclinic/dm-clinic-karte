// カルテ記載文を QR コードで表示する (2026-09-07)
//
// 用途: **電子カルテ端末がインターネットに繋がっていない施設**で、生成したカルテ文を電カルへ移す。
//   スマホ・タブレットでこの画面を開き、電カル端末に繋いだ QR リーダーで読み取ると、
//   HID (キーボードエミュレーション) 経由で入力欄にそのまま入力される。
//   → 電カル側に専用ソフトを入れる必要がなく、ネットワーク連携の設定も不要。
//   TXP Medical が問診結果の取り込みで採っている方式と同型 (2026-09-07 院長発案)。
//
// ⚠️ 読み取り機は **QR (2次元) 対応**である必要がある。1次元バーコード専用機では読めない。
// ⚠️ 改行の扱いは実機で要確認 (リーダーが Enter を送ると電カルによっては「確定」になる)。
//
// 容量 (QR バージョン40・UTF-8): 誤り訂正 M = 2,331 バイト / L = 2,953 バイト。
//   収まらない場合は分割せずエラーにする (分割は読み取りの手間が増えて現場で使われないため)。

import { useEffect, useRef, useState } from 'react';
import { UI } from '../lib/uiTokens';

const CAPACITY = { M: 2331, L: 2953 };

export default function QrModal({ text, title, onClose }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 動的 import: QR を開いたときだけ読み込む
      const QRCode = (await import('qrcode')).default;
      if (cancelled) return;
      const bytes = new TextEncoder().encode(text).length;

      for (const level of ['M', 'L']) {
        if (bytes > CAPACITY[level]) continue;
        try {
          // 高解像度で描画し、表示側は CSS で画面幅に合わせる (スマホでの表示を考慮)
          await QRCode.toCanvas(canvasRef.current, text, {
            errorCorrectionLevel: level,
            width: 720,
            margin: 2,
          });
          const qr = QRCode.create(text, { errorCorrectionLevel: level });
          if (!cancelled) {
            setInfo({ bytes, level, version: qr.version, modules: qr.modules.size });
            setError(null);
          }
          return;
        } catch (e) {
          // 次のレベルで再試行
        }
      }
      if (!cancelled) {
        setError(
          `本文が長すぎて QR コード 1 枚に収まりません（${bytes.toLocaleString()} バイト / 上限 ${CAPACITY.L.toLocaleString()} バイト）。本文を短くしてから再度お試しください。`
        );
      }
    })();
    return () => { cancelled = true; };
  }, [text]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,23,42,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: UI.surface, borderRadius: 12, padding: 20,
          maxWidth: 760, width: '100%', maxHeight: '100%', overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: UI.text, marginBottom: 6 }}>
          QRコードで電子カルテへ取り込む
        </div>
        {title && (
          <div style={{ fontSize: 12, color: UI.textMuted, marginBottom: 8 }}>{title}</div>
        )}
        <p style={{ fontSize: 12, color: UI.textMuted, lineHeight: 1.7, marginTop: 0, marginBottom: 14 }}>
          電子カルテの入力欄に<strong>カーソルを置いてから</strong>、QRリーダーで読み取ってください。読み取った本文がそのまま入力されます。
          <span style={{ display: 'block', color: UI.textFaint }}>
            ネットワーク接続は不要です。読み取り機は QR（2次元コード）対応のものをご利用ください。
          </span>
        </p>

        {error ? (
          <div style={{
            background: UI.danger.bg, border: `1px solid ${UI.danger.fg}`, color: UI.danger.fg,
            borderRadius: 8, padding: '12px 14px', fontSize: 13, lineHeight: 1.7,
          }}>
            {error}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', maxWidth: 560, height: 'auto', border: `1px solid ${UI.border}`, borderRadius: 6 }}
            />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: UI.textFaint }}>
            {info && `${text.length.toLocaleString()}文字 / ${info.bytes.toLocaleString()}バイト / 誤り訂正 ${info.level} / バージョン ${info.version}`}
            {info && info.version >= 33 && (
              <span style={{ display: 'block', color: UI.warning.fg }}>
                目が細かいコードです。スマホを縦のまま読み取れない場合は、<strong>端末を横向きにする</strong>か画面を拡大してください（横向きにすると 2 倍ほど大きく表示されます）。
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', borderRadius: 6, border: 'none', background: UI.neutral.fg,
              color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

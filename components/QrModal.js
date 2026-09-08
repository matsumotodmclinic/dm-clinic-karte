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

import { useEffect, useState } from 'react';
import { UI } from '../lib/uiTokens';

const CAPACITY = { M: 2331, L: 2953 };

// 表示サイズ (2026-09-08 院長「PC で開くと QR が大きすぎる」)。
//   ハンディ型 QR リーダーは数 cm〜十数 cm の距離で読むため、大きすぎると視野に収まらない。
//   物理サイズの目安 (96dpi): S=300px≈8cm / M=480px≈13cm / L=760px≈20cm。
//   環境 (端末・リーダー) で正解が変わるので切替にし、選択は端末に記憶する。
const SIZE_PX = { S: 300, M: 480, L: 760 };
const SIZE_LABEL = { S: '小', M: '中', L: '大' };
const SIZE_KEY = 'kvp.qrSize';

function defaultSize() {
  try {
    const saved = localStorage.getItem(SIZE_KEY);
    if (saved === 'S' || saved === 'M' || saved === 'L') return saved;
  } catch (e) {
    /* localStorage 不可でも既定で動く */
  }
  // PC (幅広) は中、タブレット/スマホは大
  if (typeof window !== 'undefined' && window.innerWidth >= 1024) return 'M';
  return 'L';
}

export default function QrModal({ text, title, onClose }) {
  // ★canvas ではなく data URL → <img> で表示する (2026-09-08)。
  //   qrcode の toCanvas は canvas の inline style に width/height = 1000px を直接書くため、
  //   CSS で幅を縮めても高さが 1000px のまま残り**縦長に歪んだ** (院長スクショで発覚)。
  //   <img> なら要素のスタイルはこちらの CSS だけで決まり、正方形が保たれる。
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [size, setSize] = useState('M');

  // 初期サイズは端末の記憶 > 画面幅 (SSR では判定できないので mount 後に決める)
  useEffect(() => { setSize(defaultSize()); }, []);

  const changeSize = (s) => {
    setSize(s);
    try { localStorage.setItem(SIZE_KEY, s); } catch (e) { /* 記憶できなくても表示は変わる */ }
  };

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
          // ★タブレット表示に最適化 (2026-09-07 院長確定)。
          //   描画は 1000px の高解像度で作り、表示側で画面に合わせて縮める。
          //   こうするとタブレット (短辺 768px) でも拡大ボケが出ない。
          //   margin は QR 規格上の必須静穏帯 4 モジュール分を確保する
          //   (2 だと規格未満で読み取り率が落ちる機種がある)。
          const url = await QRCode.toDataURL(text, {
            errorCorrectionLevel: level,
            width: 1000,
            margin: 4,
          });
          const qr = QRCode.create(text, { errorCorrectionLevel: level });
          if (!cancelled) {
            setDataUrl(url);
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
          background: UI.surface, borderRadius: 12, padding: 16,
          maxWidth: 840, width: '100%', maxHeight: '100%', overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        }}
      >
        {/* ★縦の余白は QR の大きさに直結するので、説明は 2 行に抑える */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: UI.text }}>
            QRコードで電子カルテへ取り込む
          </span>
          {title && <span style={{ fontSize: 12, color: UI.textMuted }}>{title}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <p style={{ fontSize: 12, color: UI.textMuted, lineHeight: 1.5, margin: 0 }}>
            電子カルテの入力欄に<strong>カーソルを置いてから</strong>読み取ってください。
            <span style={{ color: UI.textFaint }}>（QR対応リーダーが必要。目が細かい時はタブレットが読みやすい）</span>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: UI.textMuted }}>
            <span style={{ marginRight: 4 }}>表示サイズ</span>
            {['S', 'M', 'L'].map((s) => (
              <button
                key={s}
                onClick={() => changeSize(s)}
                title={`${SIZE_PX[s]}px。リーダーの視野に収まらない時は小さく、読み取れない時は大きく`}
                style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                  border: `1px solid ${size === s ? UI.neutral.fg : UI.border}`,
                  background: size === s ? UI.neutral.fg : UI.surface,
                  color: size === s ? '#fff' : UI.textMuted,
                }}
              >
                {SIZE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div style={{
            background: UI.danger.bg, border: `1px solid ${UI.danger.fg}`, color: UI.danger.fg,
            borderRadius: 8, padding: '12px 14px', fontSize: 13, lineHeight: 1.7,
          }}>
            {error}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {/* ★QR は正方形なので **画面の短辺**で実効サイズが決まる。
                幅だけ 100% にすると縦に溢れて全体が写らない (2026-09-07 実機確認)。
                横 (100vw) と縦 (100vh - ヘッダ/フッタ分) の**両方**を見て、
                上限は表示サイズ (小/中/大) で切り替える。
                縦の控除 230px = ヘッダ+説明 (~90) + フッタ (~70) + モーダル内外の余白 (~64)。 */}
            {dataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dataUrl}
                alt="QRコード"
                style={{
                  width: '100%',
                  maxWidth: `min(${SIZE_PX[size]}px, calc(100vh - 230px))`,
                  height: 'auto',
                  aspectRatio: '1 / 1',
                  borderRadius: 6,
                }}
              />
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: UI.textFaint }}>
            {info && `${text.length.toLocaleString()}文字 / ${info.bytes.toLocaleString()}バイト / 誤り訂正 ${info.level} / バージョン ${info.version}`}
            {info && info.version >= 33 && (
              <span style={{ display: 'block', color: UI.warning.fg }}>
                目が細かいコードです。<strong>タブレットで開く</strong>と読み取りやすくなります（QR は正方形なので、端末を横向きにしても大きくはなりません）。
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

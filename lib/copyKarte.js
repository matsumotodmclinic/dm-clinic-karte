// カルテ本文をクリップボードにコピーする共通関数。
// text/html と text/plain を ClipboardItem で同時書き込みし、
// 電子カルテ（リッチテキスト対応）に貼ると ♯/＃ で始まる病名が太字になる。
// 非対応エディタでは text/plain にフォールバック。

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const buildHtml = (txt) => {
  const lines = txt.split('\n').map((line) => {
    // 行頭が ♯ or ＃ なら「（」or「(」直前までを <b> で囲む（病名のみ太字）
    const m = line.match(/^([♯＃][^（(]*)(.*)$/);
    if (m) {
      return `<b>${escapeHtml(m[1])}</b>${escapeHtml(m[2])}`;
    }
    return escapeHtml(line) || '&nbsp;';
  });
  return `<div style="font-size:11px;font-family:'Noto Sans JP','Yu Gothic',sans-serif;white-space:pre-wrap;">${lines.join('<br>')}</div>`;
};

const fallbackCopy = (text) => {
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  alert('コピーしました');
};

export async function copyKarteToClipboard(text) {
  try {
    if (navigator.clipboard && typeof window !== 'undefined' && window.ClipboardItem) {
      const html = buildHtml(text);
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      alert('コピーしました');
      return;
    }
  } catch (e) {
    // fall through to plain copy
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => alert('コピーしました'))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

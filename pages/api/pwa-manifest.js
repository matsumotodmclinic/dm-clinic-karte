// PWA manifest（携帯のホーム画面インストール用）。2026-09-10 新設。
//
// 勤怠アプリ (apps/kinkan/src/app/api/pwa-manifest/route.ts) の写し。
// 静的な public/manifest.json にしない理由: middleware がゲート/認証で HTML を返してしまい、
// ブラウザが manifest をパースできず「インストール」が出なくなる。
// この API と /icon.svg 等は middleware.js で素通りにしてある（中身は公開情報のみ）。
//
// 値の考え方（勤怠と同じ）:
//   - name は汎用製品名（施設名を入れない）
//   - display=fullscreen: ネイティブのスプラッシュに名前が出ず、アイコン 1 枚 → そのままアプリ
//   - background_color はアイコンの紺と同色（スプラッシュとアイコンが地続きに見える）
//   - theme_color はアプリ UI のツールバー色

import { APP_NAME, THEME_COLOR, SPLASH_BACKGROUND } from '../../lib/appMeta'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }
  const manifest = {
    name: APP_NAME,
    short_name: '問診',
    description: '初診事前問診：問診入力とカルテ記載文の生成',
    // 未ログインは middleware が /gate → /auth に振り分ける
    start_url: '/',
    scope: '/',
    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: SPLASH_BACKGROUND,
    theme_color: THEME_COLOR,
    lang: 'ja',
    categories: ['productivity', 'medical'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
  res.setHeader('Content-Type', 'application/manifest+json')
  res.setHeader('Cache-Control', 'public, max-age=300')
  return res.status(200).json(manifest)
}

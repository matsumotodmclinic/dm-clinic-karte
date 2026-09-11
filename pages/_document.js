// 全ページ共通の <html> / <head>（2026-09-10 携帯インストール対応）
//
// 勤怠アプリ (apps/kinkan/src/app/layout.tsx) と同じ構成:
//   - manifest は静的ファイルでなく /api/pwa-manifest から配信する
//     （静的 /manifest.json は middleware のゲート/認証に引っかかり HTML が返って PWA が壊れるため。
//       middleware 側で /api/pwa-manifest と /icon.svg 等を素通りにしている）
//   - アイコンは public/icon.svg（★2026-09-11 案B: 3 アプリ共通の紺リング枠 + 問診は若草の弧 + チェックリスト。
//     正本 = memory Reference/reference_app_icons.md）。
//     iOS の apple-touch-icon は SVG を受け付けないので PNG（public/apple-touch-icon.png）も置く
//   - viewport は Next の作法どおり pages/_app.js 側で出す（_document に書くと警告が出る）
//
// スタイルはプロジェクト方針どおり CSS ファイルを作らず、ここに最小のリセットだけ inline で書く。

import { Html, Head, Main, NextScript } from 'next/document'
import { APP_NAME, THEME_COLOR } from '../lib/appMeta'

export default function Document() {
  return (
    <Html lang="ja">
      <Head>
        <meta name="application-name" content={APP_NAME} />
        {/* Android Chrome / iOS Safari: ホーム画面から開いたときブラウザ UI を出さない */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <meta name="theme-color" content={THEME_COLOR} />
        {/* 院内利用のため検索エンジン除外 */}
        <meta name="robots" content="noindex, nofollow" />

        <link rel="manifest" href="/api/pwa-manifest" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* 最小リセット。body の既定 margin 8px を消す（各画面が 100vh の面を自前で持つため白縁が出ていた）。
            ホーム画面から全画面で開いたとき、ノッチ/ステータスバーの下に文字が潜らないよう safe-area を確保する。 */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
html, body { margin: 0; padding: 0; background: #f5f7fa; -webkit-text-size-adjust: 100%; }
@media (display-mode: standalone), (display-mode: fullscreen) {
  body { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
}
`,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

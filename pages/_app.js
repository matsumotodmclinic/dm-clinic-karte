// 全ページ共通のラッパー（2026-09-10 携帯インストール対応で新設）
//
// これまで viewport meta が 1 つも無く、携帯では PC 幅 (980px) で描画されて全体が縮小表示されていた。
// 勤怠アプリ (apps/kinkan/src/app/layout.tsx の viewport) と同じ値にする:
//   maximumScale=1 / userScalable=no は iOS が入力欄フォーカス時に勝手にズームするのを止めるため。
//   viewportFit=cover はホーム画面から全画面で開いたときにノッチ周りまで面を伸ばすため
//   （safe-area の確保は pages/_document.js 側）。

import Head from 'next/head'
import { APP_NAME } from '../lib/appMeta'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>{APP_NAME}</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
      </Head>
      <Component {...pageProps} />
    </>
  )
}

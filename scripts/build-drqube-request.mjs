// ドクターキューブ改訂依頼書を、変更箇所が赤い 1 枚の HTML にする（院長 2026-10-18）。
//
//   npm run build:drqube
//
// 入力  docs/doctorqube_questionnaire_all.md   ← 正本。直すのはこちらだけ
// 出力  docs/doctorqube_request.html           ← 送付用（ブラウザで開いて PDF に印刷）
//
// ★出力は **repo に入れない**（.gitignore 済み）。
//   開いて見るファイルと生成し直すファイルが同じなので、見ている最中は Windows が
//   ファイルを掴んで書き換えられない（2026-10-18 に実際にハマった）。
//   正本は .md だけ。送る直前にこのコマンドで作り直す、という手順にしてある。
//   出力が開かれていて置き換えられないときは、下のメッセージでそう言う。

import fs from 'node:fs'
import { renderRequestHtml } from '../lib/drqubeRequest.js'

const SRC = 'docs/doctorqube_questionnaire_all.md'
const OUT = 'docs/doctorqube_request.html'

const md = fs.readFileSync(SRC, 'utf8')
const html = renderRequestHtml(md)

// ★一度 .tmp に書いてから置き換える。
//   出力をブラウザで開いたまま流すと、Windows ではファイルが掴まれていて
//   そのまま writeFileSync すると EBUSY で落ちる（2026-10-18 に実際に踏んだ）。
const tmp = `${OUT}.tmp`
fs.writeFileSync(tmp, html)
try {
  fs.renameSync(tmp, OUT)
} catch (e) {
  fs.rmSync(tmp, { force: true })
  console.error(`🔴 ${OUT} を置き換えられませんでした（${e.code}）。`)
  console.error('   このファイルをブラウザやエディタで開いていたら、閉じてからもう一度流してください。')
  process.exit(1)
}
console.log(`✅ ${OUT} を書き出しました（${md.split(/\r?\n/).length} 行から）`)

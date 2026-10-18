// ドクターキューブ改訂依頼書を、変更箇所が赤い 1 枚の HTML にする（院長 2026-10-18）。
//
//   npm run build:drqube
//
// 入力  docs/doctorqube_questionnaire_all.md   ← 正本。直すのはこちらだけ
// 出力  docs/doctorqube_request.html           ← 送付用（ブラウザで開いて PDF に印刷）
//
// ★出力は repo に入れてある（送るのはこのファイルなので、中身を履歴で追えるようにするため）。
//   .md を直したら必ずこのコマンドを流し直すこと。流し忘れは
//   `scripts/golden/drqube-request.test.mjs` が「出力が .md と食い違っている」として落とす。

import fs from 'node:fs'
import { renderRequestHtml } from '../lib/drqubeRequest.js'

const SRC = 'docs/doctorqube_questionnaire_all.md'
const OUT = 'docs/doctorqube_request.html'

const md = fs.readFileSync(SRC, 'utf8')
fs.writeFileSync(OUT, renderRequestHtml(md))
console.log(`✅ ${OUT} を書き出しました（${md.split(/\r?\n/).length} 行から）`)

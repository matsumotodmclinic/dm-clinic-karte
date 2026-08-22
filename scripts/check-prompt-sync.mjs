#!/usr/bin/env node
// プロンプト二重管理チェッカー
//
// このアプリのカルテ生成には 2 経路ある:
//   経路A = components/*IntakeTool.js の generateKarte() 内テンプレートリテラル（初回生成）
//   経路B = lib/buildKartePrompt.js の form_type 別分岐（詳細画面の再生成）
// 同じ内容を 2 箇所に書いているため、片方だけ直すと
// 「初回生成と再生成でカルテの書式が違う」事故になる（CLAUDE.md の最重要注意点）。
//
// このスクリプトは両方のプロンプトから「人が書いた指示文」だけを抜き出して比較する。
// ${...} の中身は経路ごとに変数名が違う（data.disease.x / d.disease?.x）ので
// ⟨expr⟩ に潰してから比較する = 変数名の違いは無視し、日本語の指示文の差分だけを見る。
//
// 使い方:
//   node scripts/check-prompt-sync.mjs          差分があれば exit 1
//   node scripts/check-prompt-sync.mjs --update 現在の差分を「既知の差分」として記録
//
// 既知の差分は scripts/prompt-sync-allow.json に保存する。
// 意図的な差分（フォーム固有の事情）はここに載せて CI を通す。
// 新しい差分が出たら CI が落ちる = 片側だけ直したことに気付ける。

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ALLOW_PATH = join(ROOT, 'scripts', 'prompt-sync-allow.json')

// 経路A のコンポーネント ↔ 経路B の form_type 対応
const FORMS = [
  { formType: 'DM基本', component: 'DMIntakeTool.js' },
  { formType: '1型糖尿病', component: 'T1DIntakeTool.js' },
  { formType: '小児1型糖尿病', component: 'PedT1DIntakeTool.js' },
  { formType: '高血圧・脂質異常症', component: 'HTHLIntakeTool.js' },
  { formType: '妊娠糖尿病', component: 'GDMIntakeTool.js' },
  { formType: '反応性低血糖', component: 'RHIntakeTool.js' },
  { formType: '睡眠時無呼吸症候群', component: 'SASIntakeTool.js' },
  { formType: '内分泌', component: 'EndocrineIntakeTool.js' },
  // 甲状腺6フォームは ThyroidIntakeTool.js 1本 + 経路B 1分岐で formType prop 分岐のため
  // 単純な 1:1 対応にならない。将来対応（TODO）。
]

// ──────────────────────────────────────────────────────────
// 抽出
// ──────────────────────────────────────────────────────────

// バッククォートで囲まれたテンプレートリテラルを、開始位置から対応する閉じまで読む。
// ネストした `${ ... `inner` ... }` と \` エスケープを考慮する。
function readTemplateLiteral(src, startBacktick) {
  let i = startBacktick + 1
  let depth = 0 // ${ } のネスト深さ
  while (i < src.length) {
    const c = src[i]
    if (c === '\\') { i += 2; continue }
    if (depth === 0 && c === '`') return src.slice(startBacktick + 1, i)
    if (depth === 0 && c === '$' && src[i + 1] === '{') { depth = 1; i += 2; continue }
    if (depth > 0) {
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '`') {
        // ${ } の中のネストしたテンプレートリテラルを丸ごと飛ばす
        const inner = readTemplateLiteral(src, i)
        if (inner === null) return null
        i += inner.length + 2
        continue
      }
    }
    i++
  }
  return null
}

// プロンプト本文を切り出した定数（経路B の STAFF_FLAGS / COMMON_FOOTER など）を集める。
// これを展開せずに ⟨expr⟩ に潰すと「片方だけ定数化している」だけで巨大な差分に見えてしまう。
function collectPromptConsts(src) {
  const consts = new Map()
  const re = /const\s+([A-Z][A-Z0-9_]*)\s*=\s*`/g
  let m
  while ((m = re.exec(src)) !== null) {
    const lit = readTemplateLiteral(src, m.index + m[0].length - 1)
    if (lit !== null) consts.set(m[1], lit)
  }
  return consts
}

// ${CONST_NAME} を定数の中身に置き換える（定数の中の定数にも対応するため数回まわす）
function inlineConsts(literal, consts) {
  let s = literal
  for (let pass = 0; pass < 3; pass++) {
    let changed = false
    for (const [name, value] of consts) {
      const token = '${' + name + '}'
      if (s.includes(token)) { s = s.split(token).join(value); changed = true }
    }
    if (!changed) break
  }
  return s
}

// 経路A: components/xxx.js の `const prompt = ` に続くテンプレートリテラル
function extractClientPrompt(componentFile) {
  const src = readFileSync(join(ROOT, 'components', componentFile), 'utf8')
  const m = /const prompt\s*=\s*`/.exec(src)
  if (!m) return null
  const lit = readTemplateLiteral(src, m.index + m[0].length - 1)
  return lit === null ? null : inlineConsts(lit, collectPromptConsts(src))
}

// 経路B: lib/buildKartePrompt.js の form_type 分岐内の `prompt = ` テンプレートリテラル
function extractServerPrompts() {
  const src = readFileSync(join(ROOT, 'lib', 'buildKartePrompt.js'), 'utf8')
  const consts = collectPromptConsts(src)
  const out = new Map()
  const branchRe = /form_type === '([^']+)'/g
  const branches = []
  let m
  while ((m = branchRe.exec(src)) !== null) branches.push({ formType: m[1], at: m.index })
  for (let i = 0; i < branches.length; i++) {
    const from = branches[i].at
    const to = i + 1 < branches.length ? branches[i + 1].at : src.length
    const chunk = src.slice(from, to)
    const pm = /prompt\s*=\s*`/.exec(chunk)
    if (!pm) continue
    const lit = readTemplateLiteral(chunk, pm.index + pm[0].length - 1)
    if (lit !== null) out.set(branches[i].formType, inlineConsts(lit, consts))
  }
  return out
}

// ──────────────────────────────────────────────────────────
// 正規化（変数名の違いを無視して 指示文だけ を比較する）
// ──────────────────────────────────────────────────────────
function normalize(literal) {
  let s = literal
  // ${ ... } を ⟨expr⟩ に潰す（ネスト対応のため手動スキャン）
  let out = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') { out += s[i] + (s[i + 1] || ''); i++; continue }
    if (s[i] === '$' && s[i + 1] === '{') {
      let depth = 1
      let j = i + 2
      while (j < s.length && depth > 0) {
        if (s[j] === '{') depth++
        else if (s[j] === '}') depth--
        j++
      }
      out += '⟨expr⟩'
      i = j - 1
      continue
    }
    out += s[i]
  }
  return out
    .split('\n')
    .map(l => l.replace(/[ \t　]+$/, '').trim())
    .filter(l => l !== '')          // 空行はレイアウト差なので比較対象外
    .map(l => l.replace(/\s+/g, ' '))
}

// ──────────────────────────────────────────────────────────
// 差分
// ──────────────────────────────────────────────────────────
// 経路A にしかない行 / 経路B にしかない行 を列挙する（順序差は見ない。
// 行の集合として比較する方が、セクション移動の誤検知が少なく実用的）。
function diffLines(aLines, bLines) {
  const count = arr => {
    const m = new Map()
    for (const l of arr) m.set(l, (m.get(l) || 0) + 1)
    return m
  }
  const ca = count(aLines), cb = count(bLines)
  const onlyA = [], onlyB = []
  for (const [l, n] of ca) {
    const diff = n - (cb.get(l) || 0)
    for (let i = 0; i < diff; i++) onlyA.push(l)
  }
  for (const [l, n] of cb) {
    const diff = n - (ca.get(l) || 0)
    for (let i = 0; i < diff; i++) onlyB.push(l)
  }
  return { onlyA, onlyB }
}

// ──────────────────────────────────────────────────────────
// 実行
// ──────────────────────────────────────────────────────────
const isUpdate = process.argv.includes('--update')
const allow = existsSync(ALLOW_PATH) ? JSON.parse(readFileSync(ALLOW_PATH, 'utf8')) : {}
const serverPrompts = extractServerPrompts()

let failed = 0
let newAllow = {}

for (const { formType, component } of FORMS) {
  const clientLit = extractClientPrompt(component)
  const serverLit = serverPrompts.get(formType)

  if (clientLit === null) {
    console.log(`❌ ${formType}: 経路A のプロンプトを抽出できません (components/${component})`)
    failed++
    continue
  }
  if (serverLit === undefined) {
    console.log(`❌ ${formType}: 経路B の分岐を抽出できません (lib/buildKartePrompt.js)`)
    failed++
    continue
  }

  const { onlyA, onlyB } = diffLines(normalize(clientLit), normalize(serverLit))
  const known = allow[formType] || { onlyA: [], onlyB: [] }
  const newA = onlyA.filter(l => !known.onlyA.includes(l))
  const newB = onlyB.filter(l => !known.onlyB.includes(l))

  newAllow[formType] = { onlyA, onlyB }

  if (newA.length === 0 && newB.length === 0) {
    const knownCount = onlyA.length + onlyB.length
    console.log(`✅ ${formType}${knownCount ? `  (既知の差分 ${knownCount} 行)` : ''}`)
    continue
  }

  failed++
  console.log(`\n❌ ${formType}: 新しい差分 ${newA.length + newB.length} 行`)
  console.log(`   経路A = components/${component} / 経路B = lib/buildKartePrompt.js`)
  for (const l of newA) console.log(`   A のみ | ${l}`)
  for (const l of newB) console.log(`   B のみ | ${l}`)
}

if (isUpdate) {
  writeFileSync(ALLOW_PATH, JSON.stringify(newAllow, null, 2) + '\n')
  console.log(`\n📝 既知の差分を更新しました: scripts/prompt-sync-allow.json`)
  process.exit(0)
}

if (failed) {
  console.log(`\n──────────────────────────────────────────`)
  console.log(`プロンプト同期チェック 失敗: ${failed} フォーム`)
  console.log(`片側だけ修正した可能性があります。両方を直すか、`)
  console.log(`意図的な差分なら node scripts/check-prompt-sync.mjs --update で記録してください。`)
  process.exit(1)
}

console.log('\nプロンプト同期チェック OK')

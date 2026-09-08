// カルテ生成の検証ランナー
//
//   npm run eval            … 70 ケースを組み立てて機械判定（API 不要・決定的）
//   npm run eval -- --show DM基本/難渋   … そのケースのカルテ本文を全文表示
//   npm run eval -- --level error        … error だけ出す
//   npm run eval -- --ai                 … 自由記述のあるケースだけ実際に Claude を呼ぶ
//                                          （ANTHROPIC_API_KEY が要る。3 回回して揺れも見る）
//
// ★問診のカルテ本文は JS が決定論的に組むので、大部分は API 無しで検証できる。
//   AI が関わるのは「自由記述の文章化」だけなので、そこだけ --ai で見る。

import { buildKarteTemplate, buildMergePrompt, parseMergeResponse, needsMerge } from '../../lib/buildKarteTemplate.js'
import { CASES } from './cases.mjs'
import { judge } from './rules.mjs'

const argv = process.argv.slice(2)
const arg = (name, def = null) => {
  const i = argv.indexOf(name)
  return i >= 0 ? (argv[i + 1] ?? true) : def
}
const SHOW = arg('--show')
const LEVEL = arg('--level')
const USE_AI = argv.includes('--ai')
const RUNS = parseInt(arg('--runs', '3'), 10)

const LEVEL_ORDER = { error: 0, warn: 1, info: 2 }
const ICON = { error: '🔴', warn: '🟡', info: 'ℹ️ ' }

// ── AI（統合）を呼ぶ ──────────────────────────────────────
async function callMerge(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error))
  return data.content?.[0]?.text || ''
}

// ── 1 ケース ──────────────────────────────────────────────
async function runCase(c) {
  const mergePrompt = buildMergePrompt(c.form, c.data)
  let merged = null
  const variants = []

  if (USE_AI && mergePrompt) {
    for (let i = 0; i < RUNS; i++) {
      try {
        const m = parseMergeResponse(await callMerge(mergePrompt))
        variants.push(buildKarteTemplate(c.form, c.data, { merged: m }))
        if (i === 0) merged = m
      } catch (e) {
        variants.push(`__AI_ERROR__ ${e.message}`)
      }
    }
  }

  const karte = buildKarteTemplate(c.form, c.data, { merged })
  if (karte == null) return { c, karte: '', findings: [{ rule: 'unsupported', level: 'error', msg: `未対応の form_type: ${c.form}` }], variants }

  // ★3 回分を作ったなら 3 回分とも判定する（1 回目だけ見ていては揺れを測る意味が無い）
  const findings = []
  const seen = new Set()
  for (const [i, v] of (variants.length ? variants : [karte]).entries()) {
    for (const f of judge(v, c, { mergePrompt, merged: variants.length > 0 })) {
      const key = `${f.rule}|${f.msg}`
      if (seen.has(key)) continue
      seen.add(key)
      findings.push(variants.length > 1 ? { ...f, msg: `[${i + 1}回目] ${f.msg}` } : f)
    }
  }
  return { c, karte, mergePrompt, findings, variants }
}

// ── 実行 ──────────────────────────────────────────────────
const targets = SHOW && SHOW !== true ? CASES.filter(c => c.id === SHOW || c.form === SHOW) : CASES
if (!targets.length) {
  console.error(`ケースが見つかりません: ${SHOW}`)
  process.exit(1)
}
if (USE_AI && !process.env.ANTHROPIC_API_KEY) {
  console.error('--ai には ANTHROPIC_API_KEY が要ります（.env.local か環境変数）')
  process.exit(1)
}

const results = []
for (const c of targets) results.push(await runCase(c))

// ── 全文表示モード ───────────────────────────────────────
if (SHOW && SHOW !== true) {
  for (const r of results) {
    console.log(`\n${'═'.repeat(70)}\n${r.c.id}  ${r.c.title}\n${'═'.repeat(70)}`)
    console.log(r.karte)
    if (r.mergePrompt) console.log(`\n--- 統合プロンプト（AI に渡す材料）---\n${r.mergePrompt}`)
    if (r.findings.length) {
      console.log('\n--- 判定 ---')
      for (const f of r.findings) console.log(`${ICON[f.level]} [${f.rule}] ${f.msg}`)
    }
  }
  process.exit(0)
}

// ── サマリー ─────────────────────────────────────────────
const wanted = f => !LEVEL || f.level === LEVEL
let nErr = 0, nWarn = 0, nInfo = 0, nClean = 0
const byRule = new Map()
const byForm = new Map()

for (const r of results) {
  const e = r.findings.filter(f => f.level === 'error').length
  const w = r.findings.filter(f => f.level === 'warn').length
  const i = r.findings.filter(f => f.level === 'info').length
  nErr += e; nWarn += w; nInfo += i
  if (e === 0 && w === 0) nClean++
  const fm = byForm.get(r.c.form) || { error: 0, warn: 0, n: 0 }
  fm.error += e; fm.warn += w; fm.n++
  byForm.set(r.c.form, fm)
  for (const f of r.findings) {
    if (f.level === 'info') continue
    const b = byRule.get(f.rule) || { level: f.level, n: 0, cases: new Set(), sample: f.msg }
    b.n++; b.cases.add(r.c.id)
    byRule.set(f.rule, b)
  }
}

console.log(`\n${'═'.repeat(70)}`)
console.log(`カルテ生成 eval — ${results.length} ケース（${new Set(results.map(r => r.c.form)).size} フォーム）${USE_AI ? ` / AI 統合 ${RUNS} 回` : ' / AI 呼び出しなし'}`)
console.log('═'.repeat(70))

// 指摘のあったケースだけ列挙
for (const r of results) {
  const fs = r.findings.filter(f => f.level !== 'info').filter(wanted)
  if (!fs.length) continue
  console.log(`\n${r.c.id}  ${r.c.title}`)
  for (const f of fs) console.log(`  ${ICON[f.level]} [${f.rule}] ${f.msg}`)
}

// 揺れ（--ai のとき）
if (USE_AI) {
  // ★文言が毎回少し違うのは許容範囲。許容できないのは **情報が増減する**揺れ。
  //   ♯既往の病名集合・本文に出る医療機関名・申し送りの □ 行 で判定する。
  // ★施設名は正規表現で抜くと「紹介元は上尾中央総合病院」のような言い回しを拾ってしまう。
  //   入力に実在する施設名のうち、カルテに出ているものの集合で見る（ノイズが原理的に入らない）
  const hospNames = c => [...new Set(JSON.stringify(c.data)
    .match(/[ぁ-んァ-ヶ一-龥A-Za-z0-9]{2,}(?:病院|クリニック|医院|センター|診療所)/g) || [])]
  const facts = (k, c) => JSON.stringify({
    past: k.split('\n').filter(l => /^♯/.test(l)).map(l => l.replace(/^♯/, '').split('（')[0]).sort(),
    hosp: hospNames(c).filter(h => k.includes(h)).sort(),
    handoff: k.split('\n').filter(l => l.startsWith('□')).sort(),
  })
  const shaky = results.filter(r => r.variants.length > 1 && new Set(r.variants).size > 1)
  const content = shaky.filter(r => new Set(r.variants.map(v => facts(v, r.c))).size > 1)
  const wording = shaky.filter(r => new Set(r.variants.map(v => facts(v, r.c))).size === 1)
  const total = results.filter(r => r.variants.length > 1).length
  console.log(`\n--- 揺れ（同じ入力を ${RUNS} 回）---`)
  console.log(`  🔴 内容が変わった: ${content.length} / ${total} ケース`)
  for (const r of content) {
    console.log(`     ${r.c.id}`)
    for (const [i, f] of [...new Set(r.variants.map(v => facts(v, r.c)))].entries()) {
      console.log(`       (${i + 1}) ${f.slice(0, 240)}`)
    }
  }
  console.log(`  🟡 文言だけ: ${wording.length} / ${total}   ✅ 完全一致: ${total - shaky.length} / ${total}`)
}

console.log(`\n--- ルール別（error / warn）---`)
if (!byRule.size) console.log('  指摘なし')
for (const [id, b] of [...byRule].sort((a, b2) => LEVEL_ORDER[a[1].level] - LEVEL_ORDER[b2[1].level] || b2[1].n - a[1].n)) {
  console.log(`  ${ICON[b.level]} ${id.padEnd(24)} ${String(b.n).padStart(3)}件 / ${b.cases.size}ケース`)
}

console.log(`\n--- フォーム別 ---`)
for (const [f, b] of byForm) {
  const mark = b.error ? '🔴' : b.warn ? '🟡' : '✅'
  console.log(`  ${mark} ${f.padEnd(22)} ${b.n}例  error ${b.error} / warn ${b.warn}`)
}

console.log(`\n--- 合計 ---`)
console.log(`  指摘ゼロ: ${nClean}/${results.length} (${Math.round((nClean / results.length) * 100)}%)`)
console.log(`  🔴 error ${nErr} / 🟡 warn ${nWarn} / ℹ️  info ${nInfo}`)
console.log('')

process.exit(nErr > 0 ? 1 : 0)

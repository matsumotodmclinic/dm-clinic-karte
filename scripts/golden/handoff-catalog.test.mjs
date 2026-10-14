// スタッフ向け早見表（lib/handoffCatalog.js）が、実際の出力とずれていないことを検査する。
//
// 狙い: 申し送りの行を足したのに早見表に書き忘れる、という drift を構造的に止める。
// この repo の allow-list 棚卸しと同じ考え方で、**両方向**を見る。
//   ① テンプレートが出しうる □ 行が、すべてカタログのどれかに前方一致すること
//   ② カタログに載っている行が、実際に出しうること（消えた行が残り続けないように）

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildKarteTemplate } from '../../lib/buildKarteTemplate.js'
import { CATALOG_MATCHES } from '../../lib/handoffCatalog.js'
import { buildDmDxNoteLine, DM_DX_DECISIONS } from '../../lib/dmDxNote.js'
import {
  FIXTURES, THYROID_FIXTURE,
  SAS_WITH_DM_DIFF, HTHL_WITH_DM_DIFF, RH_WITH_DM_DIFF, ENDOCRINE_WITH_DM_DIFF,
} from './fixtures.mjs'

// DM差分問診（採血で糖尿病が判明した回）は専用フィクスチャでしか出ない
const DM_DIFF_CASES = [
  ['睡眠時無呼吸症候群', SAS_WITH_DM_DIFF],
  ['高血圧・脂質異常症', HTHL_WITH_DM_DIFF],
  ['反応性低血糖', RH_WITH_DM_DIFF],
  ['内分泌', ENDOCRINE_WITH_DM_DIFF],
]

const THYROID_FORMS = [
  '甲状腺（バセドウ初診）', '甲状腺（バセドウ継続）', '甲状腺（橋本病）',
  '甲状腺（腫大異常なし）', '甲状腺（腺腫経過観察）', '甲状腺（腺腫悪性疑い）',
]
const fixtureFor = f => (THYROID_FORMS.includes(f) ? THYROID_FIXTURE : FIXTURES[f])
const ALL_FORMS = [...Object.keys(FIXTURES), ...THYROID_FORMS]

const HEAD = '【事前聴取時　申し送り事項】'
const END = '【診察にあたっての要望】'

function handoffLines(karte) {
  const ls = String(karte || '').split('\n')
  const i = ls.findIndex(l => l.startsWith(HEAD))
  const j = ls.findIndex(l => l.startsWith(END))
  if (i < 0) return []
  return ls.slice(i + 1, j < 0 ? ls.length : j).filter(l => l.startsWith('□'))
}

const getAt = (o, p) => p.split('.').reduce((a, k) => a?.[k], o)
const setAt = (o, p, v) => {
  const ks = p.split('.')
  const last = ks.pop()
  const parent = ks.reduce((a, k) => a?.[k], o)
  if (parent) parent[last] = v
}
function leafPaths(obj, prefix = '') {
  const out = []
  for (const [k, v] of Object.entries(obj || {})) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...leafPaths(v, p))
    else out.push(p)
  }
  return out
}
// 列挙値はコードが見ている値を踏まないと分岐しない（handoff-audit.mjs と同じ理由）
const PROBES = [
  '', 'あり', 'なし', '不明', '持参あり', '受けていない', '持っていない', '忘れた',
  'インスリン使用中', '申請済', '申請未', '申請中', '希望あり', '女性医師希望',
  '○患者疑い（話が長い方）', '●患者疑い（出禁対象）', 'screening', 'cpap', 'X',
]
const probesFor = cur => {
  if (typeof cur === 'boolean') return [!cur]
  if (Array.isArray(cur)) return [[], [...cur, 'X']]
  if (typeof cur === 'string' && /^\d+(\.\d+)?$/.test(cur)) return ['', '0', '40', '200']
  return PROBES
}

/** 全フォーム・全フィールドを 1 つずつ振って、出しうる □ 行をすべて集める */
function producibleLines() {
  const found = new Set()

  // AI 統合に失敗したときだけ出る行
  for (const l of handoffLines(buildKarteTemplate('DM基本', FIXTURES['DM基本'], { mergeFailed: true }))) found.add(l)
  // DM差分問診を入力した回だけ出る行
  for (const [form, data] of DM_DIFF_CASES) {
    for (const l of handoffLines(buildKarteTemplate(form, data))) found.add(l)
  }
  // 詳細画面で追記する「GAD・CPR の算定根拠」（カルテ生成ではなく後からの差し込み）
  for (const { key } of DM_DX_DECISIONS) {
    const line = buildDmDxNoteLine({ decision: key, hba1c: '6.8', past: {} })
    if (line) found.add(line)
  }
  // DM差分問診の自由記載と、重要既往を複数選んだとき（1つだけなら病名の行に入る）
  {
    const [form, data] = DM_DIFF_CASES[0]
    const rich = structuredClone(data)
    rich.dmDiff = {
      ...rich.dmDiff,
      freeText: '夜間の低血糖が心配とのこと',
      importantPast: { ...(rich.dmDiff?.importantPast || {}), gastricCancer: true, ihd: true, detail: '詳細は本人に確認' },
    }
    for (const l of handoffLines(buildKarteTemplate(form, rich))) found.add(l)
  }

  for (const form of ALL_FORMS) {
    const base = fixtureFor(form)
    if (!base) continue
    for (const l of handoffLines(buildKarteTemplate(form, base))) found.add(l)
    for (const p of leafPaths(base)) {
      const cur = getAt(base, p)
      for (const v of probesFor(cur)) {
        const clone = structuredClone(base)
        setAt(clone, p, v)
        for (const l of handoffLines(buildKarteTemplate(form, clone))) found.add(l)
      }
    }
  }
  return [...found]
}

describe('スタッフ向け早見表（lib/handoffCatalog.js）', () => {
  const lines = producibleLines()

  test('テンプレートが出しうる申し送りは、すべて早見表に載っている', () => {
    const missing = lines.filter(l => !CATALOG_MATCHES.some(m => l.startsWith(m)))
    assert.deepEqual(missing, [],
      '早見表（lib/handoffCatalog.js）に載っていない申し送りがある。\n' +
      'スタッフが知らない行が医師に届くことになるので、必ず追記すること')
  })

  test('早見表に載っている行は、実際に出しうる（棚卸し）', () => {
    const stale = CATALOG_MATCHES.filter(m => !lines.some(l => l.startsWith(m)))
    assert.deepEqual(stale, [],
      '早見表に、もう出ない行が残っている。消すか、出せるフィクスチャを足すこと')
  })
})

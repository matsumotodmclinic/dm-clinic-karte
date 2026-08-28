// カルテ生成プロンプトのゴールデンテスト（node --test、依存パッケージなし）
//
// 狙い: 型でもビルドでも落ちない「プロンプトの中身が間違っている」バグを捕まえる。
//   2026-08-22 の実例: 通院先「その他」で hospitalOther を読まず「（その他）」と出力していた。
//   2026-08-22 の実例: エコー「希望なし」が「当院で施行予定」に化けていた。
// どちらも tsc / next build では検知不能。ここで内容を直接検査する。
//
// 2層構成:
//   ① 振る舞いアサーション … 「この文字列を含む/含まない」を明示的に検証（意図が読める）
//   ② スナップショット      … プロンプト全文を保存し、意図しない変化を差分で検知
//
// 実行: node --test scripts/golden/
// 更新: UPDATE_SNAPSHOTS=1 node --test scripts/golden/   （差分を確認してからコミットすること）

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildKartePrompt } from '../../lib/buildKartePrompt.js'
import { buildOtherDiseasesText, pickOtherDiseases } from '../../lib/otherDiseases.js'
import { formatEcho, buildEchoLine } from '../../lib/echo.js'
import { buildDmDxNoteLine, buildPastValuesText, insertDmDxNote } from '../../lib/dmDxNote.js'
import {
  FIXTURES, ENDOCRINE_WITH_CAREPLAN, THYROID_FIXTURE,
  SAS_WITH_DM_DIFF, HTHL_WITH_DM_DIFF, RH_WITH_DM_DIFF, ENDOCRINE_WITH_DM_DIFF,
} from './fixtures.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SNAP_DIR = join(HERE, '__snapshots__')
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1'

// スナップショット比較用の正規化
//  ・和暦の現在月（R8.8 等）は実行日で変わるので伏せる
//    直前が英数字のものは除外する（フッターの「CPR0.5以下の方は…」の R0.5 を
//    巻き込んで CPR{NOW} にしてしまい、0.5 の変更を検知できなくなっていた）
//  ・改行は LF に揃える（git の autocrlf でチェックアウト時に CRLF 化されるため、
//    揃えないと Windows で再クローンした直後に全件落ちる）
const WAREKI_NOW = /(?<![A-Za-z0-9])R\d{1,2}\.\d{1,2}(?!\d)/g
const stabilize = s => s.replace(/\r\n/g, '\n').replace(WAREKI_NOW, 'R{NOW}')

function matchSnapshot(name, actual) {
  if (!existsSync(SNAP_DIR)) mkdirSync(SNAP_DIR, { recursive: true })
  const file = join(SNAP_DIR, `${name}.txt`)
  const value = stabilize(actual)
  if (UPDATE || !existsSync(file)) {
    writeFileSync(file, value)
    return
  }
  const expected = stabilize(readFileSync(file, 'utf8'))
  if (value !== expected) {
    // 最初に食い違った行を示す（全文 diff は長すぎて読めない）
    const a = value.split('\n'), b = expected.split('\n')
    let i = 0
    while (i < Math.max(a.length, b.length) && a[i] === b[i]) i++
    assert.fail(
      `スナップショット不一致: ${name}.txt (${i + 1} 行目)\n` +
      `  保存済み: ${JSON.stringify(b[i])}\n` +
      `  現在    : ${JSON.stringify(a[i])}\n` +
      `意図した変更なら UPDATE_SNAPSHOTS=1 node --test scripts/golden/ で更新してください。`
    )
  }
}

// ──────────────────────────────────────────────────────────
// ① 純粋関数のユニットテスト
// ──────────────────────────────────────────────────────────
describe('lib/otherDiseases', () => {
  test('通院先「その他」は hospitalOther の病院名を使う（(その他) と書かない）', () => {
    const out = buildOtherDiseasesText([
      { name: '子宮筋腫', hospital: 'その他', hospitalOther: '鰐坂医院' },
    ])
    assert.equal(out, '子宮筋腫（鰐坂医院）')
    assert.ok(!out.includes('（その他）'))
  })

  test('病院＋科は半角スペースで連結', () => {
    assert.equal(
      buildOtherDiseasesText([{ name: '慢性腎臓病', hospital: '上尾中央総合病院', dept: '腎臓内科' }]),
      '慢性腎臓病（上尾中央総合病院 腎臓内科）'
    )
  })

  test('通院なし / 通院先未選択 / 病名空 / 空配列', () => {
    assert.equal(buildOtherDiseasesText([{ name: 'うつ病', hospital: '通院なし' }]), 'うつ病（通院なし）')
    assert.equal(buildOtherDiseasesText([{ name: '甲状腺疾患', hospital: '' }]), '甲状腺疾患')
    assert.equal(buildOtherDiseasesText([{ name: '', hospital: 'その他' }]), 'なし')
    assert.equal(buildOtherDiseasesText([]), 'なし')
    assert.equal(buildOtherDiseasesText(undefined), 'なし')
  })

  test('「その他」を選んだが病院名未入力なら 病名だけ（(その他) にしない）', () => {
    assert.equal(buildOtherDiseasesText([{ name: '不明疾患', hospital: 'その他', hospitalOther: '  ' }]), '不明疾患')
  })

  test('pickOtherDiseases は disease 配下 / history 配下 どちらでも拾う', () => {
    const a = { disease: { otherDiseases: [{ name: 'A', hospital: 'その他', hospitalOther: 'X医院' }] } }
    const b = { history: { otherDiseases: [{ name: 'B', hospital: 'その他', hospitalOther: 'Y医院' }] } }
    assert.equal(buildOtherDiseasesText(pickOtherDiseases(a)), 'A（X医院）')
    assert.equal(buildOtherDiseasesText(pickOtherDiseases(b)), 'B（Y医院）')
  })
})

describe('lib/echo', () => {
  test('「希望なし」はそのまま通す（当院で施行予定 に化けない）', () => {
    assert.equal(formatEcho('希望なし'), '希望なし')
    assert.equal(formatEcho('希望あり'), '希望あり')
  })

  test('施行済 / 行っていない の変換', () => {
    assert.equal(formatEcho('他院で施行済'), '他院施行済')
    assert.equal(formatEcho('健診で施行済'), '健診施行済')
    assert.equal(formatEcho('行っていない'), '当院で施行予定')
  })

  test('未選択は呼び出し側の fallback', () => {
    assert.equal(formatEcho(''), '当院で施行予定')
    assert.equal(formatEcho('', '未記入'), '未記入')
    assert.equal(formatEcho(undefined, '未選択'), '未選択')
  })

  test('1行の組み立て（全角スペース区切り）', () => {
    assert.equal(buildEchoLine('希望なし', '他院で施行済'), '頚部エコー：希望なし　腹部エコー：他院施行済')
  })
})

describe('スナップショット正規化（stabilize）', () => {
  test('和暦の現在月だけを伏せる', () => {
    assert.equal(stabilize('R8.8：HbA1c'), 'R{NOW}：HbA1c')
    assert.equal(stabilize('令和 R12.11 分'), '令和 R{NOW} 分')
  })

  test('CPR0.5 の 0.5 は伏せない（変更を検知できなくなるため）', () => {
    const line = 'CPR0.5以下の方は今後半年ごとCPR測定を入れてください。'
    assert.equal(stabilize(line), line)
    assert.ok(stabilize(line).includes('CPR0.5'))
  })

  test('同じ行に現在月と CPR0.5 が混在しても正しく分ける', () => {
    assert.equal(
      stabilize('R8.8：HbA1c　CPR0.5以下'),
      'R{NOW}：HbA1c　CPR0.5以下'
    )
  })
})

describe('lib/dmDxNote', () => {
  const KARTE = [
    '【事前聴取時　申し送り事項】',
    '□通院のご案内をお渡し済',
    '□血糖、HbA1cの結果により上段の診断を確定してください',
    '【診察にあたっての要望】なし',
    '---------------------------------------------',
  ].join('\n')

  test('過去の値は入力のあった項目だけを並べる', () => {
    assert.equal(
      buildPastValuesText({ fbs: '132', ppbs: '', hba1c: '6.6' }),
      '空腹時血糖 132mg/dl・HbA1c 6.6%'
    )
    assert.equal(buildPastValuesText({}), '')
    assert.equal(buildPastValuesText(undefined), '')
  })

  test('診断確定：今回のHbA1cと過去の値の組み合わせを根拠として書く', () => {
    const line = buildDmDxNoteLine({ decision: 'diagnosed', hba1c: '6.4', past: { fbs: '132' } })
    assert.ok(line.includes('今回HbA1c 6.4%'))
    assert.ok(line.includes('過去の空腹時血糖 132mg/dl'))
    assert.ok(line.includes('GAD・CPRを追加'))
  })

  test('見送り：GAD・CPRを削除 と書く（追加ではない）', () => {
    const line = buildDmDxNoteLine({ decision: 'deferred', hba1c: '6.4' })
    assert.ok(line.includes('見送り'))
    assert.ok(line.includes('GAD・CPRを削除'))
    assert.ok(!line.includes('GAD・CPRを追加'))
  })

  test('既往ありは過去の個別の値を書かない（診断済みなので根拠として不要）', () => {
    const line = buildDmDxNoteLine({ decision: 'known', hba1c: '6.2', past: { fbs: '132' } })
    assert.ok(line.includes('過去に糖尿病の診断歴'))
    assert.ok(!line.includes('132'))
  })

  test('今回のHbA1c または 選択 が無ければ行を作らない', () => {
    assert.equal(buildDmDxNoteLine({ decision: 'diagnosed', hba1c: '' }), '')
    assert.equal(buildDmDxNoteLine({ decision: '', hba1c: '6.4' }), '')
    assert.equal(buildDmDxNoteLine(), '')
  })

  test('【診察にあたっての要望】の直前に挿入する', () => {
    const line = buildDmDxNoteLine({ decision: 'diagnosed', hba1c: '6.4' })
    const out = insertDmDxNote(KARTE, line).split('\n')
    assert.equal(out[3], line)
    assert.equal(out[4], '【診察にあたっての要望】なし')
  })

  test('選び直しても重複しない（既存の同種行を置き換える）', () => {
    const first  = buildDmDxNoteLine({ decision: 'diagnosed', hba1c: '6.4' })
    const second = buildDmDxNoteLine({ decision: 'deferred',  hba1c: '6.4' })
    const out = insertDmDxNote(insertDmDxNote(KARTE, first), second)
    assert.equal(out.split('\n').filter(l => l.startsWith('□今回HbA1c')).length, 1)
    assert.ok(out.includes(second))
    assert.ok(!out.includes(first))
  })

  test('空文字を渡すと追記した行だけを取り消す', () => {
    const line = buildDmDxNoteLine({ decision: 'diagnosed', hba1c: '6.4' })
    assert.equal(insertDmDxNote(insertDmDxNote(KARTE, line), ''), KARTE)
  })

  test('【診察にあたっての要望】が無いカルテでは末尾に足す', () => {
    const line = buildDmDxNoteLine({ decision: 'deferred', hba1c: '6.5' })
    const out = insertDmDxNote('□通院のご案内をお渡し済', line).split('\n')
    assert.equal(out[out.length - 1], line)
  })
})

// ──────────────────────────────────────────────────────────
// ② プロンプト内容のアサーション（全フォーム）
// ──────────────────────────────────────────────────────────
describe('buildKartePrompt: 全フォーム共通の必須事項', () => {
  for (const [formType, formData] of Object.entries(FIXTURES)) {
    test(`${formType}: その他の病名の通院先が正しく載る`, () => {
      const { prompt } = buildKartePrompt(formType, formData)
      assert.ok(prompt.includes('鰐坂医院'), '「その他」で入力した病院名がプロンプトに無い')
      assert.ok(!prompt.includes('子宮筋腫（その他）'), '病院名が「（その他）」に潰れている')
      assert.ok(prompt.includes('上尾中央総合病院 腎臓内科'), '病院＋科が載っていない')
    })

    test(`${formType}: ♯その他の病名を必ず全件出力する指示がある`, () => {
      const { prompt } = buildKartePrompt(formType, formData)
      assert.ok(
        prompt.includes('1疾患1行で「♯病名（通院先）」の形式で必ず全て記載する'),
        '♯出力の明示指示が無い（AI が ♯行を落とす原因になる）'
      )
    })

    test(`${formType}: プロンプトが空でなく form_data が埋め込まれている`, () => {
      const { prompt, max_tokens } = buildKartePrompt(formType, formData)
      assert.ok(prompt.length > 500, 'プロンプトが短すぎる')
      assert.ok(max_tokens >= 1000)
      assert.ok(!prompt.includes('undefined'), 'プロンプトに undefined が混入している')
      assert.ok(!prompt.includes('[object Object]'), 'プロンプトに [object Object] が混入している')
    })
  }
})

describe('buildKartePrompt: エコー「希望なし」', () => {
  const echoForms = ['DM基本', '高血圧・脂質異常症', '妊娠糖尿病', '睡眠時無呼吸症候群', '内分泌']
  for (const formType of echoForms) {
    test(`${formType}: 頚部・腹部とも「希望なし」が保持される`, () => {
      const fd = FIXTURES[formType]
      const { prompt } = buildKartePrompt(formType, {
        ...fd,
        disease: { ...fd.disease, echoNeck: '希望なし', echoAbdomen: '希望なし' },
      })
      assert.ok(
        prompt.includes('頚部エコー：希望なし　腹部エコー：希望なし'),
        '「希望なし」が「当院で施行予定」等に化けている'
      )
    })
  }
})

describe('buildKartePrompt: 内分泌 固有', () => {
  test('主病名（＃）を推測出力しない指示がある', () => {
    const { prompt } = buildKartePrompt('内分泌', FIXTURES['内分泌'])
    assert.ok(prompt.includes('＃で始まる行は絶対に推測して出力しない'))
  })

  test('家族歴の自由記入（複数組）が「母：バセドウ病、姉：橋本病」で載る', () => {
    const { prompt } = buildKartePrompt('内分泌', FIXTURES['内分泌'])
    assert.ok(prompt.includes('家族歴（自由記入）：母：バセドウ病、姉：橋本病'))
  })

  test('生活習慣病チェック無し → 療養計画書の行を出さない指示', () => {
    const { prompt } = buildKartePrompt('内分泌', FIXTURES['内分泌'])
    assert.ok(prompt.includes('生活習慣病（療養計画書の要否判定）：なし'))
    assert.ok(!prompt.includes('\n□初回療養計画書を作成済'))
  })

  test('生活習慣病チェック有り → 療養計画書の行を出す', () => {
    const { prompt } = buildKartePrompt('内分泌', ENDOCRINE_WITH_CAREPLAN)
    assert.ok(prompt.includes('生活習慣病（療養計画書の要否判定）：糖尿病・脂質異常症'))
    assert.ok(prompt.includes('□初回療養計画書を作成済'))
  })

  test('HTHL 固有の甲状腺3項目ルールを引き継いでいない', () => {
    const { prompt } = buildKartePrompt('内分泌', FIXTURES['内分泌'])
    assert.ok(!prompt.includes('◎甲状腺3項目追加済'))
    assert.ok(!prompt.includes('LDL-C140'))
  })

  test('目標HbA1c 行がフッターに無い', () => {
    const { prompt } = buildKartePrompt('内分泌', FIXTURES['内分泌'])
    assert.ok(!prompt.includes('目標HbA1c'))
  })
})

describe('buildKartePrompt: 甲状腺6フォーム', () => {
  const thyroidTypes = [
    '甲状腺（バセドウ初診）', '甲状腺（バセドウ継続）', '甲状腺（橋本病）',
    '甲状腺（腫大異常なし）', '甲状腺（腺腫経過観察）', '甲状腺（腺腫悪性疑い）',
  ]
  for (const formType of thyroidTypes) {
    test(`${formType}: 生成でき、不正な埋め込みが無い`, () => {
      const { prompt } = buildKartePrompt(formType, THYROID_FIXTURE)
      assert.ok(prompt.length > 500)
      assert.ok(!prompt.includes('undefined'))
      assert.ok(!prompt.includes('[object Object]'))
    })
  }
})

describe('buildKartePrompt: DM差分問診（採血で糖尿病判明）', () => {
  const CASES = [
    ['睡眠時無呼吸症候群', SAS_WITH_DM_DIFF],
    ['高血圧・脂質異常症', HTHL_WITH_DM_DIFF],
    ['反応性低血糖',       RH_WITH_DM_DIFF],
    ['内分泌',             ENDOCRINE_WITH_DM_DIFF],
  ]

  for (const [formType, formData] of CASES) {
    test(`${formType}: dmDiff ありで ＃糖尿病 と DM初期評価が入る`, () => {
      const { prompt } = buildKartePrompt(formType, formData)
      assert.ok(prompt.includes('【DM差分問診'), 'DM差分問診データブロックが無い')
      assert.ok(prompt.includes('＃糖尿病'), '＃糖尿病 の指示が無い')
      assert.ok(prompt.includes('□採血で DM判明 → DM初期評価追加実施済'))
      assert.ok(prompt.includes('DM基本セット'), 'フッターが DM基本セット になっていない')
      // 差分問診の中身が実際に渡っていること
      assert.ok(prompt.includes('のどが渇く・足のしびれ'))
      assert.ok(prompt.includes('その他: 夜間頻尿'))
      assert.ok(prompt.includes('虚血性心疾患'))
      // 眼底未受診・手帳なしなので連携手帳の申し送りが出ること
      assert.ok(prompt.includes('□糖尿病-眼科連携手帳をお渡し'))
      assert.ok(!prompt.includes('undefined'))
      assert.ok(!prompt.includes('[object Object]'))
    })

    test(`${formType}: dmDiff なしなら DM差分問診は一切出ない`, () => {
      const { prompt } = buildKartePrompt(formType, FIXTURES[formType])
      assert.ok(!prompt.includes('【DM差分問診'))
      assert.ok(!prompt.includes('□採血で DM判明'))
    })
  }

  test('高血圧・脂質異常症: 糖尿病判明時は ＃IGT ではなく ＃糖尿病 とする', () => {
    const { prompt } = buildKartePrompt('高血圧・脂質異常症', HTHL_WITH_DM_DIFF)
    assert.ok(prompt.includes('＃IGT は記載せず ＃糖尿病 とする'))
    assert.ok(!prompt.includes('＃IGT（該当時のみ、受診理由の直後、空行なし）'))
  })

  test('内分泌: ＃糖尿病 だけが例外。内分泌の主病名は出さず □主病名 の行も残る', () => {
    const { prompt } = buildKartePrompt('内分泌', ENDOCRINE_WITH_DM_DIFF)
    assert.ok(prompt.includes('「＃で始まる行は出力しない」ルールの唯一の例外'))
    assert.ok(prompt.includes('内分泌の主病名は引き続き出力しない'))
    assert.ok(prompt.includes('□主病名：医師の診察時に確定・記載'))
  })

  test('内分泌: DM判明時は療養計画書が必要になる（生活習慣病チェックが無くても）', () => {
    // FIXTURES['内分泌'] は carePlanDiseases が全 false ＝ 通常は療養計画書なし
    const { prompt: without } = buildKartePrompt('内分泌', FIXTURES['内分泌'])
    assert.ok(without.includes('の行は出力しない'))
    const { prompt: with_ } = buildKartePrompt('内分泌', ENDOCRINE_WITH_DM_DIFF)
    assert.ok(with_.includes('□初回療養計画書を作成済'))
  })

  test('反応性低血糖: ＃糖尿病 は ♯反応性低血糖疑い より前', () => {
    const { prompt } = buildKartePrompt('反応性低血糖', RH_WITH_DM_DIFF)
    const iDm = prompt.indexOf('＃糖尿病（採血で判明')
    const iRh = prompt.indexOf('♯反応性低血糖疑い\n・低血糖が生じるタイミング')
    assert.ok(iDm > -1 && iRh > -1)
    assert.ok(iDm < iRh, '＃糖尿病 が ♯反応性低血糖疑い より後ろにある')
  })
})

describe('buildKartePrompt: 未対応 form_type', () => {
  test('throw する（500 ではなく 400 にマップされる）', () => {
    assert.throws(() => buildKartePrompt('存在しない問診', FIXTURES['DM基本']), /未対応のform_type/)
  })
})

// ──────────────────────────────────────────────────────────
// ③ スナップショット（意図しないプロンプト変化の検知）
// ──────────────────────────────────────────────────────────
describe('プロンプト全文スナップショット', () => {
  for (const [formType, formData] of Object.entries(FIXTURES)) {
    test(formType, () => {
      const { prompt } = buildKartePrompt(formType, formData)
      matchSnapshot(formType, prompt)
    })
  }
  test('内分泌（生活習慣病あり）', () => {
    const { prompt } = buildKartePrompt('内分泌', ENDOCRINE_WITH_CAREPLAN)
    matchSnapshot('内分泌_生活習慣病あり', prompt)
  })

  for (const [name, formType, formData] of [
    ['睡眠時無呼吸症候群_DM差分あり', '睡眠時無呼吸症候群', SAS_WITH_DM_DIFF],
    ['高血圧・脂質異常症_DM差分あり', '高血圧・脂質異常症', HTHL_WITH_DM_DIFF],
    ['反応性低血糖_DM差分あり',       '反応性低血糖',       RH_WITH_DM_DIFF],
    ['内分泌_DM差分あり',             '内分泌',             ENDOCRINE_WITH_DM_DIFF],
  ]) {
    test(name, () => {
      const { prompt } = buildKartePrompt(formType, formData)
      matchSnapshot(name, prompt)
    })
  }
})

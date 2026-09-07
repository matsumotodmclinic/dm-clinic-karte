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
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildKartePrompt } from '../../lib/buildKartePrompt.js'
import { buildOtherDiseasesText, pickOtherDiseases } from '../../lib/otherDiseases.js'
import { formatEcho, buildEchoLine } from '../../lib/echo.js'
import { buildDmDxNoteLine, buildPastValuesText, insertDmDxNote } from '../../lib/dmDxNote.js'
import { buildStaffFlagLines, buildStaffFlagsBlock } from '../../lib/handoffNotes.js'
import {
  buildKarteTemplate, buildReasonSummary, buildImportantHistoryLines,
  buildPastHistoryLines, buildFhLine, buildEyeLine, TEMPLATE_FORM_TYPES, needsMerge,
  buildReasonFacts, buildMergePrompt, parseMergeResponse, buildDrugAllergyWarning, buildJobLine,
} from '../../lib/buildKarteTemplate.js'
import { ALLOWED_FORM_TYPES } from '../../lib/buildKartePrompt.js'
import {
  FIXTURES, ENDOCRINE_WITH_CAREPLAN, THYROID_FIXTURE, THYROID_NODULE_FIXTURE,
  SAS_WITH_DM_DIFF, HTHL_WITH_DM_DIFF, RH_WITH_DM_DIFF, ENDOCRINE_WITH_DM_DIFF,
} from './fixtures.mjs'

// 甲状腺6フォームのラベル（スナップショット名にも使う）
const THYROID_FORMS = [
  '甲状腺（バセドウ初診）', '甲状腺（バセドウ継続）', '甲状腺（橋本病）',
  '甲状腺（腫大異常なし）', '甲状腺（腺腫経過観察）', '甲状腺（腺腫悪性疑い）',
]

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

describe('lib/handoffNotes（申し送り: スタッフ入力由来の行）', () => {
  test('該当なしなら 1 行も出さない', () => {
    assert.deepEqual(buildStaffFlagLines({ doubleSlot: false, doctorGender: '', patientFlag: '通常' }), [])
    assert.equal(buildStaffFlagsBlock({ patientFlag: '通常' }), '')
    assert.equal(buildStaffFlagsBlock(undefined), '')
  })

  test('医師希望は「□医師希望：女性医師」形式（□女性医師希望 ではない）', () => {
    assert.deepEqual(buildStaffFlagLines({ doctorGender: '女性医師希望' }), ['□医師希望：女性医師'])
    assert.deepEqual(buildStaffFlagLines({ doctorGender: '男性医師希望' }), ['□医師希望：男性医師'])
    assert.deepEqual(buildStaffFlagLines({ doctorGender: '院長（初回のみ）' }), ['□医師希望：院長（初回のみ）'])
  })

  test('「指定なし」/ 未入力は医師希望の行そのものを出さない', () => {
    assert.deepEqual(buildStaffFlagLines({ doctorGender: '指定なし' }), [])
    assert.deepEqual(buildStaffFlagLines({ doctorGender: '' }), [])
  })

  test('患者フラグは該当する 1 行だけ（「通常」では出さない）', () => {
    assert.deepEqual(buildStaffFlagLines({ patientFlag: '○患者疑い（話が長い方）' }), ['□○患者疑い（対応注意）'])
    assert.deepEqual(buildStaffFlagLines({ patientFlag: '●患者疑い（出禁対象）' }), ['□●患者疑い（出禁対象・要確認）'])
    assert.deepEqual(buildStaffFlagLines({ patientFlag: '通常' }), [])
  })

  test('順序は 新患2枠 → 医師希望 → 患者フラグ', () => {
    assert.deepEqual(
      buildStaffFlagLines({ doubleSlot: true, doctorGender: '男性医師希望', patientFlag: '●患者疑い（出禁対象）' }),
      ['□新患2枠取得済み', '□医師希望：男性医師', '□●患者疑い（出禁対象・要確認）']
    )
  })

  test('ブロックは末尾に改行を付ける（次行の【診察にあたっての要望】との間に空行を作らない）', () => {
    assert.equal(buildStaffFlagsBlock({ doubleSlot: true }), '□新患2枠取得済み\n')
    assert.ok(!buildStaffFlagsBlock({ doubleSlot: true }).endsWith('\n\n'))
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

describe('lib/buildKarteTemplate（AI フリー版・DM基本）', () => {
  const DM = FIXTURES['DM基本']

  test('受診理由: 音声入力の AI 整形済みテキストがあればそれを使う', () => {
    assert.equal(buildReasonSummary({ voiceMemo: { aiSummary: 'R6.4から口渇あり。' } }), 'R6.4から口渇あり。')
  })

  test('受診理由: 音声が無ければ構造化データから組み立てる', () => {
    assert.equal(
      buildReasonSummary({ reason: { type: '検診異常', checkupType: '市健診' } }),
      '市健診で異常を指摘され受診。')
    assert.equal(
      buildReasonSummary({ reason: { type: '自主転院', transferFrom: '○○クリニック', transferDetail: '転居のため' } }),
      '○○クリニックより自主転院。転居のため。')
    assert.equal(
      buildReasonSummary({ reason: { dmConcern: true, dmConcernReason: '家族に糖尿病の方がいる' } }),
      '糖尿病が気になり受診（家族に糖尿病の方がいる）。')
  })

  test('受診理由: 何も無ければ空（行ごと省略できるように）', () => {
    assert.equal(buildReasonSummary({}), '')
  })

  test('♯重要既往: 構造化入力から 治療内容・時期・病院→通院先・薬 を組み立てる', () => {
    const lines = buildImportantHistoryLines({
      disease: {
        gastricCancer: {
          selected: true, surgeryType: '手術で切除', resection: '2/3切除',
          surgeryEra: '平成', surgeryYear: '28',
          treatedHospital: '上尾中央総合病院', visitingHospital: 'その他', visitingHospitalOther: '鰐坂医院',
          visitFreq: '半年に1回', meds: 'タケキャブ',
        },
      },
    })
    // プロンプトの指示形「♯胃癌（胃切除後：治療種類・範囲・時期・治療病院→通院先・内服薬）」に合わせる
    assert.deepEqual(lines, ['♯胃癌（胃切除後：2/3切除、平成28年、上尾中央総合病院→鰐坂医院（半年に1回）、タケキャブ 内服中）'])
  })

  test('♯重要既往: 胃切除後の前置きは手術したときだけ', () => {
    const g = (surgeryType) => buildImportantHistoryLines({
      disease: { gastricCancer: { selected: true, surgeryType, resection: '2/3切除', surgeryEra: '平成', surgeryYear: '28' } },
    })[0]
    assert.equal(g('手術で切除'), '♯胃癌（胃切除後：2/3切除、平成28年）')
    assert.equal(g('手術＋抗がん剤'), '♯胃癌（胃切除後：手術＋抗がん剤、2/3切除、平成28年）')
    assert.equal(g('抗がん剤のみ'), '♯胃癌（抗がん剤のみ、2/3切除、平成28年）')
  })

  test('♯IHD: 治療法は病名側に付く（♯IHD：PCI後）', () => {
    const ihd = (treatment) => buildImportantHistoryLines({
      disease: { ihd: { selected: true, treatment, surgeryEra: '平成', surgeryYear: '30' } },
    })[0]
    assert.equal(ihd('PCI（カテーテル治療）'), '♯IHD：PCI後（平成30年）')
    assert.equal(ihd('バイパス手術'), '♯IHD：バイパス手術後（平成30年）')
    assert.equal(ihd('薬物療法のみ'), '♯IHD：薬物療法（平成30年）')
    assert.equal(ihd('不明'), '♯IHD（平成30年）')
  })

  test('アレルギー警告: 薬剤アレルギーのときだけ出す（花粉・金属では出さない）', () => {
    // プロンプトの指示は「アレルギー薬がある場合のみ」。
    // 非薬剤で警告を出すと投薬禁忌の誤認を招くので出さない
    const w = (allergyDetail) => buildDrugAllergyWarning({ history: { allergy: 'あり', allergyDetail } })
    assert.equal(w('ペニシリン・金属'), '⚠️ペニシリンアレルギー⚠️')
    assert.equal(w('花粉'), '')
    assert.equal(w('花粉・フルーツ・金属'), '')
    assert.equal(w('ペニシリン・造影剤'), '⚠️ペニシリン・造影剤アレルギー⚠️')
    assert.equal(buildDrugAllergyWarning({ history: { allergy: 'なし' } }), '')
  })

  test('アレルギー警告: 判定できない自由入力は安全側（警告を出す）', () => {
    assert.equal(buildDrugAllergyWarning({ history: { allergy: 'あり', allergyDetail: 'よく分からない薬' } }),
      '⚠️よく分からない薬アレルギー⚠️')
  })

  test('♯重要既往: 選択されていなければ行を出さない / 時期不明も表現できる', () => {
    assert.deepEqual(buildImportantHistoryLines({ disease: { ihd: { selected: false } } }), [])
    assert.deepEqual(
      buildImportantHistoryLines({ disease: { stroke: { selected: true, surgeryUnknown: true } } }),
      ['♯脳梗塞後（時期不明）'])
  })

  test('♯既往: その他の病名は1疾患1行、音声の既往歴も行として足す', () => {
    const lines = buildPastHistoryLines({
      disease: { otherDiseases: [{ name: '子宮筋腫', hospital: 'その他', hospitalOther: '鰐坂医院' }] },
      voicePastHistory: { aiSummary: '♯高血圧（H28から、○○内科でアムロジピン 5mg 内服中）' },
    })
    assert.deepEqual(lines, [
      '♯子宮筋腫（鰐坂医院）',
      '♯高血圧（H28から、○○内科でアムロジピン 5mg 内服中）',
    ])
  })

  test('【FH】: DM ありは誰かも書く', () => {
    assert.equal(buildFhLine({ history: { fh: { dm: true, dmWho: ['母'], ht: true } } }),
      '【FH】DM(+：母) HT(+) APO(-) IHD(-)')
    assert.equal(buildFhLine({ history: { fh: {} } }), '【FH】DM(-) HT(-) APO(-) IHD(-)')
  })

  test('【眼科通院歴】: 4つの状態を書き分ける（未入力は空欄）', () => {
    // 院長判断 2026-09-06: 未入力を「未受診」と書くと聞いていないことを断定してしまうので空欄
    assert.equal(
      buildEyeLine({ history: { eyeFundusCheck: '受けている', eye: '上尾こいけ眼科', retinopathy: '単純性網膜症', glaucoma: '緑内障なし' } }),
      '【眼科通院歴】上尾こいけ眼科・単純性網膜症・緑内障なし')
    assert.equal(buildEyeLine({ history: { eyeFundusCheck: '受けていない' } }), '【眼科通院歴】未受診')
    assert.equal(buildEyeLine({ history: { eyeFundusCheck: '今後受ける予定' } }), '【眼科通院歴】今後受ける予定')
    assert.equal(buildEyeLine({ history: {} }), '【眼科通院歴】')
  })

  test('【健診】: 未選択なら値なしの空欄（行は残す）', () => {
    const karte = buildKarteTemplate('DM基本', { ...FIXTURES['DM基本'], history: { ...FIXTURES['DM基本'].history, checkup: [] } })
    assert.ok(karte.split('\n').includes('【健診】'), '【健診】の空欄行が無い')
  })

  test('【仕事】: 「していない」は就労なしと明記、未入力は空欄', () => {
    // 院長判断 2026-09-06: 空欄だと「無職」と「聞き漏らし」が区別できない
    assert.equal(buildJobLine({ lifestyle: { work: 'していない', job: [], activity: '' } }), '【仕事】就労なし')
    // 就労なしでも活動量は残す（2026-09-06 実患者比較で発覚。AI 版は両方書いていた）
    assert.equal(
      buildJobLine({ lifestyle: { work: 'していない', job: [], activity: '立っていることが多い' } }),
      '【仕事】就労なし・立っていることが多い')
    assert.equal(buildJobLine({ lifestyle: { work: '', job: [], activity: '' } }), '【仕事】')
    assert.equal(
      buildJobLine({ lifestyle: { work: 'している', job: ['自営業'], jobNote: '', activity: '立ち仕事' } }),
      '【仕事】自営業・立ち仕事')
  })

  test('【FH】: DM基本は HL の枠を作らない（フォームで聞いていないため）', () => {
    const line = buildFhLine({ history: { fh: { dm: true, dmWho: ['母'], ht: true, hl: true } } })
    assert.ok(!line.includes('HL'), 'DM基本の【FH】に HL が出ている')
  })

  // 申し送りはカルテ本文から取り出して検証する（□行の順序と条件をまとめて固定できる）
  const handoffOf = karte => {
    const lines = karte.split('\n')
    const i = lines.findIndex(l => l.startsWith('【事前聴取時'))
    const j = lines.findIndex((l, k) => k > i && l.startsWith('【診察にあたっての要望】'))
    return lines.slice(i + 1, j)
  }

  test('申し送り: 条件に該当する □ 行だけが出る', () => {
    const karte = buildKarteTemplate('DM基本', {
      alert: { weightLoss: 'あり' },
      disease: { ht: true, hl: true, insulinUse: false },
      history: { eyeNotebook: '持っていない' },
      voicePastHistory: { needsDoctorReview: true },
      body: { doubleSlot: true },
    })
    assert.deepEqual(handoffOf(karte), [
      '□通院のご案内をお渡し済',
      '□既往歴：要ドクター確認',
      '□糖尿病-眼科連携手帳をお渡し',
      '□体重減少あり（3ヶ月以内に3kg以上）インスリン導入要検討',
      '□HTの確認のため、血圧手帳をお渡ししています。',
      '□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。',
      '□生活習慣病療養計画書を作成済',
      '□新患2枠取得済み',
    ])
  })

  test('申し送り: インスリン使用中なら療養計画書の行は出さない', () => {
    const karte = buildKarteTemplate('DM基本', { disease: { insulinUse: true } })
    assert.ok(!karte.includes('□生活習慣病療養計画書を作成済'))
  })

  // ★問診票の体重減少ボタンは「あり / なし / 不明」の3択で、
  //   「あり（3kg以上）」という値は DM差分問診にしか存在しない。
  //   2026-09-06 のテンプレート試作は「あり（3kg以上）」だけを見ていたため、
  //   DM基本・1型で 体重減少の警告と申し送りが一度も出ない状態だった。
  test('体重減少: 問診票の「あり」で警告と申し送りが出る', () => {
    const karte = buildKarteTemplate('DM基本', { ...DM, alert: { weightLoss: 'あり' } })
    assert.ok(karte.startsWith('【⚠️ 体重減少あり・早急なインスリン導入を検討】'))
    assert.ok(karte.includes('□体重減少あり（3ヶ月以内に3kg以上）インスリン導入要検討'))
    const none = buildKarteTemplate('DM基本', { ...DM, alert: { weightLoss: 'なし' } })
    assert.ok(!none.includes('体重減少あり'))
    const unknown = buildKarteTemplate('DM基本', { ...DM, alert: { weightLoss: '不明' } })
    assert.ok(!unknown.includes('体重減少あり'))
  })

  test('空行ルール: ＃自院管理と♯他院管理の間だけ1行空け、【アレルギー歴】の前は空けない', () => {
    const karte = buildKarteTemplate('DM基本', DM)
    const lines = karte.split('\n')
    const iHl = lines.findIndex(l => l.startsWith('＃HT') || l.startsWith('＃HL'))
    const iFirstPast = lines.findIndex(l => l.startsWith('♯'))
    assert.ok(iFirstPast > iHl, '♯既往が ＃自院管理より後にある')
    assert.equal(lines[iFirstPast - 1], '', '自院管理ブロックと他院管理の間に1行空いていない')
    const iAllergy = lines.findIndex(l => l.startsWith('【アレルギー歴】'))
    assert.notEqual(lines[iAllergy - 1], '', '【アレルギー歴】の直前に空行が入っている')
  })

  test('空行ルール: 申し送りの最終□行と【診察にあたっての要望】の間は空けない', () => {
    const lines = buildKarteTemplate('DM基本', DM).split('\n')
    const i = lines.findIndex(l => l.startsWith('【診察にあたっての要望】'))
    assert.ok(lines[i - 1].startsWith('□'), '要望の直前が □ 行でない: ' + JSON.stringify(lines[i - 1]))
  })

  test('AI に渡す指示文が本文に混入しない', () => {
    const karte = buildKarteTemplate('DM基本', DM)
    assert.ok(!karte.includes('（該当時のみ）'))
    assert.ok(!karte.includes('整形済みテキスト'))
    assert.ok(!karte.includes('undefined'))
    assert.ok(!karte.includes('[object Object]'))
  })

  test('未対応の form_type は null', () => {
    assert.equal(buildKarteTemplate('存在しない問診', FIXTURES['DM基本']), null)
  })
})

describe('lib/buildKarteTemplate（全14フォーム）', () => {
  const ALL = [...Object.keys(FIXTURES), ...THYROID_FORMS]
  const dataFor = f => (THYROID_FORMS.includes(f) ? THYROID_FIXTURE : FIXTURES[f])

  test('14フォーム全てにテンプレートがある（ホワイトリストと一致）', () => {
    assert.deepEqual([...TEMPLATE_FORM_TYPES].sort(), [...ALLOWED_FORM_TYPES].sort())
    assert.equal(TEMPLATE_FORM_TYPES.size, 14)
  })

  for (const f of ALL) {
    test(`${f}: AI への指示文がカルテ本文に混入しない`, () => {
      const karte = buildKarteTemplate(f, dataFor(f))
      assert.ok(karte, 'テンプレートが null')
      for (const ng of ['（該当時のみ）', '整形済みテキスト', 'undefined', '[object Object]', '【患者情報JSON】', '（記載あれば']) {
        assert.ok(!karte.includes(ng), `カルテ本文に "${ng}" が混入している`)
      }
    })

    test(`${f}: 必ず出る行がそろっている`, () => {
      const karte = buildKarteTemplate(f, dataFor(f))
      assert.ok(karte.includes('【アレルギー歴】'), '【アレルギー歴】がない')
      assert.ok(karte.includes('【事前聴取時　申し送り事項】'), '申し送りがない')
      assert.ok(karte.includes('□通院のご案内をお渡し済') || f === '甲状腺（腺腫悪性疑い）',
        '「□通院のご案内をお渡し済」がない（当日紹介の悪性疑いだけ例外）')
      assert.ok(karte.includes('【診察にあたっての要望】'), '要望がない')
    })

    test(`${f}: 空行ルール（申し送り最終□行と要望の間は空けない・空行は連続しない）`, () => {
      const lines = buildKarteTemplate(f, dataFor(f)).split('\n')
      const i = lines.findIndex(l => l.startsWith('【診察にあたっての要望】'))
      assert.ok(lines[i - 1].startsWith('□'), `要望の直前が □ 行でない: ${JSON.stringify(lines[i - 1])}`)
      // フッターの記入欄（空行4つ）以外に連続した空行を作らない
      const footerStart = lines.findIndex(l => /^R\d+\.\d+：($|HbA1c|甲状腺)/.test(l) && lines.indexOf(l) > i)
      const body = footerStart > 0 ? lines.slice(0, footerStart) : lines
      for (let k = 1; k < body.length; k++) {
        assert.ok(!(body[k] === '' && body[k - 1] === ''), `${k + 1}行目に連続した空行がある`)
      }
    })
  }

  test('♯他院管理の前だけ1行空ける（＃自院管理・【アレルギー歴】の前は空けない）', () => {
    for (const f of ['DM基本', '1型糖尿病', '高血圧・脂質異常症', '妊娠糖尿病', '反応性低血糖', '睡眠時無呼吸症候群', '内分泌']) {
      const lines = buildKarteTemplate(f, FIXTURES[f]).split('\n')
      const iFirstPast = lines.findIndex(l => l.startsWith('♯') && !l.startsWith('♯反応性低血糖疑い'))
      assert.ok(iFirstPast > 0, `${f}: ♯既往が出ていない`)
      assert.equal(lines[iFirstPast - 1], '', `${f}: 他院管理の前に1行空いていない`)
      const iAllergy = lines.findIndex(l => l.startsWith('【アレルギー歴】'))
      assert.notEqual(lines[iAllergy - 1], '', `${f}: 【アレルギー歴】の直前に空行が入っている`)
    }
  })

  test('DM差分問診: ＃糖尿病 が追加され、採血セットが DM基本セット になる', () => {
    for (const [f, data] of [
      ['睡眠時無呼吸症候群', SAS_WITH_DM_DIFF],
      ['高血圧・脂質異常症', HTHL_WITH_DM_DIFF],
      ['反応性低血糖', RH_WITH_DM_DIFF],
      ['内分泌', ENDOCRINE_WITH_DM_DIFF],
    ]) {
      const karte = buildKarteTemplate(f, data)
      assert.ok(karte.includes('＃糖尿病'), `${f}: ＃糖尿病 が無い`)
      assert.ok(karte.includes('□採血で DM判明 → DM初期評価追加実施済'), `${f}: DM判明の申し送りが無い`)
      assert.ok(karte.includes('DM基本セット'), `${f}: 採血セットが DM基本セット でない`)
      assert.ok(!karte.includes('基本採血なし'), `${f}: 基本採血なし が残っている`)
      assert.ok(karte.includes('【糖尿病の症状】'), `${f}: 糖尿病の症状が無い`)
    }
  })

  test('内分泌: 主病名（＃行）は出さない。ただし採血で判明した ＃糖尿病 は例外', () => {
    const karte = buildKarteTemplate('内分泌', FIXTURES['内分泌'])
    assert.ok(!karte.split('\n').some(l => l.startsWith('＃')), '＃行を推測して出力している')
    assert.ok(karte.includes('□主病名：医師の診察時に確定・記載'))
    assert.ok(!karte.includes('□初回療養計画書を作成済'), '生活習慣病なしなのに療養計画書が出ている')
    const withCarePlan = buildKarteTemplate('内分泌', ENDOCRINE_WITH_CAREPLAN)
    assert.ok(withCarePlan.includes('□初回療養計画書を作成済'))
    const withDm = buildKarteTemplate('内分泌', ENDOCRINE_WITH_DM_DIFF)
    assert.ok(withDm.includes('＃糖尿病'))
    assert.ok(withDm.includes('□主病名：医師の診察時に確定・記載'), 'DM判明時も主病名の申し送りは残す')
  })

  test('反応性低血糖: ＃糖尿病 は ♯反応性低血糖疑い より前・自費CGMは全例必須', () => {
    const karte = buildKarteTemplate('反応性低血糖', RH_WITH_DM_DIFF)
    assert.ok(karte.indexOf('＃糖尿病') < karte.indexOf('♯反応性低血糖疑い'))
    assert.ok(buildKarteTemplate('反応性低血糖', FIXTURES['反応性低血糖']).includes('□自費CGM（リブレ）装着済'))
  })

  test('SAS: 区分で ＃主病名 と申し送りが決まる', () => {
    const base = FIXTURES['睡眠時無呼吸症候群']
    const cpap = buildKarteTemplate('睡眠時無呼吸症候群', base)
    assert.ok(cpap.includes('＃SAS（前医：あげお睡眠クリニック、CPAP継続）'))
    assert.ok(cpap.includes('□CPAP継続：前医情報提供書 確認済'))
    const unconfirmed = buildKarteTemplate('睡眠時無呼吸症候群',
      { ...base, reason: { ...base.reason, cpapPriorRecordsConfirmed: false } })
    assert.ok(unconfirmed.includes('□CPAP継続：前医情報提供書 確認要'))
    const screening = buildKarteTemplate('睡眠時無呼吸症候群',
      { ...base, reason: { ...base.reason, sasCategory: 'screening' } })
    assert.ok(screening.includes('＃SAS疑い（簡易PSG予定）'))
    assert.ok(screening.includes('□SAS 簡易PSG発送手配 要'))
  })

  test('甲状腺: 6フォームで ＃診断名・申し送り・フォロー間隔が切り替わる', () => {
    const of = f => buildKarteTemplate(f, THYROID_FIXTURE)
    assert.ok(of('甲状腺（バセドウ初診）').includes('＃バセドウ病疑い（エコー上の疑い）'))
    assert.ok(of('甲状腺（バセドウ継続）').includes('＃バセドウ病　甲状腺機能亢進症（診断時期：令和3年）'))
    assert.ok(of('甲状腺（橋本病）').includes('＃橋本病疑い（エコー上の疑い）'))
    assert.ok(of('甲状腺（腫大異常なし）').includes('＃甲状腺腫大（エコー上異常なし）'))
    assert.ok(of('甲状腺（腺腫経過観察）').includes('6か月follow'))
    const mal = of('甲状腺（腺腫悪性疑い）')
    assert.ok(mal.includes('□当院は終診') && mal.includes('（当日紹介、当院終診）'))
    assert.ok(!mal.includes('□通院のご案内をお渡し済'), '当日紹介なのに通院案内が出ている')
    // 2ステップの2フォームは 家族歴・喫煙・健診・仕事 を聴取しない
    for (const f of ['甲状腺（腫大異常なし）', '甲状腺（腺腫悪性疑い）']) {
      assert.ok(!of(f).includes('【FH】'), `${f}: 聴取していない【FH】が出ている`)
    }
    // 結節ありは所見行が出る
    assert.ok(buildKarteTemplate('甲状腺（腺腫経過観察）', THYROID_NODULE_FIXTURE)
      .includes('右葉に最大12×8㎜大の結節あり、石灰化あり、血流に乏しい、充実性'))
  })
})

describe('lib/buildKarteTemplate（案2: 統合だけ AI に頼む）', () => {
  // 2026-09-06 の実測: 音声があると経路A/B とも「音声と構造化データを統合」と AI に指示していた。
  // JS で置き換えると紹介元・自由記入が落ち、♯既往に重複が出る（実測済み）。
  // ⇒ 統合の2点だけ AI に渡す。ここでは「渡す材料が落ちていないこと」を固定する。
  const withVoice = {
    reason: {
      type: '紹介', referralFrom: '上尾中央総合病院', referralDept: '糖尿病内科',
      referralDetail: '安定していたため当院へ', summary: '通院間隔を空けたい',
    },
    voiceMemo: { aiSummary: 'R4頃から口渇・多尿あり。' },
    disease: { otherDiseases: [{ name: '高血圧', hospital: 'その他', hospitalOther: '○○内科' }] },
    voicePastHistory: { aiSummary: '♯高血圧（H28から、○○内科でアムロジピン 5mg 内服中）' },
  }

  test('受診理由の材料: 構造化データを1件も落とさない', () => {
    assert.deepEqual(buildReasonFacts(withVoice), [
      ['受診区分', '紹介'],
      ['紹介元', '上尾中央総合病院 糖尿病内科'],
      ['紹介の経緯', '安定していたため当院へ'],
      ['本人の自由記入', '通院間隔を空けたい'],
    ])
  })

  test('統合プロンプト: 音声も構造化データも♯候補も全て載る', () => {
    const prompt = buildMergePrompt('DM基本', withVoice)
    assert.ok(prompt.includes('R4頃から口渇・多尿あり。'), '音声が載っていない')
    assert.ok(prompt.includes('上尾中央総合病院 糖尿病内科'), '紹介元が載っていない')
    assert.ok(prompt.includes('通院間隔を空けたい'), '自由記入が載っていない')
    assert.ok(prompt.includes('♯高血圧（○○内科）'), '構造化の♯候補が載っていない')
    assert.ok(prompt.includes('アムロジピン'), '音声由来の♯候補が載っていない')
  })

  test('統合プロンプトは今の全文プロンプトより桁違いに短い', () => {
    const full = buildKartePrompt('DM基本', FIXTURES['DM基本']).prompt.length
    const merge = buildMergePrompt('DM基本', withVoice).length
    assert.ok(merge < full * 0.25, `統合プロンプトが長すぎる: ${merge} / ${full}`)
  })

  test('統合プロンプト: 出力フォーマットの雛形を含まない（カルテ全文を書かせない）', () => {
    const prompt = buildMergePrompt('DM基本', withVoice)
    assert.ok(!prompt.includes('【事前聴取時'))
    assert.ok(!prompt.includes('LINE登録'))
    assert.ok(!prompt.includes('目標HbA1c'))
  })

  test('AI の返答を差し込むと受診理由と♯既往が置き換わる', () => {
    const merged = {
      reasonSummary: '上尾中央総合病院 糖尿病内科より紹介。R4頃から口渇・多尿あり。',
      pastHistory: ['♯高血圧（H28から、○○内科でアムロジピン 5mg 内服中）'],
    }
    const karte = buildKarteTemplate('DM基本', { ...FIXTURES['DM基本'], ...withVoice }, { merged })
    assert.ok(karte.includes('上尾中央総合病院 糖尿病内科より紹介。R4頃から口渇・多尿あり。'))
    assert.ok(karte.includes('♯高血圧（H28から、○○内科でアムロジピン 5mg 内服中）'))
    assert.ok(!karte.includes('♯高血圧（○○内科）'), '統合前の重複行が残っている')
  })

  test('AI 返答が壊れていたら JS 素組みにフォールバックする', () => {
    assert.equal(parseMergeResponse('こわれた'), null)
    assert.equal(parseMergeResponse(''), null)
    const karte = buildKarteTemplate('DM基本', FIXTURES['DM基本'], { merged: null })
    assert.ok(karte.includes('【事前聴取時'), 'フォールバックで組み立てられていない')
  })

  test('AI 返答の取り出し: 前後に説明が付いていても JSON を拾う', () => {
    const got = parseMergeResponse('はい。\n{"reasonSummary":"A","pastHistory":["♯B"]}\n以上です')
    assert.deepEqual(got, { reasonSummary: 'A', pastHistory: ['♯B'] })
  })

  test('AI 返答に想定外の型が混ざっても落ちない', () => {
    assert.deepEqual(parseMergeResponse('{"reasonSummary":123,"pastHistory":["♯A",null,5]}'),
      { reasonSummary: '', pastHistory: ['♯A'] })
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


describe('buildKartePrompt: 申し送りのスタッフ入力行は JS で確定させる', () => {
  // 2026-09-06 テンプレート化の第一歩。従来は「（新患2枠取得済の場合）□…」と
  // 条件文を渡して AI に判定させていた。判定材料は全て body にあるので JS で確定させる。
  const withFlags = data => ({
    ...data,
    body: { ...(data.body || {}), doubleSlot: true, doctorGender: '院長（初回のみ）', patientFlag: '○患者疑い（話が長い方）' },
  })
  const withoutFlags = data => ({
    ...data,
    body: { ...(data.body || {}), doubleSlot: false, doctorGender: '指定なし', patientFlag: '通常' },
  })

  for (const [formType, formData] of Object.entries(FIXTURES)) {
    test(`${formType}: 条件文でなく確定した □ 行が入る`, () => {
      const { prompt } = buildKartePrompt(formType, withFlags(formData))
      assert.ok(prompt.includes('□新患2枠取得済み'))
      assert.ok(prompt.includes('□医師希望：院長（初回のみ）'))
      assert.ok(prompt.includes('□○患者疑い（対応注意）'))
      assert.ok(!prompt.includes('（新患2枠取得済の場合）'), 'AI に判定させる条件文が残っている')
      assert.ok(!prompt.includes('（医師希望指定ありの場合）'), 'AI に判定させる条件文が残っている')
    })

    test(`${formType}: 該当なしなら 1 行も出さず、要望の前に空行を作らない`, () => {
      const { prompt } = buildKartePrompt(formType, withoutFlags(formData))
      assert.ok(!prompt.includes('□新患2枠取得済み'))
      assert.ok(!prompt.includes('□医師希望：'))
      assert.ok(!prompt.includes('□指定なし'))
      assert.ok(!prompt.includes('\n\n【診察にあたっての要望】'), '申し送り最終行と要望の間に空行が入っている')
    })
  }

  test('甲状腺も同じ関数を使う（□女性医師希望 でなく □医師希望：女性医師）', () => {
    const { prompt } = buildKartePrompt('甲状腺（バセドウ初診）', withFlags(THYROID_FIXTURE))
    assert.ok(prompt.includes('□医師希望：院長（初回のみ）'))
    assert.ok(!prompt.includes('□院長希望（初回のみ）'))
    assert.ok(prompt.includes('□○患者疑い（対応注意）'))
  })
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

describe('カルテ組立の実装は1つだけ（経路A/B の二重管理を復活させない）', () => {
  // 2026-09-06 に経路A（コンポーネント）のプロンプト組立を廃止し、
  // 2026-09-07 に生成そのものを lib/buildKarteTemplate.js に一本化した。
  // 二重管理が復活すると「初回生成と再生成でカルテが違う」事故が戻るので、ここで固定する。
  // （これが以前の scripts/check-prompt-sync.mjs + allow-list 65行 の代わり）
  const COMPONENT_DIR = join(HERE, '..', '..', 'components')
  const intakeFiles = () => readdirSync(COMPONENT_DIR).filter(f => f.endsWith('IntakeTool.js'))

  test('components/*IntakeTool.js はプロンプトを自前で組み立てない', () => {
    const offenders = []
    for (const f of intakeFiles()) {
      const src = readFileSync(join(COMPONENT_DIR, f), 'utf8')
      if (/const prompt\s*=\s*`/.test(src)) offenders.push(f)
    }
    assert.deepEqual(offenders, [],
      'コンポーネント内にプロンプトのテンプレートリテラルが復活している。' +
      'generateKarteText() を呼ぶ形に戻すこと')
  })

  test('全 IntakeTool が generateKarteText を呼んでいる', () => {
    const missing = []
    for (const f of intakeFiles()) {
      const src = readFileSync(join(COMPONENT_DIR, f), 'utf8')
      if (!src.includes('generateKarteText(')) missing.push(f)
    }
    assert.deepEqual(missing, [], 'generateKarteText を呼んでいないフォームがある')
  })

  test('コンポーネントは Anthropic を直接叩かない（統合の1回だけに絞る）', () => {
    const offenders = []
    for (const f of intakeFiles()) {
      const src = readFileSync(join(COMPONENT_DIR, f), 'utf8')
      if (src.includes('"/api/generate"') || src.includes("'/api/generate'")) offenders.push(f)
    }
    assert.deepEqual(offenders, [],
      'コンポーネントが /api/generate を直接呼んでいる。lib/generateKarte.js 経由にすること')
  })
})

describe('AI を呼ぶのは音声入力があるときだけ', () => {
  // 音声が無ければ統合する相手がいないので、カルテは form_data から決定論的に組み上がる。
  // 当院の運用では音声はそこまで使われないため、実際は大半の初診が AI 呼び出しゼロで終わる。
  test('音声なし → 統合プロンプトは null（AI を呼ばない）', () => {
    for (const f of Object.keys(FIXTURES)) {
      assert.equal(needsMerge(FIXTURES[f]), false, `${f}: フィクスチャに音声が入っている`)
      assert.equal(buildMergePrompt(f, FIXTURES[f]), null, `${f}: 音声が無いのに統合プロンプトが出た`)
    }
  })

  test('甲状腺は音声入力を持たないので常に AI ゼロ', () => {
    for (const f of THYROID_FORMS) assert.equal(buildMergePrompt(f, THYROID_FIXTURE), null)
  })

  test('現病歴・既往歴どちらか片方の音声でも統合する', () => {
    const base = FIXTURES['DM基本']
    assert.equal(needsMerge({ ...base, voiceMemo: { aiSummary: 'あ' } }), true)
    assert.equal(needsMerge({ ...base, voicePastHistory: { aiSummary: 'あ' } }), true)
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

  // 甲状腺6フォーム（2026-09-06 に経路A と一本化したので B のスナップショットが主経路の証拠になる）
  for (const formType of THYROID_FORMS) {
    test(formType, () => {
      const { prompt } = buildKartePrompt(formType, THYROID_FIXTURE)
      matchSnapshot(formType.replace(/[（）]/g, '_').replace(/_$/, ''), prompt)
    })
  }

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

// ──────────────────────────────────────────────────────────
// ④ カルテ本文のスナップショット（★これが本番の出力そのもの）
//
// ③ のプロンプトのスナップショットは「旧方式（?legacy=1）の逃げ道」を守るためのもの。
// 2026-09-07 以降、実際に患者のカルテになるのはこちら。
// ──────────────────────────────────────────────────────────
describe('カルテ本文スナップショット（テンプレート版・本番の出力）', () => {
  const snapName = f => `カルテ_${f.replace(/[（）]/g, '_').replace(/_$/, '')}`

  for (const [formType, formData] of Object.entries(FIXTURES)) {
    test(formType, () => matchSnapshot(snapName(formType), buildKarteTemplate(formType, formData)))
  }

  for (const formType of THYROID_FORMS) {
    test(formType, () => matchSnapshot(snapName(formType), buildKarteTemplate(formType, THYROID_FIXTURE)))
  }
  test('甲状腺（腺腫経過観察）_結節あり', () =>
    matchSnapshot('カルテ_甲状腺_腺腫経過観察_結節あり', buildKarteTemplate('甲状腺（腺腫経過観察）', THYROID_NODULE_FIXTURE)))

  test('内分泌（生活習慣病あり）', () =>
    matchSnapshot('カルテ_内分泌_生活習慣病あり', buildKarteTemplate('内分泌', ENDOCRINE_WITH_CAREPLAN)))

  for (const [name, formType, formData] of [
    ['カルテ_睡眠時無呼吸症候群_DM差分あり', '睡眠時無呼吸症候群', SAS_WITH_DM_DIFF],
    ['カルテ_高血圧・脂質異常症_DM差分あり', '高血圧・脂質異常症', HTHL_WITH_DM_DIFF],
    ['カルテ_反応性低血糖_DM差分あり',       '反応性低血糖',       RH_WITH_DM_DIFF],
    ['カルテ_内分泌_DM差分あり',             '内分泌',             ENDOCRINE_WITH_DM_DIFF],
  ]) {
    test(name, () => matchSnapshot(name, buildKarteTemplate(formType, formData)))
  }

  // 音声入力あり（＝ AI の統合結果が差し込まれた状態）も固定する
  test('DM基本_音声あり_統合済', () => {
    const d = {
      ...FIXTURES['DM基本'],
      voiceMemo: { transcript: '', aiSummary: 'R4頃から口渇・多尿あり。', needsDoctorReview: false },
      voicePastHistory: { transcript: '', aiSummary: '♯高血圧（H28から、○○内科でアムロジピン 5mg 内服中）', needsDoctorReview: true },
    }
    const merged = {
      reasonSummary: '上尾中央総合病院 糖尿病内科より紹介。R4頃から口渇・多尿あり。',
      pastHistory: ['♯高血圧（H28から、○○内科でアムロジピン 5mg 内服中）', '♯子宮筋腫（鰐坂医院）'],
    }
    matchSnapshot('カルテ_DM基本_音声あり_統合済', buildKarteTemplate('DM基本', d, { merged }))
  })
})

// A4（印刷）の紙を、実データ用と印刷見本で**同じ部品**から出していることを検査する。
//
// 実データ = /print/[id]（Supabase のレコード）
// 印刷見本 = /print/sample（架空データ・院長が実際に印刷して確かめるためのもの）
// 紙の中身を 2 箇所に書くと必ずずれる（この repo が何度もやられている）ので、
// components/PrintSheet.js の 1 箇所だけにしてある。
//
// ★見本は「いちばん厳しい回」でなければ確認の意味が薄い。
//   1型糖尿病（カルテ最長）＋ ドクターキューブ貼り付けあり になっていることも見る。

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildKarteTemplate } from '../../lib/buildKarteTemplate.js'
import { splitDrQube } from '../../lib/drQube.js'
import { collapseBlankLinesForPrint } from '../../lib/printKarte.js'
import { SAMPLE_FORM_DATA, SAMPLE_FORM_TYPE, PRINT_SAMPLES } from '../../lib/printSample.js'
import { FIXTURES } from './fixtures.mjs'
import {
  isLibreHandoffLine, buildRhLibreLines, buildGdmLibreReservationLines, buildDmLibreLines,
  LIBRE_ATTACHED, LIBRE_NOT_ATTACHED, POSTPRANDIAL_HYPO_SYMPTOM,
} from '../../lib/libreNotes.js'

const read = f => fs.readFileSync(f, 'utf8')
const PAGES = ['pages/print/[id].js', 'pages/print/sample.js']

// ★2026-10-16 院長「申し送りのリブレ関連や、妊娠糖尿病の予約日時関連は赤字に」。
//   紙でだけ赤くする。赤を足すのは簡単なので、**何を赤くしないか**を固定しておく。
describe('A4 の赤字（リブレの装着・妊娠糖尿病の予約）', () => {
  // libreNotes が出しうる行を全部集める（足した行を赤字の対象に入れ忘れたら落ちる）
  const produced = [
    ...buildRhLibreLines({ libre: { attached: LIBRE_ATTACHED, date: '2026-10-16' } }),
    ...buildRhLibreLines({ libre: { attached: LIBRE_ATTACHED } }),
    ...buildRhLibreLines({ libre: { attached: LIBRE_NOT_ATTACHED, note: '在庫切れ' } }),
    ...buildRhLibreLines({}),
    ...buildGdmLibreReservationLines({ libre: { firstVisit: '2026-10-23', follow1: '2026-11-06', follow2: '2026-11-20' } }),
    ...buildGdmLibreReservationLines({ libre: { firstVisit: '2026-10-23' } }),
    ...buildGdmLibreReservationLines({}),
    ...[LIBRE_ATTACHED, LIBRE_NOT_ATTACHED, ''].flatMap(attached => buildDmLibreLines({
      disease: { dmSymptoms: { selected: [POSTPRANDIAL_HYPO_SYMPTOM] } },
      libre: { attached, date: '2026-10-16' },
    })),
    '□リブレ（自費CGM）取り付けに同意済',
  ]

  test('リブレの装着・予約の行はすべて赤字になる', () => {
    const missed = produced.filter(l => !isLibreHandoffLine(l))
    assert.deepEqual(missed, [], '赤字の対象から漏れている行がある（lib/libreNotes.js の RED_PREFIXES）')
  })

  test('★それ以外は赤くしない（赤を増やすと赤が意味を失う）', () => {
    const black = [
      // 1型・小児1型の CGM は患者が既に使っている機器の話。当院の段取りではない
      '□CGM：フリースタイルリブレ（継続）',
      '□使用希望デバイス：フリースタイルリブレ',
      '□通院のご案内をお渡し済',
      '□紹介状 持参あり',
      '♯反応性低血糖疑い',
      '',
    ]
    for (const l of black) assert.equal(isLibreHandoffLine(l), false, `赤くしてはいけない行: ${l}`)
  })

  test('妊娠糖尿病・反応性低血糖のカルテに、赤字になる行が実際に含まれている', () => {
    for (const form of ['妊娠糖尿病', '反応性低血糖']) {
      const lines = buildKarteTemplate(form, FIXTURES[form]).split('\n')
      assert.ok(lines.some(isLibreHandoffLine), `${form}: 赤字になる行が 1 つも無い`)
    }
  })
})

describe('印刷用 A4（components/PrintSheet.js）', () => {
  test('カルテ本文は行ごとに span で包み、リブレの行に赤字のクラスを付ける', () => {
    const s = read('components/PrintSheet.js')
    assert.ok(s.includes('isLibreHandoffLine'), '赤字の判定を PrintSheet が使っていない')
    assert.ok(s.includes('kp-print-hot'), '赤字のクラスが無い')
    // ★色はカルテ本文の行にだけ付ける。貼り付け欄（ドクターキューブ）は患者の入力なので赤くしない
    const dq = s.slice(s.indexOf('const blocks = splitDrQube'))
    assert.ok(!dq.includes('kp-print-hot'), '赤字の判定が貼り付け欄側に移っている')
  })

  for (const f of PAGES) {
    test(`${f}: 紙の中身は PrintSheet から出す（写さない）`, () => {
      const s = read(f)
      assert.ok(s.includes("from '../../components/PrintSheet'"), 'PrintSheet を import していない')
      assert.ok(s.includes('<PrintSheet record='), 'PrintSheet を使っていない')
      // 紙の体裁をページ側に書き戻していないか
      for (const ng of ['kp-print-head', 'kp-print-karte', 'kp-print-dq-block', '@page']) {
        assert.ok(!s.includes(ng), `紙の体裁がページ側に戻ってきている: ${ng}`)
      }
    })

    test(`${f}: CSS は dangerouslySetInnerHTML で入れる`, () => {
      // ★<style>{CSS}</style> だと SSR 側だけ ' が &#x27; に escape され、
      //   hydration エラーになる（2026-10-14 に実際に出した。font-family の引用符が原因）。
      const s = read(f)
      assert.ok(s.includes('<style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />'),
        '<style>{PRINT_CSS}</style> に戻すと hydration エラーになる')
    })
  }

  test('印刷見本は「いちばん厳しい回」になっている', () => {
    assert.equal(SAMPLE_FORM_TYPE, '1型糖尿病', 'カルテが最長のフォームで見本を作ること')
    const karte = buildKarteTemplate(SAMPLE_FORM_TYPE, SAMPLE_FORM_DATA)
    assert.ok(karte, 'カルテが組めない')
    assert.ok(karte.split('\n').length >= 50, `見本のカルテが短すぎる（${karte.split('\n').length}行）`)
    assert.ok(SAMPLE_FORM_DATA.drQube?.text, 'ドクターキューブの貼り付けが無い')
    assert.ok(splitDrQube(SAMPLE_FORM_DATA.drQube.text), '貼り付けが【項目】形式になっていない')
  })

  test('見本のカルテは本物と同じ長さの規模（フィクスチャと行数が近い）', () => {
    const sample = buildKarteTemplate(SAMPLE_FORM_TYPE, SAMPLE_FORM_DATA).split('\n').length
    const fixture = buildKarteTemplate('1型糖尿病', FIXTURES['1型糖尿病']).split('\n').length
    assert.ok(Math.abs(sample - fixture) <= 3,
      `見本（${sample}行）とフィクスチャ（${fixture}行）が離れすぎ。見本の中身が痩せている可能性`)
  })

  // ★紙と電子カルテで要る隙間が違う（院長 2026-10-14）
  //   電子カルテに貼る文 = フッターの上に 3 行（医師が追記する場所）
  //   紙              = 1 行（3 行だと 目標HbA1c 以下が裏のページに送られる）
  describe('フッターの空行（紙は1行・電子カルテは3行）', () => {
    const FORMS = Object.keys(FIXTURES)
    // ★受診理由の 1 行目も `R8.10：…` で始まる。フッターは **最後の** 一致
    const footerIndex = ls => ls.map((l, i) => [l, i])
      .filter(([l]) => /^R\d+\.\d+：/.test(l)).map(([, i]) => i).pop() ?? -1

    test('カルテ本文（電子カルテに貼る文）はフッターの上が空行3つ', () => {
      for (const f of FORMS) {
        const karte = buildKarteTemplate(f, FIXTURES[f])
        const ls = karte.split('\n')
        const i = footerIndex(ls)
        assert.ok(i > 0, `${f}: フッターが見つからない`)
        const blanks = []
        for (let k = i + 1; k < ls.length && ls[k] === ''; k++) blanks.push(k)
        assert.equal(blanks.length, 3, `${f}: フッター直後の空行が ${blanks.length} 行（3 行であること）`)
      }
    })

    test('紙に出すときは空行1つに詰まる', () => {
      for (const f of FORMS) {
        const karte = buildKarteTemplate(f, FIXTURES[f])
        const ls = collapseBlankLinesForPrint(karte).split('\n')
        const i = footerIndex(ls)
        let n = 0
        for (let k = i + 1; k < ls.length && ls[k] === ''; k++) n++
        assert.equal(n, 1, `${f}: 紙のフッター直後の空行が ${n} 行（1 行であること）`)
      }
    })

    test('詰めるのはフッターだけ（本文の行は 1 行も消えない）', () => {
      const karte = buildKarteTemplate('DM基本', FIXTURES['DM基本'])
      const printed = collapseBlankLinesForPrint(karte)
      const nonBlank = s => s.split('\n').filter(l => l.trim())
      assert.deepEqual(nonBlank(printed), nonBlank(karte), '中身の行が変わっている（空行を詰めるだけのはず）')
    })
  })
  // ★2026-10-16 院長「赤が出るような見本をつくってほしい」。
  //   既定の見本は 1型糖尿病なのでリブレの行が出ず、赤字を紙で確かめられなかった。
  test('見本の先頭は「いちばん厳しい回」のまま（1枚に収まるかの確認用）', () => {
    assert.equal(PRINT_SAMPLES[0].formType, '1型糖尿病', '先頭は最長のフォームにしておくこと')
    assert.ok(PRINT_SAMPLES[0].formData.drQube?.text, '先頭は貼り付けありのままにしておくこと')
    assert.ok(!PRINT_SAMPLES[0].red, '先頭は赤字の見本ではない')
  })

  test('赤字の見本には、実際に赤字になる行が入っている', () => {
    const reds = PRINT_SAMPLES.filter(s => s.red)
    assert.ok(reds.length >= 2, '赤字の見本が足りない（装着と予約の両方を紙で見たい）')
    for (const s of reds) {
      const lines = buildKarteTemplate(s.formType, s.formData).split('\n').filter(isLibreHandoffLine)
      assert.ok(lines.length > 0, `${s.key}: 赤字になる行が 1 つも無い`)
    }
  })

  test('見本の予約日・装着日は今日からの相対（固定の日付を埋めない）', () => {
    // 固定にすると、来年開いたときに去年の日付が並んで見本が腐る
    const src = read('lib/printSample.js')
    assert.ok(src.includes('dayFromToday('), '日付を今日から作っていない')
    const json = JSON.stringify(PRINT_SAMPLES.map(s => s.formData.libre))
    assert.ok(!/20\d\d-\d\d-\d\d/.test(src.slice(src.indexOf('PRINT_SAMPLES'))), '見本の一覧に固定の日付が書かれている')
    assert.ok(json.includes(String(new Date().getFullYear())), '今日を基準にした日付になっていない')
  })

  test('どの見本にも実在しそうな個人情報を書かない', () => {
    for (const s of PRINT_SAMPLES) {
      const json = JSON.stringify(s.formData)
      for (const ng of ['生年月日', '様', '電話', '℡']) {
        assert.ok(!json.includes(ng), `${s.key}: 見本データに ${ng} が入っている`)
      }
    }
  })

  test('見本に実在しそうな個人情報を書かない（氏名・生年月日は手書き欄）', () => {
    const s = JSON.stringify(SAMPLE_FORM_DATA)
    for (const ng of ['生年月日', '様', '電話', '℡']) {
      assert.ok(!s.includes(ng), `見本データに ${ng} が入っている`)
    }
  })
})

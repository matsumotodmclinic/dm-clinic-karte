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
    '□リブレ（自費CGM）取り付けに同意され、リブレLink、リブレViewインストール、当院IDとのリンクを依頼済',
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

  // ★上部の記入欄（院長 2026-10-16「上部の基本情報のところに初診日を入れたい」）。
  //   この紙は初事前の日に刷って初診の日まで持っておくので、初診日が要る。
  //   アプリは初診の予約日を持っていないので**空の罫線**にしてある（氏名・生年月日と同じ）。
  // ★上段は必ず 2 行（院長 2026-10-16「上段は必須で２列にしてほしい」）。
  //   折り返しを許すと、幅が少し足りないだけで受付コードが 3 行目にぶら下がる（実際に起きた）。
  //   実測（190mm 幅）: 1 行目 542px / 2 行目 596px / 使える幅 690px。
  // ★2026-10-16 院長「どの問診を使用したかと初診日を赤文字で。フォントは同じ大きさで」。
  //   それまで紙のどこにも「どの様式で聴いた記録か」が出ていなかった。
  test('上部に問診の種類が出る（赤・大きさは本文のまま）', () => {
    const s = read('components/PrintSheet.js')
    assert.ok(s.includes('record.form_type'), '問診の種類を印字していない')
    assert.ok(s.includes('kp-print-red'), '赤字のクラスが無い')
    // 申し送りの赤字（kp-print-hot）は 14px に拡大するが、上段は大きさを変えない
    const red = s.match(/\.kp-print-red[^}]*\{[^}]*\}/g)?.join('') || ''
    assert.ok(red.includes('color: #c62828'), '上段の赤が指定されていない')
    assert.ok(!/font-size/.test(red), '上段の赤字で大きさを変えている（院長指定は「同じ大きさ」）')
  })

  test('初診日も赤くする', () => {
    const s = read('components/PrintSheet.js')
    // ★コメント中の「初診日」ではなく、画面に出るラベルの側を見る
    const i = s.indexOf('<span className="kp-print-label">初診日</span>')
    assert.ok(i > 0, '初診日のラベルが無い')
    assert.ok(s.slice(i - 120, i).includes('kp-print-red'), '初診日の欄が赤くなっていない')
  })

  // ★問診の種類は「甲状腺（腺腫悪性疑い）」のように長い。nowrap なので、はみ出す前に
  //   氏名の線が縮んで吸収する（ブラウザで全フォーム分を実測して決めた）。
  test('氏名の線は縮んで長い問診名を吸収する', () => {
    const s = read('components/PrintSheet.js')
    const rule = s.match(/\.kp-print-fill-name \{[^}]*\}/)?.[0] || ''
    assert.ok(/flex:\s*0 1/.test(rule), '氏名の線が縮まない（長い問診名で紙からはみ出す）')
    assert.ok(/min-width/.test(rule), '縮みすぎて書けなくなる下限が無い')
  })

  test('上段は折り返さない（2 行から増やさない）', () => {
    const s = read('components/PrintSheet.js')
    const row = s.match(/\.kp-print-row \{[^}]*\}/)?.[0]
    assert.ok(row, '.kp-print-row の指定が無い')
    assert.ok(row.includes('flex-wrap: nowrap'),
      '上段が折り返す指定に戻っている。欄を足すなら幅を詰めること（受付コードが 3 行目に落ちる）')
  })

  test('上部に初診日の記入欄がある（値は印字しない）', () => {
    const s = read('components/PrintSheet.js')
    const i = s.indexOf('初診日')
    assert.ok(i > 0, '初診日の欄が無い')
    // 手書き欄なので、ラベルの近くに record の値を埋めていないこと
    const block = s.slice(i, i + 600)
    assert.ok(!block.includes('record.'), '初診日に値を埋めている（アプリは初診日を持っていない）')
    assert.ok(block.includes('kp-print-fill'), '初診日が空の罫線になっていない')
  })

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

  // ★貼り付けがあると「左=カルテ / 右=ドクターキューブ」の横並びになり、カルテの幅が 70% に減る。
  //   赤字が折り返さないか・1 枚に収まるかは、この状態で見ないと確かめたことにならない（院長 2026-10-16）。
  test('どの見本も貼り付けありの状態で出す（本番でいちばん厳しい並び）', () => {
    for (const s of PRINT_SAMPLES) {
      const text = s.formData.drQube?.text
      assert.ok(text, `${s.key}: ドクターキューブの貼り付けが無い`)
      assert.ok(splitDrQube(text), `${s.key}: 貼り付けが【項目】形式になっていない`)
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

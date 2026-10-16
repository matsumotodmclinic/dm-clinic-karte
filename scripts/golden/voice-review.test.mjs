// 音声整形の出口チェック（lib/voiceReview.js）の検査。
//
// ★ここで大事なのは「全緑になること」ではなく **壊した出力でちゃんと赤くなること**。
//   eval-rules.test.mjs と同じ考え方（ルールが鳴らないなら、ルールが無いのと同じ）。
//
// 材料は 2026-10-15〜16 に保存済みデータで実際に見つかった壊れ方。
// 実患者のデータは置かない（形だけ同じにした架空の文）。

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { reviewVoiceOutput } from '../../lib/voiceReview.js'

const codes = r => r.map(x => x.code)
const has = (r, code) => codes(r).includes(code)

describe('出口チェック: 正しい出力では何も言わない', () => {
  test('既往歴（♯病名（和暦・病院・薬））', () => {
    const r = reviewVoiceOutput({
      mode: 'pastHistory',
      transcript: '高脂血症は十年ぐらい前からです。薬を飲み始めました。',
      summary: '♯脂質異常症（H28から、見本内科でスタチン内服中）',
    })
    assert.deepEqual(r, [], JSON.stringify(r))
  })

  test('現病歴（1〜3 文に整形済み）', () => {
    const r = reviewVoiceOutput({
      mode: 'currentIllness',
      transcript: 'えーっと、五年前くらいから健診で血糖が高いと言われていまして、それで来ました。',
      summary: 'R3頃から健診で高血糖を指摘され、精査目的に当院を受診。',
    })
    assert.deepEqual(r, [], JSON.stringify(r))
  })

  test('既往歴が「なし」の回（♯ が無くても咎めない）', () => {
    const r = reviewVoiceOutput({
      mode: 'pastHistory',
      transcript: '特にないですね。健康診断も毎年受けています。',
      summary: '特記すべき既往歴なし',
    })
    assert.deepEqual(r, [], JSON.stringify(r))
  })

  test('整形前（まだ押していない）は何も言わない', () => {
    assert.deepEqual(reviewVoiceOutput({ transcript: '', summary: '' }), [])
    assert.deepEqual(reviewVoiceOutput({}), [])
  })

  test('フッターの CPR0.5 のような英数字を元号と見間違えない', () => {
    // 「R」を拾う正規表現が CPR0.5 を元号と誤認すると、時期が無いのに通ってしまう
    const r = reviewVoiceOutput({
      mode: 'pastHistory',
      transcript: '十年前に手術をしました。',
      summary: '♯胃癌（CPR0.5以下の方は注意、時期は不明）',
    })
    assert.ok(has(r, 'era-missing'), '元号が無いのに通っている: ' + JSON.stringify(r))
  })
})

describe('出口チェック: 壊れた出力は赤くなる（実際に出ていた壊れ方）', () => {
  test('① 「○年前」と話されたのに時期が 1 つも無い', () => {
    // 実例: 「5年前」を 13 回話しているのに、整形結果に元号が 1 つも無かった
    const r = reviewVoiceOutput({
      mode: 'pastHistory',
      transcript: '五年前くらいからです。五年前ですね。だいたい五年前だと思います。',
      summary: '♯高血圧（見本内科で内服中）',
    })
    assert.ok(has(r, 'era-missing'), JSON.stringify(r))
  })

  test('② 西暦のまま書かれた', () => {
    // 実例: 「十年ほど前」→「2016年胆管癌（2017肺転移…）」
    const r = reviewVoiceOutput({
      mode: 'pastHistory',
      transcript: '十年ほど前に見つかりました。',
      summary: '♯胆管癌（2016年、見本病院で切除。2017肺転移あり）',
    })
    assert.ok(has(r, 'seireki'), JSON.stringify(r))
  })

  test('② 西暦がスラッシュ区切りでも拾う', () => {
    const r = reviewVoiceOutput({ summary: '♯胃癌（2016/10 手術）' })
    assert.ok(has(r, 'seireki'), JSON.stringify(r))
  })

  test('③ 「○年前」が換算されずに残っている', () => {
    // 実例: 和暦換算を入れる前の回。「3年前」がそのままカルテに載っていた
    const r = reviewVoiceOutput({
      transcript: '三年前に手術しました。',
      summary: '♯胃癌（3年前、見本病院で手術）',
    })
    assert.ok(has(r, 'years-ago'), JSON.stringify(r))
  })

  test('③ 「○ヶ月前」も拾う', () => {
    const r = reviewVoiceOutput({ summary: '♯肺炎（3ヶ月前に入院）' })
    assert.ok(has(r, 'years-ago'), JSON.stringify(r))
  })

  test('④ 病名の記号が ASCII の # になっている', () => {
    // 実例: 「#カンジダ膣炎」。カルテ側の正規化は [♯＃] しか受けないので病名として扱われない
    const r = reviewVoiceOutput({
      mode: 'pastHistory',
      summary: '♯高血圧（R3から）\n#カンジダ膣炎（産婦人科通院中）',
    })
    assert.ok(has(r, 'ascii-sharp'), JSON.stringify(r))
  })

  test('⑤ 録音の話し言葉がそのまま混ざっている', () => {
    // 実例: 整形結果の後ろに、文字起こしが丸ごと貼り付いていた
    const spoken = 'あのですね、生まれた時からの病気を持っていまして、三週間に一回くらい注射を受けています'
    const r = reviewVoiceOutput({
      mode: 'pastHistory',
      transcript: `はい。${spoken}。かしこまりました。`,
      summary: `♯クラインフェルター症候群（R7から、見本クリニックでホルモン注射）\n${spoken}`,
    })
    assert.ok(has(r, 'transcript-copied'), JSON.stringify(r))
    assert.ok(r.find(x => x.code === 'transcript-copied').hint.includes('あのですね'), '引用が出ていない')
  })

  test('⑤ 短い言い回しの一致では鳴らない（偽陽性を避ける）', () => {
    const r = reviewVoiceOutput({
      transcript: '健診で血糖が高いと言われました。',
      summary: 'R6の健診で血糖が高いと言われ、当院を受診。',
    })
    assert.deepEqual(r, [], JSON.stringify(r))
  })

  test('⑥ 既往歴なのに ♯ の行が 1 つも無い（文章で返ってきた）', () => {
    const r = reviewVoiceOutput({
      mode: 'pastHistory',
      transcript: '高血圧と糖尿病があります。どちらも見本内科です。',
      summary: 'H28から高血圧と糖尿病で見本内科に通院しており、内服を継続しています。',
    })
    assert.ok(has(r, 'past-history-format'), JSON.stringify(r))
  })

  test('⑥ 現病歴は文章で正しいので咎めない', () => {
    const r = reviewVoiceOutput({
      mode: 'currentIllness',
      transcript: '高血圧と糖尿病があります。どちらも見本内科です。',
      summary: 'H28から高血圧と糖尿病で見本内科に通院しており、内服を継続している。',
    })
    assert.deepEqual(r, [], JSON.stringify(r))
  })

  test('整形結果が空（録音はあるのに失敗した）', () => {
    const r = reviewVoiceOutput({ transcript: '五年前からです。', summary: '' })
    assert.deepEqual(codes(r), ['empty'])
    assert.equal(r[0].level, 'error')
  })

  test('1 回の出力に複数の壊れ方があれば全部出す', () => {
    const r = reviewVoiceOutput({
      mode: 'pastHistory',
      summary: '#胃癌（2016年、3年前に再発）',
    })
    for (const c of ['seireki', 'years-ago', 'ascii-sharp']) {
      assert.ok(has(r, c), `${c} が出ていない: ` + JSON.stringify(r))
    }
  })
})

describe('出口チェック: 画面に出せる形になっている', () => {
  test('どの指摘にも message と hint がある（画面はこれを並べるだけ）', () => {
    const r = reviewVoiceOutput({
      mode: 'pastHistory',
      transcript: '十年前からです。',
      summary: '#高血圧（2016年、3年前から内服）',
    })
    assert.ok(r.length > 0)
    for (const x of r) {
      assert.ok(x.code && x.message && x.hint, JSON.stringify(x))
      assert.ok(['error', 'warn'].includes(x.level), x.level)
    }
  })
})

// 出力 eval のルール自体の検証（API 不要）。
//
// ★これが無いと「eval が全緑」に意味が無い。
//   voice 側の教訓（2026-09-06）: 検出器を作ったら、それが**実際に赤になること**を先に確かめる。
//   ここでは壊れたカルテを合成して judge() に食わせ、狙ったルールが発火することを固定する。
//
// あわせて 2026-09-08 の eval で見つかった 8 件の不具合の回帰テストも置く
// （直った状態が戻らないことを、カルテ本文のレベルで固定する）。

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { judge } from '../eval/rules.mjs'
import { CASES, EMPTY } from '../eval/cases.mjs'
import { buildKarteTemplate } from '../../lib/buildKarteTemplate.js'
import { buildAlcohol, buildSmoking, buildBmi } from '../../lib/karteFields.js'

// 正常なカルテ（DM基本/標準）を土台に、1 箇所だけ壊して判定させる
const OK_CASE = CASES.find(c => c.id === 'DM基本/標準')
const OK_KARTE = buildKarteTemplate(OK_CASE.form, OK_CASE.data)

const fired = (karte, c = OK_CASE, ctx = {}) => judge(karte, c, ctx).filter(f => f.level !== 'info').map(f => f.rule)
const hit = (rule, karte, c, ctx) => assert.ok(fired(karte, c, ctx).includes(rule),
  `ルール ${rule} が発火しなかった。発火したもの: ${JSON.stringify(fired(karte, c, ctx))}`)

describe('eval ルールが赤になることの確認（壊したカルテを食わせる）', () => {
  test('土台のカルテは指摘ゼロ', () => {
    assert.deepEqual(fired(OK_KARTE), [])
  })

  test('broken-value: undefined / NaN / Infinity / [object Object]', () => {
    for (const bad of ['undefined', 'NaN', 'Infinity', '[object Object]']) {
      hit('broken-value', OK_KARTE.replace('【健診】市の健診', `【健診】${bad}`))
    }
  })

  test('ai-instruction: AI 向けの指示文の混入', () => {
    hit('ai-instruction', OK_KARTE.replace('【健診】市の健診', '【健診】（該当時のみ）'))
    hit('ai-instruction', OK_KARTE.replace('【健診】市の健診', '【飲酒歴】（整形済みテキスト）'))
  })

  test('html-tag: HTML タグ', () => {
    hit('html-tag', OK_KARTE.replace('【健診】市の健診', '【健診】<b>市の健診</b>'))
  })

  test('empty-output: 極端に短い', () => {
    hit('empty-output', 'R8.9：\n＃糖尿病')
  })

  test('required-sections / handoff-guide: 必須の欄が消えた', () => {
    hit('required-sections', OK_KARTE.replace(/【アレルギー歴】.*\n/, ''))
    hit('handoff-guide', OK_KARTE.replace('□通院のご案内をお渡し済\n', ''))
  })

  test('section-dup: 同じセクションが 2 回', () => {
    hit('section-dup', OK_KARTE.replace('【健診】市の健診', '【健診】市の健診\n【健診】市の健診'))
  })

  test('wareki-only: 西暦・「○年前」', () => {
    hit('wareki-only', OK_KARTE.replace('＃糖尿病（令和3年）', '＃糖尿病（2021年）'))
    hit('wareki-only', OK_KARTE.replace('＃糖尿病（令和3年）', '＃糖尿病（5年前）'))
  })

  test('no-invented-hospital: 入力に無い医療機関名', () => {
    hit('no-invented-hospital', OK_KARTE.replace('♯慢性腎臓病（上尾中央総合病院 腎臓内科）', '♯慢性腎臓病（架空記念病院 腎臓内科）'))
  })

  test('no-invented-hospital: 「→」で繋いだ 2 施設を誤検出しない', () => {
    const c = CASES.find(x => x.id === 'DM基本/複雑')
    assert.ok(!fired(buildKarteTemplate(c.form, c.data), c).includes('no-invented-hospital'))
  })

  test('body-numbers: 身長・体重・BMI の食い違い', () => {
    hit('body-numbers', OK_KARTE.replace('身長:170cm', '身長:171cm'))
    hit('body-numbers', OK_KARTE.replace(/（BMI [\d.]+）/, '（BMI 99.9）'))
  })

  test('other-diseases-kept: 既往の病名・通院先が落ちた', () => {
    hit('other-diseases-kept', OK_KARTE.replace('♯慢性腎臓病（上尾中央総合病院 腎臓内科）\n', ''))
    hit('other-diseases-kept', OK_KARTE.replace('♯慢性腎臓病（上尾中央総合病院 腎臓内科）', '♯慢性腎臓病'))
  })

  test('staff-flags-kept / concern-kept: スタッフ入力と要望が落ちた', () => {
    const c = CASES.find(x => x.id === 'DM基本/複雑')
    const k = buildKarteTemplate(c.form, c.data)
    hit('staff-flags-kept', k.replace('□新患2枠取得済み\n', ''), c)
    hit('staff-flags-kept', k.replace(/□医師希望：.*\n/, ''), c)
    hit('concern-kept', k.replace('【診察にあたっての要望】注射の回数を減らしたい', '【診察にあたっての要望】なし'), c)
  })

  test('free-text-kept: 自由記入がカルテにも統合材料にも無い', () => {
    const c = CASES.find(x => x.id === 'DM基本/難渋')
    const k = buildKarteTemplate(c.form, c.data)
    const stripped = k.replace(c.data.reason.summary, '')
    hit('free-text-kept', stripped, c, { mergePrompt: '' })
    // 統合プロンプトに載っていれば OK
    assert.ok(!fired(stripped, c, { mergePrompt: c.data.reason.summary }).includes('free-text-kept'))
  })

  test('書式の warn: 連続空行 / 要望の直前 / 区切り線の連続 / 行末空白 / 空の括弧 / 継ぎ目', () => {
    hit('no-double-blank', OK_KARTE.replace('＃HT\n', '＃HT\n\n\n'))
    hit('handoff-adjacent', OK_KARTE.replace('【診察にあたっての要望】', '\n【診察にあたっての要望】'))
    hit('divider-not-adjacent', OK_KARTE.replace('【健診】市の健診', '---------------------------------------------\n---------------------------------------------'))
    hit('no-trailing-space', OK_KARTE.replace('【健診】市の健診', '【健診】市の健診   '))
    hit('no-empty-parens', OK_KARTE.replace('【健診】市の健診', '【健診】（）'))
    hit('no-dangling-punct', OK_KARTE.replace('【健診】市の健診', '【健診】市の健診、'))
  })

  test('no-empty-parens: 医師の記入欄「CPR（　）」は誤検出しない', () => {
    assert.ok(!fired(OK_KARTE).includes('no-empty-parens'))
    assert.ok(OK_KARTE.includes('CPR（　）'), '土台に記入欄が含まれていない')
  })

  test('past-history-blank: 甲状腺の「エコー所見と【アレルギー歴】の間の1行空け」は誤検出しない', () => {
    const c = CASES.find(x => x.form === '甲状腺（バセドウ初診）' && x.kind === '標準')
    assert.ok(!fired(buildKarteTemplate(c.form, c.data), c).includes('past-history-blank'))
  })
})

// ──────────────────────────────────────────────────────────
// 2026-09-08 の eval で見つかった不具合の回帰テスト
// ──────────────────────────────────────────────────────────
describe('2026-09-08 eval で見つかった不具合（回帰）', () => {
  test('喫煙歴: 詳細を聞けていなくても壊れた文字列を出さない', () => {
    // 旧: 「本×年（歳〜）、年に禁煙」がカルテに載っていた
    assert.equal(buildSmoking({ history: { smoking: '禁煙済' } }), '禁煙済')
    assert.equal(buildSmoking({ history: { smoking: 'あり' } }), 'あり')
    assert.equal(buildSmoking({ history: { smoking: 'あり', smokingAmount: '10' } }), '10本')
    assert.equal(buildSmoking({ history: { smoking: '禁煙済', smokingAmount: '10' } }), '10本、禁煙済')
    assert.equal(buildSmoking({ history: { smoking: 'なし' } }), 'なし')
    assert.equal(buildSmoking({ history: { smoking: '' } }), '')
    // 完全入力は従来どおり
    assert.equal(
      buildSmoking({ history: { smoking: '禁煙済', smokingAmount: '20', smokingYears: '30', smokingStartAge: '20', smokingQuitEra: '令和', smokingQuitYear: '3' } }),
      '20本×30年（20歳〜）、令和3年に禁煙')
  })

  test('飲酒歴: 種類か量のどちらか片方でも書く（丸ごと落とさない）', () => {
    // 旧: 「種類 かつ 量」が揃った行だけ採用していたので下の2行とも消えていた
    assert.equal(buildAlcohol({ history: { alcoholItems: [{ type: 'shochu', amount: '', freq: '毎日' }] } }), '焼酎（毎日）')
    assert.equal(buildAlcohol({ history: { alcoholItems: [{ type: '', amount: '2合', freq: '' }] } }), '2合')
    assert.equal(buildAlcohol({ history: { alcoholNone: true } }), 'なし')
    assert.equal(buildAlcohol({ history: { alcoholItems: [{ type: '', amount: '', freq: '' }] } }), '')
  })

  test('BMI: 身長 0 や打ち間違いで Infinity / NaN を出さない', () => {
    assert.equal(buildBmi({ body: { height: '0', weightNow: '60' } }), null)
    assert.equal(buildBmi({ body: { height: 'あ', weightNow: '60' } }), null)
    assert.equal(buildBmi({ body: { height: '170', weightNow: '0' } }), null)
    assert.equal(buildBmi({ body: { height: '170', weightNow: '72' } }), '24.9')
  })

  test('妊娠糖尿病: 病名未選択のときに「妊娠糖尿病」と断定しない', () => {
    const d = EMPTY['妊娠糖尿病']()
    assert.ok(buildKarteTemplate('妊娠糖尿病', d).includes('＃妊娠糖尿病 or 糖尿病合併妊娠'))
    d.disease.dmType = '妊娠糖尿病（GDM）'
    assert.ok(buildKarteTemplate('妊娠糖尿病', d).includes('\n＃妊娠糖尿病\n'))
    d.disease.dmType = '糖尿病合併妊娠'
    assert.ok(buildKarteTemplate('妊娠糖尿病', d).includes('\n＃糖尿病合併妊娠\n'))
  })

  test('妊娠糖尿病: 産科通院先を自由入力だけした場合も落とさない', () => {
    // 「その他」を押さずに病院名だけ打った回。2026-08-22 の hospitalOther バグと同型
    const d = EMPTY['妊娠糖尿病']()
    d.disease.obHospital = ''
    d.disease.obHospitalOther = 'ナラヤマレディースクリニック'
    assert.ok(buildKarteTemplate('妊娠糖尿病', d).includes('　産科通院先：ナラヤマレディースクリニック'))
  })

  test('1型: 厚生年金を聴取できていないときに「受給困難」と断定しない', () => {
    const d = EMPTY['1型糖尿病']()
    const karte = buildKarteTemplate('1型糖尿病', d)
    assert.ok(karte.includes('（未聴取）→判定不能（要確認）'), karte.split('\n').find(l => l.startsWith('・障害年金')))
    d.disease.pensionKosei = 'いいえ（未加入）'
    assert.ok(buildKarteTemplate('1型糖尿病', d).includes('（無）→受給困難（×）'))
    d.disease.pensionKosei = 'はい（加入していた）'
    assert.ok(buildKarteTemplate('1型糖尿病', d).includes('（有）→CPR次第'))
    d.disease.pensionStatus = '受給中'
    assert.ok(buildKarteTemplate('1型糖尿病', d).includes('（有）→受給中'))
  })

  test('甲状腺: 症状「その他」が「その他（その他: ○○）」と二重にならない', () => {
    const d = EMPTY['甲状腺']()
    d.symptom = { selected: ['その他'], otherText: '寝つきが悪い' }
    const line = buildKarteTemplate('甲状腺（バセドウ初診）', d).split('\n')[0]
    assert.ok(line.includes('その他: 寝つきが悪いの訴えあり。'), line)
    assert.ok(!line.includes('その他（その他'), '「その他（その他: …）」の二重が残っている')
  })

  test('反応性低血糖: 選択肢が空で補足だけのとき括弧が浮かない', () => {
    const d = EMPTY['反応性低血糖']()
    d.symptom.symptomsNote = 'うまく言えないがフワッとする感じ'
    const karte = buildKarteTemplate('反応性低血糖', d)
    assert.ok(karte.includes('・症状：うまく言えないがフワッとする感じ'), karte.split('\n').find(l => l.startsWith('・症状')))
    assert.ok(!karte.includes('・症状：（'), '括弧が浮いている')
  })
})

// ──────────────────────────────────────────────────────────
// 2026-09-08 の 2 回目の検証（音声ケース追加 + 未読の出力を全部読む）で見つかった不具合
// ──────────────────────────────────────────────────────────
describe('2026-09-08 検証2回目で見つかった不具合（回帰）', () => {
  test('選択肢の「その他」がそのままカルテに出ない', () => {
    // 「上尾中央総合病院 その他」「○○病院・その他より紹介」「【仕事】その他」「・居住地：その他」
    for (const c of CASES.filter(x => x.kind === 'その他漏れ')) {
      const karte = buildKarteTemplate(c.form, c.data)
      const bad = karte.split('\n').filter(l => l.replace(/その他:\s*/g, '').includes('その他'))
      assert.deepEqual(bad, [], `${c.id}: 選択値の「その他」が残っている`)
    }
    // 情報のある方（病院名・補足）は残す
    const c = CASES.find(x => x.id === 'DM基本/その他漏れ')
    const k = buildKarteTemplate(c.form, c.data)
    assert.ok(k.includes('♯関節リウマチ（上尾中央総合病院）'), '病院名まで消えている')
    assert.ok(k.includes('【仕事】夜勤あり／週4'), '職業の補足まで消えている')
    assert.ok(k.includes('上尾中央総合病院より紹介にて受診'), '紹介元まで消えている')
  })

  test('甲状腺: 診断時期が不明のとき「診断時期：診断時期不明」と二重にならない', () => {
    const c = CASES.find(x => x.id === '甲状腺（バセドウ継続）/その他漏れ')
    const k = buildKarteTemplate(c.form, c.data)
    assert.ok(k.includes('＃バセドウ病　甲状腺機能亢進症（診断時期不明）'), k.split('\n')[1])
    assert.ok(!k.includes('診断時期：診断時期不明'))
  })

  test('身長・体重の 0 は「○」に倒す（身長:0cm を出さない）', () => {
    const d = EMPTY['DM基本']()
    d.body = { ...d.body, height: '0', weightNow: '60', weight20: '0' }
    const line = buildKarteTemplate('DM基本', d).split('\n').find(l => l.startsWith('身長:'))
    assert.equal(line, '身長:○cm　初診時:60kg　20歳時:○kg　max体重○kg(○歳)')
  })

  test('1型: 現在使用中と希望が同じデバイスは「A（継続）」', () => {
    const d = EMPTY['1型糖尿病']()
    d.reason = { ...d.reason, cgmCurrent: 'フリースタイルリブレ', cgmWish: 'フリースタイルリブレ' }
    assert.ok(buildKarteTemplate('1型糖尿病', d).includes('□CGM：フリースタイルリブレ（継続）'))
    d.reason.cgmWish = 'Dexcom G7'
    assert.ok(buildKarteTemplate('1型糖尿病', d).includes('□CGM：フリースタイルリブレ使用中→Dexcom G7'))
  })

  // ★AI が落ちたときに「黙って質が落ちたカルテ」が保存されないこと
  test('AI 統合に失敗しても ♯既往が重複しない（素組み側でも重複排除する）', () => {
    const c = CASES.find(x => x.id === 'DM基本/音声両方')
    const lines = buildKarteTemplate(c.form, c.data).split('\n').filter(l => l.startsWith('♯'))
    const names = lines.map(l => l.replace(/^♯/, '').split('（')[0])
    assert.equal(new Set(names).size, names.length, `♯が重複している: ${JSON.stringify(lines)}`)
    // 情報量の多い方（音声側）が残る
    assert.ok(lines.some(l => l.includes('経過観察中')), '情報量の少ない方が残っている')
  })

  test('AI 統合に失敗したら申し送りで気付ける', () => {
    const c = CASES.find(x => x.id === 'DM基本/音声両方')
    const failed = buildKarteTemplate(c.form, c.data, { mergeFailed: true })
    assert.ok(failed.includes('□AI統合に失敗：受診理由サマリーと♯既往歴を確認してください'))
    // 成功時は出ない
    assert.ok(!buildKarteTemplate(c.form, c.data).includes('□AI統合に失敗'))
    // 反応性低血糖（申し送りを自前で並べているフォーム）でも出る
    const rh = CASES.find(x => x.id === '反応性低血糖/音声両方')
    assert.ok(buildKarteTemplate(rh.form, rh.data, { mergeFailed: true }).includes('□AI統合に失敗'))
  })

  test('録音しただけで AI 整形を押していない回は統合を呼ばない（生音声はカルテに載せない）', () => {
    const c = CASES.find(x => x.id === 'DM基本/音声未整形')
    const k = buildKarteTemplate(c.form, c.data)
    assert.ok(!k.includes('えーと'), '生の音声がカルテに載っている')
    assert.ok(!k.includes('□AI統合に失敗'))
  })
})

// form_data の全フィールドが「カルテに出る」か「AI への統合材料になる」かのどちらかに
// 属することを、全 14 フォームで検査する。
//
// 狙い (2026-09-06 に DM基本で導入 → 2026-09-07 に全フォームへ展開):
//   テンプレート版は AI に「JSON 全体」を渡さない。書式は JS が組み、
//   AI には統合の2点だけ渡す。その代わり **どこにも属さないフィールド =
//   黙って消える情報** が生まれうる。1 フィールドずつ書き換えて出力が変わるかを見る。
//
//   今の AI 版は JSON 全体が「見えている」が **使うかどうかは毎回変わる**
//   （2026-04 の【糖尿病の症状】欠落はそこで起きた）。この検査は「見えている」ではなく
//   「必ず誰かが担当している」を固定する = 質の取りこぼしを人の目に頼らず検出する。
//
// ★音声入力なしの状態で検査する。
//   音声があると統合プロンプトが「JSON の代わりに何でも運んでしまう」ので、
//   「カルテ本文に出ているか」の検査が緩くなる。音声なし＝カルテ本文だけが出口、
//   が最も厳しく、かつ当院の大半の運用状態でもある。

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildKarteTemplate, buildMergePrompt } from '../../lib/buildKarteTemplate.js'
import {
  FIXTURES, THYROID_FIXTURE, THYROID_NODULE_FIXTURE,
  SAS_WITH_DM_DIFF, HTHL_WITH_DM_DIFF, RH_WITH_DM_DIFF, ENDOCRINE_WITH_DM_DIFF,
} from './fixtures.mjs'

// ── 条件分岐で隠れる項目があるので、埋めた状態を土台にする ──────────────
const IMPORTANT_PAST = {
  gastricCancer: {
    selected: true, surgeryType: '手術で切除', resection: '2/3切除',
    surgeryEra: '平成', surgeryYear: '28', surgeryUnknown: false,
    treatedHospital: '上尾中央総合病院', treatedHospitalOther: '',
    visitingHospital: 'その他', visitingHospitalOther: '鰐坂医院',
    visitFreq: '半年に1回', meds: 'タケキャブ',
  },
  ihd: {
    selected: true, treatment: 'PCI（カテーテル治療）',
    surgeryEra: '平成', surgeryYear: '30', surgeryUnknown: false,
    treatedHospital: '上尾中央総合病院', treatedHospitalOther: '',
    visitingHospital: '', visitingHospitalOther: '', visitFreq: '', meds: 'バイアスピリン',
  },
}

// 眼底検査は「受けている」でしか眼科名・網膜症・緑内障が出ない。
// 眼科を聴取するのは DM基本 / 1型 / 小児1型 / 妊娠糖尿病 の4フォームだけ。
const EYE_FORMS = new Set(['DM基本', '1型糖尿病', '小児1型糖尿病', '妊娠糖尿病'])
const withEye = h => ({
  ...h, eyeFundusCheck: '受けている', eye: '上尾こいけ眼科',
  retinopathy: '単純性網膜症', glaucoma: '緑内障なし', eyeNotebook: '持っている',
})
// 子供の状況は 70歳以上でしか出ない
const withChild = l => ({ ...l, childLocation: '近居（同一市区町村）', childGender: ['息子'], childInfo: '週末に来訪' })

function filled(formType) {
  const d = structuredClone(FIXTURES[formType])
  d.body = { ...d.body, doubleSlot: true, patientFlag: '○患者疑い（話が長い方）' }
  if (EYE_FORMS.has(formType)) d.history = withEye(d.history)
  if (d.history?.age !== undefined) d.history.age = '72'
  if (d.lifestyle) d.lifestyle = withChild(d.lifestyle)
  else if (d.history?.childLocation !== undefined) d.history = withChild(d.history)

  if (formType === 'DM基本') {
    Object.assign(d.disease, IMPORTANT_PAST)
    d.disease.hl = true
  }
  if (formType === '1型糖尿病') d.disease.hl = true
  if (formType === '小児1型糖尿病') {
    d.disease.ht = true
    d.disease.hl = true
    d.chronic = { ...d.chronic, status: '申請中', birthWeight: '3100', birthWeek: '38', birthWeekDay: '2', birthCity: 'その他', birthCityOther: '熊谷市', booklets: ['養育手帳'] }
  }
  if (formType === '高血圧・脂質異常症') {
    d.disease.igt = true
    d.reason = { ...d.reason, concern: true, concernType: '健診で LDL-C を指摘された' }
  }
  if (formType === '内分泌') {
    d.disease.carePlanDiseases = { dm: true, ht: false, hl: false }
    d.reason = { ...d.reason, concern: true, concernType: '倦怠感が続く' }
  }
  if (formType === '妊娠糖尿病') {
    d.disease.dmType = '糖尿病合併妊娠'
    d.disease.hl = true
  }
  if (formType === '睡眠時無呼吸症候群') d.disease.hl = true
  return d
}

// カルテにも統合材料にも影響しないと分かっている項目。
// ★ 追加するときは必ず理由を書くこと。理由が書けないものは「落ちている情報」なので直す。
const COMMON_ALLOWED = {
  'voiceMemo.transcript': '生の音声。カルテには AI 整形済みの aiSummary を使う',
  'voicePastHistory.transcript': '同上',
  'reason.referralQuickSelect': '紹介元のクイック選択を使ったかの UI 用フラグ',
  'reason.transferFrom': '受診区分が「自主転院」のときだけ使う（土台は「紹介」）',
  'reason.transferDetail': '同上',
  'reason.checkupType': '受診区分が「検診異常」のときだけ使う（土台は「紹介」）',
  'alert.weightLoss': '「あり」のときだけ分岐する列挙値',
  'history.allergy': '「なし」かどうかだけを見る列挙値。内容は allergyDetail 側',
  'history.eyeNotebook': '「持っていない」のときだけ申し送りに出る列挙値',
  'history.work': '「していない」のときだけ「就労なし」と出る列挙値',
  'lifestyle.work': '同上（DM基本は lifestyle 配下）',
  'disease.gastricCancer.treatedHospitalOther': '治療病院が「その他」のときだけ使う',
  'disease.ihd.treatedHospitalOther': '同上',
  'disease.ihd.visitingHospitalOther': '通院先が「その他」のときだけ使う',
  // ⚠️ これは列挙値の都合ではなく、本当にどこからも読まれていない
  'history.eyeVisiting': 'フォームの UI にも無い遺物（initialData に残っているだけ）。次に触るとき消す',
}

const ALLOWED = {
  'DM基本': {},
  '1型糖尿病': {
    'reason.deviceWish': 'デバイス希望は cgmWish / pumpWish に置き換わった旧フィールド（UI からも消えている）',
    'reason.pumpCurrent': 'ポンプ希望があるときだけ「○○使用中→」として出る（土台は希望なし）',
    'disease.pensionStatus': '「受給中」のときだけ表記が変わる列挙値',
  },
  '小児1型糖尿病': {
    'disease.insulinStatus': '小児1型では申し送りの分岐に使っていない（成人1型のみ）',
    'disease.dmSymptoms.otherText': '症状に「その他」がチェックされているときだけ使う',
    'chronic.paymentConfirmed': '窓口負担の確認結果。申し送りは「確認し算定へ連絡」で足りるため本文には出さない',
  },
  '高血圧・脂質異常症': {
    'disease.otherDisease': '複数行入力（otherDiseases）に置き換わった旧フィールド',
  },
  '妊娠糖尿病': {},
  '反応性低血糖': {
    'symptom.libreStarted': 'リブレは全例装着なので申し送りは無条件に出る（装着日時は電子カルテ側で管理）',
    'symptom.libreNote': '同上',
    'symptom.cgmWish': '自費CGM（リブレ）は全例装着のため希望欄は分岐に使っていない',
  },
  '睡眠時無呼吸症候群': {
    'reason.knowSource': '当院を知ったきっかけ（集患の参考情報）。カルテには載せない',
    'reason.knowSourceOther': '同上',
    'symptom.sasSymptoms.otherText': '症状に「その他」がチェックされているときだけ使う',
    'disease.igt': 'SAS フォームは ＃IGT を出さない（DM は採血後の DM差分問診で扱う）',
  },
  '内分泌': {
    'disease.otherDisease': '複数行入力（otherDiseases）に置き換わった旧フィールド',
    'disease.carePlanDiseases.ht': '3つのどれか1つでも true なら療養計画書の行が出る（OR 判定）',
    'disease.carePlanDiseases.hl': '同上',
  },
}

// ── 走査 ────────────────────────────────────────────────
function leafPaths(o, prefix = '') {
  const out = []
  for (const [k, v] of Object.entries(o)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...leafPaths(v, p))
    else out.push(p)
  }
  return out
}
const getAt = (o, p) => p.split('.').reduce((a, k) => a?.[k], o)
const setAt = (o, p, v) => {
  const ks = p.split('.')
  const last = ks.pop()
  ks.reduce((a, k) => a[k], o)[last] = v
}

function probesFor(cur) {
  if (typeof cur === 'boolean') return [!cur]
  if (Array.isArray(cur)) return [[...cur, 'ZZSENTINEL'], []]
  return ['ZZSENTINEL', '']
}

function unreferencedPaths(formType, base, paths) {
  const render = d => String(buildKarteTemplate(formType, d)) + ' ' + String(buildMergePrompt(formType, d))
  const baseline = render(base)
  const out = []
  for (const p of paths) {
    const cur = getAt(base, p)
    if (cur === undefined) { out.push(p); continue }
    const changed = probesFor(cur).some(v => {
      const clone = structuredClone(base)
      setAt(clone, p, v)
      return render(clone) !== baseline
    })
    if (!changed) out.push(p)
  }
  return out
}

describe('form_data の取りこぼし検査（全14フォーム）', () => {
  for (const formType of Object.keys(FIXTURES)) {
    const allowed = { ...COMMON_ALLOWED, ...(ALLOWED[formType] || {}) }

    test(`${formType}: 全フィールドがカルテか統合材料のどちらかに属する`, () => {
      const base = filled(formType)
      const unexpected = unreferencedPaths(formType, base, leafPaths(base)).filter(p => !(p in allowed))
      assert.deepEqual(unexpected, [],
        `${formType}: カルテにも統合材料にも現れないフィールドがある = 情報が黙って落ちている。\n` +
        '直すか、ALLOWED に理由を書いて登録すること')
    })

    test(`${formType}: フォーム固有の理由リストが実態とずれていない（棚卸し）`, () => {
      const base = filled(formType)
      const own = Object.keys(ALLOWED[formType] || {}).filter(p => getAt(base, p) !== undefined)
      const stillUnreferenced = new Set(unreferencedPaths(formType, base, own))
      const stale = own.filter(p => !stillUnreferenced.has(p)).map(p => `${p}（もう使われている）`)
      assert.deepEqual(stale, [], `${formType}: 理由リストが実態とずれている。使われ始めた項目は削除すること`)
    })
  }

  // 共通の理由リストは「どのフォームでも条件付きでしか使われない」ことを担保する。
  // 1フォームでも無条件で使われるならそれは列挙値の都合ではないので、書いた理由が嘘になる。
  // （フォームごとに土台の値が違うので、全フォームで参照されている項目だけを stale とする）
  test('共通の理由リストが実態とずれていない（棚卸し）', () => {
    const stale = []
    for (const p of Object.keys(COMMON_ALLOWED)) {
      const forms = Object.keys(FIXTURES).filter(f => getAt(filled(f), p) !== undefined)
      if (!forms.length) { stale.push(`${p}（どのフォームにも存在しない）`); continue }
      const usedEverywhere = forms.every(f => unreferencedPaths(f, filled(f), [p]).length === 0)
      if (usedEverywhere) stale.push(`${p}（全フォームで使われている＝条件付きではない）`)
    }
    assert.deepEqual(stale, [], '共通の理由リストが実態とずれている')
  })

  // 甲状腺は 6 フォームで参照するフィールドが違う（2ステップの2種は家族歴等を聴取しない）。
  // ここでは「全 6 種のどれかが必ず使う」を検査する = どのフォームからも見えない項目を検出する。
  test('甲状腺6フォーム: どのフィールドも最低1フォームでは使われる', () => {
    const THY = [
      '甲状腺（バセドウ初診）', '甲状腺（バセドウ継続）', '甲状腺（橋本病）',
      '甲状腺（腫大異常なし）', '甲状腺（腺腫経過観察）', '甲状腺（腺腫悪性疑い）',
    ]
    const allowedThyroid = {
      'history.allergy': '「なし」かどうかだけを見る列挙値',
      'history.smoking': '「なし」「禁煙済」で分岐する列挙値',
      'history.work': '「していない」のときだけ「就労なし」と出る列挙値',
      'history.surgeryHistory': 'バセドウ継続で あり／なし を切り替える真偽値（土台では false）',
      'history.isotopeHistory': '同上',
      'history.sideEffectMmz': '同上（副作用ありのときだけ薬剤名が出る）',
      'history.sideEffectPtz': '同上',
      'history.eyeHistory': '同上（眼科通院ありのときだけ医院名が出る）',
      'history.surgeryYear': '手術歴ありのときだけ使う（土台は なし）',
      'history.surgeryMonth': '同上',
      'history.surgeryType': '同上',
      'history.eyeClinic': '眼科通院ありのときだけ使う（土台は なし）',
      'history.age': '受付一覧に出す患者年齢。甲状腺のカルテ本文には年齢を載せない',
      'history.fh.dmWho': '家族歴 DM が (+) のときだけ誰かを書く（土台は (-)）',
      'reason.thyroidConcernReason': '「甲状腺疾患が気になって受診」のときだけ使う（土台は検診異常）',
      'reason.thyroidConcernNote': '同上',
      // ⚠️ 列挙値の都合ではない。フォームで聴取しているのにカルテに出ていない
      'body.weight20': '⚠️ 甲状腺フォームは 20歳時体重・最大体重 を聴取するがカルテには出していない（旧プロンプトから同じ。出すかどうかは院長判断）',
      'body.weightMax': '⚠️ 同上',
      'body.weightMaxAge': '⚠️ 同上',
      'body.doctorGender': '「指定なし」以外のときだけ申し送りに1行出る列挙値',
      'body.patientFlag': '「○患者疑い」「●患者疑い」のときだけ分岐する列挙値',
      'echo.hasNodule': '「あり」のときだけ結節所見行を出す列挙値',
      'echo.thyroidSize': '腫大／萎縮 のときだけ所見に出る列挙値（正常は所見にしない）',
      'echo.thyroidBloodFlow': '同上',
      'echo.thyroidParenchyma': '同上',
      'echo.noduleCount': '「多発」のときだけ「多発結節」と書く列挙値',
      'echo.calcification': '入力があるときだけ「石灰化○○」と出る',
      'echo.noduleBloodFlow': '豊富／乏しい のときだけ出る列挙値',
      'echo.ecg': 'ECG はバセドウ初診でだけ出す（他フォームは聴取しても記載しない運用）',
      'history.diagnosisEra': 'バセドウ継続の診断時期。令和のとき R 表記に畳まれる',
    }
    const base = { ...THYROID_NODULE_FIXTURE, body: { ...THYROID_NODULE_FIXTURE.body, doubleSlot: true } }
    const paths = leafPaths(base)
    const neverUsed = paths.filter(p =>
      THY.every(f => unreferencedPaths(f, base, [p]).length === 1))
    const unexpected = neverUsed.filter(p => !(p in allowedThyroid))
    assert.deepEqual(unexpected, [],
      '甲状腺: どのフォームからも見えないフィールドがある = 情報が黙って落ちている')
  })

  // DM差分問診（採血で DM 判明後の追加聴取）も同じ検査にかける
  test('DM差分問診: 聴取した項目が全てカルテに出る', () => {
    const allowedDmDiff = {
      'dmDiff.completed': '差分問診を入力したかのフラグ（false なら DM ブロックごと出ない）',
      'dmDiff.diabetesOnsetUnknown': '発症時期不明のときだけ年を伏せる',
      'dmDiff.eyeFundusCheck': '受けていない／今後受ける予定 で分岐する列挙値',
      'dmDiff.eyeNotebook': '「持っていない」のときだけ申し送りに出る列挙値',
      'dmDiff.weightLoss': '「あり（3kg以上）」のときだけ申し送りに出る列挙値',
      'dmDiff.insulinUse': 'インスリン使用の有無。SAS/HTHL/RH/内分泌 では療養計画書の分岐に使っていない',
      'dmDiff.fhDm': '家族歴 DM。【FH】に (+) として畳まれる真偽値',
      'dmDiff.fhHl': '同上（HL）',
      'dmDiff.importantPast.gastricCancer': '該当時だけ ♯行になる真偽値',
      'dmDiff.importantPast.pancreasCancer': '同上',
      'dmDiff.importantPast.stroke': '同上',
      'dmDiff.retinopathy': '眼底検査を受けている場合だけ【眼科通院歴】に出る',
      'dmDiff.eyeClinic': '同上',
    }
    for (const [formType, data] of [
      ['睡眠時無呼吸症候群', SAS_WITH_DM_DIFF],
      ['高血圧・脂質異常症', HTHL_WITH_DM_DIFF],
      ['反応性低血糖', RH_WITH_DM_DIFF],
      ['内分泌', ENDOCRINE_WITH_DM_DIFF],
    ]) {
      const base = structuredClone(data)
      const paths = leafPaths(base).filter(p => p.startsWith('dmDiff.'))
      const unexpected = unreferencedPaths(formType, base, paths).filter(p => !(p in allowedDmDiff))
      assert.deepEqual(unexpected, [],
        `${formType}: DM差分問診で聴取したのにカルテに出ない項目がある`)
    }
  })
})

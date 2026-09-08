// カルテ生成の検証用 模擬 form_data（14 フォーム × 5 例 = 70 例）
//
// ⚠️ **実在の患者データは絶対に置かない。全て架空。**
//    病院名は上尾市周辺の実在名を使うが、患者の属性・経過は全て創作。
//
// 5 例の内訳（voice 側の 59 ケース設計に倣う。長さでなく「入力の壊れ方」で攻める）:
//   1. 最小     … ほぼ未入力（時間切れで聞けなかった回）。空欄・undefined・NaN が出ないか
//   2. 標準     … 典型的な初診
//   3. 複雑     … 併存疾患多数・重要既往複数・他院管理多数・高齢（ワクチン/子供の状況）
//   4. 難渋     … 「その他」多用・自由記述に話し言葉・矛盾入力・記号や長文の混入
//   5. 分岐     … そのフォーム固有の条件分岐（dmConcern / 障害年金 / 糖尿病合併妊娠 / PSG検査 / 結節 …）
//
// 実行: npm run eval

// ── 空の form_data（各フォームの initialData 相当）────────────────
// ★ここは必ず components/*IntakeTool.js の initialData から起こすこと。
//   実データと形が違うと「テストは通るのに本番で落ちる」（2026-09-06・09-07 に 2 回発生）
const emptyAlcohol = () => ({ type: '', amount: '', freq: '' })
const emptyOther = () => ({ name: '', hospital: '', hospitalOther: '', dept: '' })
const emptyVoice = () => ({
  voiceMemo: { transcript: '', aiSummary: '', needsDoctorReview: false },
  voicePastHistory: { transcript: '', aiSummary: '', needsDoctorReview: false },
})
const emptyBody = () => ({
  height: '', weightNow: '', weight20: '', weightMax: '', weightMaxAge: '',
  concern: '', preferredDays: [], doctorGender: '', patientFlag: '通常', doubleSlot: false,
})
const emptyLifestyleKeys = () => ({
  livingSpouse: '', livingOther: [], livingCustom: '',
  childInfo: '', childLocation: '', childGender: [],
  work: 'していない', job: [], jobNote: '', activity: '',
})
const emptyHistoryCommon = () => ({
  age: '', allergy: 'なし', allergyDetail: '',
  alcoholNone: false, alcoholItems: [emptyAlcohol()],
  smoking: 'なし', smokingAmount: '', smokingYears: '', smokingStartAge: '',
  smokingQuitEra: '令和', smokingQuitYear: '',
  checkup: [], vaccine65Prevena: '', vaccine65Herpes: '',
})
const emptyDetailBox = () => ({
  selected: false, surgeryType: '', resection: '', surgeryEra: '平成', surgeryYear: '',
  surgeryUnknown: false, treatedHospital: '', treatedHospitalOther: '',
  visitingHospital: '', visitingHospitalOther: '', visitFreq: '', meds: '',
})

export const EMPTY = {
  'DM基本': () => ({
    ...emptyVoice(),
    alert: { weightLoss: '' },
    reason: {
      type: '', referralFrom: '', referralDept: '', referralQuickSelect: false,
      referralDetail: '', transferFrom: '', transferDetail: '', checkupType: '',
      dmConcern: false, dmConcernReason: '', dmConcernNote: '', summary: '',
    },
    disease: {
      dmOnsetEra: '令和', dmOnset: '', dmOnsetUnknown: false,
      ht: false, hl: false, insulinUse: false,
      gastricCancer: emptyDetailBox(), pancreasCancer: emptyDetailBox(),
      ihd: { ...emptyDetailBox(), treatment: '' }, stroke: emptyDetailBox(),
      echoNeck: '', echoAbdomen: '',
      otherDiseases: [emptyOther()],
      dmSymptoms: { selected: [], otherText: '' },
    },
    history: {
      ...emptyHistoryCommon(),
      fh: { dm: false, dmWho: [], ht: false, apo: false, ihd: false },
      eye: '', eyeVisiting: '', eyeFundusCheck: '', eyeNotebook: '',
    },
    lifestyle: emptyLifestyleKeys(),
    body: emptyBody(),
  }),

  '1型糖尿病': () => ({
    ...emptyVoice(),
    alert: { weightLoss: '' },
    reason: {
      type: '', referralFrom: '', referralDept: '', referralQuickSelect: false,
      referralDetail: '', transferFrom: '', transferDetail: '', checkupType: '',
      cgmCurrent: '', cgmWish: '', pumpCurrent: '', pumpWish: '', deviceWish: [], summary: '',
    },
    disease: {
      dm1type: '', dmOnsetEra: '令和', dmOnset: '', dmOnsetUnknown: false,
      ht: false, hl: false, thyroidChecked: false,
      pensionStatus: '', pensionKosei: '', pensionPossibility: '', insulinStatus: '',
      dmSymptoms: { selected: [], otherText: '' },
    },
    history: {
      ...emptyHistoryCommon(), ...emptyLifestyleKeys(),
      fh: { dm: false, dmWho: [], ht: false, apo: false, ihd: false },
      eye: '', eyeVisiting: '', eyeFundusCheck: '', eyeNotebook: '',
      otherDiseases: [emptyOther()],
    },
    body: emptyBody(),
  }),

  '小児1型糖尿病': () => ({
    ...emptyVoice(),
    reason: {
      type: '', referralFrom: '', referralDept: '', referralQuickSelect: false,
      referralDetail: '', transferFrom: '', transferDetail: '', summary: '',
    },
    disease: {
      dm1type: '', dmOnsetEra: '令和', dmOnset: '', dmOnsetUnknown: false,
      ht: false, hl: false, thyroidChecked: false, bakusmi: '', insulinStatus: '',
      dmSymptoms: { selected: [], otherText: '' },
    },
    support: {
      familyMain: '', familySubList: [], familyNote: '', schoolStaff: [],
      schoolSupportPerson: [], schoolSupportNote: '', disclosedChild: '', disclosedTeacher: '',
      childGrade: '', childActivities: [], childActivityNote: '',
      parentWorkMain: [], parentWorkMainNote: '', parentWorkSub: [], parentWorkSubNote: '',
      independenceLevel: '', independenceNote: '',
    },
    chronic: {
      status: '', birthWeight: '', birthWeek: '', birthWeekDay: '', birthCity: '',
      booklets: [], documents: [], residenceCity: '', paymentConfirmed: '', maternalHandbook: '',
    },
    history: {
      allergy: 'なし', allergyDetail: '',
      fh: { dm: false, dmWho: [], dm1: false, dm1Who: [], collagen: false, collagenItems: [{ who: '', disease: '' }], ht: false, apo: false, ihd: false },
      eye: '', eyeVisiting: '', eyeFundusCheck: '', eyeNotebook: '',
      livingSpouse: '', livingOther: [], livingCustom: '', keyPerson: '',
      otherDiseases: [emptyOther()],
    },
    body: { height: '', weightNow: '', concern: '', preferredDays: [], doctorGender: '', patientFlag: '通常', doubleSlot: false },
  }),

  '高血圧・脂質異常症': () => ({
    ...emptyVoice(),
    reason: {
      type: '', referralFrom: '', referralDept: '', referralQuickSelect: false,
      referralDetail: '', transferFrom: '', transferDetail: '', checkupType: '',
      concern: false, concernType: '', summary: '',
    },
    disease: { igt: false, ht: false, hl: false, echoNeck: '', echoAbdomen: '', otherDisease: '', otherDiseases: [emptyOther()] },
    history: {
      ...emptyHistoryCommon(), ...emptyLifestyleKeys(),
      fh: { dm: false, dmWho: [], ht: false, hl: false, apo: false, ihd: false },
    },
    body: emptyBody(),
  }),

  '内分泌': () => ({
    ...emptyVoice(),
    reason: {
      type: '', referralFrom: '', referralDept: '', referralQuickSelect: false,
      referralDetail: '', transferFrom: '', transferDetail: '', checkupType: '',
      concern: false, concernType: '', summary: '',
    },
    disease: {
      echoNeck: '', echoAbdomen: '', otherDisease: '', otherDiseases: [emptyOther()],
      carePlanDiseases: { dm: false, ht: false, hl: false },
    },
    history: {
      ...emptyHistoryCommon(), ...emptyLifestyleKeys(),
      fh: { dm: false, dmWho: [], ht: false, hl: false, apo: false, ihd: false },
      fhOthers: [{ who: '', disease: '' }],
    },
    body: emptyBody(),
  }),

  '妊娠糖尿病': () => ({
    ...emptyVoice(),
    reason: {
      type: '', referralFrom: '', referralDept: '', referralQuickSelect: false,
      referralDetail: '', transferFrom: '', transferDetail: '', checkupType: '', summary: '',
    },
    disease: {
      dmType: '', pastGDM: '',
      pastGDMChild: [{ era: '令和', year: '', had: '' }, { era: '令和', year: '', had: '' }, { era: '令和', year: '', had: '' }],
      currentWeek: '', dueDateEra: '令和', dueDateYear: '', dueDateMonth: '',
      obHospital: '', obHospitalOther: '', ht: false, hl: false, echoNeck: '', echoAbdomen: '',
    },
    history: {
      allergy: 'なし', allergyDetail: '',
      fh: { dm: false, dmWho: [], ht: false, apo: false, ihd: false },
      smoking: 'なし', smokingAmount: '', smokingYears: '', smokingStartAge: '',
      smokingQuitEra: '令和', smokingQuitYear: '',
      eye: '', eyeVisiting: '', eyeFundusCheck: '', eyeNotebook: '',
      livingSpouse: '', livingOther: [], livingCustom: '',
      work: 'していない', job: [], jobNote: '', activity: '',
      otherDiseases: [emptyOther()],
    },
    body: { ...emptyBody(), weightPregnancy: '' },
  }),

  '反応性低血糖': () => ({
    ...emptyVoice(),
    symptom: {
      timing: [], timingNote: '', cause: [], causeNote: '', symptoms: [], symptomsNote: '',
      libreStarted: '', libreNote: '', cgmWish: '',
    },
    history: {
      ...emptyHistoryCommon(), ...emptyLifestyleKeys(),
      fh: { dm: false, dmWho: [], ht: false, hl: false, apo: false, ihd: false },
      otherDiseases: [emptyOther()],
    },
    body: emptyBody(),
  }),

  '睡眠時無呼吸症候群': () => ({
    ...emptyVoice(),
    reason: {
      purposes: [], purposeOther: '', currentClinic: '', sasCategory: '',
      cpapPriorRecordsConfirmed: false, cpapPriorClinic: '',
      knowSource: [], knowSourceOther: '', summary: '',
    },
    symptom: { sasSymptoms: { selected: [], otherText: '' } },
    disease: { ht: false, hl: false, igt: false, otherDiseases: [emptyOther()], echoNeck: '', echoAbdomen: '' },
    history: {
      ...emptyHistoryCommon(), ...emptyLifestyleKeys(),
      fh: { dm: false, dmWho: [], ht: false, hl: false, apo: false, ihd: false },
    },
    body: emptyBody(),
    dmDiff: { completed: false },
  }),

  '甲状腺': () => ({
    reason: {
      summary: '', type: '', referralFrom: '', referralDept: '', referralDetail: '',
      checkupType: '', transferFrom: '', transferDetail: '',
      thyroidConcern: false, thyroidConcernReason: [], thyroidConcernNote: '',
    },
    echo: {
      thyroidSize: '', thyroidBloodFlow: '', thyroidParenchyma: '', ecg: '',
      hasNodule: '', noduleLocation: '', noduleSizeW: '', noduleSizeD: '',
      noduleCount: '', calcification: '', noduleBloodFlow: '', noduleType: '', noduleOther: '',
    },
    symptom: { selected: [], otherText: '' },
    history: {
      surgeryHistory: false, surgeryYear: '', surgeryMonth: '', surgeryType: '',
      isotopeHistory: false, sideEffectMmz: false, sideEffectPtz: false,
      eyeHistory: false, eyeClinic: '', treatmentHistory: '',
      diagnosisEra: '令和', diagnosisYear: '', diagnosisMonth: '', medications: [],
      age: '', allergy: 'なし', allergyDetail: '',
      fh: { thyroid: false, thyroidWho: [], dm: false, dmWho: [] },
      smoking: 'なし', smokingAmount: '', smokingYears: '', smokingStartAge: '',
      smokingQuitEra: '令和', smokingQuitYear: '',
      checkup: [], work: 'していない', job: [], jobNote: '', activity: '',
    },
    body: emptyBody(),
  }),
}

// 深いマージ（配列は置換）
function merge(base, patch) {
  const out = Array.isArray(base) ? [...base] : { ...base }
  for (const [k, v] of Object.entries(patch || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base?.[k] && typeof base[k] === 'object' && !Array.isArray(base[k])
      ? merge(base[k], v)
      : v
  }
  return out
}
const build = (form, patch) => merge(EMPTY[form](), patch)

// ── 共通の部品 ──────────────────────────────────────────
const LIFE_STD = {
  livingSpouse: '配偶者あり', livingOther: ['息子と同居'], livingCustom: '',
  work: 'している', job: ['会社員（デスクワーク）'], jobNote: '', activity: '座っていることが多い',
}
const HIST_STD = {
  age: '58', allergy: 'なし', allergyDetail: '',
  alcoholNone: false, alcoholItems: [{ type: 'beer', amount: '350mL', freq: '週3回' }],
  smoking: 'なし', checkup: ['市の健診'],
}
const BODY_STD = {
  height: '170', weightNow: '72', weight20: '62', weightMax: '78', weightMaxAge: '48',
  concern: 'なるべく薬を増やしたくない', preferredDays: ['水'], doctorGender: '指定なし',
}
// 難渋: 話し言葉・矛盾・記号混入・長文
const FREE_TEXT_MESSY =
  '3年くらい前から健診でずっと血糖が高いと言われてて、去年の秋に一度近所の内科にかかったんですが、'
  + '薬をもらったのに2〜3ヶ月で自己中断してしまいました。最近また体がだるくて…（※本人は「甘いものはやめられない」と）'

// ══════════════════════════════════════════════════════════
export const CASES = []
const add = (form, kind, title, data, note) => CASES.push({ id: `${form}/${kind}`, form, kind, title, data, note })

// ── DM基本 ────────────────────────────────────────────────
add('DM基本', '最小', 'ほぼ未入力（時間切れ）', build('DM基本', {}))
add('DM基本', '標準', '紹介・2型・HTあり', build('DM基本', {
  alert: { weightLoss: 'なし' },
  reason: { type: '紹介', referralFrom: '上尾中央総合病院', referralDept: '糖尿病内科', referralDetail: '安定していたため当院へ' },
  disease: {
    dmOnsetEra: '令和', dmOnset: '3', ht: true, insulinUse: false,
    echoNeck: '行っていない', echoAbdomen: '行っていない',
    otherDiseases: [{ name: '慢性腎臓病', hospital: '上尾中央総合病院', hospitalOther: '', dept: '腎臓内科' }],
    dmSymptoms: { selected: ['のどが渇く', '足のしびれ'], otherText: '' },
  },
  history: { ...HIST_STD, fh: { dm: true, dmWho: ['母'], ht: true, apo: false, ihd: false }, eyeFundusCheck: '受けている', eye: '上尾こいけ眼科', retinopathy: '網膜症なし', glaucoma: '緑内障なし', eyeNotebook: '持っている' },
  lifestyle: LIFE_STD,
  body: BODY_STD,
}))
add('DM基本', '複雑', '80歳・重要既往3つ・他院管理4つ・インスリン中', build('DM基本', {
  alert: { weightLoss: 'あり' },
  reason: { type: '自主転院', transferFrom: 'あげお内科クリニック', transferDetail: '転居のため' },
  disease: {
    dmOnsetEra: '平成', dmOnset: '20', ht: true, hl: true, insulinUse: true,
    gastricCancer: { selected: true, surgeryType: '手術＋抗がん剤', resection: '幽門側胃切除', surgeryEra: '平成', surgeryYear: '26', treatedHospital: '埼玉県立がんセンター', visitingHospital: '上尾中央総合病院', visitFreq: '半年に1回', meds: 'タケキャブ' },
    ihd: { selected: true, treatment: 'PCI（カテーテル治療）', surgeryEra: '令和', surgeryYear: '2', treatedHospital: '自治医大さいたま医療センター', visitingHospital: 'その他', visitingHospitalOther: 'あげお循環器クリニック', visitFreq: '3ヶ月に1回', meds: 'バイアスピリン・クロピドグレル' },
    stroke: { selected: true, surgeryUnknown: true, treatedHospital: 'さいたま赤十字病院', visitingHospital: '通院なし', meds: '' },
    echoNeck: '希望なし', echoAbdomen: '他院で施行済',
    otherDiseases: [
      { name: '慢性腎臓病', hospital: '上尾中央総合病院', hospitalOther: '', dept: '腎臓内科' },
      { name: '心房細動', hospital: 'その他', hospitalOther: 'あげお循環器クリニック', dept: '' },
      { name: '前立腺肥大症', hospital: '加藤泌尿器科', hospitalOther: '', dept: '' },
      { name: '白内障', hospital: '通院なし', hospitalOther: '', dept: '' },
    ],
    dmSymptoms: { selected: ['のどが渇く', '尿の回数が多い', '体がだるい', '足のしびれ', 'その他'], otherText: '夜間に3回起きる' },
  },
  history: {
    age: '80', allergy: 'あり', allergyDetail: 'ペニシリン・造影剤',
    fh: { dm: true, dmWho: ['母', '兄弟'], ht: true, apo: false, ihd: true },
    alcoholNone: true, smoking: '禁煙済', smokingAmount: '20', smokingYears: '40', smokingStartAge: '20', smokingQuitEra: '平成', smokingQuitYear: '25',
    checkup: ['市の健診', '人間ドック'], vaccine65Prevena: '接種済', vaccine65Herpes: '希望あり',
    eyeFundusCheck: '受けている', eye: 'あげお眼科', retinopathy: '増殖前網膜症', glaucoma: '緑内障あり', eyeNotebook: '持っていない',
  },
  lifestyle: { livingSpouse: '配偶者なし', livingOther: [], livingCustom: '一人暮らし', childLocation: '遠方', childGender: ['息子', '娘'], childInfo: '月1回来訪', work: 'していない', job: [], activity: '座っていることが多い' },
  body: { height: '158', weightNow: '48', weight20: '60', weightMax: '68', weightMaxAge: '55', concern: '注射の回数を減らしたい', preferredDays: ['火', '木'], doctorGender: '女性医師希望', patientFlag: '○患者疑い（話が長い方）', doubleSlot: true },
}))
add('DM基本', '難渋', '「その他」多用・話し言葉の自由記入・矛盾入力', build('DM基本', {
  // 矛盾: 体重減少「不明」なのに症状は多数 / 眼底は未入力なのに眼科名だけ入っている
  alert: { weightLoss: '不明' },
  reason: { type: '検診異常', checkupType: '職場健診', dmConcern: true, dmConcernReason: '家族に糖尿病の方がいる', dmConcernNote: '母と祖母が糖尿病でした', summary: FREE_TEXT_MESSY },
  disease: {
    dmOnsetUnknown: true, dmOnsetEra: '令和', dmOnset: '5',  // 不明チェック＋年も入っている
    ht: false, hl: true, insulinUse: false,
    echoNeck: '', echoAbdomen: '',
    otherDiseases: [
      { name: '子宮筋腫', hospital: 'その他', hospitalOther: '鰐坂医院', dept: '' },
      { name: 'うつ病・不眠症', hospital: 'その他', hospitalOther: '', dept: '' },  // その他だが病院名が空
      { name: '', hospital: '上尾中央総合病院', hospitalOther: '', dept: '循環器内科' },  // 病名だけ空
    ],
    dmSymptoms: { selected: ['その他'], otherText: '' },  // その他だけ選んで自由記入が空
  },
  history: {
    age: '61', allergy: 'あり', allergyDetail: '花粉・金属',  // 薬剤アレルギーではない
    fh: { dm: false, dmWho: ['母'], ht: false, apo: false, ihd: false },  // 矛盾: dm=false なのに dmWho あり
    alcoholNone: false, alcoholItems: [{ type: 'shochu', amount: '', freq: '毎日' }, { type: '', amount: '2合', freq: '' }],
    smoking: '禁煙済', smokingAmount: '', smokingYears: '', smokingStartAge: '', smokingQuitEra: '', smokingQuitYear: '',
    checkup: [], vaccine65Prevena: '', vaccine65Herpes: '希望なし',
    eye: 'あげお眼科', eyeFundusCheck: '', retinopathy: '不明', eyeNotebook: '持っていない',
  },
  lifestyle: { livingSpouse: '配偶者あり', livingOther: ['子供と同居なし'], livingCustom: '＜＞&"\'記号テスト', work: 'している', job: ['その他'], jobNote: '夜勤あり／週4', activity: '立っていることが多い' },
  body: { height: '0', weightNow: '', weight20: '58', weightMax: '', weightMaxAge: '', concern: '', preferredDays: ['指定なし'], doctorGender: '院長（初回のみ）', patientFlag: '●患者疑い（出禁対象）' },
}))
add('DM基本', '分岐', '「糖尿病か気になる」受診（検査前の暫定診断）', build('DM基本', {
  alert: { weightLoss: 'なし' },
  reason: { dmConcern: true, dmConcernReason: '健診で血糖が高いと言われた' },
  disease: { ht: false, hl: false, insulinUse: false, echoNeck: '行っていない', echoAbdomen: '行っていない' },
  history: { ...HIST_STD, age: '45', fh: { dm: false, dmWho: [], ht: false, apo: false, ihd: false }, eyeFundusCheck: '今後受ける予定' },
  lifestyle: LIFE_STD,
  body: { ...BODY_STD, concern: '' },
}))

// ── 1型糖尿病 ─────────────────────────────────────────────
add('1型糖尿病', '最小', 'ほぼ未入力', build('1型糖尿病', {}))
add('1型糖尿病', '標準', '急性発症・インスリン中・CGM継続', build('1型糖尿病', {
  alert: { weightLoss: 'なし' },
  reason: { type: '紹介', referralFrom: '自治医大さいたま医療センター', referralDept: '糖尿病内科', referralDetail: '専門的管理のため', cgmCurrent: 'フリースタイルリブレ', cgmWish: 'フリースタイルリブレ', pumpCurrent: '使用していない', pumpWish: '希望なし' },
  disease: { dm1type: '急性発症', dmOnsetEra: '令和', dmOnset: '4', thyroidChecked: true, pensionKosei: 'いいえ（未加入）', pensionStatus: '未申請', insulinStatus: 'インスリン使用中', dmSymptoms: { selected: ['体がだるい'], otherText: '' } },
  history: { ...HIST_STD, ...LIFE_STD, age: '34', fh: { dm: false, dmWho: [], ht: false, apo: false, ihd: false }, eyeFundusCheck: '受けている', eye: 'あげお眼科', retinopathy: '網膜症なし', eyeNotebook: '持っている', otherDiseases: [emptyOther()] },
  body: { ...BODY_STD, height: '162', weightNow: '52', concern: '' },
}))
add('1型糖尿病', '複雑', '緩徐進行・障害年金該当・ポンプ希望・甲状腺併存', build('1型糖尿病', {
  alert: { weightLoss: 'あり' },
  reason: { type: '自主転院', transferFrom: 'さいたま赤十字病院', transferDetail: 'より専門的な治療を希望', cgmCurrent: 'Dexcom G7', cgmWish: 'Dexcom G7', pumpCurrent: '使用していない', pumpWish: 'ミニメド' },
  disease: { dm1type: '緩徐進行性（SPIDDM）', dmOnsetEra: '平成', dmOnset: '28', thyroidChecked: false, pensionKosei: 'はい（加入していた）', pensionStatus: '未申請', insulinStatus: 'インスリン使用中', ht: true, hl: true, dmSymptoms: { selected: ['体がだるい', '手のしびれ', '足のしびれ'], otherText: '' } },
  history: {
    age: '52', allergy: 'あり', allergyDetail: 'ヨード造影剤',
    fh: { dm: true, dmWho: ['母'], ht: true, apo: false, ihd: false },
    alcoholNone: true, smoking: 'なし', checkup: ['市の健診'],
    eyeFundusCheck: '受けている', eye: '上尾こいけ眼科', retinopathy: '単純性網膜症', glaucoma: '緑内障なし', eyeNotebook: '持っていない',
    livingSpouse: '配偶者あり', livingOther: [], work: 'している', job: ['会社員（デスクワーク）'], activity: '座っていることが多い',
    otherDiseases: [
      { name: '橋本病', hospital: 'その他', hospitalOther: 'あげお甲状腺クリニック', dept: '' },
      { name: '関節リウマチ', hospital: '上尾中央総合病院', hospitalOther: '', dept: 'その他' },
    ],
  },
  body: { height: '155', weightNow: '44', weight20: '52', weightMax: '58', weightMaxAge: '40', concern: 'ポンプについて相談したい', preferredDays: ['金'], doctorGender: '男性医師希望', doubleSlot: true },
}))
add('1型糖尿病', '難渋', '発症時期不明・年金判定が不定・デバイス相談', build('1型糖尿病', {
  alert: { weightLoss: '不明' },
  reason: { type: '', cgmCurrent: '使用していない', cgmWish: '先生と相談したい', pumpCurrent: '使用していない', pumpWish: '先生と相談したい', summary: '前の病院の紹介状は「後で郵送します」と言われて持ってきていません。とりあえず来ました。' },
  disease: { dm1type: '不明', dmOnsetUnknown: true, thyroidChecked: false, pensionKosei: '', pensionStatus: '', insulinStatus: '', dmSymptoms: { selected: ['その他'], otherText: 'ときどき低血糖で意識が飛ぶ' } },
  history: { age: '', allergy: 'なし', fh: { dm: false, dmWho: [], ht: false, apo: false, ihd: false }, alcoholNone: false, alcoholItems: [emptyAlcohol()], smoking: 'あり', smokingAmount: '10', smokingYears: '', smokingStartAge: '', eyeFundusCheck: '受けていない', eyeNotebook: '持っていない', work: 'していない', activity: '', otherDiseases: [emptyOther()] },
  body: { ...emptyBody(), height: '', weightNow: '', preferredDays: [] },
}))
add('1型糖尿病', '分岐', '厚生年金加入あり・受給中（→ 申し送りを出さない）', build('1型糖尿病', {
  alert: { weightLoss: 'なし' },
  reason: { type: '紹介', referralFrom: '上尾中央総合病院', referralDept: '糖尿病内科', referralDetail: '安定していたため当院へ', cgmWish: '希望なし', pumpWish: '希望なし' },
  disease: { dm1type: '激症1型', dmOnsetEra: '令和', dmOnset: '1', thyroidChecked: true, pensionKosei: 'はい（加入していた）', pensionStatus: '受給中', insulinStatus: 'インスリン使用中' },
  history: { ...HIST_STD, ...LIFE_STD, age: '47', fh: { dm: false, dmWho: [], ht: false, apo: false, ihd: false }, eyeFundusCheck: '受けている', eye: 'あげお眼科', retinopathy: '網膜症なし', eyeNotebook: '持っている', otherDiseases: [emptyOther()] },
  body: BODY_STD,
}))

// ── 小児1型糖尿病 ─────────────────────────────────────────
add('小児1型糖尿病', '最小', 'ほぼ未入力', build('小児1型糖尿病', {}))
add('小児1型糖尿病', '標準', '小5・申請済・学校連携あり', build('小児1型糖尿病', {
  reason: { type: '紹介', referralFrom: '自治医大さいたま医療センター', referralDept: 'その他', referralDetail: '専門的管理のため' },
  disease: { dm1type: '急性発症', dmOnsetEra: '令和', dmOnset: '5', bakusmi: '希望あり', insulinStatus: 'インスリン使用中', thyroidChecked: true, dmSymptoms: { selected: ['のどが渇く', '尿の回数が多い'], otherText: '' } },
  support: { familyMain: '母', familySubList: ['父'], schoolStaff: ['担任・養護教諭が連携'], schoolSupportPerson: ['担任', '養護教諭'], disclosedChild: '一部の友人のみ', disclosedTeacher: '担任＋養護教諭', childGrade: '小5', childActivities: ['運動系部活'], parentWorkMain: ['パート（午前）'], parentWorkSub: ['会社員'], independenceLevel: '親の補助あり', independenceNote: '注射は自己、測定は親が確認' },
  chronic: { status: '申請済', residenceCity: '上尾市', maternalHandbook: '持ってきた', paymentConfirmed: '窓口負担なし（公費）', documents: ['学校生活管理指導表', '糖尿病緊急対応連絡票'] },
  history: { allergy: 'なし', fh: { dm: false, dmWho: [], dm1: false, dm1Who: [], collagen: false, collagenItems: [{ who: '', disease: '' }], ht: false, apo: false, ihd: false }, eyeFundusCheck: '受けていない', eyeNotebook: '持っていない', livingSpouse: '配偶者あり', livingOther: [], keyPerson: '母', otherDiseases: [emptyOther()] },
  body: { height: '142', weightNow: '35', concern: '学校の対応を相談したい', preferredDays: ['土'], doctorGender: '指定なし' },
}))
add('小児1型糖尿病', '複雑', '中3・申請中（出生情報あり）・家族歴多数・母子手帳忘れ', build('小児1型糖尿病', {
  reason: { type: '検診異常', referralDetail: '' },
  disease: { dm1type: '激症1型', dmOnsetEra: '令和', dmOnset: '7', ht: true, hl: true, bakusmi: '希望あり', insulinStatus: 'インスリン使用中', dmSymptoms: { selected: ['のどが渇く', '体がだるい', 'その他'], otherText: '部活中にふらつく' } },
  support: { familyMain: '両親', familySubList: ['祖母', '兄弟・姉妹'], familyNote: '祖母が近居', schoolStaff: ['担任が対応', '保健室で血糖測定可', '緊急時対応マニュアルあり'], schoolSupportPerson: ['担任', '部活顧問'], schoolSupportNote: '部活中は顧問が確認', disclosedChild: 'クラス全体に話している', disclosedTeacher: '全職員', childGrade: '中3', childActivities: ['運動系部活', '学習塾'], childActivityNote: '平日は21時帰宅', parentWorkMain: ['フルタイム勤務'], parentWorkMainNote: '日勤のみ', parentWorkSub: ['単身赴任中'], independenceLevel: '本人が自己管理' },
  chronic: { status: '申請中', birthWeight: '2450', birthWeek: '36', birthWeekDay: '4', birthCity: 'その他', birthCityOther: '熊谷市', booklets: ['養育手帳'], residenceCity: 'さいたま市', maternalHandbook: '忘れた', documents: ['学校生活管理指導表', 'バクスミーに関する指示書'] },
  history: {
    allergy: 'あり', allergyDetail: '卵・ペニシリン',
    fh: { dm: true, dmWho: ['父'], dm1: true, dm1Who: ['姉'], collagen: true, collagenItems: [{ who: '母', disease: '橋本病' }, { who: '祖母', disease: '関節リウマチ' }], ht: true, apo: false, ihd: false },
    eyeFundusCheck: '受けている', eye: '上尾こいけ眼科', retinopathy: '網膜症なし', eyeNotebook: '持っている',
    livingSpouse: '配偶者あり', livingOther: ['祖母と同居'], keyPerson: '母',
    otherDiseases: [{ name: '気管支喘息', hospital: 'その他', hospitalOther: 'こぐち内科呼吸器クリニック', dept: '' }],
  },
  body: { height: '168', weightNow: '52', concern: '', preferredDays: ['土'], doctorGender: '女性医師希望', patientFlag: '通常', doubleSlot: true },
}))
add('小児1型糖尿病', '難渋', '申請未・書類なし・開示していない・空欄多数', build('小児1型糖尿病', {
  reason: { type: '', summary: 'お母さんが「学校に言いたくない」と強く希望されています' },
  disease: { dm1type: '', dmOnsetUnknown: true, bakusmi: '希望なし', insulinStatus: '', dmSymptoms: { selected: [], otherText: '書き忘れ' } },
  support: { familyMain: 'その他', familySubList: [], familyNote: '', schoolStaff: [], schoolSupportPerson: ['その他'], disclosedChild: '話していない', disclosedTeacher: '話していない', childGrade: '', childActivities: ['なし'], parentWorkMain: [], parentWorkSub: [], independenceLevel: '' },
  chronic: { status: '申請未', birthWeight: '', birthWeek: '', birthCity: '', booklets: [], residenceCity: 'その他', maternalHandbook: '', documents: [] },
  history: { allergy: 'なし', fh: { dm: false, dmWho: [], dm1: false, dm1Who: [], collagen: false, collagenItems: [{ who: '', disease: '' }], ht: false, apo: false, ihd: false }, eyeFundusCheck: '', eyeNotebook: '', livingSpouse: '', livingOther: [], keyPerson: '', otherDiseases: [{ name: 'てんかん', hospital: '', hospitalOther: '', dept: '' }] },
  body: { height: '', weightNow: '', concern: '', preferredDays: [], doctorGender: '' },
}))
add('小児1型糖尿病', '分岐', 'HT/HL 併存（＃は1型の直後・末尾に出さない）', build('小児1型糖尿病', {
  reason: { type: '紹介', referralFrom: 'さいたま赤十字病院', referralDept: 'その他' },
  disease: { dm1type: '急性発症', dmOnsetEra: '令和', dmOnset: '6', ht: true, hl: true, bakusmi: '希望なし', thyroidChecked: true, insulinStatus: 'インスリン使用中' },
  support: { familyMain: '母', disclosedChild: '一部の友人のみ', disclosedTeacher: '担任のみ', childGrade: '小3', independenceLevel: 'ほぼ親が実施' },
  chronic: { status: '申請済', residenceCity: '桶川市', maternalHandbook: '持ってきた', paymentConfirmed: '不明', documents: [] },
  history: { allergy: 'なし', fh: { dm: false, dmWho: [], dm1: false, dm1Who: [], collagen: false, collagenItems: [{ who: '', disease: '' }], ht: false, apo: false, ihd: false }, eyeFundusCheck: '今後受ける予定', eyeNotebook: '持っている', livingSpouse: '配偶者あり', livingOther: [], keyPerson: '父', otherDiseases: [emptyOther()] },
  body: { height: '128', weightNow: '26', concern: 'なし', preferredDays: ['水'], doctorGender: '指定なし' },
}))

// ── 高血圧・脂質異常症 ────────────────────────────────────
add('高血圧・脂質異常症', '最小', 'ほぼ未入力', build('高血圧・脂質異常症', {}))
add('高血圧・脂質異常症', '標準', '健診異常・HT/HL', build('高血圧・脂質異常症', {
  reason: { type: '検診異常', checkupType: '市の健診' },
  disease: { ht: true, hl: true, echoNeck: '行っていない', echoAbdomen: '希望あり', otherDiseases: [emptyOther()] },
  history: { ...HIST_STD, ...LIFE_STD, fh: { dm: false, dmWho: [], ht: true, hl: true, apo: false, ihd: false } },
  body: BODY_STD,
}))
add('高血圧・脂質異常症', '複雑', '75歳・他院管理多数・IGT・喫煙継続', build('高血圧・脂質異常症', {
  reason: { type: '紹介', referralFrom: '上尾中央総合病院', referralDept: '循環器内科', referralDetail: 'コントロール不良のため' },
  disease: {
    igt: true, ht: true, hl: true, echoNeck: '希望あり', echoAbdomen: '他院で施行済',
    otherDiseases: [
      { name: '慢性心不全', hospital: '上尾中央総合病院', hospitalOther: '', dept: '循環器内科' },
      { name: '慢性腎臓病', hospital: '上尾中央総合病院', hospitalOther: '', dept: '腎臓内科' },
      { name: '変形性膝関節症', hospital: 'その他', hospitalOther: 'あげお整形外科', dept: '' },
    ],
  },
  history: {
    age: '75', allergy: 'あり', allergyDetail: 'アスピリン',
    fh: { dm: true, dmWho: ['父'], ht: true, hl: true, apo: true, ihd: true },
    alcoholNone: false, alcoholItems: [{ type: 'sake', amount: '2合', freq: '毎日' }],
    smoking: 'あり', smokingAmount: '20', smokingYears: '55', smokingStartAge: '20',
    checkup: ['市の健診'], vaccine65Prevena: '接種済', vaccine65Herpes: '接種済',
    livingSpouse: '配偶者あり', livingOther: [], childLocation: '近居（同一市区町村）', childGender: ['娘'], childInfo: '週2回来訪',
    work: 'していない', job: [], activity: '横になっていることが多い',
  },
  body: { height: '162', weightNow: '78', weight20: '65', weightMax: '84', weightMaxAge: '60', concern: '薬が多くて飲みきれない', preferredDays: ['月'], doctorGender: '指定なし', patientFlag: '○患者疑い（話が長い方）' },
}))
add('高血圧・脂質異常症', '難渋', '「気になって受診」＋自由記入が長文・エコー未選択', build('高血圧・脂質異常症', {
  reason: { type: '', concern: true, concernType: '家族に内分泌疾患の方がいる', summary: '会社の健診で毎年ひっかかっていて、そのたびに「様子を見ましょう」と言われてきました。今回はコレステロールが去年より高いと言われたので…（本人談）' },
  disease: { ht: false, hl: false, igt: false, echoNeck: '', echoAbdomen: '', otherDisease: '（旧欄）高尿酸血症', otherDiseases: [{ name: '高尿酸血症', hospital: 'その他', hospitalOther: '', dept: '' }] },
  history: { age: '39', allergy: 'あり', allergyDetail: 'フルーツ（キウイ）', fh: { dm: false, dmWho: [], ht: false, hl: false, apo: false, ihd: false }, alcoholNone: false, alcoholItems: [{ type: 'whisky', amount: 'ダブル2杯', freq: '週5回' }], smoking: 'なし', checkup: [], work: 'している', job: ['その他'], jobNote: '交代勤務（夜勤月8回）', activity: '立っていることが多い', livingSpouse: '', livingOther: [] },
  body: { height: '178', weightNow: '95', weight20: '70', weightMax: '98', weightMaxAge: '38', concern: '', preferredDays: ['指定なし'], doctorGender: '指定なし' },
}))
add('高血圧・脂質異常症', '分岐', '採血で糖尿病判明（DM差分問診あり）', build('高血圧・脂質異常症', {
  reason: { type: '検診異常', checkupType: '市の健診' },
  disease: { ht: true, hl: true, echoNeck: '行っていない', echoAbdomen: '希望あり' },
  history: { ...HIST_STD, ...LIFE_STD, age: '62', fh: { dm: true, dmWho: ['母'], ht: true, hl: false, apo: false, ihd: false } },
  body: BODY_STD,
  dmDiff: {
    completed: true, weightLoss: 'あり（3kg以上）',
    dmSymptoms: { selected: ['のどが渇く', '尿の回数が多い'], otherText: '' },
    pastHbA1c: 'R5の健診で6.4%を指摘', diabetesOnsetEra: '令和', diabetesOnsetYear: '8', diabetesOnsetUnknown: false, diabetesOnsetNote: '今回判明',
    insulinUse: false, fhDm: true, fhDmWho: ['母'], fhHl: true,
    eyeFundusCheck: '受けていない', eyeNotebook: '持っていない', eyeClinic: '', retinopathy: '不明',
    importantPast: { gastricCancer: false, pancreasCancer: false, ihd: true, stroke: false, detail: 'R2 PCI（自治医大さいたま医療センター）' },
    treatmentWish: '内服から始めたい', freeText: '',
  },
}))

// ── 内分泌 ────────────────────────────────────────────────
add('内分泌', '最小', 'ほぼ未入力', build('内分泌', {}))
add('内分泌', '標準', '紹介・家族歴自由記入あり・療養計画書なし', build('内分泌', {
  reason: { type: '紹介', referralFrom: '上尾中央総合病院', referralDept: 'その他', referralDetail: '専門的管理のため' },
  disease: { echoNeck: '希望あり', echoAbdomen: '行っていない', carePlanDiseases: { dm: false, ht: false, hl: false }, otherDiseases: [emptyOther()] },
  history: { ...HIST_STD, ...LIFE_STD, fhOthers: [{ who: '母', disease: 'バセドウ病' }], fh: { dm: false, dmWho: [], ht: false, hl: false, apo: false, ihd: false } },
  body: BODY_STD,
}))
add('内分泌', '複雑', '生活習慣病3つあり・他院管理多数・高齢', build('内分泌', {
  reason: { type: '自主転院', transferFrom: 'さいたま赤十字病院', transferDetail: '転居のため' },
  disease: {
    echoNeck: '他院で施行済', echoAbdomen: '希望あり',
    carePlanDiseases: { dm: true, ht: true, hl: true },
    otherDiseases: [
      { name: '副腎腫瘍', hospital: '自治医大さいたま医療センター', hospitalOther: '', dept: 'その他' },
      { name: '骨粗鬆症', hospital: 'その他', hospitalOther: 'あげお整形外科', dept: '' },
    ],
  },
  history: {
    age: '71', allergy: 'なし',
    fh: { dm: true, dmWho: ['母', '姉妹'], ht: true, hl: true, apo: false, ihd: false },
    fhOthers: [{ who: '母', disease: 'バセドウ病' }, { who: '姉', disease: '橋本病' }, { who: '', disease: '副甲状腺機能亢進症' }],
    alcoholNone: true, smoking: '禁煙済', smokingAmount: '15', smokingYears: '30', smokingStartAge: '25', smokingQuitEra: '平成', smokingQuitYear: '30',
    checkup: ['人間ドック'], vaccine65Prevena: '希望あり', vaccine65Herpes: 'なし',
    livingSpouse: '配偶者なし', livingOther: ['娘と同居'], childLocation: '同居', childGender: ['娘'],
    work: 'していない', job: [], activity: '座っていることが多い',
  },
  body: { height: '150', weightNow: '43', weight20: '48', weightMax: '55', weightMaxAge: '50', concern: '骨の検査もしてほしい', preferredDays: ['木'], doctorGender: '女性医師希望' },
}))
add('内分泌', '難渋', '主病名を推測させる材料だけ多い（＃を出してはいけない）', build('内分泌', {
  reason: { type: '', concern: true, concernType: '家族に内分泌疾患の方がいる', summary: '低カリウム血症と高血圧を指摘され、原発性アルドステロン症を疑われて紹介、と紹介状に書いてありました' },
  disease: { echoNeck: '', echoAbdomen: '', carePlanDiseases: { dm: false, ht: false, hl: false }, otherDisease: '（旧欄）低カリウム血症', otherDiseases: [{ name: '低カリウム血症', hospital: '', hospitalOther: '', dept: '' }] },
  history: { age: '44', allergy: 'なし', fh: { dm: false, dmWho: [], ht: true, hl: false, apo: false, ihd: false }, fhOthers: [{ who: '', disease: '' }], alcoholNone: true, smoking: 'なし', checkup: [], work: 'している', job: ['自営業'], activity: '動き回っている', livingSpouse: '配偶者あり', livingOther: [] },
  body: { height: '165', weightNow: '60', weight20: '58', weightMax: '62', weightMaxAge: '40', concern: '', preferredDays: [], doctorGender: '指定なし' },
}))
add('内分泌', '分岐', '採血で糖尿病判明（＃糖尿病だけは例外的に出す）', build('内分泌', {
  reason: { type: '紹介', referralFrom: '上尾中央総合病院', referralDept: 'その他' },
  disease: { echoNeck: '希望あり', echoAbdomen: '希望あり', carePlanDiseases: { dm: false, ht: false, hl: false } },
  history: { ...HIST_STD, ...LIFE_STD, age: '56', fhOthers: [{ who: '', disease: '' }], fh: { dm: false, dmWho: [], ht: false, hl: false, apo: false, ihd: false } },
  body: BODY_STD,
  dmDiff: {
    completed: true, weightLoss: 'なし',
    dmSymptoms: { selected: [], otherText: '' },
    pastHbA1c: '', diabetesOnsetUnknown: true, diabetesOnsetEra: '令和', diabetesOnsetYear: '',
    insulinUse: false, fhDm: false, fhDmWho: [], fhHl: false,
    eyeFundusCheck: '受けている', eyeNotebook: '持っている', eyeClinic: 'あげお眼科', retinopathy: '網膜症なし',
    importantPast: { gastricCancer: true, pancreasCancer: false, ihd: false, stroke: true, detail: 'H30 胃全摘（埼玉県立がんセンター）、R3 脳梗塞' },
    treatmentWish: '', freeText: '本人は運動から始めたいと希望',
  },
}))

// ── 妊娠糖尿病 ────────────────────────────────────────────
add('妊娠糖尿病', '最小', 'ほぼ未入力', build('妊娠糖尿病', {}))
add('妊娠糖尿病', '標準', 'GDM・26週・産科は「その他」', build('妊娠糖尿病', {
  // referralFrom は自由入力欄（「その他の病院名」がそのまま入る）。実在名を入れる
  reason: { type: '紹介', referralFrom: 'ナラヤマレディースクリニック', referralDept: '', referralDetail: '専門的管理のため' },
  disease: { dmType: '妊娠糖尿病（GDM）', pastGDM: '初めての妊娠', currentWeek: '26', dueDateEra: '令和', dueDateYear: '8', dueDateMonth: '12', obHospital: 'その他', obHospitalOther: 'ナラヤマレディースクリニック', echoNeck: '希望なし', echoAbdomen: '希望なし' },
  history: { allergy: 'なし', fh: { dm: true, dmWho: ['母'], ht: false, apo: false, ihd: false }, smoking: 'なし', eyeFundusCheck: '', livingSpouse: '配偶者あり', livingOther: [], work: 'している', job: ['会社員（デスクワーク）'], activity: '座っていることが多い', otherDiseases: [emptyOther()] },
  body: { height: '158', weightNow: '62', weightPregnancy: '54', weight20: '50', weightMax: '62', weightMaxAge: '32', concern: '食事のことが不安', preferredDays: ['火'], doctorGender: '女性医師希望' },
}))
add('妊娠糖尿病', '複雑', '糖尿病合併妊娠・過去GDM 2回・HL併存・眼底あり', build('妊娠糖尿病', {
  reason: { type: '紹介', referralFrom: '自治医大さいたま医療センター', referralDept: 'その他', referralDetail: '専門的管理のため' },
  disease: {
    dmType: '糖尿病合併妊娠', pastGDM: 'あり',
    pastGDMChild: [{ era: '令和', year: '2', had: 'あり' }, { era: '平成', year: '30', had: 'あり' }, { era: '令和', year: '', had: '' }],
    currentWeek: '14', dueDateEra: '令和', dueDateYear: '9', dueDateMonth: '3',
    obHospital: '上尾中央総合病院', obHospitalOther: '', hl: true, echoNeck: '希望なし', echoAbdomen: '希望なし',
  },
  history: {
    allergy: 'あり', allergyDetail: 'ペニシリン',
    fh: { dm: true, dmWho: ['母', '兄弟'], ht: true, apo: false, ihd: false },
    smoking: '禁煙済', smokingAmount: '10', smokingYears: '10', smokingStartAge: '20', smokingQuitEra: '令和', smokingQuitYear: '2',
    eyeFundusCheck: '受けている', eye: '上尾こいけ眼科', retinopathy: '単純性網膜症', glaucoma: '緑内障なし', eyeNotebook: '持っていない',
    livingSpouse: '配偶者あり', livingOther: ['子供と同居'], work: 'していない', job: [], activity: '動き回っている',
    otherDiseases: [{ name: '甲状腺機能低下症', hospital: 'その他', hospitalOther: 'あげお甲状腺クリニック', dept: '' }],
  },
  body: { height: '155', weightNow: '68', weightPregnancy: '65', weight20: '52', weightMax: '72', weightMaxAge: '33', concern: '前回と同じにならないか心配', preferredDays: ['水', '金'], doctorGender: '女性医師希望', doubleSlot: true },
}))
add('妊娠糖尿病', '難渋', '喫煙継続・産科未選択・週数と予定日が矛盾', build('妊娠糖尿病', {
  reason: { type: '検診異常', checkupType: '妊婦健診' },
  disease: { dmType: '', pastGDM: 'なし', currentWeek: '34', dueDateEra: '令和', dueDateYear: '8', dueDateMonth: '9', obHospital: '', obHospitalOther: 'テスト＜script＞', echoNeck: '', echoAbdomen: '' },
  history: { allergy: 'あり', allergyDetail: 'ハウスダスト', fh: { dm: false, dmWho: [], ht: false, apo: false, ihd: false }, smoking: 'あり', smokingAmount: '5', smokingYears: '8', smokingStartAge: '18', eyeFundusCheck: '', livingSpouse: '', livingOther: [], work: 'している', job: ['その他'], jobNote: '立ち仕事', activity: '', otherDiseases: [emptyOther()] },
  body: { height: '', weightNow: '', weightPregnancy: '', concern: '', preferredDays: [], doctorGender: '' },
}))
add('妊娠糖尿病', '分岐', '糖尿病合併妊娠・眼科未受診（→連携手帳）', build('妊娠糖尿病', {
  reason: { type: '紹介', referralFrom: '上尾中央総合病院', referralDept: 'その他' },
  disease: { dmType: '糖尿病合併妊娠', pastGDM: 'なし', currentWeek: '9', dueDateEra: '令和', dueDateYear: '9', dueDateMonth: '4', obHospital: '上尾中央総合病院', echoNeck: '希望なし', echoAbdomen: '希望なし' },
  history: { allergy: 'なし', fh: { dm: true, dmWho: ['父'], ht: false, apo: false, ihd: false }, smoking: 'なし', eyeFundusCheck: '受けていない', eyeNotebook: '持っていない', livingSpouse: '配偶者あり', livingOther: [], work: 'している', job: ['看護師'], activity: '動き回っている', otherDiseases: [emptyOther()] },
  body: { height: '160', weightNow: '58', weightPregnancy: '57', weight20: '50', weightMax: '60', weightMaxAge: '29', concern: 'なし', preferredDays: ['木'], doctorGender: '指定なし' },
}))

// ── 反応性低血糖 ──────────────────────────────────────────
add('反応性低血糖', '最小', 'ほぼ未入力', build('反応性低血糖', {}))
add('反応性低血糖', '標準', '食後2〜3時間の冷汗・動悸', build('反応性低血糖', {
  symptom: { timing: ['食後2〜3時間'], symptoms: ['冷汗', '動悸'], cause: ['炭水化物中心の食事'] },
  history: { ...HIST_STD, ...LIFE_STD, age: '31', fh: { dm: false, dmWho: [], ht: false, hl: false, apo: false, ihd: false }, otherDiseases: [emptyOther()] },
  body: { ...BODY_STD, height: '160', weightNow: '48', concern: '原因を知りたい' },
}))
add('反応性低血糖', '複雑', '複数タイミング・胃切除後・自由記述あり', build('反応性低血糖', {
  symptom: {
    timing: ['食後2〜3時間', '空腹時', '運動後'], timingNote: '特に昼食後がひどい',
    symptoms: ['冷汗', '動悸', '手のふるえ', '意識が遠のく'], symptomsNote: '週に2〜3回',
    cause: ['炭水化物中心の食事', '食事を抜くこと'], causeNote: '朝食を抜くことが多い',
    libreStarted: '本日装着', libreNote: '', cgmWish: '希望あり',
  },
  history: {
    age: '55', allergy: 'なし',
    fh: { dm: true, dmWho: ['母'], ht: false, hl: true, apo: false, ihd: false },
    alcoholNone: false, alcoholItems: [{ type: 'wine', amount: 'グラス2杯', freq: '週2回' }],
    smoking: 'なし', checkup: ['人間ドック'],
    livingSpouse: '配偶者あり', livingOther: [], work: 'している', job: ['会社員（デスクワーク）'], activity: '座っていることが多い',
    otherDiseases: [
      { name: '胃切除後（胃癌）', hospital: '埼玉県立がんセンター', hospitalOther: '', dept: '消化器外科' },
      { name: '逆流性食道炎', hospital: 'その他', hospitalOther: '鰐坂医院', dept: '' },
    ],
  },
  body: { height: '168', weightNow: '54', weight20: '64', weightMax: '70', weightMaxAge: '45', concern: '仕事中に倒れないか不安', preferredDays: ['金'], doctorGender: '男性医師希望' },
}))
add('反応性低血糖', '難渋', '症状が1つも選ばれず自由記述だけ', build('反応性低血糖', {
  symptom: { timing: [], timingNote: '', symptoms: [], symptomsNote: 'うまく言えないがフワッとする感じ', cause: [], causeNote: '', libreStarted: '', cgmWish: '' },
  history: { age: '', allergy: 'なし', fh: { dm: false, dmWho: [], ht: false, hl: false, apo: false, ihd: false }, alcoholNone: false, alcoholItems: [emptyAlcohol()], smoking: 'なし', checkup: [], work: 'していない', job: [], activity: '', livingSpouse: '', livingOther: [], otherDiseases: [emptyOther()] },
  body: { ...emptyBody(), doctorGender: '指定なし' },
}))
add('反応性低血糖', '分岐', '採血で糖尿病判明（＃糖尿病 → ♯反応性低血糖疑い の順）', build('反応性低血糖', {
  symptom: { timing: ['食後2〜3時間'], symptoms: ['冷汗'], cause: ['炭水化物中心の食事'] },
  history: { ...HIST_STD, ...LIFE_STD, age: '58', fh: { dm: true, dmWho: ['母'], ht: false, hl: false, apo: false, ihd: false }, otherDiseases: [emptyOther()] },
  body: BODY_STD,
  dmDiff: {
    completed: true, weightLoss: 'あり（軽度）',
    dmSymptoms: { selected: ['体がだるい', 'その他'], otherText: '目がかすむ' },
    pastHbA1c: '', diabetesOnsetEra: '令和', diabetesOnsetYear: '8', diabetesOnsetUnknown: false, diabetesOnsetNote: '今回判明',
    insulinUse: false, fhDm: true, fhDmWho: ['母', '兄弟'], fhHl: false,
    eyeFundusCheck: '今後受ける予定', eyeNotebook: '持っている', eyeClinic: '', retinopathy: '',
    importantPast: { gastricCancer: false, pancreasCancer: true, ihd: false, stroke: false, detail: 'R4 膵体尾部切除（自治医大さいたま医療センター）' },
    treatmentWish: '食事療法から', freeText: '',
  },
}))

// ── 睡眠時無呼吸症候群 ────────────────────────────────────
add('睡眠時無呼吸症候群', '最小', 'ほぼ未入力', build('睡眠時無呼吸症候群', {}))
add('睡眠時無呼吸症候群', '標準', 'CPAP継続・前医情報提供書 確認済', build('睡眠時無呼吸症候群', {
  reason: { purposes: ['現在通院中の医療機関から当院へ転院したい'], currentClinic: 'あげお睡眠クリニック', sasCategory: 'cpap', cpapPriorRecordsConfirmed: true, cpapPriorClinic: 'あげお睡眠クリニック', knowSource: ['家族・知人の紹介'] },
  symptom: { sasSymptoms: { selected: ['いびき', '日中の眠気'], otherText: '' } },
  disease: { ht: true, echoNeck: '希望なし', echoAbdomen: '希望なし', otherDiseases: [emptyOther()] },
  history: { ...HIST_STD, ...LIFE_STD, age: '52', fh: { dm: false, dmWho: [], ht: true, hl: false, apo: false, ihd: false } },
  body: { ...BODY_STD, height: '172', weightNow: '88', weightMax: '92', weightMaxAge: '50' },
}))
add('睡眠時無呼吸症候群', '複雑', '68歳・HT/HL・他院管理3つ・症状多数', build('睡眠時無呼吸症候群', {
  reason: { purposes: ['症状がある', '血縁者に睡眠時無呼吸症候群があるので調べたい'], currentClinic: '', sasCategory: 'screening', knowSource: ['インターネット'] },
  symptom: { sasSymptoms: { selected: ['いびき', '日中の眠気', '起床時の頭痛', '夜間頻尿', 'その他'], otherText: '家族に呼吸が止まっていると言われる' } },
  disease: {
    ht: true, hl: true, echoNeck: '希望あり', echoAbdomen: '他院で施行済',
    otherDiseases: [
      { name: '心房細動', hospital: '上尾中央総合病院', hospitalOther: '', dept: '循環器内科' },
      { name: '慢性腎臓病', hospital: '上尾中央総合病院', hospitalOther: '', dept: '腎臓内科' },
      { name: '前立腺肥大症', hospital: '加藤泌尿器科', hospitalOther: '', dept: '' },
    ],
  },
  history: {
    age: '68', allergy: 'あり', allergyDetail: 'ペニシリン・ラテックス',
    fh: { dm: true, dmWho: ['母'], ht: true, hl: true, apo: false, ihd: true },
    alcoholNone: false, alcoholItems: [{ type: 'beer', amount: '500mL', freq: '毎日' }, { type: 'shochu', amount: '1杯', freq: '毎日' }],
    smoking: '禁煙済', smokingAmount: '30', smokingYears: '35', smokingStartAge: '20', smokingQuitEra: '令和', smokingQuitYear: '4',
    checkup: ['市の健診'], vaccine65Prevena: '希望あり', vaccine65Herpes: 'なし',
    livingSpouse: '配偶者あり', livingOther: [], work: 'していない', job: [], activity: '座っていることが多い',
  },
  body: { height: '165', weightNow: '92', weight20: '68', weightMax: '95', weightMaxAge: '65', concern: '運転中に眠くなるのが怖い', preferredDays: ['土'], doctorGender: '指定なし', doubleSlot: true },
}))
add('睡眠時無呼吸症候群', '難渋', 'CPAP継続だが情報提供書 未確認・前医名なし', build('睡眠時無呼吸症候群', {
  reason: { purposes: ['その他'], purposeOther: '会社から検査を受けるよう言われた（本人はあまり自覚なし）', currentClinic: '', sasCategory: 'cpap', cpapPriorRecordsConfirmed: false, cpapPriorClinic: '', knowSource: ['その他'], knowSourceOther: '会社の産業医' },
  symptom: { sasSymptoms: { selected: [], otherText: '' } },
  disease: { ht: false, hl: false, echoNeck: '', echoAbdomen: '', otherDiseases: [emptyOther()] },
  history: { age: '46', allergy: 'なし', fh: { dm: false, dmWho: [], ht: false, hl: false, apo: false, ihd: false }, alcoholNone: true, smoking: 'なし', checkup: [], work: 'している', job: ['運転手'], jobNote: '長距離', activity: '座っていることが多い', livingSpouse: '', livingOther: [] },
  body: { height: '175', weightNow: '', weight20: '', weightMax: '', weightMaxAge: '', concern: '', preferredDays: [], doctorGender: '' },
}))
add('睡眠時無呼吸症候群', '分岐', '検査希望＋採血で糖尿病判明', build('睡眠時無呼吸症候群', {
  reason: { purposes: ['健診・人間ドックの結果から受診を勧められた'], currentClinic: '', sasCategory: 'screening', knowSource: ['インターネット'] },
  symptom: { sasSymptoms: { selected: ['いびき'], otherText: '' } },
  disease: { ht: true, hl: true, echoNeck: '希望なし', echoAbdomen: '希望なし', otherDiseases: [emptyOther()] },
  history: { ...HIST_STD, ...LIFE_STD, age: '59', fh: { dm: false, dmWho: [], ht: false, hl: false, apo: false, ihd: false } },
  body: { ...BODY_STD, height: '170', weightNow: '86' },
  dmDiff: {
    completed: true, weightLoss: 'なし',
    dmSymptoms: { selected: ['のどが渇く', '足のしびれ'], otherText: '' },
    pastHbA1c: 'R6の人間ドックで6.1%', diabetesOnsetEra: '令和', diabetesOnsetYear: '8', diabetesOnsetUnknown: false, diabetesOnsetNote: '今回判明',
    insulinUse: false, fhDm: true, fhDmWho: ['父'], fhHl: true,
    eyeFundusCheck: '受けている', eyeNotebook: '持っている', eyeClinic: 'あげお眼科', retinopathy: '網膜症なし',
    importantPast: { gastricCancer: false, pancreasCancer: false, ihd: false, stroke: false, detail: '' },
    treatmentWish: '内服から始めたい', freeText: '',
  },
}))

// ── 甲状腺 6 フォーム ─────────────────────────────────────
// 5 例の枠は「最小 / 標準 / 複雑 / 難渋 / 分岐」を 6 フォームに割り当てる。
// 6 フォーム × 5 例だと 30 例になり読めなくなるので、各フォームの主戦場に絞る。
const THY_BASE = {
  reason: { type: '検診異常', checkupType: '市の健診' },
  history: { age: '48', allergy: 'なし', fh: { thyroid: false, thyroidWho: [], dm: false, dmWho: [] }, smoking: 'なし', checkup: ['市の健診'], work: 'している', job: ['会社員（デスクワーク）'], activity: '座っていることが多い' },
  body: { height: '160', weightNow: '52', concern: 'なし', preferredDays: ['水'], doctorGender: '指定なし' },
}
const thy = patch => build('甲状腺', merge(THY_BASE, patch))

add('甲状腺（バセドウ初診）', '最小', 'ほぼ未入力（エコー所見なし）', build('甲状腺', {}))
add('甲状腺（バセドウ初診）', '標準', '腫大＋血流豊富＋症状あり', thy({
  echo: { thyroidSize: '腫大', thyroidBloodFlow: '豊富', thyroidParenchyma: '不均一', ecg: '洞調律', hasNodule: 'なし' },
  symptom: { selected: ['動悸', '体重減少', '手のふるえ'], otherText: '' },
  history: { fh: { thyroid: true, thyroidWho: ['母'], dm: false, dmWho: [] } },
}))
add('甲状腺（バセドウ初診）', '難渋', '心房細動＋症状「その他」自由記入＋アレルギー薬あり', thy({
  reason: { type: '', thyroidConcern: true, thyroidConcernReason: ['動悸がする', 'その他'], thyroidConcernNote: '半年で5kgくらい痩せて、手が震えるのが気になって…', summary: '祖母が甲状腺の病気だったそうです' },
  echo: { thyroidSize: '腫大', thyroidBloodFlow: '豊富', thyroidParenchyma: '不整', ecg: '心房細動', hasNodule: 'あり', noduleLocation: '両葉', noduleSizeW: '8', noduleSizeD: '6', noduleCount: '多発', calcification: 'なし', noduleBloodFlow: '豊富', noduleType: '充実性', noduleOther: '境界明瞭' },
  symptom: { selected: ['その他'], otherText: '寝つきが悪い' },
  history: { age: '36', allergy: 'あり', allergyDetail: 'メルカゾール', smoking: 'あり', smokingAmount: '10', smokingYears: '15', smokingStartAge: '21', checkup: [] },
  body: { patientFlag: '○患者疑い（話が長い方）', doubleSlot: true },
}))
add('甲状腺（バセドウ継続）', '標準', '継続・内服中・手術歴なし', thy({
  reason: { type: '自主転院', transferFrom: '上尾中央総合病院', transferDetail: '転居のため' },
  echo: { thyroidSize: '腫大', thyroidBloodFlow: '正常', thyroidParenchyma: '不均一', hasNodule: 'なし' },
  symptom: { selected: [], otherText: '' },
  history: { diagnosisEra: '令和', diagnosisYear: '3', diagnosisMonth: '5', medications: ['メルカゾール'], surgeryHistory: false, isotopeHistory: false, eyeHistory: false },
}))
add('甲状腺（バセドウ継続）', '複雑', '手術歴・アイソトープ歴・副作用歴・眼科通院あり', thy({
  reason: { type: '紹介', referralFrom: '自治医大さいたま医療センター', referralDept: 'その他', referralDetail: '専門的管理のため' },
  echo: { thyroidSize: '萎縮', thyroidBloodFlow: '低下', thyroidParenchyma: '不整', hasNodule: 'あり', noduleLocation: '右葉', noduleSizeW: '15', noduleSizeD: '10', noduleCount: '単発', calcification: 'あり', noduleBloodFlow: '乏しい', noduleType: '混合性', noduleOther: '' },
  symptom: { selected: ['疲れやすい', '体重増加'], otherText: '' },
  history: {
    age: '58', allergy: 'あり', allergyDetail: 'プロパジール',
    diagnosisEra: '平成', diagnosisYear: '25', diagnosisMonth: '8', medications: ['メルカゾール', 'プロパジール'],
    surgeryHistory: true, surgeryYear: '2', surgeryMonth: '6', surgeryType: '亜全摘',
    isotopeHistory: true, sideEffectMmz: true, sideEffectPtz: true,
    eyeHistory: true, eyeClinic: '上尾こいけ眼科',
    fh: { thyroid: true, thyroidWho: ['母', '姉妹'], dm: true, dmWho: ['父'] },
    smoking: '禁煙済', smokingAmount: '20', smokingYears: '20', smokingStartAge: '22', smokingQuitEra: '令和', smokingQuitYear: '1',
    checkup: ['人間ドック'],
  },
  body: { height: '156', weightNow: '60', concern: '目の症状も診てほしい', doctorGender: '女性医師希望' },
}))
add('甲状腺（橋本病）', '標準', '萎縮＋治療経緯あり', thy({
  echo: { thyroidSize: '萎縮', thyroidBloodFlow: '低下', thyroidParenchyma: '不均一', hasNodule: 'なし' },
  symptom: { selected: ['疲れやすい', 'むくみ'], otherText: '' },
  history: { treatmentHistory: 'H30に他院でチラーヂン開始、R3に自己中断', fh: { thyroid: true, thyroidWho: ['母'], dm: false, dmWho: [] } },
}))
add('甲状腺（腫大異常なし）', '分岐', '2ステップ・当日終診（家族歴等は聴取しない）', thy({
  echo: { thyroidSize: '腫大', thyroidBloodFlow: '正常', thyroidParenchyma: '整', hasNodule: 'なし' },
  symptom: { selected: [], otherText: '' },
}))
add('甲状腺（腺腫経過観察）', '標準', '結節あり・6か月follow', thy({
  echo: { thyroidSize: '正常', thyroidBloodFlow: '正常', thyroidParenchyma: '整', hasNodule: 'あり', noduleLocation: '左葉', noduleSizeW: '18', noduleSizeD: '12', noduleCount: '単発', calcification: 'なし', noduleBloodFlow: '乏しい', noduleType: '嚢胞性', noduleOther: '' },
  symptom: { selected: ['のどの違和感'], otherText: '' },
}))
add('甲状腺（腺腫悪性疑い）', '分岐', '当日紹介・当院終診（通院案内を出さない）', thy({
  echo: { thyroidSize: '正常', thyroidBloodFlow: '正常', thyroidParenchyma: '整', hasNodule: 'あり', noduleLocation: '右葉', noduleSizeW: '22', noduleSizeD: '19', noduleCount: '単発', calcification: 'あり', noduleBloodFlow: '豊富', noduleType: '境界不明瞭', noduleOther: '縦横比>1' },
  symptom: { selected: ['のどの違和感', '声のかすれ'], otherText: '' },
  history: { age: '63', allergy: 'あり', allergyDetail: 'ヨード造影剤' },
  body: { concern: '' },
}))

// ── 甲状腺: 6 フォーム × 5 例に揃える（上で足りない分）──────────────
// 甲状腺は 1 コンポーネント + formType 分岐なので、データの形は 6 種で共通。
// 「どの所見のときにどのフォームを選ぶか」は技師の運用なので、
// ここでは各フォームが自分の分岐（診断名・申し送り・フッター）を正しく出すかを見る。
const THY_MIN = { echo: {}, symptom: { selected: [], otherText: '' } }
const THY_NODULE = {
  echo: { thyroidSize: '正常', thyroidBloodFlow: '正常', thyroidParenchyma: '整', hasNodule: 'あり', noduleLocation: '両葉', noduleSizeW: '9', noduleSizeD: '7', noduleCount: '多発', calcification: 'なし', noduleBloodFlow: '不明', noduleType: '充実性', noduleOther: '' },
  symptom: { selected: ['のどの違和感'], otherText: '' },
}
const THY_MESSY = {
  reason: { type: '', thyroidConcern: true, thyroidConcernReason: ['その他'], thyroidConcernNote: '', summary: '' },
  echo: { thyroidSize: '', thyroidBloodFlow: '', thyroidParenchyma: '', hasNodule: 'あり', noduleLocation: '', noduleSizeW: '', noduleSizeD: '', noduleCount: '', calcification: '', noduleBloodFlow: '', noduleType: '', noduleOther: '' },
  symptom: { selected: ['その他'], otherText: '' },
  history: { age: '', allergy: 'あり', allergyDetail: '', smoking: '禁煙済', smokingAmount: '', smokingYears: '', smokingStartAge: '', smokingQuitYear: '', checkup: [], work: '', job: [], activity: '' },
  body: { height: '0', weightNow: '55', concern: '', preferredDays: [], doctorGender: '' },
}
const THY_COMPLEX = {
  reason: { type: '紹介', referralFrom: '上尾中央総合病院', referralDept: 'その他', referralDetail: '専門的管理のため' },
  echo: { thyroidSize: '腫大', thyroidBloodFlow: '豊富', thyroidParenchyma: '不均一', ecg: '心房細動', hasNodule: 'あり', noduleLocation: '右葉', noduleSizeW: '25', noduleSizeD: '20', noduleCount: '単発', calcification: 'あり', noduleBloodFlow: '豊富', noduleType: '混合性', noduleOther: '境界不明瞭' },
  symptom: { selected: ['動悸', '疲れやすい', 'その他'], otherText: '声のかすれが続く' },
  history: { age: '70', allergy: 'あり', allergyDetail: 'ヨード造影剤・ペニシリン', fh: { thyroid: true, thyroidWho: ['母', '姉妹'], dm: true, dmWho: ['父'] }, smoking: 'あり', smokingAmount: '20', smokingYears: '50', smokingStartAge: '20', checkup: ['市の健診'], work: 'していない', job: [], activity: '座っていることが多い', diagnosisEra: '平成', diagnosisYear: '20', diagnosisMonth: '3', medications: ['メルカゾール'], surgeryHistory: true, surgeryYear: '3', surgeryMonth: '2', surgeryType: '全摘', isotopeHistory: true, sideEffectMmz: true, eyeHistory: true, eyeClinic: 'あげお眼科', treatmentHistory: 'H20 に他院で診断、R3 に手術' },
  body: { height: '150', weightNow: '41', concern: '手術のあとが気になる', preferredDays: ['木'], doctorGender: '女性医師希望', patientFlag: '○患者疑い（話が長い方）', doubleSlot: true },
}
const THY_FORMS = ['甲状腺（バセドウ初診）', '甲状腺（バセドウ継続）', '甲状腺（橋本病）', '甲状腺（腫大異常なし）', '甲状腺（腺腫経過観察）', '甲状腺（腺腫悪性疑い）']
const THY_HAVE = new Set(CASES.filter(c => c.form.startsWith('甲状腺')).map(c => `${c.form}/${c.kind}`))
const THY_FILL = [
  ['最小', 'ほぼ未入力（エコー所見なし）', THY_MIN],
  ['標準', '結節あり・症状1つ', THY_NODULE],
  ['複雑', '大結節＋心房細動＋治療歴一式＋高齢', THY_COMPLEX],
  ['難渋', '所見も詳細も空欄だらけ・身長0・アレルギー内容なし', THY_MESSY],
  ['分岐', 'フォーム固有の申し送りとフッター', THY_NODULE],
]
for (const form of THY_FORMS) {
  for (const [kind, title, patch] of THY_FILL) {
    if (THY_HAVE.has(`${form}/${kind}`)) continue
    add(form, kind, title, kind === '最小' ? build('甲状腺', patch) : thy(patch))
  }
}

// ══════════════════════════════════════════════════════════
// 音声入力ありのケース（2026-09-08 の 2 回目の検証で追加）
//
// ★1 回目の 70 ケースには音声入力が 1 件も無かった。
//   AI が触るのはそこだけなのに、そこを検証していなかった。
//
// aiSummary は「入力時に lib/voiceSummary.js が整形した後」の文字列。
// merged は「統合を頼んだ AI が返した結果」。--ai を付けなければ merged は
// null のままなので、**AI が落ちたときのフォールバック**の検証にもなる。
// ══════════════════════════════════════════════════════════
const VOICE_FORMS = ['DM基本', '1型糖尿病', '小児1型糖尿病', '高血圧・脂質異常症', '内分泌', '妊娠糖尿病', '反応性低血糖', '睡眠時無呼吸症候群']

// 現病歴の音声（整形済み）
const VOICE_NOW = 'R3頃より健診でHbA1c高値を指摘されていたが放置。R6.10より口渇・多尿を自覚し当院受診。'
// 既往歴の音声（整形済み・♯形式）。★構造化データと**同じ疾患**を1つ含める（重複排除の検証）
const VOICE_PAST = [
  '♯高血圧（H28から、あげお内科クリニックでアムロジピン 5mg 内服中）',
  '♯慢性腎臓病（上尾中央総合病院 腎臓内科で経過観察中）',
  '♯虫垂炎術後（H10、上尾中央総合病院）',
].join('\n')

for (const form of VOICE_FORMS) {
  const std = CASES.find(c => c.form === form && c.kind === '標準')
  if (!std) continue

  // ① 現病歴の音声だけ
  add(form, '音声現病歴', '現病歴の音声あり（統合が要る）', merge(std.data, {
    voiceMemo: { transcript: '生の音声', aiSummary: VOICE_NOW, needsDoctorReview: false },
  }))

  // ② 既往歴の音声だけ（構造化と重複する疾患を含む）
  add(form, '音声既往歴', '既往歴の音声あり（♯の重複排除が要る）', merge(std.data, {
    voicePastHistory: { transcript: '生の音声', aiSummary: VOICE_PAST, needsDoctorReview: true },
  }))

  // ③ 両方 + 要DR確認 + 自由記入（統合の材料が最も多い状態）
  add(form, '音声両方', '現病歴・既往歴とも音声＋要DR確認＋自由記入', merge(std.data, {
    reason: { summary: 'あと、去年から足がつることが増えたと言っていました' },
    voiceMemo: { transcript: '生の音声', aiSummary: VOICE_NOW, needsDoctorReview: true },
    voicePastHistory: { transcript: '生の音声', aiSummary: VOICE_PAST, needsDoctorReview: true },
  }))

  // ④ 録音したが AI 整形を押していない（transcript だけある）
  //    → 統合は走らず、生の音声はカルテに載らない（仕様）。壊れないことを見る
  add(form, '音声未整形', '録音したが AI 整形を押していない', merge(std.data, {
    voiceMemo: { transcript: 'えーと、3年くらい前から…', aiSummary: '', needsDoctorReview: false },
  }))
}

// ── 「その他」漏れ専用ケース（2026-09-08 の 2 回目で見つかった型）──────
add('DM基本', 'その他漏れ', '科・職業・通院先が全部「その他」', build('DM基本', {
  reason: { type: '紹介', referralFrom: '上尾中央総合病院', referralDept: 'その他', referralDetail: '専門的管理のため' },
  disease: {
    dmOnsetEra: '令和', dmOnset: '3', echoNeck: '行っていない', echoAbdomen: '行っていない',
    otherDiseases: [
      { name: '関節リウマチ', hospital: '上尾中央総合病院', hospitalOther: '', dept: 'その他' },
      { name: '副腎腫瘍', hospital: '自治医大さいたま医療センター', hospitalOther: '', dept: 'その他' },
    ],
  },
  history: { ...HIST_STD, fh: { dm: false, dmWho: [], ht: false, apo: false, ihd: false } },
  lifestyle: { ...LIFE_STD, job: ['その他'], jobNote: '夜勤あり／週4' },
  body: BODY_STD,
}))
add('小児1型糖尿病', 'その他漏れ', '協力体制・居住地が「その他」', build('小児1型糖尿病', {
  reason: { type: '紹介', referralFrom: 'さいたま赤十字病院', referralDept: 'その他' },
  disease: { dm1type: '急性発症', dmOnsetEra: '令和', dmOnset: '6', bakusmi: '希望なし', insulinStatus: 'インスリン使用中' },
  support: { familyMain: 'その他', familySubList: ['その他'], familyNote: '叔母が同居', schoolStaff: [], schoolSupportPerson: ['その他'], schoolSupportNote: 'スクールカウンセラー', childGrade: '小4', childActivities: ['その他'], childActivityNote: '週2回ピアノ', parentWorkMain: ['その他'], parentWorkMainNote: '在宅で自営', parentWorkSub: ['その他'], parentWorkSubNote: '', independenceLevel: '親の補助あり' },
  chronic: { status: '申請済', residenceCity: 'その他', maternalHandbook: '持ってきた', documents: [] },
  history: { allergy: 'なし', fh: { dm: false, dmWho: [], dm1: false, dm1Who: [], collagen: false, collagenItems: [{ who: '', disease: '' }], ht: false, apo: false, ihd: false }, eyeFundusCheck: '今後受ける予定', eyeNotebook: '持っている', livingSpouse: '配偶者あり', livingOther: [], keyPerson: '母', otherDiseases: [emptyOther()] },
  body: { height: '132', weightNow: '29', concern: 'なし', preferredDays: ['水'], doctorGender: '指定なし' },
}))
add('甲状腺（バセドウ継続）', 'その他漏れ', '紹介科が「その他」・診断時期不明', thy({
  reason: { type: '紹介', referralFrom: '上尾中央総合病院', referralDept: 'その他', referralDetail: '専門的管理のため' },
  echo: { thyroidSize: '腫大', thyroidBloodFlow: '正常', thyroidParenchyma: '不均一', hasNodule: 'なし' },
  symptom: { selected: [], otherText: '' },
  history: { diagnosisEra: '令和', diagnosisYear: '', diagnosisMonth: '', medications: [], surgeryHistory: false, isotopeHistory: false, eyeHistory: false },
}))

// ゴールデンテスト用の疑似 form_data
//
// 実在の患者データは絶対に置かない（PII）。全て架空の値。
// 「通院先＝その他 → 病院名を自由入力」「エコー＝希望なし」など、
// 過去に取りこぼしたパターンを必ず含めること。

// 全フォーム共通で使い回す部分
const commonHistory = {
  age: '58',
  allergy: 'あり',
  allergyDetail: 'ペニシリン・金属',
  fh: { dm: true, dmWho: ['母'], ht: true, hl: false, apo: false, ihd: false },
  alcoholNone: false,
  alcoholItems: [{ type: 'beer', amount: '2缶', freq: '毎日' }],
  smoking: '禁煙済',
  smokingAmount: '20', smokingYears: '30', smokingStartAge: '20',
  smokingQuitEra: '令和', smokingQuitYear: '3',
  checkup: ['市の健診'],
  vaccine65Prevena: '希望あり', vaccine65Herpes: 'なし',
  livingSpouse: '配偶者あり',
  livingOther: ['息子と同居'],
  livingCustom: '',
  childInfo: '', childLocation: '', childGender: [],
  work: 'している',
  job: ['会社員（デスクワーク）'],
  jobNote: '週3日リモート',
  activity: '座っていることが多い',
}

const commonBody = {
  height: '168', weightNow: '74', weight20: '60', weightMax: '80', weightMaxAge: '45',
  concern: '薬を減らしたい',
  preferredDays: ['火'],
  doctorGender: '女性医師希望',
  patientFlag: '通常',
  doubleSlot: false,
}

const commonVoice = {
  voiceMemo: { transcript: '', aiSummary: '', needsDoctorReview: false },
  voicePastHistory: { transcript: '', aiSummary: '', needsDoctorReview: false },
}

// 通院先「その他」＋自由入力病院名 と 病院＋科 を必ず両方含める
// （2026-08-22 の hospitalOther 取りこぼしバグの再発検知用）
const otherDiseases = [
  { name: '子宮筋腫', hospital: 'その他', hospitalOther: '鰐坂医院', dept: '' },
  { name: '慢性腎臓病', hospital: '上尾中央総合病院', hospitalOther: '', dept: '腎臓内科' },
  { name: 'うつ病', hospital: '通院なし', hospitalOther: '', dept: '' },
]

const commonReason = {
  type: '紹介',
  referralFrom: '上尾中央総合病院', referralDept: '糖尿病内科', referralQuickSelect: true,
  referralDetail: '安定していたため当院へ',
  transferFrom: '', transferDetail: '', checkupType: '',
  summary: '',
}

export const FIXTURES = {
  'DM基本': {
    ...commonVoice,
    alert: { weightLoss: 'なし' },
    reason: { ...commonReason, dmConcern: false },
    disease: {
      dmOnsetEra: '令和', dmOnset: '2', dmOnsetUnknown: false,
      ht: true, hl: false, insulin: false,
      // エコーは「希望なし」を入れる（2026-08-22 追加、当院で施行予定に化けないこと）
      echoNeck: '希望なし', echoAbdomen: '他院で施行済',
      dmSymptoms: { selected: ['のどが渇く', '足のしびれ', 'その他'], otherText: '夜間頻尿' },
      otherDiseases,
    },
    lifestyle: commonHistory,
    history: commonHistory,
    body: commonBody,
  },

  '1型糖尿病': {
    ...commonVoice,
    alert: { weightLoss: 'あり', weightLossAmount: '5' },
    reason: commonReason,
    disease: {
      dm1type: '急性発症', dmOnsetEra: '令和', dmOnset: '4',
      thyroidChecked: true, pensionKosei: 'はい（加入していた）', pensionStatus: '未申請',
      ht: false, hl: false,
      dmSymptoms: { selected: ['体がだるい'], otherText: '' },
      echoNeck: '希望なし', echoAbdomen: '希望なし',
    },
    history: { ...commonHistory, otherDiseases },
    body: commonBody,
  },

  '小児1型糖尿病': {
    ...commonVoice,
    reason: commonReason,
    disease: {
      dm1type: '急性発症', dmOnsetEra: '令和', dmOnset: '5',
      ht: false, hl: false,
      dmSymptoms: { selected: ['のどが渇く'], otherText: '' },
    },
    history: { ...commonHistory, age: '11', otherDiseases },
    support: { family: '母が主に管理', school: '担任と養護教諭が把握' },
    chronic: { status: '申請済' },
    body: { ...commonBody, height: '140', weightNow: '34' },
  },

  '高血圧・脂質異常症': {
    ...commonVoice,
    reason: { ...commonReason, concern: false, concernType: '' },
    disease: {
      igt: false, ht: true, hl: true, thyroidAdded: true,
      echoNeck: '希望なし', echoAbdomen: '希望なし',
      otherDisease: '', otherDiseases,
    },
    history: commonHistory,
    body: commonBody,
  },

  '妊娠糖尿病': {
    ...commonVoice,
    reason: commonReason,
    disease: {
      dmType: '妊娠糖尿病', pastGDM: 'なし',
      currentWeek: '26', dueDateEra: '令和', dueDateYear: '8', dueDateMonth: '12',
      obHospital: 'その他', obHospitalOther: 'ナラヤマレディースクリニック',
      ht: false, hl: false, thyroidAdded: false,
      echoNeck: '希望なし', echoAbdomen: '希望なし',
    },
    history: { ...commonHistory, age: '32', otherDiseases },
    body: { ...commonBody, weightPregnancy: '62' },
  },

  '反応性低血糖': {
    ...commonVoice,
    reason: commonReason,
    symptom: {
      timing: ['食後2〜3時間'], timingNote: '',
      symptoms: ['冷汗', '動悸'], symptomsNote: '',
      cause: ['炭水化物中心の食事'], causeNote: '',
    },
    disease: {},
    history: { ...commonHistory, otherDiseases },
    body: commonBody,
  },

  '睡眠時無呼吸症候群': {
    ...commonVoice,
    reason: {
      ...commonReason,
      purposes: ['CPAP継続'], currentClinic: '前医クリニック',
      knowSource: ['家族の紹介'], knowSourceOther: '',
    },
    disease: {
      sasCategory: 'cpap', cpapConfirmed: true,
      sasSymptoms: { selected: ['いびき', '日中の眠気'], otherText: '' },
      echoNeck: '希望なし', echoAbdomen: '希望なし',
      otherDiseases,
    },
    history: commonHistory,
    body: commonBody,
  },

  '内分泌': {
    ...commonVoice,
    reason: { ...commonReason, concern: false, concernType: '' },
    disease: {
      echoNeck: '希望なし', echoAbdomen: '希望なし',
      otherDisease: '', otherDiseases,
      carePlanDiseases: { dm: false, ht: false, hl: false },  // 療養計画書 不要ケース
    },
    history: {
      ...commonHistory,
      fhOthers: [
        { who: '母', disease: 'バセドウ病' },
        { who: '姉', disease: '橋本病' },
      ],
    },
    body: commonBody,
  },
}

// DM差分問診（採血で糖尿病が判明した後にスタッフが追加聴取した内容）。
// 経路B（再生成）専用。SAS / 高血圧・脂質異常症 / 反応性低血糖 で共通。
export const DM_DIFF = {
  completed: true,
  weightLoss: 'あり（3kg以上）',
  dmSymptoms: { selected: ['のどが渇く', '足のしびれ', 'その他'], otherText: '夜間頻尿' },
  pastHbA1c: 'R5の健診で6.2%を指摘',
  diabetesOnsetEra: '令和', diabetesOnsetYear: '8', diabetesOnsetUnknown: false, diabetesOnsetNote: '今回判明',
  insulinUse: false,
  fhDm: true, fhDmWho: ['母'], fhHl: false,
  eyeFundusCheck: '受けていない',
  eyeNotebook: '持っていない',
  eyeClinic: '',
  retinopathy: '不明',
  importantPast: { gastricCancer: false, pancreasCancer: false, ihd: true, stroke: false, detail: 'H30 PCI（上尾中央総合病院）' },
  treatmentWish: '内服から始めたい',
  freeText: '',
}

export const SAS_WITH_DM_DIFF  = { ...FIXTURES['睡眠時無呼吸症候群'], dmDiff: DM_DIFF }
export const HTHL_WITH_DM_DIFF = { ...FIXTURES['高血圧・脂質異常症'], dmDiff: DM_DIFF }
export const RH_WITH_DM_DIFF   = { ...FIXTURES['反応性低血糖'], dmDiff: DM_DIFF }
// 内分泌は主病名（＃）を出力しないフォーム。DM判明時だけ ＃糖尿病 が例外的に出る
export const ENDOCRINE_WITH_DM_DIFF = { ...FIXTURES['内分泌'], dmDiff: DM_DIFF }

// 内分泌の「生活習慣病あり」バリエーション（療養計画書が出ること）
export const ENDOCRINE_WITH_CAREPLAN = {
  ...FIXTURES['内分泌'],
  disease: {
    ...FIXTURES['内分泌'].disease,
    carePlanDiseases: { dm: true, ht: false, hl: true },
  },
}

// 甲状腺（代表1件、6タイプは formType prop で分岐）
export const THYROID_FIXTURE = {
  ...commonVoice,
  reason: { type: '検診異常', checkupType: '市健診', summary: '', thyroidConcern: false },
  echo: { hasNodule: 'なし', ecg: '洞調律' },
  history: {
    ...commonHistory,
    fh: { thyroid: true, thyroidWho: ['母'], dm: false, dmWho: [] },
    diagnosisEra: '令和', diagnosisYear: '3',
  },
  body: commonBody,
}

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

// DM基本だけは生活情報を lifestyle、医療情報を history に分けて持つ（実フォームと同じ形にする）
const LIFESTYLE_KEYS = ['livingSpouse', 'livingOther', 'livingCustom', 'childInfo', 'childLocation', 'childGender', 'work', 'job', 'jobNote', 'activity']
const pick = (o, ks) => Object.fromEntries(ks.filter(k => k in o).map(k => [k, o[k]]))
const omit = (o, ks) => Object.fromEntries(Object.entries(o).filter(([k]) => !ks.includes(k)))

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
      ht: true, hl: false, insulinUse: false,
      // エコーは「希望なし」を入れる（2026-08-22 追加、当院で施行予定に化けないこと）
      echoNeck: '希望なし', echoAbdomen: '他院で施行済',
      dmSymptoms: { selected: ['のどが渇く', '足のしびれ', 'その他'], otherText: '夜間頻尿' },
      otherDiseases,
    },
    lifestyle: pick(commonHistory, LIFESTYLE_KEYS),
    history: {
      ...omit(commonHistory, LIFESTYLE_KEYS),
      // DM基本の家族歴に HL は無い（HTHL/RH/内分泌 のみ）
      fh: { dm: true, dmWho: ['母'], ht: true, apo: false, ihd: false },
      // 眼底検査まわりは DM基本 固有
      eye: '上尾こいけ眼科', eyeVisiting: '', eyeFundusCheck: '受けている',
      retinopathy: '単純性網膜症', glaucoma: '緑内障なし', eyeNotebook: '持っている',
    },
    body: commonBody,
  },

  '1型糖尿病': {
    ...commonVoice,
    // 問診票のボタンは「あり / なし / 不明」の3択（画面で3kg以上と定義している）
    alert: { weightLoss: 'あり' },
    reason: {
      ...commonReason,
      cgmCurrent: 'フリースタイルリブレ', cgmWish: 'Dexcom G7',
      pumpCurrent: '使用していない', pumpWish: '希望なし',
      deviceWish: [],
    },
    disease: {
      dm1type: '急性発症', dmOnsetEra: '令和', dmOnset: '4', dmOnsetUnknown: false,
      thyroidChecked: true, pensionKosei: 'はい（加入していた）', pensionStatus: '未申請',
      insulinStatus: 'インスリン使用中',
      ht: false, hl: false,
      dmSymptoms: { selected: ['体がだるい', 'その他'], otherText: '夜間頻尿' },
    },
    // 1型のフォームは エコー項目 と 家族歴の HL を持たない（カルテのエコー行は定型文）
    history: {
      ...commonHistory,
      fh: { dm: true, dmWho: ['母'], ht: true, apo: false, ihd: false },
      eye: '', eyeVisiting: '', eyeFundusCheck: '受けていない', eyeNotebook: '持っていない',
      otherDiseases,
    },
    body: commonBody,
  },

  // ★フィクスチャは initialData から起こすこと（2026-09-06 の教訓）。
  //   support / chronic はフォームの実フィールド名で埋める。
  '小児1型糖尿病': {
    ...commonVoice,
    reason: commonReason,
    disease: {
      dm1type: '急性発症', dmOnsetEra: '令和', dmOnset: '5', dmOnsetUnknown: false,
      ht: false, hl: false, thyroidChecked: false, bakusmi: '希望あり',
      insulinStatus: 'インスリン使用中',
      dmSymptoms: { selected: ['のどが渇く'], otherText: '' },
    },
    // 小児1型は 飲酒・喫煙・健診・ワクチン・仕事・20歳時体重 を聴取しない
    history: {
      allergy: 'あり', allergyDetail: 'ペニシリン・金属',
      fh: { dm: true, dmWho: ['母'], dm1: true, dm1Who: ['兄'], collagen: true, collagenItems: [{ who: '母', disease: '橋本病' }], ht: false, apo: false, ihd: false },
      eye: '', eyeVisiting: '', eyeFundusCheck: '受けていない', eyeNotebook: '持っていない',
      livingSpouse: '配偶者あり', livingOther: ['息子と同居'], livingCustom: '',
      keyPerson: '母',
      otherDiseases,
    },
    support: {
      familyMain: '母', familySubList: ['父', '祖母'], familyNote: '祖父母が近居でサポート',
      schoolStaff: ['担任・養護教諭が連携', '保健室で血糖測定可'],
      schoolSupportPerson: ['担任', '養護教諭'], schoolSupportNote: '',
      disclosedChild: '一部の友人のみ', disclosedTeacher: '担任＋養護教諭',
      childGrade: '小5', childActivities: ['運動系部活'], childActivityNote: '週3回サッカー教室',
      parentWorkMain: ['パート（午前）'], parentWorkMainNote: '週3日勤務',
      parentWorkSub: ['会社員'], parentWorkSubNote: '',
      independenceLevel: '親の補助あり', independenceNote: '注射は自己、血糖測定は親が確認',
    },
    chronic: {
      status: '申請済', birthWeight: '', birthWeek: '', birthWeekDay: '', birthCity: '',
      booklets: [], documents: ['学校生活管理指導表'], residenceCity: '上尾市',
      paymentConfirmed: '窓口負担なし（公費）', maternalHandbook: '忘れた',
    },
    body: {
      height: '140', weightNow: '34', concern: '薬を減らしたい',
      preferredDays: ['火'], doctorGender: '女性医師希望', patientFlag: '通常', doubleSlot: false,
    },
  },

  '高血圧・脂質異常症': {
    ...commonVoice,
    reason: { ...commonReason, concern: false, concernType: '' },
    disease: {
      igt: false, ht: true, hl: true,
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
      dmType: '妊娠糖尿病（GDM）', pastGDM: 'あり',
      pastGDMChild: [{ era: '令和', year: '3', had: 'あり' }, { era: '令和', year: '', had: '' }],
      currentWeek: '26', dueDateEra: '令和', dueDateYear: '8', dueDateMonth: '12',
      obHospital: 'その他', obHospitalOther: 'ナラヤマレディースクリニック',
      ht: false, hl: false,
      echoNeck: '希望なし', echoAbdomen: '希望なし',
    },
    // 妊娠糖尿病は 年齢・飲酒（妊娠中で固定）・健診・ワクチン・子供の状況 を聴取しない
    history: {
      allergy: 'あり', allergyDetail: 'ペニシリン・金属',
      fh: { dm: true, dmWho: ['母'], ht: true, apo: false, ihd: false },
      smoking: '禁煙済', smokingAmount: '10', smokingYears: '8', smokingStartAge: '20',
      smokingQuitEra: '令和', smokingQuitYear: '5',
      eye: '', eyeVisiting: '', eyeFundusCheck: '受けていない', eyeNotebook: '持っていない',
      livingSpouse: '配偶者あり', livingOther: [], livingCustom: '',
      work: 'している', job: ['会社員（デスクワーク）'], jobNote: '週3日リモート', activity: '座っていることが多い',
      otherDiseases,
    },
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

  // ★SAS は sasCategory / cpapPriorRecordsConfirmed が reason 配下、症状は symptom 配下。
  //   2026-09-07 まで disease 配下に置いていて、プロンプトの SAS区分が「未選択」のまま
  //   テストが通っていた（フィクスチャが実データと違うと本番だけ壊れる典型）。
  '睡眠時無呼吸症候群': {
    ...commonVoice,
    reason: {
      purposes: ['現在通院中の医療機関から当院へ転院したい'], purposeOther: '', currentClinic: '前医クリニック',
      sasCategory: 'cpap', cpapPriorRecordsConfirmed: true, cpapPriorClinic: 'あげお睡眠クリニック',
      knowSource: ['家族の紹介'], knowSourceOther: '', summary: '',
    },
    symptom: { sasSymptoms: { selected: ['いびき', '日中の眠気'], otherText: '' } },
    disease: {
      ht: true, hl: false, igt: false,
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
// 甲状腺フォームは音声入力を持たない（3〜4分フォーム）ので voiceMemo は入れない。
export const THYROID_FIXTURE = {
  reason: { type: '検診異常', checkupType: '市健診', summary: '', thyroidConcern: false, thyroidConcernReason: [], thyroidConcernNote: '' },
  echo: {
    thyroidSize: '腫大', thyroidBloodFlow: '豊富', thyroidParenchyma: '不均一',
    ecg: '洞調律', hasNodule: 'なし',
    noduleLocation: '', noduleSizeW: '', noduleSizeD: '', noduleCount: '',
    calcification: '', noduleBloodFlow: '', noduleType: '', noduleOther: '',
  },
  symptom: { selected: ['動悸', '体重減少'], otherText: '' },
  history: {
    ...omit(commonHistory, ['alcoholNone', 'alcoholItems', 'livingSpouse', 'livingOther', 'livingCustom',
      'childInfo', 'childLocation', 'childGender', 'vaccine65Prevena', 'vaccine65Herpes']),
    fh: { thyroid: true, thyroidWho: ['母'], dm: false, dmWho: [] },
    surgeryHistory: false, surgeryYear: '', surgeryMonth: '', surgeryType: '',
    isotopeHistory: false, sideEffectMmz: false, sideEffectPtz: false,
    eyeHistory: false, eyeClinic: '', treatmentHistory: '',
    diagnosisEra: '令和', diagnosisYear: '3', diagnosisMonth: '5', medications: ['メルカゾール'],
  },
  body: commonBody,
}

// 結節ありのバリエーション（腺腫・悪性疑いフォームの結節所見行を固定する）
export const THYROID_NODULE_FIXTURE = {
  ...THYROID_FIXTURE,
  echo: {
    ...THYROID_FIXTURE.echo,
    hasNodule: 'あり', noduleLocation: '右葉', noduleSizeW: '12', noduleSizeD: '8',
    noduleCount: '単発', calcification: 'あり', noduleBloodFlow: '乏しい',
    noduleType: '充実性', noduleOther: '',
  },
}

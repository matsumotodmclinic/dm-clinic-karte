// 印刷見本（/print/sample）用の架空データ。院長依頼 2026-10-14
// 「実際に印刷して確認するので、テスト用のデータで1件作っておいて」。
//
// ■ なぜ DB に 1 件入れるのではなく見本ページにしたか
//   ・問診一覧に架空の患者が混ざらない（消し忘れると本物と紛らわしい）
//   ・A4 の体裁を直すたびに何度でも開き直せる
//   ・Supabase に書き込まなくていい
//
// ■ 中身は「いちばん厳しい回」にしてある
//   1型糖尿病 = カルテが最長（54 行）。しかもドクターキューブの貼り付けあり。
//   **これが 1 枚に収まれば、他のフォームは収まる。**
//
// ★実在の患者データは置かない（PII）。病院名・薬剤名まで全て架空。
//   ゴールデンテストのフィクスチャと同じ作法。

export const SAMPLE_FORM_DATA = {
  voiceMemo: { transcript: '', aiSummary: '', needsDoctorReview: false },
  voicePastHistory: { transcript: '', aiSummary: '', needsDoctorReview: false },

  alert: { weightLoss: 'あり' },

  reason: {
    type: '紹介',
    referralLetter: '持参あり',
    referralFrom: '上尾中央総合病院', referralDept: '糖尿病内科', referralQuickSelect: true,
    referralDetail: '安定していたため当院へ',
    transferFrom: '', transferDetail: '', checkupType: '', summary: '',
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

  history: {
    age: '58',
    allergy: 'あり',
    allergyDetail: 'ペニシリン・金属',
    fh: { dm: true, dmWho: ['母'], ht: true, apo: false, ihd: false },
    alcoholNone: false,
    alcoholItems: [{ type: 'beer', amount: '2缶', freq: '毎日' }],
    smoking: '禁煙済',
    smokingAmount: '20', smokingYears: '30', smokingStartAge: '20',
    smokingQuitEra: '令和', smokingQuitYear: '3',
    checkup: ['市の健診'],
    vaccine65Prevena: '希望あり', vaccine65Herpes: 'なし',
    livingSpouse: '配偶者あり', livingOther: ['息子と同居'], livingCustom: '',
    childInfo: '', childLocation: '', childGender: [],
    work: 'している', job: ['会社員（デスクワーク）'], jobNote: '週3日リモート',
    activity: '座っていることが多い',
    eye: '', eyeFundusCheck: '受けていない', eyeNotebook: '持っていない',
    otherDiseases: [
      { name: '子宮筋腫', hospital: 'その他', hospitalOther: '鰐坂医院', dept: '' },
      { name: '慢性腎臓病', hospital: '上尾中央総合病院', hospitalOther: '', dept: '腎臓内科' },
      { name: 'うつ病', hospital: '通院なし', hospitalOther: '', dept: '' },
    ],
  },

  body: {
    hba1c: '7.2',
    height: '168', weightNow: '74', weight20: '60', weightMax: '80', weightMaxAge: '45',
    concern: '薬を減らしたい',
    preferredDays: ['火'],
    doctorGender: '女性医師希望',
    patientFlag: '通常',
    doubleSlot: false,
  },

  // ドクターキューブから貼り付けた体裁の見本（院長が 2026-10-14 に提示した形式）
  drQube: {
    text: `【受診理由】
通院中の病院があるが、転院したい その他(下記にご記入ください)
【その他の内容】 仕事の関係で土曜日に通院したいため

【体重減少の有無】
あり
【体重減少】
〇 8ヵ月間で 9kg減少
【その他の自覚症状】
足がつりやすい
【HbA1c】
HbA1c： 8.1%
検査した年月： 2026年10月
血糖値：mg/dl
検査した年月： 2026年10月
【当院を知った経緯】
バスの車内広告
【インスリン注射】
はい
【既に診断を受けている疾患】
1型糖尿病と診断されたことがある

【CGM】
使用している　【使用している方】使用機種名: てるも、リブレ
【CSⅡ】
　【使用している方】使用機種名: 関心がある／使ってみたいと思っている`,
    updatedAt: null,
  },
}

export const SAMPLE_FORM_TYPE = '1型糖尿病'

// ══════════════════════════════════════════════════════════
// 赤字の見本（院長 2026-10-16「赤が出るような見本をつくってほしい」）
// ══════════════════════════════════════════════════════════
//
// 上の見本は 1型糖尿病（カルテ最長）なので、**リブレの行が 1 つも出ない**＝赤が見えない。
// 赤は紙に出してみないと濃さ・大きさが分からないので、赤が出る回を別に用意する。
//
// ★予約日・装着日は**今日からの相対**で作る。固定の日付にすると、来年この見本を開いたときに
//   去年の日付が並んで「見本が腐っている」ように見える。

/** 今日から n 日後を 2026-10-23 の形で（日付ピッカーの値と同じ形） */
function dayFromToday(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const SAMPLE_OTHER_DISEASES = [
  { name: '鉄欠乏性貧血', hospital: 'その他', hospitalOther: 'あげお見本クリニック', dept: '' },
]

/** 妊娠糖尿病: リブレ装着の予約3回分が赤字で出る */
const SAMPLE_GDM = {
  voiceMemo: { transcript: '', aiSummary: '', needsDoctorReview: false },
  voicePastHistory: { transcript: '', aiSummary: '', needsDoctorReview: false },
  reason: { type: '紹介', referralLetter: '持参あり', referralFrom: '見本レディースクリニック', referralDept: '産婦人科', referralQuickSelect: false, referralDetail: '75gOGTT で 2 点以上', transferFrom: '', transferDetail: '', checkupType: '', summary: '' },
  disease: {
    dmType: '妊娠糖尿病（GDM）', pastGDM: 'なし',
    pastGDMChild: [{ era: '令和', year: '', had: '' }],
    currentWeek: '28', dueDateEra: '令和', dueDateYear: '9', dueDateMonth: '2',
    obHospital: 'その他', obHospitalOther: '見本レディースクリニック',
    ht: false, hl: false, echoNeck: '希望なし', echoAbdomen: '希望なし',
  },
  history: {
    allergy: 'なし', allergyDetail: '',
    fh: { dm: true, dmWho: ['母'], ht: false, apo: false, ihd: false },
    smoking: 'なし', smokingAmount: '', smokingYears: '', smokingStartAge: '',
    smokingQuitEra: '令和', smokingQuitYear: '',
    eye: '', eyeFundusCheck: '受けていない', eyeNotebook: '持っていない',
    livingSpouse: '配偶者あり', livingOther: [], livingCustom: '',
    work: 'している', job: ['会社員（デスクワーク）'], jobNote: '', activity: '座っていることが多い',
    otherDiseases: SAMPLE_OTHER_DISEASES,
  },
  body: { hba1c: '5.8', height: '159', weightNow: '63', weightPregnancy: '55', weight20: '50', weightMax: '63', weightMaxAge: '32', concern: '', preferredDays: ['火'], doctorGender: '女性医師希望', patientFlag: '通常', doubleSlot: false },
  // ★ここが赤字になる（3 回分そろった状態＝「取得済」＋日付）
  libre: { firstVisit: dayFromToday(7), follow1: dayFromToday(21), follow2: dayFromToday(35) },
}

/** 反応性低血糖: リブレを初事前で装着した記録が赤字で出る */
const SAMPLE_RH = {
  voiceMemo: { transcript: '', aiSummary: '', needsDoctorReview: false },
  voicePastHistory: { transcript: '', aiSummary: '', needsDoctorReview: false },
  reason: { referralLetter: '持参なし' },
  symptom: {
    timing: ['食後2〜3時間'], timingNote: '',
    symptoms: ['冷汗', '動悸', '手のふるえ'], symptomsNote: '週に1〜2回',
    cause: ['炭水化物中心の食事'], causeNote: '',
    cgmWish: '',
  },
  history: {
    age: '44', allergy: 'なし', allergyDetail: '',
    fh: { dm: true, dmWho: ['父'], ht: false, hl: true, apo: false, ihd: false },
    alcoholNone: true, alcoholItems: [{ type: '', amount: '', freq: '' }],
    smoking: 'なし', smokingAmount: '', smokingYears: '', smokingStartAge: '',
    smokingQuitEra: '令和', smokingQuitYear: '',
    checkup: ['市の健診'], vaccine65Prevena: '', vaccine65Herpes: '',
    livingSpouse: '配偶者あり', livingOther: [], livingCustom: '',
    work: 'している', job: ['会社員（デスクワーク）'], jobNote: '', activity: '座っていることが多い',
    otherDiseases: SAMPLE_OTHER_DISEASES,
  },
  body: { hba1c: '5.4', height: '166', weightNow: '61', weight20: '58', weightMax: '68', weightMaxAge: '38', concern: '仕事中に倒れないか不安', preferredDays: ['土'], doctorGender: '', patientFlag: '通常', doubleSlot: false },
  // ★ここが赤字になる（本日装着）
  libre: { attached: '装着済', date: dayFromToday(0), note: '' },
}

/**
 * 印刷見本の一覧（/print/sample の切り替え）。
 * 先頭が既定＝いちばん厳しい回。赤字の確認は 2 番目以降で行う。
 */
export const PRINT_SAMPLES = [
  {
    key: 'strict',
    label: 'いちばん厳しい回',
    note: 'カルテがいちばん長い 1型糖尿病 ＋ ドクターキューブ貼り付けあり',
    formType: SAMPLE_FORM_TYPE,
    formData: SAMPLE_FORM_DATA,
    age: 58,
  },
  {
    key: 'gdm',
    label: '赤字（妊娠糖尿病の予約）',
    note: '妊娠糖尿病 — リブレ装着の予約3回分が赤字で出ます',
    formType: '妊娠糖尿病',
    formData: SAMPLE_GDM,
    age: 33,
    red: true,
  },
  {
    key: 'rh',
    label: '赤字（リブレ装着）',
    note: '反応性低血糖 — 初事前でリブレを装着した記録が赤字で出ます',
    formType: '反応性低血糖',
    formData: SAMPLE_RH,
    age: 44,
    red: true,
  },
]

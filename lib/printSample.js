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

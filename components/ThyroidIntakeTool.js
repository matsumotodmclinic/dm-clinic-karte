import { useState, useRef } from "react";
import { useRouter } from "next/router";
import { copyKarteToClipboard } from "../lib/copyKarte";
import { makeFormStyles, FORM_THEMES } from "../lib/formStyles";

// スタイルは lib/formStyles.js に集約（テーマ色は移行前と同一）
const { inp, lbl, btn, sBox } = makeFormStyles(FORM_THEMES.teal);

const TC = "#0d7d6a";
const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "指定なし"];
const ALLERGY_QUICK = ["花粉", "ペニシリン", "造影剤", "フルーツ", "金属"];

const FORM_META = {
  'basedow-new':   { label: 'バセドウ病（初診）',     dbLabel: '甲状腺（バセドウ初診）',   steps: 3 },
  'basedow-cont':  { label: 'バセドウ病（継続）',     dbLabel: '甲状腺（バセドウ継続）',   steps: 3 },
  'hashimoto':     { label: '橋本病',                 dbLabel: '甲状腺（橋本病）',         steps: 3 },
  'nodule-normal': { label: '甲状腺腫大（異常なし）', dbLabel: '甲状腺（腫大異常なし）',   steps: 2 },
  'adenoma':       { label: '甲状腺腺腫（経過観察）', dbLabel: '甲状腺（腺腫経過観察）',   steps: 3 },
  'malignant':     { label: '甲状腺腺腫（悪性疑い）', dbLabel: '甲状腺（腺腫悪性疑い）',   steps: 2 },
};

const BASEDOW_SYMPTOMS = [
  "動悸・息切れ", "手の震え", "体重減少", "暑がり・多汗",
  "眼球突出・眼の違和感", "倦怠感", "下痢・軟便", "月経異常", "イライラ・不眠",
];
const HASHIMOTO_SYMPTOMS = [
  "疲れやすさ・倦怠感", "体重増加", "寒がり", "浮腫（むくみ）",
  "便秘", "皮膚乾燥・脱毛", "月経異常", "物忘れ", "声のかすれ",
];
const NODULE_SYMPTOMS = [
  "甲状腺の腫れ・しこり感", "嚥下困難", "頸部の違和感・疼痛", "声のかすれ", "その他",
];
const BASEDOW_CONT_SYMPTOMS = [
  "現在は症状なし",
  "動悸", "発汗", "手の震え", "いらいら", "便秘", "皮膚の乾燥",
  "声の枯れ", "動作がゆっくり", "物忘れが多い", "1日中眠い",
  "月経不順", "食べても痩せる", "体重が増えてきた", "疲れやすい",
  "むくみ（顔　足）", "圧痛がある→Dr.へ報告",
];

function getStepTitles(formType) {
  const is2step = formType === 'nodule-normal' || formType === 'malignant';
  return is2step
    ? [{ id: "reason", title: "受診理由・エコー所見" }, { id: "body", title: "症状・体格" }]
    : [{ id: "reason", title: "受診理由・エコー所見" }, { id: "history", title: "症状・既往歴" }, { id: "body", title: "生活情報・体格" }];
}


const initialData = {
  reason: { summary: "", type: "", referralFrom: "", referralDept: "", referralDetail: "", checkupType: "", transferFrom: "", transferDetail: "", thyroidConcern: false, thyroidConcernReason: [], thyroidConcernNote: "" },
  echo: {
    // 甲状腺ベース所見（全フォーム共通）
    thyroidSize: "",        // 腫大 / 萎縮 / 正常
    thyroidBloodFlow: "",   // 豊富 / 低下 / 正常
    thyroidParenchyma: "",  // 整 / 不整 / 不均一
    ecg: "",                // 正常範囲 / 心房細動
    // 結節について（全フォーム共通）
    hasNodule: "",          // あり / なし
    // 結節サブ（hasNodule==='あり'の場合のみ表示）
    noduleLocation: "",     // 両葉 / 右葉 / 左葉
    noduleSizeW: "",        // mm
    noduleSizeD: "",        // mm
    noduleCount: "",        // 単発 / 多発
    calcification: "",      // あり / なし
    noduleBloodFlow: "",    // 豊富 / 乏しい / 不明
    noduleType: "",         // 充実性 / 嚢胞性 / 混合性 / 境界不明瞭
    noduleOther: "",        // 自由記入
  },
  symptom: { selected: [], otherText: "" },
  history: {
    surgeryHistory: false, surgeryYear: "", surgeryMonth: "", surgeryType: "",
    isotopeHistory: false,
    sideEffectMmz: false, sideEffectPtz: false,
    eyeHistory: false, eyeClinic: "",
    treatmentHistory: "",
    diagnosisEra: "令和", diagnosisYear: "", diagnosisMonth: "", medications: [],
    age: "", allergy: "なし", allergyDetail: "",
    fh: { thyroid: false, thyroidWho: [], dm: false, dmWho: [] },
    smoking: "なし", smokingAmount: "", smokingYears: "", smokingStartAge: "",
    smokingQuitEra: "令和", smokingQuitYear: "",
    checkup: [],
    work: "していない", job: [], jobNote: "", activity: "",
  },
  body: {
    height: "", weightNow: "", weight20: "", weightMax: "", weightMaxAge: "",
    preferredDays: [], doctorGender: "", patientFlag: "通常", doubleSlot: false, concern: "",
  },
};

function EraYear({ era, year, onEraChange, onYearChange }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <select style={{ ...inp(), width: 96 }} value={era} onChange={e => onEraChange(e.target.value)}>
        <option>昭和</option><option>平成</option><option>令和</option>
      </select>
      <input style={{ ...inp(), width: 68 }} type="number" placeholder="年" value={year} onChange={e => onYearChange(e.target.value)} />
      <span style={{ fontSize: 13, color: "#666" }}>年ごろ</span>
    </div>
  );
}

export default function ThyroidIntakeTool({ formType }) {
  const router = useRouter();
  const meta = FORM_META[formType] || FORM_META['basedow-new'];
  const steps = getStepTitles(formType);
  const is2step = steps.length === 2;
  const isBasedow = formType === 'basedow-new' || formType === 'basedow-cont';
  const isHashimoto = formType === 'hashimoto';
  const isNodule = ['adenoma', 'nodule-normal', 'malignant'].includes(formType);

  const [step, setStep] = useState(0);
  const [data, setData] = useState(initialData);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [visitCode, setVisitCode] = useState("");
  const [recordId, setRecordId] = useState("");
  const [showKarte, setShowKarte] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const topRef = useRef(null);

  const scrollTop = () => { if (topRef.current) topRef.current.scrollIntoView({ behavior: "smooth" }); };
  const bmi = data.body.height && data.body.weightNow
    ? (parseFloat(data.body.weightNow) / Math.pow(parseFloat(data.body.height) / 100, 2)).toFixed(1) : null;
  const goStep = (n) => { setStep(n); setTimeout(scrollTop, 50); };
  const up = (sec, f, v) => setData(p => ({ ...p, [sec]: { ...p[sec], [f]: v } }));
  const upN = (sec, par, f, v) => setData(p => ({ ...p, [sec]: { ...p[sec], [par]: { ...p[sec][par], [f]: v } } }));
  const toggleArr = (sec, f, v) => setData(p => { const a = p[sec][f] || []; return { ...p, [sec]: { ...p[sec], [f]: a.includes(v) ? a.filter(x => x !== v) : [...a, v] } }; });
  const toggleSym = (v) => setData(p => { const a = p.symptom.selected || []; return { ...p, symptom: { ...p.symptom, selected: a.includes(v) ? a.filter(x => x !== v) : [...a, v] } }; });

  const age = parseInt(data.history.age) || 0;
  const isOver60 = age >= 60;

  const buildSmoking = () => {
    const s = data.history;
    if (s.smoking === "なし") return "なし";
    const base = `${s.smokingAmount}本×${s.smokingYears}年（${s.smokingStartAge}歳〜）`;
    return s.smoking === "禁煙済" ? `${base}、${s.smokingQuitEra}${s.smokingQuitYear}年に禁煙` : base;
  };
  const buildWeekday = () => {
    const days = data.body.preferredDays || [];
    if (!days.length) return "曜希望";
    if (days.includes("指定なし")) return "曜希望：指定なし";
    return `${days.join("・")}曜希望`;
  };
  const getCurrentMonth = () => {
    const now = new Date();
    return `R${now.getFullYear() - 2018}.${now.getMonth() + 1}`;
  };
  const getSymptomList = () => {
    if (formType === 'basedow-cont') return BASEDOW_CONT_SYMPTOMS;
    if (isBasedow) return BASEDOW_SYMPTOMS;
    if (isHashimoto) return HASHIMOTO_SYMPTOMS;
    return NODULE_SYMPTOMS;
  };

  const copyToClipboard = (text) => copyKarteToClipboard(text);

  const handleSaveRetry = async () => {
    setSaveError(false);
    try {
      const saveRes = await fetch("/api/questionnaire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ form_type: meta.dbLabel, form_data: data, age: data.history.age || null, generated_karte: result }) });
      const saveJson = await saveRes.json();
      if (saveJson.visit_code) { setVisitCode(saveJson.visit_code); if (saveJson.id) setRecordId(saveJson.id); }
      else setSaveError(true);
    } catch (e) { setSaveError(true); }
  };

  const saveEditedKarte = async () => {
    if (saving) return;
    if (!recordId) { setSaveMsg("保存先IDが見つかりません"); setTimeout(() => setSaveMsg(""), 3000); return; }
    setSaving(true); setSaveMsg("");
    try {
      const res = await fetch("/api/questionnaire", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: recordId, generated_karte: result }) });
      if (res.ok) { setSaveMsg("✓ 保存しました"); setTimeout(() => setSaveMsg(""), 2500); }
      else { setSaveMsg("保存に失敗しました"); setTimeout(() => setSaveMsg(""), 3000); }
    } catch (e) { setSaveMsg("保存に失敗しました"); setTimeout(() => setSaveMsg(""), 3000); }
    finally { setSaving(false); }
  };

  const generateKarte = async () => {
    setLoading(true);
    const symptomsText = (data.symptom.selected || []).join("・") + (data.symptom.otherText ? `（その他: ${data.symptom.otherText}）` : "");

    let diagnosisName = "";
    if (formType === 'basedow-new') diagnosisName = "＃バセドウ病疑い（エコー上の疑い）";
    else if (formType === 'basedow-cont') {
      const dYear = data.history.diagnosisYear
        ? `${data.history.diagnosisEra}${data.history.diagnosisYear}年`
        : "診断時期不明";
      diagnosisName = `＃バセドウ病　甲状腺機能亢進症（診断時期：${dYear}）`;
    }
    else if (formType === 'hashimoto') diagnosisName = "＃橋本病疑い（エコー上の疑い）";
    else if (formType === 'nodule-normal') diagnosisName = "＃甲状腺腫大（エコー上異常なし）";
    else if (formType === 'adenoma') diagnosisName = "＃甲状腺腺腫（経過観察）疑い";
    else if (formType === 'malignant') diagnosisName = "＃甲状腺腺腫（悪性疑い）";

    let shinsokuLines = "";
    if (formType === 'basedow-new' || formType === 'hashimoto') {
      shinsokuLines = "□甲状腺3項目＋甲状腺抗体3項目の結果を後日確認\n□あくまでエコー上の疑いであり、確定診断は医師が行いカルテ記載を完了する";
    } else if (formType === 'basedow-cont') {
      shinsokuLines = "□甲状腺3項目＋甲状腺抗体3項目の結果を後日確認\n□あくまでエコー上の所見であり、確定診断は医師が行いカルテ記載を完了する";
    } else if (formType === 'nodule-normal') {
      shinsokuLines = "□甲状腺3項目＋抗Tg抗体＋抗TPO抗体の結果を後日確認\n□本日初診にて診察（終診の可能性あり）";
    } else if (formType === 'adenoma') {
      shinsokuLines = "□甲状腺3項目＋抗Tg抗体＋抗TPO抗体の結果を後日確認\n□あくまでエコー上の所見であり、確定診断は医師が行いカルテ記載を完了する";
    } else if (formType === 'malignant') {
      shinsokuLines = "□当日、初事前診察に変更し専門医療機関へ紹介\n□当院は終診";
    }

    let footerBloodTest = "";
    if (formType === 'basedow-new') footerBloodTest = "甲状腺3項目：　TRAb：　TPO抗体：　抗Tg抗体：";
    else if (formType === 'hashimoto') footerBloodTest = "甲状腺3項目＋甲状腺抗体3項目";
    else if (formType === 'basedow-cont') footerBloodTest = "甲状腺3項目：　TRAb：　抗Tg抗体：　抗TPO抗体：";
    else if (formType === 'nodule-normal') footerBloodTest = "甲状腺3項目：　TRAb：　抗Tg抗体：　抗TPO抗体：";
    else if (formType === 'adenoma') footerBloodTest = "甲状腺3項目：　TRAb：　抗Tg抗体：　抗TPO抗体：";

    const jobText = (() => {
      const jobs = Array.isArray(data.history.job) ? data.history.job : (data.history.job ? [data.history.job] : []);
      const note = data.history.jobNote || "";
      return [jobs.join("、"), note].filter(Boolean).join("・");
    })();

    const contMedsText = (data.history.medications || []).join("・");
    const contTimeline = (() => {
      if (formType !== 'basedow-cont' || !contMedsText) return "";
      const year = data.history.diagnosisYear;
      const month = data.history.diagnosisMonth;
      const era = data.history.diagnosisEra;
      if (!year) return `（${contMedsText}）内服にて症状安定`;
      const dateStr = era === "令和"
        ? `R${year}${month ? `/${month}` : ""}`
        : `${era}${year}年${month ? `${month}月` : ""}`;
      return `${dateStr}に（${contMedsText}）内服にて症状安定`;
    })();
    const surgeryText = (() => {
      if (!data.history.surgeryHistory) return "なし";
      const yr = data.history.surgeryYear;
      const mo = data.history.surgeryMonth;
      const type = data.history.surgeryType || "";
      const dateStr = yr ? `R${yr}${mo ? `/${mo}` : ""}` : "";
      return `あり（${[dateStr, type].filter(Boolean).join(" ")}）`;
    })();
    const sideEffectText = (() => {
      const parts = [];
      if (data.history.sideEffectMmz) parts.push("メルカゾール");
      if (data.history.sideEffectPtz) parts.push("プロパジール");
      return parts.length ? `${parts.join("・")}副作用あり` : "なし";
    })();

    // 全6フォーム共通: 甲状腺ベース所見 3軸（サイズ/血流/実質エコー）
    // 「正常」は所見として記載しないので除外
    const thyBaseFindings = [
      data.echo.thyroidSize === "腫大"        && "甲状腺腫大(+)",
      data.echo.thyroidSize === "萎縮"        && "甲状腺萎縮(+)",
      data.echo.thyroidBloodFlow === "豊富"   && "血流豊富(+)",
      data.echo.thyroidBloodFlow === "低下"   && "血流低下(+)",
      data.echo.thyroidParenchyma === "整"    && "実質エコー整(+)",
      data.echo.thyroidParenchyma === "不整"  && "実質エコー不整(+)",
      data.echo.thyroidParenchyma === "不均一" && "実質エコー不均一(+)",
    ].filter(Boolean);
    const thyBaseFindingsText = thyBaseFindings.join("、");

    // フォーム別: メイン「当院エコーにて...」結語行
    const thyEchoConclusion = (() => {
      if (formType === 'malignant')     return '当院エコーにて悪性を疑う所見を認め当日紹介。';
      if (formType === 'adenoma')       return '当院エコーにて結節を認めたため、エコー定期followとする。';
      if (formType === 'nodule-normal') return thyBaseFindings.length > 0
        ? `当院エコーにて${thyBaseFindingsText}を認める`
        : '当院エコーにて明らかな異常所見なし';
      if (thyBaseFindings.length === 0) return '';
      if (formType === 'basedow-new')   return `当院エコーにて${thyBaseFindingsText}を認めバセドウ病を疑う`;
      if (formType === 'basedow-cont')  return `当院エコーにて${thyBaseFindingsText}を認める`;
      if (formType === 'hashimoto')     return `当院エコーにて${thyBaseFindingsText}を認め橋本病を疑う`;
      return '';
    })();

    // 結節フォーム（adenoma/malignant）でベース所見がある場合の補助行
    const thyBaseExtraLine = (formType === 'malignant' || formType === 'adenoma') && thyBaseFindings.length > 0
      ? `${thyBaseFindingsText}を認める`
      : '';

    // 結節所見1行（hasNodule==='あり'のときのみ）
    // 例: 「両葉に最大15×8㎜大の結節あり、石灰化あり、血流豊富、充実性」
    const noduleEchoLine = (() => {
      if (data.echo.hasNodule !== "あり") return "";
      const parts = [];
      const loc = data.echo.noduleLocation;
      const w = data.echo.noduleSizeW;
      const d = data.echo.noduleSizeD;
      const noduleWord = data.echo.noduleCount === "多発" ? "多発結節" : "結節";
      if (loc && (w || d)) {
        parts.push(`${loc}に最大${w || "○"}×${d || "○"}㎜大の${noduleWord}あり`);
      } else if (loc) {
        parts.push(`${loc}に${noduleWord}あり`);
      } else if (w || d) {
        parts.push(`最大${w || "○"}×${d || "○"}㎜大の${noduleWord}あり`);
      }
      if (data.echo.calcification) parts.push(`石灰化${data.echo.calcification}`);
      if (data.echo.noduleBloodFlow === "豊富") parts.push("血流豊富");
      else if (data.echo.noduleBloodFlow === "乏しい") parts.push("血流に乏しい");
      if (data.echo.noduleType) parts.push(data.echo.noduleType);
      if (data.echo.noduleOther) parts.push(data.echo.noduleOther);
      return parts.join("、");
    })();
    const thyReasonText = (() => {
      const r = data.reason;
      const parts = [];
      if (r.thyroidConcern) {
        const reasonsArr = Array.isArray(r.thyroidConcernReason) ? r.thyroidConcernReason : (r.thyroidConcernReason ? [r.thyroidConcernReason] : []);
        const noOther = reasonsArr.filter(x => x !== 'その他');
        const otherText = reasonsArr.includes('その他') && r.thyroidConcernNote ? r.thyroidConcernNote : '';
        const reasonText = [...noOther, otherText].filter(Boolean).join('・');
        parts.push(reasonText ? `甲状腺疾患が気になって受診（${reasonText}）` : '甲状腺疾患が気になって受診');
      } else if (r.type === "紹介") {
        const ref = [r.referralFrom, r.referralDept].filter(Boolean).join("・");
        if (ref) parts.push(`${ref}より紹介`);
        if (r.referralDetail) parts.push(r.referralDetail);
      } else if (r.type === "検診異常") {
        parts.push(`${r.checkupType || "健診"}にて甲状腺異常を指摘`);
      } else if (r.type === "自主転院") {
        if (r.transferFrom) parts.push(`${r.transferFrom}より転院`);
        if (r.transferDetail) parts.push(r.transferDetail);
      }
      if (r.summary) parts.push(r.summary);
      return parts.join("、");
    })();

    const prompt = `あなたはまつもと糖尿病クリニックの電子カルテ記載AIです。以下の患者情報をもとに、甲状腺外来の初診カルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③【事前聴取時 申し送り事項】の最終□行と【診察にあたっての要望】の間も空行なし
- 追加の空行ルール（厳守）: ④条件付きで該当しない項目（空文字に展開された行）はその行ごと完全に省略し、空行を残さない ⑤エコー所見ブロック（＃診断名・結語・結節所見・ベース所見）と【アレルギー歴】の間のみ1行空ける、それ以外のセクション間（【アレルギー歴】【FH】【喫煙歴】【健診】【仕事】など）は全て空行なし ⑥フッター「R8.5：採血項目」の直下、アレルギー薬警告が該当しない場合はその行ごと省略し、フォローアップ行（"1月follow" "6か月follow" "（当日紹介、当院終診）" 等）に直接続ける ⑦区切り線（---------）は連続させず、その間に必ず1行以上の内容を入れる
- 注意書き・内部メモは出力しない。HTMLタグ・style属性は絶対に出力しない
- バセドウ初診の「甲状腺エコー：」行は後ろに何も追記せず「甲状腺エコー：」のみ出力する

【患者情報】
受診理由：${thyReasonText || data.reason.summary || "（未記入）"}
${data.reason.thyroidConcern ? `※「甲状腺疾患が気になって受診」の患者です。受診理由サマリーは検査前の暫定的な経緯として記載してください。` : ""}
${formType === 'basedow-cont' ? `診断時期：${data.history.diagnosisEra}${data.history.diagnosisYear || "（不明）"}年\n内服薬：${contMedsText || "（未選択）"}` : ""}
甲状腺ベース所見：${thyBaseFindingsText || "（未選択 or 全て正常）"}
${formType === 'basedow-new' && data.echo.ecg ? `ECG：${data.echo.ecg}` : ""}
結節について：${data.echo.hasNodule || "未選択"}
${data.echo.hasNodule === "あり" && noduleEchoLine ? `結節所見（整形済み）：${noduleEchoLine}` : ""}
症状：${symptomsText || "なし"}
年齢：${data.history.age || "未記入"}歳
アレルギー：${data.history.allergy === "なし" ? "なし" : (data.history.allergyDetail || "あり")}
${!is2step ? `家族歴（甲状腺）：${data.history.fh.thyroid ? ("あり" + (data.history.fh.thyroidWho?.length ? `（${data.history.fh.thyroidWho.join("・")}）` : "")) : "なし"}
家族歴（DM）：${data.history.fh.dm ? ("あり" + (data.history.fh.dmWho?.length ? `（${data.history.fh.dmWho.join("・")}）` : "")) : "なし"}
喫煙歴：${buildSmoking()}
健診：${(data.history.checkup || []).join("・") || "なし"}
仕事：${jobText || "未記入"}
活動量：${data.history.activity || "未記入"}` : ""}
${formType === 'basedow-cont' ? `手術歴：${surgeryText}
アイソトープ治療歴：${data.history.isotopeHistory ? "あり" : "なし"}
薬の副作用歴：${sideEffectText}
眼科通院歴：${data.history.eyeHistory ? ("あり" + (data.history.eyeClinic ? `（${data.history.eyeClinic}）` : "")) : "なし"}` : ""}
${formType === 'hashimoto' && data.history.treatmentHistory ? `治療経緯：${data.history.treatmentHistory}` : ""}
医師希望：${data.body.doctorGender || "指定なし"}
患者フラグ：${data.body.patientFlag || "通常"}
診察への要望：${data.body.concern || "なし"}

${(() => {
  // 出力フォーマットを空行が混ざらないよう配列で組み立てて join する
  const reasonLine = `${getCurrentMonth()}：（受診理由サマリー1〜2行。${symptomsText ? `自覚症状チェックあり: ${symptomsText} → サマリー末尾に「${symptomsText}の訴えあり。」を必ず追記し、＃診断名の上に位置するようにする` : '自覚症状なしの場合は症状追記は省略'}）`;
  const diagnosisLine = `${diagnosisName}（サマリーの直後、空行なし）`;
  const echoBlock = [
    formType === 'basedow-cont' && contTimeline ? contTimeline : '',
    formType === 'basedow-cont' ? `手術歴：${surgeryText}　アイソトープ歴：${data.history.isotopeHistory ? "あり" : "なし"}　副作用歴：${sideEffectText}　眼科：${data.history.eyeHistory ? ("あり" + (data.history.eyeClinic ? `（${data.history.eyeClinic}）` : "")) : "なし"}` : '',
    thyEchoConclusion,
    thyBaseExtraLine,
    noduleEchoLine,
    formType === 'basedow-new' && data.echo.ecg ? `ECG：${data.echo.ecg}` : '',
  ].filter(Boolean).join('\n');

  const fhBlock = !is2step ? [
    '【FH】甲状腺(-/+) DM(-/+)（該当者名も記載）',
    '【喫煙歴】（整形済みテキスト）',
    '【健診】',
    formType !== 'adenoma' ? '【仕事】職業・活動量' : '',
  ].filter(Boolean).join('\n') : '';

  const dividerEchoLine = (formType === 'malignant' || formType === 'nodule-normal' || formType === 'adenoma')
    ? '空欄：検査技師が後ほど貼り付けます。'
    : `甲状腺エコー：${formType === 'basedow-new' ? '' : (() => {
        const segs = [];
        if (thyBaseFindingsText) segs.push(thyBaseFindingsText);
        if (noduleEchoLine) segs.push(noduleEchoLine);
        return segs.length ? segs.join('　') : '本日施行';
      })()}`;

  const heightBlock = (formType === 'malignant' || formType === 'adenoma') ? '' : `身長:${data.body.height || "○"}cm　初診時:${data.body.weightNow || "○"}kg${bmi ? `（BMI ${bmi}）` : ""}\n---------------------------------------------`;

  const shinsokuItems = [
    formType === 'malignant' ? '' : '□通院のご案内をお渡し済',
    shinsokuLines,
    '（新患2枠取得済の場合）□新患2枠取得済み',
    `（医師希望指定ありの場合）□${data.body.doctorGender || "指定なし"}`,
    '（患者フラグが「○患者疑い」の場合）□○患者疑い（対応注意）',
    '（患者フラグが「●患者疑い」の場合）□●患者疑い（出禁対象・要確認）',
  ].filter(Boolean).join('\n');

  const footerTrailing = formType === 'malignant'
    ? '（当日紹介、当院終診）'
    : formType === 'adenoma'
      ? `6か月follow\n${buildWeekday()}\nLINE登録ご案内→済　登録確認未・登録できない`
      : `1月follow\n${buildWeekday()}\nLINE登録ご案内→済　登録確認未・登録できない`;

  return `【出力フォーマット】
${reasonLine}
${diagnosisLine}
${echoBlock}

【アレルギー歴】（なしまたは内容を同じ行に）
${fhBlock ? fhBlock + '\n' : ''}---------------------------------------------
${dividerEchoLine}
---------------------------------------------
${heightBlock ? heightBlock + '\n' : ''}【事前聴取時　申し送り事項】
${shinsokuItems}
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${getCurrentMonth()}：${footerBloodTest}

（アレルギー薬がある場合のみ「⚠️○○アレルギー⚠️」と1行で記載。HTMLタグ・style属性は絶対に出力しない。プレーンテキストのみ）
${footerTrailing}`;
})()}`;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
      });
      const json = await res.json();
      const raw = json.content?.[0]?.text || "生成に失敗しました";
      // 連続する空行を最大1行に圧縮（条件付き行が空展開された箇所のクリーンアップ）
      const generated = raw
        .split('\n').map(l => l.replace(/[ 　\t]+$/, '')).join('\n')  // 各行の末尾空白除去
        .replace(/\n{3,}/g, '\n\n')                                     // 連続改行を2つに圧縮
        .trim();
      setResult(generated);

      try {
        const saveRes = await fetch("/api/questionnaire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ form_type: meta.dbLabel, form_data: data, age: data.history.age || null, generated_karte: generated }),
        });
        const saveJson = await saveRes.json();
        if (saveJson.visit_code) { setVisitCode(saveJson.visit_code); if (saveJson.id) setRecordId(saveJson.id); }
        else setSaveError(true);
      } catch (saveErr) { setSaveError(true); }

      setDone(true);
      setTimeout(scrollTop, 50);
    } catch (e) { setResult("エラー: " + e.message); setDone(true); }
    setLoading(false);
  };

  // ── Step 0: 受診理由・エコー所見 ──────────────────────────
  const renderStep0 = () => (
    <div>
      <label style={lbl()}>受診理由</label>
      <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 14 }}>
        {["紹介", "検診異常", "自主転院"].map(r => (
          <button key={r} style={btn(data.reason.type === r)} onClick={() => setData(p => ({ ...p, reason: { ...p.reason, type: r, thyroidConcern: false } }))}>{r}</button>
        ))}
        <button style={btn(data.reason.thyroidConcern, '#8e44ad')} onClick={() => setData(p => ({ ...p, reason: { ...p.reason, thyroidConcern: !p.reason.thyroidConcern, type: !p.reason.thyroidConcern ? '' : p.reason.type } }))}>
          {data.reason.thyroidConcern ? '✓ 甲状腺疾患が気になる' : '甲状腺疾患が気になる'}
        </button>
      </div>

      {data.reason.thyroidConcern && (
        <div style={{ ...sBox({ border: "1.5px solid #d6bcfa", background: "#faf5ff" }), marginBottom: 14 }}>
          <label style={lbl({ color: '#8e44ad' })}>気になる理由（複数選択可）</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
            {['家族に甲状腺疾患の方がいる', '健診で甲状腺異常を指摘された', '首の腫れが気になる', '動悸・倦怠感・むくみ等の症状が気になる', 'その他'].map(v => {
              const arr = Array.isArray(data.reason.thyroidConcernReason) ? data.reason.thyroidConcernReason : [];
              const sel = arr.includes(v);
              return (
                <button key={v} style={btn(sel, '#8e44ad')} onClick={() => setData(p => {
                  const cur = Array.isArray(p.reason.thyroidConcernReason) ? p.reason.thyroidConcernReason : [];
                  const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
                  return { ...p, reason: { ...p.reason, thyroidConcernReason: next } };
                })}>{sel ? '✓ ' : ''}{v}</button>
              );
            })}
          </div>
          {(Array.isArray(data.reason.thyroidConcernReason) ? data.reason.thyroidConcernReason : []).includes('その他') && (
            <input style={inp()} placeholder="詳しく教えてください" value={data.reason.thyroidConcernNote} onChange={e => up('reason', 'thyroidConcernNote', e.target.value)} />
          )}
        </div>
      )}

      {data.reason.type === "紹介" && (
        <div style={sBox()}>
          <label style={lbl()}>よく使う紹介元</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {[
              { hosp: "上尾中央総合病院", dept: "耳鼻科" },
              { hosp: "自治医大さいたま医療センター", dept: "内分泌内科" },
              { hosp: "さいたま赤十字病院", dept: "内分泌内科" },
            ].map(({ hosp, dept }) => {
              const selected = data.reason.referralFrom === hosp && data.reason.referralDept === dept;
              return (
                <button key={hosp + dept}
                  style={{ ...btn(selected, "#0f9668"), fontSize: 12, padding: "7px 14px", border: selected ? "2px solid #0f9668" : "2px dashed #0f9668", background: selected ? "#0f9668" : "#f0fff8", color: selected ? "#fff" : "#0f9668" }}
                  onClick={() => setData(p => ({ ...p, reason: { ...p.reason, referralFrom: selected ? "" : hosp, referralDept: selected ? "" : dept } }))}>
                  {selected ? "✓ " : ""}{hosp}・{dept}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 2 }}>
              <label style={lbl()}>その他の病院名</label>
              <input style={inp()} placeholder="上記以外の場合" value={data.reason.referralFrom} onChange={e => up("reason", "referralFrom", e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl()}>科名</label>
              <input style={inp()} placeholder="例：内科" value={data.reason.referralDept} onChange={e => up("reason", "referralDept", e.target.value)} />
            </div>
          </div>
          <label style={lbl()}>紹介の理由</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {["甲状腺疾患精査のため", "甲状腺腫大のため", "専門的管理のため", "安定している為", "転居のため", "内容不明"].map(v => (
              <button key={v} style={btn(data.reason.referralDetail === v)} onClick={() => up("reason", "referralDetail", v)}>{v}</button>
            ))}
          </div>
        </div>
      )}

      {data.reason.type === "検診異常" && (
        <div style={sBox()}>
          <label style={lbl()}>検診の種類</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {["会社健診", "市健診", "人間ドック"].map(v => (
              <button key={v} style={btn(data.reason.checkupType === v)} onClick={() => up("reason", "checkupType", v)}>{v}</button>
            ))}
          </div>
        </div>
      )}

      {data.reason.type === "自主転院" && (
        <div style={sBox()}>
          <label style={lbl()}>転院元 医療機関名</label>
          <input style={{ ...inp(), marginBottom: 12 }} placeholder="例：○○クリニック（任意）" value={data.reason.transferFrom} onChange={e => up("reason", "transferFrom", e.target.value)} />
          <label style={lbl()}>転院の理由</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {["コントロール改善しないため", "転居のため", "より専門的な治療を希望", "その他"].map(v => (
              <button key={v} style={btn(data.reason.transferDetail === v)} onClick={() => up("reason", "transferDetail", v)}>{v}</button>
            ))}
          </div>
        </div>
      )}

      <label style={{ ...lbl(), marginTop: 8 }}>自由記入欄（任意）</label>
      <textarea style={{ ...inp(), minHeight: 60, resize: "vertical", marginBottom: 14 }} placeholder="補足があれば記載" value={data.reason.summary} onChange={e => up("reason", "summary", e.target.value)} />

      {formType === 'basedow-cont' && (
        <div style={sBox({ background: "#fff8e1", border: "1.5px solid #fbd38d" })}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#a67000", marginBottom: 14 }}>🔄 バセドウ病：治療歴（継続患者）</div>

          {/* 診断時期 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#a67000", marginBottom: 6 }}>診断時期</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select style={{ ...inp(), width: 80 }} value={data.history.diagnosisEra} onChange={e => up("history", "diagnosisEra", e.target.value)}>
                <option>昭和</option><option>平成</option><option>令和</option>
              </select>
              <input style={{ ...inp(), width: 56 }} type="number" placeholder="年" value={data.history.diagnosisYear} onChange={e => up("history", "diagnosisYear", e.target.value)} />
              <span style={{ fontSize: 13, color: "#666" }}>年</span>
              <input style={{ ...inp(), width: 48 }} type="number" placeholder="月" min="1" max="12" value={data.history.diagnosisMonth} onChange={e => up("history", "diagnosisMonth", e.target.value)} />
              <span style={{ fontSize: 13, color: "#666" }}>月ごろ</span>
            </div>
          </div>

          {/* 内服薬 */}
          <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #fbd38d" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#a67000", marginBottom: 6 }}>内服薬（複数選択可）</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {["メルカゾール", "ヨウ化カリウム", "プロパジール"].map(med => {
                const sel = (data.history.medications || []).includes(med);
                return (
                  <button key={med} style={btn(sel, "#a67000")}
                    onClick={() => up("history", "medications", sel
                      ? (data.history.medications || []).filter(m => m !== med)
                      : [...(data.history.medications || []), med])}>
                    {sel ? "✓ " : ""}{med}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 手術歴 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#a67000", marginBottom: 6 }}>手術歴</div>
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              <button style={btn(data.history.surgeryHistory === true, "#a67000", { padding: "5px 20px", fontSize: 12 })} onClick={() => up("history", "surgeryHistory", true)}>あり</button>
              <button style={btn(data.history.surgeryHistory === false, "#a67000", { padding: "5px 20px", fontSize: 12 })} onClick={() => up("history", "surgeryHistory", false)}>なし</button>
            </div>
            {data.history.surgeryHistory && (
              <div style={{ paddingLeft: 4, marginTop: 4 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#a67000" }}>R</span>
                  <input style={{ ...inp(), width: 52 }} type="number" placeholder="年" value={data.history.surgeryYear} onChange={e => up("history", "surgeryYear", e.target.value)} />
                  <span style={{ fontSize: 13, color: "#666" }}>/</span>
                  <input style={{ ...inp(), width: 46 }} type="number" placeholder="月" min="1" max="12" value={data.history.surgeryMonth} onChange={e => up("history", "surgeryMonth", e.target.value)} />
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  {["全摘", "部分切除"].map(v => (
                    <button key={v} style={{ ...btn(data.history.surgeryType === v, "#a67000"), padding: "5px 14px", fontSize: 12 }}
                      onClick={() => up("history", "surgeryType", v)}>{v}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* アイソトープ */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#a67000", marginBottom: 6 }}>放射性ヨウ素（アイソトープ）内用療法</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={btn(data.history.isotopeHistory === true, "#a67000", { padding: "5px 20px", fontSize: 12 })} onClick={() => up("history", "isotopeHistory", true)}>あり</button>
              <button style={btn(data.history.isotopeHistory === false, "#a67000", { padding: "5px 20px", fontSize: 12 })} onClick={() => up("history", "isotopeHistory", false)}>なし</button>
            </div>
          </div>

          {/* 薬の副作用歴 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#a67000", marginBottom: 8 }}>薬の副作用歴</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[["sideEffectMmz", "メルカゾール"], ["sideEffectPtz", "プロパジール"]].map(([field, drug]) => (
                <div key={field} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#7a6000", width: 92, flexShrink: 0 }}>{drug}</span>
                  <button style={btn(data.history[field] === true, "#a67000", { padding: "4px 16px", fontSize: 12 })} onClick={() => up("history", field, true)}>あり</button>
                  <button style={btn(data.history[field] === false, "#a67000", { padding: "4px 16px", fontSize: 12 })} onClick={() => up("history", field, false)}>なし</button>
                </div>
              ))}
            </div>
          </div>

          {/* 眼科通院歴 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#a67000", marginBottom: 6 }}>眼科通院歴</div>
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              <button style={btn(data.history.eyeHistory === true, "#a67000", { padding: "5px 20px", fontSize: 12 })} onClick={() => up("history", "eyeHistory", true)}>あり</button>
              <button style={btn(data.history.eyeHistory === false, "#a67000", { padding: "5px 20px", fontSize: 12 })} onClick={() => up("history", "eyeHistory", false)}>なし</button>
            </div>
            {data.history.eyeHistory && <input style={{ ...inp(), marginTop: 4 }} placeholder="眼科名（任意）" value={data.history.eyeClinic} onChange={e => up("history", "eyeClinic", e.target.value)} />}
          </div>
        </div>
      )}

      <div style={sBox({ background: "#e6fff8", border: "1.5px solid #81e6d9" })}>
        <div style={{ fontSize: 13, fontWeight: 800, color: TC, marginBottom: 12 }}>🔬 甲状腺エコー所見</div>

        {/* 甲状腺ベース所見（全フォーム共通） */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={lbl()}>甲状腺サイズ</label>
            <div style={{ display: "flex", gap: 3 }}>
              {["腫大", "萎縮", "正常"].map(v => (
                <button key={v} style={btn(data.echo.thyroidSize === v)} onClick={() => up("echo", "thyroidSize", data.echo.thyroidSize === v ? "" : v)}>{v}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={lbl()}>甲状腺血流</label>
            <div style={{ display: "flex", gap: 3 }}>
              {["豊富", "低下", "正常"].map(v => (
                <button key={v} style={btn(data.echo.thyroidBloodFlow === v)} onClick={() => up("echo", "thyroidBloodFlow", data.echo.thyroidBloodFlow === v ? "" : v)}>{v}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={lbl()}>実質エコー</label>
            <div style={{ display: "flex", gap: 3 }}>
              {["整", "不整", "不均一"].map(v => (
                <button key={v} style={btn(data.echo.thyroidParenchyma === v)} onClick={() => up("echo", "thyroidParenchyma", data.echo.thyroidParenchyma === v ? "" : v)}>{v}</button>
              ))}
            </div>
          </div>
        </div>

        {formType === 'basedow-new' && (
          <>
            <label style={lbl()}>ECG</label>
            <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>
              {["正常範囲", "心房細動"].map(v => (
                <button key={v} style={btn(data.echo.ecg === v, v === "心房細動" ? "#c53030" : TC)}
                  onClick={() => up("echo", "ecg", data.echo.ecg === v ? "" : v)}>{v}</button>
              ))}
            </div>
          </>
        )}

        {/* 結節について（全フォーム共通、ありの場合のみアコーディオン展開） */}
        <label style={lbl()}>結節について</label>
        <div style={{ display: "flex", gap: 3, marginBottom: data.echo.hasNodule === "あり" ? 12 : 4 }}>
          {["あり", "なし"].map(v => (
            <button key={v} style={btn(data.echo.hasNodule === v, v === "あり" ? "#c53030" : TC)}
              onClick={() => up("echo", "hasNodule", data.echo.hasNodule === v ? "" : v)}>{v}</button>
          ))}
        </div>

        {data.echo.hasNodule === "あり" && (
          <div style={{ background: "#fff5f5", border: "1.5px solid #feb2b2", borderRadius: 10, padding: "14px 16px", marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#c53030", marginBottom: 10 }}>🔍 結節の詳細</div>

            <label style={lbl({ color: "#c53030" })}>結節の部位</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 10 }}>
              {["両葉", "右葉", "左葉"].map(v => (
                <button key={v} style={btn(data.echo.noduleLocation === v, "#c53030")} onClick={() => up("echo", "noduleLocation", data.echo.noduleLocation === v ? "" : v)}>{v}</button>
              ))}
            </div>

            <label style={lbl({ color: "#c53030" })}>結節サイズ（最大径 W×D mm）</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <input style={{ ...inp(), width: 80 }} type="number" placeholder="幅" value={data.echo.noduleSizeW} onChange={e => up("echo", "noduleSizeW", e.target.value)} />
              <span style={{ fontSize: 13, color: "#666" }}>×</span>
              <input style={{ ...inp(), width: 80 }} type="number" placeholder="奥行" value={data.echo.noduleSizeD} onChange={e => up("echo", "noduleSizeD", e.target.value)} />
              <span style={{ fontSize: 13, color: "#666" }}>mm</span>
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={lbl({ color: "#c53030" })}>結節数</label>
                <div style={{ display: "flex", gap: 3 }}>
                  {["単発", "多発"].map(v => (
                    <button key={v} style={btn(data.echo.noduleCount === v, "#c53030")} onClick={() => up("echo", "noduleCount", data.echo.noduleCount === v ? "" : v)}>{v}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={lbl({ color: "#c53030" })}>石灰化</label>
                <div style={{ display: "flex", gap: 3 }}>
                  {["あり", "なし"].map(v => (
                    <button key={v} style={btn(data.echo.calcification === v, "#c53030")} onClick={() => up("echo", "calcification", data.echo.calcification === v ? "" : v)}>{v}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={lbl({ color: "#c53030" })}>血流</label>
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {["豊富", "乏しい", "不明"].map(v => (
                    <button key={v} style={btn(data.echo.noduleBloodFlow === v, "#c53030")} onClick={() => up("echo", "noduleBloodFlow", data.echo.noduleBloodFlow === v ? "" : v)}>{v}</button>
                  ))}
                </div>
              </div>
            </div>

            <label style={lbl({ color: "#c53030" })}>性状</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 10 }}>
              {["充実性", "嚢胞性", "混合性", "境界不明瞭"].map(v => (
                <button key={v} style={{ ...btn(data.echo.noduleType === v, "#c53030"), padding: "6px 10px", fontSize: 12 }} onClick={() => up("echo", "noduleType", data.echo.noduleType === v ? "" : v)}>{v}</button>
              ))}
            </div>

            <label style={lbl({ color: "#c53030" })}>その他（自由記入、任意）</label>
            <textarea style={{ ...inp(), minHeight: 50, resize: "vertical" }} placeholder="補足があれば記載" value={data.echo.noduleOther} onChange={e => up("echo", "noduleOther", e.target.value)} />
          </div>
        )}
      </div>
    </div>
  );

  // ── Step 1 (3-step forms): 症状・既往歴 ──────────────────
  const renderStep1_3step = () => (
    <div>
      <label style={lbl()}>自覚症状（複数選択可）</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 14 }}>
        {getSymptomList().map(sym => (
          <button key={sym} style={{ ...btn((data.symptom.selected || []).includes(sym), TC), padding: "6px 10px", fontSize: 12 }}
            onClick={() => toggleSym(sym)}>{(data.symptom.selected || []).includes(sym) ? "✓ " : ""}{sym}</button>
        ))}
      </div>

      {formType !== 'adenoma' && (
        <>
          <label style={lbl()}>患者様の年齢</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <input style={{ ...inp(), width: 80 }} type="number" placeholder="歳" value={data.history.age} onChange={e => up("history", "age", e.target.value)} />
            <span style={{ fontSize: 13, color: "#666" }}>歳</span>
            {age > 0 && <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, color: isOver60 ? "#c05621" : "#276749", background: isOver60 ? "#fffaf0" : "#f0fff4", border: `1px solid ${isOver60 ? "#fbd38d" : "#9ae6b4"}` }}>{isOver60 ? "60歳以上：ワクチン確認あり" : "60歳未満：ワクチン確認不要"}</span>}
          </div>
        </>
      )}

      <label style={lbl()}>アレルギー歴</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {["なし", "あり"].map(v => <button key={v} style={btn(data.history.allergy === v)} onClick={() => up("history", "allergy", v)}>{v}</button>)}
      </div>
      {data.history.allergy === "あり" && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
            {ALLERGY_QUICK.map(v => {
              const sel = (data.history.allergyDetail || "").includes(v);
              return (
                <button key={v} style={btn(sel, "#c53030")} onClick={() => {
                  const cur = data.history.allergyDetail || "";
                  if (sel) { up("history", "allergyDetail", cur.split(/[・、,]/).map(s => s.trim()).filter(s => s && s !== v).join("・")); }
                  else { up("history", "allergyDetail", cur ? `${cur}・${v}` : v); }
                }}>{sel ? "✓ " : ""}{v}</button>
              );
            })}
          </div>
          <input style={inp()} placeholder="内容（例：ペニシリン系）" value={data.history.allergyDetail} onChange={e => up("history", "allergyDetail", e.target.value)} />
        </div>
      )}

      <label style={lbl({ marginTop: 8 })}>家族歴（FH）</label>
      <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 8 }}>
        {[["thyroid", "甲状腺疾患"], ["dm", "糖尿病(DM)"]].map(([k, l]) => (
          <button key={k} style={btn(data.history.fh[k])} onClick={() => upN("history", "fh", k, !data.history.fh[k])}>{l}</button>
        ))}
      </div>
      {data.history.fh.thyroid && (
        <div style={{ paddingLeft: 12, borderLeft: `3px solid ${TC}`, marginBottom: 10 }}>
          <label style={lbl({ fontSize: 11 })}>甲状腺疾患：誰が（複数選択可）</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {["父", "母", "祖父（父方）", "祖母（父方）", "祖父（母方）", "祖母（母方）", "兄弟・姉妹"].map(v => (
              <button key={v} style={{ ...btn((data.history.fh.thyroidWho || []).includes(v)), padding: "5px 10px", fontSize: 12 }}
                onClick={() => setData(p => { const a = p.history.fh.thyroidWho || []; return { ...p, history: { ...p.history, fh: { ...p.history.fh, thyroidWho: a.includes(v) ? a.filter(x => x !== v) : [...a, v] } } }; })}>
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {formType !== 'adenoma' && (
        <>
          <label style={lbl({ marginTop: 8 })}>喫煙歴</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {["なし", "あり", "禁煙済"].map(v => <button key={v} style={btn(data.history.smoking === v)} onClick={() => up("history", "smoking", v)}>{v}</button>)}
          </div>
          {(data.history.smoking === "あり" || data.history.smoking === "禁煙済") && (
            <div style={sBox({ border: "1.5px solid #a7f3d0", background: "#e6fff8", marginBottom: 10 })}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <div style={{ flex: "1 1 80px" }}><label style={lbl()}>1日の本数</label><input style={inp()} type="number" placeholder="本/日" value={data.history.smokingAmount} onChange={e => up("history", "smokingAmount", e.target.value)} /></div>
                <div style={{ flex: "1 1 80px" }}><label style={lbl()}>喫煙年数</label><input style={inp()} type="number" placeholder="年" value={data.history.smokingYears} onChange={e => up("history", "smokingYears", e.target.value)} /></div>
                <div style={{ flex: "1 1 80px" }}><label style={lbl()}>開始年齢</label><input style={inp()} type="number" placeholder="歳〜" value={data.history.smokingStartAge} onChange={e => up("history", "smokingStartAge", e.target.value)} /></div>
              </div>
              {data.history.smoking === "禁煙済" && (
                <div><label style={lbl()}>禁煙した時期</label>
                  <EraYear era={data.history.smokingQuitEra} year={data.history.smokingQuitYear} onEraChange={v => up("history", "smokingQuitEra", v)} onYearChange={v => up("history", "smokingQuitYear", v)} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      <label style={lbl()}>健診の種類</label>
      <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 14 }}>
        {["市の健診", "会社の健診", "人間ドック", "なし"].map(v => <button key={v} style={btn((data.history.checkup || []).includes(v))} onClick={() => toggleArr("history", "checkup", v)}>{v}</button>)}
      </div>

      {formType !== 'adenoma' && (
        <>
          <label style={lbl()}>仕事</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {["している", "していない"].map(v => <button key={v} style={btn(data.history.work === v)} onClick={() => up("history", "work", v)}>{v}</button>)}
          </div>
          {data.history.work === "している" && (
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
                {["会社員（デスクワーク）", "会社員（現場・営業）", "自営業", "パート・アルバイト", "医療・福祉職", "専業主婦・主夫", "学生"].map(v => (
                  <button key={v} style={{ ...btn((data.history.job || []).includes(v)), padding: "6px 10px", fontSize: 12 }} onClick={() => toggleArr("history", "job", v)}>{v}</button>
                ))}
              </div>
              <input style={{ ...inp(), marginBottom: 10 }} placeholder="補足・その他" value={data.history.jobNote} onChange={e => up("history", "jobNote", e.target.value)} />
            </div>
          )}
        </>
      )}
      {formType !== 'adenoma' && (
        <>
          <label style={lbl()}>活動量</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
            {["体を動かしていることが多い", "立っていることが多い", "座っていることが多い"].map(v => <button key={v} style={btn(data.history.activity === v)} onClick={() => up("history", "activity", v)}>{v}</button>)}
          </div>
        </>
      )}

      {formType === 'hashimoto' && (
        <div style={{ marginBottom: 14 }}>
          <label style={lbl()}>治療経緯（任意）</label>
          <textarea style={{ ...inp(), minHeight: 60, resize: "vertical" }} placeholder="例：他院で甲状腺機能低下症を指摘、チラーヂン内服中" value={data.history.treatmentHistory} onChange={e => up("history", "treatmentHistory", e.target.value)} />
        </div>
      )}
    </div>
  );

  // ── Step 1 (2-step forms): 症状・体格 ────────────────────
  const renderStep1_2step = () => (
    <div>
      <label style={lbl()}>自覚症状（複数選択可）</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 14 }}>
        {getSymptomList().map(sym => (
          <button key={sym} style={{ ...btn((data.symptom.selected || []).includes(sym), TC), padding: "6px 10px", fontSize: 12 }}
            onClick={() => toggleSym(sym)}>{(data.symptom.selected || []).includes(sym) ? "✓ " : ""}{sym}</button>
        ))}
      </div>
      {(data.symptom.selected || []).includes("その他") && (
        <input style={{ ...inp(), marginBottom: 14 }} placeholder="その他の症状の詳細" value={data.symptom.otherText} onChange={e => setData(p => ({ ...p, symptom: { ...p.symptom, otherText: e.target.value } }))} />
      )}

      {formType !== 'nodule-normal' && formType !== 'malignant' && (
        <>
          <label style={lbl()}>患者様の年齢</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <input style={{ ...inp(), width: 80 }} type="number" placeholder="歳" value={data.history.age} onChange={e => up("history", "age", e.target.value)} />
            <span style={{ fontSize: 13, color: "#666" }}>歳</span>
          </div>
        </>
      )}

      <label style={lbl()}>アレルギー歴</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {["なし", "あり"].map(v => <button key={v} style={btn(data.history.allergy === v)} onClick={() => up("history", "allergy", v)}>{v}</button>)}
      </div>
      {data.history.allergy === "あり" && (
        <input style={{ ...inp(), marginBottom: 14 }} placeholder="内容" value={data.history.allergyDetail} onChange={e => up("history", "allergyDetail", e.target.value)} />
      )}

      {formType !== 'malignant' && formType !== 'nodule-normal' && (
        <>
          <label style={lbl({ marginTop: 8 })}>身長・体重</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[["height", "身長", "cm"], ["weightNow", "体重", "kg"]].map(([k, l, u]) => (
              <div key={k} style={{ flex: "1 1 130px" }}>
                <label style={lbl()}>{l}（{u}）</label>
                <input style={inp()} type="number" placeholder={u} value={data.body[k]} onChange={e => up("body", k, e.target.value)} />
              </div>
            ))}
          </div>
          {bmi && <div style={{ marginBottom: 16, padding: "10px 16px", background: "#e6fff8", borderRadius: 8, fontSize: 14, fontWeight: 700, color: TC }}>BMI：{bmi}</div>}
        </>
      )}

      <div style={sBox({ background: "#fff8f0", border: "1.5px dashed #fbd38d", marginTop: 14 })}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#c05621", marginBottom: 8 }}>🔒 スタッフ入力欄</div>
        <label style={lbl({ color: "#c05621", fontSize: 11 })}>患者フラグ</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {["通常", "○患者疑い（話が長い方）", "●患者疑い（出禁対象）"].map(v => (
            <button key={v} style={btn(data.body.patientFlag === v, "#c05621", { fontSize: 12 })} onClick={() => up("body", "patientFlag", v)}>{v}</button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Step 2 (3-step forms): 生活情報・体格 ────────────────
  const renderStep2_3step = () => (
    <div>
      {formType !== 'adenoma' && (
        <>
          <label style={lbl()}>身長・体重</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            {[["height", "身長", "cm"], ["weightNow", "現在の体重", "kg"], ["weight20", "20歳時の体重", "kg"], ["weightMax", "最大体重", "kg"], ["weightMaxAge", "最大体重の年齢", "歳"]].map(([k, l, u]) => (
              <div key={k} style={{ flex: "1 1 130px", maxWidth: "calc(20% - 8px)" }}>
                <label style={lbl()}>{l}（{u}）</label>
                <input style={inp()} type="number" placeholder={u} value={data.body[k]} onChange={e => up("body", k, e.target.value)} />
              </div>
            ))}
          </div>
          {bmi && <div style={{ marginBottom: 16, padding: "10px 16px", background: "#e6fff8", borderRadius: 8, fontSize: 14, fontWeight: 700, color: TC }}>BMI：{bmi}　{parseFloat(bmi) < 18.5 ? "（低体重）" : parseFloat(bmi) < 25 ? "（普通体重）" : parseFloat(bmi) < 30 ? "（肥満1度）" : "（肥満2度以上）"}</div>}
        </>
      )}

      <label style={lbl()}>希望曜日（複数選択可）</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 14 }}>
        {WEEKDAYS.map(v => (<button key={v} style={btn((data.body.preferredDays || []).includes(v))} onClick={() => toggleArr("body", "preferredDays", v)}>{v}</button>))}
      </div>
      <label style={lbl()}>医師の希望</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 14 }}>
        {["指定なし", "女性医師希望", "男性医師希望", "院長（初回のみ）"].map(v => (<button key={v} style={btn(data.body.doctorGender === v)} onClick={() => up("body", "doctorGender", v)}>{v}</button>))}
      </div>
      <label style={lbl()}>診察への要望・聞きたいこと</label>
      <textarea style={{ ...inp(), minHeight: 70, resize: "vertical" }} placeholder="自由にご記入ください（なければ空欄）" value={data.body.concern} onChange={e => up("body", "concern", e.target.value)} />
      <div style={sBox({ background: "#fff8f0", border: "1.5px dashed #fbd38d", marginTop: 14 })}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#c05621", marginBottom: 8 }}>🔒 スタッフ入力欄</div>
        <label style={lbl({ color: "#c05621", fontSize: 11 })}>患者フラグ</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 10 }}>
          {["通常", "○患者疑い（話が長い方）", "●患者疑い（出禁対象）"].map(v => (<button key={v} style={btn(data.body.patientFlag === v, "#c05621", { fontSize: 12 })} onClick={() => up("body", "patientFlag", v)}>{v}</button>))}
        </div>
        <label style={{ fontSize: 13, color: "#c05621", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={!!data.body.doubleSlot} onChange={e => up("body", "doubleSlot", e.target.checked)} /> 新患2枠取得済み
        </label>
      </div>
    </div>
  );

  const renderStep = () => {
    if (is2step) {
      if (step === 0) return renderStep0();
      if (step === 1) return renderStep1_2step();
    } else {
      if (step === 0) return renderStep0();
      if (step === 1) return renderStep1_3step();
      if (step === 2) return renderStep2_3step();
    }
    return null;
  };

  const isLastStep = step === steps.length - 1;

  return (
    <div ref={topRef} style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0fdf9 0%, #ecfdf5 60%, #f0f9ff 100%)", fontFamily: "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif", padding: "20px 16px" }}>
      <style>{`@keyframes kinkSpin{to{transform:rotate(360deg)}}`}</style>
      {loading && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.52)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ width: 54, height: 54, border: "5px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", borderRadius: "50%", animation: "kinkSpin 0.8s linear infinite" }} />
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, marginTop: 22, textAlign: "center", lineHeight: 1.8 }}>カルテを作成しています...<br />少々お待ちください</div>
        </div>
      )}

      <div style={{ maxWidth: 680, margin: "0 auto 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/")} style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #a7f3d0", background: "#fff", color: TC, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>← トップへ戻る</button>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg,${TC},#34d399)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🦋</div>
          <div>
            <div style={{ fontSize: 11, color: "#2d8a78", fontWeight: 700, letterSpacing: "0.08em" }}>まつもと糖尿病クリニック</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#1a2a4a" }}>甲状腺 初診事前問診</div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <span style={{ fontSize: 12, background: "#e6fff8", color: TC, padding: "4px 14px", borderRadius: 20, fontWeight: 700 }}>{meta.label}</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {!done && (
          <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
            {steps.map((s, i) => (
              <div key={s.id} onClick={() => goStep(i)} style={{ flex: 1, textAlign: "center", cursor: "pointer", userSelect: "none" }}>
                <div style={{ height: 4, borderRadius: 2, background: i === step ? TC : i < step ? "#34d399" : "#a7f3d0", marginBottom: 4, transition: "background 0.3s" }} />
                <div style={{ fontSize: 10, color: i === step ? TC : i < step ? "#0d7d6a" : "#7ab8a8", fontWeight: i === step ? 800 : i < step ? 600 : 400 }}>{i < step ? "✓ " : ""}{s.title}</div>
              </div>
            ))}
          </div>
        )}

        {!done ? (
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 26px", boxShadow: "0 2px 20px rgba(13,125,106,0.07)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1a2a4a", marginBottom: 18, borderBottom: "2px solid #a7f3d0", paddingBottom: 10 }}>{steps[step].title}</h2>
            {renderStep()}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26 }}>
              <button style={{ padding: "11px 22px", borderRadius: 8, border: "1.5px solid #a7f3d0", background: "#f0fdf9", color: step === 0 ? "#a7c5bc" : TC, fontWeight: 700, fontSize: 14, cursor: step === 0 ? "not-allowed" : "pointer" }} onClick={() => goStep(step - 1)} disabled={step === 0}>← 前へ</button>
              {!isLastStep ? (
                <button style={{ padding: "11px 26px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${TC},#34d399)`, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 12px rgba(13,125,106,0.25)" }} onClick={() => goStep(step + 1)}>次へ →</button>
              ) : (
                <button style={{ padding: "11px 26px", borderRadius: 8, border: "none", background: loading ? "#a0c8c0" : `linear-gradient(135deg,${TC},#34d399)`, color: "#fff", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 12px rgba(13,125,106,0.25)" }} onClick={generateKarte} disabled={loading}>{loading ? "生成中..." : "✨ カルテ文を生成"}</button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 26px", boxShadow: "0 2px 20px rgba(13,125,106,0.07)", border: "2px solid #a7f3d0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: TC, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 16 }}>✓</div>
              <div>
                <div style={{ fontWeight: 800, color: "#0d4d42", fontSize: 15 }}>カルテ記載文が生成されました</div>
                <div style={{ fontSize: 12, color: "#2d8a78" }}>内容確認後、電子カルテにコピーしてください</div>
              </div>
            </div>
            {saveError && (
              <div style={{ background: "#fff5f5", border: "2px solid #feb2b2", borderRadius: 10, padding: "14px 16px", marginBottom: 12, textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#c53030", marginBottom: 8 }}>⚠️ 受付番号の登録に失敗しました。スタッフへ口頭でお知らせください。</div>
                <button onClick={handleSaveRetry} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#e53e3e", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>🔄 再試行</button>
              </div>
            )}
            {visitCode && (
              <div style={{ background: `linear-gradient(135deg,${TC},#34d399)`, borderRadius: 14, padding: "20px", marginBottom: 16, textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 6, fontWeight: 700 }}>受付番号</div>
                <div style={{ fontSize: 56, fontWeight: 900, color: "#fff", letterSpacing: "0.2em", lineHeight: 1 }}>{visitCode}</div>
              </div>
            )}
            <div style={{ background: "#fff8e1", border: "2px solid #f59e0b", borderRadius: 12, padding: "14px 18px", marginBottom: 12, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#92400e" }}>📋 タブレットを受付にお返しください</div>
              <div style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>問診は完了しています。ありがとうございました。</div>
            </div>
            <div style={{ marginBottom: 4 }}>
              <button onClick={() => setShowKarte(v => !v)} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "1.5px solid #a7f3d0", background: showKarte ? "#e6fff8" : "#f0fdf9", color: "#0d4d42", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {showKarte ? "▲ カルテ文を閉じる（スタッフ用）" : "▼ スタッフ用カルテを確認する"}
              </button>
            </div>
            {showKarte && (
              <div style={{ marginBottom: 8 }}>
                <textarea value={result} onChange={e => setResult(e.target.value)} style={{ width: "100%", minHeight: 320, background: "#f0fdf9", border: "1px solid #a7f3d0", borderRadius: 10, padding: "16px 18px", fontSize: 11, lineHeight: 2, color: "#1a2a4a", fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                  <button onClick={saveEditedKarte} disabled={saving} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: saving ? "#7ab8a8" : TC, color: "#fff", fontWeight: 800, fontSize: 13, cursor: saving ? "wait" : "pointer" }}>{saving ? "💾 保存中..." : "💾 編集内容を保存"}</button>
                  {saveMsg && <span style={{ fontSize: 13, fontWeight: 700, color: saveMsg.startsWith("✓") ? "#0f9668" : "#c53030" }}>{saveMsg}</span>}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button style={{ flex: 1, padding: "12px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${TC},#34d399)`, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }} onClick={() => copyToClipboard(result)}>📋 コピー</button>
              <button style={{ flex: 1, padding: "12px", borderRadius: 8, border: `1.5px solid ${TC}`, background: "#f0fdf9", color: TC, fontWeight: 700, fontSize: 14, cursor: "pointer" }} onClick={() => { setDone(false); setStep(0); setTimeout(scrollTop, 50); }}>✏️ 修正する</button>
              <button style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1.5px solid #a7f3d0", background: "#f0fdf9", color: "#2d8a78", fontWeight: 700, fontSize: 14, cursor: "pointer" }} onClick={() => { setDone(false); setStep(0); setData(initialData); setResult(""); setVisitCode(""); setRecordId(""); setSaveMsg(""); setShowKarte(false); setSaveError(false); setTimeout(scrollTop, 50); }}>🔄 最初から</button>
              <button style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1.5px solid #a7f3d0", background: "#f0fdf9", color: "#2d8a78", fontWeight: 700, fontSize: 14, cursor: "pointer" }} onClick={() => { window.location.href = "/"; }}>🏠 トップへ戻る</button>
            </div>
          </div>
        )}
        <div style={{ textAlign: "center", fontSize: 11, color: "#7ab8a8", marginTop: 14 }}>入力内容は送信後に消去されます　│　個人情報は院内のみで使用されます</div>
      </div>
    </div>
  );
}

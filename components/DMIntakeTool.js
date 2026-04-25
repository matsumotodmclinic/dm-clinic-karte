import { useState, useRef } from "react";
import VoiceMemoSection from "./VoiceMemoSection";
import { useRouter } from "next/router";

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "指定なし"];
const ALLERGY_QUICK = ["花粉", "ペニシリン", "造影剤", "フルーツ"];
const CHILD_LOCATIONS = ["近居（同一市区町村）", "近隣（同一都道府県）", "遠方（他都道府県）", "子供なし"];
const CHILD_GENDERS = ["息子", "娘", "両方"];

const STEPS = [
  { id: "alert", title: "重要確認" },
  { id: "reason", title: "受診理由" },
  { id: "disease", title: "病気について" },
  { id: "history", title: "既往・家族歴" },
  { id: "lifestyle", title: "生活情報" },
  { id: "body", title: "体格・要望" },
];

const NEARBY_HOSPITALS = ["自治医大さいたま医療センター", "上尾中央総合病院", "埼玉県立がんセンター", "その他", "不明"];

const LIVING_WITH_SPOUSE = ["配偶者あり", "配偶者なし（独居・死別・離別等）"];
const LIVING_OTHERS = [
  "子供と同居なし",
  "息子と同居",
  "娘と同居",
  "息子夫婦と同居",
  "娘夫婦と同居",
  "親と同居",
  "祖父母と同居",
  "兄弟姉妹と同居",
  "その他",
];

const ALCOHOL_TYPES = [
  { key: "beer",   label: "ビール",     unit: "缶(350ml)", amounts: ["1缶", "2缶", "3缶以上"] },
  { key: "happo",  label: "発泡酒",     unit: "缶(350ml)", amounts: ["1缶", "2缶", "3缶以上"] },
  { key: "wine",   label: "ワイン",     unit: "杯",        amounts: ["1杯", "2杯", "ボトル1本"] },
  { key: "shochu", label: "焼酎",       unit: "",          amounts: ["1合", "2合", "3合以上"] },
  { key: "sake",   label: "日本酒",     unit: "合",        amounts: ["1合", "2合", "3合以上"] },
  { key: "whisky", label: "ウイスキー", unit: "杯",        amounts: ["1杯", "2杯", "3杯以上"] },
];

const emptyOtherDisease = () => ({ name: "", hospital: "", hospitalOther: "" });
const emptyAlcohol      = () => ({ type: "", amount: "", freq: "" });

const initialData = {
  alert: { weightLoss: "" },
  reason: {
    type: "", referralFrom: "", referralDept: "", referralQuickSelect: false,
    referralDetail: "", transferFrom: "", transferDetail: "", checkupType: "", dmConcern: false, dmConcernReason: "", dmConcernNote: "", summary: "",
  },
  disease: {
    dmOnsetEra: "令和", dmOnset: "", dmOnsetUnknown: false,
    ht: false, hl: false, thyroidAdded: false, insulinUse: false,
    gastricCancer:  { selected: false, resection: "", surgeryType: "", surgeryEra: "平成", surgeryYear: "", surgeryUnknown: false, treatedHospital: "", treatedHospitalOther: "", visitingHospital: "", visitingHospitalOther: "", visitFreq: "", meds: "" },
    pancreasCancer: { selected: false, surgeryType: "", resection: "", surgeryEra: "平成", surgeryYear: "", surgeryUnknown: false, treatedHospital: "", treatedHospitalOther: "", visitingHospital: "", visitingHospitalOther: "", visitFreq: "", meds: "" },
    ihd:            { selected: false, treatment: "", surgeryEra: "平成", surgeryYear: "", surgeryUnknown: false, treatedHospital: "", treatedHospitalOther: "", visitingHospital: "", visitingHospitalOther: "", visitFreq: "", meds: "" },
    stroke:         { selected: false, surgeryEra: "平成", surgeryYear: "", surgeryUnknown: false, treatedHospital: "", treatedHospitalOther: "", visitingHospital: "", visitingHospitalOther: "", visitFreq: "", meds: "" },
    echoNeck: "", echoAbdomen: "",
    otherDiseases: [emptyOtherDisease()],
  },
  history: {
    age: "", allergy: "なし", allergyDetail: "",
    fh: { dm: false, dmWho: [], ht: false, apo: false, ihd: false },
    alcoholNone: false, alcoholItems: [emptyAlcohol()],
    smoking: "なし", smokingAmount: "", smokingYears: "", smokingStartAge: "",
    smokingQuitEra: "令和", smokingQuitYear: "",
    eye: "", eyeVisiting: "", checkup: [], vaccine65Prevena: "", vaccine65Herpes: "",
  },
  lifestyle: { livingSpouse: "", livingOther: [], livingCustom: "", childInfo: "", childLocation: "", childGender: [], work: "していない", job: [], jobNote: "", activity: "" },
  body: { height: "", weightNow: "", weight20: "", weightMax: "", weightMaxAge: "", concern: "", preferredDays: [], doctorGender: "", patientFlag: "通常", doubleSlot: false },
  voiceMemo: { transcript: "", aiSummary: "" },
  voicePastHistory: { transcript: "", aiSummary: "" },
};

/* ── shared styles ── */
const inp = (x = {}) => ({ padding: "9px 12px", border: "1.5px solid #d0dff5", borderRadius: 8, fontSize: 14, color: "#1a2a3a", background: "#f7faff", outline: "none", boxSizing: "border-box", fontFamily: "inherit", width: "100%", ...x });
const lbl = (x = {}) => ({ display: "block", fontSize: 12, fontWeight: 700, color: "#1a5fa8", marginBottom: 5, letterSpacing: "0.03em", ...x });
const btn = (active, color = "#1a5fa8", x = {}) => ({ padding: "8px 14px", borderRadius: 8, border: active ? `2px solid ${color}` : "2px solid #d0dff5", background: active ? color : "#f7faff", color: active ? "#fff" : "#5580a8", fontWeight: 700, fontSize: 13, cursor: "pointer", margin: "3px 4px 3px 0", ...x });
const sBox = (x = {}) => ({ background: "#f7faff", border: "1.5px solid #e0ecff", borderRadius: 10, padding: "14px 16px", marginBottom: 14, ...x });

/* ── sub-components ── */
function EraYear({ era, year, onEraChange, onYearChange, disabled }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <select style={{ ...inp(), width: 96 }} value={era} onChange={e => onEraChange(e.target.value)} disabled={disabled}>
        <option>昭和</option><option>平成</option><option>令和</option>
      </select>
      <input style={{ ...inp(), width: 68 }} type="number" placeholder="年" value={disabled ? "" : year} onChange={e => onYearChange(e.target.value)} disabled={disabled} />
      <span style={{ fontSize: 13, color: "#666" }}>年ごろ</span>
    </div>
  );
}

function HospitalPicker({ label, value, otherValue, onSelect, onOtherChange, color = "#1a5fa8", includeNone }) {
  const opts = includeNone ? [...NEARBY_HOSPITALS, "通院なし"] : NEARBY_HOSPITALS;
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={lbl({ color })}>{label}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {opts.map(h => <button key={h} style={btn(value === h, color)} onClick={() => onSelect(h)}>{h}</button>)}
      </div>
      {value === "その他" && (
        <input style={{ ...inp(), marginTop: 6 }} placeholder="病院名を入力" value={otherValue} onChange={e => onOtherChange(e.target.value)} />
      )}
    </div>
  );
}

function DetailBox({ title, color, data, onChange, showResection, resectionLabel, resectionOptions }) {
  const defaultResectionOpts = ["1/3切除", "1/2切除", "2/3切除", "全摘", "不明"];
  const opts = resectionOptions || defaultResectionOpts;
  const rLabel = resectionLabel || "胃の切除範囲";
  return (
    <div style={{ ...sBox(), border: `1.5px solid ${color}40`, background: `${color}08`, marginTop: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color, marginBottom: 12 }}>{title} ― 詳細</div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl({ color })}>治療の種類</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {["手術で切除", "抗がん剤のみ", "手術＋抗がん剤", "不明"].map(o => <button key={o} style={btn(data.surgeryType === o, color)} onClick={() => onChange("surgeryType", o)}>{o}</button>)}
        </div>
      </div>
      {showResection && data.surgeryType && data.surgeryType !== "抗がん剤のみ" && (
        <div style={{ marginBottom: 12 }}>
          <label style={lbl({ color })}>{rLabel}</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {opts.map(o => <button key={o} style={btn(data.resection === o, color)} onClick={() => onChange("resection", o)}>{o}</button>)}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <label style={lbl({ color })}>手術・治療時期</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <EraYear era={data.surgeryEra} year={data.surgeryYear} onEraChange={v => onChange("surgeryEra", v)} onYearChange={v => onChange("surgeryYear", v)} disabled={data.surgeryUnknown} />
          <label style={{ fontSize: 13, color: "#888", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input type="checkbox" checked={!!data.surgeryUnknown} onChange={e => onChange("surgeryUnknown", e.target.checked)} /> 不明
          </label>
        </div>
      </div>
      <HospitalPicker label="治療を行った病院" value={data.treatedHospital} otherValue={data.treatedHospitalOther} onSelect={v => onChange("treatedHospital", v)} onOtherChange={v => onChange("treatedHospitalOther", v)} color={color} />
      <HospitalPicker label="現在の通院先" value={data.visitingHospital} otherValue={data.visitingHospitalOther} onSelect={v => onChange("visitingHospital", v)} onOtherChange={v => onChange("visitingHospitalOther", v)} color={color} includeNone />
      {/* 通院頻度 */}
      {data.visitingHospital && data.visitingHospital !== "通院なし" && (
        <div style={{ marginBottom: 12 }}>
          <label style={lbl({ color })}>通院頻度</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
            {["1ヶ月に1回", "2ヶ月に1回", "3ヶ月に1回", "半年に1回", "1年に1回"].map(v => (
              <button key={v} style={{ ...btn(data.visitFreq === v, color), padding: "6px 10px", fontSize: 12 }} onClick={() => onChange("visitFreq", v)}>{v}</button>
            ))}
          </div>
          <input style={{ ...inp(), fontSize: 12 }} placeholder="その他（例：○ヶ月に1回）"
            value={["1ヶ月に1回","2ヶ月に1回","3ヶ月に1回","半年に1回","1年に1回"].includes(data.visitFreq) ? "" : data.visitFreq}
            onChange={e => onChange("visitFreq", e.target.value)} />
        </div>
      )}
      <div>
        <label style={lbl({ color })}>内服薬（分かる範囲で）</label>
        <input style={inp()} placeholder="例：アスピリン100mg・クロピドグレル・不明" value={data.meds} onChange={e => onChange("meds", e.target.value)} />
      </div>
    </div>
  );
}

function AlcoholRow({ item, index, onChange, onRemove, showRemove }) {
  const typeInfo = ALCOHOL_TYPES.find(t => t.key === item.type);
  return (
    <div style={sBox({ background: "#f0f8ff", border: "1.5px solid #bee3f8", marginBottom: 8 })}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <label style={lbl({ color: "#2b6cb0", marginBottom: 0 })}>種類</label>
        {showRemove && <button onClick={onRemove} style={{ fontSize: 12, color: "#e53e3e", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕ 削除</button>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
        {ALCOHOL_TYPES.map(t => <button key={t.key} style={btn(item.type === t.key, "#2b6cb0")} onClick={() => onChange(index, "type", t.key)}>{t.label}</button>)}
      </div>
      {typeInfo && (
        <>
          <label style={lbl({ color: "#2b6cb0" })}>量（{typeInfo.unit || "目安"}）</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
            {typeInfo.amounts.map(a => <button key={a} style={btn(item.amount === a, "#2b6cb0")} onClick={() => onChange(index, "amount", a)}>{a}</button>)}
          </div>
          <label style={lbl({ color: "#2b6cb0" })}>頻度</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {["毎日", "週5〜6日", "週3〜4日", "週1〜2日", "機会飲酒"].map(f => <button key={f} style={btn(item.freq === f, "#2b6cb0")} onClick={() => onChange(index, "freq", f)}>{f}</button>)}
          </div>
        </>
      )}
    </div>
  );
}

/* ── main ── */
export default function DMIntakeTool() {
  const router = useRouter();
  const [step, setStep]         = useState(0);
  const [data, setData]         = useState(initialData);
  const [result, setResult]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [visitCode, setVisitCode] = useState("");
  const [recordId, setRecordId] = useState("");
  const [showKarte, setShowKarte] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const topRef = useRef(null);

  const scrollTop = () => {
    if (topRef.current) topRef.current.scrollIntoView({ behavior: "smooth" });
  };

  const goStep = (n) => { setStep(n); setTimeout(scrollTop, 50); };

  const up  = (sec, f, v) => setData(p => ({ ...p, [sec]: { ...p[sec], [f]: v } }));
  const upN = (sec, par, f, v) => setData(p => ({ ...p, [sec]: { ...p[sec], [par]: { ...p[sec][par], [f]: v } } }));
  const toggleArr = (sec, f, v) => setData(p => { const a = p[sec][f]; return { ...p, [sec]: { ...p[sec], [f]: a.includes(v) ? a.filter(x => x !== v) : [...a, v] } }; });
  const upOD = (i, f, v) => setData(p => { const a = [...p.disease.otherDiseases]; a[i] = { ...a[i], [f]: v }; return { ...p, disease: { ...p.disease, otherDiseases: a } }; });
  const upAl = (i, f, v) => setData(p => { const a = [...p.history.alcoholItems]; a[i] = { ...a[i], [f]: v }; return { ...p, history: { ...p.history, alcoholItems: a } }; });
  const addAl = () => setData(p => ({ ...p, history: { ...p.history, alcoholItems: [...p.history.alcoholItems, emptyAlcohol()] } }));
  const delAl = (i) => setData(p => ({ ...p, history: { ...p.history, alcoholItems: p.history.alcoholItems.filter((_, j) => j !== i) } }));

  const age       = parseInt(data.history.age) || 0;
  const bmi = data.body.height && data.body.weightNow
    ? (parseFloat(data.body.weightNow) / Math.pow(parseFloat(data.body.height)/100, 2)).toFixed(1)
    : null;
  const isOver60  = age >= 60;
  const isOver70  = age >= 70;

  const buildAlcohol = () => {
    if (data.history.alcoholNone) return "なし";
    const items = data.history.alcoholItems.filter(a => a.type && a.amount);
    if (!items.length) return "";
    return items.map(a => { const t = ALCOHOL_TYPES.find(x => x.key === a.type); return `${t?.label || a.type}${a.amount}${a.freq ? `（${a.freq}）` : ""}`; }).join("、");
  };

  const buildSmoking = () => {
    const s = data.history;
    if (s.smoking === "なし") return "なし";
    const base = `${s.smokingAmount}本×${s.smokingYears}年（${s.smokingStartAge}歳〜）`;
    return s.smoking === "禁煙済" ? `${base}、${s.smokingQuitEra}${s.smokingQuitYear}年に禁煙` : base;
  };

  const buildLiving = () => {
    const { livingSpouse, livingOther, livingCustom } = data.lifestyle;
    const hasSpouse = livingSpouse === "配偶者あり";
    const arr = Array.isArray(livingOther) ? livingOther : (livingOther ? [livingOther] : []);
    const others = arr.filter(x => x && x !== "子供と同居なし");
    const other = others.join("・");
    const custom = livingCustom || "";
    let base = "";
    if (hasSpouse && !other) base = "夫婦2人暮らし";
    else if (hasSpouse && other) base = `夫婦2人暮らし＋${other}`;
    else if (!hasSpouse && other) base = other;
    else if (livingSpouse) base = livingSpouse;
    return [base, custom].filter(Boolean).join("（") + (base && custom ? "）" : "");
  };

  const dmOnsetText = () => {
    if (data.disease.dmOnsetUnknown) return "";
    if (!data.disease.dmOnset) return "";
    return `（${data.disease.dmOnsetEra}${data.disease.dmOnset}年）`;
  };

  const buildWeekday = () => {
    const days = data.body.preferredDays || [];
    if (!days.length) return "曜希望";
    if (days.includes("指定なし")) return "曜希望：指定なし";
    return `${days.join("・")}曜希望`;
  };

  const buildJob = () => {
    const jobs = Array.isArray(data.lifestyle.job) ? data.lifestyle.job : (data.lifestyle.job ? [data.lifestyle.job] : []);
    const note = data.lifestyle.jobNote || "";
    return [jobs.join("、"), note].filter(Boolean).join("・");
  };

  const buildChildInfo = () => {
    const { childInfo, childLocation, childGender } = data.lifestyle;
    const parts = [];
    if (childLocation) {
      if (childLocation === "子供なし") parts.push("子供なし");
      else {
        const who = (childGender || []).includes("両方") ? "息子・娘" : (childGender || []).join("・");
        parts.push(`${who || "子供"}は${childLocation}`);
      }
    }
    if (childInfo) parts.push(childInfo);
    return parts.join("、");
  };

  const getCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const reiwaYear = year - 2018;
    return `R${reiwaYear}.${month}`;
  };

  const handleSaveRetry = async () => {
    setSaveError(false);
    try {
      const saveRes = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_type: "DM基本", form_data: data, age: data.history.age || null, generated_karte: result }),
      });
      const saveJson = await saveRes.json();
      if (saveJson.visit_code) { setVisitCode(saveJson.visit_code); if (saveJson.id) setRecordId(saveJson.id); }
      else setSaveError(true);
    } catch (e) { setSaveError(true); }
  };

  const saveEditedKarte = async () => {
    if (!recordId) { setSaveMsg("保存先IDが見つかりません"); setTimeout(() => setSaveMsg(""), 3000); return; }
    try {
      const res = await fetch("/api/questionnaire", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, generated_karte: result }),
      });
      if (res.ok) { setSaveMsg("✓ 保存しました"); setTimeout(() => setSaveMsg(""), 2500); }
      else { setSaveMsg("保存に失敗しました"); setTimeout(() => setSaveMsg(""), 3000); }
    } catch (e) { setSaveMsg("保存に失敗しました"); setTimeout(() => setSaveMsg(""), 3000); }
  };

  const generateKarte = async () => {
    setLoading(true);
    const prompt = `あなたはまつもと糖尿病クリニックの電子カルテ記載AIです。
以下の患者情報をもとに、クリニックのフォーマット通りにカルテ記載文を生成してください。

【ルール】
- 注意書き・内部メモは出力しない
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- ＃病名・＃HT・＃HLの間は空行なし。他院管理の疾患のみ1行空けてから記載する
- 体重減少ありの場合は一番上に【⚠️ 体重減少あり・早急なインスリン導入を検討】と記載
- 60歳未満はワクチン歴を省略、70歳未満は子供の状況を省略
- 喫煙歴は「○本×○年（○歳〜）」の形式
- 重要既往歴には「治療した病院 → 現在通院先」を記載
- ＃糖尿病の右に発症時期を記載（例：＃糖尿病（令和2年））
- 受診理由の直後に改行なしで＃糖尿病を続ける
- 受診理由が「糖尿病か気になる」(reason.dmConcern=true)の場合、＃糖尿病ではなく「＃糖尿病 or IGT or 正常耐糖能」と記載（検査前の暫定診断）。発症時期は付けない。

【整形済みデータ】
飲酒歴：${buildAlcohol()}
喫煙歴：${buildSmoking()}
生活情報：${buildLiving()}
子供の状況：${buildChildInfo()}
職業：${buildJob()}
発症時期テキスト：${dmOnsetText()}
頚部エコー：${data.disease.echoNeck === "行っていない" ? "当院で施行予定" : data.disease.echoNeck || "未記入"}
腹部エコー：${data.disease.echoAbdomen === "行っていない" ? "当院で施行予定" : data.disease.echoAbdomen || "未記入"}
希望曜日：${buildWeekday()}
医師希望：${data.body.doctorGender || "指定なし"}
患者フラグ：${data.body.patientFlag || "通常"}
新患2枠取得：${data.body.doubleSlot ? "取得済" : "なし"}

【患者情報JSON】
${JSON.stringify(data, null, 2)}

【追加情報】
現在日時：${getCurrentMonth()}
体重減少：${data.alert.weightLoss}
HTあり：${data.disease.ht}
HLあり：${data.disease.hl}
${data.voiceMemo?.aiSummary ? `\n【音声入力からのAI整形済み現病歴(必ず受診理由サマリーに統合)】\n${data.voiceMemo.aiSummary}\n` : ''}${data.voicePastHistory?.aiSummary ? `\n【音声入力からのAI整形済み既往歴(♯既往疾患セクションに統合)】\n${data.voicePastHistory.aiSummary}\n` : ''}
【出力フォーマット（必ずこの順序で。該当なければ省略）】
（体重減少が「あり」かつ3kg以上の場合のみ）【⚠️ 体重減少あり・早急なインスリン導入を検討】

${getCurrentMonth()}：（受診理由サマリー1〜2行。記載なければ省略。音声入力AI整形済みテキストがある場合はそれを統合・優先して使用）
${data.reason.dmConcern ? '＃糖尿病 or IGT or 正常耐糖能' : `＃糖尿病${dmOnsetText()}`}（サマリーの直後、空行なし）
＃HT（該当時のみ）
＃HL（該当時のみ）

♯胃癌（胃切除後：治療種類・範囲・時期・治療病院→通院先・内服薬）（該当時のみ）
♯膵臓癌（術後：治療種類・切除範囲・時期・治療病院→通院先・内服薬）（該当時のみ）
♯IHD：PCI後（時期・治療病院→通院先・抗血小板薬）（該当時のみ）
♯脳梗塞後（時期・治療病院→通院先・抗血小板薬）（該当時のみ）
（その他既往があれば記載）

【アレルギー歴】（アレルギーなしなら「なし」、ありなら内容をそのまま同じ行に記載。例：【アレルギー歴】ペニシリン系）
【FH】DM(-/+) HT(-/+) APO(-/+) IHD(-/+)（FH DMの場合は誰かも記載）
【飲酒歴】（整形済みテキスト）
【喫煙歴】（整形済みテキスト）
【眼科通院歴】（通院中の場合：眼科名・網膜症の状況・緑内障の有無を記載）
【健診】
【ワクチン歴】（60歳以上のみ）
【生活情報】（整形済みテキスト。70歳以上は子供の状況も含む）
【仕事】職業・活動量
---------------------------------------------
頚部エコー：○○　腹部エコー：○○（必ず1行に横配置。他院で施行済は「他院施行済」、健診で施行済は「健診施行済」、行っていない場合は「当院で施行予定」）
---------------------------------------------
身長:○cm　初診時:○kg${bmi ? `（BMI ${bmi}）` : ""}　20歳時:○kg　max体重○kg(○歳)
---------------------------------------------
【事前聴取時　申し送り事項】
（体重減少ありかつ3kg以上の場合）□体重減少あり（3ヶ月以内に3kg以上）インスリン導入要検討
（HTありの場合）□HTの確認のため、血圧手帳をお渡ししています。
（HLありの場合）□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。
（インスリン未使用の場合）□生活習慣病療養計画書を作成済
（糖尿病か気になるで受診=reason.dmConcern=true の場合）□血糖、HbA1cの結果により上段の診断を確定してください
（新患2枠取得済の場合）□新患2枠取得済み
（医師希望指定ありの場合）□${data.body.doctorGender === "院長（初回のみ）" ? "院長希望（初回のみ）" : data.body.doctorGender}
（患者フラグが「○患者疑い（話が長い方）」の場合）□○患者疑い（対応注意）
（患者フラグが「●患者疑い（出禁対象）」の場合）□●患者疑い（出禁対象・要確認）
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${getCurrentMonth()}：HbA1c　　%　CPR（　）　※GAD陽性の場合は甲状腺項目追加してください　CPR0.5以下の方は今後半年ごとCPR測定を入れてください。




（アレルギー薬がある場合のみ「⚠️○○アレルギー⚠️」と1行で記載。HTMLタグ・style属性は絶対に出力しない。プレーンテキストのみ）
目標HbA1c　　　　%　目標体重　　　次回検討薬：
DM基本セット
1月follow
${buildWeekday()}
LINE登録ご案内→済　登録確認未・登録できない
`;
    try {
      // ① カルテ文生成
      const res  = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const json = await res.json();
      const generated = json.content?.[0]?.text || "生成に失敗しました";
      setResult(generated);

      // Supabaseに保存してvisit_codeを受け取る
      try {
        const saveRes = await fetch("/api/questionnaire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ form_type: "DM基本", form_data: data, age: data.history.age || null, generated_karte: generated }),
        });
        const saveJson = await saveRes.json();
        if (saveJson.visit_code) { setVisitCode(saveJson.visit_code); if (saveJson.id) setRecordId(saveJson.id); }
        else setSaveError(true);
      } catch (saveErr) { setSaveError(true); }

      setDone(true);
      setTimeout(scrollTop, 50);
    } catch (e) {
      setResult("エラー: " + e.message);
      setDone(true);
    }
    setLoading(false);
  };

  /* ── steps ── */
  const renderStep = () => {
    const d = data;
    switch (step) {

      /* 0: 重要確認 */
      case 0: return (
        <div>
          <div style={{ background: "#fff5f5", border: "2px solid #e53e3e", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#c53030", marginBottom: 6 }}>⚠️ 最初に必ず確認してください</div>
            <div style={{ fontSize: 13, color: "#742a2a", lineHeight: 1.7 }}>体重減少がある患者様は<strong>早急なインスリン導入</strong>が必要な場合があります。<br />※体重減少の定義：<strong>3ヶ月以内に3kg以上の体重減少</strong></div>
          </div>
          <label style={lbl()}>最近、体重が減っていますか？</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["あり", "なし", "不明"].map(v => (
              <button key={v} style={btn(d.alert.weightLoss === v, v === "あり" ? "#e53e3e" : "#1a5fa8")} onClick={() => { up("alert", "weightLoss", v); }}>
                {v === "あり" ? "⚠️ あり" : v}
              </button>
            ))}
          </div>
        </div>
      );

      /* 1: 受診理由 */
      case 1: return (
        <div>
          <label style={lbl()}>受診理由</label>
          <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 14 }}>
            {["紹介", "検診異常", "自主転院"].map(r => (
              <button key={r} style={btn(d.reason.type === r)} onClick={() => setData(p => ({ ...p, reason: { ...p.reason, type: r, dmConcern: false } }))}>{r}</button>
            ))}
            <button style={btn(d.reason.dmConcern, '#8e44ad')} onClick={() => setData(p => ({ ...p, reason: { ...p.reason, dmConcern: !p.reason.dmConcern, type: !p.reason.dmConcern ? '' : p.reason.type } }))}>
              {d.reason.dmConcern ? '✓ 糖尿病か気になる' : '糖尿病か気になる'}
            </button>
          </div>

          {d.reason.dmConcern && (
            <div style={{ ...sBox({ border: "1.5px solid #d6bcfa", background: "#faf5ff" }), marginBottom: 14 }}>
              <label style={lbl({ color: '#8e44ad' })}>気になる理由</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
                {['家族に糖尿病の方がいる', '健診でHbA1cを指摘された', '喉が渇く・尿が多い', 'その他'].map(v => (
                  <button key={v} style={btn(d.reason.dmConcernReason === v, '#8e44ad')} onClick={() => up('reason', 'dmConcernReason', v)}>{v}</button>
                ))}
              </div>
              {d.reason.dmConcernReason === 'その他' && (
                <input style={inp()} placeholder="詳しく教えてください" value={d.reason.dmConcernNote} onChange={e => up('reason', 'dmConcernNote', e.target.value)} />
              )}
            </div>
          )}

          {d.reason.type === "紹介" && (
            <div style={sBox()}>
              <label style={lbl()}>よく使う紹介元</label>
              {/* 総合病院：上尾中央総合病院＋科選択 */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 700, marginBottom: 6 }}>総合病院</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {[
                    { hosp: "上尾中央総合病院", dept: "糖尿病内科" },
                    { hosp: "上尾中央総合病院", dept: "循環器内科" },
                    { hosp: "上尾中央総合病院", dept: "消化器内科" },
                    { hosp: "自治医大さいたま医療センター", dept: "糖尿病内科" },
                  ].map(({ hosp, dept }) => {
                    const selected = d.reason.referralFrom === hosp && d.reason.referralDept === dept;
                    return (
                      <button key={hosp+dept} style={{ ...btn(selected, "#0f9668"), fontSize: 12, padding: "7px 14px", border: selected ? "2px solid #0f9668" : "2px dashed #0f9668", background: selected ? "#0f9668" : "#f0fff8", color: selected ? "#fff" : "#0f9668" }}
                        onClick={() => setData(p => selected
                          ? ({ ...p, reason: { ...p.reason, referralFrom: "", referralDept: "", referralQuickSelect: false } })
                          : ({ ...p, reason: { ...p.reason, referralFrom: hosp, referralDept: dept, referralQuickSelect: true } })
                        )}>
                        {selected ? "✓ " : ""}{hosp}・{dept}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* 開業医：科名なし */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 700, marginBottom: 6 }}>開業医</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {["加藤泌尿器科"].map(hosp => {
                    const selected = d.reason.referralFrom === hosp;
                    return (
                      <button key={hosp} style={{ ...btn(selected, "#0f9668"), fontSize: 12, padding: "7px 14px", border: selected ? "2px solid #0f9668" : "2px dashed #0f9668", background: selected ? "#0f9668" : "#f0fff8", color: selected ? "#fff" : "#0f9668" }}
                        onClick={() => setData(p => selected
                          ? ({ ...p, reason: { ...p.reason, referralFrom: "", referralDept: "", referralQuickSelect: false } })
                          : ({ ...p, reason: { ...p.reason, referralFrom: hosp, referralDept: "", referralQuickSelect: true } })
                        )}>
                        {selected ? "✓ " : ""}{hosp}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* その他・手入力 */}
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 2 }}><label style={lbl()}>その他の病院名</label><input style={inp()} placeholder="上記以外の場合は入力" value={d.reason.referralQuickSelect ? "" : d.reason.referralFrom} onChange={e => setData(p => ({ ...p, reason: { ...p.reason, referralFrom: e.target.value, referralDept: "", referralQuickSelect: false } }))} /></div>
                <div style={{ flex: 1 }}><label style={lbl()}>科名</label><input style={inp()} placeholder="例：糖尿病内科" value={d.reason.referralDept} onChange={e => up("reason", "referralDept", e.target.value)} /></div>
              </div>
              <label style={lbl()}>紹介の理由</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {["血糖コントロール不良のため", "安定していたため当院へ", "専門的管理のため", "内容不明"].map(v => <button key={v} style={btn(d.reason.referralDetail === v)} onClick={() => up("reason", "referralDetail", v)}>{v}</button>)}
              </div>
            </div>
          )}

          {d.reason.type === "自主転院" && (
            <div style={sBox()}>
              <label style={lbl()}>転院元 医療機関名</label>
              <input style={{ ...inp(), marginBottom: 12 }} placeholder="例：○○クリニック（言いたくない場合は空欄でOK）" value={d.reason.transferFrom} onChange={e => up("reason", "transferFrom", e.target.value)} />
              <label style={lbl()}>転院の理由</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {["血糖コントロール改善しないため", "転居のため", "より専門的な治療を希望", "その他"].map(v => <button key={v} style={btn(d.reason.transferDetail === v)} onClick={() => up("reason", "transferDetail", v)}>{v}</button>)}
              </div>
            </div>
          )}

          {d.reason.type === "検診異常" && (
            <div style={sBox()}>
              <label style={lbl()}>検診の種類</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {["会社健診", "市健診", "人間ドック"].map(v => <button key={v} style={btn(d.reason.checkupType === v)} onClick={() => up("reason", "checkupType", v)}>{v}</button>)}
              </div>
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <label style={lbl()}>自由記入欄（任意）</label>
            <div style={{ fontSize: 12, color: "#7a9abf", marginBottom: 6, lineHeight: 1.6 }}>例：「○○病院DM内科で加療中も血糖コントロール不良のため紹介」</div>
            <textarea style={{ ...inp(), minHeight: 72, resize: "vertical" }} placeholder="補足があれば記載（書かなくてもOK）" value={d.reason.summary} onChange={e => up("reason", "summary", e.target.value)} />
          </div>
        </div>
      );

      /* 2: 病気 */
      case 2: return (
        <div>
          <div style={{ ...sBox({ background: "#f0f7ff", border: "2px solid #bcd4f8" }), marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#1a5fa8" }}>＃糖尿病</span>
            {(d.reason.type !== "検診異常" && !d.reason.dmConcern) && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "#888" }}>発症時期：</span>
                  <EraYear era={d.disease.dmOnsetEra} year={d.disease.dmOnset}
                    onEraChange={v => up("disease", "dmOnsetEra", v)}
                    onYearChange={v => up("disease", "dmOnset", v)}
                    disabled={d.disease.dmOnsetUnknown} />
                </div>
                <label style={{ fontSize: 13, color: "#5580a8", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={d.disease.dmOnsetUnknown} onChange={e => up("disease", "dmOnsetUnknown", e.target.checked)} />
                  発症時期は不明（カルテ記載を省略）
                </label>
              </>
            )}
          </div>

          <label style={{ fontSize: 15, fontWeight: 800, color: "#1a5fa8", display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer", background: "#f0f7ff", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #bcd4f8" }}>
            <input type="checkbox" checked={d.disease.insulinUse} onChange={e => up("disease", "insulinUse", e.target.checked)} style={{ width: 20, height: 20 }} />
            現在インスリン治療中
          </label>

          <label style={lbl()}>合併する疾患</label>
          <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 14 }}>
            {[["ht", "高血圧（HT）"], ["hl", "脂質異常症（HL）"]].map(([k, l]) => <button key={k} style={btn(d.disease[k])} onClick={() => up("disease", k, !d.disease[k])}>{l}</button>)}
          </div>

          <label style={lbl({ marginTop: 6 })}>重要既往歴</label>
          <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 8 }}>
            {[["gastricCancer","胃癌（胃切除後）","#c0392b"],["pancreasCancer","膵臓癌（術後）","#c0392b"],["ihd","狭心症・心筋梗塞","#8e44ad"],["stroke","脳梗塞後","#8e44ad"]].map(([k, l, c]) => (
              <button key={k} style={btn(d.disease[k].selected, c)} onClick={() => upN("disease", k, "selected", !d.disease[k].selected)}>{l}</button>
            ))}
          </div>
          {d.disease.gastricCancer.selected  && <DetailBox title="胃癌（胃切除後）"  color="#c0392b" showResection data={d.disease.gastricCancer}  onChange={(f,v) => upN("disease","gastricCancer",f,v)} />}
          {d.disease.pancreasCancer.selected && <DetailBox title="膵臓癌（術後）"    color="#c0392b" showResection resectionLabel="膵臓の切除範囲" resectionOptions={["膵頭部切除","膵体部・尾部切除","膵全摘","不明"]} data={d.disease.pancreasCancer} onChange={(f,v) => upN("disease","pancreasCancer",f,v)} />}
          {d.disease.ihd.selected && (
            <div style={{ background: "#8e44ad08", border: "1.5px solid #8e44ad40", borderRadius: 10, padding: "14px 16px", marginTop: 6, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#8e44ad", marginBottom: 12 }}>狭心症・心筋梗塞 ― 詳細</div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl({ color: "#8e44ad" })}>治療方法</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {["PCI（カテーテル治療）", "バイパス手術", "薬物療法のみ", "不明"].map(v => (
                    <button key={v} style={btn(d.disease.ihd.treatment === v, "#8e44ad")} onClick={() => upN("disease", "ihd", "treatment", v)}>{v}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl({ color: "#8e44ad" })}>治療時期</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <EraYear era={d.disease.ihd.surgeryEra} year={d.disease.ihd.surgeryYear} onEraChange={v => upN("disease", "ihd", "surgeryEra", v)} onYearChange={v => upN("disease", "ihd", "surgeryYear", v)} disabled={d.disease.ihd.surgeryUnknown} />
                  <label style={{ fontSize: 13, color: "#888", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!d.disease.ihd.surgeryUnknown} onChange={e => upN("disease", "ihd", "surgeryUnknown", e.target.checked)} /> 不明
                  </label>
                </div>
              </div>
              <HospitalPicker label="治療を行った病院" value={d.disease.ihd.treatedHospital} otherValue={d.disease.ihd.treatedHospitalOther} onSelect={v => upN("disease", "ihd", "treatedHospital", v)} onOtherChange={v => upN("disease", "ihd", "treatedHospitalOther", v)} color="#8e44ad" />
              <HospitalPicker label="現在の通院先" value={d.disease.ihd.visitingHospital} otherValue={d.disease.ihd.visitingHospitalOther} onSelect={v => upN("disease", "ihd", "visitingHospital", v)} onOtherChange={v => upN("disease", "ihd", "visitingHospitalOther", v)} color="#8e44ad" includeNone />
              {d.disease.ihd.visitingHospital && d.disease.ihd.visitingHospital !== "通院なし" && (
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl({ color: "#8e44ad" })}>通院頻度</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
                    {["1ヶ月に1回","2ヶ月に1回","3ヶ月に1回","半年に1回","1年に1回"].map(v=>(
                      <button key={v} style={{...btn(d.disease.ihd.visitFreq===v,"#8e44ad"),padding:"6px 10px",fontSize:12}} onClick={()=>upN("disease","ihd","visitFreq",v)}>{v}</button>
                    ))}
                  </div>
                  <input style={{...inp(),fontSize:12}} placeholder="その他（例：○ヶ月に1回）"
                    value={["1ヶ月に1回","2ヶ月に1回","3ヶ月に1回","半年に1回","1年に1回"].includes(d.disease.ihd.visitFreq)?"":d.disease.ihd.visitFreq}
                    onChange={e=>upN("disease","ihd","visitFreq",e.target.value)}/>
                </div>
              )}
              <div>
                <label style={lbl({ color: "#8e44ad" })}>内服薬（分かる範囲で）</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
                  {["アスピリン", "クロピドグレル", "エフィエント"].map(v => {
                    const selected = (d.disease.ihd.meds || "").includes(v);
                    return (
                      <button key={v} style={btn(selected, "#8e44ad")} onClick={() => {
                        const cur = d.disease.ihd.meds || "";
                        if (selected) {
                          const next = cur.split(/[・、,]/).map(s => s.trim()).filter(s => s && s !== v).join("・");
                          upN("disease", "ihd", "meds", next);
                        } else {
                          upN("disease", "ihd", "meds", cur ? `${cur}・${v}` : v);
                        }
                      }}>{selected ? "✓ " : ""}{v}</button>
                    );
                  })}
                </div>
                <input style={inp()} placeholder="例：アスピリン・クロピドグレル・不明" value={d.disease.ihd.meds} onChange={e => upN("disease", "ihd", "meds", e.target.value)} />
              </div>
            </div>
          )}
          {d.disease.stroke.selected && (
            <div style={{ background: "#8e44ad08", border: "1.5px solid #8e44ad40", borderRadius: 10, padding: "14px 16px", marginTop: 6, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#8e44ad", marginBottom: 12 }}>脳梗塞後 ― 詳細</div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl({ color: "#8e44ad" })}>発症時期</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <EraYear era={d.disease.stroke.surgeryEra} year={d.disease.stroke.surgeryYear}
                    onEraChange={v => upN("disease","stroke","surgeryEra",v)}
                    onYearChange={v => upN("disease","stroke","surgeryYear",v)}
                    disabled={d.disease.stroke.surgeryUnknown} />
                  <label style={{ fontSize: 13, color: "#888", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!d.disease.stroke.surgeryUnknown} onChange={e => upN("disease","stroke","surgeryUnknown",e.target.checked)} /> 不明
                  </label>
                </div>
              </div>
              <HospitalPicker label="治療を行った病院" value={d.disease.stroke.treatedHospital} otherValue={d.disease.stroke.treatedHospitalOther} onSelect={v => upN("disease","stroke","treatedHospital",v)} onOtherChange={v => upN("disease","stroke","treatedHospitalOther",v)} color="#8e44ad" />
              <HospitalPicker label="現在の通院先" value={d.disease.stroke.visitingHospital} otherValue={d.disease.stroke.visitingHospitalOther} onSelect={v => upN("disease","stroke","visitingHospital",v)} onOtherChange={v => upN("disease","stroke","visitingHospitalOther",v)} color="#8e44ad" includeNone />
              {d.disease.stroke.visitingHospital && d.disease.stroke.visitingHospital !== "通院なし" && (
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl({ color: "#8e44ad" })}>通院頻度</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
                    {["1ヶ月に1回","2ヶ月に1回","3ヶ月に1回","半年に1回","1年に1回"].map(v=>(
                      <button key={v} style={{...btn(d.disease.stroke.visitFreq===v,"#8e44ad"),padding:"6px 10px",fontSize:12}} onClick={()=>upN("disease","stroke","visitFreq",v)}>{v}</button>
                    ))}
                  </div>
                  <input style={{...inp(),fontSize:12}} placeholder="その他（例：○ヶ月に1回）"
                    value={["1ヶ月に1回","2ヶ月に1回","3ヶ月に1回","半年に1回","1年に1回"].includes(d.disease.stroke.visitFreq)?"":d.disease.stroke.visitFreq}
                    onChange={e=>upN("disease","stroke","visitFreq",e.target.value)}/>
                </div>
              )}
              <div>
                <label style={lbl({ color: "#8e44ad" })}>内服薬（分かる範囲で）</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
                  {["アスピリン", "クロピドグレル"].map(v => {
                    const selected = (d.disease.stroke.meds || "").includes(v);
                    return (
                      <button key={v} style={btn(selected, "#8e44ad")} onClick={() => {
                        const cur = d.disease.stroke.meds || "";
                        if (selected) {
                          const next = cur.split(/[・、,]/).map(s => s.trim()).filter(s => s && s !== v).join("・");
                          upN("disease", "stroke", "meds", next);
                        } else {
                          upN("disease", "stroke", "meds", cur ? `${cur}・${v}` : v);
                        }
                      }}>{selected ? "✓ " : ""}{v}</button>
                    );
                  })}
                </div>
                <input style={inp()} placeholder="例：アスピリン・クロピドグレル・不明" value={d.disease.stroke.meds} onChange={e => upN("disease","stroke","meds",e.target.value)} />
              </div>
            </div>
          )}

          <label style={lbl({ marginTop: 8 })}>その他の病気・既往歴</label>
          <div style={{ fontSize: 12, color: "#7a9abf", marginBottom: 8 }}>例：慢性腎臓病、COPD、甲状腺疾患、うつ病、骨粗鬆症 など</div>
          {d.disease.otherDiseases.map((od, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
              <div style={{ flex: "0 0 20px", paddingTop: 10, fontSize: 13, color: "#8899aa", fontWeight: 700 }}>{i+1}</div>
              <div style={{ flex: 2 }}>
                {i === 0 && <label style={lbl()}>病名</label>}
                <input style={inp()} placeholder="病名（なければ空欄）" value={od.name} onChange={e => upOD(i, "name", e.target.value)} />
              </div>
              <div style={{ flex: 3 }}>
                {i === 0 && <label style={lbl()}>現在の通院先</label>}
                {od.name ? (
                  <div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                      <select style={{ ...inp(), flex: 2, fontSize: 12 }} value={od.hospital || ""}
                        onChange={e => { upOD(i, "hospital", e.target.value); upOD(i, "dept", ""); }}>
                        <option value="">病院を選択</option>
                        {["上尾中央総合病院","自治医大さいたま医療センター","埼玉県立がんセンター","加藤泌尿器科","通院なし","その他"].map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      {od.hospital && od.hospital !== "通院なし" && od.hospital !== "加藤泌尿器科" && od.hospital !== "その他" && (
                        <select style={{ ...inp(), flex: 1, fontSize: 12 }} value={od.dept || ""}
                          onChange={e => upOD(i, "dept", e.target.value)}>
                          <option value="">科を選択</option>
                          {({"上尾中央総合病院":["糖尿病内科","循環器内科","消化器内科","整形外科","神経内科","腎臓内科","その他"],"自治医大さいたま医療センター":["糖尿病内科","循環器内科","消化器内科","腎臓内科","神経内科","その他"],"埼玉県立がんセンター":["消化器外科","乳腺外科","泌尿器科","呼吸器外科","その他"]}[od.hospital]||["その他"]).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      )}
                      {od.hospital === "その他" && (
                        <input style={{ ...inp(), flex: 2, fontSize: 12 }} placeholder="病院名を入力" value={od.hospitalOther || ""} onChange={e => upOD(i, "hospitalOther", e.target.value)} />
                      )}
                    </div>
                  </div>
                ) : <div style={{ paddingTop: 8, fontSize: 12, color: "#b0c0d0" }}>病名を入力すると通院先が選べます</div>}
              </div>
              {i > 0 && <button onClick={() => setData(p => { const a = p.disease.otherDiseases.filter((_, j) => j !== i); return { ...p, disease: { ...p.disease, otherDiseases: a } }; })} style={{ fontSize: 12, color: "#e53e3e", background: "none", border: "none", cursor: "pointer", fontWeight: 700, paddingTop: 10 }}>✕</button>}
            </div>
          ))}
          <button style={{ ...btn(false, "#718096"), fontSize: 13, marginBottom: 14 }} onClick={() => setData(p => ({ ...p, disease: { ...p.disease, otherDiseases: [...p.disease.otherDiseases, emptyOtherDisease()] } }))}>＋ その他の病名を追加</button>

          <div style={{ ...sBox({ background: "#f0f8ff", border: "1.5px solid #bee3f8" }), marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#2b6cb0", marginBottom: 4 }}>🔍 エコー検査について</div>
            <div style={{ fontSize: 12, color: "#4a7fa8", marginBottom: 12, lineHeight: 1.7 }}>
              当院では糖尿病の合併症検査として、頸動脈エコー・腹部エコー等を年に1回行っています。
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={lbl({ color: "#2b6cb0" })}>頚部エコー</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {["他院で施行済", "健診で施行済", "行っていない"].map(v => (
                    <button key={v} style={{ ...btn(d.disease.echoNeck === v, "#2b6cb0"), padding: "6px 10px", fontSize: 12 }} onClick={() => up("disease", "echoNeck", v)}>{v}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={lbl({ color: "#2b6cb0" })}>腹部エコー</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {["他院で施行済", "健診で施行済", "行っていない"].map(v => (
                    <button key={v} style={{ ...btn(d.disease.echoAbdomen === v, "#2b6cb0"), padding: "6px 10px", fontSize: 12 }} onClick={() => up("disease", "echoAbdomen", v)}>{v}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <VoiceMemoSection
            mode="pastHistory"
            formData={data}
            formType="dm"
            initialValue={data.voicePastHistory}
            onUpdate={(memo) => setData(p => ({ ...p, voicePastHistory: memo }))}
          />
        </div>
      );

      /* 3: 既往・家族歴 */
      case 3: return (
        <div>
          <label style={lbl()}>患者様の年齢</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <input style={{ ...inp(), width: 80 }} type="number" placeholder="歳" value={d.history.age} onChange={e => up("history", "age", e.target.value)} />
            <span style={{ fontSize: 13, color: "#666" }}>歳</span>
            {age > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, color: isOver70 ? "#c53030" : isOver60 ? "#c05621" : "#276749", background: isOver70 ? "#fff5f5" : isOver60 ? "#fffaf0" : "#f0fff4", border: `1px solid ${isOver70 ? "#feb2b2" : isOver60 ? "#fbd38d" : "#9ae6b4"}` }}>
                {isOver70 ? "70歳以上：子供の状況も確認" : isOver60 ? "60歳以上：ワクチン確認あり" : "60歳未満：ワクチン確認不要"}
              </span>
            )}
          </div>

          <label style={lbl()}>アレルギー歴</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {["なし","あり"].map(v => <button key={v} style={btn(d.history.allergy === v)} onClick={() => up("history", "allergy", v)}>{v}</button>)}
          </div>
          {d.history.allergy === "あり" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
                {ALLERGY_QUICK.map(v => {
                  const selected = (d.history.allergyDetail || "").includes(v);
                  return (
                    <button key={v} style={btn(selected, "#c53030")} onClick={() => {
                      const cur = d.history.allergyDetail || "";
                      if (selected) {
                        const next = cur.split(/[・、,]/).map(s => s.trim()).filter(s => s && s !== v).join("・");
                        up("history", "allergyDetail", next);
                      } else {
                        up("history", "allergyDetail", cur ? `${cur}・${v}` : v);
                      }
                    }}>{selected ? "✓ " : ""}{v}</button>
                  );
                })}
              </div>
              <input style={inp()} placeholder="内容（例：ペニシリン系・造影剤）" value={d.history.allergyDetail} onChange={e => up("history", "allergyDetail", e.target.value)} />
            </div>
          )}

          <label style={lbl({ marginTop: 10 })}>家族歴（FH）</label>
          <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 8 }}>
            {[["dm","糖尿病(DM)"],["ht","高血圧(HT)"],["apo","脳卒中(APO)"],["ihd","虚血性心疾患(IHD)"]].map(([k,l]) => <button key={k} style={btn(d.history.fh[k],"#6b3fa8")} onClick={() => upN("history","fh",k,!d.history.fh[k])}>{l}</button>)}
          </div>
          {d.history.fh.dm && (
            <div style={{ paddingLeft: 12, borderLeft: "3px solid #6b3fa8", marginBottom: 14 }}>
              <label style={lbl({ color: "#6b3fa8", fontSize: 11 })}>糖尿病：誰が（複数選択可）</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {["父","母","祖父（父方）","祖母（父方）","祖父（母方）","祖母（母方）","兄弟・姉妹"].map(v => (
                  <button key={v} style={{...btn(d.history.fh.dmWho.includes(v),"#6b3fa8"), padding:"5px 10px", fontSize:12}}
                    onClick={() => setData(p => { const a = p.history.fh.dmWho; return { ...p, history: { ...p.history, fh: { ...p.history.fh, dmWho: a.includes(v) ? a.filter(x=>x!==v) : [...a,v] } } }; })}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label style={lbl()}>飲酒歴</label>
          <div style={{ marginBottom: 8 }}>
            <button style={btn(d.history.alcoholNone, "#718096")} onClick={() => up("history", "alcoholNone", !d.history.alcoholNone)}>
              {d.history.alcoholNone ? "✓ 飲まない" : "飲まない"}
            </button>
          </div>
          {!d.history.alcoholNone && (
            <div>
              {d.history.alcoholItems.map((item, i) => <AlcoholRow key={i} item={item} index={i} onChange={upAl} onRemove={() => delAl(i)} showRemove={d.history.alcoholItems.length > 1} />)}
              <button style={{ ...btn(false, "#2b6cb0"), fontSize: 13, width: "100%", textAlign: "center", marginTop: 4 }} onClick={addAl}>＋ お酒を追加</button>
              {buildAlcohol() && (
                <div style={{ marginTop: 10, padding: "8px 14px", background: "#ebf8ff", border: "1px solid #bee3f8", borderRadius: 8, fontSize: 13, color: "#2b6cb0", fontWeight: 700 }}>
                  📝 カルテ記載例：{buildAlcohol()}
                </div>
              )}
            </div>
          )}

          <label style={lbl({ marginTop: 16 })}>喫煙歴</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {["なし","あり","禁煙済"].map(v => <button key={v} style={btn(d.history.smoking === v)} onClick={() => up("history","smoking",v)}>{v}</button>)}
          </div>
          {(d.history.smoking === "あり" || d.history.smoking === "禁煙済") && (
            <div style={sBox({ border: "1.5px solid #bee3f8", background: "#ebf8ff", marginBottom: 10 })}>
              <div style={{ fontSize: 12, color: "#2b6cb0", fontWeight: 700, marginBottom: 10 }}>📝 カルテ記載：{buildSmoking() || "入力中..."}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <div style={{ flex: "1 1 80px" }}><label style={lbl({ color: "#2b6cb0" })}>1日の本数</label><input style={inp()} type="number" placeholder="本/日" value={d.history.smokingAmount} onChange={e => up("history","smokingAmount",e.target.value)} /></div>
                <div style={{ flex: "1 1 80px" }}><label style={lbl({ color: "#2b6cb0" })}>喫煙年数</label><input style={inp()} type="number" placeholder="年" value={d.history.smokingYears} onChange={e => up("history","smokingYears",e.target.value)} /></div>
                <div style={{ flex: "1 1 80px" }}><label style={lbl({ color: "#2b6cb0" })}>開始年齢</label><input style={inp()} type="number" placeholder="歳〜" value={d.history.smokingStartAge} onChange={e => up("history","smokingStartAge",e.target.value)} /></div>
              </div>
              {d.history.smoking === "禁煙済" && (
                <div><label style={lbl({ color: "#2b6cb0" })}>禁煙した時期</label>
                  <EraYear era={d.history.smokingQuitEra} year={d.history.smokingQuitYear} onEraChange={v => up("history","smokingQuitEra",v)} onYearChange={v => up("history","smokingQuitYear",v)} /></div>
              )}
            </div>
          )}

          <label style={lbl()}>眼科通院歴（糖尿病網膜症チェック）</label>
          <div style={{ fontSize: 12, color: "#7a9abf", marginBottom: 6 }}>糖尿病による網膜症のフォローのため確認します</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {["通院中", "通院していない", "今後受診予定"].map(v => (
              <button key={v} style={btn(d.history.eyeVisiting === v, v === "通院していない" ? "#718096" : "#1a5fa8")}
                onClick={() => up("history", "eyeVisiting", v)}>{v}</button>
            ))}
          </div>
          {d.history.eyeVisiting === "通院中" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
                {["上尾こいけ眼科", "おが・おおぐし眼科", "上尾中央総合病院眼科", "おおたけ眼科", "こしの眼科"].map(v => (
                  <button key={v} style={{ ...btn(d.history.eye === v), padding: "6px 10px", fontSize: 12 }}
                    onClick={() => up("history", "eye", v)}>{v}</button>
                ))}
              </div>
              <input style={{ ...inp(), marginBottom: 8 }} placeholder="その他の眼科名を入力"
                value={["上尾こいけ眼科","おが・おおぐし眼科","上尾中央総合病院眼科","おおたけ眼科","こしの眼科"].includes(d.history.eye) ? "" : d.history.eye}
                onChange={e => up("history", "eye", e.target.value)} />
              <label style={lbl({ fontSize: 11 })}>糖尿病網膜症の状況（分かる範囲で）</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
                {["網膜症なし", "単純性網膜症", "前増殖性網膜症", "増殖性網膜症", "不明"].map(v => (
                  <button key={v} style={{ ...btn(d.history.retinopathy === v), padding: "6px 10px", fontSize: 12 }}
                    onClick={() => up("history", "retinopathy", v)}>{v}</button>
                ))}
              </div>
              <label style={lbl({ fontSize: 11 })}>緑内障の有無</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {["緑内障なし", "緑内障あり", "不明"].map(v => (
                  <button key={v} style={{ ...btn(d.history.glaucoma === v), padding: "6px 10px", fontSize: 12 }}
                    onClick={() => up("history", "glaucoma", v)}>{v}</button>
                ))}
              </div>
            </div>
          )}
          {d.history.eyeVisiting !== "通院中" && <div style={{ marginBottom: 14 }} />}

          <label style={lbl()}>健診の種類</label>
          <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 14 }}>
            {["市の健診","会社の健診","人間ドック","なし"].map(v => <button key={v} style={btn(d.history.checkup.includes(v))} onClick={() => toggleArr("history","checkup",v)}>{v}</button>)}
          </div>

          {isOver60 && (
            <div style={sBox({ border: "1.5px solid #bee3f8", background: "#ebf8ff" })}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#2b6cb0", marginBottom: 12 }}>💉 ワクチン希望（60歳以上）</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={lbl({ color: "#2b6cb0" })}>プレベナー20</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {["希望あり","なし"].map(v => <button key={v} style={btn(d.history.vaccine65Prevena === v,"#2b6cb0")} onClick={() => up("history","vaccine65Prevena",v)}>{v}</button>)}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={lbl({ color: "#2b6cb0" })}>帯状疱疹ワクチン</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {["希望あり","なし"].map(v => <button key={v} style={btn(d.history.vaccine65Herpes === v,"#2b6cb0")} onClick={() => up("history","vaccine65Herpes",v)}>{v}</button>)}
                </div>
              </div>
            </div>
            </div>
          )}
        </div>
      );

      /* 4: 生活情報 */
      case 4: return (
        <div>
          <label style={lbl()}>現在どなたと住んでいますか？</label>
          <label style={lbl({ fontSize: 11, color: "#888", marginBottom: 4 })}>配偶者の有無</label>
          <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 12 }}>
            {LIVING_WITH_SPOUSE.map(v => (
              <button key={v} style={btn(d.lifestyle.livingSpouse === v)} onClick={() => up("lifestyle", "livingSpouse", v)}>{v}</button>
            ))}
          </div>
          <label style={lbl({ fontSize: 11, color: "#888", marginBottom: 4 })}>子供・その他との同居（複数選択可）</label>
          <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 8 }}>
            {LIVING_OTHERS.map(v => (
              <button key={v} style={btn((d.lifestyle.livingOther || []).includes(v))} onClick={() => toggleArr("lifestyle", "livingOther", v)}>{v}</button>
            ))}
          </div>
          <input style={{ ...inp(), marginBottom: 8 }} placeholder="補足があれば（例：夫は要介護・義母と同居）" value={d.lifestyle.livingCustom} onChange={e => up("lifestyle", "livingCustom", e.target.value)} />

          {isOver70 && (
            <div style={sBox({ border: "1.5px solid #fbd38d", background: "#fffaf0" })}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#c05621", marginBottom: 8 }}>👨‍👩‍👧 お子さんの状況（70歳以上）</div>
              {(Array.isArray(d.lifestyle.livingOther) ? d.lifestyle.livingOther : []).includes("子供と同居なし") && (
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl({ color: "#c05621", fontSize: 11 })}>お子さんの居住地</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
                    {CHILD_LOCATIONS.map(v => (
                      <button key={v} style={btn(d.lifestyle.childLocation === v, "#c05621")} onClick={() => up("lifestyle", "childLocation", v)}>{v}</button>
                    ))}
                  </div>
                  {d.lifestyle.childLocation && d.lifestyle.childLocation !== "子供なし" && (
                    <>
                      <label style={lbl({ color: "#c05621", fontSize: 11 })}>息子・娘（複数選択可）</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {CHILD_GENDERS.map(v => (
                          <button key={v} style={btn((d.lifestyle.childGender || []).includes(v), "#c05621")} onClick={() => toggleArr("lifestyle", "childGender", v)}>{v}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              <label style={lbl({ color: "#c05621", fontSize: 11 })}>補足（任意）</label>
              <input style={inp()} placeholder="例：子供は近居（さいたま市）" value={d.lifestyle.childInfo} onChange={e => up("lifestyle","childInfo",e.target.value)} />
            </div>
          )}

          <label style={lbl({ marginTop: 8 })}>仕事</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {["している","していない"].map(v => <button key={v} style={btn(d.lifestyle.work === v)} onClick={() => up("lifestyle","work",v)}>{v}</button>)}
          </div>
          {d.lifestyle.work === "している" && (
            <div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>複数選択可</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
                {["会社員（デスクワーク）","会社員（現場・営業）","自営業","パート・アルバイト","医療・福祉職","教育職（教師・保育士）","飲食・サービス業","農業・林業・漁業","専業主婦・主夫","学生"].map(v=>(
                  <button key={v} style={btn((d.lifestyle.job||[]).includes(v),"#1a5fa8",{padding:"6px 10px",fontSize:12})} onClick={()=>toggleArr("lifestyle","job",v)}>{v}</button>
                ))}
              </div>
              <input style={{ ...inp(), marginBottom: 14 }} placeholder="補足・その他（例：週3日リモート）" value={d.lifestyle.jobNote} onChange={e => up("lifestyle","jobNote",e.target.value)} />
            </div>
          )}

          <label style={lbl()}>活動量</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {["体を動かしていることが多い","立っていることが多い","座っていることが多い"].map(v => <button key={v} style={btn(d.lifestyle.activity === v)} onClick={() => up("lifestyle","activity",v)}>{v}</button>)}
          </div>
        </div>
      );

      /* 5: 体格・要望 */
      case 5: return (
        <div>
          <label style={lbl()}>身長・体重</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            {[["height","身長","cm"],["weightNow","現在の体重","kg"],["weight20","20歳時の体重","kg"],["weightMax","最大体重","kg"],["weightMaxAge","最大体重の年齢","歳"]].map(([k,l,u]) => (
              <div key={k} style={{ flex: "1 1 130px", maxWidth: "calc(20% - 8px)" }}>
                <label style={lbl()}>{l}（{u}）</label>
                <input style={inp()} type="number" placeholder={u} value={d.body[k]} onChange={e => up("body",k,e.target.value)} />
              </div>
            ))}
          </div>
          {bmi && (
            <div style={{ marginBottom: 16, padding: "10px 16px", background: "#e8f0fe", borderRadius: 8, fontSize: 14, fontWeight: 700, color: "#1a5fa8" }}>
              BMI：{bmi}　{parseFloat(bmi)<18.5?"（低体重）":parseFloat(bmi)<25?"（普通体重）":parseFloat(bmi)<30?"（肥満1度）":"（肥満2度以上）"}
            </div>
          )}
          <label style={lbl()}>希望曜日（複数選択可）</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 14 }}>
            {WEEKDAYS.map(v => (
              <button key={v} style={btn((d.body.preferredDays||[]).includes(v), "#1a5fa8")} onClick={() => toggleArr("body", "preferredDays", v)}>{v}</button>
            ))}
          </div>

          <label style={lbl()}>医師の希望</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 14 }}>
            {["指定なし", "女性医師希望", "男性医師希望", "院長（初回のみ）"].map(v => (
              <button key={v} style={btn(d.body.doctorGender === v, "#1a5fa8")} onClick={() => up("body", "doctorGender", v)}>{v}</button>
            ))}
          </div>

          <label style={lbl()}>診察への要望・聞きたいこと</label>
          <textarea style={{ ...inp(), minHeight: 80, resize: "vertical" }} placeholder="自由にご記入ください（なければ空欄）" value={d.body.concern} onChange={e => up("body","concern",e.target.value)} />

          <div style={sBox({ background: "#fff8f0", border: "1.5px dashed #fbd38d", marginTop: 14 })}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#c05621", marginBottom: 8 }}>🔒 スタッフ入力欄（患者は操作不要）</div>
            <label style={lbl({ color: "#c05621", fontSize: 11 })}>患者フラグ</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 10 }}>
              {["通常", "○患者疑い（話が長い方）", "●患者疑い（出禁対象）"].map(v => (
                <button key={v} style={btn(d.body.patientFlag === v, "#c05621", { fontSize: 12 })} onClick={() => up("body", "patientFlag", v)}>{v}</button>
              ))}
            </div>
            <label style={{ fontSize: 13, color: "#c05621", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={!!d.body.doubleSlot} onChange={e => up("body", "doubleSlot", e.target.checked)} /> 新患2枠取得済み
            </label>
          </div>
        </div>
      );

      default: return null;
    }
  };

  /* ── render ── */
  return (
    <div ref={topRef} style={{ minHeight: "100vh", background: "linear-gradient(135deg,#e8f0fe 0%,#f0f7ff 60%,#e8f4fd 100%)", fontFamily: "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif", padding: "20px 16px" }}>

      <style>{`@keyframes kinkSpin{to{transform:rotate(360deg)}}`}</style>
      {loading && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.52)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{width:54,height:54,border:'5px solid rgba(255,255,255,0.25)',borderTopColor:'#fff',borderRadius:'50%',animation:'kinkSpin 0.8s linear infinite'}}/>
          <div style={{color:'#fff',fontWeight:800,fontSize:17,marginTop:22,textAlign:'center',lineHeight:1.8}}>カルテを作成しています...<br/>少々お待ちください</div>
        </div>
      )}
      <div style={{ maxWidth: 720, margin: "0 auto 18px" }}>
        {data.alert.weightLoss === "あり" && !done && (
          <div style={{ background: "#c53030", color: "#fff", borderRadius: 10, padding: "12px 18px", marginBottom: 12, fontWeight: 900, fontSize: 14 }}>
            🚨 体重減少あり ― インスリン導入を要検討・医師へ至急申し送り
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/")} style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #d0dff5", background: "#fff", color: "#5580a8", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>← トップ</button>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#1a5fa8,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏥</div>
          <div>
            <div style={{ fontSize: 11, color: "#6b9fd4", fontWeight: 700, letterSpacing: "0.08em" }}>まつもと糖尿病クリニック</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#1a2a4a" }}>初診事前問診</div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <span style={{ fontSize: 12, background: "#e8f0fe", color: "#1a5fa8", padding: "4px 14px", borderRadius: 20, fontWeight: 700 }}>DM基本</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {!done && (
          <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
            {STEPS.map((s, i) => (
              <div key={s.id} onClick={() => goStep(i)} style={{ flex: 1, textAlign: "center", cursor: "pointer", userSelect: "none" }}>
                <div style={{ height: 4, borderRadius: 2, background: i === step ? "#1a5fa8" : i < step ? "#3b82f6" : "#d0dff5", marginBottom: 4, transition: "background 0.3s" }} />
                <div style={{ fontSize: 10, color: i === step ? "#1a5fa8" : i < step ? "#3b82f6" : "#b0c8e0", fontWeight: i === step ? 800 : i < step ? 600 : 400 }}>{i < step ? "✓ " : ""}{s.title}</div>
              </div>
            ))}
          </div>
        )}

        {!done ? (
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 26px", boxShadow: "0 2px 20px rgba(0,80,160,0.07)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1a2a4a", marginBottom: 18, borderBottom: "2px solid #e8f0fe", paddingBottom: 10 }}>
              {STEPS[step].title}
            </h2>
            {renderStep()}
            {/* 最終ステップでのみ音声入力セクションを表示 */}
            {step === STEPS.length - 1 && (
              <VoiceMemoSection
                formData={data}
                formType="dm"
                onUpdate={(voiceMemo) => setData(p => ({ ...p, voiceMemo }))}
              />
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26 }}>
              <button style={{ padding: "11px 22px", borderRadius: 8, border: "1.5px solid #d0dff5", background: "#f7faff", color: step === 0 ? "#c0d0e0" : "#5580a8", fontWeight: 700, fontSize: 14, cursor: step === 0 ? "not-allowed" : "pointer" }}
                onClick={() => goStep(step - 1)} disabled={step === 0}>← 前へ</button>
              {step < STEPS.length - 1 ? (
                <button style={{ padding: "11px 26px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1a5fa8,#3b82f6)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 12px rgba(26,95,168,0.25)" }}
                  onClick={() => goStep(step + 1)}>次へ →</button>
              ) : (
                <button style={{ padding: "11px 26px", borderRadius: 8, border: "none", background: loading ? "#8ab0d4" : "linear-gradient(135deg,#0f9668,#34d399)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 12px rgba(15,150,104,0.25)" }}
                  onClick={generateKarte} disabled={loading}>{loading ? "生成中..." : "✨ カルテ文を生成"}</button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 26px", boxShadow: "0 2px 20px rgba(0,80,160,0.07)", border: "2px solid #c6f6d5" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#0f9668", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 16 }}>✓</div>
              <div>
                <div style={{ fontWeight: 800, color: "#0a5c40", fontSize: 15 }}>カルテ記載文が生成されました</div>
                <div style={{ fontSize: 12, color: "#5a9a80" }}>内容確認後、電子カルテにコピーしてください</div>
              </div>
            </div>

            {saveError && (
              <div style={{background:"#fff5f5",border:"2px solid #feb2b2",borderRadius:10,padding:"14px 16px",marginBottom:12,textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#c53030",marginBottom:8}}>⚠️ 受付番号の登録に失敗しました。スタッフへ口頭でお知らせください。</div>
                <button onClick={handleSaveRetry} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#e53e3e",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>🔄 再試行</button>
              </div>
            )}
            {visitCode && (
              <div style={{ background: "linear-gradient(135deg,#1a5fa8,#3b82f6)", borderRadius: 14, padding: "20px", marginBottom: 16, textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "#a8d4ff", marginBottom: 6, fontWeight: 700 }}>受付番号</div>
                <div style={{ fontSize: 56, fontWeight: 900, color: "#fff", letterSpacing: "0.2em", lineHeight: 1 }}>{visitCode}</div>
              </div>
            )}
            <div style={{background:"#fff8e1",border:"2px solid #f59e0b",borderRadius:12,padding:"14px 18px",textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:900,color:"#92400e"}}>📋 タブレットを受付にお返しください</div>
              <div style={{fontSize:12,color:"#b45309",marginTop:4}}>問診は完了しています。ありがとうございました。</div>
            </div>

            {data.alert.weightLoss === "あり" && (
              <div style={{ background: "#c53030", color: "#fff", borderRadius: 8, padding: "12px 16px", marginBottom: 12, fontSize: 14, fontWeight: 800 }}>
                🚨 体重減少あり ― 医師への至急申し送りが必要です
              </div>
            )}
            <div style={{marginBottom:4}}>
              <button onClick={()=>setShowKarte(v=>!v)} style={{width:"100%",padding:"11px",borderRadius:8,border:"1.5px solid #c0e8d8",background:showKarte?"#e8f5f0":"#f5f9f7",color:"#276749",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                {showKarte?"▲ カルテ文を閉じる（スタッフ用）":"▼ スタッフ用カルテを確認する"}
              </button>
            </div>
            {showKarte && (
              <div style={{marginBottom:8}}>
                <textarea value={result} onChange={e => setResult(e.target.value)} style={{width:"100%",minHeight:320,background:"#f5f9f7",border:"1px solid #c0e8d8",borderRadius:10,padding:"16px 18px",fontSize:13,lineHeight:2,color:"#1a3a2a",fontFamily:"monospace",resize:"vertical",boxSizing:"border-box"}} />
                <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
                  <button onClick={saveEditedKarte} style={{padding:"10px 18px",borderRadius:8,border:"none",background:"#0f9668",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer"}}>💾 編集内容を保存</button>
                  {saveMsg && <span style={{fontSize:13,fontWeight:700,color:saveMsg.startsWith("✓")?"#0f9668":"#c53030"}}>{saveMsg}</span>}
                </div>
              </div>
            )}


            {/* スタッフ向けボタン */}
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button style={{ flex: 1, padding: "12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1a5fa8,#3b82f6)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
                onClick={() => {
                  const copy = () => { const el = document.createElement("textarea"); el.value = result; document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el); alert("コピーしました"); };
                  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(result).then(() => alert("コピーしました")).catch(copy); } else { copy(); }
                }}>📋 コピー</button>
              <button style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1.5px solid #1a5fa8", background: "#f0f7ff", color: "#1a5fa8", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                onClick={() => { setDone(false); setStep(0); setTimeout(scrollTop, 50); }}>✏️ 修正する</button>
              <button style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1.5px solid #d0dff5", background: "#f7faff", color: "#5580a8", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                onClick={() => { setDone(false); setStep(0); setData(initialData); setResult(""); setVisitCode(""); setRecordId(""); setSaveMsg(""); setShowKarte(false); setSaveError(false); setTimeout(scrollTop, 50); }}>🔄 最初から</button>
              <button style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1.5px solid #9ae6b4", background: "#f0fff4", color: "#276749", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                onClick={() => { window.location.href = "/"; }}>🏠 TOPへ</button>
            </div>


          </div>
        )}
        <div style={{ textAlign: "center", fontSize: 11, color: "#a0b8d0", marginTop: 14 }}>
          入力内容は送信後に消去されます　│　個人情報は院内のみで使用されます
        </div>
      </div>
    </div>
  );
}

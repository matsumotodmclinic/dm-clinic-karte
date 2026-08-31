import { useState, useRef } from "react";
import VoiceMemoSection from "./VoiceMemoSection";
import { useRouter } from "next/router";
import { copyKarteToClipboard } from "../lib/copyKarte";
import { buildOtherDiseasesText } from "../lib/otherDiseases";
import { formatEcho, buildEchoLine } from "../lib/echo";
import { makeFormStyles, FORM_THEMES } from "../lib/formStyles";
import { UI } from "../lib/uiTokens";

// スタイルは lib/formStyles.js に集約（色はカテゴリ単位のトークン）
// TONE = このフォームのカテゴリ色
const TONE = UI.fixed;
const { inp, lbl, btn, sBox } = makeFormStyles(FORM_THEMES.other);

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "指定なし"];
const ALLERGY_QUICK = ["花粉", "ペニシリン", "造影剤", "フルーツ", "金属"];
const CHILD_LOCATIONS = ["近居（同一市区町村）", "近隣（同一都道府県）", "遠方（他都道府県）", "子供なし"];
const CHILD_GENDERS = ["息子", "娘", "両方"];

const STEPS = [
  { id: "reason",   title: "受診理由" },
  { id: "sas",      title: "SAS区分・症状" },
  { id: "history",  title: "既往・生活歴" },
  { id: "body",     title: "体格・要望" },
  { id: "extended", title: "病歴・経緯の聴取" },
];

// 依頼書 Q1: 受診理由(複数選択可)
const REASON_PURPOSES = [
  "症状がある",
  "他の病院から当院を紹介された",
  "健診・人間ドックの結果から受診を勧められた",
  "血縁者に睡眠時無呼吸症候群があるので調べたい",
  "現在通院中の医療機関から当院へ転院したい",
  "引っ越し・転居のため",
  "その他",
];
// 依頼書 Q4: 当院を知ったきっかけ(複数選択可)
const KNOW_SOURCES = [
  "インターネット",
  "家族・知人の紹介",
  "通りがかりに見かけた",
  "医師の紹介",
  "バスの車内広告",
  "その他",
];
// SAS 固有の症状(9項目、DM症状チェック群と同形式)
const SAS_SYMPTOMS = [
  "いびきがある（家族から指摘される）",
  "睡眠中に呼吸が止まると言われた",
  "日中の強い眠気",
  "起床時の頭痛・口の渇き",
  "夜間頻尿",
  "集中力の低下・倦怠感",
  "朝の血圧高値",
  "居眠り運転の経験",
  "その他",
];

const LIVING_WITH_SPOUSE = ["配偶者あり", "配偶者なし（独居・死別・離別等）"];
const LIVING_OTHERS = ["子供と同居なし", "息子と同居", "娘と同居", "息子夫婦と同居", "娘夫婦と同居", "親と同居", "祖父母と同居", "兄弟姉妹と同居", "その他"];
const emptyAlcohol = () => ({ type: "", amount: "", freq: "" });
const ALCOHOL_TYPES = [
  { key: "beer",   label: "ビール",     unit: "缶(350ml)", amounts: ["1缶","2缶","3缶以上"] },
  { key: "happo",  label: "発泡酒",     unit: "缶(350ml)", amounts: ["1缶","2缶","3缶以上"] },
  { key: "wine",   label: "ワイン",     unit: "杯",        amounts: ["1杯","2杯","ボトル1本"] },
  { key: "shochu", label: "焼酎",       unit: "",          amounts: ["1合","2合","3合以上"] },
  { key: "sake",   label: "日本酒",     unit: "合",        amounts: ["1合","2合","3合以上"] },
  { key: "whisky", label: "ウイスキー", unit: "杯",        amounts: ["1杯","2杯","3杯以上"] },
];

const initialData = {
  reason: {
    purposes: [],
    purposeOther: "",
    currentClinic: "",
    sasCategory: "",                  // 'cpap' | 'screening'
    cpapPriorRecordsConfirmed: false, // CPAP継続希望時、前医情報提供書を確認できたかチェック
    cpapPriorClinic: "",              // 前医名(任意)
    knowSource: [],
    knowSourceOther: "",
    summary: "",
  },
  symptom: {
    sasSymptoms: { selected: [], otherText: "" },
  },
  disease: {
    ht: false, hl: false, igt: false,
    otherDiseases: [{ name: "", hospital: "", hospitalOther: "", dept: "" }],
    echoNeck: "", echoAbdomen: "",
  },
  history: {
    age: "", allergy: "なし", allergyDetail: "",
    fh: { dm: false, dmWho: [], ht: false, hl: false, apo: false, ihd: false },
    alcoholNone: false, alcoholItems: [emptyAlcohol()],
    smoking: "なし", smokingAmount: "", smokingYears: "", smokingStartAge: "",
    smokingQuitEra: "令和", smokingQuitYear: "",
    checkup: [], vaccine65Prevena: "", vaccine65Herpes: "",
    livingSpouse: "", livingOther: [], livingCustom: "", childInfo: "", childLocation: "", childGender: [],
    work: "していない", job: [], jobNote: "", activity: "",
  },
  body: { height: "", weightNow: "", weight20: "", weightMax: "", weightMaxAge: "", concern: "", preferredDays: [], doctorGender: "", patientFlag: "通常", doubleSlot: false },
  voiceMemo: { transcript: "", aiSummary: "", needsDoctorReview: false },
  voicePastHistory: { transcript: "", aiSummary: "", needsDoctorReview: false },
  dmDiff: { completed: false }, // 採血で DM 判明後にスタッフが詳細画面から追記
};


function EraYear({ era, year, onEraChange, onYearChange, disabled }) {
  return (
    <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
      <select style={{ ...inp(), width:96 }} value={era} onChange={e=>onEraChange(e.target.value)} disabled={disabled}>
        <option>昭和</option><option>平成</option><option>令和</option>
      </select>
      <input style={{ ...inp(), width:68 }} type="number" placeholder="年" value={disabled?"":year} onChange={e=>onYearChange(e.target.value)} disabled={disabled} />
      <span style={{ fontSize:13, color:"#666" }}>年ごろ</span>
    </div>
  );
}

function AlcoholRow({ item, index, onChange, onRemove, showRemove }) {
  const typeInfo = ALCOHOL_TYPES.find(t=>t.key===item.type);
  return (
    <div style={sBox({ background:"#f0f8ff", border:"1.5px solid #bee3f8", marginBottom:8 })}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
        <label style={lbl({ color:"#2b6cb0", marginBottom:0 })}>種類</label>
        {showRemove && <button onClick={onRemove} style={{ fontSize:12, color:"#e53e3e", background:"none", border:"none", cursor:"pointer", fontWeight:700 }}>✕ 削除</button>}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginBottom:8 }}>
        {ALCOHOL_TYPES.map(t=><button key={t.key} style={btn(item.type===t.key)} onClick={()=>onChange(index,"type",t.key)}>{t.label}</button>)}
      </div>
      {typeInfo && (<>
        <label style={lbl({ color:"#2b6cb0" })}>量（{typeInfo.unit||"目安"}）</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginBottom:8 }}>
          {typeInfo.amounts.map(a=><button key={a} style={btn(item.amount===a)} onClick={()=>onChange(index,"amount",a)}>{a}</button>)}
        </div>
        <label style={lbl({ color:"#2b6cb0" })}>頻度</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
          {["毎日","週5〜6日","週3〜4日","週1〜2日","機会飲酒"].map(f=><button key={f} style={btn(item.freq===f)} onClick={()=>onChange(index,"freq",f)}>{f}</button>)}
        </div>
      </>)}
    </div>
  );
}

export default function SASIntakeTool() {
  const router = useRouter();
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

  const scrollTop = () => { if(topRef.current) topRef.current.scrollIntoView({behavior:"smooth"}); };
  const bmi = data.body.height && data.body.weightNow
    ? (parseFloat(data.body.weightNow)/Math.pow(parseFloat(data.body.height)/100,2)).toFixed(1) : null;
  const goStep = (n) => { setStep(n); setTimeout(scrollTop, 50); };
  const up = (sec,f,v) => setData(p=>({...p,[sec]:{...p[sec],[f]:v}}));
  const upN = (sec,par,f,v) => setData(p=>({...p,[sec]:{...p[sec],[par]:{...p[sec][par],[f]:v}}}));
  const toggleArr = (sec,f,v) => setData(p=>{const a=p[sec][f]||[];return{...p,[sec]:{...p[sec],[f]:a.includes(v)?a.filter(x=>x!==v):[...a,v]}};});
  const upAl = (i,f,v) => setData(p=>{const a=[...p.history.alcoholItems];a[i]={...a[i],[f]:v};return{...p,history:{...p.history,alcoholItems:a}};});
  const addAl = () => setData(p=>({...p,history:{...p.history,alcoholItems:[...p.history.alcoholItems,emptyAlcohol()]}}));
  const delAl = (i) => setData(p=>({...p,history:{...p.history,alcoholItems:p.history.alcoholItems.filter((_,j)=>j!==i)}}));

  const age = parseInt(data.history.age)||0;
  const isOver60 = age >= 60;
  const isOver70 = age >= 70;

  const buildAlcohol = () => {
    if(data.history.alcoholNone) return "なし";
    const items = data.history.alcoholItems.filter(a=>a.type&&a.amount);
    if(!items.length) return "";
    return items.map(a=>{const t=ALCOHOL_TYPES.find(x=>x.key===a.type);return `${t?.label||a.type}${a.amount}${a.freq?`（${a.freq}）`:""}`;}).join("、");
  };
  const buildSmoking = () => {
    const s = data.history;
    if(s.smoking==="なし") return "なし";
    const base = `${s.smokingAmount}本×${s.smokingYears}年（${s.smokingStartAge}歳〜）`;
    return s.smoking==="禁煙済"?`${base}、${s.smokingQuitEra}${s.smokingQuitYear}年に禁煙`:base;
  };
  const buildLiving = () => {
    const{livingSpouse,livingOther,livingCustom}=data.history;
    const hasSpouse=livingSpouse==="配偶者あり";
    const arr = Array.isArray(livingOther) ? livingOther : (livingOther ? [livingOther] : []);
    const others = arr.filter(x=>x&&x!=="子供と同居なし");
    const other = others.join("・");
    const custom=livingCustom||"";
    let base="";
    if(hasSpouse&&!other) base="夫婦2人暮らし";
    else if(hasSpouse&&other) base=`夫婦2人暮らし＋${other}`;
    else if(!hasSpouse&&other) base=other;
    else if(livingSpouse) base=livingSpouse;
    return [base,custom].filter(Boolean).join("（")+(base&&custom?"）":"");
  };

  const getCurrentMonth = () => {
    const now = new Date();
    return `R${now.getFullYear()-2018}.${now.getMonth()+1}`;
  };
  const buildWeekday = () => {
    const days = data.body.preferredDays || [];
    if (!days.length) return "曜希望";
    if (days.includes("指定なし")) return "曜希望：指定なし";
    return `${days.join("・")}曜希望`;
  };
  const buildJob = () => {
    const jobs = Array.isArray(data.history.job) ? data.history.job : (data.history.job ? [data.history.job] : []);
    const note = data.history.jobNote || "";
    return [jobs.join("、"), note].filter(Boolean).join("・");
  };
  const buildChildInfo = () => {
    const { childInfo, childLocation, childGender } = data.history;
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
  const buildSasSymptoms = () => {
    const sel = data.symptom.sasSymptoms?.selected || [];
    if (!sel.length) return "";
    const other = (data.symptom.sasSymptoms?.otherText || "").trim();
    const items = sel.includes("その他") && other
      ? [...sel.filter(s=>s!=="その他"), `その他: ${other}`]
      : sel;
    return items.join("・");
  };

  const copyToClipboard = (text) => copyKarteToClipboard(text);

  const handleSaveRetry = async () => {
    setSaveError(false);
    try {
      const saveRes = await fetch("/api/questionnaire",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({form_type:"睡眠時無呼吸症候群",form_data:data,age:data.history.age||null,generated_karte:result})});
      const saveJson = await saveRes.json();
      if(saveJson.visit_code) { setVisitCode(saveJson.visit_code); if (saveJson.id) setRecordId(saveJson.id); }
      else setSaveError(true);
    } catch(e) { setSaveError(true); }
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
    const sasCategoryLabel = data.reason.sasCategory === 'cpap' ? 'CPAP治療の継続希望'
      : data.reason.sasCategory === 'screening' ? '睡眠時無呼吸症候群の検査希望（簡易PSG予定）'
      : '未選択';
    const purposesText = (data.reason.purposes||[]).join('、') + (data.reason.purposeOther ? `（その他: ${data.reason.purposeOther}）` : '');
    const knowSourceText = (data.reason.knowSource||[]).join('、') + (data.reason.knowSourceOther ? `（その他: ${data.reason.knowSourceOther}）` : '');
    const sasSymptomsText = buildSasSymptoms();
    const otherDiseasesText = buildOtherDiseasesText(data.disease.otherDiseases);

    const prompt = `あなたはまつもと糖尿病クリニックの電子カルテ記載AIです。以下の患者情報をもとに、睡眠時無呼吸症候群（SAS）のカルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- 空行ルール（厳守）: ①自院管理＃疾患は連続列挙し空行なし ②自院管理ブロックの後、他院管理疾患の前にのみ1行空ける ③他院管理疾患同士は連続列挙し空行なし ④他院管理疾患の最終行と【アレルギー歴】の間は空行なし ⑤【事前聴取時 申し送り事項】の最終□行と【診察にあたっての要望】の間も空行なし
- 60歳未満はワクチン歴を省略、70歳未満は子供の状況を省略
- 喫煙歴は「○本×○年（○歳〜）」の形式
- ＃SASの記載: SAS区分が「検査希望」なら「＃SAS疑い（簡易PSG予定）」、「CPAP継続希望」なら「＃SAS（${data.reason.cpapPriorClinic ? `前医：${data.reason.cpapPriorClinic}、`:''}CPAP継続）」
- SAS症状チェックがある場合のみ【SASの症状】セクションを【FH】の前に挿入し、「・」区切りで横一列に記載

【整形済みデータ】
受診理由：${purposesText || '未選択'}
現通院先：${data.reason.currentClinic || 'なし/未記入'}
SAS区分：${sasCategoryLabel}
CPAP前医情報提供書：${data.reason.sasCategory==='cpap' ? (data.reason.cpapPriorRecordsConfirmed?'確認済':'未確認') : '対象外'}
当院を知ったきっかけ：${knowSourceText || '未選択'}
SAS症状チェック：${sasSymptomsText || 'なし'}
飲酒歴：${buildAlcohol()}
喫煙歴：${buildSmoking()}
生活情報：${buildLiving()}
子供の状況：${buildChildInfo()}
職業：${buildJob()}
頚部エコー：${data.disease.echoNeck||'未選択'}
腹部エコー：${data.disease.echoAbdomen||'未選択'}
その他の病名・既往歴：${otherDiseasesText}
希望曜日：${buildWeekday()}
医師希望：${data.body.doctorGender || "指定なし"}
患者フラグ：${data.body.patientFlag || "通常"}
新患2枠取得：${data.body.doubleSlot ? "取得済" : "なし"}

【患者情報JSON】
${JSON.stringify(data,null,2)}
${data.voiceMemo?.aiSummary ? `\n【音声入力からのAI整形済み現病歴(必ず受診理由サマリーに統合)】\n${data.voiceMemo.aiSummary}\n` : ''}${data.voicePastHistory?.aiSummary ? `\n【音声入力からのAI整形済み既往歴(♯既往疾患セクションに統合)】\n${data.voicePastHistory.aiSummary}\n` : ''}${data.voiceMemo?.needsDoctorReview ? `\n【現病歴：要DR確認フラグあり(申し送り事項に「□現病歴：問診時間の関係で一部省略、要DR確認」を必ず追加)】\n` : ''}${data.voicePastHistory?.needsDoctorReview ? `\n【既往歴：要ドクター確認フラグあり(申し送り事項に「□既往歴：要ドクター確認」を必ず追加)】\n` : ''}
【出力フォーマット】
${getCurrentMonth()}：（受診理由サマリー1〜2行。SAS区分（CPAP継続/検査希望）も含める${data.voiceMemo?.aiSummary ? '。音声入力AI整形済みテキストを優先・統合して使用' : ''}）
（SAS区分により上記ルールに従って＃SAS or ＃SAS疑い行を記載、空行なし）
＃HT（該当時のみ、空行なし）
＃HL（該当時のみ、空行なし）
（上記【整形済みデータ】の「その他の病名・既往歴」が「なし」以外なら、1疾患1行で「♯病名（通院先）」の形式で必ず全て記載する。通院先が空なら「♯病名」のみ。整形済みデータの通院先表記をそのまま使い、JSONの hospital 値で上書きしない。空行なし）

${sasSymptomsText ? '【SASの症状】（チェックされた症状を「・」で横一列に記載。「その他」がある場合は末尾に「その他: ○○」を追加）\n' : ''}【アレルギー歴】（なしまたは内容を同じ行に）
【FH】DM(-/+) HT(-/+) HL(-/+) APO(-/+) IHD(-/+)（FH DMの場合は誰かも記載）
【飲酒歴】（整形済みテキスト）
【喫煙歴】（整形済みテキスト）
【健診】
【ワクチン歴】（60歳以上のみ）
【生活情報】（整形済みテキスト。70歳以上は子供の状況も含む）
【仕事】職業・活動量
---------------------------------------------
${buildEchoLine(data.disease.echoNeck, data.disease.echoAbdomen, { abdomenFallback: "未選択" })}（必ず1行に横配置）
---------------------------------------------
身長:○cm　初診時:○kg${bmi ? `（BMI ${bmi}）` : ""}　20歳時:○kg　max体重○kg(○歳)
---------------------------------------------
【事前聴取時　申し送り事項】
□通院のご案内をお渡し済
（現病歴：要DR確認フラグありの場合のみ）□現病歴：問診時間の関係で一部省略、要DR確認
（既往歴：要ドクター確認フラグありの場合のみ）□既往歴：要ドクター確認
（SAS区分が検査希望の場合）□SAS 簡易PSG発送手配 要
（SAS区分がCPAP継続 かつ 前医情報提供書未確認の場合）□CPAP継続：前医情報提供書 確認要
（SAS区分がCPAP継続 かつ 前医情報提供書確認済の場合）□CPAP継続：前医情報提供書 確認済
（HLありの場合）□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。
□初回療養計画書を作成済
（新患2枠取得済の場合）□新患2枠取得済み
${(() => { const g = data.body.doctorGender; if (!g || g === "指定なし") return ""; const label = g === "女性医師希望" ? "女性医師" : g === "男性医師希望" ? "男性医師" : g; return `□医師希望：${label}`; })()}
（患者フラグが「○患者疑い（話が長い方）」の場合）□○患者疑い（対応注意）
（患者フラグが「●患者疑い（出禁対象）」の場合）□●患者疑い（出禁対象・要確認）
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${getCurrentMonth()}：




（アレルギー薬がある場合のみ「⚠️○○アレルギー⚠️」と1行で記載。HTMLタグ・style属性は絶対に出力しない。プレーンテキストのみ）
目標HbA1c　　　　%　目標体重　　　次回検討薬：
基本採血なし
1月follow
${buildWeekday()}
LINE登録ご案内→済　登録確認未・登録できない
`;
    try {
      const res = await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1500,messages:[{role:"user",content:prompt}]})});
      const json = await res.json();
      const generated = json.content?.[0]?.text||"生成に失敗しました";
      setResult(generated);

      try {
        const saveRes = await fetch("/api/questionnaire",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({form_type:"睡眠時無呼吸症候群",form_data:data,age:data.history.age||null,generated_karte:generated})});
        const saveJson = await saveRes.json();
        if(saveJson.visit_code) { setVisitCode(saveJson.visit_code); if (saveJson.id) setRecordId(saveJson.id); }
        else setSaveError(true);
      } catch(saveErr) { setSaveError(true); }

      setDone(true);
      setTimeout(scrollTop,50);
    } catch(e){setResult("エラー: "+e.message);setDone(true);}
    setLoading(false);
  };

  const renderStep = () => {
    const d = data;
    switch(step) {
      // ── Step 0: 受診理由 ──────────────────────────────
      case 0: return (
        <div>
          <label style={lbl()}>受診の理由（複数選択可）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
            {REASON_PURPOSES.map(v=>(
              <button key={v} style={btn((d.reason.purposes||[]).includes(v))} onClick={()=>toggleArr("reason","purposes",v)}>{v}</button>
            ))}
          </div>
          {(d.reason.purposes||[]).includes("その他") && (
            <input style={{...inp(),marginBottom:14}} placeholder="その他・転院希望の詳しい理由" value={d.reason.purposeOther} onChange={e=>up("reason","purposeOther",e.target.value)}/>
          )}

          <label style={lbl({marginTop:8})}>現在通院中の医療機関名（任意）</label>
          <input style={{...inp(),marginBottom:14}} placeholder="例：○○クリニック（任意）" value={d.reason.currentClinic} onChange={e=>up("reason","currentClinic",e.target.value)}/>

          <label style={lbl({marginTop:8})}>当院をどのようにして知りましたか？（複数選択可）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
            {KNOW_SOURCES.map(v=>(
              <button key={v} style={btn((d.reason.knowSource||[]).includes(v),undefined)} onClick={()=>toggleArr("reason","knowSource",v)}>{v}</button>
            ))}
          </div>
          {(d.reason.knowSource||[]).includes("その他") && (
            <input style={{...inp(),marginBottom:14}} placeholder="その他の場合の詳細" value={d.reason.knowSourceOther} onChange={e=>up("reason","knowSourceOther",e.target.value)}/>
          )}

          <label style={lbl({marginTop:8})}>自由記入欄（任意）</label>
          <textarea style={{...inp(),minHeight:60,resize:"vertical"}} placeholder="補足があれば記載（書かなくてもOK）" value={d.reason.summary} onChange={e=>up("reason","summary",e.target.value)}/>
        </div>
      );

      // ── Step 1: SAS区分・症状 ────────────────────────
      case 1: return (
        <div>
          <label style={lbl()}>SAS区分（必須）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
            <button style={btn(d.reason.sasCategory==='cpap',undefined,{padding:"10px 18px",fontSize:14})} onClick={()=>up("reason","sasCategory","cpap")}>CPAP治療の継続希望</button>
            <button style={btn(d.reason.sasCategory==='screening',undefined,{padding:"10px 18px",fontSize:14})} onClick={()=>up("reason","sasCategory","screening")}>睡眠時無呼吸症候群の検査希望</button>
          </div>

          {d.reason.sasCategory==='cpap' && (
            <div style={sBox({background:"#fff7e6",border:"1.5px solid #f0c270"})}>
              <div style={{fontSize:13,fontWeight: 700,color:"#a67000",marginBottom:8}}>📄 前医情報提供書（CPAP継続に必須）</div>
              <div style={{fontSize:12,color:"#7a5500",marginBottom:10,lineHeight:1.6}}>当院でのCPAP継続には、前医の情報提供書が必須です。問診時に持参いただき、内容を確認してチェックしてください。機種によっては当院で継続できない場合があります。</div>
              <label style={lbl({marginTop:4})}>前医名（任意）</label>
              <input style={{...inp(),marginBottom:10}} placeholder="例：○○呼吸器内科" value={d.reason.cpapPriorClinic} onChange={e=>up("reason","cpapPriorClinic",e.target.value)}/>
              <label style={{fontSize:14,color:"#a67000",fontWeight:700,display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <input type="checkbox" checked={!!d.reason.cpapPriorRecordsConfirmed} onChange={e=>up("reason","cpapPriorRecordsConfirmed",e.target.checked)} style={{width:18,height:18}}/>
                ✓ 前医情報提供書を確認しました（内容問題なし）
              </label>
            </div>
          )}

          {d.reason.sasCategory==='screening' && (
            <div style={sBox({background:"#f0fff4",border:"1.5px solid #9ae6b4"})}>
              <div style={{fontSize:13,fontWeight: 700,color:"#276749",marginBottom:8}}>🔬 簡易PSG検査について</div>
              <div style={{fontSize:12,color:"#1a4530",lineHeight:1.6}}>ご予約日時に業者へ発送手配を行い、後日ご自宅に検査機器が郵送されます。当院ではSASは糖尿病・脂質異常症の合併が多いため、全例に採血検査を行っています。</div>
            </div>
          )}

          <label style={lbl({marginTop:14})}>SAS関連症状（該当するものをすべてチェック）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
            {SAS_SYMPTOMS.map(sym=>{
              const selected = (d.symptom.sasSymptoms?.selected||[]).includes(sym);
              return (
                <button key={sym} style={btn(selected,undefined,{padding:"6px 10px",fontSize:12})} onClick={()=>setData(p=>{
                  const cur = p.symptom.sasSymptoms?.selected||[];
                  const next = cur.includes(sym) ? cur.filter(x=>x!==sym) : [...cur, sym];
                  return {...p, symptom:{...p.symptom, sasSymptoms:{...p.symptom.sasSymptoms, selected: next}}};
                })}>{selected?"✓ ":""}{sym}</button>
              );
            })}
          </div>
          {(d.symptom.sasSymptoms?.selected||[]).includes("その他") && (
            <input style={{...inp(),marginBottom:8}} placeholder="その他の症状の詳細" value={d.symptom.sasSymptoms?.otherText||""} onChange={e=>setData(p=>({...p, symptom:{...p.symptom, sasSymptoms:{...p.symptom.sasSymptoms, otherText:e.target.value}}}))}/>
          )}

          <label style={lbl({marginTop:14})}>合併する病名（該当するものを選択）</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:8}}>
            {[["ht","高血圧（HT）","#1a5fa8"],["hl","脂質異常症（HL）","#1a5fa8"],["igt","耐糖能異常（IGT）","#e07000"]].map(([k,l,c])=>(
              <button key={k} style={btn(d.disease[k],c)} onClick={()=>up("disease",k,!d.disease[k])}>{l}</button>
            ))}
          </div>

          <label style={lbl({marginTop:8})}>その他の病名・既往歴</label>
          <div style={{fontSize:12,color:"#7a9abf",marginBottom:8}}>例：慢性腎臓病、甲状腺疾患、不眠症 など</div>
          {(d.disease.otherDiseases||[{name:"",hospital:"",hospitalOther:"",dept:""}]).map((od,i)=>(
            <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
              <div style={{flex:"0 0 20px",paddingTop:10,fontSize:13,color:"#8899aa",fontWeight:700}}>{i+1}</div>
              <div style={{flex:2}}>
                {i===0&&<label style={lbl()}>病名</label>}
                <input style={inp()} placeholder="病名（なければ空欄）" value={od.name||""} onChange={e=>setData(p=>{const a=[...(p.disease.otherDiseases||[])];a[i]={...a[i],name:e.target.value};return{...p,disease:{...p.disease,otherDiseases:a}};})}/>
              </div>
              <div style={{flex:3}}>
                {i===0&&<label style={lbl()}>現在の通院先</label>}
                {od.name ? (
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <select style={{...inp(),flex:2,fontSize:12}} value={od.hospital||""} onChange={e=>setData(p=>{const a=[...(p.disease.otherDiseases||[])];a[i]={...a[i],hospital:e.target.value,dept:""};return{...p,disease:{...p.disease,otherDiseases:a}};})} >
                      <option value="">病院を選択</option>
                      {["上尾中央総合病院","自治医大さいたま医療センター","埼玉県立がんセンター","通院なし","その他"].map(h=><option key={h} value={h}>{h}</option>)}
                    </select>
                    {od.hospital==="その他"&&(
                      <input style={{...inp(),flex:2,fontSize:12}} placeholder="病院名を入力" value={od.hospitalOther||""} onChange={e=>setData(p=>{const a=[...(p.disease.otherDiseases||[])];a[i]={...a[i],hospitalOther:e.target.value};return{...p,disease:{...p.disease,otherDiseases:a}};})}/>
                    )}
                  </div>
                ):<div style={{paddingTop:8,fontSize:12,color:"#b0c0d0"}}>病名を入力すると通院先が選べます</div>}
              </div>
              {i>0&&<button onClick={()=>setData(p=>{const a=(p.disease.otherDiseases||[]).filter((_,j)=>j!==i);return{...p,disease:{...p.disease,otherDiseases:a}};})} style={{fontSize:12,color:"#e53e3e",background:"none",border:"none",cursor:"pointer",fontWeight:700,paddingTop:10}}>✕</button>}
            </div>
          ))}
          <button style={{...btn(false,UI.neutral.fg),fontSize:13,marginBottom:14}} onClick={()=>setData(p=>{const a=[...(p.disease.otherDiseases||[]),{name:"",hospital:"",hospitalOther:"",dept:""}];return{...p,disease:{...p.disease,otherDiseases:a}};})}>＋ その他の病名を追加</button>

          <div style={{...sBox({background:"#f0f8ff",border:"1.5px solid #bee3f8"}),marginTop:8}}>
            <div style={{fontSize:13,fontWeight: 700,color:"#2b6cb0",marginBottom:4}}>🔍 エコー検査について</div>
            <div style={{fontSize:12,color:"#4a7fa8",marginBottom:12,lineHeight:1.7}}>当院では合併症検査として、頸動脈エコー・腹部エコー等を年に1回行っています。</div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:200}}>
                <label style={lbl({color:"#2b6cb0"})}>頚部エコー（必須・年1回）</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  {["他院で施行済","健診で施行済","希望なし"].map(v=>(<button key={v} style={{...btn(d.disease.echoNeck===v),padding:"6px 10px",fontSize:12}} onClick={()=>up("disease","echoNeck",v)}>{v}</button>))}
                </div>
              </div>
              <div style={{flex:1,minWidth:200}}>
                <label style={lbl({color:"#2b6cb0"})}>腹部エコー</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  {["他院で施行済","健診で施行済","希望あり","希望なし"].map(v=>(<button key={v} style={{...btn(d.disease.echoAbdomen===v),padding:"6px 10px",fontSize:12}} onClick={()=>up("disease","echoAbdomen",v)}>{v}</button>))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );

      // ── Step 2: 既往・生活歴 (HTHL流用) ──────────────
      case 2: return (
        <div>
          <label style={lbl()}>患者様の年齢</label>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <input style={{...inp(),width:80}} type="number" placeholder="歳" value={d.history.age} onChange={e=>up("history","age",e.target.value)}/>
            <span style={{fontSize:13,color:"#666"}}>歳</span>
            {age>0&&(<span style={{fontSize:12,fontWeight:700,padding:"4px 12px",borderRadius: 4,color:isOver70?"#c53030":isOver60?"#c05621":"#276749",background:isOver70?"#fff5f5":isOver60?"#fffaf0":"#f0fff4",border:`1px solid ${isOver70?"#feb2b2":isOver60?"#fbd38d":"#9ae6b4"}`}}>
              {isOver70?"70歳以上：子供の状況も確認":isOver60?"60歳以上：ワクチン確認あり":"60歳未満：ワクチン確認不要"}
            </span>)}
          </div>
          <label style={lbl()}>アレルギー歴</label>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            {["なし","あり"].map(v=><button key={v} style={btn(d.history.allergy===v)} onClick={()=>up("history","allergy",v)}>{v}</button>)}
          </div>
          {d.history.allergy==="あり"&&(
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6}}>
                {ALLERGY_QUICK.map(v=>{
                  const selected = (d.history.allergyDetail||"").includes(v);
                  return (
                    <button key={v} style={btn(selected,UI.danger.fg)} onClick={()=>{
                      const cur = d.history.allergyDetail||"";
                      if(selected){ const next = cur.split(/[・、,]/).map(s=>s.trim()).filter(s=>s&&s!==v).join("・"); up("history","allergyDetail",next); }
                      else { up("history","allergyDetail",cur?`${cur}・${v}`:v); }
                    }}>{selected?"✓ ":""}{v}</button>
                  );
                })}
              </div>
              <input style={inp()} placeholder="内容（例：ペニシリン系）" value={d.history.allergyDetail} onChange={e=>up("history","allergyDetail",e.target.value)}/>
            </div>
          )}
          <label style={lbl({marginTop:8})}>家族歴（FH）</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:16}}>
            {[["dm","糖尿病(DM)"],["ht","高血圧(HT)"],["hl","脂質異常症(HL)"],["apo","脳卒中(APO)"],["ihd","虚血性心疾患(IHD)"]].map(([k,l])=>(
              <button key={k} style={btn(d.history.fh[k])} onClick={()=>upN("history","fh",k,!d.history.fh[k])}>{l}</button>
            ))}
          </div>
          {d.history.fh.dm && (
            <div style={{paddingLeft:12,borderLeft:"3px solid #6b3fa8",marginBottom:14}}>
              <label style={lbl({color:"#6b3fa8",fontSize:11})}>糖尿病：誰が（複数選択可）</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                {["父","母","祖父（父方）","祖母（父方）","祖父（母方）","祖母（母方）","兄弟・姉妹"].map(v=>(
                  <button key={v} style={{...btn(d.history.fh.dmWho.includes(v)),padding:"5px 10px",fontSize:12}}
                    onClick={()=>setData(p=>{const a=p.history.fh.dmWho;return{...p,history:{...p.history,fh:{...p.history.fh,dmWho:a.includes(v)?a.filter(x=>x!==v):[...a,v]}}};})}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label style={lbl()}>飲酒歴</label>
          <div style={{marginBottom:8}}>
            <button style={btn(d.history.alcoholNone,UI.neutral.fg)} onClick={()=>up("history","alcoholNone",!d.history.alcoholNone)}>{d.history.alcoholNone?"✓ 飲まない":"飲まない"}</button>
          </div>
          {!d.history.alcoholNone&&(<div>
            {d.history.alcoholItems.map((item,i)=><AlcoholRow key={i} item={item} index={i} onChange={upAl} onRemove={()=>delAl(i)} showRemove={d.history.alcoholItems.length>1}/>)}
            <button style={{...btn(false),fontSize:13,width:"100%",textAlign:"center",marginTop:4}} onClick={addAl}>＋ お酒を追加</button>
            {buildAlcohol()&&(<div style={{marginTop:8,padding:"8px 14px",background:"#ebf8ff",border:"1px solid #bee3f8",borderRadius:8,fontSize:13,color:"#2b6cb0",fontWeight:700}}>📝 カルテ記載例：{buildAlcohol()}</div>)}
          </div>)}
          <label style={lbl({marginTop:14})}>喫煙歴</label>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            {["なし","あり","禁煙済"].map(v=><button key={v} style={btn(d.history.smoking===v)} onClick={()=>up("history","smoking",v)}>{v}</button>)}
          </div>
          {(d.history.smoking==="あり"||d.history.smoking==="禁煙済")&&(<div style={sBox({border:"1.5px solid #bee3f8",background:"#ebf8ff",marginBottom:10})}>
            <div style={{fontSize:12,color:"#2b6cb0",fontWeight:700,marginBottom:10}}>📝 カルテ記載：{buildSmoking()||"入力中..."}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
              <div style={{flex:"1 1 80px"}}><label style={lbl({color:"#2b6cb0"})}>1日の本数</label><input style={inp()} type="number" placeholder="本/日" value={d.history.smokingAmount} onChange={e=>up("history","smokingAmount",e.target.value)}/></div>
              <div style={{flex:"1 1 80px"}}><label style={lbl({color:"#2b6cb0"})}>喫煙年数</label><input style={inp()} type="number" placeholder="年" value={d.history.smokingYears} onChange={e=>up("history","smokingYears",e.target.value)}/></div>
              <div style={{flex:"1 1 80px"}}><label style={lbl({color:"#2b6cb0"})}>開始年齢</label><input style={inp()} type="number" placeholder="歳〜" value={d.history.smokingStartAge} onChange={e=>up("history","smokingStartAge",e.target.value)}/></div>
            </div>
            {d.history.smoking==="禁煙済"&&(<div><label style={lbl({color:"#2b6cb0"})}>禁煙した時期</label><EraYear era={d.history.smokingQuitEra} year={d.history.smokingQuitYear} onEraChange={v=>up("history","smokingQuitEra",v)} onYearChange={v=>up("history","smokingQuitYear",v)}/></div>)}
          </div>)}
          <label style={lbl()}>健診の種類</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:14}}>
            {["市の健診","会社の健診","人間ドック","なし"].map(v=><button key={v} style={btn(d.history.checkup.includes(v))} onClick={()=>toggleArr("history","checkup",v)}>{v}</button>)}
          </div>
          {isOver60&&(<div style={sBox({border:"1.5px solid #bee3f8",background:"#ebf8ff"})}>
            <div style={{fontSize:13,fontWeight: 700,color:"#2b6cb0",marginBottom:12}}>💉 ワクチン希望（60歳以上）</div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:180}}>
                <label style={lbl({color:"#2b6cb0"})}>プレベナー20</label>
                <div style={{display:"flex",gap:4}}>{["希望あり","なし"].map(v=><button key={v} style={btn(d.history.vaccine65Prevena===v)} onClick={()=>up("history","vaccine65Prevena",v)}>{v}</button>)}</div>
              </div>
              <div style={{flex:1,minWidth:180}}>
                <label style={lbl({color:"#2b6cb0"})}>帯状疱疹ワクチン</label>
                <div style={{display:"flex",gap:4}}>{["希望あり","なし"].map(v=><button key={v} style={btn(d.history.vaccine65Herpes===v)} onClick={()=>up("history","vaccine65Herpes",v)}>{v}</button>)}</div>
              </div>
            </div>
          </div>)}
          <label style={lbl()}>生活情報（同居・家族構成）</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:8}}>
            {LIVING_WITH_SPOUSE.map(v=><button key={v} style={btn(d.history.livingSpouse===v)} onClick={()=>up("history","livingSpouse",v)}>{v}</button>)}
          </div>
          <label style={lbl({marginTop:8})}>子供・その他との同居（複数選択可）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>{LIVING_OTHERS.map(v=><button key={v} style={btn((d.history.livingOther||[]).includes(v))} onClick={()=>toggleArr("history","livingOther",v)}>{v}</button>)}</div>
          <input style={{...inp(),marginBottom:8}} placeholder="その他の場合や補足があれば（例：兄弟と同居・夫は要介護）" value={d.history.livingCustom} onChange={e=>up("history","livingCustom",e.target.value)}/>
          {isOver70&&(<div style={sBox({border:"1.5px solid #fbd38d",background:"#fffaf0"})}>
            <div style={{fontSize:13,fontWeight: 700,color:"#c05621",marginBottom:8}}>👨‍👩‍👧 お子さんの状況（70歳以上）</div>
            {(Array.isArray(d.history.livingOther)?d.history.livingOther:[]).includes("子供と同居なし")&&(
              <div style={{marginBottom:10}}>
                <label style={lbl({color:"#c05621",fontSize:11})}>お子さんの居住地</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
                  {CHILD_LOCATIONS.map(v=>(<button key={v} style={btn(d.history.childLocation===v)} onClick={()=>up("history","childLocation",v)}>{v}</button>))}
                </div>
                {d.history.childLocation&&d.history.childLocation!=="子供なし"&&(
                  <>
                    <label style={lbl({color:"#c05621",fontSize:11})}>息子・娘（複数選択可）</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                      {CHILD_GENDERS.map(v=>(<button key={v} style={btn((d.history.childGender||[]).includes(v),undefined)} onClick={()=>toggleArr("history","childGender",v)}>{v}</button>))}
                    </div>
                  </>
                )}
              </div>
            )}
            <label style={lbl({color:"#c05621",fontSize:11})}>補足（任意）</label>
            <input style={inp()} placeholder="例：子供は近居（さいたま市）" value={d.history.childInfo} onChange={e=>up("history","childInfo",e.target.value)}/>
          </div>)}
          <label style={lbl({marginTop:8})}>仕事</label>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            {["している","していない"].map(v=><button key={v} style={btn(d.history.work===v)} onClick={()=>up("history","work",v)}>{v}</button>)}
          </div>
          {d.history.work==="している"&&(
            <div>
              <div style={{fontSize:11,color:"#888",marginBottom:4}}>複数選択可</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
                {["会社員（デスクワーク）","会社員（現場・営業）","自営業","パート・アルバイト","医療・福祉職","教育職（教師・保育士）","飲食・サービス業","農業・林業・漁業","専業主婦・主夫","学生"].map(v=>(
                  <button key={v} style={{...btn((d.history.job||[]).includes(v),undefined),padding:"6px 10px",fontSize:12}} onClick={()=>toggleArr("history","job",v)}>{v}</button>
                ))}
              </div>
              <input style={{...inp(),marginBottom:14}} placeholder="補足・その他（例：週3日リモート）" value={d.history.jobNote} onChange={e=>up("history","jobNote",e.target.value)}/>
            </div>
          )}
          <label style={lbl()}>活動量</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {["体を動かしていることが多い","立っていることが多い","座っていることが多い"].map(v=><button key={v} style={btn(d.history.activity===v)} onClick={()=>up("history","activity",v)}>{v}</button>)}
          </div>
        </div>
      );

      // ── Step 3: 体格・要望 (HTHL流用) ─────────────────
      case 3: return (
        <div>
          <label style={lbl()}>身長・体重</label>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
            {[["height","身長","cm"],["weightNow","現在の体重","kg"],["weight20","20歳時の体重","kg"],["weightMax","最大体重","kg"],["weightMaxAge","最大体重の年齢","歳"]].map(([k,l,u])=>(
              <div key={k} style={{flex:"1 1 130px",maxWidth:"calc(20% - 8px)"}}>
                <label style={lbl()}>{l}（{u}）</label>
                <input style={inp()} type="number" placeholder={u} value={d.body[k]} onChange={e=>up("body",k,e.target.value)}/>
              </div>
            ))}
          </div>
          {bmi&&(<div style={{marginBottom:16,padding:"10px 16px",background:"#e8f8ee",borderRadius:8,fontSize:14,fontWeight:700,color:"#2d8653"}}>BMI：{bmi}　{parseFloat(bmi)<18.5?"（低体重）":parseFloat(bmi)<25?"（普通体重）":parseFloat(bmi)<30?"（肥満1度）":"（肥満2度以上）"}</div>)}
          <label style={lbl()}>希望曜日（複数選択可）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:14}}>
            {WEEKDAYS.map(v=>(<button key={v} style={btn((d.body.preferredDays||[]).includes(v),"#2d8653")} onClick={()=>toggleArr("body","preferredDays",v)}>{v}</button>))}
          </div>
          <label style={lbl()}>医師の希望</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:14}}>
            {["指定なし","女性医師希望","男性医師希望","院長（初回のみ）"].map(v=>(<button key={v} style={btn(d.body.doctorGender===v)} onClick={()=>up("body","doctorGender",v)}>{v}</button>))}
          </div>
          <label style={lbl()}>診察への要望・聞きたいこと</label>
          <textarea style={{...inp(),minHeight:80,resize:"vertical"}} placeholder="自由にご記入ください（なければ空欄）" value={d.body.concern} onChange={e=>up("body","concern",e.target.value)}/>
          <div style={sBox({background:"#fff8f0",border:"1.5px dashed #fbd38d",marginTop:14})}>
            <div style={{fontSize:12,fontWeight: 700,color:"#c05621",marginBottom:8}}>🔒 スタッフ入力欄（患者は操作不要）</div>
            <label style={lbl({color:"#c05621",fontSize:11})}>患者フラグ</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:10}}>
              {["通常","○患者疑い（話が長い方）","●患者疑い（出禁対象）"].map(v=>(<button key={v} style={btn(d.body.patientFlag===v,undefined,{fontSize:12})} onClick={()=>up("body","patientFlag",v)}>{v}</button>))}
            </div>
            <label style={{fontSize:13,color:"#c05621",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
              <input type="checkbox" checked={!!d.body.doubleSlot} onChange={e=>up("body","doubleSlot",e.target.checked)}/> 新患2枠取得済み
            </label>
          </div>
        </div>
      );

      // ── Step 4: 病歴・経緯の聴取 ──────────────────────
      case 4: return (
        <div>
          <VoiceMemoSection
            formData={data}
            formType="sas"
            initialValue={data.voiceMemo}
            onUpdate={(voiceMemo) => setData(p => ({ ...p, voiceMemo }))}
          />
          <VoiceMemoSection
            mode="pastHistory"
            formData={data}
            formType="sas"
            initialValue={data.voicePastHistory}
            onUpdate={(memo) => setData(p => ({ ...p, voicePastHistory: memo }))}
          />
        </div>
      );

      default: return null;
    }
  };

  return (
    <div ref={topRef} style={{minHeight:"100vh",background:UI.surfaceAlt,fontFamily:"'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif",padding:"20px 16px"}}>

      <style>{`@keyframes kinkSpin{to{transform:rotate(360deg)}}`}</style>
      {loading && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.52)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{width:54,height:54,border:'5px solid rgba(255,255,255,0.25)',borderTopColor:'#fff',borderRadius:'50%',animation:'kinkSpin 0.8s linear infinite'}}/>
          <div style={{color:'#fff',fontWeight: 700,fontSize:17,marginTop:22,textAlign:'center',lineHeight:1.8}}>カルテを作成しています...<br/>少々お待ちください</div>
        </div>
      )}
      <div style={{maxWidth:680,margin:"0 auto 18px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>router.push("/")} style={{padding:"6px 11px",borderRadius:6,border:`1px solid ${UI.border}`,background:UI.surface,color:UI.textMuted,fontWeight:700,fontSize:12,cursor:"pointer"}}>← トップ</button>
          <div>
            <div style={{fontSize:11,color:UI.textFaint,fontWeight:700,letterSpacing:"0.08em"}}>まつもと糖尿病クリニック</div>
            <div style={{fontSize:19,fontWeight:700,color:UI.text}}>初診事前問診</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,background:TONE.bg,color:TONE.fg,padding:"4px 12px",borderRadius:4,fontWeight:700}}>睡眠時無呼吸症候群</span>
          </div>
        </div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto"}}>
        {!done&&(<div style={{display:"flex",gap:4,marginBottom:18}}>
          {STEPS.map((s,i)=>(<div key={s.id} onClick={()=>goStep(i)} style={{flex:1,textAlign:"center",cursor:"pointer",userSelect:"none"}}>
            <div style={{height:3,borderRadius:2,background:i<=step?TONE.fg:UI.border,marginBottom:5,transition:"background 0.3s"}}/>
            <div style={{fontSize:10,color:i===step?TONE.fg:i<step?UI.textMuted:UI.textDisabled,fontWeight:i<=step?700:400}}>{i<step?"✓ ":""}{s.title}</div>
          </div>))}
        </div>)}

        {!done?(
          <div style={{background:UI.surface,borderRadius:8,padding:"22px 24px",border:`1px solid ${UI.border}`,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
            <h2 style={{fontSize:15,fontWeight:700,color:UI.text,marginBottom:18,borderBottom:`1px solid ${UI.border}`,paddingBottom:10}}>{STEPS[step].title}</h2>
            {renderStep()}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:26}}>
              <button style={{padding:"10px 20px",borderRadius:6,border:`1px solid ${UI.border}`,background:UI.surface,color:step===0?UI.textDisabled:UI.textMuted,fontWeight:700,fontSize:14,cursor:step===0?"not-allowed":"pointer"}} onClick={()=>goStep(step-1)} disabled={step===0}>← 前へ</button>
              {step<STEPS.length-1?(
                <button style={{padding:"10px 24px",borderRadius:6,border:"none",background:TONE.fg,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>goStep(step+1)}>次へ →</button>
              ):(
                <button style={{padding:"10px 24px",borderRadius:6,border:"none",background:loading?UI.textDisabled:UI.success.fg,color:"#fff",fontWeight:700,fontSize:14,cursor:loading?"not-allowed":"pointer"}} onClick={generateKarte} disabled={loading}>{loading?"生成中...":"✨ カルテ文を生成"}</button>
              )}
            </div>
          </div>
        ):(
          <div style={{background:UI.surface,borderRadius:8,padding:"22px 24px",border:`1px solid ${UI.border}`,boxShadow:"0 2px 8px rgba(0,0,0,.06)",border:"2px solid #d6d0f8"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{width:32,height:32,borderRadius:8,background:"#5a4fa8",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight: 700,fontSize:16}}>✓</div>
              <div>
                <div style={{fontWeight: 700,color:"#3a2f78",fontSize:15}}>カルテ記載文が生成されました</div>
                <div style={{fontSize:12,color:"#7a6fd0"}}>内容確認後、電子カルテにコピーしてください</div>
              </div>
            </div>
            {saveError && (
              <div style={{background:"#fff5f5",border:"2px solid #feb2b2",borderRadius:10,padding:"14px 16px",marginBottom:12,textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#c53030",marginBottom:8}}>⚠️ 受付番号の登録に失敗しました。スタッフへ口頭でお知らせください。</div>
                <button onClick={handleSaveRetry} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#e53e3e",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>🔄 再試行</button>
              </div>
            )}
            {visitCode && (
              <div style={{background: TONE.fg, borderRadius: 8,padding:"20px",marginBottom:16,textAlign:"center"}}>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",marginBottom:6,fontWeight:700}}>受付番号</div>
                <div style={{fontSize:56,fontWeight: 700,color:"#fff",letterSpacing:"0.2em",lineHeight:1}}>{visitCode}</div>
              </div>
            )}
            <div style={{background:"#fff8e1",border:"2px solid #f59e0b",borderRadius:12,padding:"14px 18px",marginBottom:12,textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight: 700,color:"#92400e"}}>📋 タブレットを受付にお返しください</div>
              <div style={{fontSize:12,color:"#b45309",marginTop:4}}>問診は完了しています。ありがとうございました。</div>
            </div>
            <div style={{marginBottom:4}}>
              <button onClick={()=>setShowKarte(v=>!v)} style={{width:"100%",padding:"11px",borderRadius:8,border:"1.5px solid #d6d0f8",background:showKarte?"#eee9ff":"#f7f5ff",color:"#3a2f78",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                {showKarte?"▲ カルテ文を閉じる（スタッフ用）":"▼ スタッフ用カルテを確認する"}
              </button>
            </div>
            {showKarte && (
              <div style={{marginBottom:8}}>
                <textarea value={result} onChange={e=>setResult(e.target.value)} style={{width:"100%",minHeight:320,background:"#f7f5ff",border:"1px solid #d6d0f8",borderRadius:10,padding:"16px 18px",fontSize:11,lineHeight:2,color:"#1a2a4a",fontFamily:"monospace",resize:"vertical",boxSizing:"border-box"}}/>
                <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
                  <button onClick={saveEditedKarte} disabled={saving} style={{padding:"10px 18px",borderRadius:8,border:"none",background:saving?"#a89cdc":"#5a4fa8",color:"#fff",fontWeight: 700,fontSize:13,cursor:saving?"wait":"pointer"}}>{saving?"💾 保存中...":"💾 編集内容を保存"}</button>
                  {saveMsg && <span style={{fontSize:13,fontWeight:700,color:saveMsg.startsWith("✓")?"#0f9668":"#c53030"}}>{saveMsg}</span>}
                </div>
              </div>
            )}

            <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"none",background: TONE.fg,color:"#fff",fontWeight: 700,fontSize:14,cursor:"pointer"}} onClick={()=>copyToClipboard(result)}>📋 コピー</button>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"1.5px solid #5a4fa8",background:"#f7f5ff",color:"#5a4fa8",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>{setDone(false);setStep(0);setTimeout(scrollTop,50);}}>✏️ 修正する</button>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"1.5px solid #d6d8f0",background:"#f7faff",color:"#5580a8",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>{setDone(false);setStep(0);setData(initialData);setResult("");setVisitCode("");setRecordId("");setSaveMsg("");setShowKarte(false);setSaveError(false);setTimeout(scrollTop,50);}}>🔄 最初から</button>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"1.5px solid #d6d0f8",background:"#f7f5ff",color:"#3a2f78",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>{window.location.href="/";}}>🏠 TOPへ</button>
            </div>
          </div>
        )}
        <div style={{textAlign:"center",fontSize:11,color:"#a0a8d0",marginTop:14}}>入力内容は送信後に消去されます　│　個人情報は院内のみで使用されます</div>
      </div>
    </div>
  );
}

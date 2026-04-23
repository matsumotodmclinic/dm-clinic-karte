import { useState, useRef } from "react";
import { useRouter } from "next/router";

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "指定なし"];
const ALLERGY_QUICK = ["花粉", "ペニシリン", "造影剤", "フルーツ"];
const CHILD_LOCATIONS = ["近居（同一市区町村）", "近隣（同一都道府県）", "遠方（他都道府県）", "子供なし"];
const CHILD_GENDERS = ["息子", "娘", "両方"];

const STEPS = [
  { id: "symptom", title: "症状・きっかけ" },
  { id: "history", title: "既往・生活歴" },
  { id: "body",    title: "体格・要望" },
];

const LIVING_WITH_SPOUSE = ["配偶者あり", "配偶者なし（独居・死別・離別等）"];
const LIVING_OTHERS = ["子供と同居なし", "息子と同居", "娘と同居", "息子夫婦と同居", "娘夫婦と同居", "親と同居", "その他"];

const ALCOHOL_TYPES = [
  { key: "beer",   label: "ビール",     unit: "缶(350ml)", amounts: ["1缶","2缶","3缶以上"] },
  { key: "happo",  label: "発泡酒",     unit: "缶(350ml)", amounts: ["1缶","2缶","3缶以上"] },
  { key: "wine",   label: "ワイン",     unit: "杯",        amounts: ["1杯","2杯","ボトル1本"] },
  { key: "shochu", label: "焼酎",       unit: "",          amounts: ["1合","2合","3合以上"] },
  { key: "sake",   label: "日本酒",     unit: "合",        amounts: ["1合","2合","3合以上"] },
  { key: "whisky", label: "ウイスキー", unit: "杯",        amounts: ["1杯","2杯","3杯以上"] },
];
const emptyAlcohol = () => ({ type: "", amount: "", freq: "" });

const initialData = {
  symptom: {
    timing: [], timingNote: "",
    cause: [], causeNote: "",
    symptoms: [], symptomsNote: "",
    thyroidAdded: "",
    libreStarted: "", libreNote: "",
    cgmWish: "",
  },
  history: {
    age: "",
    allergy: "なし", allergyDetail: "",
    fh: { dm: false, dmWho: [], ht: false, hl: false, apo: false, ihd: false },
    alcoholNone: false, alcoholItems: [emptyAlcohol()],
    smoking: "なし", smokingAmount: "", smokingYears: "", smokingStartAge: "",
    smokingQuitEra: "令和", smokingQuitYear: "",
    checkup: [],
    vaccine65Prevena: "", vaccine65Herpes: "",
    livingSpouse: "", livingOther: "", livingCustom: "", childInfo: "", childLocation: "", childGender: [],
    work: "していない", job: [], jobNote: "", activity: "",
    otherDiseases: [{name:"",hospital:"",hospitalOther:""}],
  },
  body: { height: "", weightNow: "", weight20: "", weightMax: "", weightMaxAge: "", concern: "", preferredDays: [], doctorGender: "", patientFlag: "通常", doubleSlot: false },
};

const inp = (x={}) => ({ padding:"9px 12px", border:"1.5px solid #d0dff5", borderRadius:8, fontSize:14, color:"#1a2a3a", background:"#f7faff", outline:"none", boxSizing:"border-box", fontFamily:"inherit", width:"100%", ...x });
const lbl = (x={}) => ({ display:"block", fontSize:12, fontWeight:700, color:"#b45309", marginBottom:5, letterSpacing:"0.03em", ...x });
const btn = (active, color="#b45309", x={}) => ({ padding:"8px 14px", borderRadius:8, border:active?`2px solid ${color}`:"2px solid #f0ddc0", background:active?color:"#fffbf5", color:active?"#fff":"#92400e", fontWeight:700, fontSize:13, cursor:"pointer", margin:"3px 4px 3px 0", ...x });
const sBox = (x={}) => ({ background:"#fffbf5", border:"1.5px solid #f0ddc0", borderRadius:10, padding:"14px 16px", marginBottom:14, ...x });

function EraYear({ era, year, onEraChange, onYearChange }) {
  return (
    <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
      <select style={{ ...inp(), width:96 }} value={era} onChange={e=>onEraChange(e.target.value)}>
        <option>昭和</option><option>平成</option><option>令和</option>
      </select>
      <input style={{ ...inp(), width:68 }} type="number" placeholder="年" value={year} onChange={e=>onYearChange(e.target.value)} />
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
        {ALCOHOL_TYPES.map(t=><button key={t.key} style={btn(item.type===t.key,"#2b6cb0")} onClick={()=>onChange(index,"type",t.key)}>{t.label}</button>)}
      </div>
      {typeInfo && (<>
        <label style={lbl({ color:"#2b6cb0" })}>量（{typeInfo.unit||"目安"}）</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginBottom:8 }}>
          {typeInfo.amounts.map(a=><button key={a} style={btn(item.amount===a,"#2b6cb0")} onClick={()=>onChange(index,"amount",a)}>{a}</button>)}
        </div>
        <label style={lbl({ color:"#2b6cb0" })}>頻度</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
          {["毎日","週5〜6日","週3〜4日","週1〜2日","機会飲酒"].map(f=><button key={f} style={btn(item.freq===f,"#2b6cb0")} onClick={()=>onChange(index,"freq",f)}>{f}</button>)}
        </div>
      </>)}
    </div>
  );
}

export default function RHIntakeTool() {
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

  const scrollTop = () => { if(topRef.current) topRef.current.scrollIntoView({behavior:"smooth"}); };
  const goStep = (n) => { setStep(n); setTimeout(scrollTop, 50); };
  const up  = (sec,f,v) => setData(p=>({...p,[sec]:{...p[sec],[f]:v}}));
  const upN = (sec,par,f,v) => setData(p=>({...p,[sec]:{...p[sec],[par]:{...p[sec][par],[f]:v}}}));
  const toggleArr = (sec,f,v) => setData(p=>{const a=p[sec][f];return{...p,[sec]:{...p[sec],[f]:a.includes(v)?a.filter(x=>x!==v):[...a,v]}};});
  const upAl = (i,f,v) => setData(p=>{const a=[...p.history.alcoholItems];a[i]={...a[i],[f]:v};return{...p,history:{...p.history,alcoholItems:a}};});
  const addAl = () => setData(p=>({...p,history:{...p.history,alcoholItems:[...p.history.alcoholItems,emptyAlcohol()]}}));
  const delAl = (i) => setData(p=>({...p,history:{...p.history,alcoholItems:p.history.alcoholItems.filter((_,j)=>j!==i)}}));

  const age = parseInt(data.history.age)||0;
  const bmi = data.body.height && data.body.weightNow
    ? (parseFloat(data.body.weightNow)/Math.pow(parseFloat(data.body.height)/100,2)).toFixed(1) : null;
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
    const other=(livingOther==="子供と同居なし"||!livingOther)?"":livingOther;
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

  const copyToClipboard = (text) => {
    const copy = () => { const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); alert('コピーしました'); };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(() => alert('コピーしました')).catch(copy); } else { copy(); }
  };

  const handleSaveRetry = async () => {
    setSaveError(false);
    try {
      const saveRes = await fetch("/api/questionnaire",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({form_type:"反応性低血糖",form_data:data,age:data.history?.age||null,generated_karte:result})});
      const saveJson = await saveRes.json();
      if(saveJson.visit_code) { setVisitCode(saveJson.visit_code); if (saveJson.id) setRecordId(saveJson.id); }
      else setSaveError(true);
    } catch(e) { setSaveError(true); }
  };
  const saveEditedKarte = async () => {
    if (!recordId) { setSaveMsg("保存先IDが見つかりません"); setTimeout(() => setSaveMsg(""), 3000); return; }
    try {
      const res = await fetch("/api/questionnaire", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: recordId, generated_karte: result }) });
      if (res.ok) { setSaveMsg("✓ 保存しました"); setTimeout(() => setSaveMsg(""), 2500); }
      else { setSaveMsg("保存に失敗しました"); setTimeout(() => setSaveMsg(""), 3000); }
    } catch (e) { setSaveMsg("保存に失敗しました"); setTimeout(() => setSaveMsg(""), 3000); }
  };

  const generateKarte = async () => {
    setLoading(true);
    const prompt = `あなたは糖尿病専門クリニックの電子カルテ記載AIです。以下の患者情報をもとに、反応性低血糖のカルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（♯【】）を使用する
- 甲状腺3項目追加済の場合は申し送り事項に記載
- CGM/リブレ装着情報も申し送り事項に記載
- 60歳未満はワクチン歴を省略、70歳未満は子供の状況を省略

【整形済みデータ】
飲酒歴：${buildAlcohol()}
喫煙歴：${buildSmoking()}
生活情報：${buildLiving()}
子供の状況：${buildChildInfo()}
職業：${buildJob()}
希望曜日：${buildWeekday()}
医師性別希望：${data.body.doctorGender || "指定なし"}
患者フラグ：${data.body.patientFlag || "通常"}
新患2枠取得：${data.body.doubleSlot ? "取得済" : "なし"}

【患者情報JSON】
${JSON.stringify(data,null,2)}

【出力フォーマット】
${getCurrentMonth()}：
♯反応性低血糖疑い
・低血糖が生じるタイミング：${(data.symptom.timing||[]).join("、")}${data.symptom.timingNote?"（"+data.symptom.timingNote+"）":""}
・症状：${(data.symptom.symptoms||[]).join("、")}${data.symptom.symptomsNote?"（"+data.symptom.symptomsNote+"）":""}
・思い当たる原因：${(data.symptom.cause||[]).join("、")}${data.symptom.causeNote?"（"+data.symptom.causeNote+"）":""}

【アレルギー歴】
【FH】DM(-/+) HT(-/+) HL(-/+) APO(-/+) IHD(-/+)
【飲酒歴】
【喫煙歴】
【健診】
【ワクチン歴】（60歳以上のみ）
【生活情報】（70歳以上は子供の状況も含む）
【仕事】職業・活動量
---------------------------------------------
頚部エコー：当院で施行予定　腹部エコー：当院で施行予定
---------------------------------------------
身長:○cm　初診時:○kg${bmi ? `（BMI ${bmi}）` : ""}　20歳時:○kg　max体重○kg(○歳)
---------------------------------------------
【事前聴取時　申し送り事項】
（甲状腺3項目追加済の場合）□甲状腺3項目追加採血済
（リブレ装着済の場合）□自費CGM（リブレ）装着済
（新患2枠取得済の場合）□新患2枠取得済み
（医師性別指定ありの場合）□${data.body.doctorGender}
（患者フラグが「○患者疑い（話が長い方）」の場合）□○患者疑い（対応注意）
（患者フラグが「●患者疑い（出禁対象）」の場合）□●患者疑い（出禁対象・要確認）
（なければ省略）
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${getCurrentMonth()}：HbA1c　　%　CPR（　）　※GAD陽性の場合は甲状腺項目追加してください　CPR0.5以下の方は今後半年ごとCPR測定を入れてください。




アレルギー薬あれば赤字14フォント太字
目標HbA1c　　　　%　目標体重　　　次回検討薬：
DM基本セット
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
      try {
        const saveRes = await fetch("/api/questionnaire",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({form_type:"反応性低血糖",form_data:data,age:data.history?.age||null,generated_karte:generated})});
        const saveJson = await saveRes.json();
        if(saveJson.visit_code) { setVisitCode(saveJson.visit_code); if (saveJson.id) setRecordId(saveJson.id); }
        else setSaveError(true);
      } catch(saveErr) { setSaveError(true); }
      } catch(e) { console.error('Save error:', e); }
      setDone(true);
      setTimeout(scrollTop,50);
    } catch(e){setResult("エラー: "+e.message);setDone(true);}
    setLoading(false);
  };

  const renderStep = () => {
    const d = data;
    switch(step) {

      case 0: return (
        <div>

          <div style={{...sBox({background:"#fef9f0",border:"2px solid #d69e2e"}),marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:800,color:"#744210",marginBottom:6}}>💡 反応性低血糖とは</div>
            <div style={{fontSize:13,color:"#744210",lineHeight:1.7}}>食後数時間後に血糖値が下がりすぎることで、動悸・冷や汗・ふらつきなどの症状が出る状態です。</div>
          </div>
          <label style={lbl()}>〇どのような時に低血糖が生じますか？（複数選択可）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
            {["食後3〜4時間後","食後1〜2時間後","空腹時","食事に関係なく","運動後","飲酒後","朝起きた時"].map(v=>(
              <button key={v} style={btn(d.symptom.timing.includes(v))} onClick={()=>toggleArr("symptom","timing",v)}>{v}</button>
            ))}
          </div>
          <input style={{...inp(),marginBottom:16}} placeholder="その他・補足" value={d.symptom.timingNote} onChange={e=>up("symptom","timingNote",e.target.value)}/>
          <label style={lbl()}>〇その時の症状は？（複数選択可）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
            {["動悸","冷や汗","手の震え","ふらつき・めまい","強い眠気","集中力低下","頭痛","気分が悪い","意識が遠くなる"].map(v=>(
              <button key={v} style={btn(d.symptom.symptoms.includes(v))} onClick={()=>toggleArr("symptom","symptoms",v)}>{v}</button>
            ))}
          </div>
          <input style={{...inp(),marginBottom:16}} placeholder="その他の症状" value={d.symptom.symptomsNote} onChange={e=>up("symptom","symptomsNote",e.target.value)}/>
          <label style={lbl()}>〇思い当たる原因は？（複数選択可）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
            {["食事が不規則","甘いものをよく食べる","早食い","欠食がある","ストレスが多い","睡眠不足","特に思い当たらない"].map(v=>(
              <button key={v} style={btn(d.symptom.cause.includes(v))} onClick={()=>toggleArr("symptom","cause",v)}>{v}</button>
            ))}
          </div>
          <input style={{...inp(),marginBottom:16}} placeholder="その他・補足" value={d.symptom.causeNote} onChange={e=>up("symptom","causeNote",e.target.value)}/>

        </div>
      );

      case 1: return (
        <div>
          <label style={lbl()}>患者様の年齢</label>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <input style={{...inp(),width:80}} type="number" placeholder="歳" value={d.history.age} onChange={e=>up("history","age",e.target.value)}/>
            <span style={{fontSize:13,color:"#666"}}>歳</span>
            {age>0&&(<span style={{fontSize:12,fontWeight:700,padding:"4px 12px",borderRadius:20,color:isOver70?"#c53030":isOver60?"#c05621":"#276749",background:isOver70?"#fff5f5":isOver60?"#fffaf0":"#f0fff4",border:`1px solid ${isOver70?"#feb2b2":isOver60?"#fbd38d":"#9ae6b4"}`}}>
              {isOver70?"70歳以上：子供の状況も確認":isOver60?"60歳以上：ワクチン確認あり":"60歳未満：ワクチン確認不要"}
            </span>)}
          </div>

          <label style={lbl({marginTop:8})}>その他の病名・既往歴</label>
          <div style={{fontSize:12,color:"#7a9abf",marginBottom:8}}>例：慢性腎臓病、甲状腺疾患、うつ病 など</div>
          {(d.history.otherDiseases||[{name:"",hospital:"",hospitalOther:""}]).map((od,i)=>(
            <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
              <div style={{flex:"0 0 20px",paddingTop:10,fontSize:13,color:"#8899aa",fontWeight:700}}>{i+1}</div>
              <div style={{flex:2}}>
                {i===0&&<label style={lbl()}>病名</label>}
                <input style={inp()} placeholder="病名（なければ空欄）" value={od.name||""} onChange={e=>setData(p=>{const a=[...(p.history.otherDiseases||[])];a[i]={...a[i],name:e.target.value};return{...p,history:{...p.history,otherDiseases:a}};})}/>
              </div>
              <div style={{flex:3}}>
                {i===0&&<label style={lbl()}>現在の通院先</label>}
                {od.name ? (
                  <div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
                      <select style={{...inp(),flex:2,fontSize:12}} value={od.hospital||""}
                        onChange={e=>setData(p=>{const a=[...(p.history.otherDiseases||[])];a[i]={...a[i],hospital:e.target.value,dept:""};return{...p,history:{...p.history,otherDiseases:a}};})} >
                        <option value="">病院を選択</option>
                        {["上尾中央総合病院","自治医大さいたま医療センター","埼玉県立がんセンター","加藤泌尿器科","通院なし","その他"].map(h=><option key={h} value={h}>{h}</option>)}
                      </select>
                      {od.hospital&&od.hospital!=="通院なし"&&od.hospital!=="加藤泌尿器科"&&od.hospital!=="その他"&&(
                        <select style={{...inp(),flex:1,fontSize:12}} value={od.dept||""}
                          onChange={e=>setData(p=>{const a=[...(p.history.otherDiseases||[])];a[i]={...a[i],dept:e.target.value};return{...p,history:{...p.history,otherDiseases:a}};})} >
                          <option value="">科を選択</option>
                          {({"上尾中央総合病院":["糖尿病内科","循環器内科","消化器内科","整形外科","神経内科","腎臓内科","その他"],"自治医大さいたま医療センター":["糖尿病内科","循環器内科","消化器内科","腎臓内科","神経内科","その他"],"埼玉県立がんセンター":["消化器外科","乳腺外科","泌尿器科","呼吸器外科","その他"]}[od.hospital]||["その他"]).map(d=><option key={d} value={d}>{d}</option>)}
                        </select>
                      )}
                      {od.hospital==="その他"&&(
                        <input style={{...inp(),flex:2,fontSize:12}} placeholder="病院名を入力" value={od.hospitalOther||""} onChange={e=>setData(p=>{const a=[...(p.history.otherDiseases||[])];a[i]={...a[i],hospitalOther:e.target.value};return{...p,history:{...p.history,otherDiseases:a}};})}/>
                      )}
                    </div>
                  </div>
                ):<div style={{paddingTop:8,fontSize:12,color:"#b0c0d0"}}>病名を入力すると通院先が選べます</div>}
              </div>
              {i>0&&<button onClick={()=>setData(p=>{const a=(p.history.otherDiseases||[]).filter((_,j)=>j!==i);return{...p,history:{...p.history,otherDiseases:a}};})} style={{fontSize:12,color:"#e53e3e",background:"none",border:"none",cursor:"pointer",fontWeight:700,paddingTop:10}}>✕</button>}
            </div>
          ))}
          <button style={{...btn(false,"#718096"),fontSize:13,marginBottom:14}} onClick={()=>setData(p=>{const a=[...(p.history.otherDiseases||[]),{name:"",hospital:"",hospitalOther:""}];return{...p,history:{...p.history,otherDiseases:a}};})}>＋ その他の病名を追加</button>
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
                    <button key={v} style={btn(selected,"#c53030")} onClick={()=>{
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
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:8}}>
            {[["dm","糖尿病(DM)"],["ht","高血圧(HT)"],["hl","脂質異常症(HL)"],["apo","脳卒中(APO)"],["ihd","虚血性心疾患(IHD)"]].map(([k,l])=>(
              <button key={k} style={btn(d.history.fh[k],"#6b3fa8")} onClick={()=>upN("history","fh",k,!d.history.fh[k])}>{l}</button>
            ))}
          </div>
          {d.history.fh.dm&&(
            <div style={{paddingLeft:12,borderLeft:"3px solid #6b3fa8",marginBottom:14}}>
              <label style={lbl({color:"#6b3fa8",fontSize:11})}>糖尿病：誰が（複数選択可）</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                {["父","母","祖父（父方）","祖母（父方）","祖父（母方）","祖母（母方）","兄弟・姉妹"].map(v=>(
                  <button key={v} style={{...btn(d.history.fh.dmWho.includes(v),"#6b3fa8"),padding:"5px 10px",fontSize:12}}
                    onClick={()=>setData(p=>{const a=p.history.fh.dmWho;return{...p,history:{...p.history,fh:{...p.history.fh,dmWho:a.includes(v)?a.filter(x=>x!==v):[...a,v]}}};})}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label style={lbl()}>飲酒歴</label>
          <div style={{marginBottom:8}}>
            <button style={btn(d.history.alcoholNone,"#718096")} onClick={()=>up("history","alcoholNone",!d.history.alcoholNone)}>{d.history.alcoholNone?"✓ 飲まない":"飲まない"}</button>
          </div>
          {!d.history.alcoholNone&&(<div>
            {d.history.alcoholItems.map((item,i)=><AlcoholRow key={i} item={item} index={i} onChange={upAl} onRemove={()=>delAl(i)} showRemove={d.history.alcoholItems.length>1}/>)}
            <button style={{...btn(false,"#2b6cb0"),fontSize:13,width:"100%",textAlign:"center",marginTop:4}} onClick={addAl}>＋ お酒を追加</button>
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
            {d.history.smoking==="禁煙済"&&(<div><label style={lbl({color:"#2b6cb0"})}>禁煙した時期</label>
              <EraYear era={d.history.smokingQuitEra} year={d.history.smokingQuitYear} onEraChange={v=>up("history","smokingQuitEra",v)} onYearChange={v=>up("history","smokingQuitYear",v)}/></div>)}
          </div>)}
          <label style={lbl()}>健診の種類</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:14}}>
            {["市の健診","会社の健診","人間ドック","なし"].map(v=><button key={v} style={btn(d.history.checkup.includes(v))} onClick={()=>toggleArr("history","checkup",v)}>{v}</button>)}
          </div>
          {isOver60&&(<div style={sBox({border:"1.5px solid #bee3f8",background:"#ebf8ff"})}>
            <div style={{fontSize:13,fontWeight:800,color:"#2b6cb0",marginBottom:12}}>💉 ワクチン希望（60歳以上）</div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:180}}>
                <label style={lbl({color:"#2b6cb0"})}>プレベナー20</label>
                <div style={{display:"flex",gap:4}}>{["希望あり","なし"].map(v=><button key={v} style={btn(d.history.vaccine65Prevena===v,"#2b6cb0")} onClick={()=>up("history","vaccine65Prevena",v)}>{v}</button>)}</div>
              </div>
              <div style={{flex:1,minWidth:180}}>
                <label style={lbl({color:"#2b6cb0"})}>帯状疱疹ワクチン</label>
                <div style={{display:"flex",gap:4}}>{["希望あり","なし"].map(v=><button key={v} style={btn(d.history.vaccine65Herpes===v,"#2b6cb0")} onClick={()=>up("history","vaccine65Herpes",v)}>{v}</button>)}</div>
              </div>
            </div>
          </div>)}
          <label style={lbl()}>生活情報（同居・家族構成）</label>
          <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>配偶者の有無</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:10}}>
            {LIVING_WITH_SPOUSE.map(v=><button key={v} style={btn(d.history.livingSpouse===v)} onClick={()=>up("history","livingSpouse",v)}>{v}</button>)}
          </div>
          <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>子供・その他との同居</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:8}}>
            {LIVING_OTHERS.map(v=><button key={v} style={btn(d.history.livingOther===v)} onClick={()=>up("history","livingOther",v)}>{v}</button>)}
          </div>
          <input style={{...inp(),marginBottom:8}} placeholder="その他の場合や補足があれば（例：兄弟と同居・夫は要介護）" value={d.history.livingCustom} onChange={e=>up("history","livingCustom",e.target.value)}/>
          {isOver70&&(<div style={sBox({border:"1.5px solid #fbd38d",background:"#fffaf0"})}>
            <div style={{fontSize:13,fontWeight:800,color:"#c05621",marginBottom:8}}>👨‍👩‍👧 お子さんの状況（70歳以上）</div>
            {d.history.livingOther==="子供と同居なし"&&(
              <div style={{marginBottom:10}}>
                <label style={lbl({color:"#c05621",fontSize:11})}>お子さんの居住地</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
                  {CHILD_LOCATIONS.map(v=>(
                    <button key={v} style={btn(d.history.childLocation===v,"#c05621")} onClick={()=>up("history","childLocation",v)}>{v}</button>
                  ))}
                </div>
                {d.history.childLocation&&d.history.childLocation!=="子供なし"&&(
                  <>
                    <label style={lbl({color:"#c05621",fontSize:11})}>息子・娘（複数選択可）</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                      {CHILD_GENDERS.map(v=>(
                        <button key={v} style={btn((d.history.childGender||[]).includes(v),"#c05621")} onClick={()=>toggleArr("history","childGender",v)}>{v}</button>
                      ))}
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
                  <button key={v} style={{...btn((d.history.job||[]).includes(v),"#b45309"),padding:"6px 10px",fontSize:12}} onClick={()=>toggleArr("history","job",v)}>{v}</button>
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

      case 2: return (
        <div>
          <label style={lbl()}>身長・体重</label>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
            {[["height","身長","cm"],["weightNow","現在の体重","kg"],["weight20","20歳時の体重","kg"],["weightMax","最大体重","kg"],["weightMaxAge","最大体重の年齢","歳"]].map(([k,l,u])=>(
              <div key={k} style={{flex:"1 1 90px"}}>
                <label style={lbl()}>{l}（{u}）</label>
                <input style={inp()} type="number" placeholder={u} value={d.body[k]} onChange={e=>up("body",k,e.target.value)}/>
              </div>
            ))}
          </div>
          {bmi&&(<div style={{marginBottom:16,padding:"10px 16px",background:"#fef9f0",borderRadius:8,fontSize:14,fontWeight:700,color:"#b45309"}}>BMI：{bmi}　{parseFloat(bmi)<18.5?"（低体重）":parseFloat(bmi)<25?"（普通体重）":parseFloat(bmi)<30?"（肥満1度）":"（肥満2度以上）"}</div>)}
          <label style={lbl()}>希望曜日（複数選択可）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:14}}>
            {WEEKDAYS.map(v=>(
              <button key={v} style={btn((d.body.preferredDays||[]).includes(v),"#b45309")} onClick={()=>toggleArr("body","preferredDays",v)}>{v}</button>
            ))}
          </div>
          <label style={lbl()}>医師の性別希望</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:14}}>
            {["指定なし","女性医師希望","男性医師希望"].map(v=>(
              <button key={v} style={btn(d.body.doctorGender===v,"#b45309")} onClick={()=>up("body","doctorGender",v)}>{v}</button>
            ))}
          </div>
          <label style={lbl()}>診察への要望・聞きたいこと</label>
          <textarea style={{...inp(),minHeight:80,resize:"vertical"}} placeholder="自由にご記入ください（なければ空欄）" value={d.body.concern} onChange={e=>up("body","concern",e.target.value)}/>
          <div style={sBox({background:"#fff8f0",border:"1.5px dashed #fbd38d",marginTop:14})}>
            <div style={{fontSize:12,fontWeight:800,color:"#c05621",marginBottom:8}}>🔒 スタッフ入力欄（患者は操作不要）</div>
            <label style={lbl({color:"#c05621",fontSize:11})}>患者フラグ</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:10}}>
              {["通常","○患者疑い（話が長い方）","●患者疑い（出禁対象）"].map(v=>(
                <button key={v} style={btn(d.body.patientFlag===v,"#c05621",{fontSize:12})} onClick={()=>up("body","patientFlag",v)}>{v}</button>
              ))}
            </div>
            <label style={{fontSize:13,color:"#c05621",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
              <input type="checkbox" checked={!!d.body.doubleSlot} onChange={e=>up("body","doubleSlot",e.target.checked)}/> 新患2枠取得済み
            </label>
          </div>
        </div>
      );

      default: return null;
    }
  };

  return (
    <div ref={topRef} style={{minHeight:"100vh",background:"linear-gradient(135deg,#fffbf0 0%,#fff8f0 50%,#fff5f0 100%)",fontFamily:"'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif",padding:"20px 16px"}}>

      <style>{`@keyframes kinkSpin{to{transform:rotate(360deg)}}`}</style>
      {loading && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.52)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{width:54,height:54,border:'5px solid rgba(255,255,255,0.25)',borderTopColor:'#fff',borderRadius:'50%',animation:'kinkSpin 0.8s linear infinite'}}/>
          <div style={{color:'#fff',fontWeight:800,fontSize:17,marginTop:22,textAlign:'center',lineHeight:1.8}}>カルテを作成しています...<br/>少々お待ちください</div>
        </div>
      )}
      <div style={{maxWidth:700,margin:"0 auto 18px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>router.push("/")} style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid #f0ddc0",background:"#fff",color:"#b45309",fontWeight:700,fontSize:12,cursor:"pointer"}}>← トップ</button>
          <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#b45309,#d97706)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏥</div>
          <div>
            <div style={{fontSize:11,color:"#b45309",fontWeight:700,letterSpacing:"0.08em"}}>まつもと糖尿病クリニック</div>
            <div style={{fontSize:20,fontWeight:900,color:"#1a2a4a"}}>初診事前問診</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
<span style={{fontSize:12,background:"#fffbf0",color:"#b45309",padding:"4px 14px",borderRadius:20,fontWeight:700,border:"1px solid #f0ddc0"}}>反応性低血糖</span>
          </div>
        </div>
      </div>

      <div style={{maxWidth:700,margin:"0 auto"}}>
        {!done&&(<div style={{display:"flex",gap:4,marginBottom:18}}>
          {STEPS.map((s,i)=>(<div key={s.id} onClick={()=>goStep(i)} style={{flex:1,textAlign:"center",cursor:"pointer",userSelect:"none"}}>
            <div style={{height:4,borderRadius:2,background:i===step?"#b45309":i<step?"#d97706":"#f0ddc0",marginBottom:4,transition:"background 0.3s"}}/>
            <div style={{fontSize:10,color:i===step?"#b45309":i<step?"#d97706":"#d0a888",fontWeight:i===step?800:i<step?600:400}}>{i<step?"✓ ":""}{s.title}</div>
          </div>))}
        </div>)}

        {!done?(
          <div style={{background:"#fff",borderRadius:16,padding:"24px 26px",boxShadow:"0 2px 20px rgba(180,83,9,0.07)"}}>
            <h2 style={{fontSize:16,fontWeight:800,color:"#1a2a4a",marginBottom:18,borderBottom:"2px solid #fef3e2",paddingBottom:10}}>{STEPS[step].title}</h2>
            {renderStep()}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:26}}>
              <button style={{padding:"11px 22px",borderRadius:8,border:"1.5px solid #f0ddc0",background:"#fffbf5",color:step===0?"#d0a888":"#92400e",fontWeight:700,fontSize:14,cursor:step===0?"not-allowed":"pointer"}} onClick={()=>goStep(step-1)} disabled={step===0}>← 前へ</button>
              {step<STEPS.length-1?(
                <button style={{padding:"11px 26px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#b45309,#d97706)",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:"0 4px 12px rgba(180,83,9,0.25)"}} onClick={()=>goStep(step+1)}>次へ →</button>
              ):(
                <button style={{padding:"11px 26px",borderRadius:8,border:"none",background:loading?"#8ab0d4":"linear-gradient(135deg,#0f9668,#34d399)",color:"#fff",fontWeight:800,fontSize:14,cursor:loading?"not-allowed":"pointer",boxShadow:"0 4px 12px rgba(15,150,104,0.25)"}} onClick={generateKarte} disabled={loading}>{loading?"生成中...":"✨ カルテ文を生成"}</button>
              )}
            </div>
          </div>
        ):(
          <div style={{background:"#fff",borderRadius:16,padding:"24px 26px",boxShadow:"0 2px 20px rgba(180,83,9,0.07)",border:"2px solid #c6f6d5"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{width:32,height:32,borderRadius:8,background:"#0f9668",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:16}}>✓</div>
              <div>
                <div style={{fontWeight:800,color:"#0a5c40",fontSize:15}}>カルテ記載文が生成されました</div>
                <div style={{fontSize:12,color:"#5a9a80"}}>内容確認後、電子カルテにコピーしてください</div>
              </div>
            </div>
            {saveError && (
              <div style={{background:"#fff5f5",border:"2px solid #feb2b2",borderRadius:10,padding:"14px 16px",marginBottom:12,textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#c53030",marginBottom:8}}>⚠️ 受付番号の登録に失敗しました。スタッフへ口頭でお知らせください。</div>
                <button onClick={handleSaveRetry} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#e53e3e",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>🔄 再試行</button>
              </div>
            )}
                        {visitCode && (
              <div style={{background:"linear-gradient(135deg,#b45309,#d97706)",borderRadius:14,padding:"20px",marginBottom:16,textAlign:"center"}}>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",marginBottom:6,fontWeight:700}}>受付番号</div>
                <div style={{fontSize:56,fontWeight:900,color:"#fff",letterSpacing:"0.2em",lineHeight:1}}>{visitCode}</div>
                
              </div>
            )}
            <div style={{background:"#fff8e1",border:"2px solid #f59e0b",borderRadius:12,padding:"14px 18px",textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:900,color:"#92400e"}}>📋 タブレットを受付にお返しください</div>
              <div style={{fontSize:12,color:"#b45309",marginTop:4}}>問診は完了しています。ありがとうございました。</div>
            </div>
                        <div style={{marginBottom:4}}>
              <button onClick={()=>setShowKarte(v=>!v)} style={{width:"100%",padding:"11px",borderRadius:8,border:"1.5px solid #c0e8d8",background:showKarte?"#e8f5f0":"#f5f9f7",color:"#276749",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                {showKarte?"▲ カルテ文を閉じる（スタッフ用）":"▼ スタッフ用カルテを確認する"}
              </button>
            </div>
            {showKarte && (
              <div style={{marginBottom:8}}>
                <textarea value={result} onChange={e=>setResult(e.target.value)} style={{width:"100%",minHeight:320,background:"#f5f9f7",border:"1px solid #c0e8d8",borderRadius:10,padding:"16px 18px",fontSize:13,lineHeight:2,color:"#1a3a2a",fontFamily:"monospace",resize:"vertical",boxSizing:"border-box"}}/>
                <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
                  <button onClick={saveEditedKarte} style={{padding:"10px 18px",borderRadius:8,border:"none",background:"#0f9668",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer"}}>💾 編集内容を保存</button>
                  {saveMsg && <span style={{fontSize:13,fontWeight:700,color:saveMsg.startsWith("✓")?"#0f9668":"#c53030"}}>{saveMsg}</span>}
                </div>
              </div>
            )}

            <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#b45309,#d97706)",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"}} onClick={()=>copyToClipboard(result)}>📋 コピー</button>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"1.5px solid #b45309",background:"#fffbf5",color:"#b45309",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>{setDone(false);setStep(0);setTimeout(scrollTop,50);}}>✏️ 修正する</button>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"1.5px solid #f0ddc0",background:"#fffbf5",color:"#92400e",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>{setDone(false);setStep(0);setData(initialData);setResult("");setVisitCode("");setRecordId("");setSaveMsg("");setShowKarte(false);setSaveError(false);setTimeout(scrollTop,50);}}>🔄 最初から</button>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"1.5px solid #9ae6b4",background:"#f0fff4",color:"#276749",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>{window.location.href="/";}}>🏠 TOPへ</button>
            </div>
          </div>
        )}
        <div style={{textAlign:"center",fontSize:11,color:"#d0a888",marginTop:14}}>入力内容は送信後に消去されます　│　個人情報は院内のみで使用されます</div>
      </div>
    </div>
  );
}

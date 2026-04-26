import { useState, useRef } from "react";
import VoiceMemoSection from "./VoiceMemoSection";
import { useRouter } from "next/router";

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "指定なし"];
const ALLERGY_QUICK = ["花粉", "ペニシリン", "造影剤", "フルーツ", "金属"];

const STEPS = [
  { id: "reason",  title: "受診理由" },
  { id: "disease", title: "妊娠・病名" },
  { id: "history", title: "既往・生活歴" },
  { id: "body",    title: "体格・要望" },
];

const LIVING_WITH_SPOUSE = ["配偶者あり", "配偶者なし（独居・死別・離別等）"];
const LIVING_OTHERS = ["子供と同居なし", "息子と同居", "娘と同居", "息子夫婦と同居", "娘夫婦と同居", "親と同居", "祖父母と同居", "兄弟姉妹と同居", "その他"];
const NEARBY_HOSPITALS = ["ナラヤマレディースクリニック", "葵ウィメンズクリニック", "自治医大さいたま医療センター", "上尾中央総合病院", "その他", "不明"];
const EYE_CLINICS = ["上尾こいけ眼科", "おが・おおぐし眼科", "上尾中央総合病院眼科", "おおたけ眼科", "こしの眼科"];

const initialData = {
  reason: { type: "", referralFrom: "", referralDept: "", referralQuickSelect: false, referralDetail: "", transferFrom: "", transferDetail: "", checkupType: "", summary: "" },
  disease: {
    dmType: "", pastGDM: "",
    pastGDMChild: [{era:'令和',year:'',had:''},{era:'令和',year:'',had:''},{era:'令和',year:'',had:''}],
    currentWeek: "", dueDateEra: "令和", dueDateYear: "", dueDateMonth: "",
    obHospital: "", obHospitalOther: "",
    ht: false, hl: false, thyroidAdded: false,
    echoNeck: "", echoAbdomen: "",
  },
  history: {
    allergy: "なし", allergyDetail: "",
    fh: { dm: false, dmWho: [], ht: false, apo: false, ihd: false },
    smoking: "なし",
    eyeVisiting: "", eyeFundusCheck: "", eyeNotebook: "", eye: "",
    livingSpouse: "", livingOther: [], livingCustom: "",
    work: "していない", job: [], jobNote: "", activity: "",
    otherDiseases: [{name:"",hospital:"",hospitalOther:""}],
  },
  body: { height: "", weightNow: "", weightPregnancy: "", weight20: "", weightMax: "", weightMaxAge: "", concern: "", preferredDays: [], doctorGender: "", patientFlag: "通常", doubleSlot: false },
  voiceMemo: { transcript: "", aiSummary: "" },
  voicePastHistory: { transcript: "", aiSummary: "" },
};

const inp = (x={}) => ({ padding:"9px 12px", border:"1.5px solid #d0dff5", borderRadius:8, fontSize:14, color:"#1a2a3a", background:"#f7faff", outline:"none", boxSizing:"border-box", fontFamily:"inherit", width:"100%", ...x });
const lbl = (x={}) => ({ display:"block", fontSize:12, fontWeight:700, color:"#c05c8a", marginBottom:5, letterSpacing:"0.03em", ...x });
const btn = (active, color="#c05c8a", x={}) => ({ padding:"8px 14px", borderRadius:8, border:active?`2px solid ${color}`:"2px solid #f0d0e0", background:active?color:"#fff7fb", color:active?"#fff":"#9a5070", fontWeight:700, fontSize:13, cursor:"pointer", margin:"3px 4px 3px 0", ...x });
const sBox = (x={}) => ({ background:"#fff7fb", border:"1.5px solid #f0d0e0", borderRadius:10, padding:"14px 16px", marginBottom:14, ...x });

export default function GDMIntakeTool() {
  const router = useRouter();
  const [step, setStep]       = useState(0);
  const [data, setData]       = useState(initialData);
  const [result, setResult]   = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [visitCode, setVisitCode] = useState("");
  const [recordId, setRecordId] = useState("");
  const [showKarte, setShowKarte] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const topRef = useRef(null);

  const scrollTop = () => { if(topRef.current) topRef.current.scrollIntoView({behavior:"smooth"}); };
  const bmi = data.body.height && data.body.weightPregnancy
    ? (parseFloat(data.body.weightPregnancy)/Math.pow(parseFloat(data.body.height)/100,2)).toFixed(1) : null;
  const goStep = (n) => { setStep(n); setTimeout(scrollTop, 50); };
  const up  = (sec,f,v) => setData(p=>({...p,[sec]:{...p[sec],[f]:v}}));
  const upN = (sec,par,f,v) => setData(p=>({...p,[sec]:{...p[sec],[par]:{...p[sec][par],[f]:v}}}));
  const toggleArr = (sec,f,v) => setData(p=>{const a=p[sec][f]||[];return{...p,[sec]:{...p[sec],[f]:a.includes(v)?a.filter(x=>x!==v):[...a,v]}};});
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

  const copyToClipboard = (text) => {
    const copy = () => { const el=document.createElement('textarea');el.value=text;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);alert('コピーしました'); };
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>alert('コピーしました')).catch(copy);}else{copy();}
  };

  const handleSaveRetry = async () => {
    setSaveError(false);
    try {
      const saveRes = await fetch("/api/questionnaire",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({form_type:"妊娠糖尿病",form_data:data,age:null,generated_karte:result})});
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
    const bmiNow = data.body.height && data.body.weightNow
      ? (parseFloat(data.body.weightNow)/Math.pow(parseFloat(data.body.height)/100,2)).toFixed(1) : null;
    const prompt = `あなたは糖尿病専門クリニックの電子カルテ記載AIです。以下の患者情報をもとに、妊娠糖尿病のカルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- ＃病名・＃HT・＃HLの間は空行なし。他院管理の疾患のみ1行空けてから記載する
- 妊娠糖尿病の場合は眼科通院歴・健診・ワクチン歴は記載不要
- 糖尿病合併妊娠の場合はGAD追加を記載し、眼科通院歴も記載する
- HLで甲状腺追加済の場合は「◎甲状腺3項目追加済」を記載
- 受診理由の直後、空行なしで＃妊娠糖尿病または＃糖尿病合併妊娠を続ける
- 各項目間に空行を入れない

【整形済みデータ】
生活情報：${buildLiving()}
職業：${buildJob()}
希望曜日：${buildWeekday()}
医師希望：${data.body.doctorGender || "指定なし"}
患者フラグ：${data.body.patientFlag || "通常"}
新患2枠取得：${data.body.doubleSlot ? "取得済" : "なし"}

【患者情報JSON】
${JSON.stringify({disease:data.disease,history:data.history,body:data.body,reason:data.reason},null,2)}
${data.voiceMemo?.aiSummary ? `\n【音声入力からのAI整形済み現病歴(必ず受診理由サマリーに統合)】\n${data.voiceMemo.aiSummary}\n` : ''}${data.voicePastHistory?.aiSummary ? `\n【音声入力からのAI整形済み既往歴(♯既往疾患セクションに統合)】\n${data.voicePastHistory.aiSummary}\n` : ''}${data.voicePastHistory?.needsDoctorReview ? `\n【既往歴：要ドクター確認フラグあり(申し送り事項に「□ 既往歴：要ドクター確認」を必ず追加)】\nスタッフが既往歴の確認で医師の判断が必要と判定。\n` : ''}
【出力フォーマット】
${getCurrentMonth()}：（受診理由1〜2行${data.voiceMemo?.aiSummary ? '。音声入力AI整形済みテキストを優先・統合して使用' : ''}）
＃妊娠糖尿病（または＃糖尿病合併妊娠）
　現在${data.disease.currentWeek}週、${data.disease.dueDateEra}${data.disease.dueDateYear}年${data.disease.dueDateMonth}月
　産科通院先：${data.disease.obHospital==="その他"?data.disease.obHospitalOther:data.disease.obHospital}
　過去の妊娠糖尿病歴：（あれば記載）
＃HT（該当時のみ）
＃HL（該当時のみ）
◎甲状腺3項目追加済（該当時のみ）

【アレルギー歴】
【FH】DM(-/+) HT(-/+) APO(-/+) IHD(-/+)
【飲酒歴】なし（妊娠中）
【喫煙歴】（記載）
（糖尿病合併妊娠の場合のみ）【眼科通院歴】（眼底検査を受けている場合：眼科名・網膜症の状況・緑内障の有無を記載。受けていない場合は「未受診」と記載）
【生活情報】（整形済みテキスト）
【仕事】職業・活動量
---------------------------------------------
頚部エコー：${data.disease.echoNeck==="行っていない"?"当院で施行予定":data.disease.echoNeck||"当院で施行予定"}　腹部エコー：${data.disease.echoAbdomen==="行っていない"?"当院で施行予定":data.disease.echoAbdomen||"当院で施行予定"}（必ず1行に横配置）
---------------------------------------------
身長:○cm　初診時:○kg${bmiNow ? `（BMI ${bmiNow}）` : ""}　20歳時:○kg　max体重○kg(○歳)
---------------------------------------------
【事前聴取時　申し送り事項】
□通院のご案内をお渡し済
（既往歴：要ドクター確認フラグありの場合のみ）□既往歴：要ドクター確認
（糖尿病合併妊娠の場合のみ：眼底検査=受けていない or 連携手帳=持っていない の場合）□糖尿病-眼科連携手帳をお渡し
□リブレ（自費CGM）取り付けに同意済
（喫煙「あり」の場合）□喫煙確認あり・指導必要
（新患2枠取得済の場合）□新患2枠取得済み
${(() => { const g = data.body.doctorGender; if (!g || g === "指定なし") return ""; const label = g === "女性医師希望" ? "女性医師" : g === "男性医師希望" ? "男性医師" : g; return `□医師希望：${label}`; })()}
（患者フラグが「○患者疑い（話が長い方）」の場合）□○患者疑い（対応注意）
（患者フラグが「●患者疑い（出禁対象）」の場合）□●患者疑い（出禁対象・要確認）
（その他申し送りがあれば記載）
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
      const res = await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:2000,messages:[{role:"user",content:prompt}]})});
      const json = await res.json();
      const generated = json.content?.[0]?.text||"生成に失敗しました";
      setResult(generated);

      try {
        const saveRes = await fetch("/api/questionnaire",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({form_type:"妊娠糖尿病",form_data:data,age:null,generated_karte:generated})});
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

      case 0: return (
        <div>
          <label style={lbl()}>受診理由</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:14}}>
            {["紹介","検診異常","自主転院"].map(r=><button key={r} style={btn(d.reason.type===r)} onClick={()=>up("reason","type",r)}>{r}</button>)}
          </div>
          {d.reason.type==="紹介"&&(<div style={sBox()}>
            <label style={lbl()}>よく使う紹介元</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>
              {[["ナラヤマレディースクリニック","産婦人科"],["葵ウィメンズクリニック","産婦人科"]].map(([hosp,dept])=>{
                const selected = d.reason.referralFrom===hosp;
                return (
                <button key={hosp} style={{...btn(selected,"#0f9668"),fontSize:13,padding:"9px 16px",border:selected?"2px solid #0f9668":"2px dashed #0f9668",background:selected?"#0f9668":"#f0fff8",color:selected?"#fff":"#0f9668"}}
                  onClick={()=>setData(p=>selected
                    ? ({...p,reason:{...p.reason,referralFrom:"",referralDept:"",referralQuickSelect:false}})
                    : ({...p,reason:{...p.reason,referralFrom:hosp,referralDept:dept,referralQuickSelect:true}})
                  )}>
                  {selected?"✓ ":""}{hosp}
                </button>
                );
              })}
            </div>
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <div style={{flex:2}}><label style={lbl()}>その他の病院名</label><input style={inp()} placeholder="上記以外の場合は入力" value={d.reason.referralQuickSelect?"":d.reason.referralFrom} onChange={e=>setData(p=>({...p,reason:{...p.reason,referralFrom:e.target.value,referralDept:"",referralQuickSelect:false}}))} /></div>
              <div style={{flex:1}}><label style={lbl()}>科名</label><input style={inp()} placeholder="例：産婦人科" value={d.reason.referralDept} onChange={e=>up("reason","referralDept",e.target.value)}/></div>
            </div>
            <label style={lbl()}>紹介の理由</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
              {["妊娠糖尿病のため","血糖コントロール管理のため","専門的管理のため","転居のため","内容不明"].map(v=><button key={v} style={btn(d.reason.referralDetail===v)} onClick={()=>up("reason","referralDetail",v)}>{v}</button>)}
            </div>
          </div>)}
          {d.reason.type==="自主転院"&&(<div style={sBox()}>
            <label style={lbl()}>転院元 医療機関名</label>
            <input style={{...inp(),marginBottom:12}} placeholder="例：○○クリニック（言いたくない場合は空欄でOK）" value={d.reason.transferFrom} onChange={e=>up("reason","transferFrom",e.target.value)}/>
            <label style={lbl()}>転院の理由</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
              {["コントロール改善しないため","転居のため","より専門的な治療を希望","その他"].map(v=><button key={v} style={btn(d.reason.transferDetail===v)} onClick={()=>up("reason","transferDetail",v)}>{v}</button>)}
            </div>
          </div>)}
          {d.reason.type==="検診異常"&&(<div style={sBox()}>
            <label style={lbl()}>検診の種類</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
              {["妊婦健診","会社健診","市健診","人間ドック"].map(v=><button key={v} style={btn(d.reason.checkupType===v)} onClick={()=>up("reason","checkupType",v)}>{v}</button>)}
            </div>
          </div>)}
          <div style={{marginTop:8}}>
            <label style={lbl()}>自由記入欄（任意）</label>
            <textarea style={{...inp(),minHeight:60,resize:"vertical"}} placeholder="補足があれば記載（書かなくてもOK）" value={d.reason.summary} onChange={e=>up("reason","summary",e.target.value)}/>
          </div>
        </div>
      );

      case 1: return (
        <div>
          <div style={{...sBox({background:"#fff0f7",border:"2px solid #f0b8d4"}),marginBottom:16}}>
            <label style={lbl({ fontSize:14, fontWeight:900 })}>病名の確認</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6}}>
              {["妊娠糖尿病（GDM）","糖尿病合併妊娠"].map(v=>(
                <button key={v} style={btn(d.disease.dmType===v)} onClick={()=>up("disease","dmType",v)}>{v}</button>
              ))}
            </div>
            {d.disease.dmType==="糖尿病合併妊娠"&&(
              <div style={{fontSize:12,color:"#c05c8a",background:"#fff0f7",borderRadius:8,padding:"8px 12px",marginTop:6}}>
                ⚠️ 糖尿病合併妊娠の場合はGAD抗体を追加採血します
              </div>
            )}
          </div>
          <label style={lbl()}>現在の妊娠週数</label>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <input style={{...inp(),width:80}} type="number" placeholder="週" value={d.disease.currentWeek} onChange={e=>up("disease","currentWeek",e.target.value)}/>
            <span style={{fontSize:13,color:"#666"}}>週</span>
          </div>
          <label style={lbl()}>出産予定日</label>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
            <select style={{...inp(),width:100}} value={d.disease.dueDateEra||"令和"} onChange={e=>up("disease","dueDateEra",e.target.value)}>
              <option>令和</option><option>平成</option>
            </select>
            <input style={{...inp(),width:68}} type="number" placeholder="年" value={d.disease.dueDateYear||""} onChange={e=>up("disease","dueDateYear",e.target.value)}/>
            <span style={{fontSize:13,color:"#666"}}>年</span>
            <select style={{...inp(),width:80}} value={d.disease.dueDateMonth||""} onChange={e=>up("disease","dueDateMonth",e.target.value)}>
              <option value="">月</option>
              {["1","2","3","4","5","6","7","8","9","10","11","12"].map(m=><option key={m} value={m}>{m}月</option>)}
            </select>
          </div>
          <label style={lbl()}>産科の通院先</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6}}>
            {NEARBY_HOSPITALS.map(v=>(
              <button key={v} style={btn(d.disease.obHospital===v)} onClick={()=>up("disease","obHospital",v)}>{v}</button>
            ))}
          </div>
          {d.disease.obHospital==="その他"&&(
            <input style={{...inp(),marginBottom:14}} placeholder="病院名を入力" value={d.disease.obHospitalOther} onChange={e=>up("disease","obHospitalOther",e.target.value)}/>
          )}
          <label style={lbl({marginTop:8})}>過去の妊娠糖尿病歴</label>
          <div style={{display:"flex",gap:3,marginBottom:10}}>
            {["あり","なし","初めての妊娠"].map(v=>(
              <button key={v} style={btn(d.disease.pastGDM===v)} onClick={()=>up("disease","pastGDM",v)}>{v}</button>
            ))}
          </div>
          {d.disease.pastGDM==="あり"&&(
            <div style={sBox({background:"#fff0f7",border:"1.5px solid #f0b8d4",marginBottom:14})}>
              {d.disease.pastGDMChild.map((row,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:i<d.disease.pastGDMChild.length-1?10:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:13,fontWeight:700,color:"#c05c8a",minWidth:40}}>第{i+1}子</span>
                  <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                    {["あり","なし"].map(v=>(
                      <button key={v} style={{...btn(row.had===v),padding:"6px 12px",fontSize:12}}
                        onClick={()=>setData(p=>{const arr=[...p.disease.pastGDMChild];arr[i]={...arr[i],had:v};return{...p,disease:{...p.disease,pastGDMChild:arr}};})}>
                        {v}
                      </button>
                    ))}
                    {row.had==="あり"&&(<>
                      <select style={{...inp(),width:90,fontSize:12}} value={row.era}
                        onChange={e=>setData(p=>{const arr=[...p.disease.pastGDMChild];arr[i]={...arr[i],era:e.target.value};return{...p,disease:{...p.disease,pastGDMChild:arr}};})}>
                        <option>昭和</option><option>平成</option><option>令和</option>
                      </select>
                      <input style={{...inp(),width:60,fontSize:12}} type="number" placeholder="年"
                        value={row.year}
                        onChange={e=>setData(p=>{const arr=[...p.disease.pastGDMChild];arr[i]={...arr[i],year:e.target.value};return{...p,disease:{...p.disease,pastGDMChild:arr}};})}/>
                      <span style={{fontSize:12,color:"#666"}}>年</span>
                    </>)}
                    {i>=3&&(
                      <button onClick={()=>setData(p=>{const arr=p.disease.pastGDMChild.filter((_,j)=>j!==i);return{...p,disease:{...p.disease,pastGDMChild:arr}};})} style={{fontSize:12,color:"#e53e3e",background:"none",border:"none",cursor:"pointer",fontWeight:700}}>✕ 削除</button>
                    )}
                  </div>
                </div>
              ))}
              <button style={{...btn(false,"#c05c8a"),fontSize:13,marginTop:4}} onClick={()=>setData(p=>({...p,disease:{...p.disease,pastGDMChild:[...p.disease.pastGDMChild,{era:'令和',year:'',had:''}]}}))}>＋ 追加</button>
            </div>
          )}
          <label style={lbl({marginTop:8})}>合併する疾患</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:14}}>
            {[["ht","高血圧（HT）"],["hl","脂質異常症（HL）"]].map(([k,l])=>(
              <button key={k} style={btn(d.disease[k])} onClick={()=>up("disease",k,!d.disease[k])}>{l}</button>
            ))}
          </div>

          <div style={{...sBox({background:"#f0f8ff",border:"1.5px solid #bee3f8"}),marginTop:8}}>
            <div style={{fontSize:13,fontWeight:800,color:"#2b6cb0",marginBottom:4}}>🔍 エコー検査について</div>
            <div style={{fontSize:12,color:"#4a7fa8",marginBottom:12,lineHeight:1.7}}>当院では合併症検査として、頸動脈エコー・腹部エコーを年に1回行っています。</div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:200}}>
                <label style={lbl({color:"#2b6cb0"})}>頚部エコー</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  {["他院で施行済","健診で施行済","行っていない"].map(v=>(
                    <button key={v} style={{...btn(d.disease.echoNeck===v,"#2b6cb0"),padding:"6px 10px",fontSize:12}} onClick={()=>up("disease","echoNeck",v)}>{v}</button>
                  ))}
                </div>
              </div>
              <div style={{flex:1,minWidth:200}}>
                <label style={lbl({color:"#2b6cb0"})}>腹部エコー</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  {["他院で施行済","健診で施行済","行っていない"].map(v=>(
                    <button key={v} style={{...btn(d.disease.echoAbdomen===v,"#2b6cb0"),padding:"6px 10px",fontSize:12}} onClick={()=>up("disease","echoAbdomen",v)}>{v}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      );

      case 2: return (
        <div>

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

          <label style={lbl({marginTop:10})}>家族歴（FH）</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:16}}>
            {[["dm","糖尿病(DM)"],["ht","高血圧(HT)"],["apo","脳卒中(APO)"],["ihd","虚血性心疾患(IHD)"]].map(([k,l])=>(
              <button key={k} style={btn(d.history.fh[k],"#6b3fa8")} onClick={()=>upN("history","fh",k,!d.history.fh[k])}>{l}</button>
            ))}
          </div>
          {d.history.fh.dm && (
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

          {/* 糖尿病合併妊娠の場合のみ眼科欄を表示 */}
          {d.disease.dmType==="糖尿病合併妊娠"&&(
            <div style={sBox({background:"#f0f7ff",border:"1.5px solid #bcd4f8",marginBottom:14})}>
              <div style={{fontSize:13,fontWeight:800,color:"#1a5fa8",marginBottom:10}}>👁 糖尿病の眼底検査（糖尿病合併妊娠のため確認）</div>
              <div style={{fontSize:12,color:"#7a9abf",marginBottom:6}}>糖尿病による網膜症のフォローのため、眼底検査を受けているか確認します</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                {["受けている","受けていない","今後受ける予定"].map(v=>(
                  <button key={v} style={{...btn(d.history.eyeFundusCheck===v,v==="受けていない"?"#c53030":"#1a5fa8"),fontSize:12}} onClick={()=>up("history","eyeFundusCheck",v)}>{v}</button>
                ))}
              </div>
              {d.history.eyeFundusCheck==="受けている"&&(
                <div style={{marginBottom:10}}>
                  <label style={lbl({fontSize:11})}>受診中の眼科</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6}}>
                    {EYE_CLINICS.map(v=>(
                      <button key={v} style={{...btn(d.history.eye===v,"#1a5fa8"),padding:"6px 10px",fontSize:12}} onClick={()=>up("history","eye",v)}>{v}</button>
                    ))}
                  </div>
                  <input style={{...inp(),marginBottom:8}} placeholder="その他の眼科名を入力"
                    value={EYE_CLINICS.includes(d.history.eye)?"":d.history.eye}
                    onChange={e=>up("history","eye",e.target.value)}/>
                  <label style={lbl({fontSize:11})}>糖尿病網膜症の状況（分かる範囲で）</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
                    {["網膜症なし","単純性網膜症","前増殖性網膜症","増殖性網膜症","不明"].map(v=>(
                      <button key={v} style={{...btn(d.history.retinopathy===v),padding:"6px 10px",fontSize:12}} onClick={()=>up("history","retinopathy",v)}>{v}</button>
                    ))}
                  </div>
                  <label style={lbl({fontSize:11})}>緑内障の有無</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                    {["緑内障なし","緑内障あり","不明"].map(v=>(
                      <button key={v} style={{...btn(d.history.glaucoma===v),padding:"6px 10px",fontSize:12}} onClick={()=>up("history","glaucoma",v)}>{v}</button>
                    ))}
                  </div>
                </div>
              )}
              <label style={lbl({fontSize:12,marginTop:8})}>糖尿病-眼科連携手帳</label>
              <div style={{fontSize:12,color:"#7a9abf",marginBottom:6}}>糖尿病-眼科連携手帳をお持ちですか？</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {["持っている","持っていない"].map(v=>(
                  <button key={v} style={{...btn(d.history.eyeNotebook===v,v==="持っていない"?"#c53030":"#1a5fa8"),fontSize:12}} onClick={()=>up("history","eyeNotebook",v)}>{v}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{...sBox({background:"#f0fff4",border:"1.5px solid #9ae6b4"}),marginBottom:14}}>
            <div style={{fontSize:13,color:"#276749",fontWeight:700}}>🍵 飲酒歴：妊娠中のためなし（カルテに自動記載）</div>
          </div>

          <label style={lbl()}>喫煙歴</label>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            {["なし","あり","禁煙済"].map(v=><button key={v} style={btn(d.history.smoking===v)} onClick={()=>up("history","smoking",v)}>{v}</button>)}
          </div>


          <label style={lbl()}>生活情報（同居・家族構成）</label>
          <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>配偶者の有無</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:12}}>
            {LIVING_WITH_SPOUSE.map(v=><button key={v} style={btn(d.history.livingSpouse===v)} onClick={()=>up("history","livingSpouse",v)}>{v}</button>)}
          </div>
          <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>子供・その他との同居（複数選択可）</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:8}}>
            {LIVING_OTHERS.map(v=><button key={v} style={btn((d.history.livingOther||[]).includes(v))} onClick={()=>toggleArr("history","livingOther",v)}>{v}</button>)}
          </div>
          <input style={{...inp(),marginBottom:14}} placeholder="補足があれば（例：夫は単身赴任中・兄弟と同居）" value={d.history.livingCustom} onChange={e=>up("history","livingCustom",e.target.value)}/>

          <label style={lbl()}>仕事</label>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            {["している","していない","産休中"].map(v=><button key={v} style={btn(d.history.work===v)} onClick={()=>up("history","work",v)}>{v}</button>)}
          </div>
          {d.history.work==="している"&&(
            <div>
              <div style={{fontSize:11,color:"#888",marginBottom:4}}>複数選択可</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
                {["会社員（デスクワーク）","会社員（現場・営業）","自営業","パート・アルバイト","医療・福祉職","教育職（教師・保育士）","飲食・サービス業","農業・林業・漁業","専業主婦・主夫","学生"].map(v=>(
                  <button key={v} style={{...btn((d.history.job||[]).includes(v),"#c05c8a"),padding:"6px 10px",fontSize:12}} onClick={()=>toggleArr("history","job",v)}>{v}</button>
                ))}
              </div>
              <input style={{...inp(),marginBottom:14}} placeholder="補足・その他（例：週3日リモート）" value={d.history.jobNote} onChange={e=>up("history","jobNote",e.target.value)}/>
            </div>
          )}

          <label style={lbl()}>活動量</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {["体を動かしていることが多い","立っていることが多い","座っていることが多い"].map(v=><button key={v} style={btn(d.history.activity===v)} onClick={()=>up("history","activity",v)}>{v}</button>)}
          </div>
          <VoiceMemoSection
            mode="pastHistory"
            formData={data}
            formType="gdm"
            initialValue={data.voicePastHistory}
            onUpdate={(memo) => setData(p => ({ ...p, voicePastHistory: memo }))}
          />
        </div>
      );

      case 3: return (
        <div>
          <label style={lbl()}>身長・体重</label>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
            {[["height","身長","cm"],["weightNow","現在の体重","kg"],["weightPregnancy","妊娠前の体重","kg"],["weight20","20歳時の体重","kg"],["weightMax","最大体重（妊娠前）","kg"],["weightMaxAge","最大体重の年齢","歳"]].map(([k,l,u])=>(
              <div key={k} style={{flex:"1 1 90px"}}>
                <label style={lbl()}>{l}（{u}）</label>
                <input style={inp()} type="number" placeholder={u} value={d.body[k]} onChange={e=>up("body",k,e.target.value)}/>
              </div>
            ))}
          </div>
          {bmi&&(<div style={{marginBottom:16,padding:"10px 16px",background:"#fff0f7",borderRadius:8,fontSize:14,fontWeight:700,color:"#c05c8a"}}>妊娠前BMI：{bmi}　{parseFloat(bmi)<18.5?"（低体重）":parseFloat(bmi)<25?"（普通体重）":parseFloat(bmi)<30?"（肥満1度）":"（肥満2度以上）"}</div>)}
          <label style={lbl()}>希望曜日（複数選択可）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:14}}>
            {WEEKDAYS.map(v=>(
              <button key={v} style={btn((d.body.preferredDays||[]).includes(v),"#c05c8a")} onClick={()=>toggleArr("body","preferredDays",v)}>{v}</button>
            ))}
          </div>
          <label style={lbl()}>医師の希望</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:14}}>
            {["指定なし","女性医師希望","男性医師希望","院長（初回のみ）"].map(v=>(
              <button key={v} style={btn(d.body.doctorGender===v,"#c05c8a")} onClick={()=>up("body","doctorGender",v)}>{v}</button>
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
    <div ref={topRef} style={{minHeight:"100vh",background:"linear-gradient(135deg,#fff0f7 0%,#fff5fb 50%,#f5f0ff 100%)",fontFamily:"'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif",padding:"20px 16px"}}>

      <style>{`@keyframes kinkSpin{to{transform:rotate(360deg)}}`}</style>
      {loading && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.52)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{width:54,height:54,border:'5px solid rgba(255,255,255,0.25)',borderTopColor:'#fff',borderRadius:'50%',animation:'kinkSpin 0.8s linear infinite'}}/>
          <div style={{color:'#fff',fontWeight:800,fontSize:17,marginTop:22,textAlign:'center',lineHeight:1.8}}>カルテを作成しています...<br/>少々お待ちください</div>
        </div>
      )}
      <div style={{maxWidth:680,margin:"0 auto 18px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>router.push("/")} style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid #f0d0e0",background:"#fff",color:"#c05c8a",fontWeight:700,fontSize:12,cursor:"pointer"}}>← トップ</button>
          <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#c05c8a,#e89abf)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏥</div>
          <div>
            <div style={{fontSize:11,color:"#c05c8a",fontWeight:700,letterSpacing:"0.08em"}}>まつもと糖尿病クリニック</div>
            <div style={{fontSize:20,fontWeight:900,color:"#1a2a4a"}}>初診事前問診</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
<span style={{fontSize:12,background:"#fff0f7",color:"#c05c8a",padding:"4px 14px",borderRadius:20,fontWeight:700}}>妊娠糖尿病</span>
          </div>
        </div>

      </div>

      <div style={{maxWidth:680,margin:"0 auto"}}>
        {!done&&(<div style={{display:"flex",gap:4,marginBottom:18}}>
          {STEPS.map((s,i)=>(<div key={s.id} onClick={()=>goStep(i)} style={{flex:1,textAlign:"center",cursor:"pointer",userSelect:"none"}}>
            <div style={{height:4,borderRadius:2,background:i===step?"#c05c8a":i<step?"#e89abf":"#f0d0e0",marginBottom:4,transition:"background 0.3s"}}/>
            <div style={{fontSize:10,color:i===step?"#c05c8a":i<step?"#e89abf":"#d0a0b8",fontWeight:i===step?800:i<step?600:400}}>{i<step?"✓ ":""}{s.title}</div>
          </div>))}
        </div>)}

        {!done?(
          <div style={{background:"#fff",borderRadius:16,padding:"24px 26px",boxShadow:"0 2px 20px rgba(192,92,138,0.08)"}}>
            <h2 style={{fontSize:16,fontWeight:800,color:"#1a2a4a",marginBottom:18,borderBottom:"2px solid #fff0f7",paddingBottom:10}}>{STEPS[step].title}</h2>
            {renderStep()}
            {step === STEPS.length - 1 && (
              <VoiceMemoSection
                formData={data}
                formType="gdm"
                onUpdate={(voiceMemo) => setData(p => ({ ...p, voiceMemo }))}
              />
            )}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:26}}>
              <button style={{padding:"11px 22px",borderRadius:8,border:"1.5px solid #f0d0e0",background:"#fff7fb",color:step===0?"#d0a0b8":"#9a5070",fontWeight:700,fontSize:14,cursor:step===0?"not-allowed":"pointer"}} onClick={()=>goStep(step-1)} disabled={step===0}>← 前へ</button>
              {step<STEPS.length-1?(
                <button style={{padding:"11px 26px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#c05c8a,#e89abf)",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:"0 4px 12px rgba(192,92,138,0.3)"}} onClick={()=>goStep(step+1)}>次へ →</button>
              ):(
                <button style={{padding:"11px 26px",borderRadius:8,border:"none",background:loading?"#8ab0d4":"linear-gradient(135deg,#0f9668,#34d399)",color:"#fff",fontWeight:800,fontSize:14,cursor:loading?"not-allowed":"pointer",boxShadow:"0 4px 12px rgba(15,150,104,0.25)"}} onClick={generateKarte} disabled={loading}>{loading?"生成中...":"✨ カルテ文を生成"}</button>
              )}
            </div>
          </div>
        ):(
          <div style={{background:"#fff",borderRadius:16,padding:"24px 26px",boxShadow:"0 2px 20px rgba(192,92,138,0.08)",border:"2px solid #c6f6d5"}}>
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
                        {visitCode&&(
              <div style={{background:"linear-gradient(135deg,#c05c8a,#e89abf)",borderRadius:14,padding:"20px",marginBottom:0,textAlign:"center"}}>
                <div style={{fontSize:13,color:"#ffe0f0",marginBottom:6,fontWeight:700}}>受付番号</div>
                <div style={{fontSize:56,fontWeight:900,color:"#fff",letterSpacing:"0.2em",lineHeight:1}}>{visitCode}</div>
              </div>
            )}
            <div style={{background:"#fff8e1",border:"2px solid #f59e0b",borderRadius:12,padding:"14px 18px",marginBottom:12,textAlign:"center"}}>
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
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#c05c8a,#e89abf)",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"}} onClick={()=>copyToClipboard(result)}>📋 コピー</button>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"1.5px solid #c05c8a",background:"#f0f7ff",color:"#c05c8a",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>{setDone(false);setStep(0);setTimeout(scrollTop,50);}}>✏️ 修正する</button>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"1.5px solid #f0d0e0",background:"#fff7fb",color:"#9a5070",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>{setDone(false);setStep(0);setData(initialData);setResult("");setVisitCode("");setRecordId("");setSaveMsg("");setShowKarte(false);setSaveError(false);setTimeout(scrollTop,50);}}>🔄 最初から</button>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"1.5px solid #9ae6b4",background:"#f0fff4",color:"#276749",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>{window.location.href="/";}}>🏠 TOPへ</button>
            </div>
          </div>
        )}
        <div style={{textAlign:"center",fontSize:11,color:"#d0a0b8",marginTop:14}}>入力内容は送信後に消去されます　│　個人情報は院内のみで使用されます</div>
      </div>
    </div>
  );
}

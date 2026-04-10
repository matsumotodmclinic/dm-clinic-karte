import { useState, useRef } from "react";

const STEPS = [
  { id: "reason", title: "受診理由" },
  { id: "disease", title: "病名・検査" },
  { id: "history", title: "既往・生活歴" },
  { id: "body",    title: "体格・要望" },
];

const NEARBY_HOSPITALS = ["自治医大さいたま医療センター", "上尾中央総合病院", "埼玉県立がんセンター", "その他", "不明"];
const LIVING_WITH_SPOUSE = ["配偶者あり", "配偶者なし（独居・死別・離別等）"];
const LIVING_OTHERS = ["子供と同居なし", "息子と同居", "娘と同居", "息子夫婦と同居", "娘夫婦と同居", "親と同居", "その他"];
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
  reason: { type: "", referralFrom: "", referralDept: "", referralQuickSelect: false, referralDetail: "", transferFrom: "", transferDetail: "", checkupType: "", concern: false, concernType: "", summary: "" },
  disease: { igt: false, ht: false, hl: false, thyroidAdded: false, echoNeck: "", echoAbdomen: "", otherDisease: "", otherDiseases: [{name:"",hospital:"",hospitalOther:""}] },
  history: {
    age: "", allergy: "なし", allergyDetail: "",
    fh: { dm: false, dmWho: [], ht: false, hl: false, apo: false, ihd: false },
    alcoholNone: false, alcoholItems: [emptyAlcohol()],
    smoking: "なし", smokingAmount: "", smokingYears: "", smokingStartAge: "",
    smokingQuitEra: "令和", smokingQuitYear: "",
    checkup: [], vaccine65Prevena: "", vaccine65Herpes: "",
    livingSpouse: "", livingOther: "", livingCustom: "", childInfo: "",
    work: "していない", job: "", activity: "",
  },
  body: { height: "", weightNow: "", weight20: "", weightMax: "", weightMaxAge: "", concern: "" },
};

const inp = (x={}) => ({ padding:"9px 12px", border:"1.5px solid #d0dff5", borderRadius:8, fontSize:14, color:"#1a2a3a", background:"#f7faff", outline:"none", boxSizing:"border-box", fontFamily:"inherit", width:"100%", ...x });
const lbl = (x={}) => ({ display:"block", fontSize:12, fontWeight:700, color:"#1a5fa8", marginBottom:5, letterSpacing:"0.03em", ...x });
const btn = (active, color="#1a5fa8", x={}) => ({ padding:"8px 14px", borderRadius:8, border:active?`2px solid ${color}`:"2px solid #d0dff5", background:active?color:"#f7faff", color:active?"#fff":"#5580a8", fontWeight:700, fontSize:13, cursor:"pointer", margin:"3px 4px 3px 0", ...x });
const sBox = (x={}) => ({ background:"#f7faff", border:"1.5px solid #e0ecff", borderRadius:10, padding:"14px 16px", marginBottom:14, ...x });

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

export default function HTHLIntakeTool() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(initialData);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [visitCode, setVisitCode] = useState("");
  const topRef = useRef(null);

  const scrollTop = () => { if(topRef.current) topRef.current.scrollIntoView({behavior:"smooth"}); };
  const goStep = (n) => { setStep(n); setTimeout(scrollTop, 50); };
  const up = (sec,f,v) => setData(p=>({...p,[sec]:{...p[sec],[f]:v}}));
  const upN = (sec,par,f,v) => setData(p=>({...p,[sec]:{...p[sec],[par]:{...p[sec][par],[f]:v}}}));
  const toggleArr = (sec,f,v) => setData(p=>{const a=p[sec][f];return{...p,[sec]:{...p[sec],[f]:a.includes(v)?a.filter(x=>x!==v):[...a,v]}};});
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

  const copyToClipboard = (text) => {
    const copy = () => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      alert('コピーしました');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => alert('コピーしました')).catch(copy);
    } else { copy(); }
  };

  const generateKarte = async () => {
    setLoading(true);
    const prompt = `あなたはまつもと糖尿病クリニックの電子カルテ記載AIです。以下の患者情報をもとに、高血圧・脂質異常症のカルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- ＃病名・＃HT・＃HLの間は空行なし。他院管理の疾患のみ1行空けてから記載する
- 60歳未満はワクチン歴を省略、70歳未満は子供の状況を省略
- 喫煙歴は「○本×○年（○歳〜）」の形式
- HLで甲状腺追加済の場合は「◎甲状腺3項目追加済」を記載

【整形済みデータ】
飲酒歴：${buildAlcohol()}
喫煙歴：${buildSmoking()}
生活情報：${buildLiving()}
頚部エコー：${data.disease.echoNeck||"未選択"}
腹部エコー：${data.disease.echoAbdomen||"未選択"}
その他の病名・既往歴：${(data.disease.otherDiseases||[]).filter(d=>d.name).map(d=>d.name+(d.hospital?"（"+d.hospital+"）":"")).join("、")||"なし"}

【患者情報JSON】
${JSON.stringify(data,null,2)}

【ルール追加】
- 「診察にあたっての要望」は必ず【】付きで記載。記載なければ「なし」と記載
- その他の病名がある場合は既往歴として記載
- 頚部エコー・腹部エコーの情報を記載

【出力フォーマット】
${getCurrentMonth()}：（受診理由1〜2行。「気になって受診」の場合は気になる理由も含めて記載。自由記入欄の内容も含める）
＃IGT（該当時のみ、受診理由の直後、空行なし）
＃HT（該当時のみ、空行なし）
＃HL（該当時のみ、空行なし）
（その他病名があれば「♯病名（通院先）」の形式で記載、空行なし）
＃HT（該当時のみ）
＃HL（該当時のみ）
（その他病名があれば「♯病名（通院先）」の形式で記載）

【アレルギー歴】
【FH】DM(-/+) HT(-/+) HL(-/+) APO(-/+) IHD(-/+)
【飲酒歴】
【喫煙歴】
【健診】
【ワクチン歴】（60歳以上のみ）
【生活情報】（70歳以上は子供の状況も含む）
【仕事】職業・活動量
---------------------------------------------
頚部エコー：${data.disease.echoNeck==="他院で施行済"?"他院施行済":data.disease.echoNeck==="健診で施行済"?"健診施行済":"当院で施行予定"}　腹部エコー：${data.disease.echoAbdomen==="他院で施行済"?"他院施行済":data.disease.echoAbdomen==="健診で施行済"?"健診施行済":data.disease.echoAbdomen||"未選択"}
---------------------------------------------
身長:○cm　初診時:○kg　20歳時:○kg　max体重○kg(○歳)
---------------------------------------------
【事前聴取時　申し送り事項】
（HLありの場合）□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。
□初回療養計画書を作成済
（その他該当する申し送り事項があれば記載）
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${getCurrentMonth()}：




アレルギー薬あれば赤字14フォント太字
目標HbA1c　　　　%　目標体重　　　次回検討薬：
基本採血なし
1月follow
曜希望
LINE登録ご案内→済　登録確認未・登録できない
`;
    try {
      const res = await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
      const json = await res.json();
      const generated = json.content?.[0]?.text||"生成に失敗しました";
      setResult(generated);

      const saveRes = await fetch("/api/questionnaire", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ form_type:"高血圧・脂質異常症", form_data:data, age:data.history.age||null, generated_karte:generated }),
      });
      const saveJson = await saveRes.json();
      if(saveJson.visit_code) setVisitCode(saveJson.visit_code);

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
            <button style={btn(d.reason.concern,"#8e44ad")} onClick={()=>{up("reason","concern",!d.reason.concern);if(d.reason.type)up("reason","type","");}}>
              {d.reason.concern?"✓ 気になって受診":"気になって受診"}
            </button>
          </div>
          {d.reason.concern&&(
            <div style={{paddingLeft:12,borderLeft:"3px solid #8e44ad",marginBottom:14}}>
              <label style={lbl({color:"#8e44ad"})}>気になる理由</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                {["家族に高血圧・脂質異常症の方がいる","健診で異常を指摘された","頭痛・めまいがある","その他"].map(v=>(
                  <button key={v} style={btn(d.reason.concernType===v,"#8e44ad")} onClick={()=>up("reason","concernType",v)}>{v}</button>
                ))}
              </div>
            </div>
          )}
          {d.reason.type==="紹介"&&(<div style={sBox()}>
            <label style={lbl()}>よく使う紹介元</label>
            <button style={{...btn(d.reason.referralQuickSelect,"#0f9668"),marginBottom:12,fontSize:14,padding:"10px 18px",border:d.reason.referralQuickSelect?"2px solid #0f9668":"2px dashed #0f9668",background:d.reason.referralQuickSelect?"#0f9668":"#f0fff8",color:d.reason.referralQuickSelect?"#fff":"#0f9668"}}
              onClick={()=>{const n=!d.reason.referralQuickSelect;setData(p=>({...p,reason:{...p.reason,referralQuickSelect:n,referralFrom:n?"上尾中央総合病院":"",referralDept:n?"糖尿病内科":""}}));}}>
              {d.reason.referralQuickSelect?"✓ ":""}上尾中央総合病院・糖尿病内科
            </button>
            {!d.reason.referralQuickSelect&&(<div style={{display:"flex",gap:10,marginBottom:12}}>
              <div style={{flex:2}}><label style={lbl()}>病院名</label><input style={inp()} placeholder="病院名" value={d.reason.referralFrom} onChange={e=>up("reason","referralFrom",e.target.value)}/></div>
              <div style={{flex:1}}><label style={lbl()}>科名</label><input style={inp()} placeholder="例：内科" value={d.reason.referralDept} onChange={e=>up("reason","referralDept",e.target.value)}/></div>
            </div>)}
            <label style={lbl()}>紹介の理由</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
              {["コントロール不良のため","安定していたため当院へ","専門的管理のため","内容不明"].map(v=><button key={v} style={btn(d.reason.referralDetail===v)} onClick={()=>up("reason","referralDetail",v)}>{v}</button>)}
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
              {["会社健診","市健診","人間ドック"].map(v=><button key={v} style={btn(d.reason.checkupType===v)} onClick={()=>up("reason","checkupType",v)}>{v}</button>)}
            </div>
          </div>)}
          <div style={{marginTop:8}}>
            <label style={lbl({marginTop:8})}>自由記入欄（任意）</label>
            <textarea style={{...inp(),minHeight:60,resize:"vertical"}} placeholder="補足があれば記載（書かなくてもOK）" value={d.reason.summary} onChange={e=>up("reason","summary",e.target.value)}/>
          </div>
        </div>
      );

      case 1: return (
        <div>
          <label style={lbl()}>病名（該当するものを選択）</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:8}}>
            {[["igt","耐糖能異常（IGT）","#e07000"],["ht","高血圧（HT）","#1a5fa8"],["hl","脂質異常症（HL）","#1a5fa8"]].map(([k,l,c])=>(
              <button key={k} style={btn(d.disease[k],c)} onClick={()=>up("disease",k,!d.disease[k])}>{l}</button>
            ))}
          </div>



          <label style={lbl({marginTop:8})}>その他の病名・既往歴</label>
          <div style={{fontSize:12,color:"#7a9abf",marginBottom:8}}>例：慢性腎臓病、甲状腺疾患、うつ病 など</div>
          {(d.disease.otherDiseases||[{name:"",hospital:"",hospitalOther:""}]).map((od,i)=>(
            <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
              <div style={{flex:"0 0 20px",paddingTop:10,fontSize:13,color:"#8899aa",fontWeight:700}}>{i+1}</div>
              <div style={{flex:2}}>
                {i===0&&<label style={lbl()}>病名</label>}
                <input style={inp()} placeholder="病名（なければ空欄）" value={od.name||""} onChange={e=>setData(p=>{const a=[...(p.disease.otherDiseases||[])];a[i]={...a[i],name:e.target.value};return{...p,disease:{...p.disease,otherDiseases:a}};})}/>
              </div>
              <div style={{flex:3}}>
                {i===0&&<label style={lbl()}>現在の通院先</label>}
                {od.name?(
                  <div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                      {["自治医大さいたま医療センター","上尾中央総合病院","埼玉県立がんせンター","通院なし","その他"].map(h=>(
                        <button key={h} style={{...btn(od.hospital===h),padding:"5px 10px",fontSize:12}} onClick={()=>setData(p=>{const a=[...(p.disease.otherDiseases||[])];a[i]={...a[i],hospital:h};return{...p,disease:{...p.disease,otherDiseases:a}};})}>{h}</button>
                      ))}
                    </div>
                    {od.hospital==="その他"&&<input style={{...inp(),marginTop:6,fontSize:13}} placeholder="病院名" value={od.hospitalOther||""} onChange={e=>setData(p=>{const a=[...(p.disease.otherDiseases||[])];a[i]={...a[i],hospitalOther:e.target.value};return{...p,disease:{...p.disease,otherDiseases:a}};})}/>}
                  </div>
                ):<div style={{paddingTop:8,fontSize:12,color:"#b0c0d0"}}>病名を入力すると通院先が選べます</div>}
              </div>
              {i>0&&<button onClick={()=>setData(p=>{const a=(p.disease.otherDiseases||[]).filter((_,j)=>j!==i);return{...p,disease:{...p.disease,otherDiseases:a}};})} style={{fontSize:12,color:"#e53e3e",background:"none",border:"none",cursor:"pointer",fontWeight:700,paddingTop:10}}>✕</button>}
            </div>
          ))}
          <button style={{...btn(false,"#718096"),fontSize:13,marginBottom:14}} onClick={()=>setData(p=>{const a=[...(p.disease.otherDiseases||[]),{name:"",hospital:"",hospitalOther:""}];return{...p,disease:{...p.disease,otherDiseases:a}};})}>＋ その他の病名を追加</button>
                    <div style={{...sBox({background:"#f0f8ff",border:"1.5px solid #bee3f8"}),marginTop:8}}>
            <div style={{fontSize:13,fontWeight:800,color:"#2b6cb0",marginBottom:4}}>🔍 エコー検査について</div>
            <div style={{fontSize:12,color:"#4a7fa8",marginBottom:12,lineHeight:1.7}}>当院では合併症検査として、頸動脈エコー・腹部エコー等を年に1回行っています。</div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:200}}>
                <label style={lbl({color:"#2b6cb0"})}>頚部エコー（必須・年1回）</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  {["他院で施行済","健診で施行済"].map(v=>(
                    <button key={v} style={{...btn(d.disease.echoNeck===v,"#2b6cb0"),padding:"6px 10px",fontSize:12}} onClick={()=>up("disease","echoNeck",v)}>{v}</button>
                  ))}
                </div>
              </div>
              <div style={{flex:1,minWidth:200}}>
                <label style={lbl({color:"#2b6cb0"})}>腹部エコー</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  {["他院で施行済","健診で施行済","希望あり","希望なし"].map(v=>(
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
          <label style={lbl()}>患者様の年齢</label>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <input style={{...inp(),width:80}} type="number" placeholder="歳" value={d.history.age} onChange={e=>up("history","age",e.target.value)}/>
            <span style={{fontSize:13,color:"#666"}}>歳</span>
            {age>0&&(<span style={{fontSize:12,fontWeight:700,padding:"4px 12px",borderRadius:20,color:isOver70?"#c53030":isOver60?"#c05621":"#276749",background:isOver70?"#fff5f5":isOver60?"#fffaf0":"#f0fff4",border:`1px solid ${isOver70?"#feb2b2":isOver60?"#fbd38d":"#9ae6b4"}`}}>
              {isOver70?"70歳以上：子供の状況も確認":isOver60?"60歳以上：ワクチン確認あり":"60歳未満：ワクチン確認不要"}
            </span>)}
          </div>
          <label style={lbl()}>アレルギー歴</label>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            {["なし","あり"].map(v=><button key={v} style={btn(d.history.allergy===v)} onClick={()=>up("history","allergy",v)}>{v}</button>)}
          </div>
          {d.history.allergy==="あり"&&<input style={{...inp(),marginBottom:14}} placeholder="内容（例：ペニシリン系）" value={d.history.allergyDetail} onChange={e=>up("history","allergyDetail",e.target.value)}/>}
          <label style={lbl({marginTop:8})}>家族歴（FH）</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:16}}>
            {[["dm","糖尿病(DM)"],["ht","高血圧(HT)"],["hl","脂質異常症(HL)"],["apo","脳卒中(APO)"],["ihd","虚血性心疾患(IHD)"]].map(([k,l])=>(
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
            {d.history.smoking==="禁煙済"&&(<div><label style={lbl({color:"#2b6cb0"})}>禁煙した時期</label><EraYear era={d.history.smokingQuitEra} year={d.history.smokingQuitYear} onEraChange={v=>up("history","smokingQuitEra",v)} onYearChange={v=>up("history","smokingQuitYear",v)}/></div>)}
          </div>)}
          <label style={lbl()}>健診の種類</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:14}}>
            {["市の健診","会社の健診","人間ドック"].map(v=><button key={v} style={btn(d.history.checkup.includes(v))} onClick={()=>toggleArr("history","checkup",v)}>{v}</button>)}
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
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:8}}>
            {LIVING_WITH_SPOUSE.map(v=><button key={v} style={btn(d.history.livingSpouse===v)} onClick={()=>up("history","livingSpouse",v)}>{v}</button>)}
          </div>
          <label style={lbl({marginTop:8})}>子供・その他との同居</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>{LIVING_OTHERS.map(v=><button key={v} style={btn(d.history.livingOther===v)} onClick={()=>up("history","livingOther",v)}>{v}</button>)}</div>
          {d.history.livingOther==="その他"&&<input style={{...inp(),marginBottom:6}} placeholder="例：兄弟と同居" value={d.history.livingCustom} onChange={e=>up("history","livingCustom",e.target.value)}/>}
          <input style={{...inp(),marginBottom:8}} placeholder="補足があれば（例：夫は要介護）" value={d.history.livingCustom} onChange={e=>up("history","livingCustom",e.target.value)}/>
          {isOver70&&(<div style={sBox({border:"1.5px solid #fbd38d",background:"#fffaf0"})}>
            <div style={{fontSize:13,fontWeight:800,color:"#c05621",marginBottom:8}}>👨‍👩‍👧 お子さんの状況（70歳以上）</div>
            <input style={inp()} placeholder="例：子供は近居（さいたま市）　例：子供なし" value={d.history.childInfo} onChange={e=>up("history","childInfo",e.target.value)}/>
          </div>)}
          <label style={lbl({marginTop:8})}>仕事</label>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            {["している","していない"].map(v=><button key={v} style={btn(d.history.work===v)} onClick={()=>up("history","work",v)}>{v}</button>)}
          </div>
          {d.history.work==="している"&&<input style={{...inp(),marginBottom:14}} placeholder="職業（例：会社員・自営業・パート）" value={d.history.job} onChange={e=>up("history","job",e.target.value)}/>}
          <label style={lbl()}>活動量</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {["体を動かしていることが多い","立っていることが多い","座っていることが多い"].map(v=><button key={v} style={btn(d.history.activity===v)} onClick={()=>up("history","activity",v)}>{v}</button>)}
          </div>
        </div>
      );

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
          <label style={lbl()}>診察への要望・聞きたいこと</label>
          <textarea style={{...inp(),minHeight:80,resize:"vertical"}} placeholder="自由にご記入ください（なければ空欄）" value={d.body.concern} onChange={e=>up("body","concern",e.target.value)}/>
        </div>
      );

      default: return null;
    }
  };

  return (
    <div ref={topRef} style={{minHeight:"100vh",background:"linear-gradient(135deg,#e8f4fd 0%,#f0f7ff 60%,#edf7ee 100%)",fontFamily:"'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif",padding:"20px 16px"}}>
      <div style={{maxWidth:680,margin:"0 auto 18px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#2d8653,#48bb78)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏥</div>
          <div>
            <div style={{fontSize:11,color:"#68a47a",fontWeight:700,letterSpacing:"0.08em"}}>まつもと糖尿病クリニック</div>
            <div style={{fontSize:20,fontWeight:900,color:"#1a2a4a"}}>初診事前問診</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
<span style={{fontSize:12,background:"#e8f8ee",color:"#2d8653",padding:"4px 14px",borderRadius:20,fontWeight:700}}>高血圧・脂質異常症</span>
          </div>
        </div>

      </div>

      <div style={{maxWidth:680,margin:"0 auto"}}>
        {!done&&(<div style={{display:"flex",gap:4,marginBottom:18}}>
          {STEPS.map((s,i)=>(<div key={s.id} style={{flex:1,textAlign:"center"}}>
            <div style={{height:4,borderRadius:2,background:i<=step?"#2d8653":"#d0dff5",marginBottom:4,transition:"background 0.3s"}}/>
            <div style={{fontSize:10,color:i<=step?"#2d8653":"#b0c8e0",fontWeight:i===step?700:400}}>{s.title}</div>
          </div>))}
        </div>)}

        {!done?(
          <div style={{background:"#fff",borderRadius:16,padding:"24px 26px",boxShadow:"0 2px 20px rgba(0,100,60,0.07)"}}>
            <h2 style={{fontSize:16,fontWeight:800,color:"#1a2a4a",marginBottom:18,borderBottom:"2px solid #e8f8ee",paddingBottom:10}}>{STEPS[step].title}</h2>
            {renderStep()}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:26}}>
              <button style={{padding:"11px 22px",borderRadius:8,border:"1.5px solid #d0dff5",background:"#f7faff",color:step===0?"#c0d0e0":"#5580a8",fontWeight:700,fontSize:14,cursor:step===0?"not-allowed":"pointer"}} onClick={()=>goStep(step-1)} disabled={step===0}>← 前へ</button>
              {step<STEPS.length-1?(
                <button style={{padding:"11px 26px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#2d8653,#48bb78)",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:"0 4px 12px rgba(45,134,83,0.25)"}} onClick={()=>goStep(step+1)}>次へ →</button>
              ):(
                <button style={{padding:"11px 26px",borderRadius:8,border:"none",background:loading?"#8ab0d4":"linear-gradient(135deg,#0f9668,#34d399)",color:"#fff",fontWeight:800,fontSize:14,cursor:loading?"not-allowed":"pointer",boxShadow:"0 4px 12px rgba(15,150,104,0.25)"}} onClick={generateKarte} disabled={loading}>{loading?"生成中...":"✨ カルテ文を生成"}</button>
              )}
            </div>
          </div>
        ):(
          <div style={{background:"#fff",borderRadius:16,padding:"24px 26px",boxShadow:"0 2px 20px rgba(0,100,60,0.07)",border:"2px solid #c6f6d5"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{width:32,height:32,borderRadius:8,background:"#0f9668",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:16}}>✓</div>
              <div>
                <div style={{fontWeight:800,color:"#0a5c40",fontSize:15}}>カルテ記載文が生成されました</div>
                <div style={{fontSize:12,color:"#5a9a80"}}>内容確認後、電子カルテにコピーしてください</div>
              </div>
            </div>
            {visitCode && (
              <div style={{background:"linear-gradient(135deg,#2d8653,#48bb78)",borderRadius:14,padding:"20px",marginBottom:16,textAlign:"center"}}>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",marginBottom:6,fontWeight:700}}>受付番号</div>
                <div style={{fontSize:56,fontWeight:900,color:"#fff",letterSpacing:"0.2em",lineHeight:1}}>{visitCode}</div>
                
              </div>
            )}
            <div style={{background:"#fff8e1",border:"2px solid #f59e0b",borderRadius:12,padding:"14px 18px",marginBottom:12,textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:900,color:"#92400e"}}>📋 タブレットを受付にお返しください</div>
              <div style={{fontSize:12,color:"#b45309",marginTop:4}}>問診は完了しています。ありがとうございました。</div>
            </div>
            <div style={{background:"#f5f9f7",border:"1px solid #c0e8d8",borderRadius:10,padding:"16px 18px",whiteSpace:"pre-wrap",fontSize:13,lineHeight:2,color:"#1a3a2a",fontFamily:"monospace"}}>{result}</div>

            <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#2d8653,#48bb78)",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"}} onClick={()=>copyToClipboard(result)}>📋 コピー</button>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"1.5px solid #2d8653",background:"#f0f7ff",color:"#2d8653",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>{setDone(false);setStep(0);setTimeout(scrollTop,50);}}>✏️ 修正する</button>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"1.5px solid #d0dff5",background:"#f7faff",color:"#5580a8",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>{setDone(false);setStep(0);setData(initialData);setResult("");setVisitCode("");setTimeout(scrollTop,50);}}>🔄 最初から</button>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"1.5px solid #9ae6b4",background:"#f0fff4",color:"#276749",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>{window.location.href="/";}}>🏠 TOPへ</button>
            </div>
          </div>
        )}
        <div style={{textAlign:"center",fontSize:11,color:"#a0b8d0",marginTop:14}}>入力内容は送信後に消去されます　│　個人情報は院内のみで使用されます</div>
      </div>
    </div>
  );
}

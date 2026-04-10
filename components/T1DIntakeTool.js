import { useState, useRef } from "react";

const STEPS = [
  { id: "alert",   title: "重要確認" },
  { id: "reason",  title: "受診理由" },
  { id: "disease", title: "1型糖尿病" },
  { id: "history", title: "既往・生活歴" },
  { id: "body",    title: "体格・要望" },
];

const NEARBY_HOSPITALS = ["自治医大さいたま医療センター", "上尾中央総合病院", "埼玉県立がんセンター", "その他", "不明"];
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
  alert: { weightLoss: "" },
  reason: {
    type: "", referralFrom: "", referralDept: "", referralQuickSelect: false,
    referralDetail: "", transferFrom: "", transferDetail: "", checkupType: "",
    deviceWish: [], summary: "",
  },
  disease: {
    dm1type: "",
    dmOnsetEra: "令和", dmOnset: "", dmOnsetUnknown: false,
    ht: false, hl: false,
    thyroidChecked: false,
    pensionStatus: "", pensionKosei: "", pensionPossibility: "",
  },
  history: {
    age: "", allergy: "なし", allergyDetail: "",
    fh: { dm: false, dmWho: [], ht: false, apo: false, ihd: false },
    alcoholNone: false, alcoholItems: [emptyAlcohol()],
    smoking: "なし", smokingAmount: "", smokingYears: "", smokingStartAge: "",
    smokingQuitEra: "令和", smokingQuitYear: "",
    eyeVisiting: "", eye: "",
    checkup: [],
    vaccine65Prevena: "", vaccine65Herpes: "",
    livingSpouse: "", livingOther: "", livingCustom: "", childInfo: "",
    work: "していない", job: "", activity: "",
    otherDiseases: [{name:"",hospital:"",hospitalOther:""}],
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

export default function T1DIntakeTool() {
  const [step, setStep]         = useState(0);
  const [data, setData]         = useState(initialData);
  const [result, setResult]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [visitCode, setVisitCode] = useState("");
  const topRef = useRef(null);

  const scrollTop = () => { if(topRef.current) topRef.current.scrollIntoView({behavior:"smooth"}); };
  const goStep = (n) => { setStep(n); setTimeout(scrollTop, 50); };
  const up  = (sec,f,v) => setData(p=>({...p,[sec]:{...p[sec],[f]:v}}));
  const upN = (sec,par,f,v) => setData(p=>({...p,[sec]:{...p[sec],[par]:{...p[sec][par],[f]:v}}}));
  const toggleArr = (sec,f,v) => setData(p=>{const a=p[sec][f];return{...p,[sec]:{...p[sec],[f]:a.includes(v)?a.filter(x=>x!==v):[...a,v]}};});
  const upAl = (i,f,v) => setData(p=>{const a=[...p.history.alcoholItems];a[i]={...a[i],[f]:v};return{...p,history:{...p.history,alcoholItems:a}};});
  const addAl = () => setData(p=>({...p,history:{...p.history,alcoholItems:[...p.history.alcoholItems,emptyAlcohol()]}}));
  const delAl = (i) => setData(p=>({...p,history:{...p.history,alcoholItems:p.history.alcoholItems.filter((_,j)=>j!==i)}}));

  const age      = parseInt(data.history.age)||0;
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
  const dmOnsetText = () => {
    if(data.disease.dmOnsetUnknown||!data.disease.dmOnset) return "";
    return `（${data.disease.dmOnsetEra}${data.disease.dmOnset}年）`;
  };
  const getCurrentMonth = () => {
    const now = new Date();
    return `R${now.getFullYear()-2018}.${now.getMonth()+1}`;
  };

  const copyToClipboard = (text) => {
    const copy = () => { const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); alert('コピーしました'); };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(() => alert('コピーしました')).catch(copy); } else { copy(); }
  };

  const generateKarte = async () => {
    setLoading(true);
    const prompt = `あなたは糖尿病専門クリニックの電子カルテ記載AIです。以下の患者情報をもとに、1型糖尿病のカルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- 体重減少ありの場合は一番上に【⚠️ 体重減少あり・早急なインスリン導入を検討】と記載
- 受診理由の直後、空行なしで＃1型糖尿病を続ける
- ＃1型糖尿病・＃HT・＃HLは空行なしで続ける
- 他院で管理中の疾患（既往歴）は空行を1行入れてから記載する
- 60歳未満はワクチン歴を省略、70歳未満は子供の状況を省略
- 喫煙歴は「○本×○年（○歳〜）」の形式
- 採血項目：GAD抗体・CPR・甲状腺3項目は初診時必須として記載

【整形済みデータ】
飲酒歴：${buildAlcohol()}
喫煙歴：${buildSmoking()}
生活情報：${buildLiving()}
発症時期：${dmOnsetText()}

【患者情報JSON】
${JSON.stringify(data,null,2)}

【出力フォーマット】
（体重減少ありなら）【⚠️ 体重減少あり・早急なインスリン導入を検討】

${getCurrentMonth()}：（受診理由1〜2行）
＃1型糖尿病（${data.disease.dm1type||"タイプ不明"}）${dmOnsetText()}
・GAD抗体：（初診時採血）
・CPR：（初診時採血）
・甲状腺検査：（${data.disease.thyroidChecked?"初診時採血済":"初診時採血"}）

＃HT（該当時のみ）
＃HL（該当時のみ）

---------------------------------------------
【アレルギー歴】
【FH】DM(-/+) HT(-/+) APO(-/+) IHD(-/+)
【飲酒歴】
【喫煙歴】
【眼科通院歴】（通院中の場合：眼科名と網膜症の状況を記載）
【健診】
【ワクチン歴】（60歳以上のみ）
【生活情報】（70歳以上は子供の状況も含む）
【仕事】職業・活動量
---------------------------------------------
頚部エコー：${data.history?.echoNeck||"未選択"}　腹部エコー：${data.history?.echoAbdomen||"未選択"}
---------------------------------------------
身長:○cm　初診時:○kg　20歳時:○kg　max体重○kg(○歳)
---------------------------------------------
【事前聴取時　申し送り事項】
（体重減少ありの場合）□体重減少あり（3ヶ月以内に3kg以上）インスリン導入要検討
（障害年金：厚生年金加入ありの場合）□障害年金の可能性あり→CPR結果を確認してください
（デバイス希望がある場合）□使用希望デバイス：CGM=${data.reason.cgmWish||"なし"}　ポンプ=${data.reason.pumpWish||"なし"}
□甲状腺3項目・GAD抗体・CPRを初診時採血
（インスリン未使用の場合）□初回療養計画書を作成済
（CGM希望がある場合）□CGM：${data.reason.cgmCurrent&&data.reason.cgmCurrent!=="使用していない"?data.reason.cgmCurrent+"使用中→":""} ${data.reason.cgmWish&&data.reason.cgmWish!=="希望なし"?data.reason.cgmWish:""}
（ポンプ希望がある場合）□インスリンポンプ：${data.reason.pumpCurrent&&data.reason.pumpCurrent!=="使用していない"?data.reason.pumpCurrent+"使用中→":""} ${data.reason.pumpWish&&data.reason.pumpWish!=="希望なし"?data.reason.pumpWish:""}
【診察にあたっての要望】（記載あれば内容を、なければ「なし」と記載）
---------------------------------------------
${getCurrentMonth()}：HbA1c　　%　CPR（　）　※GAD陽性の場合は甲状腺項目追加してください　CPR0.5以下の方は今後半年ごとCPR測定を入れてください。




アレルギー薬あれば赤字14フォント太字
目標HbA1c　　　　%　目標体重　　　次回検討薬：
DM基本セット
1月follow
曜希望
LINE登録ご案内→済　登録確認未・登録できない
`;
    try {
      const res = await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1200,messages:[{role:"user",content:prompt}]})});
      const json = await res.json();
      const generated = json.content?.[0]?.text||"生成に失敗しました";
      setResult(generated);
      try {
        const saveRes = await fetch("/api/questionnaire",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({form_type:"1型糖尿病",form_data:data,age:data.history?.age||null,generated_karte:generated})});
        const saveJson = await saveRes.json();
        if(saveJson.visit_code) setVisitCode(saveJson.visit_code);
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
  
          <div style={{background:"#fff5f5",border:"2px solid #e53e3e",borderRadius:12,padding:"16px 20px",marginBottom:20}}>
            <div style={{fontSize:15,fontWeight:900,color:"#c53030",marginBottom:6}}>⚠️ 最初に必ず確認してください</div>
            <div style={{fontSize:13,color:"#742a2a",lineHeight:1.7}}>
              体重減少がある患者様は<strong>早急なインスリン導入</strong>が必要な場合があります。<br/>
              ※体重減少の定義：<strong>3ヶ月以内に3kg以上の体重減少</strong>
            </div>
          </div>
          <label style={lbl()}>最近、体重が減っていますか？</label>
          <div style={{display:"flex",gap:8}}>
            {["あり","なし","不明"].map(v=>(
              <button key={v} style={btn(d.alert.weightLoss===v,v==="あり"?"#e53e3e":"#1a5fa8")}
                onClick={()=>{up("alert","weightLoss",v);if(v==="あり")setIsNurse(true);}}>
                {v==="あり"?"⚠️ あり":v}
              </button>
            ))}
          </div>
          {d.alert.weightLoss==="あり"&&(
            <div style={{marginTop:14,background:"#c53030",color:"#fff",borderRadius:10,padding:"14px 18px",fontWeight:800,fontSize:14,lineHeight:1.8}}>
              🚨 スタッフへ申し送り：体重減少ありのため、インスリン導入を要検討。医師に至急お伝えください。
            </div>
          )}
        </div>
      );

      case 1: return (
        <div>
          <label style={lbl()}>受診理由</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:14}}>
            {["紹介","検診異常","自主転院"].map(r=><button key={r} style={btn(d.reason.type===r)} onClick={()=>up("reason","type",r)}>{r}</button>)}
            <button style={btn(d.reason.dmConcern,"#8e44ad")} onClick={()=>{up("reason","dmConcern",!d.reason.dmConcern);if(d.reason.type)up("reason","type","");}}>
              {d.reason.dmConcern?"✓ 1型糖尿病が気になる":"1型糖尿病が気になる"}
            </button>
          </div>
          {d.reason.dmConcern&&(
            <div style={{paddingLeft:12,borderLeft:"3px solid #8e44ad",marginBottom:14}}>
              <label style={lbl({color:"#8e44ad"})}>気になる理由</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                {["家族に1型糖尿病の方がいる","急に体重が減った","喉が渇く・尿が多い","その他"].map(v=>(
                  <button key={v} style={btn(d.reason.dmConcernReason===v,"#8e44ad")} onClick={()=>up("reason","dmConcernReason",v)}>{v}</button>
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
              <div style={{flex:1}}><label style={lbl()}>科名</label><input style={inp()} placeholder="例：糖尿病内科" value={d.reason.referralDept} onChange={e=>up("reason","referralDept",e.target.value)}/></div>
            </div>)}
            <label style={lbl()}>紹介の理由</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
              {["血糖コントロール不良のため","安定していたため当院へ","専門的管理のため","内容不明"].map(v=><button key={v} style={btn(d.reason.referralDetail===v)} onClick={()=>up("reason","referralDetail",v)}>{v}</button>)}
            </div>
          </div>)}
          {d.reason.type==="自主転院"&&(<div style={sBox()}>
            <label style={lbl()}>転院元 医療機関名</label>
            <input style={{...inp(),marginBottom:12}} placeholder="例：○○クリニック（言いたくない場合は空欄でOK）" value={d.reason.transferFrom} onChange={e=>up("reason","transferFrom",e.target.value)}/>
            <label style={lbl()}>転院の理由</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
              {["血糖コントロール改善しないため","転居のため","より専門的な治療を希望","その他"].map(v=><button key={v} style={btn(d.reason.transferDetail===v)} onClick={()=>up("reason","transferDetail",v)}>{v}</button>)}
            </div>
          </div>)}
          {d.reason.type==="検診異常"&&(<div style={sBox()}>
            <label style={lbl()}>検診の種類</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
              {["会社健診","市健診","人間ドック"].map(v=><button key={v} style={btn(d.reason.checkupType===v)} onClick={()=>up("reason","checkupType",v)}>{v}</button>)}
            </div>
          </div>)}
          <div style={{marginTop:8}}>
            <label style={lbl()}>デバイスについて（現在使用中・希望があれば選択）</label>
            <div style={{marginBottom:10}}>
              <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>CGM（現在使用中）</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
                {["フリースタイルリブレ","Dexcom G7","使用していない"].map(v=>(
                  <button key={v} style={btn(d.reason.cgmCurrent===v,"#0f9668")} onClick={()=>up("reason","cgmCurrent",v)}>{v}</button>
                ))}
              </div>
              <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>CGM（希望）</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
                {["フリースタイルリブレ","Dexcom G7","希望なし","先生と相談したい"].map(v=>(
                  <button key={v} style={btn(d.reason.cgmWish===v,"#0f9668")} onClick={()=>up("reason","cgmWish",v)}>{v}</button>
                ))}
              </div>
              <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>インスリンポンプ（現在使用中）</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
                {["ミニメド","メディセーフウィズ","使用していない"].map(v=>(
                  <button key={v} style={btn(d.reason.pumpCurrent===v,"#553c9a")} onClick={()=>up("reason","pumpCurrent",v)}>{v}</button>
                ))}
              </div>
              <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>インスリンポンプ（希望）</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                {["ミニメド","メディセーフウィズ","希望なし","先生と相談したい"].map(v=>(
                  <button key={v} style={btn(d.reason.pumpWish===v,"#553c9a")} onClick={()=>up("reason","pumpWish",v)}>{v}</button>
                ))}
              </div>
            </div>
            <label style={lbl()}>自由記入欄（任意）</label>
            <textarea style={{...inp(),minHeight:60,resize:"vertical"}} placeholder="補足があれば記載（書かなくてもOK）" value={d.reason.summary} onChange={e=>up("reason","summary",e.target.value)}/>
          </div>
        </div>
      );

      case 2: return (
        <div>
          <div style={{...sBox({background:"#f0f7ff",border:"2px solid #bcd4f8"}),marginBottom:16}}>
            <span style={{fontSize:15,fontWeight:900,color:"#1a5fa8"}}>＃1型糖尿病</span>
            <div style={{marginTop:12}}>
              <label style={lbl()}>1型のタイプ</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:14}}>
                {["激症1型","急性発症","緩徐進行性（SPIDDM）","不明"].map(v=>(
                  <button key={v} style={btn(d.disease.dm1type===v)} onClick={()=>up("disease","dm1type",v)}>{v}</button>
                ))}
              </div>
              <label style={lbl()}>発症時期</label>
              <div style={{marginBottom:6}}>
                <EraYear era={d.disease.dmOnsetEra} year={d.disease.dmOnset}
                  onEraChange={v=>up("disease","dmOnsetEra",v)}
                  onYearChange={v=>up("disease","dmOnset",v)}
                  disabled={d.disease.dmOnsetUnknown}/>
              </div>
              <label style={{fontSize:13,color:"#5580a8",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                <input type="checkbox" checked={d.disease.dmOnsetUnknown} onChange={e=>up("disease","dmOnsetUnknown",e.target.checked)}/>
                発症時期は不明
              </label>
            </div>
          </div>
          <label style={lbl()}>インスリン使用状況</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:14}}>
            {["インスリン使用中","インスリン未使用"].map(v=>(
              <button key={v} style={btn(d.disease.insulinStatus===v,v==="インスリン使用中"?"#c53030":"#1a5fa8")} onClick={()=>up("disease","insulinStatus",v)}>{v}</button>
            ))}
          </div>
          <label style={lbl()}>合併する疾患</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:16}}>
            {[["ht","高血圧（HT）"],["hl","脂質異常症（HL）"]].map(([k,l])=>(
              <button key={k} style={btn(d.disease[k])} onClick={()=>up("disease",k,!d.disease[k])}>{l}</button>
            ))}
          </div>

          <div style={sBox({background:"#faf5ff",border:"1.5px solid #d6bcfa"})}>
            <div style={{fontSize:13,fontWeight:800,color:"#553c9a",marginBottom:10}}>💼 障害年金について</div>
            <label style={lbl({color:"#553c9a"})}>現在の受給状況</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:12}}>
              {["受給中","受給していない","不明"].map(v=>(
                <button key={v} style={btn(d.disease.pensionStatus===v,"#553c9a")} onClick={()=>up("disease","pensionStatus",v)}>{v}</button>
              ))}
            </div>
            {(d.disease.pensionStatus==="受給していない"||d.disease.pensionStatus==="不明")&&(
              <div style={{paddingLeft:12,borderLeft:"3px solid #d6bcfa",marginTop:4}}>
                <div style={{fontSize:12,color:"#7c3aed",marginBottom:10,lineHeight:1.7}}>
                  1型糖尿病と診断された時点で厚生年金に加入していた場合、障害年金を受給できる可能性があります。
                </div>
                <label style={lbl({color:"#553c9a"})}>DM診断時、厚生年金に加入していましたか？</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:12}}>
                  {["はい（加入していた）","いいえ（未加入）","不明"].map(v=>(
                    <button key={v} style={btn(d.disease.pensionKosei===v,"#553c9a")} onClick={()=>up("disease","pensionKosei",v)}>{v}</button>
                  ))}
                </div>

              </div>
            )}
          </div>
        </div>
      );

      case 3: return (
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
                {od.name?(
                  <div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                      {["自治医大さいたま医療センター","上尾中央総合病院","埼玉県立がんセンター","通院なし","その他"].map(h=>(
                        <button key={h} style={{...btn(od.hospital===h),padding:"5px 10px",fontSize:12}} onClick={()=>setData(p=>{const a=[...(p.history.otherDiseases||[])];a[i]={...a[i],hospital:h};return{...p,history:{...p.history,otherDiseases:a}};})}>{h}</button>
                      ))}
                    </div>
                    {od.hospital==="その他"&&<input style={{...inp(),marginTop:6,fontSize:13}} placeholder="病院名" value={od.hospitalOther||""} onChange={e=>setData(p=>{const a=[...(p.history.otherDiseases||[])];a[i]={...a[i],hospitalOther:e.target.value};return{...p,history:{...p.history,otherDiseases:a}};})}/>}
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
          {d.history.allergy==="あり"&&<input style={{...inp(),marginBottom:14}} placeholder="内容（例：ペニシリン系・造影剤）" value={d.history.allergyDetail} onChange={e=>up("history","allergyDetail",e.target.value)}/>}
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
          <label style={lbl()}>眼科通院歴（糖尿病網膜症チェック）</label>
          <div style={{fontSize:12,color:"#7a9abf",marginBottom:6}}>糖尿病による網膜症のフォローのため確認します</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
            {["通院中","通院していない","今後受診予定"].map(v=>(
              <button key={v} style={btn(d.history.eyeVisiting===v,v==="通院していない"?"#718096":"#1a5fa8")} onClick={()=>up("history","eyeVisiting",v)}>{v}</button>
            ))}
          </div>
          {d.history.eyeVisiting==="通院中"&&(
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6}}>
                {["上尾こいけ眼科","おが・おおぐし眼科","上尾中央総合病院眼科","おおたけ眼科","こしの眼科"].map(v=>(
                  <button key={v} style={{...btn(d.history.eye===v),padding:"6px 10px",fontSize:12}} onClick={()=>up("history","eye",v)}>{v}</button>
                ))}
              </div>
              <input style={{...inp(),marginBottom:8}} placeholder="その他の眼科名を入力"
                value={["上尾こいけ眼科","おが・おおぐし眼科","上尾中央総合病院眼科","おおたけ眼科","こしの眼科"].includes(d.history.eye)?"":d.history.eye}
                onChange={e=>up("history","eye",e.target.value)}/>
              <label style={lbl({fontSize:11})}>糖尿病網膜症の状況（分かる範囲で）</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                {["網膜症なし","単純性網膜症","前増殖性網膜症","増殖性網膜症"].map(v=>(
                  <button key={v} style={{...btn(d.history.retinopathy===v),padding:"6px 10px",fontSize:12}} onClick={()=>up("history","retinopathy",v)}>{v}</button>
                ))}
              </div>
            </div>
          )}
          {d.history.eyeVisiting!=="通院中"&&<div style={{marginBottom:14}}/>}
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
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:8}}>
            {LIVING_WITH_SPOUSE.map(v=><button key={v} style={btn(d.history.livingSpouse===v)} onClick={()=>up("history","livingSpouse",v)}>{v}</button>)}
          </div>
          <label style={lbl({marginTop:8})}>子供・その他との同居</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
            {LIVING_OTHERS.map(v=><button key={v} style={btn(d.history.livingOther===v)} onClick={()=>up("history","livingOther",v)}>{v}</button>)}
          </div>
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

      case 4: return (
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
    <div ref={topRef} style={{minHeight:"100vh",background:"linear-gradient(135deg,#fef3f2 0%,#fff5f5 40%,#f0f7ff 100%)",fontFamily:"'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif",padding:"20px 16px"}}>
      <div style={{maxWidth:700,margin:"0 auto 18px"}}>
        {data.alert.weightLoss==="あり"&&!done&&(
          <div style={{background:"#c53030",color:"#fff",borderRadius:10,padding:"12px 18px",marginBottom:12,fontWeight:900,fontSize:14}}>
            🚨 体重減少あり ― インスリン導入を要検討・医師へ至急申し送り
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#c53030,#fc8181)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏥</div>
          <div>
            <div style={{fontSize:11,color:"#c53030",fontWeight:700,letterSpacing:"0.08em"}}>まつもと糖尿病クリニック</div>
            <div style={{fontSize:20,fontWeight:900,color:"#1a2a4a"}}>初診事前問診</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
<span style={{fontSize:12,background:"#fff5f5",color:"#c53030",padding:"4px 14px",borderRadius:20,fontWeight:700}}>1型糖尿病</span>
          </div>
        </div>
      </div>

      <div style={{maxWidth:700,margin:"0 auto"}}>
        {!done&&(<div style={{display:"flex",gap:4,marginBottom:18}}>
          {STEPS.map((s,i)=>(<div key={s.id} style={{flex:1,textAlign:"center"}}>
            <div style={{height:4,borderRadius:2,background:i<=step?"#c53030":"#d0dff5",marginBottom:4,transition:"background 0.3s"}}/>
            <div style={{fontSize:10,color:i<=step?"#c53030":"#b0c8e0",fontWeight:i===step?700:400}}>{s.title}</div>
          </div>))}
        </div>)}

        {!done?(
          <div style={{background:"#fff",borderRadius:16,padding:"24px 26px",boxShadow:"0 2px 20px rgba(180,0,0,0.07)"}}>
            <h2 style={{fontSize:16,fontWeight:800,color:"#1a2a4a",marginBottom:18,borderBottom:"2px solid #fff5f5",paddingBottom:10}}>{STEPS[step].title}</h2>
            {renderStep()}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:26}}>
              <button style={{padding:"11px 22px",borderRadius:8,border:"1.5px solid #d0dff5",background:"#f7faff",color:step===0?"#c0d0e0":"#5580a8",fontWeight:700,fontSize:14,cursor:step===0?"not-allowed":"pointer"}} onClick={()=>goStep(step-1)} disabled={step===0}>← 前へ</button>
              {step<STEPS.length-1?(
                <button style={{padding:"11px 26px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#c53030,#fc8181)",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:"0 4px 12px rgba(197,48,48,0.25)"}} onClick={()=>goStep(step+1)}>次へ →</button>
              ):(
                <button style={{padding:"11px 26px",borderRadius:8,border:"none",background:loading?"#8ab0d4":"linear-gradient(135deg,#0f9668,#34d399)",color:"#fff",fontWeight:800,fontSize:14,cursor:loading?"not-allowed":"pointer",boxShadow:"0 4px 12px rgba(15,150,104,0.25)"}} onClick={generateKarte} disabled={loading}>{loading?"生成中...":"✨ カルテ文を生成"}</button>
              )}
            </div>
          </div>
        ):(
          <div style={{background:"#fff",borderRadius:16,padding:"24px 26px",boxShadow:"0 2px 20px rgba(180,0,0,0.07)",border:"2px solid #c6f6d5"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{width:32,height:32,borderRadius:8,background:"#0f9668",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:16}}>✓</div>
              <div>
                <div style={{fontWeight:800,color:"#0a5c40",fontSize:15}}>カルテ記載文が生成されました</div>
                <div style={{fontSize:12,color:"#5a9a80"}}>内容確認後、電子カルテにコピーしてください</div>
              </div>
            </div>
            {data.alert.weightLoss==="あり"&&(
              <div style={{background:"#c53030",color:"#fff",borderRadius:8,padding:"12px 16px",marginBottom:12,fontSize:14,fontWeight:800}}>
                🚨 体重減少あり ― 医師への至急申し送りが必要です
              </div>
            )}
            {visitCode && (
              <div style={{background:"linear-gradient(135deg,#c53030,#fc8181)",borderRadius:14,padding:"20px",marginBottom:16,textAlign:"center"}}>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",marginBottom:6,fontWeight:700}}>受付番号</div>
                <div style={{fontSize:56,fontWeight:900,color:"#fff",letterSpacing:"0.2em",lineHeight:1}}>{visitCode}</div>
                
              </div>
            )}
            <div style={{background:"#fff8e1",border:"2px solid #f59e0b",borderRadius:12,padding:"14px 18px",textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:900,color:"#92400e"}}>📋 タブレットを受付にお返しください</div>
              <div style={{fontSize:12,color:"#b45309",marginTop:4}}>問診は完了しています。ありがとうございました。</div>
            </div>
            <div style={{background:"#f5f9f7",border:"1px solid #c0e8d8",borderRadius:10,padding:"16px 18px",whiteSpace:"pre-wrap",fontSize:13,lineHeight:2,color:"#1a3a2a",fontFamily:"monospace"}}>{result}</div>

            <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#c53030,#fc8181)",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"}} onClick={()=>copyToClipboard(result)}>📋 コピー</button>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"1.5px solid #c53030",background:"#fff5f5",color:"#c53030",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>{setDone(false);setStep(0);setTimeout(scrollTop,50);}}>✏️ 修正する</button>
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

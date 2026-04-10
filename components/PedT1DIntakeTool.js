import { useState, useRef } from "react";

const STEPS = [
  { id: "reason",   title: "受診理由" },
  { id: "disease",  title: "1型糖尿病" },
  { id: "support",  title: "協力体制" },
  { id: "chronic",  title: "小児慢性" },
  { id: "life",     title: "生活・家族" },
  { id: "body",     title: "体格・要望" },
];

const NEARBY_HOSPITALS = ["自治医大さいたま医療センター", "埼玉県立小児医療センター", "その他", "不明"];
const LIVING_WITH_SPOUSE = ["配偶者あり（両親同居）", "ひとり親家庭", "その他"];
const LIVING_OTHERS = ["祖父母と同居", "兄弟・姉妹あり", "一人っ子", "その他"];
const EYE_CLINICS = ["上尾こいけ眼科", "おが・おおぐし眼科", "上尾中央総合病院眼科", "おおたけ眼科", "こしの眼科"];

const initialData = {
  reason: { type: "", referralFrom: "", referralDept: "", referralQuickSelect: false, referralDetail: "", transferFrom: "", transferDetail: "", summary: "" },
  disease: { dm1type: "", dmOnsetEra: "令和", dmOnset: "", dmOnsetUnknown: false, ht: false, hl: false, thyroidChecked: false, bakusmi: "" },
  support: { familyMain: "", familySubList: [], familyNote: "", schoolStaff: [], schoolSupportPerson: [], schoolSupportNote: "", disclosed: "", childGrade: "", childActivities: [], childActivityNote: "", parentWorkMain: "", parentWorkSub: "", independenceLevel: "", independenceNote: "" },
  chronic: { status: "", birthWeight: "", birthWeek: "", birthWeekDay: "", birthCity: "", booklets: [], documents: [], residenceCity: "", paymentConfirmed: "" },
  history: { allergy: "なし", allergyDetail: "", fh: { dm: false, dmWho: [], dm1: false, dm1Who: [], collagen: false, collagenItems: [{who:"",disease:""}], ht: false, apo: false, ihd: false }, eyeVisiting: "", eye: "", livingSpouse: "", livingOther: "", livingCustom: "", keyPerson: "" },
  body: { height: "", weightNow: "", concern: "" },
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

export default function PedT1DIntakeTool() {
  const [step, setStep]       = useState(0);
  const [data, setData]       = useState(initialData);
  const [isNurse, setIsNurse] = useState(false);
  const [result, setResult]   = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [visitCode, setVisitCode] = useState("");
  const topRef = useRef(null);

  const scrollTop = () => { if(topRef.current) topRef.current.scrollIntoView({behavior:"smooth"}); };
  const goStep = (n) => { setStep(n); setTimeout(scrollTop, 50); };
  const up  = (sec,f,v) => setData(p=>({...p,[sec]:{...p[sec],[f]:v}}));
  const upN = (sec,par,f,v) => setData(p=>({...p,[sec]:{...p[sec],[par]:{...p[sec][par],[f]:v}}}));
  const toggleArr = (sec,f,v) => setData(p=>{const a=p[sec][f];return{...p,[sec]:{...p[sec],[f]:a.includes(v)?a.filter(x=>x!==v):[...a,v]}};});


  const getCurrentMonth = () => {
    const now = new Date();
    return `R${now.getFullYear()-2018}.${now.getMonth()+1}`;
  };

  const copyToClipboard = (text) => {
    const copy = () => { const el=document.createElement('textarea');el.value=text;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);alert('コピーしました'); };
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>alert('コピーしました')).catch(copy);}else{copy();}
  };

  const generateKarte = async () => {
    setLoading(true);
    const prompt = `あなたは糖尿病専門クリニックの電子カルテ記載AIです。以下の患者情報をもとに、小児1型糖尿病のカルテ記載文を生成してください。

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯・）を使用する
- 小児慢性申請状況を必ず記載する
- 受診理由の直後、空行なしで＃1型糖尿病を続ける
- 各項目（・GAD抗体、・CPR等）の間は空行なし
- 【アレルギー歴】【FH】【眼科通院歴】【協力体制】【本人のスケジュール】【親のスケジュール】【注射・血糖測定の自立度】【生活情報】の間は全て空行なし
- ＃病名・＃HT・＃HLの間は空行なし。他院管理の疾患のみ1行空けてから記載する
- ＃HT・＃HLは必ず＃1型糖尿病の直後に記載し、末尾には絶対に記載しない
- アレルギー薬の記載以降は指定フォーマットのみを出力し、病名・診断名を追記しない

【患者情報JSON】
${JSON.stringify({disease:data.disease,history:data.history,body:data.body,reason:data.reason,support:data.support,chronic:data.chronic},null,2)}

【出力フォーマット（空行は一切入れないこと）】
${getCurrentMonth()}：（受診理由1〜2行）
＃1型糖尿病（タイプ）（発症時期）
＃HT（HTありの場合のみ。当院で管理なら「＃HT」、他院管理なら「＃HT（他院管理）」）
＃HL（HLありの場合のみ。当院で管理なら「＃HL」、他院管理なら「＃HL（他院管理）」）
・GAD抗体：（初診時採血）
・CPR：（初診時採血）
・甲状腺検査：（確認済/初診時採血）
・バクスミー希望：あり/なし
・小児慢性特定疾病助成制度：（申請状況）（申請ありの場合：出生体重・出生週数・出生時住民登録地・手帳取得内容）
・書類関係：（選択された書類を全て記載）（「学校生活管理指導表」が含まれる場合）□4月頃に処方
・居住地：（市町村）
---------------------------------------------
【アレルギー歴】（なしまたは内容を同じ行に）
【FH】DM(-/+、誰かも記載) 1型糖尿病(-/+、誰かも記載) 膠原病(-/+、誰が・どの病気かも記載) HT(-/+) APO(-/+) IHD(-/+)
【眼科通院歴】（通院中の場合：眼科名・網膜症の状況・緑内障の有無を記載）
【協力体制】
①家族の協力体制：（内容）
②学校の協力体制：（内容）
③学校でサポートしてくれる人：（内容）
④周囲への開示：（内容）
【本人のスケジュール】（内容）
【親のスケジュール】（内容）
【注射・血糖測定の自立度】（内容）
【生活情報】家族構成・キーパーソン：（内容）
---------------------------------------------
身長:○cm　初診時:○kg
---------------------------------------------
【事前聴取時　申し送り事項】
□甲状腺3項目・GAD抗体・CPRを初診時採血
（HTありの場合）□HTの確認のため、血圧手帳をお渡ししています。
（HLありの場合）□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。
（書類関係で「学校生活管理指導表」を選択した場合）□4月頃に処方
（CGM希望がある場合）□デバイス希望：（現在→希望の形式で記載）
（小児慢性申請済の場合）□小児慢性申請済・窓口負担を確認し算定へ連絡
（その他申し送り事項があれば記載）
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
      const res = await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,messages:[{role:"user",content:prompt}]})});
      const json = await res.json();
      const generated = json.content?.[0]?.text||"生成に失敗しました";
      setResult(generated);

      const saveRes = await fetch("/api/questionnaire",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({form_type:"小児1型糖尿病",form_data:data,age:null,generated_karte:generated})});
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
          {isNurse && (
            <div style={{...sBox({background:"#fffff0",border:"2px solid #d69e2e"}),marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:800,color:"#744210",marginBottom:10}}>👩‍⚕️ 受付時に保護者へ確認すること</div>
              <div style={{fontSize:13,color:"#744210",lineHeight:2}}>①居住地（市町村）→ 受付メモへ記載<br/>②小児慢性の申請はしているか<br/>③申請済の方：前医での支払い方法を確認し算定へ連絡</div>
            </div>
          )}
          <label style={lbl()}>受診理由</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:14}}>
            {["紹介","自主転院"].map(r=><button key={r} style={btn(d.reason.type===r)} onClick={()=>up("reason","type",r)}>{r}</button>)}
          </div>
          {d.reason.type==="紹介"&&(<div style={sBox()}>
            <label style={lbl()}>よく使う紹介元</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>
              {[
                {label:"自治医大さいたま医療センター・糖尿病内科", hosp:"自治医大さいたま医療センター", dept:"糖尿病内科"},
                {label:"自治医大さいたま医療センター・小児科", hosp:"自治医大さいたま医療センター", dept:"小児科"},
                {label:"埼玉県立小児医療センター", hosp:"埼玉県立小児医療センター", dept:"小児科"},
              ].map(({label,hosp,dept})=>{
                const selected = d.reason.referralFrom===hosp&&d.reason.referralDept===dept;
                return (
                  <button key={label} style={{...btn(selected,"#0f9668"),fontSize:13,padding:"9px 16px",border:selected?"2px solid #0f9668":"2px dashed #0f9668",background:selected?"#0f9668":"#f0fff8",color:selected?"#fff":"#0f9668"}}
                    onClick={()=>setData(p=>({...p,reason:{...p.reason,referralFrom:hosp,referralDept:dept,referralQuickSelect:true}}))}>
                    {selected?"✓ ":""}{label}
                  </button>
                );
              })}
            </div>
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <div style={{flex:2}}><label style={lbl()}>その他の病院名</label><input style={inp()} placeholder="上記以外の場合は入力" value={d.reason.referralQuickSelect?"":d.reason.referralFrom} onChange={e=>setData(p=>({...p,reason:{...p.reason,referralFrom:e.target.value,referralDept:"",referralQuickSelect:false}}))} /></div>
              <div style={{flex:1}}><label style={lbl()}>科名</label><input style={inp()} placeholder="例：小児科" value={d.reason.referralDept} onChange={e=>up("reason","referralDept",e.target.value)}/></div>
            </div>
            <label style={lbl()}>紹介の理由</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
              {["血糖コントロール管理のため","専門的管理のため","安定していたため当院へ","内容不明"].map(v=><button key={v} style={btn(d.reason.referralDetail===v)} onClick={()=>up("reason","referralDetail",v)}>{v}</button>)}
            </div>
          </div>)}
          {d.reason.type==="自主転院"&&(<div style={sBox()}>
            <label style={lbl()}>転院元 医療機関名</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
              {["自治医大さいたま医療センター","埼玉県立小児医療センター"].map(h=>(
                <button key={h} style={btn(d.reason.transferFrom===h,"#1a5fa8")} onClick={()=>up("reason","transferFrom",h)}>{h}</button>
              ))}
            </div>
            <input style={{...inp(),marginBottom:12}} placeholder="その他の場合は入力" value={["自治医大さいたま医療センター","埼玉県立小児医療センター"].includes(d.reason.transferFrom)?"":d.reason.transferFrom} onChange={e=>up("reason","transferFrom",e.target.value)}/>
            <label style={lbl()}>転院の理由</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
              {["血糖コントロール改善しないため","転居のため","より専門的な治療を希望","その他"].map(v=><button key={v} style={btn(d.reason.transferDetail===v)} onClick={()=>up("reason","transferDetail",v)}>{v}</button>)}
            </div>
          </div>)}
          <div style={{marginTop:8}}>
            <label style={lbl()}>自由記入欄（任意）</label>
            <textarea style={{...inp(),minHeight:60,resize:"vertical"}} placeholder="補足があれば記載" value={d.reason.summary} onChange={e=>up("reason","summary",e.target.value)}/>
          </div>
        </div>
      );

      case 1: return (
        <div>
          <div style={{...sBox({background:"#f0f7ff",border:"2px solid #bcd4f8"}),marginBottom:16}}>
            <span style={{fontSize:15,fontWeight:900,color:"#1a5fa8"}}>＃1型糖尿病（小児）</span>
            <div style={{marginTop:12}}>
              <label style={lbl()}>1型のタイプ</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:12}}>
                {["激症1型","急性発症","緩徐進行性（SPIDDM）","不明"].map(v=>(
                  <button key={v} style={btn(d.disease.dm1type===v)} onClick={()=>up("disease","dm1type",v)}>{v}</button>
                ))}
              </div>
              <label style={lbl()}>発症時期</label>
              <div style={{marginBottom:6}}>
                <EraYear era={d.disease.dmOnsetEra} year={d.disease.dmOnset} onEraChange={v=>up("disease","dmOnsetEra",v)} onYearChange={v=>up("disease","dmOnset",v)} disabled={d.disease.dmOnsetUnknown}/>
              </div>
              <label style={{fontSize:13,color:"#5580a8",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                <input type="checkbox" checked={d.disease.dmOnsetUnknown} onChange={e=>up("disease","dmOnsetUnknown",e.target.checked)}/> 発症時期は不明（推定）
              </label>
            </div>
          </div>
          <label style={lbl()}>インスリン使用状況</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:14}}>
            {["インスリン使用中","インスリン未使用"].map(v=>(
              <button key={v} style={btn(d.disease.insulinStatus===v,v==="インスリン使用中"?"#c53030":"#1a5fa8")} onClick={()=>up("disease","insulinStatus",v)}>{v}</button>
            ))}
          </div>
          <label style={lbl()}>バクスミー（グルカゴン）の希望</label>
          <div style={{display:"flex",gap:3,marginBottom:16}}>
            {["希望あり","希望なし"].map(v=>(
              <button key={v} style={btn(d.disease.bakusmi===v,"#e07000")} onClick={()=>up("disease","bakusmi",v)}>{v}</button>
            ))}
          </div>
          <label style={lbl()}>合併する疾患</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:14}}>
            {[["ht","高血圧（HT）"],["hl","脂質異常症（HL）"]].map(([k,l])=>(
              <button key={k} style={btn(d.disease[k])} onClick={()=>up("disease",k,!d.disease[k])}>{l}</button>
            ))}
          </div>

          <div style={{background:"#f5f5f5",border:"1.5px solid #ccc",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#666"}}>
          </div>
        </div>
      );

      case 2: return (
        <div>
          <div style={{...sBox({background:"#f0fff4",border:"1.5px solid #9ae6b4"}),marginBottom:16}}>
            <div style={{fontSize:13,color:"#276749",fontWeight:700,marginBottom:4}}>👨‍👩‍👧 サポート体制の確認</div>
            <div style={{fontSize:12,color:"#276749"}}>お子さんの糖尿病管理に関わる体制を確認します</div>
          </div>
          <label style={lbl()}>①家族の協力体制</label>
          <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>主な管理者</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:10}}>
            {["母","父","両親","祖母","祖父","その他"].map(v=>(
              <button key={v} style={btn(d.support.familyMain===v)} onClick={()=>up("support","familyMain",v)}>{v}</button>
            ))}
          </div>
          <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>サポートする家族（複数選択可）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
            {["母","父","祖母","祖父","兄弟・姉妹"].map(v=>(
              <button key={v} style={btn(d.support.familySubList.includes(v),"#2d8653")} onClick={()=>setData(p=>{const a=p.support.familySubList;return{...p,support:{...p.support,familySubList:a.includes(v)?a.filter(x=>x!==v):[...a,v]}};})}>{v}</button>
            ))}
          </div>
          <input style={{...inp(),marginBottom:14}} placeholder="補足（例：祖父母が近居でサポート）" value={d.support.familyNote} onChange={e=>up("support","familyNote",e.target.value)}/>
          <label style={lbl()}>②学校の協力体制（複数選択可）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
            {["担任が対応","養護教諭が対応","担任・養護教諭が連携","保健室で血糖測定可","給食対応あり","緊急時対応マニュアルあり"].map(v=>(
              <button key={v} style={btn(d.support.schoolStaff.includes(v),"#2b6cb0")} onClick={()=>setData(p=>{const a=p.support.schoolStaff;return{...p,support:{...p.support,schoolStaff:a.includes(v)?a.filter(x=>x!==v):[...a,v]}};})}>{v}</button>
            ))}
          </div>
          <label style={lbl()}>③学校でサポートしてくれる人（複数選択可）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
            {["担任","養護教諭","副担任","部活顧問","その他"].map(v=>(
              <button key={v} style={btn(d.support.schoolSupportPerson.includes(v),"#2b6cb0")} onClick={()=>setData(p=>{const a=p.support.schoolSupportPerson;return{...p,support:{...p.support,schoolSupportPerson:a.includes(v)?a.filter(x=>x!==v):[...a,v]}};})}>{v}</button>
            ))}
          </div>
          <input style={{...inp(),marginBottom:14}} placeholder="補足" value={d.support.schoolSupportNote} onChange={e=>up("support","schoolSupportNote",e.target.value)}/>
          <label style={lbl()}>④周囲に病気のことを話しているか</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:14}}>
            {["クラス全体に話している","一部の友人・先生のみ","先生のみ","話していない"].map(v=>(
              <button key={v} style={btn(d.support.disclosed===v)} onClick={()=>up("support","disclosed",v)}>{v}</button>
            ))}
          </div>
          <label style={lbl()}>本人のスケジュール</label>
          <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>学年</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:10}}>
            {["小1","小2","小3","小4","小5","小6","中1","中2","中3","高1","高2","高3"].map(v=>(
              <button key={v} style={{...btn(d.support.childGrade===v),padding:"6px 10px",fontSize:12}} onClick={()=>up("support","childGrade",v)}>{v}</button>
            ))}
          </div>
          <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>部活・習い事（複数選択可）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
            {["なし","運動系部活","文化系部活","スポーツ教室","音楽・芸術","学習塾","その他"].map(v=>(
              <button key={v} style={btn(d.support.childActivities.includes(v),"#553c9a")} onClick={()=>setData(p=>{const a=p.support.childActivities;return{...p,support:{...p.support,childActivities:a.includes(v)?a.filter(x=>x!==v):[...a,v]}};})}>{v}</button>
            ))}
          </div>
          <input style={{...inp(),marginBottom:14}} placeholder="補足（例：週3回サッカー教室、帰宅17時）" value={d.support.childActivityNote} onChange={e=>up("support","childActivityNote",e.target.value)}/>
          <label style={lbl()}>親のスケジュール</label>
          <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>主な保護者（母）の仕事</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
            {["専業主婦","パート（午前）","パート（午後）","フルタイム勤務","在宅ワーク","その他"].map(v=>(
              <button key={v} style={btn(d.support.parentWorkMain===v)} onClick={()=>up("support","parentWorkMain",v)}>{v}</button>
            ))}
          </div>
          <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>父の仕事</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:14}}>
            {["会社員","自営業","在宅ワーク","単身赴任中","その他"].map(v=>(
              <button key={v} style={btn(d.support.parentWorkSub===v)} onClick={()=>up("support","parentWorkSub",v)}>{v}</button>
            ))}
          </div>
          <label style={lbl()}>注射・血糖測定の自立度</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
            {["本人が自己管理","親の補助あり","ほぼ親が実施"].map(v=>(
              <button key={v} style={btn(d.support.independenceLevel===v)} onClick={()=>up("support","independenceLevel",v)}>{v}</button>
            ))}
          </div>
          <input style={inp()} placeholder="補足（例：注射は自己、血糖測定は親が確認）" value={d.support.independenceNote} onChange={e=>up("support","independenceNote",e.target.value)}/>
        </div>
      );

      case 3: return (
        <div>
          <label style={lbl()}>小児慢性特定疾病助成制度の申請状況</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:16}}>
            {["申請済","申請未","申請中"].map(v=>(
              <button key={v} style={btn(d.chronic.status===v,v==="申請済"?"#0f9668":"#1a5fa8")} onClick={()=>up("chronic","status",v)}>{v}</button>
            ))}
          </div>
          <label style={lbl()}>居住地（市町村）</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
            {["さいたま市","上尾市","桶川市","伊奈町","川越市","北本市","その他"].map(v=>(
              <button key={v} style={btn(d.chronic.residenceCity===v)} onClick={()=>up("chronic","residenceCity",v)}>{v}</button>
            ))}
          </div>
          {d.chronic.status==="申請済"&&(
            <div style={sBox({background:"#f0fff4",border:"1.5px solid #9ae6b4",marginBottom:14})}>
              <div style={{fontSize:13,fontWeight:800,color:"#276749",marginBottom:8}}>✅ 申請済の方への確認</div>
              <label style={lbl({color:"#276749"})}>前医での窓口負担の有無</label>
              <div style={{display:"flex",gap:3,marginBottom:8}}>
                {["窓口負担あり","窓口負担なし（公費）","不明"].map(v=>(
                  <button key={v} style={btn(d.chronic.paymentConfirmed===v,"#0f9668")} onClick={()=>up("chronic","paymentConfirmed",v)}>{v}</button>
                ))}
              </div>
              <div style={{fontSize:12,color:"#276749"}}>※確認後、算定へ連絡してください</div>
            </div>
          )}
          {d.chronic.status==="申請未"&&(
            <div style={{background:"#fff8f0",border:"1.5px solid #e07000",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#a05000"}}>
              ⚠️ 申請未の方には制度の説明と申請促しをお願いします
            </div>
          )}
          {(d.chronic.status==="申請未"||d.chronic.status==="申請中")&&(
            <div style={sBox({background:"#fef9f0",border:"2px solid #d69e2e"})}>
              <div style={{fontSize:13,fontWeight:800,color:"#744210",marginBottom:12}}>📋 小児慢性申請時の必須事項</div>
              <label style={lbl({color:"#744210"})}>①出生体重</label>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <input style={{...inp(),width:100}} type="number" placeholder="g" value={d.chronic.birthWeight} onChange={e=>up("chronic","birthWeight",e.target.value)}/>
                <span style={{fontSize:13,color:"#666"}}>g</span>
              </div>
              <label style={lbl({color:"#744210"})}>②出生週数</label>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                <span style={{fontSize:13,color:"#666"}}>在胎</span>
                <input style={{...inp(),width:70}} type="number" placeholder="週" value={d.chronic.birthWeek} onChange={e=>up("chronic","birthWeek",e.target.value)}/>
                <span style={{fontSize:13,color:"#666"}}>週</span>
                <input style={{...inp(),width:60}} type="number" placeholder="日" value={d.chronic.birthWeekDay} onChange={e=>up("chronic","birthWeekDay",e.target.value)}/>
                <span style={{fontSize:13,color:"#666"}}>日</span>
              </div>
              <label style={lbl({color:"#744210"})}>③出生時に住民登録をしたところ</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6}}>
                {["上尾市","さいたま市","桶川市","伊奈町","川越市","北本市","その他"].map(v=>(
                  <button key={v} style={{...btn(d.chronic.birthCity===v,"#744210"),padding:"6px 10px",fontSize:12}} onClick={()=>up("chronic","birthCity",v)}>{v}</button>
                ))}
              </div>
              {d.chronic.birthCity==="その他"&&(
                <input style={{...inp(),marginBottom:14}} placeholder="市区町村名を入力" value={d.chronic.birthCityOther||""} onChange={e=>up("chronic","birthCityOther",e.target.value)}/>
              )}
              <label style={lbl({color:"#744210"})}>手帳の取得内容</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:12}}>
                {["身体障害者手帳","養育手帳","精神障害者保健福祉手帳"].map(v=>(
                  <button key={v} style={btn(d.chronic.booklets.includes(v),"#744210")} onClick={()=>toggleArr("chronic","booklets",v)}>{v}</button>
                ))}
              </div>
            </div>
          )}
          <label style={lbl({marginTop:8})}>書類関係</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
            {["学校生活管理指導表","糖尿病緊急対応連絡票","バクスミーに関する指示書"].map(v=>(
              <button key={v} style={btn(d.chronic.documents.includes(v),"#553c9a")} onClick={()=>toggleArr("chronic","documents",v)}>{v}</button>
            ))}
          </div>
        </div>
      );

      case 4: return (
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
          {d.history.allergy==="あり"&&<input style={{...inp(),marginBottom:14}} placeholder="内容（例：ペニシリン系）" value={d.history.allergyDetail} onChange={e=>up("history","allergyDetail",e.target.value)}/>}

          <label style={lbl({marginTop:8})}>家族歴（FH）</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:8}}>
            {[["dm","糖尿病(DM)"],["dm1","1型糖尿病"],["collagen","膠原病"],["ht","高血圧(HT)"],["apo","脳卒中(APO)"],["ihd","虚血性心疾患(IHD)"]].map(([k,l])=>(
              <button key={k} style={btn(d.history.fh[k],"#6b3fa8")} onClick={()=>upN("history","fh",k,!d.history.fh[k])}>{l}</button>
            ))}
          </div>
          {d.history.fh.dm&&(
            <div style={{paddingLeft:12,borderLeft:"3px solid #6b3fa8",marginBottom:8}}>
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
          {d.history.fh.dm1&&(
            <div style={{paddingLeft:12,borderLeft:"3px solid #c53030",marginBottom:14}}>
              <label style={lbl({color:"#c53030",fontSize:11})}>1型糖尿病：誰が（複数選択可）</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                {["父","母","祖父（父方）","祖母（父方）","祖父（母方）","祖母（母方）","兄弟・姉妹"].map(v=>(
                  <button key={v} style={{...btn(d.history.fh.dm1Who.includes(v),"#c53030"),padding:"5px 10px",fontSize:12}}
                    onClick={()=>setData(p=>{const a=p.history.fh.dm1Who;return{...p,history:{...p.history,fh:{...p.history.fh,dm1Who:a.includes(v)?a.filter(x=>x!==v):[...a,v]}}};})}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
          {d.history.fh.collagen&&(
            <div style={{paddingLeft:12,borderLeft:"3px solid #c05621",marginBottom:14}}>
              <label style={lbl({color:"#c05621",fontSize:11})}>膠原病：誰が・どの病気か</label>
              {(d.history.fh.collagenItems||[{who:"",disease:""}]).map((item,i)=>(
                <div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
                  <select style={{...inp(),width:140,fontSize:12}} value={item.who}
                    onChange={e=>setData(p=>{const a=[...(p.history.fh.collagenItems||[])];a[i]={...a[i],who:e.target.value};return{...p,history:{...p.history,fh:{...p.history.fh,collagenItems:a}}};})} >
                    <option value="">誰が</option>
                    {["父","母","祖父（父方）","祖母（父方）","祖父（母方）","祖母（母方）","兄弟・姉妹"].map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                  <input style={{...inp(),flex:1,fontSize:12}} placeholder="病名（例：関節リウマチ）" value={item.disease||""}
                    onChange={e=>setData(p=>{const a=[...(p.history.fh.collagenItems||[])];a[i]={...a[i],disease:e.target.value};return{...p,history:{...p.history,fh:{...p.history.fh,collagenItems:a}}};})}/>
                  {i>0&&<button onClick={()=>setData(p=>{const a=(p.history.fh.collagenItems||[]).filter((_,j)=>j!==i);return{...p,history:{...p.history,fh:{...p.history.fh,collagenItems:a}}};})} style={{fontSize:12,color:"#e53e3e",background:"none",border:"none",cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>✕</button>}
                </div>
              ))}
              <button style={{...btn(false,"#c05621"),fontSize:12,marginTop:4}} onClick={()=>setData(p=>{const a=[...(p.history.fh.collagenItems||[]),{who:"",disease:""}];return{...p,history:{...p.history,fh:{...p.history.fh,collagenItems:a}}};})} >＋ 追加</button>
            </div>
          )}

          <label style={lbl()}>眼科通院歴</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
            {["通院中","通院していない","今後受診予定"].map(v=>(
              <button key={v} style={btn(d.history.eyeVisiting===v,v==="通院していない"?"#718096":"#1a5fa8")} onClick={()=>up("history","eyeVisiting",v)}>{v}</button>
            ))}
          </div>
          {d.history.eyeVisiting==="通院中"&&(
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6}}>
                {EYE_CLINICS.map(v=>(
                  <button key={v} style={{...btn(d.history.eye===v),padding:"6px 10px",fontSize:12}} onClick={()=>up("history","eye",v)}>{v}</button>
                ))}
              </div>
              <input style={{...inp(),marginBottom:8}} placeholder="その他の眼科名を入力"
                value={EYE_CLINICS.includes(d.history.eye)?"":d.history.eye}
                onChange={e=>up("history","eye",e.target.value)}/>
              <label style={lbl({fontSize:11})}>糖尿病網膜症の状況（分かる範囲で）</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>
                {["網膜症なし","単純性網膜症","前増殖性網膜症","増殖性網膜症"].map(v=>(
                  <button key={v} style={{...btn(d.history.retinopathy===v),padding:"6px 10px",fontSize:12}} onClick={()=>up("history","retinopathy",v)}>{v}</button>
                ))}
              </div>
              <label style={lbl({fontSize:11})}>緑内障の有無</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                {["緑内障なし","緑内障あり"].map(v=>(
                  <button key={v} style={{...btn(d.history.glaucoma===v),padding:"6px 10px",fontSize:12}} onClick={()=>up("history","glaucoma",v)}>{v}</button>
                ))}
              </div>
            </div>
          )}
          {d.history.eyeVisiting!=="通院中"&&<div style={{marginBottom:14}}/>}

          <label style={lbl()}>家族構成</label>
          <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>親の状況</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:10}}>
            {LIVING_WITH_SPOUSE.map(v=><button key={v} style={btn(d.history.livingSpouse===v)} onClick={()=>up("history","livingSpouse",v)}>{v}</button>)}
          </div>
          <label style={lbl({fontSize:11,color:"#888",marginBottom:4})}>兄弟・祖父母との同居</label>
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:8}}>
            {LIVING_OTHERS.map(v=><button key={v} style={btn(d.history.livingOther===v)} onClick={()=>up("history","livingOther",v)}>{v}</button>)}
          </div>
          <input style={{...inp(),marginBottom:14}} placeholder="補足があれば（例：祖父母が近居で協力的）" value={d.history.livingCustom} onChange={e=>up("history","livingCustom",e.target.value)}/>
          <label style={lbl()}>キーパーソン</label>
          <input style={inp()} placeholder="例：母（主な管理者）・父（夜間対応）" value={d.history.keyPerson} onChange={e=>up("history","keyPerson",e.target.value)}/>
        </div>
      );

      case 5: return (
        <div>
          <label style={lbl()}>身長・体重</label>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
            {[["height","身長","cm"],["weightNow","現在の体重","kg"]].map(([k,l,u])=>(
              <div key={k} style={{flex:"1 1 120px"}}>
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
    <div ref={topRef} style={{minHeight:"100vh",background:"linear-gradient(135deg,#e8f8ff 0%,#f0f7ff 60%,#f5fff0 100%)",fontFamily:"'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif",padding:"20px 16px"}}>
      <div style={{maxWidth:700,margin:"0 auto 18px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#3182ce,#63b3ed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏥</div>
          <div>
            <div style={{fontSize:11,color:"#3182ce",fontWeight:700,letterSpacing:"0.08em"}}>まつもと糖尿病クリニック</div>
            <div style={{fontSize:20,fontWeight:900,color:"#1a2a4a"}}>初診事前問診</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
<span style={{fontSize:12,background:"#e8f4ff",color:"#3182ce",padding:"4px 14px",borderRadius:20,fontWeight:700}}>小児1型糖尿病</span>
          </div>
        </div>

      </div>

      <div style={{maxWidth:700,margin:"0 auto"}}>
        {!done&&(<div style={{display:"flex",gap:4,marginBottom:18}}>
          {STEPS.map((s,i)=>(<div key={s.id} style={{flex:1,textAlign:"center"}}>
            <div style={{height:4,borderRadius:2,background:i<=step?"#3182ce":"#d0dff5",marginBottom:4,transition:"background 0.3s"}}/>
            <div style={{fontSize:10,color:i<=step?"#3182ce":"#b0c8e0",fontWeight:i===step?700:400}}>{s.title}</div>
          </div>))}
        </div>)}

        {!done?(
          <div style={{background:"#fff",borderRadius:16,padding:"24px 26px",boxShadow:"0 2px 20px rgba(49,130,206,0.08)"}}>
            <h2 style={{fontSize:16,fontWeight:800,color:"#1a2a4a",marginBottom:18,borderBottom:"2px solid #e8f4ff",paddingBottom:10}}>{STEPS[step].title}</h2>
            {renderStep()}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:26}}>
              <button style={{padding:"11px 22px",borderRadius:8,border:"1.5px solid #d0dff5",background:"#f7faff",color:step===0?"#c0d0e0":"#5580a8",fontWeight:700,fontSize:14,cursor:step===0?"not-allowed":"pointer"}} onClick={()=>goStep(step-1)} disabled={step===0}>← 前へ</button>
              {step<STEPS.length-1?(
                <button style={{padding:"11px 26px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#3182ce,#63b3ed)",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:"0 4px 12px rgba(49,130,206,0.3)"}} onClick={()=>goStep(step+1)}>次へ →</button>
              ):(
                <button style={{padding:"11px 26px",borderRadius:8,border:"none",background:loading?"#8ab0d4":"linear-gradient(135deg,#0f9668,#34d399)",color:"#fff",fontWeight:800,fontSize:14,cursor:loading?"not-allowed":"pointer",boxShadow:"0 4px 12px rgba(15,150,104,0.25)"}} onClick={generateKarte} disabled={loading}>{loading?"生成中...":"✨ カルテ文を生成"}</button>
              )}
            </div>
          </div>
        ):(
          <div style={{background:"#fff",borderRadius:16,padding:"24px 26px",boxShadow:"0 2px 20px rgba(49,130,206,0.08)",border:"2px solid #c6f6d5"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{width:32,height:32,borderRadius:8,background:"#0f9668",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:16}}>✓</div>
              <div>
                <div style={{fontWeight:800,color:"#0a5c40",fontSize:15}}>カルテ記載文が生成されました</div>
                <div style={{fontSize:12,color:"#5a9a80"}}>内容確認後、電子カルテにコピーしてください</div>
              </div>
            </div>
            {visitCode&&(
              <div style={{background:"linear-gradient(135deg,#3182ce,#63b3ed)",borderRadius:14,padding:"20px",marginBottom:0,textAlign:"center"}}>
                <div style={{fontSize:13,color:"#a8d4ff",marginBottom:6,fontWeight:700}}>受付番号</div>
                <div style={{fontSize:56,fontWeight:900,color:"#fff",letterSpacing:"0.2em",lineHeight:1}}>{visitCode}</div>
              </div>
            )}
            <div style={{background:"#fff8e1",border:"2px solid #f59e0b",borderRadius:12,padding:"14px 18px",marginBottom:12,textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:900,color:"#92400e"}}>📋 タブレットを受付にお返しください</div>
              <div style={{fontSize:12,color:"#b45309",marginTop:4}}>問診は完了しています。ありがとうございました。</div>
            </div>
            <div style={{background:"#f5f9f7",border:"1px solid #c0e8d8",borderRadius:10,padding:"16px 18px",whiteSpace:"pre-wrap",fontSize:13,lineHeight:2,color:"#1a3a2a",fontFamily:"monospace"}}>{result}</div>
            <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#3182ce,#63b3ed)",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"}} onClick={()=>copyToClipboard(result)}>📋 コピー</button>
              <button style={{flex:1,padding:"12px",borderRadius:8,border:"1.5px solid #3182ce",background:"#f0f7ff",color:"#3182ce",fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={()=>{setDone(false);setStep(0);setTimeout(scrollTop,50);}}>✏️ 修正する</button>
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

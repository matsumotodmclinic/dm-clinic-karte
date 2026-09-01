// 院内ハンドブック (hub、 2026-05-31)
//
// 院長指示 (2026-05-31):「dm-clinic-karte は商品化予定なしで当院のみの運用。
// 糖尿病についての知識や、 こういう場合はこう対処、 といったスタッフが
// 全て解決できる事典を完全ガイドと別ボタンで作成したい」
//
// 設計判断:
//   - 完全ガイド (/help) はアプリ操作マニュアル (患者問診ツールの使い方)
//   - 院内ハンドブック (/handbook) は 糖尿病の医学的知識 + スタッフ対応事典
//     → 患者からの質問対応、 急変時の初動、 検査値の解釈、 食事/運動指導の素材、
//       連携医療機関への紹介手順、 当院特有の運用ルール
//   - 当院特化なので「松本壮一院長」 「上尾市」 「自治医大さいたま」 等を直接書ける
//   - HelpGuide 部品 (Section / Step / Box / Table / Scenario / Trouble) を流用
//
// 育て方:
//   - 院長が頭にある知識を 1 topic ずつ Claude に話して、 ここに格納
//   - スタッフが「これ分からん」 と聞いた質問を都度 topic として追加
//   - 「準備中」 ラベルで枠だけ先に並べて、 院長と一緒に埋めていく

import Link from 'next/link'
import { useRouter } from 'next/router'

// カテゴリと topic の一覧。 ready=true が公開済み。
// 院長の頭にある知識を順次 ready=true 化していく。
const CATEGORIES = [
  {
    id: 'acute',
    title: '🚨 急性合併症 / 緊急対応',
    color: '#c62828',
    desc: '即時対応が必要な状況、 救急要請判断、 当日対応プロトコル',
    items: [
      { id: 'hypoglycemia', label: '低血糖時の対応',        ready: true,  href: '/handbook/hypoglycemia', desc: '症状 / 即時対応 (経口ブドウ糖・グルカゴン) / 重症判定 / 患者教育 / シックデイ識別' },
      { id: 'sickday',      label: 'シックデイ ルール',     ready: false, desc: '発熱・嘔吐・下痢時のインスリン / 食事 / 受診タイミング (準備中)' },
      { id: 'hhs-dka',      label: '高血糖緊急症 (HHS/DKA)', ready: false, desc: '高浸透圧高血糖症候群 / 糖尿病ケトアシドーシス の見極めと初期対応 (準備中)' },
      { id: 'foot-emergency', label: '足壊疽・蜂窩織炎',   ready: false, desc: '当日処置 / 緊急紹介先 / 抗菌薬選択 (準備中)' },
    ],
  },
  {
    id: 'chronic',
    title: '🩸 慢性合併症 フォロー',
    color: '#6a1b9a',
    desc: '三大合併症 + 動脈硬化性疾患のスクリーニング・経過観察',
    items: [
      { id: 'retinopathy',  label: '網膜症 (眼科連携)',    ready: false, desc: '眼底検査の頻度 / 連携眼科 / 糖尿病眼手帳の運用 (準備中)' },
      { id: 'nephropathy',  label: '腎症 (eGFR/UACR)',    ready: false, desc: 'CKD ステージ / 蛋白尿 / 食事制限 / 透析紹介タイミング (準備中)' },
      { id: 'neuropathy',   label: '神経障害 (しびれ・自律神経)', ready: false, desc: 'モノフィラメント / 振動覚 / 起立性低血圧 / EDS (準備中)' },
      { id: 'macroangio',   label: '動脈硬化 (頸動脈・冠動脈・脳)', ready: false, desc: '頸動脈エコー / 心電図 / 連携循環器・脳神経内科 (準備中)' },
      { id: 'foot-care',    label: 'フットケア',          ready: false, desc: '日常観察 / 爪切り / 装具 / 重症化予防 (準備中)' },
    ],
  },
  {
    id: 'lab',
    title: '🔬 検査値の見方',
    color: '#00838f',
    desc: 'HbA1c / 血糖 / 腎機能 / 脂質 / その他 の解釈と次の手',
    items: [
      { id: 'hba1c',     label: 'HbA1c の解釈',        ready: false, desc: '6.5% 境界 / 7.0% 目標 / 8.0% 以上の対応 / 急変動 (貧血等) の解釈 (準備中)' },
      { id: 'glucose',   label: '血糖 (空腹時・食後・OGTT)', ready: false, desc: 'IFG / IGT / DM 確定 / 妊娠時の特殊基準 (準備中)' },
      { id: 'kidney',    label: '腎機能 (eGFR / Cr / UACR)', ready: false, desc: 'CKD ステージ / 急速悪化の判断 / 造影 CT 前評価 (準備中)' },
      { id: 'lipids',    label: '脂質 (LDL/HDL/TG)',  ready: false, desc: 'スタチン適応 / 二次予防目標 / TG 高値時の対応 (準備中)' },
      { id: 'cgm',       label: 'CGM データの読み方', ready: false, desc: 'TIR / GMI / 変動係数 / 夜間低血糖の検出 (準備中)' },
    ],
  },
  {
    id: 'meds',
    title: '💊 薬剤・インスリン',
    color: '#1565c0',
    desc: '当院でよく使う薬剤の使い分け、 注射手技、 自己管理指導',
    items: [
      { id: 'oha',          label: '経口糖尿病薬の使い分け', ready: false, desc: 'BG / DPP-4 / SGLT2 / SU / α-GI / GLP-1 経口 (準備中)' },
      { id: 'glp1',         label: 'GLP-1 受容体作動薬',    ready: false, desc: '注射 vs 経口 / 副作用 / 嘔気対策 (準備中)' },
      { id: 'insulin-type', label: 'インスリン製剤の種類',  ready: false, desc: '超速効 / 持効型 / 混合型 / Basal-Bolus / 1 型と 2 型の使い分け (準備中)' },
      { id: 'self-injection', label: '自己注射 手技指導',  ready: false, desc: '部位 / 角度 / 針交換 / 廃棄 / 旅行時 (準備中)' },
      { id: 'cgm-csii',     label: 'CGM / CSII 機器',       ready: false, desc: 'リブレ / G7 / オムニポッド / Tandem 等の機種別 (準備中)' },
    ],
  },
  {
    id: 'lifestyle',
    title: '🥗 食事・運動・生活指導',
    color: '#2e7d32',
    desc: '患者教育の素材、 よく聞かれる質問の回答集',
    items: [
      { id: 'diet-basic',  label: '食事療法 基礎',        ready: false, desc: 'カロリー設定 / 糖質量 / バランス / 主食量目安 (準備中)' },
      { id: 'carb-count',  label: 'カーボカウント',       ready: false, desc: '基礎 / 応用 / インスリン:カーボ比 (1 型主体) (準備中)' },
      { id: 'lowcarb',     label: 'ロカボ食 (緩やか糖質制限)', ready: false, desc: '当院での推奨範囲 / 注意点 / よくある誤解 (準備中)' },
      { id: 'exercise',    label: '運動療法',             ready: false, desc: '頻度 / 強度 / 高血糖時の禁忌 / 低血糖予防 (準備中)' },
      { id: 'alcohol',     label: 'アルコール の扱い',    ready: false, desc: '上限量 / 低血糖リスク / 薬剤との相互作用 (準備中)' },
    ],
  },
  {
    id: 'patient-education',
    title: '🗣️ 患者教育・説明素材',
    color: '#e65100',
    desc: '初診時 / 教育入院 / 通院フォロー で使うトーク内容',
    items: [
      { id: 'first-visit',     label: '初診時の説明テンプレ',  ready: false, desc: '診断の伝え方 / 食事・運動の初期指導 / 受診頻度 (準備中)' },
      { id: 'pregnancy',       label: '妊娠と糖尿病',          ready: false, desc: 'GDM / 妊娠前管理 / 連携産科 (準備中)' },
      { id: 'pediatric',       label: '小児・思春期 糖尿病',  ready: false, desc: '1 型主体 / 親への説明 / 学校連携 (準備中)' },
      { id: 'elderly',         label: '高齢者 糖尿病',        ready: false, desc: '緩めの HbA1c 目標 / 低血糖回避 / フレイル評価 (準備中)' },
      { id: 'mental',          label: 'メンタル面のケア',     ready: false, desc: 'うつ合併 / 自己受容 / 摂食障害 (準備中)' },
    ],
  },
  {
    id: 'partner',
    title: '🏥 連携医療機関 / 紹介',
    color: '#5d4037',
    desc: '上尾市内・周辺の連携先、 紹介状の書き方',
    items: [
      { id: 'partner-list',    label: '主要連携先 一覧',      ready: false, desc: '自治医大さいたま / 上尾中央総合病院 / さいたま赤十字 + 周辺クリニック (準備中)' },
      { id: 'referral-letter', label: '紹介状の書き方',       ready: false, desc: '緊急 / 定期 / 専門依頼 のテンプレート (準備中)' },
      { id: 'eye-clinic',      label: '眼科連携',             ready: false, desc: '眼底検査依頼 / 網膜症で要レーザー時 (準備中)' },
      { id: 'dialysis-prep',   label: '透析導入 連携',        ready: false, desc: '腎不全進行時のシャント造設 / 透析クリニック紹介 (準備中)' },
    ],
  },
  {
    id: 'ops',
    title: '🏛️ 当院運用ルール',
    color: '#37474f',
    desc: 'スタッフ業務手順、 物品場所、 院内ルール',
    items: [
      { id: 'reception',     label: '受付・予約運用',        ready: false, desc: '新患受け入れ / 予約変更 / キャンセル / 当日初診 (準備中)' },
      { id: 'blood-draw',    label: '採血の流れ',            ready: false, desc: '事前採血 / 全例 HbA1c / 検体送付先 (準備中)' },
      { id: 'cgm-setup',     label: 'CGM 装着の流れ',        ready: false, desc: 'リブレ / G7 装着手順 / 患者への説明 (準備中)' },
      { id: 'medical-cert',  label: '診断書・各種証明書',    ready: false, desc: '医療費控除 / 障害年金 / 生命保険 / 健康診断 (準備中)' },
      { id: 'after-hours',   label: '時間外問い合わせ対応', ready: false, desc: '電話対応の判断基準 / 救急判定 (準備中)' },
    ],
  },
  {
    id: 'faq',
    title: '❓ よくある質問 (Quick Answer)',
    color: '#795548',
    desc: 'スタッフが患者から聞かれることが多い質問の即答集',
    items: [
      { id: 'faq-general', label: '糖尿病一般 (患者向け)',   ready: false, desc: '「糖尿病って治るの?」「インスリン打ったら一生?」 等 (準備中)' },
      { id: 'faq-meds',    label: '薬の飲み方 (患者向け)',    ready: false, desc: '「飲み忘れたら?」「食事抜いたら?」「旅行時は?」 等 (準備中)' },
      { id: 'faq-cost',    label: '医療費・保険',            ready: false, desc: '高額療養費 / 限度額認定 / 自立支援医療 (準備中)' },
      { id: 'faq-driving', label: '運転・仕事',              ready: false, desc: '低血糖と運転 / 高所作業 / 夜勤 / シフト勤務 (準備中)' },
    ],
  },
]

export default function HandbookIndex() {
  const router = useRouter()
  const readyCount = CATEGORIES.reduce((sum, c) => sum + c.items.filter((i) => i.ready).length, 0)
  const totalCount = CATEGORIES.reduce((sum, c) => sum + c.items.length, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>
        {/* 戻る */}
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={() => router.push('/')}
            style={{ padding: '6px 12px', borderRadius: 6, background: '#fff', border: '1px solid #cfd8dc', color: '#37474f', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >← トップ</button>
        </div>

        {/* ヘッダ */}
        <nav style={{ background: '#2e7d32', color: '#fff', padding: '14px 18px', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 19, fontWeight: 700 }}>📚 まつもと糖尿病クリニック 院内ハンドブック</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4, lineHeight: 1.6 }}>
            糖尿病の医学的知識 + スタッフ対応事典。 患者対応で困った時、 急変時の初動、 検査値の解釈、
            連携医療機関への紹介手順まで、 <strong>スタッフがここを見れば解決できる</strong> ことを目指して
            院長の臨床知識を順次まとめます。
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 6 }}>
            公開済み: <strong>{readyCount}</strong> / {totalCount} topic — 残りは順次拡充予定 (院長と一緒に育てるノート)
          </div>
        </nav>

        {/* 重要 callout */}
        <div style={{ background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#5d4037', lineHeight: 1.7 }}>
          <strong>⚠️ ハンドブックの位置づけ</strong>: 一次対応の道しるべです。 確定診断・治療決定は必ず医師が行います。
          急変・重症が疑われる場合は <strong>即座に院長 (松本壮一) を呼ぶ・救急要請</strong> を優先してください。
          記載内容は当院の運用方針に基づき、 教科書的なガイドラインと異なる箇所があります (院長判断)。
        </div>

        {/* カテゴリ × topic 一覧 */}
        {CATEGORIES.map((cat) => (
          <section key={cat.id} style={{ background: '#fff', borderRadius: 12, padding: 18, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: cat.color, marginBottom: 4, paddingBottom: 6, borderBottom: `1px solid ${cat.color}33` }}>
              {cat.title}
            </h2>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 10, lineHeight: 1.6 }}>{cat.desc}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {cat.items.map((it) => {
                const body = (
                  <div style={{
                    padding: 14, borderRadius: 8,
                    border: `1px solid ${it.ready ? cat.color + '66' : '#e0e0e0'}`,
                    background: it.ready ? '#fff' : '#fafafa',
                    opacity: it.ready ? 1 : 0.6,
                    cursor: it.ready ? 'pointer' : 'not-allowed',
                    height: '100%',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, color: it.ready ? cat.color : '#888', fontSize: 14 }}>{it.label}</div>
                      {it.ready
                        ? <span style={{ marginLeft: 'auto', fontSize: 10, background: '#e8f5e9', color: '#1b5e20', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>公開中</span>
                        : <span style={{ marginLeft: 'auto', fontSize: 10, background: '#f5f5f5', color: '#888', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>準備中</span>
                      }
                    </div>
                    <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>{it.desc}</div>
                  </div>
                )
                if (it.ready && it.href) {
                  return (
                    <Link key={it.id} href={it.href} legacyBehavior>
                      <a style={{ textDecoration: 'none' }}>{body}</a>
                    </Link>
                  )
                }
                return <div key={it.id}>{body}</div>
              })}
            </div>
          </section>
        ))}

        {/* 育て方 footer */}
        <div style={{ background: '#e8f5e9', borderRadius: 12, padding: 16, marginTop: 18, fontSize: 13, color: '#1b5e20', lineHeight: 1.8 }}>
          <strong>🌱 このハンドブックの育て方</strong><br />
          • 「準備中」 topic を院長 (松本壮一) と相談しながら 1 つずつ書いていきます<br />
          • スタッフが患者から聞かれて困った質問は、 そのまま topic 候補としてストック (院長に伝えてください)<br />
          • 院長が普段スタッフに口頭で伝えている知識は、 ここに集約して「次のスタッフ」 が読むだけで分かるように<br />
          • 完全ガイド (アプリの使い方) は <Link href="/help" legacyBehavior><a style={{ color: '#1565c0', textDecoration: 'underline' }}>/help</a></Link> 側 (役割分担)
        </div>
      </div>
    </div>
  )
}

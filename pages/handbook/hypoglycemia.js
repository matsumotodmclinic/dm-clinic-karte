// 院内ハンドブック: 低血糖時の対応 (2026-05-31 初版、 院長確認・加筆前のドラフト)
//
// 院長指示 (2026-05-31):「こういう場合はこのように対処する、 をスタッフがすべて解決できるように」
// → 当院運用に直結する topic のサンプル第 1 号として作成。
//
// 注意 (重要):
//   - 本ドラフトは <strong>院長確認前</strong>。 医学的内容は教科書ベース + 一般的当院運用想定で書いた。
//   - 院長が読んで「ここは違う」 「もっとこう書け」 を直接 edit してもらう前提。
//   - 当院ローカルルール (院長 / グルカゴン保管場所 / 救急搬送先 / 連絡基準) は 仮の値で書いた箇所を
//     <code>{`{{TBD}}`}</code> マーカーで残しています。 院長確認時に確定値で置換。
//
// HelpGuide 部品流用: GuideHeader / Toc / Section / Step / Box / Table / Scenario / Trouble / GuideFooter

import {
  GuideHeader, Toc, Section, Subh, Box, Code, Table, Tr, Td, Step, Scenario, Trouble, GuideFooter,
} from '../../components/HelpGuide'
import Link from 'next/link'
import { useRouter } from 'next/router'

const THEME = '#c62828'  // 赤系 (緊急対応カテゴリ「🚨 急性合併症」 と統一)

const TOC = [
  { id: 'overview',  icon: '🗺️', title: '低血糖の全体像 (判定 → 即時対応 → 再発予防)' },
  { id: 'criteria',  icon: '📏', title: '低血糖の定義 と 重症度判定 (血糖値・症状)' },
  { id: 'symptoms',  icon: '🩺', title: '症状の見分け方 (交感神経症状 / 中枢神経症状)' },
  { id: 'response',  icon: '🆘', title: '即時対応 5 分以内 フローチャート' },
  { id: 'mild',      icon: '🍬', title: '軽症 (意識清明・経口摂取可) の対応' },
  { id: 'severe',    icon: '💉', title: '重症 (意識障害・経口不可) の対応 (グルカゴン IM・救急要請)' },
  { id: 'on-site',   icon: '🏥', title: '当院での具体的物品と保管場所' },
  { id: 'contact',   icon: '📞', title: '院長・医師への連絡判断と救急搬送' },
  { id: 'after',     icon: '🔍', title: '対応後 30 分 のフォロー (再発・遷延の見極め)' },
  { id: 'education', icon: '🎓', title: '患者教育 (再発予防・家族指導)' },
  { id: 'sickday',   icon: '🤒', title: 'シックデイ との識別と注意点' },
  { id: 'scenarios', icon: '💡', title: 'シナリオ別 対応集' },
  { id: 'troubles',  icon: '🩹', title: 'トラブルシューティング' },
  { id: 'references',icon: '📚', title: '参考資料・院内文書' },
]

export default function HypoglycemiaPage() {
  const router = useRouter()
  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
        {/* 戻る */}
        <div style={{ marginBottom: 10 }}>
          <Link href="/handbook" legacyBehavior>
            <a style={{
              display: 'inline-block', padding: '6px 12px', borderRadius: 6,
              background: '#fff', border: '1px solid #cfd8dc', color: '#37474f',
              textDecoration: 'none', fontSize: 13, fontWeight: 600,
            }}>← 院内ハンドブック</a>
          </Link>
        </div>

        <GuideHeader
          icon="🆘"
          title="低血糖時の対応 (院内ハンドブック)"
          subtitle="当院で最も頻度の高い急性イベント。 経口摂取可否で対応が分岐します。 5 分以内の初動で予後が大きく変わります。 院長確認前のドラフト ― 内容は院長と一緒に確定していきます。"
          themeColor={THEME}
        />

        {/* 重要 callout (最上段に固定) */}
        <Box color="danger">
          <strong>🚨 迷ったら経口ブドウ糖 → 反応なければ救急要請</strong>。
          意識障害・痙攣・経口不可なら <strong>即グルカゴン IM + 救急要請 (119)</strong> + 院長コール。
          「低血糖かもしれない」 段階で躊躇せず患者に糖質を渡してください
          (血糖値が高くても 5〜10 g の糖質摂取で悪化することはありません)。
        </Box>

        <Toc items={TOC} themeColor={THEME} />

        {/* ========== 全体像 ========== */}
        <Section id="overview" icon="🗺️" title="低血糖の全体像 (判定 → 即時対応 → 再発予防)" themeColor={THEME}>
          <Step n={1} title="気づく (患者/家族からの訴え or スタッフが視認)" themeColor={THEME}>
            「気分が悪い」 「冷や汗」 「ふらつく」 「会話がおかしい」 等の訴え、
            または受付・待合で異常を視認したら <strong>低血糖を疑う</strong>。 糖尿病患者でなくても
            高齢者・絶食時・SU 薬服用中・インスリン使用中はリスク高。
          </Step>

          <Step n={2} title="判定 (5 秒で判断、 完璧な検査は不要)" themeColor={THEME}>
            意識清明か → 経口摂取可能か。 可能なら <strong>軽症対応</strong>、 不可なら <strong>重症対応</strong>。
            可能なら同時に血糖測定 (SMBG)、 ただし測定で時間を失うより先に糖質を渡す。
          </Step>

          <Step n={3} title="即時対応 (15-15 ルール)" themeColor={THEME}>
            <strong>軽症</strong>: ブドウ糖 10〜15 g 経口 → 15 分後 再測定 → 改善なければ再投与。<br />
            <strong>重症</strong>: <strong>グルカゴン 1 mg IM/SC</strong> + 救急要請 + 院長コール。
            点滴ルート確保できれば 50% ブドウ糖 20-40 mL IV。
          </Step>

          <Step n={4} title="フォロー (30 分〜数時間)" themeColor={THEME}>
            軽症でも <strong>血糖は再下降する</strong> ことがあるので 30 分は観察。
            特に SU 薬 (長時間作用) / 持効型インスリン による低血糖は <strong>数時間遷延</strong> する。
            食事を促す or ブドウ糖追加摂取。
          </Step>

          <Step n={5} title="原因究明 と 再発予防" themeColor={THEME}>
            食事の遅れ / 薬の飲み過ぎ / 運動量増加 / アルコール / 薬剤調整ミス / シックデイ など。
            医師と相談して次回処方調整・患者指導。
          </Step>
        </Section>

        {/* ========== 定義 ========== */}
        <Section id="criteria" icon="📏" title="低血糖の定義 と 重症度判定" themeColor={THEME}>
          <Subh>血糖値による定義 (ADA / IHSG 2017 合意)</Subh>
          <Table headers={['Level', '血糖値', '臨床的意味']} themeColor={THEME}>
            <Tr><Td>Level 1 (警戒値)</Td><Td><strong>&lt; 70 mg/dL</strong></Td><Td>糖質補給が必要。 まだ症状が無くても介入</Td></Tr>
            <Tr highlight><Td>Level 2 (臨床的に重要)</Td><Td><strong>&lt; 54 mg/dL</strong></Td><Td>中枢神経症状が出始める閾値、 即時介入</Td></Tr>
            <Tr><Td>Level 3 (重症)</Td><Td>値に関係なく <strong>意識障害・他者介助必要</strong></Td><Td>グルカゴン適応、 救急要請</Td></Tr>
          </Table>

          <Box color="info">
            <strong>SMBG (簡易血糖測定器)</strong> での測定は判定の助けですが、 測定に時間がかかるなら
            <strong>先に糖質を渡す</strong>。 患者の「いつもの低血糖症状」 と一致するなら値が 70 以上でも対応 OK
            (相対的低血糖)。
          </Box>

          <Subh>無自覚性低血糖 に注意</Subh>
          <p>
            長期糖尿病患者 / 厳格管理患者 / β 遮断薬服用中 / 高齢者 / 自律神経障害合併者 は
            <strong>交感神経症状をスキップして中枢神経症状から発症</strong> することがある。
            この場合いきなり意識障害になるので、 普段から低めの血糖を回避する処方調整が必要。
          </p>
        </Section>

        {/* ========== 症状 ========== */}
        <Section id="symptoms" icon="🩺" title="症状の見分け方 (交感神経 / 中枢神経)" themeColor={THEME}>
          <Table headers={['区分', '血糖目安', '症状', '対応緊急度']} themeColor={THEME}>
            <Tr>
              <Td>交感神経症状 (警告症状)</Td>
              <Td>70 → 54 mg/dL</Td>
              <Td>冷や汗 / 動悸 / 振戦 (手のふるえ) / 不安感 / 空腹感 / 顔面蒼白 / 頻脈</Td>
              <Td>軽症対応で OK</Td>
            </Tr>
            <Tr highlight>
              <Td>中枢神経症状</Td>
              <Td>&lt; 54 mg/dL</Td>
              <Td>頭痛 / めまい / 集中力低下 / 視野異常 / 会話困難 / 異常行動 / 眠気</Td>
              <Td>即介入、 進行注視</Td>
            </Tr>
            <Tr>
              <Td>重症</Td>
              <Td>&lt; 30 mg/dL or 個体差</Td>
              <Td>意識消失 / 痙攣 / 昏睡 / 自分で対処できない</Td>
              <Td>グルカゴン + 救急要請</Td>
            </Tr>
          </Table>

          <Box color="warning">
            <strong>異常行動 (酔っぱらいのような言動)</strong> は低血糖の典型サインです。 「お酒飲んでないのに何だかおかしい」
            「機嫌が悪い」 「同じことを繰り返す」 は中枢神経症状を疑い、 真っ先に血糖を測る。
          </Box>
        </Section>

        {/* ========== 即時対応フロー ========== */}
        <Section id="response" icon="🆘" title="即時対応 5 分以内 フローチャート" themeColor={THEME}>
          <Box color="danger">
            <strong>判断フローは 1 つだけ</strong>: 「<strong>意識清明 + 経口摂取可能</strong>」 か否か。
          </Box>

          <Subh>① 意識清明 + 経口摂取可 → 軽症対応へ</Subh>
          <ul>
            <li>ブドウ糖 10-15 g (ブドウ糖 タブレット 3-5 個、 ジュース 150-200 mL、 砂糖大さじ 1)</li>
            <li>15 分待って再測定 / 症状確認 → 改善なければ再投与</li>
            <li>改善後、 食事 or 補食 (おにぎり等) を促す</li>
          </ul>

          <Subh>② 意識障害 / 経口不可 → 重症対応へ</Subh>
          <ul>
            <li><strong>仰臥位・回復体位</strong> (誤嚥防止)</li>
            <li><strong>グルカゴン 1 mg IM/SC</strong> (院内常備の場所要確認)</li>
            <li><strong>救急要請 119</strong> + 院長コール</li>
            <li>点滴ルート確保できれば <strong>50% ブドウ糖 20-40 mL IV</strong></li>
            <li>気道確保・バイタル確認</li>
          </ul>

          <Subh>③ 判定迷う時 (中間グレー)</Subh>
          <ul>
            <li>会話できるが眠そう・反応鈍い → <strong>経口は危険、 まずグルカゴン候補</strong></li>
            <li>嚥下機能に不安あり → グルカゴン</li>
            <li>「とりあえずジュース」 → 飲ませようとして誤嚥は最悪</li>
          </ul>
        </Section>

        {/* ========== 軽症対応 ========== */}
        <Section id="mild" icon="🍬" title="軽症 (意識清明・経口摂取可) の対応" themeColor={THEME}>
          <Subh>15-15 ルール (国際標準)</Subh>
          <Step n={1} title="ブドウ糖 10〜15 g を経口" themeColor={THEME}>
            <strong>ブドウ糖</strong> が最速 (5 分以内で血糖上昇)。 ショ糖・果糖は分解時間がかかる。
            <Code>α-GI 服用中の患者</Code> は <strong>ブドウ糖でないと吸収されない</strong> ので必須。
          </Step>
          <Step n={2} title="15 分待つ" themeColor={THEME}>
            この間 患者を座らせて観察。 立たせない (起立性低血圧で転倒リスク)。
          </Step>
          <Step n={3} title="血糖再測定 / 症状確認" themeColor={THEME}>
            70 mg/dL 以上 + 症状改善 → 食事 or 補食 (炭水化物 15-20 g) で持続的に維持。<br />
            70 未満 or 症状残存 → <strong>もう一度ブドウ糖 10-15 g</strong> → 15 分待つ。
          </Step>
          <Step n={4} title="3 回繰り返しても改善せず → 重症扱い" themeColor={THEME}>
            グルカゴン適応 / 救急要請 / 院長コール。 SU 薬・持効型インスリンによる低血糖は遷延しやすい。
          </Step>

          <Subh>軽症対応に使える糖質 (院内・外来・売店)</Subh>
          <Table headers={['食品', '糖質量', '備考']} themeColor={THEME}>
            <Tr><Td>ブドウ糖タブレット (3-5 錠)</Td><Td>10-15 g</Td><Td>第一選択。 α-GI 服用中も OK</Td></Tr>
            <Tr><Td>砂糖 (大さじ 1)</Td><Td>9 g</Td><Td>α-GI 服用中は効果半減</Td></Tr>
            <Tr><Td>ジュース (果汁 100%、 150 mL)</Td><Td>15-20 g</Td><Td>果汁系は OK、 ダイエット系は NG (糖質ゼロ)</Td></Tr>
            <Tr><Td>缶コーヒー (砂糖入り、 185 mL)</Td><Td>10-15 g</Td><Td>普通の缶コーヒー</Td></Tr>
            <Tr><Td>飴 (キャンディ 2-3 個)</Td><Td>10-15 g</Td><Td>溶けるまで時間かかる、 第二選択</Td></Tr>
            <Tr><Td>チョコレート</Td><Td>脂質多い</Td><Td>吸収遅い、 低血糖対応には不適</Td></Tr>
          </Table>
        </Section>

        {/* ========== 重症対応 ========== */}
        <Section id="severe" icon="💉" title="重症 (意識障害・経口不可) の対応" themeColor={THEME}>
          <Box color="danger">
            <strong>意識消失 / 経口不可 / 痙攣</strong> のいずれかが見られたら <strong>軽症対応はスキップ</strong>。
            無理に飲ませると誤嚥性肺炎・窒息のリスク。
          </Box>

          <Step n={1} title="安全確保 (回復体位)" themeColor={THEME}>
            横向きにして気道確保。 周囲のスタッフを呼び集める (1 人で対応しない)。
          </Step>

          <Step n={2} title="グルカゴン 1 mg IM (筋注) または SC (皮下注)" themeColor={THEME}>
            院内常備のグルカゴン (バイアル) を 1 mg 筋注。 大腿外側 or 三角筋。<br />
            <strong>院内保管場所</strong>: {`{{TBD: 院長確認、 例: 処置室の薬品棚 上段、 救急カート内 等}}`}<br />
            <strong>使用後</strong>: 5-15 分で意識回復が期待される。 嘔吐リスクあるので回復後も横向き維持。
          </Step>

          <Step n={3} title="救急要請 119" themeColor={THEME}>
            搬送先候補 (当院連携): <strong>{`{{TBD: 第一搬送先、 例: 上尾中央総合病院 救命救急}}`}</strong>。<br />
            状況伝達: 「糖尿病患者の低血糖性昏睡、 グルカゴン投与済み、 搬送希望」。
          </Step>

          <Step n={4} title="院長 (松本壮一) コール" themeColor={THEME}>
            院内なら直接、 院外なら携帯。 <strong>連絡基準</strong>:
            {`{{TBD: 例「重症低血糖が発生したら必ず即時連絡」「軽症で繰り返しなら次回診察で報告」}}`}
          </Step>

          <Step n={5} title="ルート確保 + 50% ブドウ糖 20-40 mL IV (可能なら)" themeColor={THEME}>
            グルカゴン無効時 (肝糖原欠乏患者では効きにくい) や 救急隊到着前の補助。
            アルコール性低血糖・絶食状態ではグルカゴンより IV ブドウ糖が確実。
          </Step>

          <Subh>グルカゴン の効きにくいケース</Subh>
          <ul>
            <li><strong>肝糖原欠乏</strong>: 長期絶食、 アルコール多飲、 慢性肝疾患、 副腎不全</li>
            <li><strong>SU 薬・インスリン由来</strong>: 一過性に上がっても再下降しやすい (要遷延フォロー)</li>
            <li>→ いずれも <strong>IV ブドウ糖 + 持続点滴 (10% ブドウ糖)</strong> + 入院検討</li>
          </ul>
        </Section>

        {/* ========== 院内物品 ========== */}
        <Section id="on-site" icon="🏥" title="当院での具体的物品と保管場所" themeColor={THEME}>
          <Box color="warning">
            <strong>⚠️ 以下は院長確認待ちのドラフトです</strong>。 実際の保管場所・在庫数は院長 (松本壮一) と
            一緒に確定してください。 ハンドブック更新時はここを優先的に書き換えます。
          </Box>

          <Table headers={['物品', '保管場所 (TBD)', '在庫目安 (TBD)', '使用後の補充']} themeColor={THEME}>
            <Tr><Td>グルカゴン 1 mg バイアル</Td><Td>{`{{処置室 薬品棚 上段 / 救急カート}}`}</Td><Td>{`{{2 セット常備}}`}</Td><Td>使用後即発注 (期限 約 2 年)</Td></Tr>
            <Tr><Td>50% ブドウ糖注 20 mL</Td><Td>{`{{救急カート / 注射薬棚}}`}</Td><Td>{`{{5 A 常備}}`}</Td><Td>使用後翌日補充</Td></Tr>
            <Tr><Td>ブドウ糖タブレット</Td><Td>{`{{受付横 + 待合 + 診察室}}`}</Td><Td>{`{{各 1 箱}}`}</Td><Td>残り 30% で発注</Td></Tr>
            <Tr><Td>果汁 100% ジュース</Td><Td>{`{{冷蔵庫}}`}</Td><Td>{`{{常時 5 本}}`}</Td><Td>使用後翌日補充</Td></Tr>
            <Tr><Td>SMBG 機器 + 試験紙</Td><Td>{`{{看護師ステーション}}`}</Td><Td>{`{{2 台}}`}</Td><Td>試験紙は月初確認</Td></Tr>
            <Tr><Td>静脈ルート ・点滴セット</Td><Td>{`{{処置室}}`}</Td><Td>常備</Td><Td>常時補充</Td></Tr>
          </Table>

          <Box color="info">
            <strong>患者持参のグルカゴン</strong> (バクスミー鼻スプレー、 グルカゴン皮下注 自己注射セット) は
            家族 / 同行者が使う想定。 当院では原則 <strong>院内常備のバイアル製剤</strong> を使用。
          </Box>
        </Section>

        {/* ========== 連絡 ========== */}
        <Section id="contact" icon="📞" title="院長・医師への連絡判断と救急搬送" themeColor={THEME}>
          <Subh>院長 (松本壮一) への連絡基準 (TBD)</Subh>
          <Table headers={['状況', '連絡', 'タイミング']} themeColor={THEME}>
            <Tr><Td>重症低血糖 (意識障害 / 痙攣)</Td><Td>必ず即時</Td><Td>グルカゴン投与と同時並行</Td></Tr>
            <Tr><Td>軽症だが 15-15 ルール 3 回繰返し</Td><Td>即時</Td><Td>2 回目失敗時点で連絡</Td></Tr>
            <Tr><Td>軽症だが連日 (3 日連続以上)</Td><Td>当日中</Td><Td>処方調整の判断材料</Td></Tr>
            <Tr><Td>軽症で 1 回完結</Td><Td>次回診察で報告 + 記録</Td><Td>急ぐ必要なし</Td></Tr>
          </Table>

          <Subh>救急搬送先 (TBD、 院長確認待ち)</Subh>
          <ul>
            <li><strong>第一搬送先</strong>: {`{{上尾中央総合病院 救命救急 03-XXXX-XXXX}}`}</li>
            <li><strong>第二搬送先</strong>: {`{{自治医大さいたま医療センター 救急 048-XXX-XXXX}}`}</li>
            <li><strong>第三搬送先</strong>: {`{{さいたま赤十字病院 救急 048-XXX-XXXX}}`}</li>
            <li>119 通報時は「糖尿病性低血糖性昏睡、 グルカゴン投与済」 を伝える</li>
          </ul>
        </Section>

        {/* ========== 対応後フォロー ========== */}
        <Section id="after" icon="🔍" title="対応後 30 分 のフォロー (再発・遷延の見極め)" themeColor={THEME}>
          <Subh>軽症対応後のチェックポイント</Subh>
          <ul>
            <li><strong>15 分後</strong>: 血糖 70 mg/dL 以上 + 症状改善 を確認</li>
            <li><strong>30 分後</strong>: 食事 or 補食済み、 症状なし、 自宅に帰すか診察継続か判断</li>
            <li><strong>1 時間後</strong> (帰宅前再測定): 安定していること</li>
          </ul>

          <Subh>遷延リスクが高いケース</Subh>
          <Table headers={['原因', '遷延時間目安', '対応']} themeColor={THEME}>
            <Tr><Td>SU 薬 (グリベンクラミド・グリメピリド)</Td><Td>12-24 時間以上</Td><Td>入院 + 持続ブドウ糖点滴</Td></Tr>
            <Tr><Td>持効型インスリン (ランタス / トレシーバ)</Td><Td>12-24 時間</Td><Td>入院検討</Td></Tr>
            <Tr><Td>中間型インスリン (NPH)</Td><Td>6-12 時間</Td><Td>外来観察 + 食事繰返し</Td></Tr>
            <Tr><Td>速効・超速効型インスリン</Td><Td>2-4 時間</Td><Td>外来 30 分観察で OK</Td></Tr>
            <Tr><Td>アルコール性</Td><Td>数時間〜半日</Td><Td>入院 + 持続点滴</Td></Tr>
            <Tr><Td>BG / DPP-4 / GLP-1 / SGLT2 単独</Td><Td>原則なし</Td><Td>他薬剤・誘因を疑う</Td></Tr>
          </Table>

          <Box color="warning">
            <strong>帰宅判断の基準</strong>: ① 意識清明 ② 血糖 100 mg/dL 以上で安定 ③ 食事摂取済み
            ④ 家族・同行者あり ⑤ 遷延リスク薬剤を使っていない。 ひとつでも欠ければ <strong>外来観察 or 紹介入院</strong>。
          </Box>
        </Section>

        {/* ========== 患者教育 ========== */}
        <Section id="education" icon="🎓" title="患者教育 (再発予防・家族指導)" themeColor={THEME}>
          <Subh>患者に必ず伝える 5 つ</Subh>
          <ol>
            <li><strong>低血糖症状リスト</strong> を渡す (冷や汗・動悸・空腹感・頭痛・集中力低下)</li>
            <li><strong>ブドウ糖タブレット / ブドウ糖含有飲料を常携</strong> (鞄・車・職場・寝室)</li>
            <li><strong>低血糖手帳</strong> に発生日時・状況・血糖値・対応を記録 → 次回診察で持参</li>
            <li><strong>家族・職場に「グルカゴン」 の使い方</strong> を共有 (重症時の救命) (TBD: 院長判断で家族指導の範囲)</li>
            <li><strong>運転前は必ず血糖測定</strong>、 70 mg/dL 未満なら運転禁止 (道交法上の責任にも関わる)</li>
          </ol>

          <Subh>受診を促す状況</Subh>
          <ul>
            <li>同じ時間帯で繰り返す → 薬剤調整の余地</li>
            <li>夜間 / 早朝の低血糖 → 持効型インスリン量見直し</li>
            <li>食事時刻と関係なく発生 → SU 薬の遷延性 or インスリン量過多</li>
            <li>運動時に頻発 → 補食 / 薬剤調整</li>
          </ul>

          <Box color="success">
            <strong>低血糖の頻度は HbA1c より重要な指標</strong>。 月 1 回以上の低血糖は<strong>過治療</strong>のサイン。
            院長と相談の上、 HbA1c 目標を緩める (例 6.5% → 7.0-7.5%) ことを検討します。
            特に高齢者は <strong>HbA1c 7.5-8.5% 目標</strong> でも良いとする J-DOIT3 / 日本老年医学会指針あり。
          </Box>
        </Section>

        {/* ========== シックデイ識別 ========== */}
        <Section id="sickday" icon="🤒" title="シックデイ との識別と注意点" themeColor={THEME}>
          <p>
            シックデイ (発熱・嘔吐・下痢時) と低血糖は <strong>混在しやすい</strong>。 シックデイで食事できない →
            インスリン中断 → 高血糖 で受診、 と思いきや <strong>SU 薬は飲んでしまっていて低血糖</strong>、 のパターンが多発。
          </p>

          <Table headers={['状況', '高血糖 (HHS/DKA 方向)', '低血糖 (この章)']} themeColor={THEME}>
            <Tr><Td>食事</Td><Td>食べていても高血糖</Td><Td>食事できない + 薬を飲んだ</Td></Tr>
            <Tr><Td>口渇・多尿</Td><Td>あり (脱水)</Td><Td>典型的に無し</Td></Tr>
            <Tr><Td>意識</Td><Td>傾眠 → 昏睡</Td><Td>異常行動 → 痙攣 → 昏睡</Td></Tr>
            <Tr><Td>嘔気・嘔吐</Td><Td>あり (ケトン体)</Td><Td>稀</Td></Tr>
            <Tr><Td>呼吸</Td><Td>クスマウル (深く速い)</Td><Td>典型的に変化なし</Td></Tr>
            <Tr><Td>血糖値</Td><Td>250-1000 mg/dL</Td><Td>&lt; 70 mg/dL</Td></Tr>
          </Table>

          <Box color="info">
            <strong>判定に迷ったら血糖測定が決定的</strong>。 シックデイ ルールの詳細は別 topic
            (<Link href="/handbook" legacyBehavior><a style={{ color: '#1565c0' }}>院内ハンドブック → 急性合併症 → シックデイ ルール</a></Link>) で別途記述予定。
          </Box>
        </Section>

        {/* ========== シナリオ ========== */}
        <Section id="scenarios" icon="💡" title="シナリオ別 対応集" themeColor={THEME}>
          <Scenario q="待合室で患者がふらつき・冷や汗をかいている (会話可)" themeColor={THEME}>
            ① すぐ座らせる (椅子 or 床)、 ② SMBG 測定 + ブドウ糖タブレット 3 錠を渡す、
            ③ 15 分後 再測定、 ④ 改善なければ追加 + 院長コール、 ⑤ 帰宅は <strong>家族同伴 + 食事済み</strong> で。
            原因 (食事忘れ / 薬の重複 / 運動後 / アルコール) を聞き出して記録 → 院長に申し送り。
          </Scenario>

          <Scenario q="受付で患者が突然意識消失 (一瞬で倒れた)" themeColor={THEME}>
            ① 周囲呼集 (院長コール + 119)、 ② 横向き気道確保、 ③ <strong>グルカゴン 1 mg IM</strong>、
            ④ SMBG (測れれば)、 ⑤ ルート確保できれば 50% ブドウ糖 20-40 mL IV、 ⑥ バイタル監視。
            意識回復しても <strong>絶対に独歩帰宅させない</strong> — 必ず救急搬送 or 院長判断。
          </Scenario>

          <Scenario q="家族から電話「家で低血糖で意識ない、 救急車呼んだ」" themeColor={THEME}>
            ① <strong>グルカゴン (自宅にあれば) を打つよう指導</strong>、 ② 横向きで気道確保、
            ③ 救急隊到着まで様子見守り (吐物窒息に注意)、 ④ 当院主治医情報 (松本壮一、 普段の薬剤) を救急隊に伝えるよう案内、
            ⑤ 搬送先決定後 当院に連絡 をもらう。 後日 当院でフォロー (薬剤調整)。
          </Scenario>

          <Scenario q="低血糖で運転中の事故・運転継続が心配な患者" themeColor={THEME}>
            ① <strong>運転前血糖測定の徹底</strong> を指導 (70 未満は運転禁止)、 ② <strong>低血糖無自覚なら運転免許継続困難</strong>、
            ③ 仕事で必須なら処方変更 (SU → DPP-4/SGLT2)、 ④ 道交法上の責任を説明、
            ⑤ 重大事故歴あれば <strong>運転免許センターへの主治医意見書</strong> 検討 (院長判断)。
          </Scenario>

          <Scenario q="高齢独居患者で低血糖を繰り返す" themeColor={THEME}>
            ① HbA1c 目標を 7.5-8.5% に緩める (院長判断)、 ② SU 薬中止 → DPP-4 / SGLT2 へ変更検討、
            ③ 持効型インスリンも減量、 ④ 訪問看護 / ケアマネジャー 連携 (低血糖モニタリング)、
            ⑤ 家族・地域包括支援センターへの情報共有、 ⑥ CGM 装着で見える化検討。
          </Scenario>

          <Scenario q="アルコール多飲後の低血糖 (休日明け来院)" themeColor={THEME}>
            アルコール性低血糖は <strong>遷延しやすい</strong> + <strong>肝糖原欠乏でグルカゴン効きにくい</strong>。
            ① IV ブドウ糖 で治療、 ② 院内観察 数時間 → 帰宅判断慎重に、 ③ 必要なら入院、
            ④ 患者教育: 「飲酒前/中の補食」 「飲酒後の血糖測定」 「SU 薬と酒は危険」。
          </Scenario>

          <Scenario q="運動後の遅延性低血糖" themeColor={THEME}>
            運動後 6-12 時間で発生する遅延性低血糖。 ① 運動前/中/後の補食、
            ② 運動日の持効型インスリン減量 (10-20%)、 ③ 就寝前血糖測定の徹底、
            ④ 寝室にブドウ糖タブレット常備、 ⑤ 家族に夜間異変の見守り依頼。
          </Scenario>

          <Scenario q="子供 (小児 1 型糖尿病) の低血糖" themeColor={THEME}>
            ① 親が SMBG + 経口ブドウ糖、 ② グルカゴン (家族指導済) → 救急要請、
            ③ 学校で発生時は <strong>養護教諭 が校内常備グルカゴン</strong> 使用 (要事前指導書)、
            ④ 当院では <Link href="/handbook" legacyBehavior><a style={{ color: '#1565c0' }}>小児 1 型糖尿病</a></Link> topic で詳細別記予定。
          </Scenario>
        </Section>

        {/* ========== トラブルシューティング ========== */}
        <Section id="troubles" icon="🩹" title="トラブルシューティング" themeColor={THEME}>
          <Trouble symptom="グルカゴンを打っても 15 分で意識回復しない">
            肝糖原欠乏 (慢性肝障害・絶食・アルコール) を疑う。 <strong>IV ブドウ糖</strong> に切替、
            ルート確保できなければ 救急隊到着待ち。 並行して院長コール。 SU 薬による低血糖の可能性も。
          </Trouble>

          <Trouble symptom="経口で改善しても 30 分後にまた低血糖">
            SU 薬 / 持効型インスリン による遷延の典型。 <strong>持続的に補食</strong> (おにぎり + 牛乳等) +
            必要なら 10% ブドウ糖点滴。 帰宅させず外来観察 6 時間以上。 院長判断で入院。
          </Trouble>

          <Trouble symptom="SMBG が「LO」 表示 (測定下限値以下) で具体的な値が分からない">
            「LO」 = 20 mg/dL 未満。 <strong>重症扱い</strong> として対応 (グルカゴン + 救急要請)。
            測定機器によっては別チップで再測定可、 ただし時間を失うより治療優先。
          </Trouble>

          <Trouble symptom="患者がブドウ糖を拒否「太るから飲みたくない」">
            「<strong>低血糖は脳細胞を傷つけ、 命に関わる</strong>」 を強調。 太るより遥かに優先度高。
            それでも拒否なら 強制せず ジュース等 代替案、 改善せず深刻化したら グルカゴン適応に移行。
            繰返し拒否傾向あれば <strong>うつ・摂食障害合併</strong> を疑い 院長に申し送り。
          </Trouble>

          <Trouble symptom="夜間 / 早朝に独居患者の低血糖、 連絡が取れない">
            家族・救急隊・警察への <strong>安否確認 (welfare check)</strong> 依頼。 当院は 119 + 警察 110 + 親族
            連絡先 (カルテ記載) の順。 院長判断で家族へのグルカゴン教育を強化検討。
          </Trouble>

          <Trouble symptom="低血糖が頻発するが患者が外来に来ない">
            電話フォロー → 家族経由連絡 → ケアマネジャー / 訪問看護経由 → 最終的に往診検討。
            外来で薬剤調整できないと事故リスク高。 院長判断で <strong>処方一時休薬</strong> の判断もあり。
          </Trouble>

          <Trouble symptom="患者が「低血糖症状」 と言うが SMBG は 100 mg/dL 以上">
            <strong>相対的低血糖</strong> の可能性 (普段の血糖が高い患者は 100 でも症状出る)。
            まずブドウ糖 5-10 g で症状改善するか確認。 改善するなら相対的低血糖 → HbA1c 緩める。
            改善しないなら 低血糖以外の鑑別 (めまい・パニック発作・脱水等)。
          </Trouble>

          <Trouble symptom="グルカゴン在庫切れ・期限切れに気付いた">
            即座に院長コール + 緊急処方 (院長権限) で発注、 並行して連携薬局に在庫確認。
            短期的には 院内 50% ブドウ糖 IV で代替対応。 ハンドブック「📦 物品管理」 topic で 在庫チェック頻度の
            運用ルールを別途定める (TBD)。
          </Trouble>
        </Section>

        {/* ========== 参考資料 ========== */}
        <Section id="references" icon="📚" title="参考資料・院内文書" themeColor={THEME}>
          <Subh>外部ガイドライン</Subh>
          <ul>
            <li>日本糖尿病学会「糖尿病診療ガイドライン 2024」 第 24 章 低血糖症</li>
            <li>ADA Standards of Medical Care in Diabetes (毎年改訂)</li>
            <li>IHSG (International Hypoglycaemia Study Group) Consensus 2017</li>
            <li>日本老年医学会「高齢者糖尿病診療ガイドライン 2023」</li>
          </ul>

          <Subh>当院文書 (TBD: 院長確認の上で path 確定)</Subh>
          <ul>
            <li>{`{{院内 急変時対応 マニュアル}}`}</li>
            <li>{`{{グルカゴン使用記録 用紙}}`}</li>
            <li>{`{{低血糖記録用 患者手帳 (糖尿病連携手帳に統合済?)}}`}</li>
            <li>{`{{救急搬送先 リスト 最新版}}`}</li>
          </ul>

          <Box color="info">
            <strong>📝 編集メモ (院長・スタッフ共有)</strong>:<br />
            このページは初版ドラフトです。 教科書的内容を中心に、 当院ローカルルールを <code>{`{{TBD}}`}</code> で示しています。
            院長 (松本壮一) と一緒に <code>{`{{TBD}}`}</code> を確定し、 さらに当院特有の経験 (ヒヤリハット事例、
            院長の判断パターン) を追記していくことで、 <strong>「ここを見れば全員が同じ対応をできる」</strong>
            ハンドブックに育てます。<br />
            修正は <code>pages/handbook/hypoglycemia.js</code> を直接編集 → push で本番反映 (Vercel auto-deploy)。
          </Box>
        </Section>

        <GuideFooter />
      </div>
    </div>
  )
}

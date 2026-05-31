// DM 基本 (2型糖尿病) 問診ツール 完全ガイド (2026-05-31)
//
// カバー範囲:
//   1. 全体像 (患者→スタッフ→医師の動線、 30 秒で出来上がる紹介状)
//   2. ログインと入口 (kinkan staff 共通、 PW 変更は kinkan で)
//   3. 6 ステップの流れ (重要確認 → 受診理由 → 医療背景・家族歴 → 生活情報 → 体格・要望 → 病歴・経緯の聴取)
//   4. 各ステップの入力ポイント・地雷
//   5. 音声入力 (VoiceMemoSection の 2 mode: 現病歴 / 既往歴 + 要DR確認)
//   6. カルテ自動生成 (claude-sonnet-4-5) + 受付コード (4 桁、 I/O/0/1 除外)
//   7. /list (一覧、 30 秒自動更新、 検索、 新規→完了)
//   8. /detail/[id] (詳細、 再生成、 削除、 ステータス変更)
//   9. SAS フォームの DM 差分問診 (採血で DM 確定時)
//   10. プロンプト二重管理の注意 (8 ファイル同期、 修正時の落とし穴)
//   11. 個人情報の取扱い (PII の境界、 audit_logs ルール)
//   12. シナリオ別 対応集 / トラブルシューティング
//
// 対象:
//   - 医師 (院長・常勤): 自分のフォームで何が聞かれて、 どう整形されてカルテに出るか把握したい
//   - 事務スタッフ・リーダー: 問診運用の手順、 再生成の判断、 受付コード受け渡し
//   - 採用直後のスタッフ: マニュアル代わり (各 step の意味と入力例)
//
// 同じ HelpGuide 部品で T1D / GDM / RH / HTHL / 甲状腺 / SAS のガイドも順次追加予定 (2026-06 以降)

import {
  BackLink, GuideHeader, Toc, Section, Subh, Box, Code, Table, Tr, Td, Step, Scenario, Trouble, GuideFooter,
} from '../../components/HelpGuide'

const THEME = '#1a5fa8'  // DMIntakeTool の primary 色 と統一 (糖尿病 = 落ち着いた紺)

const TOC = [
  { id: 'overview',       icon: '🗺️', title: 'DM 問診の全体像 (患者 → スタッフ → 医師の動線)' },
  { id: 'login',          icon: '🔐', title: 'ログインと入口 (kinkan staff 共通)' },
  { id: 'steps',          icon: '📝', title: '6 ステップの流れ (重要確認 → 病歴・経緯の聴取)' },
  { id: 'step-alert',     icon: '⚠️', title: 'Step 1: 重要確認 (体重減少のスクリーニング)' },
  { id: 'step-reason',    icon: '🩺', title: 'Step 2: 受診理由 (健診・紹介状・転院など)' },
  { id: 'step-history',   icon: '🧬', title: 'Step 3: 医療背景・家族歴 (DM/HT/HL + 重要既往)' },
  { id: 'step-lifestyle', icon: '🏠', title: 'Step 4: 生活情報 (同居・仕事・運動)' },
  { id: 'step-body',      icon: '📏', title: 'Step 5: 体格・要望 (身長体重・希望曜日・医師指名)' },
  { id: 'step-extended',  icon: '🎙️', title: 'Step 6: 病歴・経緯の聴取 (音声入力 ×2)' },
  { id: 'voice',          icon: '🎤', title: '音声入力 (現病歴 / 既往歴 + 要DR確認)' },
  { id: 'generate',       icon: '🤖', title: 'カルテ自動生成と受付コード (4 桁英数字)' },
  { id: 'list',           icon: '📋', title: '/list 問診一覧 (30 秒自動更新・検索・完了化)' },
  { id: 'detail',         icon: '🔍', title: '/detail/[id] 詳細 (カルテ表示・再生成・削除)' },
  { id: 'sas-dmdiff',     icon: '💤', title: 'SAS フォームの DM 差分問診 (採血で DM 判明時)' },
  { id: 'prompt-sync',    icon: '🔁', title: 'プロンプト二重管理 (8 ファイル同期の注意)' },
  { id: 'pii',            icon: '🔒', title: '個人情報 (PII) の取扱い と audit_logs ルール' },
  { id: 'scenarios',      icon: '💡', title: 'シナリオ別 対応集' },
  { id: 'troubleshoot',   icon: '🩹', title: 'トラブルシューティング' },
]

export default function DmGuidePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
        <BackLink href="/help" label="← 完全ガイド集" />

        <GuideHeader
          icon="🩺"
          title="DM 基本 (2 型糖尿病) 問診 完全ガイド"
          subtitle="患者が iPad で答えた問診を Claude (claude-sonnet-4-5) が即座にカルテ記載文に整形 → 受付コード 4 桁で取り出して電子カルテに貼る、 当院の標準フローを完全網羅。 6 ステップの意味、 音声入力 (現病歴/既往歴) の使い分け、 受付コード運用、 再生成、 SAS の DM 差分問診、 プロンプト同期の注意までカバー。"
          themeColor={THEME}
        />

        <Toc items={TOC} themeColor={THEME} />

        {/* ========== 全体像 ========== */}
        <Section id="overview" icon="🗺️" title="DM 問診の全体像 (患者 → スタッフ → 医師の動線)" themeColor={THEME}>
          <p>
            <strong>「患者は iPad で問診に答えるだけ、 医師は出来上がったカルテをコピペするだけ」</strong> が
            DM 問診ツールの目的です。 紙の問診票で 5〜10 分かかっていた初診のカルテ起こしを、
            10〜15 秒に短縮します。
          </p>

          <Step n={1} title="🪑 受付: スタッフが患者に iPad を渡す" themeColor={THEME}>
            受付で <Code>/auth</Code> ログイン済みの iPad を渡し、 トップから <Code>/dm</Code> (DM 基本) を選んで貰います。
            iPad は院内 Wi-Fi に接続必須。 個人情報 (氏名・生年月日) は <strong>入力させません</strong> (PII 防止)。
          </Step>

          <Step n={2} title="📝 患者: 6 ステップを iPad で順に回答" themeColor={THEME}>
            選択肢ボタン中心の UI で、 文字入力は最小限。 平均 3〜5 分で完了。
            重要確認 → 受診理由 → 医療背景・家族歴 → 生活情報 → 体格・要望 → 病歴・経緯の聴取。
            「分からない」 と言われたら無回答で進めて構いません (後で医師が確認)。
          </Step>

          <Step n={3} title="🎙️ スタッフ: 必要なら音声入力で現病歴・既往歴を補強" themeColor={THEME}>
            Step 6 (病歴・経緯の聴取) で、 患者の発話を <strong>音声入力</strong> でテキスト化 →
            AI が自動整形 (現病歴サマリー / ♯既往疾患リスト)。 既往歴で曖昧さが残れば
            「要 DR 確認」 チェックを入れると申し送り欄に <Code>□ 既往歴: 要ドクター確認</Code> が自動付与。
          </Step>

          <Step n={4} title="🤖 送信: Claude (sonnet-4-5) がカルテ記載文を生成" themeColor={THEME}>
            「カルテ文を生成」 ボタンで、 入力データ + 音声整形結果 が Anthropic API に渡され、
            <strong>当院フォーマットのカルテ記載文</strong> が生成されます。 同時に Supabase に保存され、
            <strong>4 桁の受付コード</strong> (英数字、 I・O・0・1 除外で誤読防止) が発行されます。
            患者には受付コードを口頭で伝えるだけで OK。
          </Step>

          <Step n={5} title="📋 医師/スタッフ: /list で受付コード検索 → カルテをコピー" themeColor={THEME}>
            診察直前に <Code>/list</Code> で患者の受付コードを検索 (or 30 秒自動更新で新規入電を待つ) →
            <Code>/detail/[id]</Code> でカルテ全文を表示 → 「📋 コピー」 ボタン → 電子カルテに <Code>Ctrl+V</Code>。
            <strong>診察開始までに 10〜15 秒で完了します。</strong>
          </Step>

          <Step n={6} title="✅ 完了: ステータスを 新規 → 完了 に変更" themeColor={THEME}>
            診察後、 <Code>/detail/[id]</Code> の「完了にする」 ボタン or <Code>/list</Code> から一括完了化
            (管理者・事務長・リーダーのみ)。 完了済みは一覧の下部に下がり、 新規との視認性を保ちます。
          </Step>

          <Box color="success">
            <strong>🎯 全工程の所要時間 (患者対応含む)</strong>: 患者の iPad 入力 3〜5 分 (待ち時間に並行) → スタッフ
            音声入力 ~30 秒 → 生成 ~10 秒 → 受付コード受渡 ~5 秒 → 医師がコピペ ~10 秒 = <strong>診察直前の
            事務作業はおよそ 15 秒</strong>。 紙カルテ運用比で 1 患者あたり 8〜10 分の医師時間削減。
          </Box>
        </Section>

        {/* ========== ログイン ========== */}
        <Section id="login" icon="🔐" title="ログインと入口 (kinkan staff 共通)" themeColor={THEME}>
          <p>
            dm-clinic-karte は <strong>kinkan-app の staff テーブルを認証サーバーとして共有</strong> しています
            (2026-04-25 Phase G で統合完了)。 つまり kinkan-app と同じ ID/PW で入れます。
          </p>

          <Subh>初回入場の 2 段ゲート</Subh>
          <Step n={1} title="🚪 共通 PW ゲート (/gate) を通過" themeColor={THEME}>
            <Code>APP_GATE_PASSWORD</Code> (院内共通 PW) を入力。 通過後 <Code>karte_gate</Code> cookie
            (30 日有効) が発行され、 以降の問診アクセスでゲート画面は出ません。 院長が PW 変更すると
            全 cookie が自動失効 (HMAC 入力に PW を混ぜているため)。
          </Step>

          <Step n={2} title="👤 個人ログイン (/auth) でスタッフ選択 + PW" themeColor={THEME}>
            プルダウンから自分のスタッフ名を選び、 個人 PW を入力。 認証は kinkan-app の
            <Code>/api/auth/verify-staff</Code> エンドポイントに問い合わせます (staff テーブルの単一所有権)。
            7 日間ログイン状態が維持されます (sliding なし、 期限固定)。
          </Step>

          <Box color="warning">
            <strong>パスワード変更は kinkan-app 側でしかできません</strong>。
            勤怠アプリ (kinkan-app.vercel.app) でログインして「パスワード変更」 から行ってください。
            dm-clinic-karte 側に変更画面はありません (staff テーブルの単一所有権を維持するため)。
          </Box>

          <Box color="info">
            <strong>新規スタッフへの案内</strong>:「初回パスワード変更は必ず勤怠アプリから」 と伝えてください。
            初回ログイン (<Code>password_changed=false</Code>) でも dm-clinic-karte には入れてしまいますが、
            全員 kinkan-app で打刻する運用なので実質的に先に変更強制されます。
          </Box>
        </Section>

        {/* ========== 6 ステップの概観 ========== */}
        <Section id="steps" icon="📝" title="6 ステップの流れ (重要確認 → 病歴・経緯の聴取)" themeColor={THEME}>
          <p>
            DM 基本 (<Code>/dm</Code>) は 6 ステップ構成。 上部にステップインジケータ (1/6 → 6/6) が表示され、
            「次へ」 「戻る」 ボタンで移動。 <strong>未入力があっても次に進めます</strong> (患者が分からない項目を
            空欄で送るのは想定済み、 医師が診察時に補完する設計)。
          </p>

          <Table headers={['#', 'タイトル', '主な内容', '所要', '対象']} themeColor={THEME}>
            <Tr><Td>1</Td><Td>⚠️ 重要確認</Td><Td>体重減少 (悪性疾患スクリーニング)</Td><Td>~10 秒</Td><Td>全員</Td></Tr>
            <Tr><Td>2</Td><Td>🩺 受診理由</Td><Td>健診・紹介状・転院・気になる症状</Td><Td>~30 秒</Td><Td>全員</Td></Tr>
            <Tr><Td>3</Td><Td>🧬 医療背景・家族歴</Td><Td>DM/HT/HL/重要既往 (胃癌・膵癌・IHD・脳梗塞) + 家族歴 + アレルギー</Td><Td>~1 分</Td><Td>全員</Td></Tr>
            <Tr><Td>4</Td><Td>🏠 生活情報</Td><Td>同居家族・仕事・運動・飲酒・喫煙</Td><Td>~1 分</Td><Td>全員</Td></Tr>
            <Tr><Td>5</Td><Td>📏 体格・要望</Td><Td>身長体重・希望曜日・医師指名・診察枠</Td><Td>~30 秒</Td><Td>全員</Td></Tr>
            <Tr highlight><Td>6</Td><Td>🎙️ 病歴・経緯の聴取</Td><Td>音声入力 (現病歴 + 既往歴) で口頭聴取を AI 整形</Td><Td>~1 分</Td><Td>スタッフ補助</Td></Tr>
          </Table>

          <Box color="info">
            <strong>Step 6 はスタッフ補助が前提</strong>。 患者が iPad で 1〜5 を埋めた後、 スタッフが横で
            「他に何か気になる症状や、 これまで治療した病気はありますか?」 と口頭で聞き、 音声入力で
            テキスト化します。 患者本人が話すのが恥ずかしい場合はスタッフが代弁しても構いません
            (録音は端末内のみで Supabase には保存されません)。
          </Box>
        </Section>

        {/* ========== Step 1: 重要確認 ========== */}
        <Section id="step-alert" icon="⚠️" title="Step 1: 重要確認 (体重減少のスクリーニング)" themeColor={THEME}>
          <p>
            「<strong>最近 半年で 5 kg 以上の体重減少がありますか?</strong>」 の 1 問のみ。 「あり」 を選ぶと
            <strong>悪性疾患スクリーニングの追加問診</strong> がカルテ申し送りに自動付与されます。
            DM 単独で半年 5 kg 減るのは高度の高血糖時のみで、 悪性疾患合併の警告フラグとして機能します。
          </p>

          <Subh>カルテへの反映</Subh>
          <Box color="warning">
            「あり」 選択時のカルテ生成プロンプトで、 申し送り欄に
            「<Code>□ 体重減少 (半年 5 kg 以上): 悪性疾患スクリーニングを医師判断にて検討</Code>」
            が自動付与されます。 医師は診察時にこのチェック欄を見て、 胸部 X 線・腹部エコー・上下部内視鏡
            の追加判断をします。
          </Box>
        </Section>

        {/* ========== Step 2: 受診理由 ========== */}
        <Section id="step-reason" icon="🩺" title="Step 2: 受診理由 (健診・紹介状・転院など)" themeColor={THEME}>
          <p>
            受診の最も主要な動機を 1 つ選びます。 選んだ理由に応じて追加質問が動的に出ます。
          </p>

          <Table headers={['受診理由', '追加質問', '備考']} themeColor={THEME}>
            <Tr><Td>健診で指摘</Td><Td>健診の種類 (人間ドック / 会社健診 / 特定健診)</Td><Td>HbA1c 数値は Step 5 の自由記入で</Td></Tr>
            <Tr><Td>紹介状あり</Td><Td>紹介元 (クイック選択 = 当院との連携医) + 診療科</Td><Td>市外の大病院は自由入力</Td></Tr>
            <Tr><Td>転院希望</Td><Td>転院元の通院先 + 詳細</Td><Td>転院理由は申し送りで医師判断</Td></Tr>
            <Tr highlight><Td>糖尿病か気になる</Td><Td>気になる理由 (家族歴 / 症状 / 健診値 等)</Td><Td>2026-04-25 改修: 暫定診断「<Code>＃糖尿病 or IGT or 正常耐糖能</Code>」+ 申し送り「血糖、HbA1c の結果により上段の診断を確定」</Td></Tr>
            <Tr><Td>その他</Td><Td>自由記述</Td><Td>音声入力で補強可</Td></Tr>
          </Table>

          <Subh>紹介元クイック選択</Subh>
          <p>
            連携医 (上尾市医師会の主要クリニック等) はワンタップで選択可能。 <strong>再タップで解除</strong> できます
            (2026-04-26 改修)。 リストにない病院は「その他」 で自由入力。
          </p>

          <Box color="info">
            <strong>音声入力サブシステムとの関係</strong>: 受診理由が複雑な患者 (複数因子、 長い経緯) は
            Step 2 を簡潔に埋めて、 詳細を Step 6 の <strong>現病歴 音声入力</strong> で補強する運用が推奨です。
            Claude が受診理由サマリーに自動統合します。
          </Box>
        </Section>

        {/* ========== Step 3: 医療背景・家族歴 ========== */}
        <Section id="step-history" icon="🧬" title="Step 3: 医療背景・家族歴 (DM/HT/HL + 重要既往)" themeColor={THEME}>
          <p>
            <strong>DM 基本 で最も情報量が多い step</strong>。 ここを丁寧に埋めると、 診察時間が大幅に短縮できます。
            旧フォームで「病気について」 step に散らばっていた項目を集約 (2026-04-26 大規模再編 で確定)。
          </p>

          <Subh>糖尿病既往</Subh>
          <ul>
            <li><strong>DM 発症時期</strong>: 和暦 (昭和 / 平成 / 令和) + 年 を選択、 不明チェックも可</li>
            <li><strong>インスリン治療中</strong>: 該当時はカルテに「<Code>＃糖尿病 (インスリン治療中)</Code>」 と展開</li>
            <li><strong>エコー検査</strong>: 頸動脈エコー / 腹部エコー の最終受診時期 (健康投資の評価)</li>
          </ul>

          <Subh>合併する慢性疾患 (チェックボックス)</Subh>
          <Table headers={['疾患', 'カルテ表記', '備考']} themeColor={THEME}>
            <Tr><Td>HT (高血圧)</Td><Td>＃高血圧症</Td><Td>治療歴・通院先は Step 6 音声で補強</Td></Tr>
            <Tr><Td>HL (脂質異常症)</Td><Td>＃脂質異常症</Td><Td>同上</Td></Tr>
            <Tr><Td>甲状腺疾患</Td><Td>＃甲状腺機能異常</Td><Td>2026-04-21 追加</Td></Tr>
            <Tr><Td>インスリン治療中</Td><Td>＃糖尿病 (インスリン治療中)</Td><Td>糖尿病既往と統合</Td></Tr>
          </Table>

          <Subh>重要既往 (詳細展開、 4 項目)</Subh>
          <p>
            該当があると <strong>治療種類 / 切除範囲 / 手術年 / 治療病院 / 現通院先 / 通院頻度 / 服薬</strong> の
            詳細パネルが展開されます (DetailBox component)。
          </p>
          <Table headers={['既往', '切除範囲の選択肢', '備考']} themeColor={THEME}>
            <Tr><Td>胃癌</Td><Td>1/3 切除 / 1/2 切除 / 2/3 切除 / 全摘 / 不明</Td><Td>術後の血糖変動を医師判断に活かす</Td></Tr>
            <Tr><Td>膵癌</Td><Td>切除範囲は不要 (手術種類のみ)</Td><Td>術後インスリン依存の評価</Td></Tr>
            <Tr><Td>IHD (虚血性心疾患)</Td><Td>治療法 (PCI / CABG / 薬物のみ)</Td><Td>動脈硬化の指標</Td></Tr>
            <Tr><Td>脳梗塞</Td><Td>(切除なし、 手術年と通院先のみ)</Td><Td>動脈硬化 + 抗血栓薬の確認</Td></Tr>
          </Table>

          <Subh>その他の病気 (自由入力)</Subh>
          <p>
            病名 + 治療病院 を行追加で複数入力可能。 上記 4 項目以外の重要既往はここに記入します。
            完全に Step 6 の <strong>既往歴 音声入力</strong> に流してもOK (AI が <Code>♯病名 (時期・病院・薬)</Code>
            形式に整形)。
          </p>

          <Subh>DM 症状 (チェックボックス 9 項目)</Subh>
          <p>
            のどが渇く / 尿の回数が多い / だるい / 手のしびれ / 足のしびれ / 足がつる / 視力低下 /
            食後の低血糖が心配 / その他 (自由入力)。 該当ありはカルテの現病歴セクションに「<Code>自覚症状: ...</Code>」
            として展開。
          </p>

          <Subh>アレルギー</Subh>
          <p>
            「なし」 がデフォルト。 「あり」 選択時はクイック選択 (花粉 / ペニシリン / 造影剤 / フルーツ /
            <strong>金属</strong> [2026-04-26 追加]) + 自由記入。 造影剤は CT・MRI の指示判断に直結するので重要。
          </p>

          <Subh>家族歴</Subh>
          <p>
            DM (続柄選択可: 父・母・祖父母・兄弟・子) / HT / 脂質異常症 (apo は省略) / IHD。
            DM 家族歴はインスリン分泌能の遺伝予測に重要。
          </p>
        </Section>

        {/* ========== Step 4: 生活情報 ========== */}
        <Section id="step-lifestyle" icon="🏠" title="Step 4: 生活情報 (同居・仕事・運動)" themeColor={THEME}>
          <Subh>同居家族</Subh>
          <ul>
            <li><strong>配偶者</strong>: あり / なし (独居・死別・離別等) の二択</li>
            <li><strong>その他の同居</strong>: 子供との同居パターン (息子 / 娘 / 息子夫婦 / 娘夫婦 / 親 / 祖父母 / 兄弟姉妹 / その他) を複数選択可</li>
            <li><strong>子供情報</strong>: 居住距離 (近居 / 近隣 / 遠方 / 子供なし) + 続柄 (息子/娘/両方)</li>
          </ul>

          <Subh>就労状況</Subh>
          <p>
            「していない」 がデフォルト (高齢患者多数のため)。 「している」 時は職種を複数選択 + 詳細記入。
            シフト勤務・夜勤の有無は医師がインスリン投与時刻の判断に使う。
          </p>

          <Subh>運動習慣</Subh>
          <p>
            活動量の自由記入。 ウォーキング 30 分 ×3/週、 ジム 週 1、 ゴルフ 月 2 等。
            運動療法指導の出発点になります。
          </p>

          <Subh>飲酒・喫煙</Subh>
          <ul>
            <li><strong>飲酒</strong>: なし or 種類別 (ビール / 発泡酒 / ワイン / 焼酎 / 日本酒 / ウイスキー) ×
              量 × 頻度 を行追加で複数記入</li>
            <li><strong>喫煙</strong>: なし / 現在 / 過去。 過去は本数 × 年数 + 禁煙時期 (和暦) を記入。
              <strong>パックイヤー</strong> 計算用の情報源</li>
          </ul>

          <Subh>眼科</Subh>
          <ul>
            <li>眼科通院の有無 + 通院先 (連携クイック選択 or 自由入力)</li>
            <li><strong>眼底検査</strong>: 受診時期 + <strong>連携手帳 (糖尿病眼手帳)</strong> 持参の有無 [2026-04-26 改修で項目化]</li>
            <li>網膜症診断あり/なし/不明</li>
          </ul>

          <Subh>健診受診歴・ワクチン</Subh>
          <p>
            会社健診・人間ドック・特定健診の有無 (複数可) + <strong>65 歳ワクチン</strong> (プレベナー 13 /
            帯状疱疹) の接種状況。 高齢糖尿病患者の感染予防チェック。
          </p>
        </Section>

        {/* ========== Step 5: 体格・要望 ========== */}
        <Section id="step-body" icon="📏" title="Step 5: 体格・要望 (身長体重・希望曜日・医師指名)" themeColor={THEME}>
          <Subh>体格</Subh>
          <ul>
            <li><strong>身長</strong> (cm)、 <strong>現在体重</strong> (kg)、 <strong>20 歳時体重</strong> (kg)、 <strong>最大体重</strong> (kg) + その年齢</li>
            <li>BMI と 20 歳比増減はカルテ生成時に Claude が自動算出</li>
            <li>「20 歳時 / 最大体重」 を聞く意図: 中年期の急激な体重増加 = インスリン抵抗性の進行を示唆</li>
          </ul>

          <Subh>要望</Subh>
          <ul>
            <li><strong>気になる事項</strong> (自由記入、 任意)</li>
            <li><strong>希望曜日</strong> (月〜土 + 指定なし、 複数選択可)</li>
            <li><strong>医師指名</strong> (性別指定 / 指名なし)</li>
            <li><strong>診察枠</strong>: 通常 / 通院サポートが必要 (ダブルスロット) 等の運用区分</li>
          </ul>

          <Subh>通院のご案内 (2026-04-26 追加)</Subh>
          <p>
            通院ルール (予約方法、 キャンセル時の連絡、 緊急時の対応等) を最後に表示。 患者が読んだ確認は
            問診送信ボタンで暗黙的に取得。
          </p>
        </Section>

        {/* ========== Step 6: 病歴・経緯の聴取 ========== */}
        <Section id="step-extended" icon="🎙️" title="Step 6: 病歴・経緯の聴取 (音声入力 ×2)" themeColor={THEME}>
          <p>
            <strong>2026-04-26 追加された最終 step</strong>。 患者が話す内容 (定型問診で拾えなかった文脈) を
            音声入力でテキスト化し、 AI が医療的に整形してカルテに統合します。
            <Code>VoiceMemoSection</Code> component を <strong>2 つ並べた構造</strong>:
          </p>

          <Table headers={['mode', '色', '目的', 'AI 整形フォーマット']} themeColor={THEME}>
            <Tr><Td><Code>currentIllness</Code></Td><Td>オレンジ系 (#fff7e6)</Td><Td>現病歴 / 受診理由の補強</Td><Td>1〜3 文の医療的サマリー</Td></Tr>
            <Tr><Td><Code>pastHistory</Code></Td><Td>青系 (#eef4fc)</Td><Td>既往歴の追記</Td><Td><Code>♯病名 (時期・病院・薬)</Code> 形式の列挙</Td></Tr>
          </Table>

          <Subh>運用パターン (推奨)</Subh>
          <Step n={1} title="🎤 現病歴 音声入力 (mode=currentIllness)" themeColor={THEME}>
            スタッフが患者に「<strong>受診のきっかけや、 これまでの経緯をお話しいただけますか?</strong>」 と
            促し、 録音開始。 患者の発話を 1〜3 分 流す → 「AI 整形」 ボタン → 受診理由サマリーに自動統合。
          </Step>

          <Step n={2} title="🩺 既往歴 音声入力 (mode=pastHistory)" themeColor={THEME}>
            「<strong>これまで治療された病気や、 通院中の医院はありますか?</strong>」 と促し、 録音 →
            AI が <Code>♯病名 (時期・病院・薬)</Code> 形式に整形 → カルテの ♯既往疾患セクションに追記。
            <strong>必要なら「要 DR 確認」 チェックを入れる</strong> (申し送り欄に <Code>□ 既往歴: 要ドクター確認</Code> 自動付与)。
          </Step>

          <Box color="info">
            <strong>音声入力は完全に任意</strong>。 Step 1〜5 のみで送信しても問題ありません。
            ただし複雑な患者ほど Step 6 で補強した方が、 医師が診察開始 5 秒でカルテの全体像を把握できます。
          </Box>

          <Box color="warning">
            <strong>音声データは保存されません</strong>。 ブラウザ内の Web Speech API がリアルタイムで
            文字起こし → 整形 → 文字データのみ Supabase に保存。 録音 (音声 binary) は端末を離れません
            (PII 防止)。
          </Box>
        </Section>

        {/* ========== 音声入力 詳細 ========== */}
        <Section id="voice" icon="🎤" title="音声入力 (現病歴 / 既往歴 + 要DR確認)" themeColor={THEME}>
          <Subh>使い方</Subh>
          <Step n={1} title="🔴 録音ボタン" themeColor={THEME}>
            初回は iPad/PC がマイク許可を求めるダイアログを出します → 「許可」。 録音中はボタンが赤色 (停止) に変化。
            リアルタイムで文字起こし結果がテキストエリアに流れます。
          </Step>

          <Step n={2} title="✏️ テキストを編集" themeColor={THEME}>
            誤認識があれば録音停止後に直接編集可。 textarea なので長文も視覚的に折り返し表示。
          </Step>

          <Step n={3} title="✨ AI 整形ボタン" themeColor={THEME}>
            Claude (sonnet-4-5) が <Code>summarizeForKarte</Code> or <Code>summarizeForPastHistory</Code>
            プロンプトで整形 → 「AI 整形結果」 欄に表示。 これも編集可能。
          </Step>

          <Step n={4} title="📝 (任意) 「要 DR 確認」 にチェック" themeColor={THEME}>
            既往歴で「<strong>薬剤名が曖昧</strong>」「<strong>手術時期が不明</strong>」 等で医師確認が必要なら
            チェック。 申し送り欄に <Code>□ 既往歴: 要ドクター確認</Code> が自動付与され、 医師が診察時に
            視覚的に気付けます。
          </Step>

          <Subh>誤認識補正の仕組み (語彙リスト)</Subh>
          <p>
            <Code>lib/voiceVocabulary.js</Code> に当院特化の語彙リストが定義されており、
            Claude が整形時に参照して誤認識を補正します。
          </p>
          <Table headers={['定数', '件数', '内容']} themeColor={THEME}>
            <Tr><Td><Code>COMMON_HOSPITALS</Code></Td><Td>109</Td><Td>上尾市医師会 89 件 + 周辺市町村 20 件</Td></Tr>
            <Tr><Td><Code>COMMON_DISEASES</Code></Td><Td>99</Td><Td>既往歴 + 糖尿病合併症 + DM 合併疾患</Td></Tr>
            <Tr><Td><Code>COMMON_MEDICATIONS</Code></Td><Td>309</Td><Td>糖尿病 / 循環器 / 脂質 / 抗血栓 / 狭心症 / CGM / CSII 機器</Td></Tr>
            <Tr><Td><Code>COMMON_LAB_TESTS</Code></Td><Td>30</Td><Td>HbA1c / eGFR / BNP / CPR / CPI 等</Td></Tr>
            <Tr><Td><Code>HOSPITAL_DEPARTMENTS</Code></Td><Td>3 病院</Td><Td>上尾中央総合・自治医大さいたま・さいたま赤十字 の正式診療科リスト</Td></Tr>
          </Table>

          <Subh>補正ルール (buildVocabularyHint 内に明示)</Subh>
          <ol>
            <li>市内クリニックは強制マッチ (例: 「古口呼吸器科」 → 「こぐち内科呼吸器クリニック」)</li>
            <li>3 主要病院の診療科は正式名称使用 (例: 「上尾中央の糖尿病科」 → 「上尾中央総合病院 糖尿病内科」)</li>
            <li>明らかに市外の大病院 (東大病院・聖路加等) はリスト外でも聞こえたまま記載してよい</li>
            <li>判定不可な場合のみ「不明」 と記載</li>
          </ol>

          <Box color="info">
            <strong>語彙リストは医師が直接編集する前提</strong>。 上尾市の連携クリニックが増えたら
            <Code>lib/voiceVocabulary.js</Code> の <Code>COMMON_HOSPITALS</Code> 配列に追記してください。
            次回 push で本番に反映されます。
          </Box>
        </Section>

        {/* ========== カルテ生成 ========== */}
        <Section id="generate" icon="🤖" title="カルテ自動生成と受付コード (4 桁英数字)" themeColor={THEME}>
          <Subh>生成エンジン</Subh>
          <ul>
            <li><strong>モデル</strong>: <Code>claude-sonnet-4-5</Code> (Anthropic API、 経路 A = 初回送信)</li>
            <li><strong>入力</strong>: 6 ステップの全データ + 音声整形結果 (現病歴 / 既往歴)</li>
            <li><strong>出力</strong>: 当院フォーマットのカルテ記載文 (♯病名リスト + 現病歴 + 既往歴 + 申し送り)</li>
            <li><strong>所要</strong>: 5〜15 秒 (内容量による)</li>
          </ul>

          <Subh>受付コード (visit_code)</Subh>
          <ul>
            <li><strong>4 桁の英数字</strong> (例: <Code>K7M3</Code>、 <Code>P9X2</Code>)</li>
            <li><strong>I / O / 0 / 1 は除外</strong> (誤読防止、 0/O・1/I の取り違え対策)</li>
            <li>衝突時は 10 回までリトライ → ほぼ衝突しない (32^4 = 約 100 万通り)</li>
            <li>1 日の発行件数が 100 件超でも衝突確率は実用上ゼロ</li>
            <li>患者に口頭で伝えるだけで、 スタッフが <Code>/list</Code> で検索可能</li>
          </ul>

          <Box color="success">
            <strong>受付コードの強み</strong>: 患者氏名・カナを使わず、 ID 番号も使わず、 短い 4 桁英数字
            だけで一意に追跡可能。 個人情報を一切やり取りしないので、 受付スタッフ ↔ 医師 ↔ 患者の
            会話で「○○さん」 と名前を呼ぶ必要がなく、 待合室での <strong>プライバシー保護</strong> にも貢献。
          </Box>

          <Subh>送信ボタンの挙動</Subh>
          <Step n={1} title="「カルテ文を生成」 ボタン押下" themeColor={THEME}>
            ボタンが loading 状態に。 <Code>/api/generate</Code> エンドポイントが Claude API を呼ぶ
            (server-side、 API キー漏洩防止)。
          </Step>
          <Step n={2} title="生成完了 → Supabase 保存" themeColor={THEME}>
            <Code>questionnaires</Code> テーブルに <Code>{`{ visit_code, form_type, form_data, generated_karte, status:'new' }`}</Code>
            を INSERT。 同時に audit_logs に記録 (PII なし、 form_type + 件数のみ)。
          </Step>
          <Step n={3} title="受付コード表示 + 完了画面" themeColor={THEME}>
            iPad に大きく受付コードが表示され、 患者に「<strong>受付に戻ってこのコードをお伝えください</strong>」
            と案内が出ます。 スタッフはこのコードを受付ノートに転記 (or 口頭で受付に伝達)。
          </Step>
        </Section>

        {/* ========== /list ========== */}
        <Section id="list" icon="📋" title="/list 問診一覧 (30 秒自動更新・検索・完了化)" themeColor={THEME}>
          <p>
            <Code>/list</Code> は問診の <strong>新規受信用ダッシュボード</strong>。 受付スタッフ or 医師補助が
            開いておくと、 患者の問診送信を即座に把握できます。
          </p>

          <Subh>主要機能</Subh>
          <ul>
            <li><strong>日付フィルタ</strong>: 本日 / 昨日 / 今週 / 全件</li>
            <li><strong>検索</strong>: 受付コード (visit_code) で絞り込み (4 桁入力で即ヒット)</li>
            <li><strong>30 秒自動更新</strong>: タイマーで <Code>fetchRecords</Code> が silent 実行、 新規があれば
              <strong>タイトルバーに通知</strong> (「問診一覧 (新規 N 件)」)</li>
            <li><strong>ステータス色分け</strong>: 新規 = 赤、 完了 = 緑</li>
            <li><strong>完了済み一括削除</strong>: 管理者・事務長・リーダーのみ (誤操作リスク高のため権限制限)</li>
            <li><strong>全件完了化</strong>: 同上 (1 ク リックで全件 done)、 営業終了時の一括処理用</li>
          </ul>

          <Box color="warning">
            <strong>全件削除ボタンは UI から削除済み</strong> (誤操作・悪意ある操作のリスクが大きいため)。
            どうしても必要な場合は Supabase 管理画面から実行してください。
          </Box>
        </Section>

        {/* ========== /detail ========== */}
        <Section id="detail" icon="🔍" title="/detail/[id] 詳細 (カルテ表示・再生成・削除)" themeColor={THEME}>
          <Subh>主要機能</Subh>
          <ul>
            <li><strong>カルテ全文表示</strong> (生成済み): スクロール可、 monospace で見やすく</li>
            <li><strong>📋 コピー</strong> ボタン: 1 クリックで clipboard へ (electronic record に <Code>Ctrl+V</Code>)</li>
            <li><strong>💾 保存</strong>: カルテ本文を編集して上書き保存可能 (誤字修正等)</li>
            <li><strong>🔄 再生成</strong>: 経路 B (<Code>/api/generate-karte</Code>) で Claude に再依頼。
              プロンプトを更新したい時、 元データを変えずにカルテだけ作り直したい時に使う</li>
            <li><strong>ステータス変更</strong>: 「新規」 → 「完了」 (1 段階のみ、 確認削除済み)</li>
            <li><strong>🗑️ 削除</strong>: ハード削除 (recover 不可)、 confirm モーダルあり</li>
          </ul>

          <Subh>再生成の挙動 (経路 B)</Subh>
          <p>
            初回生成 (経路 A = <Code>/api/generate</Code>) と <strong>別のエンドポイント</strong> です。
            理由: 経路 A はクライアント側でプロンプト組立、 経路 B はサーバー側でプロンプト組立。
            <strong>プロンプトの真正性</strong> (改竄防止) と form_data の整合性をサーバーが保証します。
          </p>

          <Box color="danger">
            <strong>⚠️ プロンプト二重管理</strong>: 経路 A (各 IntakeTool.js 内) と 経路 B (generate-karte.js)
            の 2 箇所で同じプロンプトが管理されています。 詳細は次セクション
            「🔁 プロンプト二重管理」 を参照。
          </Box>
        </Section>

        {/* ========== SAS DM 差分 ========== */}
        <Section id="sas-dmdiff" icon="💤" title="SAS フォームの DM 差分問診 (採血で DM 判明時)" themeColor={THEME}>
          <p>
            SAS (睡眠時無呼吸症候群) 問診は <Code>/sas</Code> で別フォームですが、 当院の事前採血で
            <strong>HbA1c 高値 → 糖尿病確定</strong> が判明した場合、 詳細画面で <Code>SASDmDiffEditor</Code> を
            起動して DM 差分問診を追加入力 → 再生成すると <strong>SAS + DM 統合カルテ</strong> に切り替わります。
          </p>

          <Subh>運用フロー</Subh>
          <Step n={1} title="初回生成 (SAS のみ)" themeColor={THEME}>
            患者が SAS 問診に回答 → <Code>＃SAS / ＃SAS 疑い</Code> を主病名にカルテ生成。
          </Step>
          <Step n={2} title="採血結果で DM 確定" themeColor={THEME}>
            事前採血 (全例実施) で HbA1c 6.5% 以上 → スタッフが DM 差分問診を要判定。
          </Step>
          <Step n={3} title="/detail/[id] で「DM 差分問診」 を入力" themeColor={THEME}>
            体重減少 / DM 症状 9 項目 / HbA1c 指摘歴 / 既知の発症時期 / インスリン使用 / 家族歴
            (DM/HL) / 眼底検査 / 重要既往 (胃癌・膵癌・IHD・脳梗塞) / 治療希望 / 自由記載 を入力。
          </Step>
          <Step n={4} title="🔄 再生成 → SAS + DM 統合カルテ" themeColor={THEME}>
            <Code>/api/generate-karte</Code> の SAS 分岐が <Code>dmDiff.completed=true</Code> を見て
            <strong>SAS + DM 統合プロンプト</strong> に切り替わり、 主病名が <Code>＃糖尿病 ＃SAS</Code> 等に再構成。
          </Step>

          <Box color="info">
            <strong>SAS のフルガイドは別ページ予定</strong> (<Code>/help/sas</Code>)。 DM 差分問診の詳細項目や
            CPAP 継続判定の流れは SAS ガイド側で記述します (2026-06 以降に追加予定)。
          </Box>
        </Section>

        {/* ========== プロンプト同期 ========== */}
        <Section id="prompt-sync" icon="🔁" title="プロンプト二重管理 (8 ファイル同期の注意)" themeColor={THEME}>
          <Box color="danger">
            <strong>⚠️ プロンプト修正時は 8 ファイル全てを同期してください</strong>。 片方だけ修正すると
            初回生成 (経路 A) と再生成 (経路 B) で<strong>カルテの出力が一致しなくなり</strong>、
            医師がカルテを見返した時に「あれ、 前回と書式が違う」 という事故が起きます。
          </Box>

          <Subh>修正対象 8 ファイル</Subh>
          <Table headers={['経路', 'ファイル', '対象 form_type']} themeColor={THEME}>
            <Tr><Td>A</Td><Td><Code>components/DMIntakeTool.js</Code></Td><Td>DM 基本</Td></Tr>
            <Tr><Td>A</Td><Td><Code>components/T1DIntakeTool.js</Code></Td><Td>1 型糖尿病</Td></Tr>
            <Tr><Td>A</Td><Td><Code>components/PedT1DIntakeTool.js</Code></Td><Td>小児 1 型糖尿病</Td></Tr>
            <Tr><Td>A</Td><Td><Code>components/HTHLIntakeTool.js</Code></Td><Td>高血圧・脂質異常症</Td></Tr>
            <Tr><Td>A</Td><Td><Code>components/GDMIntakeTool.js</Code></Td><Td>妊娠糖尿病</Td></Tr>
            <Tr><Td>A</Td><Td><Code>components/RHIntakeTool.js</Code></Td><Td>反応性低血糖</Td></Tr>
            <Tr><Td>A</Td><Td><Code>components/SASIntakeTool.js</Code></Td><Td>睡眠時無呼吸症候群</Td></Tr>
            <Tr highlight><Td>B</Td><Td><Code>pages/api/generate-karte.js</Code></Td><Td><strong>全 7 form_type を 1 ファイルに集約</strong></Td></Tr>
          </Table>

          <Subh>修正の手順 (推奨)</Subh>
          <Step n={1} title="該当 IntakeTool.js のプロンプトを修正" themeColor={THEME}>
            例: DM 基本のプロンプト変更 → <Code>components/DMIntakeTool.js</Code> の <Code>generateKarte()</Code>
            内のテンプレートリテラルを編集。
          </Step>
          <Step n={2} title="generate-karte.js の同 form_type 分岐を 同じ内容に更新" themeColor={THEME}>
            <Code>pages/api/generate-karte.js</Code> 内で <Code>form_type === 'DM 基本'</Code> の分岐を
            探し、 同じ修正を反映。 <strong>diff を取って完全一致を確認</strong>。
          </Step>
          <Step n={3} title="動作確認: 既存レコードを 再生成 して 出力比較" themeColor={THEME}>
            <Code>/detail/[id]</Code> で「🔄 再生成」 → 初回生成済みカルテと <strong>意図した差分のみ</strong>
            になっているか確認。
          </Step>
        </Section>

        {/* ========== PII ========== */}
        <Section id="pii" icon="🔒" title="個人情報 (PII) の取扱い と audit_logs ルール" themeColor={THEME}>
          <Box color="warning">
            <strong>当院問診ツールの設計原則</strong>:
            <ul style={{ marginTop: 6, marginBottom: 0 }}>
              <li>患者氏名・カナ・生年月日は <strong>一切 DB に保存しない</strong></li>
              <li>追跡は受付コード (4 桁英数字) のみ</li>
              <li>音声データは保存せず、 文字データのみ Supabase へ</li>
              <li>audit_logs には visit_code (公開された受付番号) のみ、 form_type + 件数記録</li>
              <li>患者氏名・問診詳細は audit_logs にも保存しない</li>
            </ul>
          </Box>

          <Subh>RLS (Row Level Security)</Subh>
          <p>
            kinkan-app と統合された Supabase 共通基盤 (karteplus-prod、 2026-05-26 統合 Phase 2 完了) で、
            17 テーブル × 2 = 34 policies が稼働。 PoC user JWT で sakura-test 不可視 = Path α 核心動作の
            本番実証完了。 dm-clinic-karte も同じ RLS 基盤を共有しています (8 テーブル × 2 = 16 policies)。
          </p>
        </Section>

        {/* ========== シナリオ別 ========== */}
        <Section id="scenarios" icon="💡" title="シナリオ別 対応集" themeColor={THEME}>
          <Scenario q="患者が iPad 操作に不慣れで、 自分で入力できない" themeColor={THEME}>
            スタッフが横に座って <strong>聞き取り代行</strong> してください。 各 step は選択肢ボタン中心なので、
            「○○ですか?」 と質問しながらタップで進められます。 Step 6 の音声入力では患者本人に話してもらう
            のが理想ですが、 恥ずかしがる場合はスタッフが要約して代弁しても OK。
          </Scenario>

          <Scenario q="受診理由が複数因子で複雑 (健診 + 紹介状 + 気になる症状)" themeColor={THEME}>
            Step 2 で最も主要な理由 1 つを選び、 残りは Step 6 の <strong>現病歴 音声入力</strong> で補強。
            「健診で HbA1c 7.2 を指摘され、 また家族 (父) が糖尿病でインスリン使用中、 自分も最近喉が
            渇くので心配で受診」 のような自然な発話で OK。 AI が整形してカルテ受診理由サマリーに統合。
          </Scenario>

          <Scenario q="既往歴 (DM/HT 以外) が多すぎてどこに入れるか迷う" themeColor={THEME}>
            重要既往 (胃癌・膵癌・IHD・脳梗塞) は Step 3 の専用 DetailBox で詳細入力。 それ以外
            (アトピー・痛風・気管支炎・ヘルニア手術等) は Step 3「その他の病気」 行追加 or
            <strong>Step 6 既往歴 音声入力</strong>。 後者の方が AI が <Code>♯病名 (時期・病院・薬)</Code>
            形式に揃えてくれるので推奨。
          </Scenario>

          <Scenario q="既往歴の入力中に「薬の名前が分からない」 と言われた" themeColor={THEME}>
            患者に「飲んでる薬の見た目 (色・形)」 を聞いて音声入力 → <strong>「要 DR 確認」 チェックを ON</strong>
            にして送信。 申し送り欄に <Code>□ 既往歴: 要ドクター確認</Code> が自動付与され、 医師が診察時に
            お薬手帳を確認して補完します。
          </Scenario>

          <Scenario q="生成されたカルテの病名 (♯) が思ったのと違う" themeColor={THEME}>
            プロンプトの解釈で起きることがあります。 <Code>/detail/[id]</Code> でカルテ本文を <strong>直接編集</strong>
            → 「💾 保存」 で上書き可能。 ただし元データに戻って修正したい場合は、 患者の問診を見直してから
            「🔄 再生成」 を実行 (経路 B = サーバー側プロンプト)。
          </Scenario>

          <Scenario q="紹介状のある患者で、 紹介元が紹介リストに無い" themeColor={THEME}>
            「その他」 ボタンを選んで自由入力。 上尾市以外の大病院 (東大病院・聖路加・北里大学 等) はリスト外でも
            <strong>聞こえたまま記載</strong> されるので問題ありません。 もし当院の連携医として頻出する病院なら、
            <Code>lib/voiceVocabulary.js</Code> の <Code>COMMON_HOSPITALS</Code> 配列に追記すると次回から
            音声整形時に自動補正されます。
          </Scenario>

          <Scenario q="採血結果で SAS 患者の DM が判明した" themeColor={THEME}>
            「💤 SAS フォームの DM 差分問診」 セクション参照。 SAS の <Code>/detail/[id]</Code> で
            「DM 差分問診」 を入力 → 「🔄 再生成」 で SAS + DM 統合カルテに切り替わります。
          </Scenario>
        </Section>

        {/* ========== トラブルシューティング ========== */}
        <Section id="troubleshoot" icon="🩹" title="トラブルシューティング" themeColor={THEME}>
          <Trouble symptom="iPad でログイン画面が出ない (真っ白)">
            ① Wi-Fi 接続確認、 ② Safari/Chrome のキャッシュ削除、
            ③ <Code>karteplus.jp/c/matsumoto-dm-clinic</Code> でなく直接 <Code>dm-clinic-karte.vercel.app</Code> を
            開いているか確認、 ④ それでも駄目なら一度ログアウト URL <Code>/api/auth (DELETE)</Code> を
            叩くか、 PC で同じ手順を試して問題切り分け。
          </Trouble>

          <Trouble symptom="カルテ生成が「生成中」 のまま 30 秒以上止まる">
            Anthropic API のレート制限か、 ネットワーク不調の可能性。 ① ブラウザの開発者ツール (F12) で
            ネットワークタブの <Code>/api/generate</Code> を確認 → ② エラーメッセージがあれば再試行ボタン、
            ③ それでも駄目なら 一度キャンセル → 同じデータで再送信。 4 桁コード重複防止のリトライ機構 (10 回) が
            背後で動いているので、 一度の失敗で諦めず再試行可。
          </Trouble>

          <Trouble symptom="受付コードを患者に伝え忘れた / メモを失くした">
            <Code>/list</Code> で <strong>本日</strong> フィルタ → 直近 N 分前の問診を created_at で特定 →
            問診内容から該当患者を識別。 patient 不在で識別できない場合は、 医師が問診全文をざっと見て
            「この問診は山田さんのものか」 を判断。 <strong>絶対にやってはいけないのは推測で別患者のカルテを
            渡すこと</strong> — その場合は再度問診をやり直してもらう方が安全です。
          </Trouble>

          <Trouble symptom="音声入力で全然違う言葉が認識される">
            ① マイク許可確認 (URL バー横の 🔒 で確認可)、 ② 周囲の雑音 (受付の電話・他の患者の声) を
            減らす、 ③ 患者にゆっくり話してもらう、 ④ それでも誤認識が頻発するなら <strong>テキスト編集で
            手修正</strong> してから AI 整形ボタン。 AI 整形は誤認識でも文脈で補正します
            (例: 「あおうちゅうおう」 → 「上尾中央総合病院」)。
          </Trouble>

          <Trouble symptom="既往歴の AI 整形結果が患者の発言と微妙に違う">
            AI 整形は当院フォーマット (♯病名 (時期・病院・薬)) への変換を含みます。 患者の自然発話を
            そのまま記録したい場合は、 整形結果の textarea で手修正してから送信してください。
            また、 <strong>「要 DR 確認」 チェック</strong> を ON にしておけば医師が診察時にお薬手帳と
            対照して最終確認します。
          </Trouble>

          <Trouble symptom="ステータスを「完了」 にしたが、 やり直したい (新規に戻したい)">
            <Code>/detail/[id]</Code> から直接「新規」 に戻す UI は <strong>意図的に削除</strong> されています
            (ステータス遷移は一方向、 監査ログ簡素化のため)。 どうしても必要な場合は Supabase 管理画面で
            <Code>UPDATE questionnaires SET status = 'new' WHERE id = '...'</Code> を実行してください
            (管理者操作)。
          </Trouble>

          <Trouble symptom="再生成すると元のカルテと書式が変わる (♯ の順番、 申し送り欄の文言)">
            プロンプト二重管理の不整合の可能性。 「🔁 プロンプト二重管理」 セクションの 8 ファイル
            (経路 A 7 ファイル + 経路 B 1 ファイル) の同期を確認してください。 直近のプロンプト変更コミットを
            git log で追って、 経路 A / 経路 B の両方に同じ修正が入っているか diff で確認。
          </Trouble>

          <Trouble symptom="kinkan-app でパスワード変えたのに dm-clinic-karte でログインできない">
            ① ブラウザの cookie をクリアして <Code>/auth</Code> 再ログイン、
            ② kinkan-app 側で <strong>本当にパスワード変更が成功している</strong> か (確認画面まで進んだか) 確認、
            ③ kinkan-app の <Code>/api/auth/verify-staff</Code> が dm-clinic-karte からアクセス可能か確認 (CORS 設定)、
            ④ 認証は staff テーブル単一所有権なので、 staff レコードの <Code>password_hash</Code> 更新が
            両アプリから即時参照される設計 — 反映遅延は理論上発生しません。
          </Trouble>
        </Section>

        <GuideFooter />
      </div>
    </div>
  )
}

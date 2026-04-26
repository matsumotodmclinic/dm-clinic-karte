# CLAUDE.md — dm-clinic-karte

## プロジェクト概要

まつもと糖尿病クリニックの初診事前問診アプリ。
患者がiPad等で問診に回答 → Claude API（claude-sonnet-4-5）でカルテ記載文を自動生成 → Supabase保存 → スタッフが受付コードで検索・コピーして電子カルテに貼り付け。

- 本番: https://dm-clinic-karte.vercel.app
- GitHub: matsumotodmclinic/dm-clinic-karte
- デプロイ: GitHub push → Vercel 自動デプロイ（main ブランチ）

## 技術スタック

- Next.js 14.0.0（Pages Router）/ React 18.2.0
- Vercel（ホスティング）
- Supabase（DB: questionnaires テーブル、service_role キーでRLSバイパス）
- Anthropic API（モデル: `claude-sonnet-4-5`）
- 認証: iron-session（kinkan-app の staff テーブルを認証サーバーとして使用、2026-04-25 Phase G 完了）
  - ログイン: `/auth` でスタッフ選択 + パスワード → kinkan-app の `/api/auth/verify-staff` に問い合わせ
  - パスワード変更は **kinkan-app 側でしかできない**（staff テーブルの単一所有権を維持するため）
  - 初回ログイン（`password_changed=false`）のスタッフも dm-clinic-karte に入れてしまうが、全員が kinkan-app で打刻する運用なので実質的に先に変更強制される
  - 運用ルール: 新規スタッフには「初回パスワード変更は必ず勤怠アプリから」と案内
- スタイル: 全てインラインCSS（CSSファイルなし）

## 環境変数（Vercel設定済み）

`APP_SHARED_PASSWORD` / `ANTHROPIC_API_KEY` / `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`

## ファイル構成

```
├── middleware.js                  # 認証（cookie チェック、/auth,/api/auth スキップ）
├── lib/
│   ├── config.js                  # CLAUDE_MODEL / MAX_TOKENS 定数（※現在未参照、各所ハードコード）
│   └── supabase.js                # Supabase クライアント（service_role）
├── lib/
│   ├── voiceSummary.js            # 音声→AI整形のクライアント側プロンプト（現病歴/既往歴2モード）
│   └── voiceVocabulary.js         # 音声誤認識補正用の語彙リスト（病院109/病名99/薬剤309/検査30等）
├── components/
│   ├── DMIntakeTool.js            # DM基本（2型）
│   ├── T1DIntakeTool.js           # 1型糖尿病（成人）
│   ├── HTHLIntakeTool.js          # 高血圧・脂質異常症
│   ├── GDMIntakeTool.js           # 妊娠糖尿病
│   ├── RHIntakeTool.js            # 反応性低血糖
│   ├── PedT1DIntakeTool.js        # 小児1型糖尿病
│   └── VoiceMemoSection.js        # 音声入力UI（mode=currentIllness/pastHistory）+ 要DR確認チェック
├── pages/
│   ├── index.js                   # トップ（6フォーム選択カード）
│   ├── auth.js                    # ログイン画面
│   ├── dm.js / t1d.js / hthl.js / gdm.js / rh.js / ped-t1d.js  # 各→re-export
│   ├── list.js                    # 一覧（日付フィルタ・検索・30秒自動更新・削除）
│   ├── detail/[id].js             # 詳細（カルテ表示・コピー・再生成・ステータス変更）
│   └── api/
│       ├── auth.js                # POST: パスワード認証→cookie
│       ├── generate.js            # POST: Anthropic APIプロキシ（経路A用）
│       ├── generate-karte.js      # POST: form_type別プロンプト組立→生成（経路B: 再生成用）
│       ├── questionnaire.js       # GET/POST/PATCH/DELETE: Supabase CRUD
│       └── questionnaire/detail.js # GET: 単一レコード取得
```

## 6つの問診フォーム（2026-04-26時点 step構成）

| form_type | コンポーネント | パス | ステップ |
|---|---|---|---|
| DM基本 | DMIntakeTool | /dm | 重要確認→受診理由→**医療背景・家族歴**→生活情報→体格・要望→**病歴・経緯の聴取** |
| 1型糖尿病 | T1DIntakeTool | /t1d | 重要確認→受診理由→1型糖尿病→既往・生活歴→体格・要望→**病歴・経緯の聴取** |
| 高血圧・脂質異常症 | HTHLIntakeTool | /hthl | 受診理由→病名・検査→既往・生活歴→体格・要望→**病歴・経緯の聴取** |
| 妊娠糖尿病 | GDMIntakeTool | /gdm | 受診理由→妊娠・病名→既往・生活歴→体格・要望→**病歴・経緯の聴取** |
| 反応性低血糖 | RHIntakeTool | /rh | 症状・きっかけ→既往・生活歴→体格・要望→**病歴・経緯の聴取** |
| 小児1型糖尿病 | PedT1DIntakeTool | /ped-t1d | 受診理由→1型糖尿病→協力体制→小児慢性→生活・家族→体格・要望→**病歴・経緯の聴取** |

### 「病歴・経緯の聴取」step（2026-04-26追加）
全フォーム最終 step。VoiceMemoSection 2つを集約:
- `mode="currentIllness"`: 現病歴の音声入力 → AI整形（受診理由サマリーに統合）
- `mode="pastHistory"`: 既往歴の音声入力 → AI整形（♯既往疾患リストに統合）+ ガイダンス + **要ドクター確認チェック**

### DMの大規模再編（2026-04-26、他5フォームは未展開・A案）
DMのみ「病気について」step を解体し以下に分散:
- ＃糖尿病・インスリン治療中・エコー検査 → **「医療背景・家族歴」step（旧「既往・家族歴」をrename）** に統合
- 合併する疾患・重要既往歴・その他の病気 → **「病歴・経緯の聴取」step** に集約

他5フォームは A案（voice section 集約のみ）で温存。B案（DM完全模倣）は ROI が悪いため未着手。

## アーキテクチャ: カルテ生成の2経路

### 経路A: フォーム送信時（メイン）
`components/*IntakeTool.js` の `generateKarte()` → `/api/generate`（プロキシ）→ Claude API → `/api/questionnaire` POST で保存

### 経路B: 詳細画面で再生成
`detail/[id].js` → `/api/generate-karte`（サーバー側でプロンプト組立）→ Claude API → `/api/questionnaire` PATCH で上書き

### ⚠️ プロンプト二重管理（最重要注意点）
プロンプトは経路A（コンポーネント内、6ファイル）と経路B（generate-karte.js、6 form_type分）の**計7箇所に同一内容が存在**する。
**プロンプト修正時は必ず7ファイル全て同期すること。** 片方だけだと初回生成と再生成で不整合が出る。

修正対象パターン:
```
components/DMIntakeTool.js       (DM基本 client)
components/T1DIntakeTool.js      (1型糖尿病 client)
components/PedT1DIntakeTool.js   (小児1型糖尿病 client)
components/HTHLIntakeTool.js     (高血圧・脂質異常症 client)
components/GDMIntakeTool.js      (妊娠糖尿病 client)
components/RHIntakeTool.js       (反応性低血糖 client)
pages/api/generate-karte.js      (再生成用 server, 6 form_type 全部含む)
```

## 音声入力サブシステム（2026-04-26時点）

### 概要
現病歴・既往歴の自由発話を Claude に整形させてカルテに統合する仕組み。

### コンポーネント
- `components/VoiceMemoSection.js`: 録音/テキスト入力UI + AI整形ボタン + 整形結果表示
  - mode='currentIllness': 受診理由サマリー用（1〜3文に整形）
  - mode='pastHistory': 既往歴用（♯病名（時期・病院・薬）形式に整形）+ 要DR確認チェック
  - 録音中はリアルタイム認識バッジ表示、AI整形完了後は録音欄を折りたたみ

### プロンプト
- `lib/voiceSummary.js`:
  - `summarizeForKarte(transcript, formData, formType)`: 現病歴整形
  - `summarizeForPastHistory(transcript)`: 既往歴整形
  - 共に `buildVocabularyHint()` の語彙リストをコンテキストとして渡す
  - 今日の日付を和暦で渡し「○年前」を自動換算させる仕組み

### 語彙リスト（lib/voiceVocabulary.js）
音声認識誤認識を AI に補正させるための語彙集。**ユーザー（医師）が直接編集する前提**。

| 定数 | 件数 | 内容 |
|---|---|---|
| COMMON_HOSPITALS | 109 | 上尾市医師会89件 + 周辺市町村20件 |
| COMMON_DISEASES | 99 | 既往歴+糖尿病合併症+DM合併疾患 |
| COMMON_MEDICATIONS | 309 | 糖尿病/循環器/脂質/抗血栓/狭心症/尿酸+CGM/CSII機器 |
| COMMON_LAB_TESTS | 30 | HbA1c/eGFR/BNP/CPR/CPI 等 |
| COMMON_SYMPTOMS | 16 | 口渇/多尿/しびれ/低血糖 等 |
| COMMON_CARE_TERMS | 14 | ロカボ/カーボカウント/療養計画書 等 |
| COMMON_DEPARTMENTS | 19 | 一般診療科 |
| HOSPITAL_DEPARTMENTS | 3病院 | 上尾中央総合・自治医大さいたま・さいたま赤十字 の正式診療科リスト |

補正ルール（buildVocabularyHint 内に明示）:
1. 市内クリニックは強制マッチ（「古口呼吸器科」→「こぐち内科呼吸器クリニック」）
2. 3主要病院の診療科は正式名称使用（「上尾中央の糖尿病科」→「上尾中央総合病院 糖尿病内科」）
3. 明らかに市外の大病院（東大病院・聖路加等）はリスト外でも聞こえたまま記載してよい
4. 判定不可な場合のみ「不明」と記載

## Supabase: questionnaires テーブル

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | 自動生成 |
| visit_code | text | 4桁英数字（I,O,0,1除外、衝突時10回リトライ） |
| age | integer | 患者年齢（nullable） |
| form_type | text | 'DM基本' / '1型糖尿病' / '高血圧・脂質異常症' / '妊娠糖尿病' / '反応性低血糖' / '小児1型糖尿病' |
| form_data | jsonb | 問診フォーム全データ |
| generated_karte | text | 生成カルテ記載文 |
| status | text | 'new' → 'done' |
| created_at / updated_at | timestamptz | |

## 共通コードパターン

### state管理
- `up(section, field, value)` — 1階層更新
- `upN(section, parent, field, value)` — 2階層（ネスト）更新
- `toggleArr(section, field, value)` — 配列トグル

### 共通スタイル関数
`inp()` / `lbl()` / `btn(active, color)` / `sBox()` — 全フォームで統一

### 共通サブコンポーネント
`EraYear`（和暦入力）/ `HospitalPicker`（病院選択）/ `DetailBox`（重要既往詳細）/ `AlcoholRow`（飲酒入力）

## form_data 構造（2026-04-26時点）

```js
{
  alert: {...},
  reason: {...},
  disease: {
    ...
    dmSymptoms: { selected: [], otherText: "" },  // DM/T1D/PedT1Dのみ
  },
  history: {...},
  lifestyle: {...},
  body: {
    ...
    doctorGender: "",     // "" | "指定なし" | "女性医師希望" | "男性医師希望" | "院長（初回のみ）"
    patientFlag: "通常",
    doubleSlot: false,
  },
  voiceMemo: { transcript, aiSummary },                          // 現病歴音声入力
  voicePastHistory: { transcript, aiSummary, needsDoctorReview }, // 既往歴音声入力 + 要DR確認フラグ
}
```

## カルテ整形ルール（厳守、全form_typeに統一）

### ♯疾患の空行ルール（5条件）

```
＃糖尿病        ← 自院管理（連続）
＃HT
＃HL
（1行空ける）
＃肺癌（自治医大さいたま医療センター）  ← 他院管理
＃膀胱癌（上尾中央総合病院）            ← 他院管理（連続）
＃心房細動（さいたま赤十字病院）          ← 他院管理（連続）
【アレルギー歴】なし   ← 空行なし
```

1. 自院管理＃疾患（＃糖尿病/＃HT/＃HL等）は連続列挙し空行なし
2. 自院管理ブロック→他院管理疾患の前にのみ1行空ける
3. 他院管理疾患同士は連続列挙し空行なし
4. 他院管理最終行→【アレルギー歴】は空行なし
5. 【事前聴取時 申し送り事項】最終□行→【診察にあたっての要望】は空行なし

### 和暦統一ルール
- 時期は **和暦のみ**（H8、R5、平成8年、令和5年）
- **西暦・年齢・「○年前」「○ヶ月前」は絶対に使わない**
- AI が今日の日付を知っているので「5年前」と話されたら自動換算（lib/voiceSummary.js の `todayWareki()` で渡す）

### 申し送り事項のルール

**全6フォーム共通:**
- 先頭: `□通院のご案内をお渡し済`
- `voicePastHistory.needsDoctorReview === true` のとき: `□既往歴：要ドクター確認` を追加
- 医師希望: 「指定なし」or 未入力 → 出力しない / 選択時 → 「□医師希望：女性医師」「□医師希望：男性医師」「□医師希望：院長（初回のみ）」形式

**反応性低血糖（RH）のみ:**
- `□自費CGM（リブレ）装着済` を **全例必須記載**（条件分岐ではない）

### 糖尿病の症状（DM/T1D/PedT1Dのみ）
申し送り事項の **上** に【糖尿病の症状】セクション。9項目（のどが渇く/尿の回数が多い/体がだるい/手のしびれ/足のしびれ/足がつりやすい/視力が落ちた/食後の低血糖を心配している/その他）から選択、「・」区切り横一列表示。

### 既往歴音声入力の出力形式
`♯病名（時期・治療した病院・現在の通院先・内服薬）` の形式で1行1疾患。

例:
```
♯高血圧（H28から、○○内科でアムロジピン 5mg 内服中）
♯胃癌（H28、□□病院で胃部分切除術、現在経過観察、内服なし）
```

該当しない情報は記載しない（「不明」など埋めない）。

## 既知バグパターン

1. **`getCurrentMonth()` 未定義**: コンポーネント関数外で呼ぶとエラー。GDM/PedT1Dで発生歴あり
2. **visitCode重複表示**: 非同期保存のstate更新順序に注意
3. **duplicate key**: 病院ボタンで `key={hosp}` → `key={hosp+dept}` に
4. **AI空行挿入**: テンプレートリテラル内の空行がAI出力に混入。プロンプトに「空行なし」明記
5. **プロンプト二重管理**: 経路AとBの片方だけ修正すると再生成で不整合（上記参照）
6. **lib/config.js未参照**: `CLAUDE_MODEL`定義済みだが各所ハードコード。統一TODO

## 実装済み機能（2026-04月時点）

- 全6フォーム正常稼働（生成・保存・受付番号・一覧・詳細・再生成）
- 通院頻度ボタン（重要既往歴の通院先選択後に表示）
- 網膜症「不明」選択肢
- 職業クイック選択ボタン（10種）
- 開示状況2軸（小児T1D: クラスメート/先生）
- BMIリアルタイム表示＋判定
- 一覧: 日付フィルタ / 受付コード検索 / 30秒ポーリング / 新着バナー / タイトルバー件数
- 一覧削除: 個別 / 当日完了 / 完了全件 / 全件
- 詳細: カルテコピー（Clipboard API+フォールバック）/ 再生成 / ステータス変更（新規→完了）

## 開発運用ルール

1. **Claude Code向けプロンプトは1塊のmarkdownコードブロック**で出す（コピーボタン1回取得）
2. **可能な限り複数タスクを1プロンプトにまとめて一括コミット**
3. コード修正時は**フルパスを明示**（例: `components/DMIntakeTool.js`）
4. プロンプト修正は**必ず2箇所**（コンポーネント内 + generate-karte.js）
5. 実装詳細はClaude Codeに委ねてよい
6. 確認はまつ判断が必要なもののみ、発注前に済ませる

---

## セキュリティ監査結果(2026-04-24)

### ✅ 対応済み(58aff02: 自宅セッション)

1. `/api/auth`: timingSafeEqual + HttpOnly/Secure/SameSite=Strict cookie
2. `/api/generate`: model(3種類)と max_tokens(4000上限)のホワイトリスト
3. `/api/questionnaire` DELETE: 全件削除(deleteAllRegardless)エンドポイント削除

### ✅ 対応済み(2026-04-24 クリニックセッション)

4. `/api/generate-karte` 入力検証追加:
   - form_type ホワイトリスト(6種)
   - form_data サイズ上限(100KB)
   - form_data 型チェック(object 必須)

### 🔴 高リスク(短期で対処検討)

- **レート制限なし**: `/api/generate*` は Anthropic コスト直結。認証済みユーザーの連打で高額請求の可能性
  - 対策候補: Vercel KV / Upstash Redis で IP 別カウント(1分10リクエスト等)
  - 工数: 1〜2h

- **操作ログなし**: 誰が何を削除・編集したか追跡不可(共有パスワードで「誰」は特定できないが「いつ・何・どのID」は残せる)
  - 対策: audit_logs 相当のテーブル新設
  - 工数: 1〜2h

### 🟡 中リスク(要判断)

- **共有パスワード → 個別アカウント化(2026-04-24 方針決定)**:
  - kinkan-app Phase 2(iron-session 導入)に合わせて、**kinkan-app の staff テーブルを認証サーバーとして使う**方式で統合予定(案B採用)
  - Supabase プロジェクトは分離維持(kinkan-app: ktrg... / dm-clinic-karte: ozixf...)
  - kinkan-app に `/api/auth/verify-staff` を新設、dm-clinic-karte はそこを fetch
  - 退職者・パスワード変更は kinkan-app 側の1箇所で両アプリに反映
  - 実装計画: `kinkan-app/docs/design/security-phase2-plan.md` の Phase G 参照
  - 工数: dm-clinic-karte 側 +3h(iron-session + login 書き換え)

- **/api/questionnaire POST/PATCH の入力検証なし**: age/form_type/generated_karte の型・値検証なし
  - 対策: generate-karte と同様のホワイトリスト・型検証
  - 工数: 30分

### 🟢 低リスク(商用展開時に検討)

- **PHI(患者医療情報)の暗号化・保管要件**: Supabase の保管場所・法的要件(個人情報保護法)の確認
- **visit_code のブルートフォース耐性**: 30^4=81万通り、認証必須なので実害低い

### 監査から得た知見

- middleware.js ですべての /api/* を保護しているので、「個別 API に認証欠落がないか」のチェックは不要(middleware で一括防御)
- ただし Anthropic API のコストや PHI の取扱いは、認証突破されなくても内部者リスクがある。個別認証・ログ・レート制限で防御層を増やす価値あり

---

## タスク履歴

（ここに完了タスクを追記していく）

### 2026-04-24 クリニックセッション

- `/api/generate-karte` 入力検証追加(form_type ホワイトリスト・form_data サイズ上限・型チェック)
- CLAUDE.md にセキュリティ監査結果を追記

### 2026-04-26 大規模機能追加・運用調整セッション

#### 全6フォーム対象
- アレルギー選択肢に「金属」追加
- 眼科項目を「眼底検査の有無 + 糖尿病-眼科連携手帳の有無」に変更（受けてない/持ってない場合は申し送り事項に「眼科連携手帳をお渡し」自動追加）
- 申し送り事項の先頭に「□通院のご案内をお渡し済」追加
- 医師希望表記改善（指定なし時は非出力、選択時は「□医師希望：女性医師」形式）
- 病名の空行ルール5条件を厳守
- 「要ドクター確認」チェックボックス（VoiceMemoSection の pastHistory モード）→ チェック時は申し送り事項に「□既往歴：要ドクター確認」自動追加
- 最終ステップに「病歴・経緯の聴取」step を追加し VoiceMemoSection 2つを集約（A案）
- 「編集内容を保存」ボタンに saving state + disabled + 「💾 保存中...」表示（反応性改善）
- 紹介の理由に「転居のため」追加（RH除く5フォーム）

#### DM/T1D/PedT1D のみ
- 糖尿病の症状チェック群9項目を追加（インスリン治療中の直下）
- カルテの【事前聴取時 申し送り事項】の上に【糖尿病の症状】セクション

#### DMのみ（試作・他フォーム未展開）
- step構成大規模再編: 旧「病気について」step を解体
  - ＃糖尿病・インスリン治療中・エコー検査 → 「医療背景・家族歴」step（旧名「既往・家族歴」をrename）に統合
  - 合併する疾患・重要既往歴・その他の病気 → 「病歴・経緯の聴取」step に集約

#### 問診一覧 (/list)
- 「全ての問診を完了済にする」ボタン追加（院長・事務長・リーダーのみ表示、サーバー側でも権限チェック）
- 詳細ページから「問診データ（生データ）」JSON ダンプ表示を削除

#### 反応性低血糖（RH）のみ
- 「□自費CGM（リブレ）装着済」を全例必須記載化（条件分岐廃止）

#### 音声入力周り
- AI整形結果 textarea を10行ベース（pastHistory 12行/ currentIllness 7行）に拡大
- リアルタイム認識中は赤枠 + 「● 録音中（リアルタイム認識）」バッジ
- 上部録音パネルを AI整形完了後に折りたたみ（再展開可）
- 和暦自動換算（「5年前」→「R3」、AI が今日の日付ベースで計算）
- 語彙リスト lib/voiceVocabulary.js を新規作成し大幅拡充（薬剤309件、上尾市医師会89件、3病院の正式診療科マップ等）

#### 削除した機能（重要）
- **既往歴の聞き漏れチェック機能**（lib/pastHistoryFollowup.js + components/PastHistoryFollowupCheck.js）
  - 試作後、運用が複雑すぎるため廃止
  - 「事務スタッフが読み上げ→患者から聞く→録音→AI反映」のステップが時間圧迫下で機能しない
  - シンプルな「ガイダンス文 + 要DR確認チェックボックス」に置換
- 教訓: 複雑な AI フィーチャーは「現場で本当に使われるか」を最優先で検証する

#### 残課題（次セッション以降）
- prompt caching の実装（5分TTLが運用パターン（5患者/日）と噛み合わず効果限定的、優先度低）
- T1D / PedT1D / HTHL / GDM / RH の step大規模再編（B案、現状はA案で voice section 集約のみ）
- レート制限（/api/generate*）
- 操作ログ（audit_logs相当）

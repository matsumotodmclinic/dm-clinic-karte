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
- 認証: cookie ベース（`app_auth=ok`、7日間、middleware.js で制御）
- スタイル: 全てインラインCSS（CSSファイルなし）

## 環境変数（Vercel設定済み）

`APP_SHARED_PASSWORD` / `ANTHROPIC_API_KEY` / `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`

## ファイル構成

```
├── middleware.js                  # 認証（cookie チェック、/auth,/api/auth スキップ）
├── lib/
│   ├── config.js                  # CLAUDE_MODEL / MAX_TOKENS 定数（※現在未参照、各所ハードコード）
│   └── supabase.js                # Supabase クライアント（service_role）
├── components/
│   ├── DMIntakeTool.js            # DM基本（2型）       1037行
│   ├── T1DIntakeTool.js           # 1型糖尿病（成人）    749行
│   ├── HTHLIntakeTool.js          # 高血圧・脂質異常症    598行
│   ├── GDMIntakeTool.js           # 妊娠糖尿病           589行
│   ├── RHIntakeTool.js            # 反応性低血糖         532行
│   └── PedT1DIntakeTool.js        # 小児1型糖尿病        697行
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

## 6つの問診フォーム

| form_type | コンポーネント | パス | ステップ |
|---|---|---|---|
| DM基本 | DMIntakeTool | /dm | 重要確認→受診理由→病気→既往・家族歴→生活情報→体格・要望 |
| 1型糖尿病 | T1DIntakeTool | /t1d | 重要確認→受診理由→1型糖尿病→既往・生活歴→体格・要望 |
| 高血圧・脂質異常症 | HTHLIntakeTool | /hthl | 受診理由→病名・検査→既往・生活歴→体格・要望 |
| 妊娠糖尿病 | GDMIntakeTool | /gdm | 受診理由→妊娠・病名→既往・生活歴→体格・要望 |
| 反応性低血糖 | RHIntakeTool | /rh | 症状・きっかけ→既往・生活歴→体格・要望 |
| 小児1型糖尿病 | PedT1DIntakeTool | /ped-t1d | 受診理由→1型糖尿病→協力体制→小児慢性→生活・家族→体格・要望 |

## アーキテクチャ: カルテ生成の2経路

### 経路A: フォーム送信時
`components/*IntakeTool.js` の `generateKarte()` → `/api/generate`（プロキシ）→ Claude API → `/api/questionnaire` POST で保存

### 経路B: 詳細画面で再生成
`detail/[id].js` → `/api/generate-karte`（サーバー側でプロンプト組立）→ Claude API → `/api/questionnaire` PATCH で上書き

### ⚠️ プロンプト二重管理（最重要注意点）
プロンプトは経路A（コンポーネント内）と経路B（generate-karte.js）の**2箇所に同一内容が存在**する。
**プロンプト修正時は必ず両方を更新すること。** 片方だけだと再生成時に旧フォーマットで出力される。

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

## タスク履歴

（ここに完了タスクを追記していく）

# 音声入力 + AI要約機能 実装計画(案B)

作成日: 2026-04-25
状態: 設計完了、実装待ち
工数見積: 4〜5h(実績ベースなら 2〜3h)
対象アプリ: dm-clinic-karte

---

## 1. 背景・目的

### 現状の問題

患者の問診時に「経緯を話したい」というニーズがあるが、現状フォームでは:
- 各入力欄(病院名、科名、紹介理由など)が独立しており、長い経緯を入力しづらい
- スタッフが患者の話を聞きながら**要点を抽出して各欄に入力する負担**が大きい
- 患者は経緯を全部話したいので、欄ごとの細かい質問だと面倒

### 目的

患者の自由発話(音声)を **そのまま受けて、AI が医療的に整形した経緯テキストをカルテに追加**する機能を提供する。スタッフの聞き取り負担を最小化しつつ、患者の発話欲求も満たす。

---

## 2. 採用方式: 案B(フォーム末尾に音声入力 + AI 要約)

### 動作フロー

```
1. 既存フォーム入力(病院名、科名、症状など)を埋める
2. フォーム末尾の「📋 経緯の自由発話(任意)」欄を表示
3. [🎤 録音開始] をタップ → 患者が話す
   ↓
4. ブラウザ Web Speech API がリアルタイムで音声 → テキスト変換
   テキストエリアにライブ表示
   ↓
5. [⏹ 停止] でテキスト確定(編集可能)
   ↓
6. [✨ AI で整形してカルテに追加] をタップ
   ↓
7. Claude API(既存の generate-karte 経由)で医療的に整形
   ↓
8. 整形結果を「現病歴」セクションに自動挿入
```

### なぜ案B(他案を退けた理由)

- 案A(各欄ごとに 🎤): 欄が多くて UI 煩雑、患者の自由発話に合わない
- 案C(発話 → AI 自動振り分け): AI 解釈ミスで誤入力リスク、検証コスト大
- **案B**: シンプル + 補助的、既存フォームを壊さない、コスト最小

---

## 3. 技術スタック

### 音声認識: Web Speech API(ブラウザ内蔵、無料)

```javascript
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)()
recognition.lang = 'ja-JP'
recognition.continuous = true       // 長時間録音
recognition.interimResults = true   // 中間結果(リアルタイム表示)

recognition.onresult = (event) => {
  // 確定/暫定結果を取得
}
recognition.start()
```

#### 対応ブラウザ

| ブラウザ | 対応 | 備考 |
|---|---|---|
| Safari iPad | ✅ | iOS 14.5+ で対応 |
| Chrome (PC/Android) | ✅ | webkitSpeechRecognition |
| Edge | ✅ | webkitSpeechRecognition |
| Firefox | ❌ | クリニックで使わない想定 |

#### マイク権限

- 初回起動時にブラウザがダイアログを表示
- 許可後は自動で利用可能
- 拒否されても再度許可可能(設定から)

### AI 要約: Claude Sonnet 4.5 (既存)

- `/api/generate` を使う(既存のAnthropic プロキシ、ホワイトリスト済)
- model: `claude-sonnet-4-5`
- max_tokens: 800(整形結果は 200〜400 トークン想定で十分)

#### プロンプト設計

```
あなたは医療カルテ整形 AI です。患者の自由発話を、医療的な現病歴セクションとして整形してください。

【ルール】
- 1〜3文程度に簡潔にまとめる
- 医療的な要点(発症時期、症状、治療歴、紹介経緯)を抽出
- 患者の主観表現(「すごく」「めちゃくちゃ」等)は省略
- 専門用語に置換可能な部分は置換(例:血糖が悪い → 血糖コントロール不良)
- 推測は記載せず、事実のみ
- 受診理由がフォームの reason.type にあれば、それと整合する形で書く

【発話内容】
{transcript}

【既存フォームデータ(参考)】
受診理由: {reason.type}
病院名: {reason.referralFrom}
科名: {reason.referralDept}

【出力フォーマット】
1〜3文の現病歴テキスト(「。」で終わる)
```

---

## 4. UI 設計

### 配置場所

各 IntakeTool(DM/T1D/HTHL/GDM/RH/PedT1D)の最後のステップ末尾、`generateKarte` ボタンの**前**。

### コンポーネント

```jsx
<VoiceMemoSection
  formData={data}
  formType={formType}
  onAppend={(integratedText) => {
    // data に integratedText を追加(後で generateKarte 時に使用)
    up('voiceMemo', 'transcript', rawTranscript)
    up('voiceMemo', 'aiSummary', integratedText)
  }}
/>
```

### 画面イメージ

```
┌────────────────────────────────────────────┐
│ 📋 経緯の自由発話(任意)                      │
│                                            │
│ 患者さんに経緯を話してもらってください。       │
│ 録音すると AI が医療的に整形してカルテに追加します。│
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ 録音テキスト(編集可)                   │  │
│  │ ○○病院で糖尿病と言われて、            │  │
│  │ 血糖コントロールができなくて...         │  │
│  └──────────────────────────────────────┘  │
│                                            │
│ [🎤 録音開始]   [✨ AI で整形]              │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ AI 整形結果(カルテに追加されます)      │  │
│  │ ○○病院でDM管理中、血糖コントロール不良 │  │
│  │ のため当院紹介。                       │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘

[✨ カルテ文を生成] (既存ボタン)
```

### 状態遷移

```
state: { transcript, isRecording, aiSummary, loading }

初期 → 録音開始ボタン押下 → isRecording=true
↓
ライブ認識中 → recognition.onresult で transcript 更新
↓
停止ボタン → isRecording=false、transcript 確定
↓
AI整形ボタン → loading=true、Claude API 呼び出し
↓
完了 → aiSummary に格納、generateKarte 実行時にカルテ末尾に挿入
```

---

## 5. ファイル構成

### 新規ファイル

- `components/VoiceMemoSection.js`(共通コンポーネント、約 150 行)
- `lib/speechRecognition.js`(Web Speech API ラッパー、約 80 行)
- `lib/voiceSummary.js`(Claude API 呼び出し、約 40 行)

### 変更ファイル

- 6 つの IntakeTool に `<VoiceMemoSection>` を追加
  - `components/DMIntakeTool.js`
  - `components/T1DIntakeTool.js`
  - `components/HTHLIntakeTool.js`
  - `components/GDMIntakeTool.js`
  - `components/RHIntakeTool.js`
  - `components/PedT1DIntakeTool.js`
- 各 generateKarte() で、aiSummary があれば現病歴に挿入
- `pages/api/generate-karte.js` でも同様の挿入処理(プロンプト二重管理ルール)

### state 拡張

各フォームの state に `voiceMemo` セクションを追加:

```javascript
voiceMemo: {
  transcript: '',     // 録音した生テキスト
  aiSummary: '',      // AI 整形結果(カルテに挿入される)
}
```

---

## 6. 実装手順(段階的)

### Phase 1: コア機能(2h)

- [ ] `lib/speechRecognition.js` 作成
  - useSpeechRecognition() React hook
  - start/stop/transcript/isRecording を export
- [ ] `lib/voiceSummary.js` 作成
  - summarizeForKarte(transcript, formData, formType) 関数
  - /api/generate に整形プロンプト送信
- [ ] `components/VoiceMemoSection.js` 作成
  - UI(録音ボタン、テキストエリア、AI 整形ボタン)
  - useSpeechRecognition + summarizeForKarte を統合

### Phase 2: フォーム統合(1.5h)

- [ ] DMIntakeTool に統合(1個目で動作確認)
- [ ] generateKarte の prompt に aiSummary を含める
- [ ] generate-karte.js の DM 用 prompt にも対応(同期)
- [ ] DM で動作テスト → OK なら他5フォームに展開

### Phase 3: 全フォーム展開(1h)

- [ ] T1D / HTHL / GDM / RH / PedT1D に統合
- [ ] 各 generate-karte.js の form_type 別 prompt に挿入処理を追加

### Phase 4: テスト + 微調整(0.5h)

- [ ] iPad Safari でマイク許可ダイアログ確認
- [ ] 各フォームで録音 → 整形 → カルテ生成 を一通り
- [ ] 認識精度に応じてプロンプト調整

---

## 7. 動作テスト項目

- [ ] iPad Safari で録音できる(初回マイク許可ダイアログ表示)
- [ ] 認識テキストがリアルタイム表示される
- [ ] 録音中に [停止] で確定できる
- [ ] テキストエリアで認識結果を編集できる
- [ ] AI 整形が成功する(Claude API レスポンス)
- [ ] 整形結果がカルテ生成時に「現病歴」に挿入される
- [ ] 録音せずに通常入力だけでもカルテが生成される(後方互換)
- [ ] 各 6 フォームで同様に動作する
- [ ] エラー時(API 失敗、マイク許可拒否、ネット切断)に適切なメッセージ

---

## 8. リスクと対策

### リスク 1: 音声認識精度が低い

- 医療用語(「糖尿病」→「東邦病」など誤認識される可能性)
- **対策**: テキストエリアで編集可能にする、AI が医療的に補正できるようプロンプト調整

### リスク 2: 患者が長く話しすぎる

- 認識テキストが膨大になり、AI 入力が大きくなる
- **対策**: 録音時間に上限(例: 3分)、文字数上限(例: 2000文字)で警告表示

### リスク 3: マイク許可が拒否される

- iPad Safari でマイク許可されてないと録音不可
- **対策**: try/catch でエラーハンドリング、許可方法のヘルプ表示

### リスク 4: API コスト膨張

- 1問診で複数回録音 → 何回も AI 呼び出し
- **対策**: AI 整形は1問診あたり1回のみ可能(2回目以降は確認ダイアログ)
- でも実コストは 1円以下/回なので深刻ではない

### リスク 5: 患者の発話に PHI(個人情報)が大量に含まれる

- 「○○病院の○○先生から紹介で...」のような文脈で実名が入る
- **対策**: 既存の問診と同じ扱い(Supabase に保存、医療情報として管理)。
  PII を理由に AI に送らないという選択は無いので、現状運用と同じ扱いで OK。

---

## 9. 工数見積

| Phase | 作業 | 見積 | 実績予測 |
|---|---|---|---|
| 1 | コア機能 | 2h | 1.5h |
| 2 | DM フォーム統合 + テスト | 1.5h | 1h |
| 3 | 他5フォーム展開 | 1h | 0.5h |
| 4 | テスト + 微調整 | 0.5h | 0.5h |
| | バッファ | 1h | 0h |
| | **合計** | **6h** | **3.5h** |

実績ベースなら、自宅セッション半日(3〜4h)で完成見込み。

---

## 10. 運用上の注意

### 患者への説明

- 「録音させていただく経緯は、診察の参考にし、AI で医療カルテ用に整形します」と事前同意
- 個人情報保護方針に「音声を一時的にテキスト化する」旨を追記

### スタッフへの説明

- 「音声認識は完璧ではないので、テキスト確認後に AI 整形してください」
- 「AI 整形結果も最終的にカルテに表示されるので、生成カルテで確認できます」

### 録音データの保存

- **音声データは保存しない**(ブラウザ内でテキスト化のみ、ファイル化なし)
- テキストデータは form_data の voiceMemo として questionnaires テーブルに保存される
- カルテ生成後の generated_karte には整形済み文章のみ含まれる

---

## 11. 商用展開時の拡張

商用化時にカスタマイズが必要なポイント:

- **クリニックごとの整形プロンプト**: 内科系 vs 整形外科系で表現が違う
- **言語対応**: 多言語クリニックなら English / 中文も
- **業務フロー連携**: 受付スタッフ vs 看護師スタッフで役割分担
- **音声認識の精度向上**: 必要なら Whisper API 導入(有料、より高精度)

---

## 12. 着手順序

1. 設計合意(本ドキュメント): 完了
2. Phase 1: コア機能実装(2h)
3. Phase 2: DM 統合 + 実機テスト(1.5h)
4. Phase 3: 他フォーム展開(1h)
5. Phase 4: 微調整 + 最終テスト(0.5h)
6. 本番デプロイ
7. クリニックで実運用開始 → スタッフフィードバックを収集

**自宅のまとまった時間(3〜4h)で完成想定**。クリニックでの細かい調整は後日。

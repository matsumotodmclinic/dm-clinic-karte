// 既往歴の聞き漏れチェック (ルールベース + AI ハイブリッド)
//
// 設計:
//   - RULES: 100例から抽出した頻出既往歴のキーワード → 必要な追加質問のマッピング
//     (即時表示・無料・予測可能)
//   - aiSuggestFollowups: 全既往歴リストを Claude に投げて、ルールで拾えない病名や
//     患者の文脈に応じた追加質問を提案させる (ルールの保険)
//
// 利用元: components/PastHistoryFollowupCheck.js

// 病名キーワード(部分一致 or 正規表現) → 追加質問リスト
// match は文字列(includes判定) または RegExp
//
// 質問ポリシー(2026-04-26 ユーザー指示):
//   - 手術系: 術式は不要、実施した医療機関名と時期のみ
//   - コントロール状況系: 通院中の医療機関名のみ(治療内容・薬の詳細は不要)
//   - 精神疾患: 通院先のみ(服薬詳細は不要、種類が膨大なため)
//   - 眼科: 術後 or 経過観察 + 通院先の医療機関名
const RULES = [
  // 手術系(医療機関名と時期のみ)
  { match: /胆[嚢のう]摘出|胆摘/, name: '胆嚢摘出', questions: ['手術時期（○年前 / 平成○年）', '手術を実施した医療機関'] },
  { match: /胆石/,                  name: '胆石',     questions: ['発作経験の有無', '胆嚢摘出済 or 経過観察', '通院中の医療機関'] },
  { match: /虫垂炎|盲腸/,           name: '虫垂炎',   questions: ['手術時期', '手術を実施した医療機関'] },
  { match: /椎間板ヘルニア/,        name: '椎間板ヘルニア', questions: ['手術 or 保存療法', '手術時期', '手術を実施した医療機関'] },
  { match: /前立腺[癌がん]/,        name: '前立腺癌', questions: ['治療時期', '治療を実施した医療機関', '現在のフォロー医療機関'] },
  { match: /乳[癌がん]/,            name: '乳癌',     questions: ['治療時期', '治療を実施した医療機関', '現在のフォロー医療機関'] },
  { match: /膀胱[癌がん]/,          name: '膀胱癌',   questions: ['治療時期', '治療を実施した医療機関', '現在のフォロー医療機関'] },

  // コントロール状況系(通院先の医療機関のみ)
  { match: /高尿酸|痛風/,           name: '高尿酸血症/痛風', questions: ['通院中の医療機関'] },
  { match: /慢性腎[症臓不全]|CKD/,  name: '慢性腎臓病', questions: ['通院中の医療機関'] },
  { match: /透析/,                  name: '透析',     questions: ['導入時期', '透析を行っている医療機関'] },
  { match: /気管支喘息|喘息/,       name: '気管支喘息', questions: ['通院中の医療機関'] },
  { match: /COPD|肺気腫/,           name: 'COPD',    questions: ['通院中の医療機関'] },
  { match: /(慢性)?関節リウマチ|RA/, name: '関節リウマチ', questions: ['通院中の医療機関'] },
  { match: /変形性膝関節|変形性股関節/, name: '変形性関節症', questions: ['手術歴の有無', '通院中の医療機関'] },
  { match: /骨粗[鬆しょう]症/,      name: '骨粗鬆症', questions: ['通院中の医療機関'] },
  { match: /脊柱管狭窄/,            name: '脊柱管狭窄症', questions: ['手術歴の有無', '通院中の医療機関'] },
  { match: /前立腺肥大/,            name: '前立腺肥大', questions: ['通院中の医療機関'] },
  { match: /子宮筋腫/,              name: '子宮筋腫', questions: ['手術歴の有無', '通院中の医療機関'] },
  { match: /子宮[内]?腺筋症/,       name: '子宮腺筋症', questions: ['通院中の医療機関'] },
  { match: /子宮内膜症/,            name: '子宮内膜症', questions: ['通院中の医療機関'] },
  { match: /更年期障害/,            name: '更年期障害', questions: ['通院中の医療機関'] },
  { match: /鉄欠乏性貧血|貧血/,     name: '鉄欠乏性貧血', questions: ['原因（月経/消化管出血など）', '通院中の医療機関'] },
  { match: /バセドウ|甲状腺機能亢進/, name: 'バセドウ病', questions: ['通院中の医療機関'] },
  { match: /橋本病|甲状腺機能低下/, name: '橋本病/甲状腺機能低下症', questions: ['通院中の医療機関'] },
  { match: /甲状腺/,                name: '甲状腺疾患', questions: ['機能（亢進/低下/正常）', '通院中の医療機関'] },
  { match: /不整脈|心房細動|AF/,    name: '不整脈',   questions: ['通院中の医療機関'] },
  { match: /心不全/,                name: '心不全',   questions: ['通院中の医療機関'] },
  { match: /大動脈瘤/,              name: '大動脈瘤', questions: ['手術歴 or 経過観察', '通院中の医療機関'] },
  { match: /パーキンソン/,          name: 'パーキンソン病', questions: ['通院中の医療機関'] },
  { match: /てんかん/,              name: 'てんかん', questions: ['通院中の医療機関'] },

  // 精神疾患(通院先のみ、服薬詳細なし)
  { match: /鬱病|うつ病|抑うつ/,   name: '鬱病',     questions: ['通院中の医療機関', '現在治療中 or 寛解'] },
  { match: /双極性障害|躁うつ/,     name: '双極性障害', questions: ['通院中の医療機関'] },
  { match: /統合失調症/,            name: '統合失調症', questions: ['通院中の医療機関'] },
  { match: /ADHD|発達障害|自閉/,   name: 'ADHD/発達障害', questions: ['通院中の医療機関'] },
  { match: /パニック障害|不安障害/, name: '不安障害', questions: ['通院中の医療機関'] },
  { match: /認知症|アルツハイマー/, name: '認知症',   questions: ['通院中の医療機関', '介護度'] },

  // 眼科(術後 or 経過観察 + 通院先)
  { match: /網膜剥離|網膜裂孔/,     name: '網膜剥離/裂孔', questions: ['手術時期', '手術を実施した医療機関', '現在のフォロー眼科'] },
  { match: /網膜色素変性/,          name: '網膜色素変性症', questions: ['通院中の眼科'] },
  { match: /加齢黄斑変性|AMD/,      name: '加齢黄斑変性', questions: ['抗VEGF注射の有無', '通院中の眼科'] },
  { match: /白内障.*術後|白内障手術/, name: '白内障術後', questions: ['手術時期（左右）', '手術を実施した医療機関'] },
  { match: /白内障/,                name: '白内障',   questions: ['術後 or 未手術', '通院中の眼科'] },
  { match: /緑内障/,                name: '緑内障',   questions: ['通院中の眼科'] },

  // 消化器
  { match: /胃潰瘍|十二指腸潰瘍/,   name: '消化性潰瘍', questions: ['ピロリ菌除菌歴の有無', '通院中の医療機関'] },

  // 腎・泌尿器
  { match: /腎結石|尿管結石/,       name: '腎/尿管結石', questions: ['発作経験', '通院中の医療機関'] },

  // 呼吸器
  { match: /気胸/,                  name: '気胸',     questions: ['左/右', '時期', '手術歴', '手術を実施した医療機関'] },
  { match: /肺結核|結核/,           name: '結核',     questions: ['治療完了済か', '時期'] },

  // 婦人科
  { match: /妊娠糖尿病|GDM/,        name: '妊娠糖尿病', questions: ['いつの妊娠時', '産後OGTTの結果'] },

  // ENT
  { match: /メニエール|めまい/,     name: 'メニエール病', questions: ['通院中の医療機関'] },
  { match: /中耳炎/,                name: '中耳炎',   questions: ['急性 or 慢性', '手術歴'] },
  { match: /副鼻腔炎|蓄膿/,         name: '副鼻腔炎', questions: ['手術歴', '通院中の医療機関'] },

  // 感染症 / その他
  { match: /帯状疱疹/,              name: '帯状疱疹', questions: ['部位', '時期', '帯状疱疹後神経痛(PHN)の有無'] },
  { match: /B型肝炎/,               name: 'B型肝炎',  questions: ['キャリア or 治療済', '通院中の医療機関'] },
  { match: /C型肝炎/,               name: 'C型肝炎',  questions: ['治療済 or 未治療', '通院中の医療機関'] },
  { match: /SLE|全身性エリテマトーデス|膠原病/, name: '膠原病/SLE', questions: ['通院中の医療機関'] },
  { match: /アレルギー性鼻炎|花粉症/, name: 'アレルギー性鼻炎', questions: ['通院中の医療機関'] },
  { match: /アトピー/,              name: 'アトピー性皮膚炎', questions: ['通院中の医療機関'] },
];

/**
 * AI 整形結果テキスト(♯病名（...）形式)から病名のみを抽出
 * 例: "♯高血圧（10年前から、○○内科）" → "高血圧"
 * @param {string} text
 * @returns {string[]} 重複除去済の病名リスト
 */
export function parseDiseasesFromSummary(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // ♯ または # で始まる行を対象
    const m = trimmed.match(/^[♯#]\s*([^（(]+?)(?:\s*[（(]|$)/);
    if (m && m[1]) {
      const name = m[1].trim();
      if (name && !out.includes(name)) out.push(name);
    }
  }
  return out;
}

/**
 * 病名文字列にマッチするルールを返す（複数マッチありうる）
 * @param {string} name
 * @returns {Array<{name: string, questions: string[]}>}
 */
export function findRuleBasedSuggestions(name) {
  if (!name || typeof name !== 'string') return [];
  const trimmed = name.trim();
  if (trimmed.length === 0) return [];
  const matched = [];
  for (const rule of RULES) {
    const m = rule.match;
    const hit = m instanceof RegExp ? m.test(trimmed) : trimmed.includes(m);
    if (hit) matched.push({ name: rule.name, questions: rule.questions });
  }
  return matched;
}

const AI_PROMPT = (diseases, ageContext) => `あなたは内科外来のベテラン医師です。医療事務スタッフが患者から聴取した既往歴リストを見て、診療上必要な追加質問を簡潔に提案してください。

【目的】
医療事務は医学的知識が不足しているため、聞き漏らしがちな項目を補ってもらう。

【出力ルール】
- 必ず JSON 形式で出力（マークダウン記号 \`\`\`json は不要、JSON 本体のみ）
- 形式: { "suggestions": [ { "disease": "病名", "questions": ["質問1", "質問2"] }, ... ] }
- 各病名につき1〜3個の質問（簡潔に）
- 質問は事務スタッフが患者にそのまま聞ける口語で（専門用語の羅列は避ける）
- 質問の方針:
  - 手術系（〜癌、〜手術後、〜摘出 など）: 手術時期 + 実施した医療機関名
  - 通院中の慢性疾患: 通院中の医療機関名のみ（治療内容・薬の詳細は不要）
  - 精神疾患: 通院中の医療機関のみ（服薬詳細は聞かない、種類が膨大なため）
  - 眼科疾患: 術後 or 経過観察 + 通院中の眼科の医療機関名
- 既に明らかな情報（病名そのもの）は質問しない
- 患者文脈（年齢等）から特に重要なものを優先
- ${ageContext ? `患者: ${ageContext}` : '患者文脈なし'}

【既往歴リスト】
${diseases.map((d, i) => `${i + 1}. ${d}`).join('\n')}

【出力（JSON のみ）】`;

const APPLY_PROMPT = (originalSummary, questions, answerTranscript) => `あなたは医療カルテ整形 AI です。既存の既往歴サマリーと、医療事務スタッフが患者から追加聴取した内容を統合し、サマリーを更新してください。また、まだ未回答の質問を抽出してください。

【既存の既往歴サマリー（♯病名（...）形式）】
${originalSummary}

【聞き漏れチェックで提示された質問リスト】
${questions.map((q, i) => `${i + 1}. ${q.disease}: ${q.question}`).join('\n')}

【追加聴取した患者の回答（テキストまたは音声認識）】
${answerTranscript}

【ルール】
- 元のサマリーの形式（♯病名（時期・病院・薬・備考））を維持
- 回答内容を該当する病名の括弧内に追記（例: 「♯胆石」 → 「♯胆石（10年前、上尾中央総合病院で胆嚢摘出）」）
- 回答が曖昧な場合は推測せず、判明した部分のみ追記
- 元の情報は基本的に保持し、矛盾がある場合は新情報を優先
- 全ての質問に対して、回答テキストから判断して「答えられた質問」と「答えられなかった質問」を分類
- 「答えられなかった質問」は医師が患者に直接確認するために残す
- 出力は必ず JSON 形式（マークダウン \`\`\`json は不要、本体のみ）

【出力形式】
{
  "updatedSummary": "♯病名（...）\\n♯病名（...）\\n...",
  "unansweredQuestions": [
    { "disease": "病名", "question": "未回答の質問内容" },
    ...
  ]
}

【出力（JSON のみ）】`;

/**
 * 既存の既往歴サマリーに、追加聴取した回答を AI で統合
 * @param {string} originalSummary - 既存の AI 整形済み既往歴
 * @param {Array<{ disease: string, question: string }>} questions - 提示済み質問リスト（フラット）
 * @param {string} answerTranscript - 追加聴取した内容
 * @returns {Promise<{ ok: true, updatedSummary: string, unansweredQuestions: Array<{ disease: string, question: string }> } | { ok: false, error: string }>}
 */
export async function applyAnswersToSummary(originalSummary, questions, answerTranscript) {
  if (!originalSummary || originalSummary.trim().length === 0) {
    return { ok: false, error: '元のサマリーが空です' };
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, error: '質問リストが空です' };
  }
  if (!answerTranscript || answerTranscript.trim().length === 0) {
    return { ok: false, error: '回答テキストが空です' };
  }

  const prompt = APPLY_PROMPT(originalSummary, questions, answerTranscript);

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return { ok: false, error: `API エラー (${res.status})` };
    const json = await res.json();
    const text = json?.content?.[0]?.text?.trim() || '';
    if (!text) return { ok: false, error: 'AI 応答が空でした' };

    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return { ok: false, error: 'AI 応答の形式が不正でした', raw: text };
    }
    return {
      ok: true,
      updatedSummary: parsed.updatedSummary || originalSummary,
      unansweredQuestions: Array.isArray(parsed.unansweredQuestions) ? parsed.unansweredQuestions : [],
    };
  } catch (e) {
    return { ok: false, error: 'ネットワークエラー: ' + (e?.message || '不明') };
  }
}

/**
 * AI で既往歴の追加質問を提案
 * @param {string[]} diseases - 病名リスト（空文字除外済み）
 * @param {{ age?: number|string }} [context]
 * @returns {Promise<{ ok: true, suggestions: Array<{ disease: string, questions: string[] }> } | { ok: false, error: string }>}
 */
export async function aiSuggestFollowups(diseases, context = {}) {
  if (!Array.isArray(diseases) || diseases.length === 0) {
    return { ok: false, error: '病名が入力されていません' };
  }
  const ageContext = context?.age ? `${context.age}歳` : '';
  const prompt = AI_PROMPT(diseases, ageContext);

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return { ok: false, error: `API エラー (${res.status})` };
    const json = await res.json();
    const text = json?.content?.[0]?.text?.trim() || '';
    if (!text) return { ok: false, error: 'AI 応答が空でした' };

    // JSON 抽出（マークダウン囲みが混入してもパースできるように）
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return { ok: false, error: 'AI 応答の形式が不正でした', raw: text };
    }
    const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    return { ok: true, suggestions };
  } catch (e) {
    return { ok: false, error: 'ネットワークエラー: ' + (e?.message || '不明') };
  }
}

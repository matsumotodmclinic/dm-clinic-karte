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
const RULES = [
  // 消化器系
  { match: /胆[嚢のう]摘出|胆摘/, name: '胆嚢摘出', questions: ['手術の理由（胆石発作/胆嚢炎/胆嚢ポリープ など）', '手術時期（○年前 / 平成○年）', '手術病院'] },
  { match: /胆石/,                  name: '胆石',     questions: ['発作経験の有無（過去の腹痛/発熱）', '胆嚢摘出の予定 or 経過観察', '内服薬（ウルソなど）'] },
  { match: /虫垂炎|盲腸/,           name: '虫垂炎',   questions: ['手術時期', '腹腔鏡 or 開腹'] },
  { match: /胃潰瘍|十二指腸潰瘍/,   name: '消化性潰瘍', questions: ['ピロリ菌除菌歴', '出血歴の有無', '現在のPPI/H2B 内服'] },

  // 循環器系(重要既往歴に拾われない場合の保険)
  { match: /不整脈|心房細動|AF/,    name: '不整脈',   questions: ['種類（Af/PAC/PVC など）', '抗凝固薬（DOAC/ワーファリン）の有無', '通院先'] },
  { match: /心不全/,                name: '心不全',   questions: ['EF(駆出率)', '原因疾患', '内服薬', '通院先'] },
  { match: /大動脈瘤/,              name: '大動脈瘤', questions: ['部位（胸部/腹部）', '手術歴 or 経過観察', 'サイズ', '通院先'] },

  // 腎臓
  { match: /慢性腎[症臓不全]|CKD/,  name: '慢性腎臓病', questions: ['eGFR or 病期 (G3/G4 など)', '原因疾患（糖尿病性 or その他）', '透析予定の有無', '通院先'] },
  { match: /透析/,                  name: '透析',     questions: ['導入時期', '週何回', 'シャント部位', '原疾患'] },
  { match: /腎結石|尿管結石/,       name: '腎/尿管結石', questions: ['発作経験', '排石済 or 残存', '治療歴（ESWL/手術）'] },

  // 内分泌
  { match: /高尿酸|痛風/,           name: '高尿酸血症/痛風', questions: ['痛風発作の頻度', '直近の尿酸値', '内服薬（フェブリクなど）'] },
  { match: /バセドウ|甲状腺機能亢進/, name: 'バセドウ病', questions: ['治療法（抗甲状腺薬/RI/手術）', '現在の機能（正常化済 or 治療中）', '内服薬'] },
  { match: /橋本病|甲状腺機能低下/, name: '橋本病/甲状腺機能低下症', questions: ['機能（正常 or 低下）', 'チラージン内服の有無と量', '通院先'] },
  { match: /甲状腺/,                name: '甲状腺疾患', questions: ['機能（亢進/低下/正常）', '内服薬', '通院先'] },

  // 呼吸器
  { match: /気管支喘息|喘息/,       name: '気管支喘息', questions: ['発作頻度', '吸入薬の種類', '増悪因子（運動/季節）', '通院先'] },
  { match: /COPD|肺気腫/,           name: 'COPD',    questions: ['喫煙歴との関連', '在宅酸素の有無', '吸入薬'] },
  { match: /気胸/,                  name: '気胸',     questions: ['左/右', '時期', '再発の有無', '手術歴'] },
  { match: /肺結核|結核/,           name: '結核',     questions: ['治療完了済か', '時期', 'INH/RFP 治療歴'] },

  // 神経・整形
  { match: /椎間板ヘルニア/,        name: '椎間板ヘルニア', questions: ['手術 or 保存療法', '時期', '現在のしびれ/痛み'] },
  { match: /脊柱管狭窄/,            name: '脊柱管狭窄症', questions: ['手術歴', '間欠性跛行の程度', '内服薬'] },
  { match: /変形性膝関節|変形性股関節/, name: '変形性関節症', questions: ['手術歴（人工関節置換）', 'ヒアルロン酸注射の有無', '内服薬'] },
  { match: /(慢性)?関節リウマチ|RA/, name: '関節リウマチ', questions: ['通院先', '内服薬（MTX/生物製剤）', '関節破壊の程度'] },
  { match: /骨粗[鬆しょう]症/,      name: '骨粗鬆症', questions: ['骨折歴', '内服/注射薬（ビス/デノスマブ/PTH）', '通院先'] },
  { match: /パーキンソン/,          name: 'パーキンソン病', questions: ['Hoehn-Yahr 分類', '内服薬', '通院先'] },
  { match: /てんかん/,              name: 'てんかん', questions: ['発作型', '最終発作', '内服薬', '通院先'] },

  // 眼科
  { match: /網膜剥離|網膜裂孔/,     name: '網膜剥離/裂孔', questions: ['左/右', '手術時期', '現在のフォロー眼科', '視力残存'] },
  { match: /網膜色素変性/,          name: '網膜色素変性症', questions: ['視力残存', '視野狭窄の程度', '通院先'] },
  { match: /加齢黄斑変性|AMD/,      name: '加齢黄斑変性', questions: ['抗VEGF注射の有無と頻度', '通院先', '左/右'] },
  { match: /白内障.*術後|白内障手術/, name: '白内障術後', questions: ['手術時期（左右）', '術後眼内レンズ挿入済'] },
  { match: /白内障/,                name: '白内障',   questions: ['手術済 or 未手術', '通院先', '視力低下の程度'] },
  { match: /緑内障/,                name: '緑内障',   questions: ['点眼薬の種類', '通院先', '視野欠損の程度'] },

  // 婦人科
  { match: /子宮筋腫/,              name: '子宮筋腫', questions: ['手術歴 or 経過観察', 'ホルモン治療の有無', '通院先'] },
  { match: /子宮[内]?腺筋症/,       name: '子宮腺筋症', questions: ['治療内容（ホルモン/手術）', '通院先'] },
  { match: /子宮内膜症/,            name: '子宮内膜症', questions: ['治療内容（ピル/ジエノゲスト/GnRH）', '通院先'] },
  { match: /更年期障害/,            name: '更年期障害', questions: ['HRT実施の有無', '内服薬', '通院先'] },
  { match: /妊娠糖尿病|GDM/,        name: '妊娠糖尿病', questions: ['いつの妊娠時', '産後OGTTの結果', 'インスリン使用歴'] },
  { match: /乳[癌がん]/,            name: '乳癌',     questions: ['術式（部分/全摘）', 'ホルモン療法 / 化学療法歴', '通院先', '時期'] },

  // 泌尿器
  { match: /前立腺肥大/,            name: '前立腺肥大', questions: ['内服薬（α1ブロッカー/5α還元酵素阻害）', '夜間頻尿の程度', '手術歴'] },
  { match: /前立腺[癌がん]/,        name: '前立腺癌', questions: ['治療法（手術/放射線/ホルモン療法）', '時期', '通院先', 'PSAフォロー中か'] },
  { match: /膀胱[癌がん]/,          name: '膀胱癌',   questions: ['治療法（TUR-Bt/全摘/BCG）', '再発の有無', '通院先'] },

  // 精神科 (通院先・内服が必須)
  { match: /鬱病|うつ病|抑うつ/,   name: '鬱病',     questions: ['通院先', '内服薬', '現在治療中 or 寛解'] },
  { match: /双極性障害|躁うつ/,     name: '双極性障害', questions: ['通院先', '内服薬（リチウム/バルプロ酸など）', '最終入院 or 発症'] },
  { match: /統合失調症/,            name: '統合失調症', questions: ['通院先', '内服薬（抗精神病薬）', '最終入院'] },
  { match: /ADHD|発達障害|自閉/,   name: 'ADHD/発達障害', questions: ['通院先', '内服薬（コンサータ/ストラテラなど）'] },
  { match: /パニック障害|不安障害/, name: '不安障害', questions: ['通院先', '内服薬（SSRI/抗不安薬）'] },
  { match: /認知症|アルツハイマー/, name: '認知症',   questions: ['内服薬（ドネペジルなど）', '介護度', '通院先'] },

  // ENT
  { match: /メニエール|めまい/,     name: 'メニエール病', questions: ['発作頻度', '内服薬', '通院先'] },
  { match: /中耳炎/,                name: '中耳炎',   questions: ['急性 or 慢性', '手術歴'] },
  { match: /副鼻腔炎|蓄膿/,         name: '副鼻腔炎', questions: ['手術歴', '内服薬'] },

  // 感染症 / その他
  { match: /帯状疱疹/,              name: '帯状疱疹', questions: ['部位', '時期', '帯状疱疹後神経痛(PHN)の有無'] },
  { match: /B型肝炎/,               name: 'B型肝炎',  questions: ['キャリア or 治療済', 'HBs抗原/抗体', '内服歴'] },
  { match: /C型肝炎/,               name: 'C型肝炎',  questions: ['治療済（DAA） or 未治療', 'HCV-RNA', '通院先'] },
  { match: /鉄欠乏性貧血|貧血/,     name: '鉄欠乏性貧血', questions: ['原因（月経/消化管出血など）', '鉄剤内服の有無', '直近のHb値'] },
  { match: /SLE|全身性エリテマトーデス|膠原病/, name: '膠原病/SLE', questions: ['通院先', '内服薬（ステロイド/免疫抑制剤）', '臓器障害の有無'] },
  { match: /アレルギー性鼻炎|花粉症/, name: 'アレルギー性鼻炎', questions: ['抗ヒスタミン薬の内服', '舌下免疫療法の有無'] },
  { match: /アトピー/,              name: 'アトピー性皮膚炎', questions: ['ステロイド外用 or デュピクセント等', '通院先'] },
];

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
- 各病名につき2〜4個の質問
- 質問は事務スタッフが患者にそのまま聞ける口語で（専門用語の羅列は避ける）
- 治療歴・通院先・内服薬・時期は基本的に必ず確認
- 既に明らかな情報（病名そのもの）は質問しない
- 患者文脈（年齢等）から特に重要なものを優先
- ${ageContext ? `患者: ${ageContext}` : '患者文脈なし'}

【既往歴リスト】
${diseases.map((d, i) => `${i + 1}. ${d}`).join('\n')}

【出力（JSON のみ）】`;

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

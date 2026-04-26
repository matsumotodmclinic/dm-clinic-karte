// 既往歴の聞き漏れチェックボタン + 結果表示パネル
//
// B案: 既往歴セクション全体の下に1つ配置、全 otherDiseases をまとめてチェック
//
// 動作:
//   - クリックで即座にルールベース提案を表示（ローカル、無料、即時）
//   - 並行して AI に問い合わせ、結果が返り次第マージ表示
//   - 提案は閲覧専用（フォームへの自動反映はしない）

import { useState, useMemo } from 'react';
import { findRuleBasedSuggestions, aiSuggestFollowups, applyAnswersToSummary } from '../lib/pastHistoryFollowup';
import { useSpeechRecognition } from '../lib/speechRecognition';

const palette = {
  border: '#d4a373',
  borderStrong: '#a07040',
  bg: '#fffaf2',
  bgPanel: '#fff5e6',
  accent: '#a07040',
  rule: '#1a5fa8',
  ai: '#8e44ad',
};

const sectionStyle = {
  background: palette.bg,
  border: `2px solid ${palette.border}`,
  borderRadius: 12,
  padding: '14px 16px',
  marginTop: 8,
  marginBottom: 14,
};

const btnStyle = (loading) => ({
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  background: loading ? '#cccccc' : palette.borderStrong,
  color: '#fff',
  fontWeight: 800,
  fontSize: 13,
  cursor: loading ? 'not-allowed' : 'pointer',
});

const cardStyle = {
  background: '#fff',
  border: `1.5px solid ${palette.border}`,
  borderRadius: 10,
  padding: '10px 12px',
  marginTop: 8,
};

const tagStyle = (color) => ({
  display: 'inline-block',
  padding: '1px 8px',
  borderRadius: 12,
  background: color + '20',
  color,
  fontSize: 10,
  fontWeight: 800,
  marginLeft: 8,
});

/**
 * @param {object} props
 * @param {string[]} [props.diseaseNames] - 病名のリスト（直接指定）
 * @param {Array<{name: string}>} [props.otherDiseases] - その他病気エントリ配列（後方互換）
 * @param {string|number} [props.age]
 * @param {string} [props.helperText]
 * @param {string} [props.aiSummary] - 元の AI 整形済み既往歴（回答反映の元データ）
 * @param {(updated: string) => void} [props.onSummaryUpdate] - 反映後にサマリーを更新するコールバック
 * @param {(unanswered: Array<{disease:string,question:string}>) => void} [props.onUnansweredChange] - 未回答質問の変更通知
 */
export default function PastHistoryFollowupCheck({ diseaseNames, otherDiseases, age, helperText, aiSummary, onSummaryUpdate, onUnansweredChange }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  // 回答反映用 state
  const sr = useSpeechRecognition();
  const [answerText, setAnswerText] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [unanswered, setUnanswered] = useState([]);

  // 入力済み病名のみ抽出（diseaseNames 優先、なければ otherDiseases から）
  const computedDiseaseNames = useMemo(() => {
    if (Array.isArray(diseaseNames)) {
      return diseaseNames.map((n) => (n || '').trim()).filter((n) => n.length > 0);
    }
    return (otherDiseases || []).map((d) => (d?.name || '').trim()).filter((n) => n.length > 0);
  }, [diseaseNames, otherDiseases]);

  // ルールベース提案（即時）
  const ruleSuggestions = useMemo(() => {
    return computedDiseaseNames.map((name) => ({
      input: name,
      matches: findRuleBasedSuggestions(name),
    }));
  }, [computedDiseaseNames]);

  const handleCheck = async () => {
    if (computedDiseaseNames.length === 0) {
      alert('チェック対象の病名がありません。');
      return;
    }
    setOpen(true);
    setLoading(true);
    setAiError('');
    setAiResult(null);
    const res = await aiSuggestFollowups(computedDiseaseNames, { age });
    setLoading(false);
    if (!res.ok) {
      setAiError(res.error || 'AI 取得に失敗しました');
      return;
    }
    setAiResult(res.suggestions);
  };

  // 表示用: 入力病名ごとにルール + AI を統合
  const merged = computedDiseaseNames.map((name) => {
    const ruleHit = ruleSuggestions.find((r) => r.input === name)?.matches || [];
    const aiHit = (aiResult || []).filter(
      (s) => s.disease && (s.disease.includes(name) || name.includes(s.disease))
    );
    return { name, ruleHit, aiHit };
  });

  // AI 結果のうちどの入力にも紐付かないもの（参考扱い）
  const aiOrphan = (aiResult || []).filter(
    (s) => !computedDiseaseNames.some((n) => s.disease && (s.disease.includes(n) || n.includes(s.disease)))
  );

  // 全質問を { disease, question } のフラットリストに展開（AI反映用）
  const flatQuestions = useMemo(() => {
    const list = [];
    merged.forEach((m) => {
      m.ruleHit.forEach((r) => r.questions.forEach((q) => list.push({ disease: m.name, question: q })));
      m.aiHit.forEach((s) => (s.questions || []).forEach((q) => list.push({ disease: m.name, question: q })));
    });
    aiOrphan.forEach((s) => (s.questions || []).forEach((q) => list.push({ disease: s.disease, question: q })));
    return list;
  }, [merged, aiOrphan]);

  const handleApply = async () => {
    const transcriptCombined = (sr.transcript + (answerText ? '\n' + answerText : '')).trim();
    if (!transcriptCombined) {
      setApplyError('回答を入力または録音してください');
      return;
    }
    if (!aiSummary || !aiSummary.trim()) {
      setApplyError('元の AI 整形結果がありません');
      return;
    }
    if (flatQuestions.length === 0) {
      setApplyError('先に「聞き漏れをチェック」を実行してください');
      return;
    }
    setApplying(true);
    setApplyError('');
    const res = await applyAnswersToSummary(aiSummary, flatQuestions, transcriptCombined);
    setApplying(false);
    if (!res.ok) {
      setApplyError(res.error || 'AI 反映に失敗しました');
      return;
    }
    onSummaryUpdate?.(res.updatedSummary);
    setUnanswered(res.unansweredQuestions || []);
    onUnansweredChange?.(res.unansweredQuestions || []);
    // 反映済みの入力をクリア
    sr.reset();
    setAnswerText('');
  };

  const handleClearUnanswered = () => {
    setUnanswered([]);
    onUnansweredChange?.([]);
  };

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: palette.accent }}>
            💡 既往歴の聞き漏れチェック
          </div>
          <div style={{ fontSize: 11, color: palette.accent, marginTop: 4, lineHeight: 1.5 }}>
            {helperText || '事務スタッフ向け：入力された既往歴に対し、診療上聞いておくべき追加質問を提案します。'}
          </div>
        </div>
        <button onClick={handleCheck} disabled={loading} style={btnStyle(loading)}>
          {loading ? '🔄 確認中...' : '💡 聞き漏れをチェック'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          {computedDiseaseNames.length === 0 && (
            <div style={{ fontSize: 12, color: '#888' }}>病名が未入力です。</div>
          )}

          {merged.map((m) => (
            <div key={m.name} style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1a2a4a' }}>{m.name}</div>

              {m.ruleHit.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {m.ruleHit.map((r, i) => (
                    <div key={i} style={{ marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: palette.rule, fontWeight: 700 }}>
                        {r.name}
                      </span>
                      <span style={tagStyle(palette.rule)}>定型</span>
                      <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: 12, color: '#3a4a5a', lineHeight: 1.7 }}>
                        {r.questions.map((q, j) => (
                          <li key={j}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {m.aiHit.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {m.aiHit.map((s, i) => (
                    <div key={i}>
                      <span style={{ fontSize: 11, color: palette.ai, fontWeight: 700 }}>
                        {s.disease}
                      </span>
                      <span style={tagStyle(palette.ai)}>AI</span>
                      <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: 12, color: '#3a4a5a', lineHeight: 1.7 }}>
                        {(s.questions || []).map((q, j) => (
                          <li key={j}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {m.ruleHit.length === 0 && m.aiHit.length === 0 && !loading && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                  {aiResult === null ? 'AI 確認中...' : '提案なし'}
                </div>
              )}
            </div>
          ))}

          {aiOrphan.length > 0 && (
            <div style={{ ...cardStyle, borderColor: palette.ai }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: palette.ai, marginBottom: 4 }}>
                参考: AI からの追加提案 <span style={tagStyle(palette.ai)}>AI</span>
              </div>
              {aiOrphan.map((s, i) => (
                <div key={i} style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2a4a' }}>{s.disease}</div>
                  <ul style={{ margin: '2px 0 0 18px', padding: 0, fontSize: 12, color: '#3a4a5a', lineHeight: 1.7 }}>
                    {(s.questions || []).map((q, j) => (
                      <li key={j}>{q}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div style={{ fontSize: 12, color: palette.ai, marginTop: 8 }}>🔄 AI で追加質問を生成中...</div>
          )}
          {aiError && (
            <div style={{ fontSize: 12, color: '#c53030', marginTop: 8 }}>
              AI エラー: {aiError}（定型ルールの提案は使用可能です）
            </div>
          )}

          {/* 回答反映エリア */}
          {flatQuestions.length > 0 && aiSummary && onSummaryUpdate && (
            <div style={{ marginTop: 14, padding: '12px 14px', background: '#fff', borderRadius: 10, border: `1.5px dashed ${palette.borderStrong}` }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: palette.accent, marginBottom: 6 }}>
                💬 患者から聞き取った回答を反映
              </div>
              <div style={{ fontSize: 11, color: palette.accent, marginBottom: 8, lineHeight: 1.5 }}>
                上記の質問について患者に確認した内容を入力してください。録音 or 直接入力どちらでも可。AI が既往歴サマリーに統合します。
              </div>

              {sr.isSupported && (
                <div style={{ marginBottom: 8 }}>
                  <textarea
                    style={{ width: '100%', minHeight: 60, padding: '8px 10px', border: '1.5px solid #d0c094', borderRadius: 6, fontSize: 13, background: '#fffaf2', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
                    value={sr.transcript + (sr.interimText ? ' ' + sr.interimText : '')}
                    onChange={(e) => sr.setTranscript(e.target.value)}
                    readOnly={sr.isRecording}
                    placeholder="🎤 録音 or テキスト入力（例: 胆石は10年前に上尾中央総合病院で胆嚢摘出済み...）"
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {!sr.isRecording ? (
                      <button onClick={sr.start} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: palette.borderStrong, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>🎤 録音開始</button>
                    ) : (
                      <button onClick={sr.stop} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#c62828', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>⏹ 録音停止</button>
                    )}
                    {(sr.transcript || sr.interimText) && (
                      <button onClick={() => sr.reset()} style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid #b0b0b0', background: '#fff', color: '#555', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>クリア</button>
                    )}
                  </div>
                </div>
              )}

              {!sr.isSupported && (
                <textarea
                  style={{ width: '100%', minHeight: 60, padding: '8px 10px', border: '1.5px solid #d0c094', borderRadius: 6, fontSize: 13, background: '#fffaf2', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', marginBottom: 8 }}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="患者から聞き取った内容をテキスト入力（例: 胆石は10年前に上尾中央総合病院で胆嚢摘出済み...）"
                />
              )}

              <button
                onClick={handleApply}
                disabled={applying}
                style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: applying ? '#cccccc' : '#1a5fa8', color: '#fff', fontWeight: 800, fontSize: 12, cursor: applying ? 'not-allowed' : 'pointer' }}
              >
                {applying ? '✨ AI で反映中...' : '✨ AI で反映 → 既往歴サマリーを更新'}
              </button>
              {applyError && <div style={{ color: '#c62828', fontSize: 11, marginTop: 6 }}>{applyError}</div>}
            </div>
          )}

          {/* 未回答質問リスト */}
          {unanswered.length > 0 && (
            <div style={{ marginTop: 12, padding: '12px 14px', background: '#fff5f5', borderRadius: 10, border: '1.5px solid #fc8181' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#c53030' }}>
                  ⚠️ 未回答の質問 ({unanswered.length}件) → カルテの【既往歴確認事項】に表示されます
                </div>
                <button onClick={handleClearUnanswered} style={{ padding: '4px 10px', borderRadius: 6, border: '1.5px solid #fc8181', background: '#fff', color: '#c53030', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>クリア</button>
              </div>
              <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: 12, color: '#742a2a', lineHeight: 1.7 }}>
                {unanswered.map((u, i) => (
                  <li key={i}><span style={{ fontWeight: 700 }}>{u.disease}:</span> {u.question}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ fontSize: 11, color: '#7a7a7a', marginTop: 10, lineHeight: 1.5 }}>
            ※ 質問への回答を入力すると AI が既往歴サマリーを更新します。未回答の質問は自動でカルテの「申し送り事項」内【既往歴確認事項】に出力され、医師が確認できます。
          </div>
        </div>
      )}
    </div>
  );
}

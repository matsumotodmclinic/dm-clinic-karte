// 既往歴の聞き漏れチェックボタン + 結果表示パネル
//
// B案: 既往歴セクション全体の下に1つ配置、全 otherDiseases をまとめてチェック
//
// 動作:
//   - クリックで即座にルールベース提案を表示（ローカル、無料、即時）
//   - 並行して AI に問い合わせ、結果が返り次第マージ表示
//   - 提案は閲覧専用（フォームへの自動反映はしない）

import { useState, useMemo } from 'react';
import { findRuleBasedSuggestions, aiSuggestFollowups } from '../lib/pastHistoryFollowup';

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

export default function PastHistoryFollowupCheck({ otherDiseases, age }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  // 入力済み病名のみ抽出
  const diseaseNames = useMemo(
    () => (otherDiseases || []).map((d) => (d?.name || '').trim()).filter((n) => n.length > 0),
    [otherDiseases]
  );

  // ルールベース提案（即時）
  const ruleSuggestions = useMemo(() => {
    return diseaseNames.map((name) => ({
      input: name,
      matches: findRuleBasedSuggestions(name),
    }));
  }, [diseaseNames]);

  const handleCheck = async () => {
    if (diseaseNames.length === 0) {
      alert('「その他の病気・既往歴」に病名が入力されていません。');
      return;
    }
    setOpen(true);
    setLoading(true);
    setAiError('');
    setAiResult(null);
    const res = await aiSuggestFollowups(diseaseNames, { age });
    setLoading(false);
    if (!res.ok) {
      setAiError(res.error || 'AI 取得に失敗しました');
      return;
    }
    setAiResult(res.suggestions);
  };

  // 表示用: 入力病名ごとにルール + AI を統合
  const merged = diseaseNames.map((name) => {
    const ruleHit = ruleSuggestions.find((r) => r.input === name)?.matches || [];
    const aiHit = (aiResult || []).filter(
      (s) => s.disease && (s.disease.includes(name) || name.includes(s.disease))
    );
    return { name, ruleHit, aiHit };
  });

  // AI 結果のうちどの入力にも紐付かないもの（参考扱い）
  const aiOrphan = (aiResult || []).filter(
    (s) => !diseaseNames.some((n) => s.disease && (s.disease.includes(n) || n.includes(s.disease)))
  );

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: palette.accent }}>
            💡 既往歴の聞き漏れチェック
          </div>
          <div style={{ fontSize: 11, color: palette.accent, marginTop: 4, lineHeight: 1.5 }}>
            事務スタッフ向け：入力済みの「その他の病気・既往歴」に対し、診療上聞いておくべき追加質問を提案します。
          </div>
        </div>
        <button onClick={handleCheck} disabled={loading} style={btnStyle(loading)}>
          {loading ? '🔄 確認中...' : '💡 聞き漏れをチェック'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          {diseaseNames.length === 0 && (
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

          <div style={{ fontSize: 11, color: '#7a7a7a', marginTop: 10, lineHeight: 1.5 }}>
            ※ 提案は参考用です。患者に追加確認後、上の「その他の病気・既往歴」欄に手入力してください（自動入力はされません）。
          </div>
        </div>
      )}
    </div>
  );
}

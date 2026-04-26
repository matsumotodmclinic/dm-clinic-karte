// 音声メモセクション(問診フォームに配置)
//
// 機能:
//   - Web Speech API でリアルタイム音声認識
//   - 認識結果の編集
//   - Claude で医療カルテ用に整形(mode により現病歴/既往歴を切替)
//   - 整形結果は親コンポーネントに通知(formData の任意フィールドに保存)
//
// mode:
//   - 'currentIllness' (デフォルト): 現病歴・受診理由として整形
//   - 'pastHistory'                : 既往歴として整形(♯病名（...）リスト形式)
//
// 設計書: docs/design/voice-input-summary-plan.md

import { useState } from 'react'
import { useSpeechRecognition } from '../lib/speechRecognition'
import { summarizeForKarte, summarizeForPastHistory } from '../lib/voiceSummary'
import { parseDiseasesFromSummary } from '../lib/pastHistoryFollowup'
import PastHistoryFollowupCheck from './PastHistoryFollowupCheck'

const MODE_CONFIG = {
  currentIllness: {
    title: '📋 現病歴の音声入力(任意)',
    helper: '患者さんに経緯を話してもらってください。録音すると AI が医療的に整形してカルテに追加します。',
    summaryLabel: '✨ AI 整形結果(編集可、現病歴に追加されます)',
    summaryHint: 'この内容は「カルテ文を生成」ボタンを押した時に現病歴セクションに追加されます。',
    accentColor: '#a67000',
    bgColor: '#fff7e6',
    borderColor: '#f0c270',
  },
  pastHistory: {
    title: '🩺 既往歴の音声入力(任意)',
    helper: '事務スタッフ or 患者さんが既往歴を口頭で述べてください。AI が ♯病名（時期・病院・薬）の形式に整形して既往歴セクションに追加します。',
    summaryLabel: '✨ AI 整形結果(編集可、既往歴に追加されます)',
    summaryHint: 'この内容は「カルテ文を生成」ボタンを押した時に既往歴セクションに追加されます。',
    accentColor: '#1a5fa8',
    bgColor: '#eef4fc',
    borderColor: '#7aa8d4',
  },
}

/* ── styles (form と統一感を持たせる、mode により色変化) ── */
const buildSectionStyle = (cfg) => ({
  background: cfg.bgColor,
  border: `2px solid ${cfg.borderColor}`,
  borderRadius: 12,
  padding: '16px 18px',
  marginBottom: 14,
})
const buildLabelStyle = (cfg) => ({ display: 'block', fontSize: 13, fontWeight: 800, color: cfg.accentColor, marginBottom: 8 })
const buildHelperStyle = (cfg) => ({ fontSize: 11, color: cfg.accentColor, marginBottom: 10, lineHeight: 1.5 })
const taStyle = {
  width: '100%',
  minHeight: 80,
  padding: '10px 12px',
  border: '1.5px solid #d0c094',
  borderRadius: 8,
  fontSize: 14,
  color: '#1a2a3a',
  background: '#fffaf2',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  resize: 'vertical',
}
const summaryStyle = {
  ...taStyle,
  background: '#f0f7ff',
  border: '1.5px solid #a8c8e8',
  color: '#1a3a5a',
  marginTop: 10,
}
// 内容に応じて textarea の高さを動的に計算（折り返しも考慮）
// 各行が約50文字で折り返すと想定し、視覚的な行数で計算
const computeAutoRows = (text, min = 4) => {
  if (!text) return min;
  const lines = text.split(/\r?\n/);
  let visualRows = 0;
  for (const line of lines) {
    visualRows += Math.max(1, Math.ceil((line.length || 1) / 45));
  }
  return Math.max(min, visualRows + 1);
}
const btnPrimary = (disabled) => ({
  padding: '10px 18px',
  borderRadius: 8,
  border: 'none',
  background: disabled ? '#cccccc' : '#1a5fa8',
  color: '#fff',
  fontWeight: 700,
  fontSize: 14,
  cursor: disabled ? 'not-allowed' : 'pointer',
  marginRight: 8,
})
const btnDanger = (active) => ({
  padding: '10px 18px',
  borderRadius: 8,
  border: 'none',
  background: active ? '#c62828' : '#888',
  color: '#fff',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  marginRight: 8,
})
const btnGhost = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1.5px solid #b0b0b0',
  background: '#fff',
  color: '#555',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
}

/**
 * @param {object} props
 * @param {object} props.formData
 * @param {string} props.formType
 * @param {(memo: { transcript: string, aiSummary: string }) => void} props.onUpdate
 * @param {'currentIllness' | 'pastHistory'} [props.mode='currentIllness']
 * @param {{ transcript: string, aiSummary: string }} [props.initialValue] - 初期値(state 復元用)
 */
export default function VoiceMemoSection({ formData, formType, onUpdate, mode = 'currentIllness', initialValue }) {
  const cfg = MODE_CONFIG[mode] || MODE_CONFIG.currentIllness
  const sr = useSpeechRecognition()
  const [aiSummary, setAiSummary] = useState(initialValue?.aiSummary || formData?.voiceMemo?.aiSummary || '')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [unansweredQuestions, setUnansweredQuestions] = useState(initialValue?.unansweredQuestions || [])
  const [needsDoctorReview, setNeedsDoctorReview] = useState(!!initialValue?.needsDoctorReview)
  // 初回録音パネルの折りたたみ（AI整形完了後は省スペース化、ボタンで再展開可）
  const [recordCollapsed, setRecordCollapsed] = useState(false)

  // 親に変更を通知するヘルパー
  const notify = (transcript, summary, unanswered, ndr) => {
    onUpdate?.({
      transcript: transcript ?? sr.transcript,
      aiSummary: summary ?? aiSummary,
      unansweredQuestions: unanswered ?? unansweredQuestions,
      needsDoctorReview: ndr ?? needsDoctorReview,
    })
  }

  const handleSummaryUpdate = (updated) => {
    setAiSummary(updated)
    notify(sr.transcript, updated, unansweredQuestions, needsDoctorReview)
  }
  const handleUnansweredChange = (list) => {
    setUnansweredQuestions(list)
    notify(sr.transcript, aiSummary, list, needsDoctorReview)
  }
  const handleNeedsDoctorReviewChange = (value) => {
    setNeedsDoctorReview(value)
    notify(sr.transcript, aiSummary, unansweredQuestions, value)
  }

  const handleStart = () => {
    sr.start()
  }

  const handleStop = () => {
    sr.stop()
    notify(sr.transcript, aiSummary)
  }

  const handleClear = () => {
    if (sr.transcript || aiSummary) {
      if (!confirm('録音テキストと AI 整形結果を削除します。よろしいですか？')) return
    }
    sr.reset()
    setAiSummary('')
    setAiError('')
    notify('', '')
  }

  const handleEditTranscript = (e) => {
    sr.setTranscript(e.target.value)
    notify(e.target.value, aiSummary)
  }

  const handleSummarize = async () => {
    if (!sr.transcript || sr.transcript.trim().length === 0) {
      setAiError('先に録音または入力してください')
      return
    }
    setAiLoading(true)
    setAiError('')
    const result = mode === 'pastHistory'
      ? await summarizeForPastHistory(sr.transcript)
      : await summarizeForKarte(sr.transcript, formData, formType)
    setAiLoading(false)

    if (!result.ok) {
      setAiError(result.error)
      return
    }
    setAiSummary(result.summary)
    setRecordCollapsed(true) // AI整形完了 → 上部録音欄を折りたたむ
    notify(sr.transcript, result.summary)
  }

  const handleEditSummary = (e) => {
    setAiSummary(e.target.value)
    notify(sr.transcript, e.target.value)
  }

  const sectionStyle = buildSectionStyle(cfg)
  const labelStyle = buildLabelStyle(cfg)
  const helperStyle = buildHelperStyle(cfg)

  // 非対応ブラウザ
  if (!sr.isSupported) {
    return (
      <div style={sectionStyle}>
        <div style={labelStyle}>{cfg.title}</div>
        <div style={{ ...helperStyle, color: '#c62828' }}>
          このブラウザは音声入力に対応していません(Safari/Chrome/Edge を推奨)。
          直接テキスト入力で内容を残したい場合は下のテキストエリアにご記入ください。
        </div>
        <textarea
          style={taStyle}
          value={sr.transcript}
          onChange={handleEditTranscript}
          placeholder={mode === 'pastHistory' ? '既往歴をテキスト入力できます' : '患者さんから聞いた経緯をテキスト入力できます'}
        />
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            style={btnPrimary(aiLoading || !sr.transcript)}
            disabled={aiLoading || !sr.transcript}
            onClick={handleSummarize}
          >
            {aiLoading ? '✨ AI整形中...' : '✨ AI で整形してカルテに追加'}
          </button>
        </div>
        {aiError && <div style={{ color: '#c62828', fontSize: 12, marginTop: 8 }}>{aiError}</div>}
        {aiSummary && (
          <div style={{ marginTop: 10 }}>
            <div style={{ ...labelStyle, color: '#1a5fa8' }}>{cfg.summaryLabel}</div>
            {(() => {
              const baseHeight = mode === 'pastHistory' ? 240 : 160
              const rows = computeAutoRows(aiSummary, mode === 'pastHistory' ? 10 : 6)
              const dynamicHeight = Math.max(baseHeight, rows * 26)
              return (
                <textarea
                  style={{ ...summaryStyle, minHeight: `${dynamicHeight}px` }}
                  rows={rows}
                  value={aiSummary}
                  onChange={handleEditSummary}
                />
              )
            })()}
            {mode === 'pastHistory' && (
              <PastHistoryFollowupCheck
                diseaseNames={parseDiseasesFromSummary(aiSummary)}
                age={formData?.history?.age}
                helperText="AI 整形結果に含まれる既往歴に対し、診療上聞いておくべき追加質問を提案します。"
                aiSummary={aiSummary}
                onSummaryUpdate={handleSummaryUpdate}
                onUnansweredChange={handleUnansweredChange}
                needsDoctorReview={needsDoctorReview}
                onNeedsDoctorReviewChange={handleNeedsDoctorReviewChange}
              />
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={sectionStyle}>
      <div style={labelStyle}>{cfg.title}</div>
      <div style={helperStyle}>
        {cfg.helper}<br />
        録音せず、テキスト入力だけでもご利用いただけます。
      </div>

      {/* 折りたたみ時の再展開ボタン */}
      {recordCollapsed && aiSummary && (
        <button
          type="button"
          onClick={() => setRecordCollapsed(false)}
          style={{ padding: '6px 12px', borderRadius: 6, border: `1.5px solid ${cfg.borderColor}`, background: '#fff', color: cfg.accentColor, fontWeight: 700, fontSize: 12, cursor: 'pointer', marginBottom: 10 }}
        >
          ▼ 録音テキスト・操作ボタンを再表示（追加録音する場合）
        </button>
      )}

      {/* 録音テキストエリア + コントロール（AI整形完了後は折りたたみ） */}
      {!recordCollapsed && (
        <>
          <div style={{ position: 'relative' }}>
            <textarea
              style={taStyle}
              value={sr.transcript + (sr.interimText ? ' ' + sr.interimText : '')}
              onChange={handleEditTranscript}
              placeholder="🎤 録音開始 を押すと、ここに認識された音声テキストが表示されます。直接編集も可能です。"
              readOnly={sr.isRecording}
            />
            {sr.isRecording && (
              <div style={{
                position: 'absolute', top: 8, right: 12,
                background: '#c62828', color: '#fff', padding: '2px 8px',
                borderRadius: 12, fontSize: 11, fontWeight: 700,
              }}>
                ● 録音中
              </div>
            )}
          </div>

          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {!sr.isRecording ? (
              <button type="button" style={btnPrimary(false)} onClick={handleStart}>
                🎤 録音開始
              </button>
            ) : (
              <button type="button" style={btnDanger(true)} onClick={handleStop}>
                ⏹ 録音停止
              </button>
            )}
            <button
              type="button"
              style={btnPrimary(aiLoading || !sr.transcript || sr.isRecording)}
              disabled={aiLoading || !sr.transcript || sr.isRecording}
              onClick={handleSummarize}
            >
              {aiLoading ? '✨ AI整形中...' : '✨ AI で整形'}
            </button>
            {(sr.transcript || aiSummary) && (
              <button type="button" style={btnGhost} onClick={handleClear}>
                🗑️ クリア
              </button>
            )}
            {aiSummary && (
              <button type="button" style={btnGhost} onClick={() => setRecordCollapsed(true)}>
                ▲ 折りたたむ
              </button>
            )}
          </div>
        </>
      )}

      {/* 認識エラー */}
      {sr.error && <div style={{ color: '#c62828', fontSize: 12, marginTop: 8 }}>{sr.error}</div>}
      {aiError && <div style={{ color: '#c62828', fontSize: 12, marginTop: 8 }}>{aiError}</div>}

      {/* AI 整形結果 */}
      {aiSummary && (
        <div style={{ marginTop: 10 }}>
          <div style={{ ...labelStyle, color: '#1a5fa8' }}>{cfg.summaryLabel}</div>
          <textarea
            style={summaryStyle}
            value={aiSummary}
            onChange={handleEditSummary}
          />
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            {cfg.summaryHint}
          </div>
          {mode === 'pastHistory' && (
            <PastHistoryFollowupCheck
              diseaseNames={parseDiseasesFromSummary(aiSummary)}
              age={formData?.history?.age}
              helperText="AI 整形結果に含まれる既往歴に対し、診療上聞いておくべき追加質問を提案します。"
            />
          )}
        </div>
      )}
    </div>
  )
}

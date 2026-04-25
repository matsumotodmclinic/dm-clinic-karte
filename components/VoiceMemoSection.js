// 音声メモセクション(問診フォーム末尾に配置)
//
// 機能:
//   - Web Speech API でリアルタイム音声認識
//   - 認識結果の編集
//   - Claude で医療カルテ用に整形
//   - 整形結果は親コンポーネントに通知(formData.voiceMemo に保存)
//
// 設計書: docs/design/voice-input-summary-plan.md

import { useState } from 'react'
import { useSpeechRecognition } from '../lib/speechRecognition'
import { summarizeForKarte } from '../lib/voiceSummary'

/* ── styles (form と統一感を持たせる) ── */
const sectionStyle = {
  background: '#fff7e6',
  border: '2px solid #f0c270',
  borderRadius: 12,
  padding: '16px 18px',
  marginBottom: 14,
}
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 800, color: '#a67000', marginBottom: 8 }
const helperStyle = { fontSize: 11, color: '#a67000', marginBottom: 10, lineHeight: 1.5 }
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

export default function VoiceMemoSection({ formData, formType, onUpdate }) {
  const sr = useSpeechRecognition()
  const [aiSummary, setAiSummary] = useState(formData?.voiceMemo?.aiSummary || '')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  // 親に変更を通知するヘルパー
  const notify = (transcript, summary) => {
    onUpdate?.({
      transcript: transcript ?? sr.transcript,
      aiSummary: summary ?? aiSummary,
    })
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
    const result = await summarizeForKarte(sr.transcript, formData, formType)
    setAiLoading(false)

    if (!result.ok) {
      setAiError(result.error)
      return
    }
    setAiSummary(result.summary)
    notify(sr.transcript, result.summary)
  }

  const handleEditSummary = (e) => {
    setAiSummary(e.target.value)
    notify(sr.transcript, e.target.value)
  }

  // 非対応ブラウザ
  if (!sr.isSupported) {
    return (
      <div style={sectionStyle}>
        <div style={labelStyle}>📋 経緯の自由発話(任意)</div>
        <div style={{ ...helperStyle, color: '#c62828' }}>
          このブラウザは音声入力に対応していません(Safari/Chrome/Edge を推奨)。
          直接テキスト入力で経緯を残したい場合は下のテキストエリアにご記入ください。
        </div>
        <textarea
          style={taStyle}
          value={sr.transcript}
          onChange={handleEditTranscript}
          placeholder="患者さんから聞いた経緯をテキスト入力できます"
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
            <div style={{ ...labelStyle, color: '#1a5fa8' }}>✨ AI 整形結果(編集可、カルテに追加されます)</div>
            <textarea
              style={summaryStyle}
              value={aiSummary}
              onChange={handleEditSummary}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={sectionStyle}>
      <div style={labelStyle}>📋 経緯の自由発話(任意)</div>
      <div style={helperStyle}>
        患者さんに経緯を話してもらってください。録音すると AI が医療的に整形してカルテに追加します。<br />
        録音せず、テキスト入力だけでもご利用いただけます。
      </div>

      {/* 録音テキストエリア */}
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

      {/* 録音コントロール */}
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
      </div>

      {/* 認識エラー */}
      {sr.error && <div style={{ color: '#c62828', fontSize: 12, marginTop: 8 }}>{sr.error}</div>}
      {aiError && <div style={{ color: '#c62828', fontSize: 12, marginTop: 8 }}>{aiError}</div>}

      {/* AI 整形結果 */}
      {aiSummary && (
        <div style={{ marginTop: 10 }}>
          <div style={{ ...labelStyle, color: '#1a5fa8' }}>✨ AI 整形結果(編集可、カルテに追加されます)</div>
          <textarea
            style={summaryStyle}
            value={aiSummary}
            onChange={handleEditSummary}
          />
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            この内容は「カルテ文を生成」ボタンを押した時に現病歴セクションに追加されます。
          </div>
        </div>
      )}
    </div>
  )
}

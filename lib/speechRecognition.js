// Web Speech API の React Hook ラッパー
//
// 対応ブラウザ:
//   - Safari iPad (iOS 14.5+)  → SpeechRecognition (webkit prefix なし)
//   - Chrome / Edge             → webkitSpeechRecognition
//   - Firefox                   → 非対応
//
// 仕様:
//   - lang: 'ja-JP' 固定
//   - continuous: true (長時間録音)
//   - interimResults: true (中間結果リアルタイム表示)
//   - 内部で recognition インスタンスを useRef で保持(コンポーネントのライフサイクル安定)
//   - エラーハンドリング: マイク許可拒否、ネット切断、対応外ブラウザ

import { useState, useRef, useCallback, useEffect } from 'react'

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState('')      // 確定済みテキスト
  const [interimText, setInterimText] = useState('')    // 中間結果(暫定)
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState('')
  const [isSupported, setIsSupported] = useState(true)

  const recognitionRef = useRef(null)
  // 確定済みテキストの最新値を保持(再描画を待たずに append したい)
  const finalRef = useRef('')

  // 初期化
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'ja-JP'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let interim = ''
      let appended = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const segment = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          appended += segment
        } else {
          interim += segment
        }
      }
      if (appended) {
        finalRef.current = (finalRef.current + appended).trim()
        setTranscript(finalRef.current)
      }
      setInterimText(interim)
    }

    recognition.onerror = (event) => {
      // no-speech は無視(無音時に頻発、致命的でない)
      if (event.error === 'no-speech') return
      setError(translateError(event.error))
      setIsRecording(false)
    }

    recognition.onend = () => {
      // continuous: true でも一定時間後に勝手に終了することがある
      // ユーザーが明示的に止めていない場合は再開する設計もありえるが、
      // ここではシンプルに stop 状態にする(ユーザーが再度開始可能)
      setIsRecording(false)
      setInterimText('')
    }

    recognitionRef.current = recognition

    return () => {
      try {
        recognition.stop()
      } catch {
        // 既に stop 済みなら無視
      }
    }
  }, [])

  const start = useCallback(() => {
    if (!recognitionRef.current) return
    setError('')
    try {
      recognitionRef.current.start()
      setIsRecording(true)
    } catch (e) {
      // すでに start 済みの場合 InvalidStateError が出ることがある
      if (e?.name !== 'InvalidStateError') {
        setError('録音を開始できませんでした: ' + (e?.message || ''))
      }
    }
  }, [])

  const stop = useCallback(() => {
    if (!recognitionRef.current) return
    try {
      recognitionRef.current.stop()
    } catch {
      // 無視
    }
    setIsRecording(false)
  }, [])

  const reset = useCallback(() => {
    finalRef.current = ''
    setTranscript('')
    setInterimText('')
    setError('')
  }, [])

  // 編集時の transcript 直接更新(テキストエリア編集対応)
  const setTranscriptDirect = useCallback((value) => {
    finalRef.current = value
    setTranscript(value)
  }, [])

  return {
    transcript,
    interimText,
    isRecording,
    error,
    isSupported,
    start,
    stop,
    reset,
    setTranscript: setTranscriptDirect,
  }
}

// SpeechRecognitionErrorEvent.error の値を日本語に変換
function translateError(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'マイクの使用が許可されていません。ブラウザ設定でマイクを有効にしてください。'
    case 'audio-capture':
      return 'マイクが接続されていません。'
    case 'network':
      return 'ネットワーク接続を確認してください(音声認識にはインターネットが必要です)。'
    case 'language-not-supported':
      return '日本語の音声認識に対応していません。'
    case 'aborted':
      return '' // 自分で stop したケース
    default:
      return `音声認識エラー: ${code}`
  }
}

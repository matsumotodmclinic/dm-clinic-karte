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
//   - **無音でも自動再開** (ユーザーが停止ボタンを押すまで継続)
//     iOS Safari は数秒の無音で勝手に onend を発火するため、
//     userStoppedRef フラグで「ユーザー意図」を持って再開する
//   - 安全装置: 最大 3 分で自動停止 (暴走防止)
//   - 内部で recognition インスタンスを useRef で保持
//   - エラーハンドリング: マイク許可拒否、ネット切断、対応外ブラウザ

import { useState, useRef, useCallback, useEffect } from 'react'

const MAX_RECORDING_MS = 3 * 60 * 1000 // 3分上限(暴走防止)

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState('')      // 確定済みテキスト
  const [interimText, setInterimText] = useState('')    // 中間結果(暫定)
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState('')
  const [isSupported, setIsSupported] = useState(true)

  const recognitionRef = useRef(null)
  // 確定済みテキストの最新値(再描画を待たずに append したい)
  const finalRef = useRef('')
  // 前セッション(再開前)までに確定したテキスト。
  // onresult では event.results 全体を毎回読み直して
  //   final = sessionBase + 現セッションの全 final
  // で計算する。これにより event.resultIndex の不安定さ(iOS Safari等)を回避。
  const sessionBaseTextRef = useRef('')
  // ユーザーが「録音中である」と意図しているか
  // - true: ブラウザが onend を返しても自動で start し直す
  // - false: 普通に終了
  const userIntentRecordingRef = useRef(false)
  // 最大録音時間タイマー(暴走防止)
  const maxDurationTimerRef = useRef(null)

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
      // event.resultIndex の挙動はブラウザ依存(iOS Safari で不安定)のため使わない。
      // 毎回 event.results の全要素を読み直して再構築する。
      let interim = ''
      let sessionFinals = ''
      for (let i = 0; i < event.results.length; i++) {
        const segment = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          sessionFinals += segment
        } else {
          interim += segment
        }
      }
      // 確定テキスト = 前セッション分 + 現セッションの finals
      const combined = (sessionBaseTextRef.current + sessionFinals).trim()
      finalRef.current = combined
      setTranscript(combined)
      setInterimText(interim)
    }

    recognition.onerror = (event) => {
      // no-speech / aborted は致命的でないので継続
      // (ブラウザが内部的に再生成する想定)
      if (event.error === 'no-speech' || event.error === 'aborted') return
      // それ以外のエラーは録音意図を解除して停止扱い
      userIntentRecordingRef.current = false
      setError(translateError(event.error))
      setIsRecording(false)
    }

    recognition.onend = () => {
      setInterimText('')
      // ユーザーがまだ録音意図を持っていれば自動で再開
      if (userIntentRecordingRef.current) {
        // 自動再開前に「これまでの確定テキスト」を新セッションの base として保存。
        // これがないと、新セッションの onresult で sessionFinals だけ再構築して
        // 過去のテキストが消えてしまう。
        sessionBaseTextRef.current = finalRef.current
        try {
          recognition.start()
        } catch (e) {
          // start に失敗したら停止扱い
          userIntentRecordingRef.current = false
          setIsRecording(false)
          if (e?.name !== 'InvalidStateError') {
            setError('録音の自動再開に失敗しました: ' + (e?.message || ''))
          }
        }
      } else {
        setIsRecording(false)
      }
    }

    recognitionRef.current = recognition

    return () => {
      userIntentRecordingRef.current = false
      if (maxDurationTimerRef.current) {
        clearTimeout(maxDurationTimerRef.current)
        maxDurationTimerRef.current = null
      }
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
    userIntentRecordingRef.current = true
    // 新規録音開始時、現在の transcript(編集済みかもしれない)を base として固定
    sessionBaseTextRef.current = finalRef.current
    try {
      recognitionRef.current.start()
      setIsRecording(true)
      // 暴走防止: 最大 3 分で自動停止
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current)
      maxDurationTimerRef.current = setTimeout(() => {
        userIntentRecordingRef.current = false
        try { recognitionRef.current?.stop() } catch {}
        setIsRecording(false)
        setError('録音時間の上限(3分)に達したため自動停止しました')
      }, MAX_RECORDING_MS)
    } catch (e) {
      // すでに start 済みの場合 InvalidStateError が出ることがある
      if (e?.name !== 'InvalidStateError') {
        userIntentRecordingRef.current = false
        setError('録音を開始できませんでした: ' + (e?.message || ''))
      }
    }
  }, [])

  const stop = useCallback(() => {
    if (!recognitionRef.current) return
    // 自動再開を止める
    userIntentRecordingRef.current = false
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current)
      maxDurationTimerRef.current = null
    }
    try {
      recognitionRef.current.stop()
    } catch {
      // 無視
    }
    setIsRecording(false)
  }, [])

  const reset = useCallback(() => {
    finalRef.current = ''
    sessionBaseTextRef.current = ''
    setTranscript('')
    setInterimText('')
    setError('')
  }, [])

  // 編集時の transcript 直接更新(テキストエリア編集対応)
  // 編集された値を新たな base として扱う(次の録音再開時に消えないように)
  const setTranscriptDirect = useCallback((value) => {
    finalRef.current = value
    sessionBaseTextRef.current = value
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

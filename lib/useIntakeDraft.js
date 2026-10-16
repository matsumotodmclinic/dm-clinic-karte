// 問診の下書きを自動で保存し、開き直したら「続きから再開」を出すための hook。
// 決めたことと理由は lib/intakeDraft.js の冒頭。
//
// 使い方（各 *IntakeTool.js）:
//   const draft = useIntakeDraft("DM基本", { data, step, initialData, saved: !!visitCode, lastStep: STEPS.length - 1 });
//   <DraftRestoreBanner draft={draft} onRestore={(d) => { setData(d.data); setStep(d.step); }} />
//
// ★バナーは「まだ何も入力していない最初の画面」でだけ出す。
//   音声入力欄（VoiceMemoSection）は最終ステップで開いた時点の値を持つので、
//   そこを開いた後に下書きを流し込むと画面と中身がずれる。最初の画面なら起きない。

import { useEffect, useRef, useState } from 'react'
import { draftKey, prevDraftKey, serializeDraft, parseDraft, mergeDraft } from './intakeDraft'

const storage = () => {
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

export function useIntakeDraft(formType, { data, step, initialData, saved, lastStep }) {
  const [prev, setPrev] = useState(null)
  const dirty = data !== initialData

  // ① 開いたとき: 前回の下書きを prev の枠へ移す（以後の自動保存で上書きしないため）
  //    ★この effect は ② より先に書くこと（同じ描画で ② が本枠を消してしまう）
  useEffect(() => {
    const ls = storage()
    if (!ls) return
    try {
      const curText = ls.getItem(draftKey(formType))
      if (parseDraft(curText)) ls.setItem(prevDraftKey(formType), curText)
      ls.removeItem(draftKey(formType))
      const p = parseDraft(ls.getItem(prevDraftKey(formType)))
      if (!p) ls.removeItem(prevDraftKey(formType))
      setPrev(p)
    } catch { /* 下書きが使えなくても問診はできる */ }
  }, [formType])

  // ② 入力のたびに保存。保存済み（受付コードあり）・「最初から」の後は消す
  useEffect(() => {
    const ls = storage()
    if (!ls) return
    try {
      if (saved || !dirty) ls.removeItem(draftKey(formType))
      else ls.setItem(draftKey(formType), serializeDraft({ data, step }))
    } catch { /* 容量不足など。問診は続けられる */ }
  }, [formType, data, step, saved, dirty])

  // ③ 保存前にタブを閉じようとしたらブラウザの確認を出す（下書きはあるが、まず止める）
  const guardRef = useRef(false)
  guardRef.current = dirty && !saved
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!guardRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const clearPrev = () => {
    try { storage()?.removeItem(prevDraftKey(formType)) } catch { /* noop */ }
    setPrev(null)
  }

  return {
    prev,
    showBanner: !!prev && step === 0 && !dirty,
    restore() {
      if (!prev) return null
      // 下書きの後にステップ数が変わった回でも、無いステップを開かない
      const s = Number.isInteger(lastStep) ? Math.min(Math.max(prev.step, 0), lastStep) : prev.step
      const restored = { data: mergeDraft(initialData, prev.data), step: s }
      clearPrev()
      return restored
    },
    discard: clearPrev,
  }
}

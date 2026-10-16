// 問診データを残す期間（院長 2026-10-17「90日」「未完了も消す」）。
//
// ■ なぜ消すか
//   ここにあるのは電子カルテに貼った後の作業用の写し。消さないと医療情報が溜まり続け、
//   万一漏れたときの被害が大きくなる。他院に提供するときも必ず聞かれる。
//
// ■ どう消すか
//   スタッフが一覧（GET /api/questionnaire）を開いたときに、保存から N 日を過ぎたものを消す。
//   cron（外から叩く API）を足さないのは、認証の外に出る入口を増やしたくないため。
//   一覧は毎日・30 秒ごとに開かれるので、これで足りる。同じサーバーでは 1 時間に 1 回だけ実行する。
//
// ■ 有効にするスイッチ = Vercel の環境変数 QUESTIONNAIRE_RETENTION_DAYS
//   未設定なら何も消さない。院長が Vercel で 90 を設定した時点から消え始める
//   （削除は元に戻せないので、有効にするのはコードの配備と切り離した）。
//   30 未満・数字でない値は「設定ミス」として無効扱い（「9」の打ち損じで 9 日分しか残らない事故を防ぐ）。
//
// ★状態（新規／完了）に関係なく消す。期間を過ぎても貼り付けていない回は、もう貼ることはない（院長判断）。

export const MIN_RETENTION_DAYS = 30
export const PURGE_INTERVAL_MS = 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** 環境変数から日数を読む。無効なら null（＝消さない） */
export function retentionDays(env = process.env) {
  const raw = String(env.QUESTIONNAIRE_RETENTION_DAYS ?? '').trim()
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return n >= MIN_RETENTION_DAYS ? n : null
}

/** これより前に保存されたものを消す（ISO 文字列） */
export function retentionCutoff(days, now = Date.now()) {
  return new Date(now - days * DAY_MS).toISOString()
}

let lastRunAt = 0

/** 前回から 1 時間たっていれば true を返し、実行したことにする */
export function claimPurgeSlot(now = Date.now()) {
  if (now - lastRunAt < PURGE_INTERVAL_MS) return false
  lastRunAt = now
  return true
}

/** テスト用 */
export function _resetPurgeSlot() { lastRunAt = 0 }

/**
 * 期限を過ぎた問診を消す。失敗しても一覧の表示は止めない（呼ぶ側で await しても例外を出さない）。
 * @returns {Promise<{ skipped: string } | { deleted: number, cutoff: string, days: number }>}
 */
export async function purgeExpired(supabase, { env = process.env, now = Date.now(), onDeleted } = {}) {
  const days = retentionDays(env)
  if (!days) return { skipped: 'disabled' }
  if (!claimPurgeSlot(now)) return { skipped: 'recent' }
  const cutoff = retentionCutoff(days, now)
  try {
    const { count, error } = await supabase
      .from('questionnaires')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff)
    if (error) {
      console.warn('[retention] delete failed:', error.message)
      lastRunAt = 0 // 次の一覧表示でもう一度試す
      return { skipped: 'error' }
    }
    const deleted = count || 0
    if (deleted > 0 && onDeleted) await onDeleted({ deleted, cutoff, days })
    return { deleted, cutoff, days }
  } catch (e) {
    console.warn('[retention] delete threw:', e?.message)
    lastRunAt = 0
    return { skipped: 'error' }
  }
}

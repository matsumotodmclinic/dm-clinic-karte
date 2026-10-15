// AI 呼び出し（/api/generate・/api/generate-karte）のレート制限（2026-10-15）
//
// 2026-04-24 のセキュリティ監査で 🔴「レート制限なし」とされていた項目。
// Anthropic の請求に直結するので、連打・暴走（不具合で呼び続ける等）に歯止めをかける。
//
// ■ 外部サービスを使わず、サーバーのメモリで数える
//   Upstash / Vercel KV を足すとアカウント・環境変数・障害点が 1 つ増える。
//   この規模（1 日数十件）ではそこまで要らないので、まずメモリで持つ。
//   ★限界: Vercel は負荷に応じてサーバーを複数立てるので、上限は「1 台あたり」になる。
//     （台数 × 上限 までは通りうる）。それでも「1 人が数千回」の暴走は止まる。
//     本当に厳密にしたくなったら、この関数の中身だけを KV に差し替えればよい。
//
// ■ 上限の根拠（1 人あたり）
//   ふだんの使い方は 患者 1 人につき 音声整形 2 回＋カルテ統合 1 回＋再生成 数回。
//   1 分に 20 回は人の手では届かない。1 時間 200 回は 1 日分を 1 時間で使い切る量。
//   ★超えたときは 429 を返すだけで、カルテ生成は JS 素組みにフォールバックする
//     （lib/generateKarte.js）。問診の保存が止まることはない。

export const LIMITS = [
  { windowMs: 60 * 1000, max: 20, label: '1分' },
  { windowMs: 60 * 60 * 1000, max: 200, label: '1時間' },
]

const LONGEST = Math.max(...LIMITS.map(l => l.windowMs))
const hits = new Map()   // key → 呼び出し時刻の配列（古い順）

/**
 * 1 回分を数えて、許可するかを返す。拒否した回は数えない。
 * @returns {{ ok: true } | { ok: false, retryAfterSec: number, label: string }}
 */
export function checkRateLimit(key, now = Date.now()) {
  const list = (hits.get(key) || []).filter(t => now - t < LONGEST)
  for (const { windowMs, max, label } of LIMITS) {
    const inWindow = list.filter(t => now - t < windowMs)
    if (inWindow.length >= max) {
      hits.set(key, list)
      return { ok: false, label, retryAfterSec: Math.ceil((inWindow[0] + windowMs - now) / 1000) }
    }
  }
  list.push(now)
  hits.set(key, list)
  // 使われなくなったキーを時々掃除する（メモリを増やし続けない）
  if (hits.size > 500) {
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] >= LONGEST) hits.delete(k)
  }
  return { ok: true }
}

// テスト用
export function resetRateLimit() { hits.clear() }

// 数える単位: スタッフ ID（無ければ IP）
export function rateLimitKey(req, user) {
  if (user?.id) return `staff:${user.id}`
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
  return `ip:${ip}`
}

// API ハンドラ用（/api/generate）: 超えていれば 429 を返して false
export function enforceRateLimit(req, res, user) {
  const r = checkRateLimit(rateLimitKey(req, user))
  if (r.ok) return true
  res.setHeader('Retry-After', String(r.retryAfterSec))
  res.status(429).json({ error: `AI の呼び出しが多すぎます（${r.label}の上限）。${r.retryAfterSec}秒後にもう一度お試しください。` })
  return false
}

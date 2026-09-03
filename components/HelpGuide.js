// HelpGuide 共通 component (dm-clinic-karte 版、 2026-05-31 初版 / 2026-09-03 配色・文字サイズ刷新)
// kinkan の apps/kinkan/src/components/HelpGuide/index.tsx および
// voice の apps/voice/app/components/HelpGuide/index.tsx と同じ API。
// 院長指示 (2026-05-31):「dm-clinic-karte にも勤怠と同様の完全ガイドを」 → 共通部品を JS で移植。
//
// ■ 2026-09-03 の変更 (院長指示:「どうせなら統一を。少し文字サイズを大きくしても見やすい」)
//   - 色は lib/uiTokens.js のトークンだけを使う。直書き hex を全廃した。
//     問診フォームと同じ「色は意味を担う」原則: 青=通常/緑=正常/橙=警告/赤=危険/グレー=中立。
//     紫 (#6a1b9a の見出し・#ce93d8 の点線・#7b1fa2 の表ヘッダ) は意味を持たないので廃止。
//   - 本文を 13px → 15px に拡大。ガイドは「読む」画面なので、
//     フォーム (選択肢中心・13px) より一段大きくする。行間も 1.8 のまま維持。
//
// 提供 components:
//   GuideHeader / Toc / Section / Subh / Box / Code / Table / Tr / Td
//   Step / Scenario / Trouble / GuideFooter / BackLink
//
// 1 つの完全ガイドページの基本構造:
//   <BackLink />
//   <GuideHeader ... themeColor={THEME} />
//   <Toc items={TOC} themeColor={THEME} />
//   <Section ...>
//     <Step ... /> or <Subh> + <Table> or <Box> ...
//   </Section>
//   ... (多数のセクション)
//   <Section ... 「シナリオ別 対応集」>
//     <Scenario q="○○したい">対処内容</Scenario>
//   </Section>
//   <Section ... 「トラブルシューティング」>
//     <Trouble symptom="症状">対応</Trouble>
//   </Section>
//   <GuideFooter />
//
// 注: dm-clinic-karte は Pages Router + JavaScript なので 'use client' 不要、
//      TypeScript 型注釈は省略 (kinkan/voice の .tsx 版と機能は完全に同じ)。

import React from 'react'
import Link from 'next/link'
import { UI } from '../lib/uiTokens'

// ガイド共通の寸法。ここを変えれば全ガイドの文字サイズが揃って動く。
export const GUIDE = {
  body: 15,        // 本文
  bodySmall: 14,   // 補足・callout・折りたたみの中身
  caption: 13,     // 表・コード・キャプション
  h2: 18,          // Section 見出し
  h3: 16,          // Subh
  lineHeight: 1.8,
  card: '0 2px 8px rgba(0,0,0,.06)',
}

// ---------- BackLink (戻る) ----------
export function BackLink({ href = '/help', label = '← ヘルプ目次へ' }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <Link href={href} legacyBehavior>
        <a style={{
          display: 'inline-block', padding: '6px 12px', borderRadius: 6,
          background: UI.surface, border: `1px solid ${UI.border}`, color: UI.textMuted,
          textDecoration: 'none', fontSize: GUIDE.caption, fontWeight: 700,
        }}>{label}</a>
      </Link>
    </div>
  )
}

// ---------- Layout ----------
export function GuideHeader({ icon, title, subtitle, themeColor }) {
  return (
    <nav style={{ background: themeColor, color: UI.surface, padding: '16px 18px', borderRadius: 10, marginBottom: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{icon} {title}</div>
      <div style={{ fontSize: GUIDE.bodySmall, opacity: 0.92, marginTop: 6, lineHeight: 1.7 }}>
        {subtitle}
      </div>
    </nav>
  )
}

export function Toc({ items, themeColor }) {
  return (
    <div style={{ background: UI.surface, borderRadius: 10, padding: 16, marginBottom: 16, boxShadow: GUIDE.card }}>
      <div style={{ fontSize: GUIDE.caption, fontWeight: 700, color: themeColor, marginBottom: 8 }}>📑 目次 (タップで該当章へ)</div>
      <ol style={{ paddingLeft: 20, margin: 0, fontSize: GUIDE.bodySmall, lineHeight: 2.0 }}>
        {items.map((t) => (
          <li key={t.id}>
            <a href={`#${t.id}`} style={{ color: UI.primary.fg, textDecoration: 'none' }}>
              {t.icon} {t.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function Section({ id, icon, title, themeColor, children }) {
  return (
    <section id={id} style={{ scrollMarginTop: 16, background: UI.surface, borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: GUIDE.card }}>
      <h2 style={{ fontSize: GUIDE.h2, fontWeight: 700, color: themeColor, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${themeColor}33` }}>
        {icon} {title}
      </h2>
      <div style={{ fontSize: GUIDE.body, color: UI.text, lineHeight: GUIDE.lineHeight }}>
        {children}
      </div>
    </section>
  )
}

// 章の中の小見出し。色は付けず (旧: 紫)、太さとサイズだけで階層を出す。
export function Subh({ children }) {
  return (
    <h3 style={{ fontSize: GUIDE.h3, fontWeight: 700, color: UI.text, marginTop: 20, marginBottom: 8 }}>
      {children}
    </h3>
  )
}

// ---------- Callout boxes ----------
export function Box({ color, children }) {
  const tone = {
    info: UI.primary,
    warning: UI.warning,
    success: UI.success,
    danger: UI.danger,
  }[color] || UI.neutral
  return (
    <div style={{
      padding: '12px 14px', margin: '10px 0',
      background: tone.bg, border: `1px solid ${tone.fg}55`, borderRadius: 6,
      fontSize: GUIDE.bodySmall, color: tone.fg, lineHeight: 1.75,
    }}>
      {children}
    </div>
  )
}

// ---------- Inline elements ----------
export function Code({ children }) {
  return <code style={{ background: UI.surfaceAlt, border: `1px solid ${UI.border}`, padding: '1px 6px', borderRadius: 3, fontFamily: 'monospace', fontSize: GUIDE.caption, color: UI.text }}>{children}</code>
}

// ---------- Tables ----------
export function Table({ headers, themeColor, children }) {
  const accent = themeColor || UI.primary.fg
  return (
    <div style={{ overflowX: 'auto', margin: '10px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: GUIDE.caption, minWidth: 500 }}>
        <thead>
          <tr style={{ background: `${accent}22` }}>
            {headers.map((h) => (
              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', border: `1px solid ${accent}66`, color: accent, fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Tr({ highlight, children }) {
  return <tr style={{ borderBottom: `1px solid ${UI.border}`, background: highlight ? UI.accent.bg : undefined }}>{children}</tr>
}

export function Td({ children }) {
  return <td style={{ padding: '7px 10px', border: `1px solid ${UI.border}`, verticalAlign: 'top', lineHeight: 1.7 }}>{children}</td>
}

// ---------- Step (numbered process) ----------
export function Step({ n, title, themeColor, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '13px 0', borderTop: n === 1 ? 'none' : `1px solid ${UI.border}` }}>
      <div style={{
        flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
        background: themeColor, color: UI.surface,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 15,
      }}>{n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: GUIDE.h3, fontWeight: 700, color: themeColor, marginBottom: 5 }}>{title}</div>
        <div style={{ fontSize: GUIDE.body, lineHeight: GUIDE.lineHeight, color: UI.text }}>{children}</div>
      </div>
    </div>
  )
}

// ---------- Scenario (foldable、「○○したい」 系) ----------
export function Scenario({ q, themeColor, children }) {
  return (
    <details style={{ marginBottom: 10, padding: '12px 14px', background: UI.surfaceAlt, borderRadius: 6, border: `1px solid ${UI.border}` }}>
      <summary style={{ cursor: 'pointer', fontSize: GUIDE.bodySmall, fontWeight: 700, color: themeColor, listStyle: 'none' }}>
        <span style={{ color: UI.primary.fg, marginRight: 6 }}>シナリオ:</span> {q}
      </summary>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${UI.border}`, fontSize: GUIDE.bodySmall, lineHeight: GUIDE.lineHeight, color: UI.text }}>
        <span style={{ color: UI.success.fg, fontWeight: 700, marginRight: 6 }}>対処:</span>{children}
      </div>
    </details>
  )
}

// ---------- Trouble (foldable、 症状ベース) ----------
export function Trouble({ symptom, children }) {
  return (
    <details style={{ marginBottom: 10, padding: '12px 14px', background: UI.danger.bg, borderRadius: 6, border: `1px solid ${UI.danger.fg}55` }}>
      <summary style={{ cursor: 'pointer', fontSize: GUIDE.bodySmall, fontWeight: 700, color: UI.danger.fg, listStyle: 'none' }}>
        <span style={{ color: UI.danger.fg, marginRight: 6 }}>症状:</span> {symptom}
      </summary>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${UI.danger.fg}44`, fontSize: GUIDE.bodySmall, lineHeight: GUIDE.lineHeight, color: UI.text }}>
        {children}
      </div>
    </details>
  )
}

// ---------- Footer with "詰まったら" links ----------
// 旧版は緑地だったが、「解決しない場合」 は完了でも正常でもないので中立の面に変更。
export function GuideFooter() {
  const link = { color: UI.primary.fg, textDecoration: 'underline' }
  return (
    <div style={{ background: UI.surface, border: `1px solid ${UI.border}`, borderRadius: 12, padding: 18, marginTop: 24, fontSize: GUIDE.bodySmall, color: UI.text, lineHeight: 1.9, boxShadow: GUIDE.card }}>
      <strong>💡 解決しない場合</strong>:<br />
      • <Link href="/help" legacyBehavior><a style={link}>ヘルプ目次</a></Link> から他のフォームのガイドを参照<br />
      • <Link href="/" legacyBehavior><a style={link}>トップページ</a></Link> でフォーム一覧に戻る<br />
      • それでも解決しない場合は院長 / 担当パートナー / KartePlus 本部 (<a href="mailto:karteplus2026@gmail.com" style={link}>karteplus2026@gmail.com</a>) へ
    </div>
  )
}

// HelpGuide 共通 component (dm-clinic-karte 版、 2026-05-31)
// kinkan の apps/kinkan/src/components/HelpGuide/index.tsx および
// voice の apps/voice/app/components/HelpGuide/index.tsx と同じ API・ 同じ見た目。
// 院長指示 (2026-05-31):「dm-clinic-karte にも勤怠と同様の完全ガイドを」 → 共通部品を JS で移植。
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

// ---------- BackLink (戻る) ----------
export function BackLink({ href = '/help', label = '← ヘルプ目次へ' }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <Link href={href} legacyBehavior>
        <a style={{
          display: 'inline-block', padding: '6px 12px', borderRadius: 6,
          background: '#fff', border: '1px solid #cfd8dc', color: '#37474f',
          textDecoration: 'none', fontSize: 13, fontWeight: 600,
        }}>{label}</a>
      </Link>
    </div>
  )
}

// ---------- Layout ----------
export function GuideHeader({ icon, title, subtitle, themeColor }) {
  return (
    <nav style={{ background: themeColor, color: '#fff', padding: '14px 18px', borderRadius: 10, marginBottom: 16 }}>
      <div style={{ fontSize: 19, fontWeight: 700 }}>{icon} {title}</div>
      <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4, lineHeight: 1.6 }}>
        {subtitle}
      </div>
    </nav>
  )
}

export function Toc({ items, themeColor }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: themeColor, marginBottom: 8 }}>📑 目次 (タップで該当章へ)</div>
      <ol style={{ paddingLeft: 20, margin: 0, fontSize: 13, lineHeight: 1.9 }}>
        {items.map((t) => (
          <li key={t.id}>
            <a href={`#${t.id}`} style={{ color: '#1565c0', textDecoration: 'none' }}>
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
    <section id={id} style={{ scrollMarginTop: 16, background: '#fff', borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: themeColor, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${themeColor}33` }}>
        {icon} {title}
      </h2>
      <div style={{ fontSize: 13, color: '#333', lineHeight: 1.8 }}>
        {children}
      </div>
    </section>
  )
}

export function Subh({ children }) {
  return (
    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#6a1b9a', marginTop: 18, marginBottom: 8 }}>
      {children}
    </h3>
  )
}

// ---------- Callout boxes ----------
export function Box({ color, children }) {
  const palette = {
    info:    { bg: '#e3f2fd', border: '#90caf9', text: '#0d47a1' },
    warning: { bg: '#fff3e0', border: '#ffb74d', text: '#5d4037' },
    success: { bg: '#e8f5e9', border: '#a5d6a7', text: '#1b5e20' },
    danger:  { bg: '#ffebee', border: '#ef9a9a', text: '#b71c1c' },
  }[color] || { bg: '#f5f5f5', border: '#bdbdbd', text: '#333' }
  return (
    <div style={{
      padding: '10px 14px', margin: '10px 0',
      background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 6,
      fontSize: 12, color: palette.text, lineHeight: 1.7,
    }}>
      {children}
    </div>
  )
}

// ---------- Inline elements ----------
export function Code({ children }) {
  return <code style={{ background: '#f5f5f5', padding: '1px 6px', borderRadius: 3, fontFamily: 'monospace', fontSize: 12 }}>{children}</code>
}

// ---------- Tables ----------
export function Table({ headers, themeColor, children }) {
  const accent = themeColor || '#7b1fa2'
  return (
    <div style={{ overflowX: 'auto', margin: '10px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 500 }}>
        <thead>
          <tr style={{ background: `${accent}22` }}>
            {headers.map((h) => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', border: `1px solid ${accent}66`, color: accent, fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Tr({ highlight, children }) {
  return <tr style={{ borderBottom: '1px solid #f0f0f0', background: highlight ? '#fff8e1' : undefined }}>{children}</tr>
}

export function Td({ children }) {
  return <td style={{ padding: '6px 10px', border: '1px solid #e0e0e0', verticalAlign: 'top' }}>{children}</td>
}

// ---------- Step (numbered process) ----------
export function Step({ n, title, themeColor, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: n === 1 ? 'none' : '1px solid #f0f0f0' }}>
      <div style={{
        flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
        background: themeColor, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 14,
      }}>{n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: themeColor, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: '#444' }}>{children}</div>
      </div>
    </div>
  )
}

// ---------- Scenario (foldable, blue, "○○したい" 系) ----------
export function Scenario({ q, themeColor, children }) {
  return (
    <details style={{ marginBottom: 10, padding: '10px 14px', background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}>
      <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: themeColor, listStyle: 'none' }}>
        <span style={{ color: '#1565c0', marginRight: 6 }}>シナリオ:</span> {q}
      </summary>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #ce93d8', fontSize: 12, lineHeight: 1.8, color: '#333' }}>
        <span style={{ color: '#2e7d32', fontWeight: 700, marginRight: 6 }}>対処:</span>{children}
      </div>
    </details>
  )
}

// ---------- Trouble (foldable, red, 症状ベース) ----------
export function Trouble({ symptom, children }) {
  return (
    <details style={{ marginBottom: 10, padding: '10px 14px', background: '#fff5f5', borderRadius: 6, border: '1px solid #ef9a9a' }}>
      <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#c62828', listStyle: 'none' }}>
        <span style={{ color: '#b71c1c', marginRight: 6 }}>症状:</span> {symptom}
      </summary>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #ef9a9a', fontSize: 12, lineHeight: 1.8, color: '#333' }}>
        {children}
      </div>
    </details>
  )
}

// ---------- Footer with "詰まったら" links ----------
export function GuideFooter() {
  return (
    <div style={{ background: '#e8f5e9', borderRadius: 12, padding: 16, marginTop: 24, fontSize: 13, color: '#1b5e20', lineHeight: 1.7 }}>
      <strong>💡 解決しない場合</strong>:<br />
      • <Link href="/help" legacyBehavior><a style={{ color: '#1565c0', textDecoration: 'underline' }}>ヘルプ目次</a></Link> から他のフォームのガイドを参照<br />
      • <Link href="/" legacyBehavior><a style={{ color: '#1565c0', textDecoration: 'underline' }}>トップページ</a></Link> でフォーム一覧に戻る<br />
      • それでも解決しない場合は院長 / 担当パートナー / KartePlus 本部 (<a href="mailto:karteplus2026@gmail.com" style={{ color: '#1565c0' }}>karteplus2026@gmail.com</a>) へ
    </div>
  )
}

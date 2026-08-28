// 線画アイコン (勤怠アプリ apps/kinkan/src/components/TileIcon.tsx と同じ作法)
//
// 絵文字は OS 依存でカラー固定・立体的なので業務アプリでは幼く見える
// (memory: feedback-ui-visual-style / 2026-07-06 院長)。
// → 単色ストロークの SVG + 意味を担う色チップに統一する。
//   外部アイコンフォントは使わない (自己完結・CSP)。色は stroke="currentColor" で親から与える。
//
// viewBox 24x24 / strokeWidth 1.8 / round cap は勤怠と揃えてある。

const PATHS = {
  // ── 問診フォーム ──
  // 聴診器: DM基本 (2型糖尿病)。勤怠の stethoscope と同一パス
  stethoscope: (
    <>
      <path d="M6 4v5a4.5 4.5 0 0 0 9 0V4" />
      <path d="M10.5 13.3v2.7a4.9 4.9 0 0 0 9.8 0v-2" />
      <circle cx="20.3" cy="11.5" r="1.9" />
    </>
  ),
  // 注射器: 1型糖尿病 (インスリン)
  syringe: (
    <>
      <path d="M16.5 3.5l4 4" />
      <path d="M14.5 5.5l4 4" />
      <path d="M16.5 7.5l-9 9-3.5 1 1-3.5 9-9z" />
      <path d="M11 9.5l2.5 2.5" />
      <path d="M8.5 12l2.5 2.5" />
    </>
  ),
  // 妊娠: 妊娠糖尿病（横向きの人＋大きなお腹。お腹を主役にする）
  pregnancy: (
    <>
      <circle cx="8.4" cy="4.2" r="2.2" />
      <path d="M8.4 8.1c-1.2 0-2 .9-2.1 2.1L5.4 21" />
      <path d="M8.8 9.4c4 0 7 2.5 7 5.5 0 2.8-2.7 4.8-6.3 4.9" />
      <path d="M9.5 19.8l1.6 1.2" />
    </>
  ),
  // 親子: 小児1型糖尿病（保護者が代行入力するフォーム＝大小2人で表す）
  'parent-child': (
    <>
      <circle cx="8.5" cy="6" r="2.6" />
      <path d="M4.5 20.5v-4.2c0-2.2 1.8-3.8 4-3.8s4 1.6 4 3.8v4.2" />
      <circle cx="17" cy="11" r="1.9" />
      <path d="M14 20.5v-3.1c0-1.6 1.3-2.7 3-2.7s3 1.1 3 2.7v3.1" />
    </>
  ),
  // 下降する血糖: 反応性低血糖 (食後に落ちる曲線)
  'glucose-drop': (
    <>
      <path d="M3.5 19.5h17" />
      <path d="M4.5 9l3.5-3.5 3 5 3.5 6 5-3" />
      <path d="M19.5 13.5l.6-3.4-3.4.6" />
    </>
  ),
  // 甲状腺: 蝶形（甲状腺は蝶の形。甲状腺疾患の一般的なシンボルでもある）
  thyroid: (
    <>
      <path d="M12 6.6v10.8" />
      <path d="M12 8.4C9.9 5.2 5.6 4.9 4.3 7.6c-1.2 2.5.3 6.1 3 7.5 1.9 1 3.8.4 4.7-1.4" />
      <path d="M12 8.4c2.1-3.2 6.4-3.5 7.7-.8 1.2 2.5-.3 6.1-3 7.5-1.9 1-3.8.4-4.7-1.4" />
    </>
  ),
  // 心臓+脈: 高血圧・脂質異常症
  'heart-pulse': (
    <>
      <path d="M20.4 7.7a4.6 4.6 0 0 0-8.4-2.2 4.6 4.6 0 0 0-8.4 2.2c0 4.6 6.3 8.3 8.4 10.6 2.1-2.3 8.4-6 8.4-10.6z" />
      <path d="M3.8 11.4h3.6l1.5-2.6 2 5 1.6-3.1h3.4" />
    </>
  ),
  // 分子: 内分泌 (ホルモン)
  molecule: (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="5" cy="6.5" r="2" />
      <circle cx="19" cy="7.5" r="2" />
      <circle cx="7.5" cy="19" r="2" />
      <path d="M6.6 8.1l3.8 2.6M17.4 9l-3.5 1.7M9.3 17.6l1.9-3.4" />
    </>
  ),
  // 月: 睡眠時無呼吸症候群
  moon: (
    <>
      <path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.6 8.6 0 1 0 20 14.4z" />
    </>
  ),

  // ── 画面操作 ──
  clipboard: (
    <>
      <rect x="5.5" y="4.5" width="13" height="16.5" rx="2" />
      <path d="M9.5 4.5V3h5v1.5" />
      <path d="M9 11h6M9 15h6" />
    </>
  ),
  book: (
    <>
      <path d="M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z" />
      <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" />
    </>
  ),
  'book-medical': (
    <>
      <path d="M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z" />
      <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" />
      <path d="M13 6.5v5M10.5 9h5" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14" />
      <path d="M17 8.5l3.5 3.5-3.5 3.5" />
      <path d="M20 12H9.5" />
    </>
  ),
  chevron: <path d="M9.5 5.5l6.5 6.5-6.5 6.5" />,
}

export default function LineIcon({ name, size = 22, strokeWidth = 1.8, style }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {d}
    </svg>
  )
}

// 【事前聴取時　申し送り事項】のうち、判断が要らず form_data から一意に決まる行を
// JS 側で組み立てる。経路A(components/*IntakeTool.js) / 経路B(lib/buildKartePrompt.js)
// の両方がこの関数を呼ぶ。
//
// 背景 (2026-09-06):
//   従来は「（新患2枠取得済の場合）□新患2枠取得済み」のような条件文をプロンプトに書き、
//   判定も出力も AI に任せていた。判定材料は全て form_data.body にあり AI の判断は要らない。
//   決定論的に組み立てると
//     ・条件の取りこぼしが原理的に起きない（生成の欠落 = 臨床リスクへの最も効く対策）
//     ・ユニットテストで固定できる
//     ・経路A/B が同じ関数を呼ぶのでプロンプト二重管理の対象から外れる
//
//   なお医師希望の行は、これまで経路A が「□医師希望：女性医師」、
//   経路B・甲状腺が「□女性医師希望」と別の文字列を出していた（初回生成と再生成で不一致）。
//   CLAUDE.md の規定どおり経路A の表記に統一する。

// body.doctorGender → 申し送りの表記。指定なし/未入力は行そのものを出さない。
function doctorPreferenceLine(doctorGender) {
  const g = (doctorGender || '').trim()
  if (!g || g === '指定なし') return ''
  const label = g === '女性医師希望' ? '女性医師'
    : g === '男性医師希望' ? '男性医師'
    : g // 「院長（初回のみ）」等はそのまま
  return `□医師希望：${label}`
}

// スタッフ入力（新患2枠・医師希望・患者フラグ）由来の申し送り行を配列で返す。
// 該当なしなら空配列。順序は従来のプロンプト記載順と同じ。
export function buildStaffFlagLines(body) {
  const b = body || {}
  const lines = []
  if (b.doubleSlot) lines.push('□新患2枠取得済み')
  const doctorLine = doctorPreferenceLine(b.doctorGender)
  if (doctorLine) lines.push(doctorLine)
  if (b.patientFlag === '○患者疑い（話が長い方）') lines.push('□○患者疑い（対応注意）')
  if (b.patientFlag === '●患者疑い（出禁対象）') lines.push('□●患者疑い（出禁対象・要確認）')
  return lines
}

// プロンプトの出力フォーマットに差し込む文字列。
// 各行に改行を付けて返す（該当なしなら空文字）。呼び出し側で
//   ${buildStaffFlagsBlock(body)}【診察にあたっての要望】
// と書くと、空行が入らずに済む（♯疾患の空行ルール5「申し送り最終□行→要望は空行なし」）。
export function buildStaffFlagsBlock(body) {
  const lines = buildStaffFlagLines(body)
  return lines.length ? lines.join('\n') + '\n' : ''
}

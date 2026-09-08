// form_data を「カルテ組立が期待する型」に揃える（入口で 1 回だけ）。
//
// 背景 (2026-09-08 の 4 回目の検証):
//   配列であるはずの項目に文字列が入っていると `.join is not a function` で
//   **カルテ生成が例外を投げ、詳細画面の再生成が 500 になる**（＝カルテが作れない）。
//   質が落ちるのではなく完全に止まるので、劣化としては最も重い。
//
//   フォームから来る限り型は保たれるが、次の経路で崩れうる:
//     ・過去のレコード（項目の型を変えた前後をまたぐ）
//     ・DB を直接編集した場合
//     ・/api/questionnaire に直接 POST された場合（form_data は object 型しか見ていない）
//
// 方針:
//   ・配列を期待する項目 → 必ず配列にする
//   ・それ以外のプリミティブ → 文字列にする（`.trim()` `.includes()` が全て安全になる）
//   ・真偽値はそのまま（フラグ判定に使うため）
//
// ★組立側 119 箇所を個別に守るのではなく、ここ 1 箇所で型を保証する。

// 配列として扱う項目名（全 14 フォームぶん）
const ARRAY_KEYS = new Set([
  // 家族歴
  'dmWho', 'thyroidWho', 'dm1Who', 'collagenItems', 'fhOthers', 'fhDmWho',
  // 生活・既往
  'alcoholItems', 'otherDiseases', 'checkup', 'livingOther', 'childGender', 'job',
  // 体格・希望
  'preferredDays', 'deviceWish',
  // 症状（selected は dmSymptoms / sasSymptoms / 甲状腺 symptom 共通）
  'selected', 'timing', 'symptoms', 'cause',
  // SAS
  'purposes', 'knowSource',
  // 甲状腺
  'medications', 'thyroidConcernReason',
  // 小児1型
  'booklets', 'documents', 'familySubList', 'schoolStaff', 'schoolSupportPerson',
  'childActivities', 'parentWorkMain', 'parentWorkSub',
  // 妊娠糖尿病
  'pastGDMChild',
])

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)

// HTML タグらしき文字列を落とす。
// カルテはプレーンテキストとして電子カルテに貼る（QR でも渡す）ので、タグは出さない方針
// （旧プロンプトにも「HTMLタグ・style属性は絶対に出力しない」と明記されていた）。
// ★「<140/90」のような医療表記は消さない — 英字で始まるものだけをタグと見なす。
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g

// プリミティブ → 文字列（真偽値だけはフラグなので残す）
function scalar(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v
  if (typeof v === 'object') return ''   // 配列/オブジェクトが来る想定でない場所
  return String(v).replace(HTML_TAG, '')
}

function normalizeValue(key, v) {
  // ★真偽値は配列化しない。キー名だけで判定すると `selected` を取り違える:
  //   dmSymptoms.selected は配列だが、gastricCancer.selected は真偽値。
  //   false を [] にすると `!x.selected` が false になり、
  //   **選択していない重要既往が全部カルテに出る**（2026-09-08 に実際に作り込んだ）
  if (typeof v === 'boolean') return v
  if (ARRAY_KEYS.has(key)) {
    const list = Array.isArray(v) ? v : (v === null || v === undefined || v === '' ? [] : [v])
    return list
      .filter(x => x !== null && x !== undefined)
      .map(x => (isPlainObject(x) ? normalizeObject(x) : scalar(x)))
  }
  if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined).map(x => (isPlainObject(x) ? normalizeObject(x) : scalar(x)))
  if (isPlainObject(v)) return normalizeObject(v)
  return scalar(v)
}

function normalizeObject(o) {
  const out = {}
  for (const [k, v] of Object.entries(o)) out[k] = normalizeValue(k, v)
  return out
}

export function normalizeFormData(form_data) {
  if (!isPlainObject(form_data)) return {}
  return normalizeObject(form_data)
}

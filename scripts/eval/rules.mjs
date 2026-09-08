// 生成されたカルテ本文を機械判定するルール。
//
// voice 側の出力 eval に倣うが、問診は本文を JS が決定論的に組むので **API を呼ばずに判定できる**。
// AI が関わるのは「自由記述の文章化」だけなので、そこだけ別に eval:ai で見る。
//
// 判定は 3 段階:
//   error … 患者に渡してはいけない（破損・情報の創作・必須欄の欠落）
//   warn  … 読みにくい・運用で困る（書式の乱れ）
//   info  … 気付き（判断材料。落とさない）

const RE = {
  broken: /(undefined|null|NaN|\[object Object\]|Infinity)/,
  htmlTag: /<[a-zA-Z/][^>]*>/,
  // AI 向けの指示文がカルテに混入していないか
  instruction: /(?:該当時のみ|整形済みテキスト|患者情報JSON|記載あれば|該当なければ省略|そのまま出力する|チェックされた症状を|出力フォーマット|以下の患者情報)/,
  seireki: /(?:19|20)\d{2}\s*年/,          // 西暦は使わない（和暦のみ）
  // 「○年前」だけでなく「去年」「半年前」のような相対表現も和暦に直す
  relative: /(?:\d+\s*(?:年前|ヶ月前|か月前|カ月前|週間前)|半年前|去年|昨年|一昨年|今年|先月|来月)/,
  trailingWs: /[ 　\t]+$/,
  divider: /^-{10,}$/,
  // 「→」で治療病院と通院先を繋ぐので、そこで区切らないと 2 施設を 1 つと誤認する
  hospital: /[^\s（）　、・：:→＋+]{2,}(?:病院|クリニック|医院|センター|診療所)/g,
}

const lines = k => k.split('\n')

// フッターの「医師の記入欄」= 空行4つ。ここだけは連続空行を許す
function bodyLines(k) {
  const ls = lines(k)
  // 最後の区切り線より後ろはフッター
  let last = -1
  ls.forEach((l, i) => { if (RE.divider.test(l)) last = i })
  return last >= 0 ? ls.slice(0, last) : ls
}

export const RULES = [
  // ── error: 破損・混入 ──────────────────────────────
  {
    id: 'broken-value', level: 'error',
    desc: 'undefined / NaN / [object Object] などが本文に出ていない',
    check: (k) => lines(k).filter(l => RE.broken.test(l)).map(l => `破損値: ${l}`),
  },
  {
    id: 'ai-instruction', level: 'error',
    desc: 'AI 向けの指示文がカルテ本文に混入していない',
    check: (k) => lines(k).filter(l => RE.instruction.test(l)).map(l => `指示文の混入: ${l}`),
  },
  {
    id: 'html-tag', level: 'error',
    desc: 'HTML タグが出ていない（そのまま電子カルテに貼るため）',
    check: (k) => lines(k).filter(l => RE.htmlTag.test(l)).map(l => `HTMLタグ: ${l}`),
  },
  {
    id: 'empty-output', level: 'error',
    desc: 'カルテが空でない・極端に短くない',
    check: (k) => (lines(k).length < 15 ? [`行数が少なすぎる: ${lines(k).length}行`] : []),
  },

  // ── error: 必須の欄 ────────────────────────────────
  {
    id: 'required-sections', level: 'error',
    desc: '【アレルギー歴】【事前聴取時　申し送り事項】【診察にあたっての要望】がある',
    check: (k) => ['【アレルギー歴】', '【事前聴取時　申し送り事項】', '【診察にあたっての要望】']
      .filter(s => !k.includes(s)).map(s => `必須セクションが無い: ${s}`),
  },
  {
    id: 'handoff-guide', level: 'error',
    desc: '申し送りの先頭に「□通院のご案内をお渡し済」がある（当日紹介の悪性疑いを除く）',
    check: (k, c) => (c.form === '甲状腺（腺腫悪性疑い）' ? []
      : k.includes('□通院のご案内をお渡し済') ? [] : ['「□通院のご案内をお渡し済」が無い']),
  },
  {
    id: 'section-dup', level: 'error',
    desc: '同じセクション見出しが 2 回出ていない',
    check: (k) => {
      const seen = new Map()
      for (const l of lines(k)) {
        const m = l.match(/^【[^】]+】/)
        if (m) seen.set(m[0], (seen.get(m[0]) || 0) + 1)
      }
      return [...seen].filter(([, n]) => n > 1).map(([s, n]) => `セクションが ${n} 回出ている: ${s}`)
    },
  },

  {
    id: 'no-literal-sonota', level: 'error',
    desc: '選択肢の「その他」がそのまま出ていない（自由入力とセットの「その他: ○○」だけ可）',
    // 2026-09-08 の実例: 「上尾中央総合病院 その他」「○○病院・その他より紹介」
    //   「【仕事】その他」「・居住地：その他」。書いても情報がゼロで、読み手を迷わせる
    check: (k) => lines(k)
      .filter(l => l.replace(/その他:\s*/g, '').includes('その他'))
      .map(l => `選択値の「その他」が出ている: ${l}`),
  },

  // ── error: 和暦統一 ────────────────────────────────
  {
    id: 'wareki-only', level: 'error',
    desc: '西暦・「○年前」を使っていない（時期は和暦のみ）',
    check: (k, c) => {
      const out = []
      for (const l of lines(k)) {
        // 入力にその文字列がそのまま含まれる場合は患者/スタッフの記述なので対象外
        const raw = JSON.stringify(c.data)
        const s = l.match(RE.seireki)
        if (s && !raw.includes(s[0])) out.push(`西暦が出ている: ${l}`)
        const r = l.match(RE.relative)
        if (r && !raw.includes(r[0])) out.push(`相対表記が出ている: ${l}`)
      }
      return out
    },
  },

  // ── error: 情報の創作 ──────────────────────────────
  {
    id: 'no-invented-hospital', level: 'error',
    desc: '入力に無い医療機関名が出ていない',
    check: (k, c) => {
      const raw = JSON.stringify(c.data)
      const out = []
      for (const l of lines(k)) {
        if (!/^[♯＃]/.test(l) && !l.startsWith('【眼科通院歴】')) continue
        for (const m of l.match(RE.hospital) || []) {
          if (!raw.includes(m)) out.push(`入力に無い医療機関名: ${m}（${l}）`)
        }
      }
      return out
    },
  },
  {
    id: 'body-numbers', level: 'error',
    desc: '身長・体重が入力どおり（勝手な数値を置かない）',
    check: (k, c) => {
      const b = c.data.body || {}
      const line = lines(k).find(l => l.startsWith('身長:'))
      if (!line) return []
      const out = []
      // 0 以下・数値でないものは打ち間違いとして「○」に倒す仕様
      const want = v => (parseFloat(v) > 0 ? v : '○')
      const h = line.match(/身長:([^c]*)cm/)?.[1]
      const w = line.match(/初診時:([^k]*)kg/)?.[1]
      if (h !== want(b.height)) out.push(`身長が一致しない: 入力 ${JSON.stringify(b.height)} / 出力 ${JSON.stringify(h)}`)
      if (w !== want(b.weightNow)) out.push(`体重が一致しない: 入力 ${JSON.stringify(b.weightNow)} / 出力 ${JSON.stringify(w)}`)
      // BMI は入力から計算し直して照合
      const bmi = line.match(/（BMI ([\d.]+)）/)?.[1]
      if (bmi) {
        const want = (parseFloat(b.weightNow) / Math.pow(parseFloat(b.height) / 100, 2)).toFixed(1)
        if (bmi !== want) out.push(`BMI が合わない: 出力 ${bmi} / 計算 ${want}`)
      }
      return out
    },
  },

  // ── error: 情報の欠落 ──────────────────────────────
  {
    id: 'other-diseases-kept', level: 'error',
    desc: '「その他の病名・既往歴」が 1 件も落ちていない（病名も通院先も）',
    check: (k, c) => {
      const list = c.data.disease?.otherDiseases?.some(x => x?.name) ? c.data.disease.otherDiseases
        : (c.data.history?.otherDiseases || [])
      const out = []
      for (const x of list) {
        if (!x?.name) continue
        // ★病名と通院先は「同じ行に」出ていること。
        //   カルテ全体に含まれるかで見ると、受診理由に出てくる紹介元の病院名を
        //   誤って「通院先が残っている」と数えてしまう（実際に取りこぼした）
        const line = lines(k).find(l => /^[♯＃]/.test(l) && l.includes(x.name))
        if (!line) { out.push(`病名が落ちている: ${x.name}`); continue }
        const hosp = x.hospital === 'その他' ? (x.hospitalOther || '') : (x.hospital || '')
        if (hosp && hosp !== '通院なし' && !line.includes(hosp)) out.push(`通院先が落ちている: ${x.name} → ${hosp}`)
      }
      return out
    },
  },
  {
    id: 'staff-flags-kept', level: 'error',
    desc: 'スタッフ入力（医師希望・患者フラグ・新患2枠）が申し送りに出ている',
    check: (k, c) => {
      const b = c.data.body || {}
      const out = []
      if (b.doubleSlot && !k.includes('□新患2枠取得済み')) out.push('新患2枠が申し送りに無い')
      if (b.doctorGender && b.doctorGender !== '指定なし' && !k.includes('□医師希望：')) out.push('医師希望が申し送りに無い')
      if (b.patientFlag?.includes('患者疑い') && !k.includes('患者疑い')) out.push('患者フラグが申し送りに無い')
      return out
    },
  },
  {
    id: 'concern-kept', level: 'error',
    desc: '【診察にあたっての要望】に入力がそのまま出ている（空なら「なし」）',
    check: (k, c) => {
      const want = c.data.body?.concern || 'なし'
      return k.includes(`【診察にあたっての要望】${want}`) ? [] : [`要望が一致しない: 入力 ${JSON.stringify(want)}`]
    },
  },
  {
    id: 'free-text-kept', level: 'error',
    desc: '自由記入欄が申し送りに「□補足：」として逐語で出ている',
    // ★2026-09-08 院長判断: 自由記入は受診理由サマリーに混ぜず申し送りに回す。
    //   AI を通さないので逐語で残る＝生成のたびに載ったり落ちたりしない
    //   （それ以前は「1〜2行にまとめて」の制限で 3 回中 1〜2 回落ちていた）
    check: (k, c) => {
      const t = (c.data.reason?.summary || '').trim()
      if (!t) return []
      if (k.includes(`□補足：${t}`)) return []
      return [`自由記入が申し送りに出ていない: ${t.slice(0, 30)}…`]
    },
  },

  // ── warn: 書式 ────────────────────────────────────
  {
    id: 'no-double-blank', level: 'warn',
    desc: '本文（フッターの記入欄より前）に連続した空行が無い',
    check: (k) => {
      const ls = bodyLines(k)
      const out = []
      for (let i = 1; i < ls.length; i++) if (ls[i] === '' && ls[i - 1] === '') out.push(`${i + 1}行目に連続した空行`)
      return out
    },
  },
  {
    id: 'handoff-adjacent', level: 'warn',
    desc: '申し送りの最終□行と【診察にあたっての要望】の間に空行が無い（空行ルール⑤）',
    check: (k) => {
      const ls = lines(k)
      const i = ls.findIndex(l => l.startsWith('【診察にあたっての要望】'))
      if (i < 1) return []
      return ls[i - 1].startsWith('□') ? [] : [`要望の直前が □ 行でない: ${JSON.stringify(ls[i - 1])}`]
    },
  },
  {
    id: 'past-history-blank', level: 'warn',
    desc: '♯他院管理の前だけ1行空ける・【アレルギー歴】の直前は空けない（空行ルール②④）',
    check: (k, c) => {
      const ls = lines(k)
      const out = []
      // 甲状腺だけは「エコー所見ブロックと【アレルギー歴】の間のみ1行空ける」が仕様
      const isThyroid = c.form.startsWith('甲状腺')
      const iAllergy = ls.findIndex(l => l.startsWith('【アレルギー歴】'))
      if (!isThyroid && iAllergy > 0 && ls[iAllergy - 1] === '') out.push('【アレルギー歴】の直前に空行がある')
      const iPast = ls.findIndex(l => /^♯/.test(l) && !l.startsWith('♯反応性低血糖疑い'))
      if (iPast > 0 && ls[iPast - 1] !== '' && !/^[♯＃・]/.test(ls[iPast - 1])) {
        out.push(`♯他院管理の前に1行空いていない: ${JSON.stringify(ls[iPast - 1])}`)
      }
      return out
    },
  },
  {
    id: 'divider-not-adjacent', level: 'warn',
    desc: '区切り線が連続していない（間に必ず内容がある）',
    check: (k) => {
      const ls = lines(k)
      const out = []
      for (let i = 1; i < ls.length; i++) {
        if (RE.divider.test(ls[i]) && RE.divider.test(ls[i - 1])) out.push(`${i + 1}行目: 区切り線が連続`)
      }
      return out
    },
  },
  {
    id: 'no-trailing-space', level: 'warn',
    desc: '行末に余分な空白が無い',
    check: (k) => lines(k).map((l, i) => (RE.trailingWs.test(l) ? `${i + 1}行目に行末空白` : '')).filter(Boolean),
  },
  {
    id: 'no-empty-parens', level: 'warn',
    desc: '中身が空の括弧「（）」が出ていない',
    // 「CPR（　）」のように全角スペースが入っているものは医師の記入欄なので対象外
    check: (k) => lines(k).filter(l => /（）/.test(l)).map(l => `空の括弧: ${l}`),
  },
  {
    id: 'no-dangling-punct', level: 'warn',
    desc: '「、」「・」で終わる行・先頭が「、」の行が無い（連結の継ぎ目）',
    // 行頭の「・」は箇条書き（「・GAD抗体：」等）なので対象外
    check: (k) => lines(k).filter(l => /[、・]$/.test(l) || /^、/.test(l)).map(l => `連結の継ぎ目: ${l}`),
  },

  // ── info: 気付き ──────────────────────────────────
  {
    id: 'empty-section-value', level: 'info',
    desc: '値が空のセクション行（未入力を空欄で残しているのは仕様。数を見る）',
    // 見出しだけの行（後ろに内容が続く）は対象外
    check: (k) => {
      const HEADINGS = ['【事前聴取時　申し送り事項】', '【協力体制】']
      return lines(k).filter(l => /^【[^】]+】$/.test(l) && !HEADINGS.includes(l)).map(l => `値が空: ${l}`)
    },
  },
]

// 1 ケース分の判定
export function judge(karte, testCase, ctx = {}) {
  const findings = []
  for (const r of RULES) {
    let msgs = []
    try {
      msgs = r.check(karte, testCase, ctx) || []
    } catch (e) {
      msgs = [`ルールが例外: ${e.message}`]
      findings.push({ rule: r.id, level: 'error', msg: msgs[0] })
      continue
    }
    for (const m of msgs) findings.push({ rule: r.id, level: r.level, msg: m })
  }
  return findings
}

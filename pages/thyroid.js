import { useState } from "react";
import { useRouter } from "next/router";
import ThyroidIntakeTool from "../components/ThyroidIntakeTool";

const TC = "#0d7d6a";

const THYROID_TYPES = [
  {
    id: "basedow-new",
    label: "バセドウ病（初診）",
    sublabel: "エコー上バセドウパターン・初診",
    hint: "甲状腺抗体3項目追加採血あり",
    bg: "linear-gradient(135deg, #e6fff8, #f0fdf9)",
    border: "#81e6d9",
    color: "#0d7d6a",
  },
  {
    id: "basedow-cont",
    label: "バセドウ病（継続）",
    sublabel: "他院からの転院・継続治療",
    hint: "手術歴・アイソトープ歴・副作用歴を聴取",
    bg: "linear-gradient(135deg, #e6f7ee, #f0fdf5)",
    border: "#9ae6b4",
    color: "#276749",
  },
  {
    id: "hashimoto",
    label: "橋本病",
    sublabel: "甲状腺機能低下症疑い",
    hint: "甲状腺抗体3項目追加採血あり",
    bg: "linear-gradient(135deg, #e8f4ff, #f0f7ff)",
    border: "#90cdf4",
    color: "#2b6cb0",
  },
  {
    id: "nodule-normal",
    label: "甲状腺腫大（異常なし）",
    sublabel: "エコー上明らかな異常なし",
    hint: "簡易問診・当日終診の可能性あり",
    bg: "linear-gradient(135deg, #f7faff, #f0f4ff)",
    border: "#c8c0ee",
    color: "#5a4fa8",
  },
  {
    id: "adenoma",
    label: "甲状腺腺腫（経過観察）",
    sublabel: "結節あり・悪性低リスク",
    hint: "結節サイズ・性状を記録",
    bg: "linear-gradient(135deg, #fff8f0, #fffaf5)",
    border: "#f6ad55",
    color: "#b45309",
  },
  {
    id: "malignant",
    label: "甲状腺腺腫（悪性疑い）",
    sublabel: "結節あり・悪性リスクあり",
    hint: "受診理由＋所見のみ・当日専門医紹介",
    bg: "linear-gradient(135deg, #fff5f5, #fef2f2)",
    border: "#feb2b2",
    color: "#c53030",
  },
];

export default function ThyroidPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState(null);

  if (selectedType) {
    return <ThyroidIntakeTool formType={selectedType} />;
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #f0fdf9 0%, #f7fffc 50%, #f0f7f4 100%)",
      fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif",
      padding: "32px 16px 48px",
    }}>
      <div style={{ maxWidth: 640, margin: "0 auto 28px", textAlign: "center" }}>
        <button onClick={() => router.push("/")} style={{ display: "inline-block", marginBottom: 20, padding: "7px 14px", borderRadius: 8, border: "1.5px solid #a7f3d0", background: "#fff", color: TC, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>← トップへ戻る</button>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: `linear-gradient(135deg, ${TC}, #34d399)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px", boxShadow: "0 4px 20px rgba(13,125,106,0.2)" }}>🦋</div>
        <div style={{ fontSize: 13, color: "#2d8a78", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>まつもと糖尿病クリニック</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#1a2a4a", marginBottom: 8 }}>甲状腺外来 問診フォーム</div>
        <div style={{ fontSize: 13, color: "#7a9abf", lineHeight: 1.7 }}>エコー所見に合わせて該当するフォームを選択してください</div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
        {THYROID_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedType(t.id)}
            style={{
              display: "flex", alignItems: "center", gap: 16,
              background: t.bg,
              border: `2px solid ${t.border}`,
              borderRadius: 16,
              padding: "16px 20px",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.1)"; }}
            onMouseOut={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: t.color, marginBottom: 2 }}>{t.label}</div>
              <div style={{ fontSize: 12, color: "#6688aa", fontWeight: 500, marginBottom: 2 }}>{t.sublabel}</div>
              <div style={{ fontSize: 11, color: "#8899bb", fontStyle: "italic" }}>{t.hint}</div>
            </div>
            <div style={{ fontSize: 20, color: t.color, opacity: 0.5, flexShrink: 0 }}>›</div>
          </button>
        ))}
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: "#a0b8d0", marginTop: 32 }}>
        個人情報は院内のみで使用されます
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import ThyroidIntakeTool from "../components/ThyroidIntakeTool";

export default function ThyroidPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState(null);

  useEffect(() => {
    if (router.isReady && router.query.type) {
      setSelectedType(router.query.type);
    }
  }, [router.isReady, router.query.type]);

  if (selectedType) {
    return <ThyroidIntakeTool formType={selectedType} />;
  }

  // クエリパラメータなし・直接アクセス時のフォールバック
  router.replace("/");
  return null;
}

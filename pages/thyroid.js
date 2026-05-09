import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import ThyroidIntakeTool from "../components/ThyroidIntakeTool";

export default function ThyroidPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState(null);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.type) {
      setSelectedType(router.query.type);
    } else {
      router.replace("/");
    }
  }, [router.isReady, router.query.type]);

  if (selectedType) {
    return <ThyroidIntakeTool formType={selectedType} />;
  }

  return null;
}

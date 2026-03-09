"use client";

import { useSearchParams } from "next/navigation";
import DeckBuilderBoard from "@/components/DeckBuilderBoard";
import { Suspense } from "react";

function DeckBuilderContent() {
  const searchParams = useSearchParams();
  const room = searchParams.get("room") || "";
  const name = searchParams.get("name") || "";

  if (!room || !name) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
        <h1 className="text-3xl font-bold text-red-500">❌ ข้อมูลห้องไม่ครบ! กลับไปหน้าแรกเลย!</h1>
      </div>
    );
  }

  return <DeckBuilderBoard roomId={room} username={name} />;
}

export default function DeckBuilderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex justify-center items-center">กำลังจัดโต๊ะไพ่...</div>}>
      <DeckBuilderContent />
    </Suspense>
  );
}
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import GachaBoard from "@/components/GachaBoard";

function GachaContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") || "Hell-Gacha";
  const [username, setUsername] = useState("ผู้เสี่ยงดวง");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUsername(sessionStorage.getItem("somomkang_username") || "ผู้เสี่ยงดวง");
    }
  }, []);

  return <GachaBoard roomId={roomId} username={username} />;
}

export default function GachaPage() {
  return (
    <Suspense fallback={<div className="h-dvh flex items-center justify-center bg-purple-950 text-white font-bold text-2xl animate-pulse">กำลังสับไพ่นรก...</div>}>
      <GachaContent />
    </Suspense>
  );
}
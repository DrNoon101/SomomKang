"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RacingBoard from "@/components/RacingBoard";

function RacingContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") || "VIP-Race";
  const [username, setUsername] = useState("นักลงทุน");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUsername(sessionStorage.getItem("somomkang_username") || "นักลงทุน");
    }
  }, []);

  return <RacingBoard roomId={roomId} username={username} />;
}

export default function RacingPage() {
  return (
    <Suspense fallback={<div className="h-dvh flex items-center justify-center bg-orange-950 text-white font-bold text-2xl animate-pulse">กำลังจัดเตรียมสนามแข่ง...</div>}>
      <RacingContent />
    </Suspense>
  );
}
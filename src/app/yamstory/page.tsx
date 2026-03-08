"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
// โค้ชแก้ path ให้ถอยหลัง 2 ก้าวไปหา components ให้ตรงเป๊ะแล้วครับ
import YamstoryBoard from "../../components/YamstoryBoard"; 

function YamContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") || "Demo";
  const [username, setUsername] = useState("นักเขียน");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUsername(sessionStorage.getItem("somomkang_username") || "นักเขียน");
    }
  }, []);

  return <YamstoryBoard roomId={roomId} username={username} />;
}

export default function YamPage() {
  return (
    <Suspense fallback={<div className="h-dvh flex items-center justify-center bg-gray-900 text-white font-bold text-xl">กำลังโหลดสมุดข่อย...</div>}>
      <YamContent />
    </Suspense>
  );
}
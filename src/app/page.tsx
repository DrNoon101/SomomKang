"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

export default function LobbyPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [error, setError] = useState("");
  const [showSplash, setShowSplash] = useState(true);

  // แอนิเมชันหน้าต้อนรับ 2.5 วินาที
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedUsername = username.trim();
    const trimmedRoomId = roomId.trim();

    if (!trimmedUsername) {
      setError("กรุณาใส่ชื่อผู้เล่น");
      return;
    }

    if (mode === "create" && !trimmedRoomId) {
      setError("กรุณาใส่รหัสห้องที่ต้องการสร้าง");
      return;
    }

    if (mode === "join" && !trimmedRoomId) {
      setError("กรุณาใส่รหัสห้องที่ต้องการเข้าร่วม");
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem("somomkang_username", trimmedUsername);
      sessionStorage.setItem("somomkang_roomId", trimmedRoomId);
      sessionStorage.setItem("somomkang_mode", mode);
      if (mode === "create") {
        sessionStorage.setItem("somomkang_maxPlayers", maxPlayers.toString());
      }
    }

    router.push(`/game?room=${encodeURIComponent(trimmedRoomId)}`);
  };

  const generateRoomId = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let id = "";
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    setRoomId(id);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      
      {/* ---------------- หน้าต้อนรับสุดปั่น ---------------- */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5, filter: "blur(20px)" }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl"
          >
            <h1 className="text-4xl sm:text-7xl font-black text-red-600 drop-shadow-[0_0_30px_rgba(220,38,38,0.8)] tracking-widest text-center">
              สวัสดีไอพวกโสมม
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-5xl font-black text-gold drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]">
            SomomKang
          </h1>
          <p className="text-white/80 text-sm mt-2">วงไพ่คนจริง ไม่แน่จริงอย่าเข้ามา</p>
        </div>

        <div className="bg-black/40 backdrop-blur-md rounded-3xl p-6 shadow-2xl border border-white/10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-white/90 text-sm font-bold mb-2">
                ชื่อผู้เล่น
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ใส่ชื่อของคุณ"
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/40 text-base focus:outline-none focus:ring-2 focus:ring-gold border border-white/5"
                maxLength={20}
              />
            </div>

            <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => setMode("create")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  mode === "create"
                    ? "bg-gold text-black shadow-[0_0_10px_rgba(250,204,21,0.4)]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                สร้างห้อง
              </button>
              <button
                type="button"
                onClick={() => setMode("join")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  mode === "join"
                    ? "bg-gold text-black shadow-[0_0_10px_rgba(250,204,21,0.4)]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                เข้าร่วมห้อง
              </button>
            </div>

            <div>
              <label className="block text-white/90 text-sm font-bold mb-2">
                รหัสห้อง
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder={mode === "create" ? "รหัสห้องที่ต้องการ" : "ใส่รหัสห้อง"}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/40 text-base uppercase focus:outline-none focus:ring-2 focus:ring-gold border border-white/5"
                  maxLength={8}
                />
                {mode === "create" && (
                  <button
                    type="button"
                    onClick={generateRoomId}
                    className="px-4 py-3 rounded-xl bg-gold/20 text-gold font-bold hover:bg-gold/30 transition-colors border border-gold/40"
                    title="สุ่มรหัสห้อง"
                  >
                    สุ่ม
                  </button>
                )}
              </div>
            </div>

            {mode === "create" && (
              <div>
                <label className="block text-white/90 text-sm font-bold mb-2">
                  จำนวนผู้เล่นสูงสุด
                </label>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 text-white text-base focus:outline-none focus:ring-2 focus:ring-gold border border-white/5 [&>option]:bg-gray-900"
                >
                  {[2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      {num} คน
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm font-bold text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-4 rounded-xl bg-gradient-to-r from-gold to-amber-500 text-black font-black text-lg hover:from-amber-400 hover:to-yellow-500 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(250,204,21,0.3)] mt-2"
            >
              {mode === "create" ? "เปิดวงไพ่!" : "บุกเข้าห้อง!"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function GameHub() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [selectedGame, setSelectedGame] = useState<"somomkang" | "yamstory" | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "join" | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(4);

  // โหลดชื่อเก่าที่เคยตั้งไว้
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = sessionStorage.getItem("somomkang_username");
      if (savedName) setUsername(savedName);
    }
  }, []);

  const handleOpenModal = (game: "somomkang" | "yamstory", mode: "create" | "join") => {
    if (!username.trim()) {
      alert("กรุณาใส่ชื่อก่อนเข้าวง!");
      return;
    }
    sessionStorage.setItem("somomkang_username", username.trim());
    setSelectedGame(game);
    setModalMode(mode);
  };

  const handleEnterRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim()) return;
    
    sessionStorage.setItem("somomkang_mode", modalMode || "join");
    if (modalMode === "create") {
      sessionStorage.setItem("somomkang_maxPlayers", maxPlayers.toString());
    }

    // แยกเส้นทางไปตามเกมที่เลือก
    const targetPath = selectedGame === "somomkang" ? "/game" : "/yamstory";
    router.push(`${targetPath}?room=${roomId.trim()}`);
  };

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center bg-gray-900 overflow-hidden font-sans">
      
      {/* พื้นหลังเท่ๆ */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-10 left-10 text-9xl text-gold rotate-12 drop-shadow-2xl blur-[2px]">🃏</div>
        <div className="absolute bottom-20 right-20 text-9xl text-blue-500 -rotate-12 drop-shadow-2xl blur-[2px]">✍️</div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: -50 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="z-10 text-center mb-10"
      >
        <h1 className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-300 to-yellow-500 drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]">
          Vorvare's Arcade
        </h1>
        <p className="text-white/70 mt-3 text-lg sm:text-xl font-medium">ศูนย์รวมเกมทำลายมิตรภาพ</p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="z-10 w-full max-w-md px-4 flex flex-col items-center gap-6"
      >
        {/* ช่องใส่ชื่อ */}
        <div className="w-full bg-black/40 p-6 rounded-3xl backdrop-blur-md border border-white/10 shadow-2xl">
          <label className="block text-white/80 font-bold mb-2">นามแฝงของคุณ</label>
          <input
            type="text"
            placeholder="ใส่ชื่อสุดปั่น..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-5 py-4 bg-black/50 border-2 border-white/10 rounded-xl text-white text-lg font-bold outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition-all text-center"
            maxLength={12}
          />
        </div>

        {/* เมนูเลือกเกม */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* เกม 1: ไพ่สมมแคง */}
          <div className="bg-gradient-to-br from-green-800 to-green-950 p-5 rounded-3xl border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2)] flex flex-col items-center justify-between gap-4 transition-transform hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(34,197,94,0.4)]">
            <div className="text-center">
              <div className="text-4xl mb-2">🃏</div>
              <h2 className="text-white font-black text-xl">SomomKang</h2>
              <p className="text-white/60 text-xs mt-1">เกมไพ่ดวลเดือด น็อคมืด สาดอีโมจิ</p>
            </div>
            <div className="flex gap-2 w-full">
              <button onClick={() => handleOpenModal("somomkang", "create")} className="flex-1 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg text-sm transition-colors">สร้างวง</button>
              <button onClick={() => handleOpenModal("somomkang", "join")} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-sm border border-white/20 transition-colors">เข้าร่วม</button>
            </div>
          </div>

          {/* เกม 2: นิยายยำเละ */}
          <div className="bg-gradient-to-br from-blue-900 to-indigo-950 p-5 rounded-3xl border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.2)] flex flex-col items-center justify-between gap-4 transition-transform hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(59,130,246,0.4)]">
            <div className="text-center">
              <div className="text-4xl mb-2">✍️</div>
              <h2 className="text-white font-black text-xl">นิยายยำเละ</h2>
              <p className="text-white/60 text-xs mt-1">แต่งนิยายต่อกันด้วย 5 คำสุดท้าย</p>
            </div>
            <div className="flex gap-2 w-full">
              <button onClick={() => handleOpenModal("yamstory", "create")} className="flex-1 py-2 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-lg text-sm shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-colors">เปิดเรื่อง</button>
              <button onClick={() => handleOpenModal("yamstory", "join")} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-sm border border-white/20 transition-colors">แจมด้วย</button>
            </div>
          </div>

        </div>
      </motion.div>

      {/* Modal กรอกรหัสห้อง */}
      <AnimatePresence>
        {modalMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`bg-gray-900 border-2 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative ${selectedGame === "somomkang" ? "border-green-500/50" : "border-blue-500/50"}`}>
              <button onClick={() => setModalMode(null)} className="absolute top-4 right-4 text-white/50 hover:text-white text-xl">✕</button>
              <h2 className="text-2xl font-black text-white text-center mb-6">
                {modalMode === "create" ? "👑 สร้างห้องใหม่" : "🚪 เข้าร่วมห้อง"}
                <div className={`text-sm mt-1 font-medium ${selectedGame === "somomkang" ? "text-green-400" : "text-blue-400"}`}>
                  เกม: {selectedGame === "somomkang" ? "SomomKang (ไพ่)" : "นิยายยำเละ"}
                </div>
              </h2>
              
              <form onSubmit={handleEnterRoom} className="space-y-4">
                <div>
                  <label className="block text-white/70 text-sm font-bold mb-2">รหัสห้อง (พิมพ์อะไรก็ได้)</label>
                  <input type="text" required placeholder="เช่น ROOM99" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-xl text-white font-bold outline-none focus:border-white transition-colors uppercase text-center text-xl tracking-widest" />
                </div>
                
                {modalMode === "create" && selectedGame === "somomkang" && (
                  <div>
                    <label className="block text-white/70 text-sm font-bold mb-2">จำนวนผู้เล่นสูงสุด</label>
                    <select value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-xl text-white font-bold outline-none">
                      <option value={2}>2 คน (ดวลเดี่ยว)</option>
                      <option value={3}>3 คน</option>
                      <option value={4}>4 คน (เต็มวง)</option>
                    </select>
                  </div>
                )}

                <button type="submit" className={`w-full py-4 rounded-xl text-black font-black text-lg transition-all hover:scale-[1.02] shadow-lg mt-2 ${selectedGame === "somomkang" ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gradient-to-r from-blue-400 to-indigo-400 text-white"}`}>
                  {modalMode === "create" ? "ลุย!" : "เข้าไปแจม!"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
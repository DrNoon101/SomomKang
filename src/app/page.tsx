"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function GameHub() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  
  const [somomkangModal, setSomomkangModal] = useState<"create" | "join" | null>(null);
  const [yamstoryModal, setYamstoryModal] = useState<"create" | "join" | null>(null);
  
  // ✨ State สำหรับเปิด/ปิดหน้ากติกา
  const [showRules, setShowRules] = useState(false);
  
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [rounds, setRounds] = useState(1);
  const [yamMaxPlayers, setYamMaxPlayers] = useState(4);
  const [yamRounds, setYamRounds] = useState(5);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = sessionStorage.getItem("somomkang_username");
      if (savedName) setUsername(savedName);
    }
  }, []);

  const checkUsername = () => {
    if (!username.trim()) { alert("กรุณาใส่ชื่อสุดปั่นก่อนครับ!"); return false; }
    sessionStorage.setItem("somomkang_username", username.trim()); return true;
  };

  const openSomomkang = (mode: "create" | "join") => {
    if (!checkUsername()) return;
    setRoomId(""); setYamstoryModal(null); setSomomkangModal(mode);
  };

  const openYamstory = (mode: "create" | "join") => {
    if (!checkUsername()) return;
    setRoomId(""); setSomomkangModal(null); setYamstoryModal(mode);
  };

  const executeSomomkang = () => {
    if (!roomId.trim()) { alert("กรุณาใส่รหัสห้องด้วยครับ!"); return; }
    sessionStorage.setItem("somomkang_mode", somomkangModal || "join");
    if (somomkangModal === "create") {
      sessionStorage.setItem("somomkang_maxPlayers", maxPlayers.toString());
      sessionStorage.setItem("somomkang_rounds", rounds.toString());
    }
    window.location.href = `/game?room=${roomId.trim()}`;
  };

  const executeYamstory = () => {
    if (!roomId.trim()) { alert("กรุณาใส่รหัสห้องด้วยครับ!"); return; }
    sessionStorage.setItem("somomkang_mode", yamstoryModal || "join");
    if (yamstoryModal === "create") {
      sessionStorage.setItem("yamstory_maxPlayers", yamMaxPlayers.toString());
      sessionStorage.setItem("yamstory_rounds", yamRounds.toString());
    }
    window.location.href = `/yamstory?room=${roomId.trim()}`;
  };

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center bg-gray-900 overflow-hidden font-sans">
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div animate={{ y: [0, -30, 0], rotate: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} className="absolute top-10 left-10 text-8xl md:text-9xl text-gold opacity-30 blur-[2px]">🃏</motion.div>
        <motion.div animate={{ y: [0, 30, 0], rotate: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }} className="absolute bottom-20 right-10 md:right-20 text-8xl md:text-9xl text-blue-500 opacity-30 blur-[2px]">✍️</motion.div>
        <motion.div animate={{ y: [0, -20, 0], rotate: [0, 15, 0] }} transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }} className="absolute top-1/3 right-1/4 text-7xl md:text-8xl text-red-500 opacity-20 blur-[3px]">🎲</motion.div>
        <motion.div animate={{ y: [0, 20, 0], rotate: [0, -15, 0] }} transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }} className="absolute bottom-1/4 left-1/4 text-7xl md:text-8xl text-green-500 opacity-20 blur-[3px]">🎯</motion.div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse"></div>
      </div>

      <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} className="z-10 text-center mb-6">
        <h1 className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-300 to-yellow-500 drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]">
          Vorvare&apos;s Arcade
        </h1>
        {/* ✨ ปุ่มเปิดดูกติกา */}
        <button onClick={() => setShowRules(true)} className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold border border-white/20 transition-all backdrop-blur-sm">
          📖 กติกาการเล่น
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="z-10 w-full max-w-md px-4 flex flex-col items-center gap-6">
        <div className="w-full bg-black/40 p-6 rounded-3xl backdrop-blur-md border border-white/10 shadow-2xl">
          <label className="block text-white/80 font-bold mb-2">นามแฝงของคุณ</label>
          <input type="text" placeholder="ใส่ชื่อสุดปั่น..." value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-5 py-4 bg-black/50 border-2 border-white/10 rounded-xl text-white text-lg font-bold outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition-all text-center" maxLength={12} />
        </div>

        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-green-800 to-green-950 p-5 rounded-3xl border border-green-500/30 flex flex-col items-center justify-between gap-4 transition-transform hover:-translate-y-2">
            <div className="text-center">
              <div className="text-4xl mb-2">🃏</div>
              <h2 className="text-white font-black text-xl">SomomKang</h2>
              <p className="text-white/60 text-xs mt-1">ดวลเดือด น็อคมืด สาดอีโมจิ</p>
            </div>
            <div className="flex gap-2 w-full">
              <button type="button" onClick={() => openSomomkang("create")} className="flex-1 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg text-sm">สร้างวง</button>
              <button type="button" onClick={() => openSomomkang("join")} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-sm border border-white/20">เข้าร่วม</button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-900 to-indigo-950 p-5 rounded-3xl border border-blue-500/30 flex flex-col items-center justify-between gap-4 transition-transform hover:-translate-y-2">
            <div className="text-center">
              <div className="text-4xl mb-2">✍️</div>
              <h2 className="text-white font-black text-xl">นิยายยำเละ</h2>
              <p className="text-white/60 text-xs mt-1">แต่งนิยายต่อกันด้วย 5 คำสุดท้าย</p>
            </div>
            <div className="flex gap-2 w-full">
              <button type="button" onClick={() => openYamstory("create")} className="flex-1 py-2 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-lg text-sm">เปิดเรื่อง</button>
              <button type="button" onClick={() => openYamstory("join")} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-sm border border-white/20">แจมด้วย</button>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        
        {/* ✨ ป๊อปอัป กติกาการเล่น */}
        {showRules && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setShowRules(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-gray-900 border-2 border-white/20 rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl relative max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 text-white/50 hover:text-white text-2xl font-black bg-black/50 w-10 h-10 rounded-full flex items-center justify-center">✕</button>
              <h2 className="text-3xl font-black text-white text-center mb-6 border-b border-white/20 pb-4">📖 กติกาการเล่น</h2>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-black text-green-400 mb-3 flex items-center gap-2">🃏 SomomKang (สมมแคง)</h3>
                  <ul className="list-disc pl-5 text-gray-300 space-y-2 font-medium">
                    <li>เริ่มเกมจะได้ไพ่คนละ 5 ใบ</li>
                    <li>เมื่อถึงตา ต้อง <strong className="text-blue-400">จั่ว 1 ใบ และ ทิ้งไพ่ 1 ใบ</strong> (ทิ้งไพ่เลขซ้ำกันพร้อมกันได้)</li>
                    <li>ถ้าคนก่อนหน้าทิ้งไพ่เลขเดียวกับที่เรามีในมือ เราสามารถกด <strong className="text-purple-400">"ไหลไพ่"</strong> ทิ้งตามได้ คนโดนไหลจะโดนปรับชิป!</li>
                    <li>ถ้าคิดว่าแต้มในมือน้อยที่สุดแล้ว ให้กด <strong className="text-red-400">"แคง!"</strong> เพื่อจบเกม</li>
                    <li>ถ้าแคงแล้วแต้มน้อยสุดจริง = <strong className="text-yellow-400">ชนะ!</strong></li>
                    <li>แต่ถ้าแคงแล้วมีคนอื่นแต้มน้อยกว่า = <strong className="text-red-500">แคงล่ม (โดนปรับชิปบาน!)</strong></li>
                    <li><strong className="text-pink-400">🔥 น็อคมืด (ชนะทันที):</strong> สเตรทฟลัช, หอน(ไพ่เหมือนกัน 4 ใบ), ฟูลเฮาส์, สี(ดอกเดียวกัน 5 ใบ), เรียง, ตอง, 50 แต้ม</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-2xl font-black text-blue-400 mb-3 flex items-center gap-2">✍️ นิยายยำเละ</h3>
                  <ul className="list-disc pl-5 text-gray-300 space-y-2 font-medium">
                    <li>สลับกันแต่งนิยายไปเรื่อยๆ จนครบจำนวนรอบที่ตั้งไว้</li>
                    <li>ความพีคคือ... คุณจะเห็นแค่ <strong className="text-yellow-400">"5 คำสุดท้าย"</strong> ของคนที่แต่งก่อนหน้าคุณเท่านั้น!</li>
                    <li>พยายามปะติดปะต่อเรื่องราวให้ได้ หรือจะกาวให้หลุดโลกไปเลยก็ได้!</li>
                    <li>เมื่อครบกำหนดรอบ เกมจะสรุปเรื่องราวทั้งหมดให้ทุกคนอ่านพร้อมกัน</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* กล่อง SomomKang */}
        {somomkangModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSomomkangModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-gray-900 border-2 border-green-500/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setSomomkangModal(null)} className="absolute top-4 right-4 text-white/50 hover:text-white text-xl">✕</button>
              <h2 className="text-2xl font-black text-white text-center mb-6">
                {somomkangModal === "create" ? "👑 สร้างวงไพ่" : "🚪 เข้าร่วมวงไพ่"}
                <div className="text-sm mt-1 font-medium text-green-400">เกม: SomomKang</div>
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-white/70 text-sm font-bold mb-2">รหัสห้อง</label>
                  <input type="text" placeholder="เช่น ROOM99" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") executeSomomkang(); }} className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-xl text-white font-bold outline-none focus:border-green-500 uppercase text-center text-xl tracking-widest" />
                </div>
                {somomkangModal === "create" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-white/70 text-sm font-bold mb-2">ผู้เล่นสูงสุด</label>
                      <select value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} className="w-full px-3 py-2 bg-black/50 border border-white/20 rounded-xl text-white outline-none">
                        <option value={2}>2 คน</option>
                        <option value={3}>3 คน</option>
                        <option value={4}>4 คน</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-white/70 text-sm font-bold mb-2">จำนวนรอบ</label>
                      <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className="w-full px-3 py-2 bg-black/50 border border-white/20 rounded-xl text-white outline-none">
                        <option value={1}>1 รอบ</option>
                        <option value={3}>3 รอบ</option>
                        <option value={5}>5 รอบ</option>
                      </select>
                    </div>
                  </div>
                )}
                <button type="button" onClick={executeSomomkang} className="w-full py-4 rounded-xl text-black font-black text-lg transition-all hover:scale-[1.02] shadow-lg mt-2 bg-gradient-to-r from-green-400 to-emerald-500">
                  {somomkangModal === "create" ? "สับไพ่ลุย!" : "เข้าไปแจม!"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* กล่องเกมนิยาย */}
        {yamstoryModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setYamstoryModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-gray-900 border-2 border-blue-500/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setYamstoryModal(null)} className="absolute top-4 right-4 text-white/50 hover:text-white text-xl">✕</button>
              <h2 className="text-2xl font-black text-white text-center mb-6">
                {yamstoryModal === "create" ? "📖 สร้างกระดาษใหม่" : "🚪 เข้าร่วมห้องนิยาย"}
                <div className="text-sm mt-1 font-medium text-blue-400">เกม: นิยายยำเละ</div>
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-white/70 text-sm font-bold mb-2">รหัสห้อง</label>
                  <input type="text" placeholder="เช่น ROOM99" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") executeYamstory(); }} className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-xl text-white font-bold outline-none focus:border-blue-500 uppercase text-center text-xl tracking-widest" />
                </div>
                {yamstoryModal === "create" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-white/70 text-sm font-bold mb-2">นักเขียนสูงสุด</label>
                      <select value={yamMaxPlayers} onChange={(e) => setYamMaxPlayers(Number(e.target.value))} className="w-full px-3 py-2 bg-black/50 border border-white/20 rounded-xl text-white outline-none">
                        <option value={2}>2 คน</option>
                        <option value={3}>3 คน</option>
                        <option value={4}>4 คน</option>
                        <option value={5}>5 คน</option>
                        <option value={6}>6 คน</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-white/70 text-sm font-bold mb-2">จำนวนรอบ</label>
                      <select value={yamRounds} onChange={(e) => setYamRounds(Number(e.target.value))} className="w-full px-3 py-2 bg-black/50 border border-white/20 rounded-xl text-white outline-none">
                        <option value={3}>3 รอบ</option>
                        <option value={5}>5 รอบ</option>
                        <option value={10}>10 รอบ</option>
                      </select>
                    </div>
                  </div>
                )}
                <button type="button" onClick={executeYamstory} className="w-full py-4 rounded-xl text-white font-black text-lg transition-all hover:scale-[1.02] shadow-lg mt-2 bg-gradient-to-r from-blue-400 to-indigo-400">
                  {yamstoryModal === "create" ? "เริ่มเปิดเรื่อง!" : "หยิบปากกาแจมด้วย!"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function GameHub() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  
  const [somomkangModal, setSomomkangModal] = useState<"create" | "join" | null>(null);
  const [yamstoryModal, setYamstoryModal] = useState<"create" | "join" | null>(null);
  const [racingModal, setRacingModal] = useState<"create" | "join" | null>(null);
  const [gachaModal, setGachaModal] = useState<"create" | "join" | null>(null);
  // ✨ เพิ่ม State สำหรับ Deck Builder
  const [deckModal, setDeckModal] = useState<"create" | "join" | null>(null);
  
  const [showRules, setShowRules] = useState(false);
  
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [rounds, setRounds] = useState(1);
  const [yamMaxPlayers, setYamMaxPlayers] = useState(4);
  const [yamRounds, setYamRounds] = useState(5);
  const [racingMaxPlayers, setRacingMaxPlayers] = useState(8);
  const [gachaMaxPlayers, setGachaMaxPlayers] = useState(8);
  // ✨ เพิ่ม Max Players สำหรับ Deck Builder
  const [deckMaxPlayers, setDeckMaxPlayers] = useState(2);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = sessionStorage.getItem("somomkang_username");
      if (savedName) setUsername(savedName);
    }
  }, []);

  const checkUsername = () => { if (!username.trim()) { alert("กรุณาใส่ชื่อสุดปั่นก่อนครับ!"); return false; } sessionStorage.setItem("somomkang_username", username.trim()); return true; };

  const openSomomkang = (mode: "create" | "join") => { if (!checkUsername()) return; setRoomId(""); setYamstoryModal(null); setRacingModal(null); setGachaModal(null); setDeckModal(null); setSomomkangModal(mode); };
  const openYamstory = (mode: "create" | "join") => { if (!checkUsername()) return; setRoomId(""); setSomomkangModal(null); setRacingModal(null); setGachaModal(null); setDeckModal(null); setYamstoryModal(mode); };
  const openRacing = (mode: "create" | "join") => { if (!checkUsername()) return; setRoomId(""); setSomomkangModal(null); setYamstoryModal(null); setGachaModal(null); setDeckModal(null); setRacingModal(mode); };
  const openGacha = (mode: "create" | "join") => { if (!checkUsername()) return; setRoomId(""); setSomomkangModal(null); setYamstoryModal(null); setRacingModal(null); setDeckModal(null); setGachaModal(mode); };
  // ✨ เพิ่มฟังก์ชันเปิด Modal ของ Deck Builder
  const openDeckBuilder = (mode: "create" | "join") => { if (!checkUsername()) return; setRoomId(""); setSomomkangModal(null); setYamstoryModal(null); setRacingModal(null); setGachaModal(null); setDeckModal(mode); };

  const executeSomomkang = () => { if (!roomId.trim()) { alert("ใส่รหัสห้องด้วยครับ!"); return; } sessionStorage.setItem("somomkang_mode", somomkangModal || "join"); if (somomkangModal === "create") { sessionStorage.setItem("somomkang_maxPlayers", maxPlayers.toString()); sessionStorage.setItem("somomkang_rounds", rounds.toString()); } window.location.href = `/game?room=${roomId.trim()}`; };
  const executeYamstory = () => { if (!roomId.trim()) { alert("ใส่รหัสห้องด้วยครับ!"); return; } sessionStorage.setItem("somomkang_mode", yamstoryModal || "join"); if (yamstoryModal === "create") { sessionStorage.setItem("yamstory_maxPlayers", yamMaxPlayers.toString()); sessionStorage.setItem("yamstory_rounds", yamRounds.toString()); } window.location.href = `/yamstory?room=${roomId.trim()}`; };
  const executeRacing = () => { if (!roomId.trim()) { alert("ใส่รหัสห้องด้วยครับ!"); return; } sessionStorage.setItem("somomkang_mode", racingModal || "join"); if (racingModal === "create") { sessionStorage.setItem("racing_maxPlayers", racingMaxPlayers.toString()); } window.location.href = `/racing?room=${roomId.trim()}`; };
  const executeGacha = () => { if (!roomId.trim()) { alert("ใส่รหัสห้องด้วยครับ!"); return; } sessionStorage.setItem("somomkang_mode", gachaModal || "join"); if (gachaModal === "create") { sessionStorage.setItem("gacha_maxPlayers", gachaMaxPlayers.toString()); } window.location.href = `/gacha?room=${roomId.trim()}`; };
  // ✨ เพิ่มฟังก์ชันรันเกม Deck Builder
  const executeDeckBuilder = () => { 
    if (!roomId.trim()) { alert("ใส่รหัสห้องด้วยครับ!"); return; } 
    sessionStorage.setItem("deckbuilder_mode", deckModal || "join"); 
    if (deckModal === "create") { sessionStorage.setItem("deckbuilder_maxPlayers", deckMaxPlayers.toString()); } 
    window.location.href = `/deckbuilder?room=${roomId.trim()}&name=${username}`; 
  };

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center bg-gray-900 overflow-hidden font-sans pb-10">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div animate={{ y: [0, -30, 0], rotate: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} className="absolute top-10 left-10 text-8xl md:text-9xl text-gold opacity-30 blur-[2px]">🃏</motion.div>
        <motion.div animate={{ y: [0, 30, 0], rotate: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }} className="absolute bottom-20 right-10 md:right-20 text-8xl md:text-9xl text-blue-500 opacity-30 blur-[2px]">✍️</motion.div>
        <motion.div animate={{ y: [0, -20, 0], rotate: [0, 15, 0] }} transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }} className="absolute top-1/3 right-1/4 text-7xl md:text-8xl text-red-500 opacity-20 blur-[3px]">🎲</motion.div>
        <motion.div animate={{ y: [0, 20, 0], rotate: [0, -15, 0] }} transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }} className="absolute bottom-1/4 left-1/4 text-7xl md:text-8xl text-purple-500 opacity-20 blur-[3px]">🎰</motion.div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse"></div>
      </div>

      <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} className="z-10 text-center mb-6 mt-10">
        <h1 className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-300 to-yellow-500 drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]">
          Vorvare&apos;s Arcade
        </h1>
        <button onClick={() => setShowRules(true)} className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold border border-white/20 transition-all backdrop-blur-sm">📖 กติกาการเล่น</button>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="z-10 w-full max-w-5xl px-4 flex flex-col items-center gap-6">
        <div className="w-full max-w-md bg-black/40 p-6 rounded-3xl backdrop-blur-md border border-white/10 shadow-2xl">
          <label className="block text-white/80 font-bold mb-2 text-center">นามแฝงของคุณ</label>
          <input type="text" placeholder="ใส่ชื่อสุดปั่น..." value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-5 py-4 bg-black/50 border-2 border-white/10 rounded-xl text-white text-lg font-bold outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition-all text-center" maxLength={12} />
        </div>

        {/* ✨ 5 เกมเรียงกัน (ปรับ Grid ให้สวยงาม) */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-center">
          <div className="bg-gradient-to-br from-green-800 to-green-950 p-5 rounded-3xl border border-green-500/30 flex flex-col items-center justify-between gap-4 transition-transform hover:-translate-y-2 shadow-lg">
            <div className="text-center">
              <div className="text-4xl mb-2">🃏</div>
              <h2 className="text-white font-black text-xl">SomomKang</h2>
              <p className="text-white/60 text-xs mt-1">ดวลเดือด น็อคมืด</p>
            </div>
            <div className="flex gap-2 w-full">
              <button type="button" onClick={() => openSomomkang("create")} className="flex-1 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg text-sm">สร้างวง</button>
              <button type="button" onClick={() => openSomomkang("join")} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-sm border border-white/20">เข้าร่วม</button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-900 to-indigo-950 p-5 rounded-3xl border border-blue-500/30 flex flex-col items-center justify-between gap-4 transition-transform hover:-translate-y-2 shadow-lg">
            <div className="text-center">
              <div className="text-4xl mb-2">✍️</div>
              <h2 className="text-white font-black text-xl">นิยายยำเละ</h2>
              <p className="text-white/60 text-xs mt-1">แต่งนิยาย 5 คำสุดท้าย</p>
            </div>
            <div className="flex gap-2 w-full">
              <button type="button" onClick={() => openYamstory("create")} className="flex-1 py-2 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-lg text-sm">เปิดเรื่อง</button>
              <button type="button" onClick={() => openYamstory("join")} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-sm border border-white/20">แจมด้วย</button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-800 to-red-950 p-5 rounded-3xl border border-orange-500/30 flex flex-col items-center justify-between gap-4 transition-transform hover:-translate-y-2 shadow-lg">
            <div className="text-center">
              <div className="text-4xl mb-2">🐎</div>
              <h2 className="text-white font-black text-xl">แข่งม้ามรณะ</h2>
              <p className="text-white/60 text-xs mt-1">วัดดวงเพียวๆ แทงม้า</p>
            </div>
            <div className="flex gap-2 w-full">
              <button type="button" onClick={() => openRacing("create")} className="flex-1 py-2 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-lg text-sm">สร้างสนาม</button>
              <button type="button" onClick={() => openRacing("join")} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-sm border border-white/20">ซื้อตั๋ว</button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-800 to-fuchsia-950 p-5 rounded-3xl border border-purple-500/30 flex flex-col items-center justify-between gap-4 transition-transform hover:-translate-y-2 shadow-lg">
            <div className="text-center">
              <div className="text-4xl mb-2">🎰</div>
              <h2 className="text-white font-black text-xl">กาชาปองนรก</h2>
              <p className="text-white/60 text-xs mt-1">เปิดการ์ดสุ่มเอฟเฟกต์ป่วน</p>
            </div>
            <div className="flex gap-2 w-full">
              <button type="button" onClick={() => openGacha("create")} className="flex-1 py-2 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-lg text-sm">ตั้งวง</button>
              <button type="button" onClick={() => openGacha("join")} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-sm border border-white/20">เข้าร่วม</button>
            </div>
          </div>

          {/* ✨ การ์ดเกมใหม่ Deck Builder */}
          <div className="bg-gradient-to-br from-cyan-900 to-slate-900 p-5 rounded-3xl border border-cyan-500/30 flex flex-col items-center justify-between gap-4 transition-transform hover:-translate-y-2 shadow-lg lg:col-start-2">
            <div className="text-center">
              <div className="text-4xl mb-2">⚔️</div>
              <h2 className="text-white font-black text-xl">Deck Builder</h2>
              <p className="text-white/60 text-xs mt-1">จัดคอมโบ 4 แฟคชั่น</p>
            </div>
            <div className="flex gap-2 w-full">
              <button type="button" onClick={() => openDeckBuilder("create")} className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-sm">ตั้งตี้ไพ่</button>
              <button type="button" onClick={() => openDeckBuilder("join")} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-sm border border-white/20">เข้าร่วม</button>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {/* ป๊อปอัป กติกาการเล่น */}
        {showRules && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setShowRules(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-gray-900 border-2 border-white/20 rounded-3xl p-6 sm:p-8 w-full max-w-3xl shadow-2xl relative max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 text-white/50 hover:text-white text-2xl font-black bg-black/50 w-10 h-10 rounded-full flex items-center justify-center">✕</button>
              <h2 className="text-3xl font-black text-white text-center mb-6 border-b border-white/20 pb-4">📖 กติกาการเล่น</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-black text-green-400 mb-2">🃏 SomomKang (สมมแคง)</h3>
                  <ul className="list-disc pl-5 text-gray-300 text-sm space-y-1">
                    <li>จั่ว 1 ใบ ทิ้งไพ่ 1 ใบ ทุกตา</li>
                    <li>กด <span className="text-purple-400 font-bold">"ไหลไพ่"</span> ทิ้งตามเพื่อนได้ (คนโดนปรับชิป)</li>
                    <li>แต้มน้อยสุดกด <span className="text-red-400 font-bold">"แคง!"</span> รับทรัพย์ แคงล่มโดนปรับ</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-black text-blue-400 mb-2">✍️ นิยายยำเละ</h3>
                  <ul className="list-disc pl-5 text-gray-300 text-sm space-y-1">
                    <li>แต่งนิยายต่อกันด้วย <span className="text-yellow-400 font-bold">"5 คำสุดท้าย"</span></li>
                    <li>จบเกมระบบจะรวมเป็นเรื่องเดียว</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-black text-orange-400 mb-2">🐎 แข่งม้ามรณะ</h3>
                  <ul className="list-disc pl-5 text-gray-300 text-sm space-y-1">
                    <li>แทงสัตว์ที่จะเข้าเส้นชัยก่อน</li>
                    <li>คนแทงถูก แบ่งเงินกองกลางจากคนแทงผิด</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-black text-purple-400 mb-2">🎰 กาชาปองนรก</h3>
                  <ul className="list-disc pl-5 text-gray-300 text-sm space-y-1">
                    <li>ผลัดกันจั่วการ์ด 1 ใบ</li>
                    <li>การ์ดมีเอฟเฟกต์แกล้งกัน เช่น ปล้นคนรวย, หารเงินทุกคน, หรือสลับเงิน</li>
                    <li>ไพ่หมดกอง ใครเงินเยอะสุดชนะ</li>
                  </ul>
                </div>
                <div className="sm:col-span-2">
                  <h3 className="text-xl font-black text-cyan-400 mb-2">⚔️ Deck Builder (มาใหม่!)</h3>
                  <ul className="list-disc pl-5 text-gray-300 text-sm space-y-1">
                    <li>ใช้เงิน (Gold) ซื้อการ์ดจากตลาดกลางเข้าเด็คตัวเอง</li>
                    <li>จัดคอมโบการ์ดสีเดียวกัน (Somom, Angles, Musician, Cassanova)</li>
                    <li>ใช้พลังโจมตี (Combat) ฟาดพลังชีวิตเพื่อนให้เหลือ 0!</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Modal: สมมแคง */}
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

        {/* Modal: นิยายยำเละ */}
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

        {/* Modal: แข่งม้ามรณะ */}
        {racingModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setRacingModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-gray-900 border-2 border-orange-500/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setRacingModal(null)} className="absolute top-4 right-4 text-white/50 hover:text-white text-xl">✕</button>
              <h2 className="text-2xl font-black text-white text-center mb-6">
                {racingModal === "create" ? "🏁 สร้างสนามแข่ง" : "🎫 ซื้อตั๋วเข้าสนาม"}
                <div className="text-sm mt-1 font-medium text-orange-400">เกม: แข่งม้ามรณะ</div>
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-white/70 text-sm font-bold mb-2">รหัสสนามแข่ง</label>
                  <input type="text" placeholder="เช่น RACE99" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") executeRacing(); }} className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-xl text-white font-bold outline-none focus:border-orange-500 uppercase text-center text-xl tracking-widest" />
                </div>
                {racingModal === "create" && (
                  <div>
                    <label className="block text-white/70 text-sm font-bold mb-2">นักลงทุนสูงสุด</label>
                    <select value={racingMaxPlayers} onChange={(e) => setRacingMaxPlayers(Number(e.target.value))} className="w-full px-3 py-2 bg-black/50 border border-white/20 rounded-xl text-white outline-none">
                      <option value={2}>2 คน</option>
                      <option value={3}>3 คน</option>
                      <option value={4}>4 คน</option>
                      <option value={8}>8 คน</option>
                      <option value={12}>12 คน</option>
                    </select>
                  </div>
                )}
                <button type="button" onClick={executeRacing} className="w-full py-4 rounded-xl text-white font-black text-lg transition-all hover:scale-[1.02] shadow-lg mt-2 bg-gradient-to-r from-orange-500 to-red-600">
                  {racingModal === "create" ? "เปิดสนาม!" : "ลุย!"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Modal: กาชาปองนรก */}
        {gachaModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setGachaModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-gray-900 border-2 border-purple-500/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setGachaModal(null)} className="absolute top-4 right-4 text-white/50 hover:text-white text-xl">✕</button>
              <h2 className="text-2xl font-black text-white text-center mb-6">{gachaModal === "create" ? "🔮 ตั้งวงกาชา" : "🚪 เข้าสุ่มดวง"}<div className="text-sm mt-1 font-medium text-purple-400">เกม: กาชาปองนรก</div></h2>
              <div className="space-y-4">
                <input type="text" placeholder="รหัสห้อง" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-xl text-white font-bold outline-none focus:border-purple-500 uppercase text-center text-xl tracking-widest" />
                {gachaModal === "create" && (
                  <select value={gachaMaxPlayers} onChange={(e) => setGachaMaxPlayers(Number(e.target.value))} className="w-full px-3 py-2 bg-black/50 border border-white/20 rounded-xl text-white outline-none">
                    <option value={2}>2 คน</option><option value={3}>3 คน</option><option value={4}>4 คน</option><option value={8}>8 คน</option>
                  </select>
                )}
                <button type="button" onClick={executeGacha} className="w-full py-4 rounded-xl text-white font-black text-lg transition-all shadow-lg mt-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:scale-[1.02]">เข้าไปลุย!</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ✨ Modal ใหม่: Deck Builder */}
        {deckModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setDeckModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-gray-900 border-2 border-cyan-500/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setDeckModal(null)} className="absolute top-4 right-4 text-white/50 hover:text-white text-xl">✕</button>
              <h2 className="text-2xl font-black text-white text-center mb-6">{deckModal === "create" ? "⚔️ ตั้งตี้ไพ่คอมโบ" : "🚪 เข้าร่วมศึก"}<div className="text-sm mt-1 font-medium text-cyan-400">เกม: Deck Builder</div></h2>
              <div className="space-y-4">
                <input type="text" placeholder="รหัสห้อง" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") executeDeckBuilder(); }} className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-xl text-white font-bold outline-none focus:border-cyan-500 uppercase text-center text-xl tracking-widest" />
                {deckModal === "create" && (
                  <select value={deckMaxPlayers} onChange={(e) => setDeckMaxPlayers(Number(e.target.value))} className="w-full px-3 py-2 bg-black/50 border border-white/20 rounded-xl text-white outline-none">
                    <option value={2}>2 คน (ดวล 1v1)</option>
                    <option value={3}>3 คน</option>
                    <option value={4}>4 คน</option>
                  </select>
                )}
                <button type="button" onClick={executeDeckBuilder} className="w-full py-4 rounded-xl text-black font-black text-lg transition-all shadow-lg mt-2 bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-[1.02]">เข้าไปฟาด!</button>
              </div>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface Player {
  id: string;
  name: string;
  connected: boolean;
}

interface YamState {
  roomId: string;
  hostId: string;
  status: "waiting" | "playing" | "ended";
  players: Player[];
  currentTurnPlayerId: string | null;
  lastWords: string;
  turnCount: number;
  maxPlayers: number;
  maxRounds: number;
  currentRound: number;
  fullStory?: { playerId: string; playerName: string; text: string }[];
}

export default function YamstoryBoard({ roomId, username }: { roomId: string; username: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<YamState | null>(null);
  const [inputText, setInputText] = useState("");
  const storyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000");
    setSocket(s);

    // ดึงค่าตั้งค่าที่แอบซ่อนไว้ตอนสร้างห้องส่งไปให้ Server
    const maxPlayers = parseInt(sessionStorage.getItem("yamstory_maxPlayers") || "4");
    const maxRounds = parseInt(sessionStorage.getItem("yamstory_rounds") || "5");

    s.emit("join_yam_room", { roomId, username, maxPlayers, maxRounds });

    s.on("yam_state", (state: YamState) => {
      setGameState(state);
    });

    // รับ Error ถัาห้องเต็ม
    s.on("yam_error", ({ message }) => {
      alert(message);
      router.push("/"); // ดีดกลับหน้าแรก
    });

    return () => { s.disconnect(); };
  }, [roomId, username, router]);

  useEffect(() => {
    if (gameState?.status === "ended" && storyEndRef.current) {
      storyEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [gameState?.status]);

  if (!gameState || !socket) return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-900 font-sans">
      <h1 className="text-3xl text-blue-400 font-bold animate-pulse">กำลังกางสมุดข่อย...</h1>
    </div>
  );

  const isHost = socket.id === gameState.hostId;
  const isMyTurn = socket.id === gameState.currentTurnPlayerId;
  const currentTurnPlayerName = gameState.players.find(p => p.id === gameState.currentTurnPlayerId)?.name || "ใครสักคน";

  const handleStartGame = () => socket.emit("start_yam_game", { roomId });
  const handleEndGame = () => socket.emit("end_yam_game", { roomId });
  const handleResetGame = () => socket.emit("reset_yam_game", { roomId });

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    socket.emit("submit_yam_text", { roomId, text: inputText });
    setInputText("");
  };

  return (
    <div className="min-h-dvh bg-gray-900 text-white font-sans overflow-hidden flex flex-col relative">
      
      {/* ส่วนหัวกระดาน */}
      <header className="bg-gray-800/80 backdrop-blur-md border-b border-blue-500/30 p-4 sticky top-0 z-40 shadow-lg">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              ✍️ นิยายยำเละ
            </h1>
            <p className="text-blue-300/70 text-sm font-medium">ห้อง: <span className="text-white font-bold">{roomId}</span> | นามปากกา: {username}</p>
          </div>
          
          {/* ✨ โชว์รอบปัจจุบัน */}
          {gameState.status === "playing" && (
            <div className="bg-blue-900/50 px-4 py-2 rounded-xl border border-blue-500/50 shadow-inner">
              <span className="text-blue-200 font-bold text-sm">รอบที่ </span>
              <span className="text-2xl font-black text-white">{gameState.currentRound}</span>
              <span className="text-blue-400 font-bold"> / {gameState.maxRounds}</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 flex flex-col gap-6 h-full overflow-y-auto pb-32 z-10">
        
        {/* หน้าจอรอก่อนเริ่มเกม */}
        {gameState.status === "waiting" && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-gray-800 border-2 border-blue-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl text-center flex flex-col items-center gap-6 mt-10">
            <div className="text-6xl">📖</div>
            <h2 className="text-3xl font-black text-white">รอเพื่อนร่วมโต๊ะนักเขียน</h2>
            
            <div className="flex gap-4">
              <div className="bg-gray-900 px-4 py-2 rounded-lg border border-white/10">
                <span className="text-gray-400 text-xs block">นักเขียนสูงสุด</span>
                <span className="text-xl font-bold text-blue-400">{gameState.maxPlayers} คน</span>
              </div>
              <div className="bg-gray-900 px-4 py-2 rounded-lg border border-white/10">
                <span className="text-gray-400 text-xs block">ความยาวนิยาย</span>
                <span className="text-xl font-bold text-indigo-400">{gameState.maxRounds} รอบ</span>
              </div>
            </div>

            <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-4 border border-white/10">
              <h3 className="text-gray-400 font-bold mb-3 text-sm">รายชื่อนักเขียน ({gameState.players.length}/{gameState.maxPlayers})</h3>
              <ul className="space-y-2">
                {gameState.players.map((p, i) => (
                  <li key={p.id} className="flex justify-between items-center bg-gray-800 p-3 rounded-xl">
                    <span className="font-bold text-lg">{p.name} {p.id === gameState.hostId && "👑"}</span>
                    <span className={`w-3 h-3 rounded-full ${p.connected ? "bg-green-500 shadow-[0_0_10px_#22c55e]" : "bg-red-500"}`}></span>
                  </li>
                ))}
              </ul>
            </div>

            {isHost ? (
              <button 
                onClick={handleStartGame} 
                disabled={gameState.players.length < 2} 
                className={`w-full max-w-sm py-4 font-black text-xl rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.5)] ${gameState.players.length < 2 ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:scale-105 text-white"}`}
              >
                เริ่มเปิดเรื่อง!
              </button>
            ) : (
              <div className="text-blue-400 font-bold animate-pulse mt-4">รอหัวหน้าห้องเปิดหน้ากระดาษ...</div>
            )}
          </motion.div>
        )}

        {/* หน้าจอตอนกำลังแต่ง */}
        {gameState.status === "playing" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 h-full justify-center mt-10">
            
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-400 mb-2">ตานี้เป็นของ...</h2>
              <div className={`text-4xl font-black ${isMyTurn ? "text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 scale-110" : "text-white"} transition-all duration-300`}>
                {isMyTurn ? "🔥 คุณเอง! 🔥" : currentTurnPlayerName}
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full"></div>
              
              <h3 className="text-blue-300 font-bold mb-4 flex items-center gap-2">
                <span>คำใบ้จากคนก่อนหน้า</span>
                <span className="text-xs bg-blue-900/50 px-2 py-1 rounded text-blue-200">5 คำสุดท้าย</span>
              </h3>
              
              <div className="bg-black/40 border border-white/10 rounded-2xl p-6 min-h-[120px] flex items-center justify-center">
                <p className="text-2xl sm:text-4xl font-black text-white text-center leading-relaxed">
                  {gameState.lastWords ? `"...${gameState.lastWords}"` : "หน้ากระดาษยังว่างเปล่า..."}
                </p>
              </div>
            </div>

          </motion.div>
        )}

        {/* หน้าจอตอนจบเกม สรุปเรื่องราว */}
        {gameState.status === "ended" && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gray-800 border-2 border-indigo-500/50 rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col gap-6 mt-4">
            <div className="text-center">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 drop-shadow-lg">
                นิยายจบแล้ว!
              </h2>
              <p className="text-gray-400 mt-2 font-bold">มาดูผลงานกาวๆ ของพวกคุณกัน</p>
            </div>

            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 sm:p-8 mt-4 overflow-y-auto max-h-[50vh] prose prose-invert">
              <p className="text-xl leading-loose font-medium text-gray-200 indent-8">
                {gameState.fullStory?.map((item, index) => (
                  <span key={index} className="hover:bg-blue-900/40 px-1 rounded transition-colors" title={`เขียนโดย: ${item.playerName}`}>
                    {item.text}{" "}
                  </span>
                ))}
              </p>
              <div ref={storyEndRef} />
            </div>

            {isHost && (
              <div className="flex gap-4 mt-6">
                <button onClick={handleResetGame} className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:scale-105 text-white font-black text-xl rounded-xl transition-all shadow-lg">
                  เขียนเรื่องใหม่!
                </button>
              </div>
            )}
          </motion.div>
        )}

      </main>

      {/* แถบพิมพ์ข้อความ (จะโชว์ก็ต่อเมื่อเป็นตาเรา) */}
      <AnimatePresence>
        {gameState.status === "playing" && isMyTurn && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-0 left-0 w-full bg-gray-900/95 backdrop-blur-xl border-t-2 border-blue-500 p-4 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSubmitText} className="flex gap-3 relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitText(e);
                    }
                  }}
                  placeholder="พิมพ์ต่อเลย! ยิ่งกาวยิ่งดี... (กด Enter เพื่อส่ง)"
                  className="flex-1 bg-black/50 border border-blue-500/50 rounded-2xl px-5 py-4 text-white font-bold text-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 resize-none h-[60px] leading-tight"
                />
                <button type="submit" disabled={!inputText.trim()} className="px-6 sm:px-10 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xl rounded-2xl shadow-lg transition-all flex items-center justify-center">
                  ส่ง!
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
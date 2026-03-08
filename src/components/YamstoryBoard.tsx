"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";

interface YamPlayer {
  id: string;
  name: string;
  connected: boolean;
}

interface StoryEntry {
  playerId: string;
  playerName: string;
  text: string;
}

interface YamState {
  roomId: string;
  hostId: string | null;
  status: "waiting" | "playing" | "ended";
  players: YamPlayer[];
  currentTurnPlayerId: string | null;
  lastWords: string;
  turnCount: number;
  fullStory?: StoryEntry[];
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

export default function YamstoryBoard({ roomId, username }: { roomId: string; username: string }) {
  const [gameState, setGameState] = useState<YamState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("กำลังเชื่อมต่อ...");
  const [inputText, setInputText] = useState("");
  
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setMyPlayerId(socket.id || null);
      setStatusMessage("เชื่อมต่อสำเร็จ!");
      socket.emit("join_yam_room", { roomId, username });
    });

    socket.on("yam_state", (state: YamState) => {
      setGameState(state);
    });

    socket.on("error_message", (data: { message: string }) => {
      setStatusMessage(data.message);
    });

    return () => { socket.disconnect(); };
  }, [roomId, username]);

  const isHost = gameState?.hostId === myPlayerId;
  const isMyTurn = gameState?.status === "playing" && gameState.currentTurnPlayerId === myPlayerId;
  const currentTurnPlayer = gameState?.players.find(p => p.id === gameState.currentTurnPlayerId);

  const handleStartGame = () => {
    if (socketRef.current && isHost) socketRef.current.emit("start_yam_game", { roomId });
  };

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !isMyTurn || !socketRef.current) return;
    socketRef.current.emit("submit_yam_text", { roomId, text: inputText.trim() });
    setInputText("");
  };

  const handleEndGame = () => {
    if (socketRef.current && isHost) socketRef.current.emit("end_yam_game", { roomId });
  };

  const handlePlayAgain = () => {
    if (socketRef.current && isHost) socketRef.current.emit("reset_yam_game", { roomId });
  };

  return (
    <div className="relative w-full h-dvh bg-slate-900 overflow-hidden flex flex-col items-center justify-center font-sans">
      
      {/* พื้นหลัง */}
      <div className="absolute inset-0 opacity-5 pointer-events-none text-[25vw] flex items-center justify-center font-serif text-white/50">
        ✍️
      </div>

      <button onClick={() => { window.location.href = "/"; }} className="absolute top-4 left-4 px-4 py-2 bg-black/40 text-white rounded-lg hover:bg-black/60 z-50 text-sm font-bold border border-white/20">
        ← กลับไป Arcade
      </button>

      <div className="absolute top-4 right-4 bg-black/40 px-4 py-2 rounded-lg border border-white/10 z-50 text-white/80 text-sm">
        ห้อง: <span className="text-blue-400 font-bold">{roomId}</span> <span className="hidden sm:inline">| {statusMessage}</span>
      </div>

      {!gameState ? (
        <h1 className="text-white font-bold text-2xl animate-pulse">กำลังดึงหน้ากระดาษจากสมองกล...</h1>
      ) : gameState.status === "waiting" ? (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="z-10 bg-black/60 p-8 rounded-3xl border border-blue-500/30 backdrop-blur-md text-center max-w-lg w-full shadow-[0_0_40px_rgba(59,130,246,0.2)]">
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-6">นักเขียนในห้องประชุม</h2>
          <div className="flex flex-wrap gap-3 justify-center mb-8">
            {gameState.players.map(p => (
              <span key={p.id} className={`px-4 py-2 rounded-full font-bold shadow-md ${p.id === myPlayerId ? "bg-blue-600 text-white" : "bg-white/10 text-white/80 border border-white/5"}`}>
                {p.name} {p.id === gameState.hostId && "👑"}
              </span>
            ))}
          </div>
          {isHost ? (
            <button onClick={handleStartGame} disabled={gameState.players.length < 2} className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-black text-xl rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.5)] disabled:opacity-50 disabled:grayscale">
              เริ่มเปิดเรื่อง! ({gameState.players.length} คน)
            </button>
          ) : (
            <p className="text-blue-300 animate-pulse font-medium bg-blue-900/30 py-3 rounded-lg">รอเจ้าของห้องเปิดกระดาษหน้าแรก...</p>
          )}
        </motion.div>
      ) : gameState.status === "playing" ? (
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="z-10 w-full max-w-2xl px-4 flex flex-col gap-6 items-center">
          
          <div className="text-center bg-black/60 px-8 py-3 rounded-full border border-blue-500/30 backdrop-blur-sm shadow-lg">
            <span className="text-white/80 text-lg">
              บรรทัดที่ <span className="text-blue-400 font-black text-2xl">{gameState.turnCount}</span> | ตาของ: <span className="text-gold font-black text-2xl animate-pulse">{currentTurnPlayer?.name}</span>
            </span>
          </div>

          {isMyTurn ? (
            <form onSubmit={handleSubmitText} className="w-full bg-black/70 p-6 sm:p-8 rounded-3xl border-2 border-blue-500/50 backdrop-blur-md shadow-[0_0_30px_rgba(59,130,246,0.3)] flex flex-col gap-6">
              <div className="text-center bg-white/5 p-4 rounded-2xl">
                <p className="text-white/50 text-sm mb-2 font-bold">เพื่อนคนก่อนหน้าทิ้งคำใบ้ไว้ว่า...</p>
                <h3 className="text-2xl sm:text-3xl font-serif text-white italic border-l-4 border-blue-500 pl-4 py-2">
                  "...{gameState.lastWords || "เริ่มเปิดเรื่องราวได้เลย!"}"
                </h3>
              </div>
              
              <div>
                <textarea 
                  autoFocus
                  required
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="พิมพ์แต่งเรื่องต่อจากคำใบ้เลย! ยิ่งกาวยิ่งดี..."
                  className="w-full h-40 bg-black/50 border-2 border-white/10 rounded-xl p-4 text-white text-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none resize-none transition-all font-medium"
                />
              </div>
              <button type="submit" className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] text-white font-black text-xl rounded-xl transition-transform shadow-[0_0_20px_rgba(79,70,229,0.5)] flex items-center justify-center gap-2">
                ส่งกระดาษให้คนต่อไป 📝
              </button>
            </form>
          ) : (
            <div className="bg-black/60 p-12 rounded-3xl border border-white/10 backdrop-blur-md text-center shadow-2xl">
              <div className="text-7xl mb-6 animate-bounce">🤔</div>
              <h3 className="text-2xl text-white font-bold">กำลังรอ <span className="text-blue-400">{currentTurnPlayer?.name}</span> ปั่นจินตนาการ...</h3>
              <p className="text-white/50 mt-3 font-medium">ห้ามแอบชะโงกไปดูจอเพื่อน ปล่อยให้มันมั่วไปเลย!</p>
            </div>
          )}

          {isHost && (
            <button type="button" onClick={handleEndGame} className="mt-4 px-6 py-3 bg-red-500/10 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-full font-bold transition-all text-sm">
              🛑 จบเรื่องและเปิดอ่าน (Host เท่านั้น)
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="z-10 w-full max-w-4xl px-4 flex flex-col items-center max-h-[90dvh]">
          <h2 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-300 mb-6 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] text-center">
            📖 มหากาพย์นิยายยำเละ 📖
          </h2>
          
          <div className="w-full bg-[#fdf6e3] text-slate-900 p-8 sm:p-12 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-y-auto font-serif leading-loose text-lg sm:text-2xl border-8 border-[#d4c5b0] relative">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/aged-paper.png')" }}></div>
            
            <div className="relative z-10 text-justify indent-12">
              {gameState.fullStory?.map((entry, idx) => (
                <span key={idx} className="relative group cursor-help transition-all duration-300 hover:bg-yellow-300/60 rounded px-1">
                  {entry.text}{" "}
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-sm font-sans px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity shadow-xl font-bold before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-slate-900">
                    ✍️ เขียนโดย: {entry.playerName}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {isHost ? (
            <button onClick={handlePlayAgain} className="mt-8 px-12 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black text-xl rounded-xl hover:scale-[1.05] transition-transform shadow-[0_0_30px_rgba(79,70,229,0.5)]">
              เริ่มแต่งเรื่องใหม่! 🔄
            </button>
          ) : (
            <p className="text-blue-300 mt-8 animate-pulse font-bold bg-black/40 px-6 py-3 rounded-full border border-blue-500/30">รอเจ้าของห้องหยิบกระดาษแผ่นใหม่...</p>
          )}
        </motion.div>
      )}
    </div>
  );
}
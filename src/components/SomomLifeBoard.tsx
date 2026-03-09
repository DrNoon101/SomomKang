"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";

interface Player { id: string; name: string; connected: boolean; isDead: boolean; age: number; hp: number; happiness: number; smarts: number; looks: number; gold: number; log: string[]; }
interface LifeState { id: string; hostId: string; status: "waiting" | "playing" | "ended"; maxPlayers: number; players: Player[]; history: string[]; }

export default function SomomLifeBoard({ roomId, username }: { roomId: string; username: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<LifeState | null>(null);

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000");
    setSocket(s);
    const attemptJoin = () => {
      const maxPlayers = parseInt(sessionStorage.getItem("somomlife_maxPlayers") || "8");
      s.emit("join_life_room", { roomId, username, maxPlayers });
    };
    s.on("connect", attemptJoin);
    if (s.connected) attemptJoin();
    
    s.on("life_state", (state: LifeState) => setGameState(state));
    s.on("life_error", (msg) => { alert(msg.message); router.push("/"); });
    
    return () => { s.disconnect(); };
  }, [roomId, username, router]);

  if (!gameState || !socket) return <div className="min-h-dvh flex items-center justify-center bg-slate-950 text-white"><div className="text-6xl animate-spin">🧬</div></div>;

  const isHost = socket.id === gameState.hostId;
  const me = gameState.players.find(p => p.id === socket.id);
  
  // ตัวช่วยวาดหลอดพลัง (Progress Bar)
  const StatusBar = ({ label, value, colorClass, emoji }: { label: string, value: number, colorClass: string, emoji: string }) => (
    <div className="flex flex-col gap-1 w-full bg-black/40 p-2 rounded-xl border border-slate-700">
      <div className="flex justify-between text-[10px] sm:text-xs font-bold">
        <span className="text-slate-300">{emoji} {label}</span>
        <span className={value < 30 ? "text-red-400" : "text-white"}>{value}%</span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-3 sm:h-4 overflow-hidden border border-black">
        <div className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }}></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-slate-950 text-white font-sans flex flex-col relative h-dvh overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
      
      <header className="bg-black/80 p-3 flex justify-between items-center z-20 border-b border-emerald-500/30 shrink-0">
        <div>
          <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">🧬 Somom's Life</h1>
          <p className="text-emerald-300 text-xs">ROOM: {roomId} | ผู้เล่น: {username}</p>
        </div>
        <button onClick={() => router.push("/")} className="bg-red-900/50 text-red-400 px-3 py-1 rounded-lg text-sm font-bold hover:bg-red-600 hover:text-white transition border border-red-500/50">ยอมแพ้โชคชะตา</button>
      </header>

      {/* --- โหมดรอคน --- */}
      {gameState.status === "waiting" && (
        <main className="flex-1 flex flex-col items-center justify-center p-4 z-10 overflow-y-auto">
          <div className="text-center bg-black/60 p-8 sm:p-10 rounded-3xl border border-emerald-900/50 shadow-[0_0_40px_rgba(16,185,129,0.15)] max-w-lg w-full">
            <div className="text-6xl sm:text-8xl mb-6 animate-pulse drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]">🧬</div>
            <h2 className="text-2xl sm:text-3xl font-black mb-4 text-emerald-300">ห้องรอรับขวัญ ({gameState.players.length}/{gameState.maxPlayers})</h2>
            <div className="flex flex-col gap-2 mt-6">
              {gameState.players.map((p) => (
                <div key={p.id} className="bg-slate-800/80 px-4 py-3 rounded-xl border border-slate-600 flex justify-between items-center">
                  <span className="font-bold">{p.name} {p.id === gameState.hostId && "👑"}</span>
                  <span className={`text-xs font-bold ${p.connected ? 'text-green-400' : 'text-red-400'}`}>{p.connected ? "รอเกิด" : "วิญญาณหลุด"}</span>
                </div>
              ))}
            </div>
            {isHost ? (
              <button onClick={() => socket.emit("start_life_game", { roomId })} disabled={gameState.players.length < 1} className="mt-8 px-6 py-4 w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:scale-105 disabled:opacity-50 text-white font-black text-xl rounded-2xl transition-all shadow-lg">ให้กำเนิดทุกคน!</button>
            ) : (<div className="mt-8 text-emerald-500/70 font-bold animate-pulse">รอพระเจ้า(หัวหน้าห้อง) เริ่มเกม...</div>)}
          </div>
        </main>
      )}

      {/* --- โหมดจำลองชีวิต --- */}
      {gameState.status === "playing" && me && (
        <div className="flex-1 flex flex-col md:flex-row gap-4 p-2 sm:p-4 h-full overflow-hidden max-w-7xl mx-auto w-full z-10">
          
          {/* ซ้าย: หน้าจอชีวิตส่วนตัว */}
          <div className="flex-1 flex flex-col bg-black/60 border-2 border-emerald-900/50 rounded-3xl p-4 overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.1)] relative">
            
            {me.isDead && (
              <div className="absolute inset-0 bg-red-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="text-8xl mb-4 drop-shadow-[0_0_20px_red]">🪦</div>
                <h2 className="text-4xl font-black text-red-400 mb-2">มรณภาพ!</h2>
                <p className="text-xl text-red-200">คุณจากโลกนี้ไปในวัย {me.age} ปี</p>
                <p className="text-yellow-400 mt-4 font-bold">เงินมรดก: {me.gold} 💰</p>
                <p className="mt-6 text-slate-400 text-sm">นั่งดูชีวิตเพื่อนที่เหลือต่อไป...</p>
              </div>
            )}

            <div className="flex justify-between items-center mb-4 pb-4 border-b border-emerald-500/20 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-4xl border-2 border-slate-600">
                  {me.age < 12 ? "👶" : me.age < 20 ? "👦" : me.age < 60 ? "👨" : "👴"}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-emerald-400">{me.name}</h2>
                  <p className="text-slate-300 font-bold text-lg">อายุ: {me.age} ปี</p>
                </div>
              </div>
              <div className="text-right bg-yellow-900/30 px-4 py-2 rounded-xl border border-yellow-600/50">
                <p className="text-yellow-500 text-xs font-bold">ยอดเงินในบัญชี</p>
                <p className="text-2xl font-black text-yellow-400">{me.gold} 💰</p>
              </div>
            </div>

            {/* แถบสเตตัส */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-6 shrink-0">
              <StatusBar label="สุขภาพ" value={me.hp} emoji="💖" colorClass={me.hp > 50 ? "bg-green-500" : "bg-red-500"} />
              <StatusBar label="ความสุข" value={me.happiness} emoji="😊" colorClass={me.happiness > 50 ? "bg-yellow-400" : "bg-orange-500"} />
              <StatusBar label="ความฉลาด" value={me.smarts} emoji="🧠" colorClass="bg-blue-500" />
              <StatusBar label="หน้าตา" value={me.looks} emoji="✨" colorClass="bg-pink-500" />
            </div>

            {/* ปุ่ม Age Up */}
            <button 
              onClick={() => !me.isDead && socket.emit("age_up", { roomId })}
              disabled={me.isDead}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-2xl py-4 rounded-2xl shadow-[0_10px_20px_rgba(16,185,129,0.4)] transition-transform hover:-translate-y-1 active:translate-y-1 mb-4 shrink-0"
            >
              +1 ปี (ใช้ชีวิต) ⏳
            </button>

            {/* ประวัติชีวิตส่วนตัว */}
            <div className="flex-1 bg-slate-900/80 rounded-2xl border border-slate-700 p-3 overflow-y-auto flex flex-col gap-2 min-h-0">
              {me.log.map((log, i) => (
                <div key={i} className={`p-2 rounded-lg text-sm border-l-4 ${i === 0 ? 'bg-slate-800 border-emerald-500 text-white font-bold' : 'bg-slate-800/50 border-slate-600 text-slate-300'}`}>
                  {log}
                </div>
              ))}
            </div>

          </div>

          {/* ขวา: โลกออนไลน์ (Leaderboard & Global News) */}
          <div className="w-full md:w-80 flex flex-col gap-4 h-full shrink-0">
            
            {/* รายชื่อผู้เล่นทั้งหมด */}
            <div className="bg-black/60 border border-slate-700 rounded-3xl p-4 flex-1 flex flex-col overflow-hidden shadow-xl">
              <h3 className="text-emerald-400 font-bold text-center border-b border-slate-700 pb-2 mb-3 shrink-0">👥 รายชื่อประชากร</h3>
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 min-h-0">
                {gameState.players.map(p => (
                  <div key={p.id} className={`p-2 rounded-xl flex justify-between items-center text-sm border ${p.id === socket.id ? 'bg-emerald-900/30 border-emerald-500' : 'bg-slate-800 border-slate-600'} ${p.isDead ? 'opacity-50 grayscale' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{p.isDead ? "🪦" : "👤"}</span>
                      <span className="font-bold truncate max-w-[90px]">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-300">{p.age} ปี</p>
                      <p className="text-[10px] text-yellow-400">{p.gold}G</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ข่าวประกาศโลก */}
            <div className="bg-black/60 border border-slate-700 rounded-3xl p-4 h-1/3 flex flex-col overflow-hidden shadow-xl">
              <h3 className="text-red-400 font-bold text-center border-b border-slate-700 pb-2 mb-2 shrink-0">📰 ข่าวมรณกรรม</h3>
              <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1 min-h-0">
                {gameState.history.map((h, i) => (
                  <div key={i} className="text-[10px] text-slate-300 bg-red-950/30 p-1.5 rounded border border-red-900/50">
                    {h}
                  </div>
                ))}
                {gameState.history.length === 0 && <p className="text-xs text-slate-500 text-center mt-4">ยังไม่มีใครตาย...</p>}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
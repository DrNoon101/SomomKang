"use client";

import { motion } from "framer-motion";

interface OpponentAvatarProps {
  name: string;
  cardCount: number;
  chips: number;
  leftPercent: number;
  topPercent: number;
  isCurrentTurn: boolean;
}

export function OpponentAvatar({
  name,
  cardCount,
  chips,
  leftPercent,
  topPercent,
  isCurrentTurn,
}: OpponentAvatarProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 z-10"
      style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
    >
      <div className="relative">
        <div
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
            isCurrentTurn
              ? "bg-gradient-to-br from-green-400 to-emerald-600 border-4 border-white shadow-[0_0_20px_rgba(74,222,128,0.8)] scale-110"
              : "bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-gray-500"
          }`}
        >
          <svg className={`w-8 h-8 sm:w-10 sm:h-10 ${isCurrentTurn ? "text-white" : "text-gray-400"}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
        <div className="absolute -bottom-1 -right-1 bg-red-600 text-white text-xs sm:text-sm font-bold w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border-2 border-felt shadow-md">
          {cardCount}
        </div>
      </div>

      <div className="mt-3 flex flex-col items-center">
        {/* 🔥 จุดแก้ชื่อยาว: ใส่ title={name} และ cursor-help เพื่อให้มี Tooltip ตอนเอาเมาส์ชี้ */}
        <div
          title={name}
          className={`px-3 py-1 rounded-t-lg text-xs sm:text-sm font-bold truncate max-w-[100px] text-center shadow-md transition-all cursor-help ${
            isCurrentTurn ? "bg-green-500 text-black shadow-[0_0_10px_rgba(74,222,128,0.5)]" : "bg-black/60 text-white border border-white/20"
          }`}
        >
          {name}
        </div>
        <div className="bg-amber-500/20 border border-amber-500/50 px-2 py-0.5 rounded-b-lg flex items-center gap-1 shadow-md w-full justify-center">
          <span className="text-xs">🪙</span>
          <span className="text-gold text-xs font-bold">{chips}</span>
        </div>
      </div>
    </motion.div>
  );
}
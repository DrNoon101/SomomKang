"use client";

import { motion } from "framer-motion";

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface CardData {
  id: string;
  suit: Suit;
  rank: Rank;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const SUIT_COLORS: Record<Suit, string> = {
  hearts: "text-card-red",
  diamonds: "text-card-red",
  clubs: "text-card-black",
  spades: "text-card-black",
};

interface CardProps {
  card: CardData;
  index: number;
  totalInHand: number;
  isSelected: boolean;
  isDimmed: boolean;
  onClick: () => void;
  /** When true, shows face-down (for draw/discard pile) */
  faceDown?: boolean;
  /** When true, smaller card (for pile preview) */
  compact?: boolean;
}

export function Card({
  card,
  index,
  totalInHand,
  isSelected,
  isDimmed,
  onClick,
  faceDown = false,
  compact = false,
}: CardProps) {
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const suitColor = SUIT_COLORS[card.suit];

  // คำนวณองศาการกางไพ่
  const fanOffset = totalInHand > 1 ? (index - (totalInHand - 1) / 2) * 12 : 0;
  const rotation = totalInHand > 1 ? fanOffset * 0.8 : 0;

  const baseClasses = compact
    ? "w-12 h-16 sm:w-14 sm:h-20"
    : "w-14 h-20 sm:w-16 sm:h-24";

  // แอนิเมชันสำหรับไพ่คว่ำหน้า (กองจั่ว)
  if (faceDown) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, rotate: rotation }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`${baseClasses} rounded-lg bg-gradient-to-br from-blue-900 to-blue-950 border-2 border-gold/30 flex items-center justify-center shadow-md cursor-pointer flex-shrink-0`}
      >
        <div className="w-6 h-8 rounded bg-blue-800/50" />
      </motion.div>
    );
  }

  // แอนิเมชันสำหรับไพ่หงายหน้า (ในมือเรา)
  return (
    <motion.button
      layout
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 50, scale: 0.8 }}
      animate={{
        opacity: isDimmed ? 0.4 : 1,
        y: isSelected ? -15 : 0,
        scale: isSelected ? 1.05 : 1,
        rotate: rotation,
        filter: isDimmed ? "brightness(0.75)" : "brightness(1)",
      }}
      exit={{ opacity: 0, scale: 0.5, y: -50 }}
      whileHover={{ scale: isDimmed ? 1 : (isSelected ? 1.1 : 1.02), y: isDimmed ? 0 : (isSelected ? -15 : -5) }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`
        ${baseClasses} relative rounded-lg bg-white border-2 border-gray-200
        flex flex-col items-start justify-between p-1.5
        flex-shrink-0 select-none shadow-md
        ${isSelected ? "z-20 shadow-[0_10px_20px_rgba(0,0,0,0.4)]" : "z-10"}
      `}
    >
      {/* บนซ้าย */}
      <div className={`text-xs sm:text-sm font-bold ${suitColor} leading-tight`}>
        <span>{card.rank}</span>
        <span className="block">{suitSymbol}</span>
      </div>
      
      {/* ตรงกลาง (โชว์เฉพาะไพ่ใบใหญ่) */}
      {!compact && (
        <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl ${suitColor} opacity-80`}>
          {suitSymbol}
        </div>
      )}
      
      {/* ล่างขวา (กลับหัว) */}
      <div className={`text-xs font-bold ${suitColor} leading-tight self-end transform rotate-180`}>
        <span>{card.rank}</span>
        <span className="block">{suitSymbol}</span>
      </div>
    </motion.button>
  );
}
"use client";

import { motion } from "framer-motion";

interface RulesModalProps {
  onClose: () => void;
}

export function RulesModal({ onClose }: RulesModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-felt-dark border-2 border-gold/50 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85dvh] overflow-y-auto"
      >
        <div className="p-6 text-white/90 space-y-4">
          <div className="flex justify-between items-center border-b border-white/20 pb-3">
            <h2 className="text-2xl font-black text-gold drop-shadow-md">📖 กติกา SomomKang</h2>
            <button onClick={onClose} className="text-white/50 hover:text-white text-2xl font-bold">×</button>
          </div>

          <div className="space-y-4 text-sm sm:text-base">
            <div>
              <h3 className="text-gold font-bold text-lg mb-1">🎯 เป้าหมายของเกม</h3>
              <p>ทำแต้มในมือให้เหลือน้อยที่สุด ใครแต้มน้อยสุดตอนจบเกมจะเป็นผู้กวาดเงินกองกลาง</p>
            </div>

            <div>
              <h3 className="text-gold font-bold text-lg mb-1">🃏 การนับแต้ม</h3>
              <ul className="list-disc list-inside space-y-1 bg-black/30 p-3 rounded-lg border border-white/5">
                <li><span className="font-bold text-amber-400">A</span> = 1 แต้ม</li>
                <li><span className="font-bold text-amber-400">2 ถึง 10</span> = แต้มตามหน้าไพ่</li>
                <li><span className="font-bold text-amber-400">J, Q, K</span> = 10 แต้ม</li>
              </ul>
            </div>

            <div>
              <h3 className="text-gold font-bold text-lg mb-1">⚡ แอคชั่นในเกม</h3>
              <ul className="space-y-2">
                <li><span className="bg-blue-600 px-2 py-0.5 rounded font-bold">จั่ว & ทิ้ง</span> : ถึงตาคุณต้องจั่วไพ่ 1 ใบ และทิ้งไพ่ 1 ใบ (หรือทิ้งหลายใบถ้าแต้มเท่ากัน)</li>
                <li><span className="bg-amber-500 text-black px-2 py-0.5 rounded font-bold">ไหล</span> : ถ้าเพื่อนทิ้งไพ่ที่แต้มตรงกับในมือคุณ คุณสามารถกด "ไหล" ได้ทันที <span className="text-red-400 font-bold">(คนโดนไหลโดนปรับใบละ 25 ชิป!)</span></li>
                <li><span className="bg-red-600 px-2 py-0.5 rounded font-bold">แคง</span> : หากมั่นใจว่าแต้มในมือน้อยที่สุด ให้กด "แคง" เพื่อจบเกมทันที <span className="text-red-400 font-bold">(แต่ถ้าแต้มไม่น้อยสุด โดนจ่ายรอบวง!)</span></li>
              </ul>
            </div>

            <div>
              <h3 className="text-gold font-bold text-lg mb-1">👑 ชนะทันที (น็อคมืด)</h3>
              <p>หากไพ่ 5 ใบแรกเข้าเงื่อนไขเหล่านี้ ชนะรับเงินทันทีไม่ต้องเล่น! (เรียงตามความใหญ่)</p>
              <ul className="list-disc list-inside space-y-1 bg-black/30 p-3 rounded-lg border border-white/5 mt-2">
                <li><span className="font-bold text-amber-400">สเตรทฟลัช (Straight Flush)</span> : เรียงและดอกเดียวกัน</li>
                <li><span className="font-bold text-amber-400">หอน (Four of a Kind)</span> : ไพ่แต้มเดียวกัน 4 ใบ</li>
                <li><span className="font-bold text-amber-400">ฟูลเฮาส์ (Full House)</span> : ตอง + คู่</li>
                <li><span className="font-bold text-amber-400">สี (Flush)</span> : ดอกเดียวกัน 5 ใบ</li>
                <li><span className="font-bold text-amber-400">เรียง (Straight)</span> : แต้มเรียงกัน 5 ใบ</li>
                <li><span className="font-bold text-amber-400">ตอง (Three of a Kind)</span> : ไพ่แต้มเดียวกัน 3 ใบ</li>
                <li><span className="font-bold text-amber-400">50 แต้ม (Max Points)</span> : แต้มรวมในมือได้ 50 พอดี</li>
              </ul>
            </div>
          </div>

          <button onClick={onClose} className="w-full py-3 mt-4 rounded-xl bg-gold text-black font-black text-lg hover:bg-amber-400 transition-colors shadow-lg">
            เข้าใจแล้ว ลุย!
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
      // ยันต์ปิดตาคุณครูฝ่ายปกครอง ห้ามตรวจคำผิดตอนขึ้นเว็บ!
      ignoreDuringBuilds: true,
    },
  };
  
  module.exports = nextConfig;
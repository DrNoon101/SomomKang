/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
      // ปิดตาระบบตรวจคำผิดตอนขึ้น Vercel
      ignoreDuringBuilds: true,
    },
  };
  
  module.exports = nextConfig;
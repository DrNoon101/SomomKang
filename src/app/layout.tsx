import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SomomKang - เกมไพ่",
  description: "เกมไพ่เล่นออนไลน์กับเพื่อน 2-6 คน",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased min-h-dvh bg-felt">
        {children}
      </body>
    </html>
  );
}

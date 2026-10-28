import "./globals.css";
import { Noto_Sans_Devanagari } from "next/font/google";

// One font family that supports both Marathi/Hindi (Devanagari) and English.
const font = Noto_Sans_Devanagari({ subsets: ["devanagari", "latin"], weight: ["400", "600", "700"] });

export const metadata = {
  title: "कागदमित्र (KagadMitra)",
  description: "कोणताही कागद, सोप्या मराठीत",
};
export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="mr">
      <body className={font.className}>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { StoreProvider } from "@/lib/store";
import "./styles.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "RRF HR Nexus",
  description: "Workforce information and monitoring for RRFMG Tuguegarao.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${inter.variable} ${playfair.variable}`}><StoreProvider>{children}</StoreProvider></body></html>;
}

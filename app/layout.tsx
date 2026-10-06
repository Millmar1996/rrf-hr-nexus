import type { Metadata } from "next";
import { StoreProvider } from "@/lib/store";
import "./styles.css";

export const metadata: Metadata = {
  title: "RRF HR Nexus",
  description: "Workforce information and monitoring for RRFMG Tuguegarao.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><StoreProvider>{children}</StoreProvider></body></html>;
}

import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "The Turing Test | TuringLytics",
  description: "Test your baseball intelligence. Build lineups, beat the streak, compete for prizes.",
  openGraph: {
    title: "The Turing Test",
    description: "Baseball prediction platform by TuringLytics",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface-950 text-slate-200 min-h-screen">
        <Navbar />
        <main className="pt-16 min-h-screen">
          {children}
        </main>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1a2035",
              color: "#e2e8f0",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#00d4ff", secondary: "#0a0f1e" },
            },
            error: {
              iconTheme: { primary: "#ff4757", secondary: "#fff" },
            },
          }}
        />
      </body>
    </html>
  );
}

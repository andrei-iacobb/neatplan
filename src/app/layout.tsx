import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { WaveBackground } from "@/components/ui/wave-background";
import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from '@/components/ui/toast-context'
import { Sidebar } from "@/components/ui/sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CleanTrack",
  description: "Track your cleaning tasks and schedule",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} antialiased`}>
        <ToastProvider>
          <WaveBackground />
          <Providers>
            <div className="min-h-screen">
              <Sidebar />
              <main className="pl-[60px] transition-[padding] duration-200">
                {children}
              </main>
            </div>
          </Providers>
          <Toaster />
        </ToastProvider>
      </body>
    </html>
  );
}

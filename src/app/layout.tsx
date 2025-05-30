import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { WaveBackground } from "@/components/ui/wave-background";
import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from '@/components/ui/toast-context'
import { ConditionalLayout } from '@/components/layout/conditional-layout'

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
            <ConditionalLayout>
              {children}
            </ConditionalLayout>
          </Providers>
          <Toaster />
        </ToastProvider>
      </body>
    </html>
  );
}

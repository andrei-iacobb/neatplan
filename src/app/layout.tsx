import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { WaveBackground } from "@/components/ui/wave-background";
import { ToastProvider } from '@/components/ui/toast-context'
import { ConditionalLayout } from '@/components/layout/conditional-layout'
import { Footer } from '@/components/ui/footer'

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
      <body className={`${inter.className} antialiased h-full`}>
        <ToastProvider>
          <WaveBackground />
          <div className="min-h-full pb-16">
            <Providers>
              <ConditionalLayout>
                {children}
              </ConditionalLayout>
            </Providers>
          </div>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { WaveBackground } from "@/components/ui/wave-background";
import { ToastProvider } from '@/components/ui/toast-context'
import { PageWrapper } from "@/components/layout/page-wrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CleanTrack",
  description: "Track your cleaning tasks and schedule",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

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
          <Providers>
            <PageWrapper>
              {children}
            </PageWrapper>
          </Providers>
        </ToastProvider>
      </body>
    </html>
  );
}

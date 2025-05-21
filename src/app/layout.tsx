import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { WaveBackground } from "@/components/ui/wave-background";

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
        <WaveBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { WaveBackground } from "@/components/ui/wave-background";
import { ToastProvider } from '@/components/ui/toast-context'
import { PageWrapper } from "@/components/layout/page-wrapper";
import { SettingsProvider } from "@/contexts/settings-context";
import Script from "next/script";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: { default: "NeatPlan", template: "%s | NeatPlan" },
  description: "Track your cleaning tasks and schedule",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "NeatPlan",
    statusBarStyle: "black-translucent",
  },
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
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans antialiased h-full`} style={{ fontFamily: 'var(--font-jakarta), system-ui, sans-serif' }}>
        {/* Pre-hydration theme: apply the persisted/system theme before first paint to avoid a flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t='light';var s=localStorage.getItem('neatplan-settings');if(s){var p=JSON.parse(s);if(p&&p.theme){t=p.theme;}}if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}var r=document.documentElement;r.classList.remove('dark','light');r.classList.add(t==='dark'?'dark':'light');}catch(e){}})();`,
          }}
        />
        <SettingsProvider>
          <ToastProvider>
            <WaveBackground />
            <Providers>
              <PageWrapper>
                {children}
              </PageWrapper>
            </Providers>
          </ToastProvider>
        </SettingsProvider>
        <Script id="pwa-register" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
          }`}
        </Script>
        <Script
          strategy="afterInteractive"
          data-domain="neatplan.app"
          src="https://plausible.iacob.co.uk/js/pa-DxZWTPYA1vbhB0hKkuJQ_.js"
        />
        <Script id="plausible-init" strategy="afterInteractive">
          {`
            window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
            plausible.init()
          `}
        </Script>
      </body>
    </html>
  );
}

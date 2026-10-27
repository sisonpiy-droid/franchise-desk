import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, Newsreader, Noto_Sans_Kannada, Noto_Sans_Devanagari, Chakra_Petch } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const ui = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const display = Newsreader({ subsets: ["latin"], variable: "--font-display", display: "swap", style: ["normal", "italic"] });
const kannada = Noto_Sans_Kannada({ subsets: ["kannada"], variable: "--font-kannada", display: "swap", weight: ["400", "600"], preload: false });
const game = Chakra_Petch({ subsets: ["latin"], variable: "--font-game", display: "swap", weight: ["500", "600", "700"] });
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-devanagari", display: "swap", weight: ["400", "600"], preload: false });

export const metadata: Metadata = {
  title: "Franchise Desk",
  description: "Decides every franchise application, explains why, and plans onboarding for partners who move forward.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#07070b" },
    { media: "(prefers-color-scheme: dark)", color: "#07070b" },
  ],
};

// The command centre is dark only.
const themeInit = `document.documentElement.dataset.theme="dark"`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${display.variable} ${kannada.variable} ${devanagari.variable} ${game.variable}`} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {/* the landing map needs these first: start the downloads with the page instead of after the 3D code loads */}
        <link rel="preload" as="image" href="/diorama/backdrop.jpg" />
        <link rel="preload" as="image" href="/diorama/region/sat.jpg" crossOrigin="anonymous" />
        <link rel="preload" as="image" href="/diorama/region/height.png" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        {/* Anonymous visit counts (Vercel Web Analytics): no cookies, nothing from uploaded files. Quiet if it is switched off or blocked. */}
        <Script id="va-queue" strategy="afterInteractive">{"window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};"}</Script>
        <Script src="/_vercel/insights/script.js" strategy="afterInteractive" defer />
      </body>
    </html>
  );
}

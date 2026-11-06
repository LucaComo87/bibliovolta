import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { APP } from "@/lib/config";
import "./globals.css";

// Font ospitati localmente (nessuna richiesta a Google Fonts: più privacy per gli studenti)
const heading = localFont({
  src: "./fonts/fraunces-latin-wght-normal.woff2",
  variable: "--font-heading",
  weight: "100 900",
  display: "swap",
});
const body = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  variable: "--font-body",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${APP.name} · ${APP.tagline}`, template: `%s · ${APP.name}` },
  description: "Prenota il tuo posto nella biblioteca del Liceo Volta.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = { themeColor: "#0f2350" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${heading.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
      </body>
    </html>
  );
}

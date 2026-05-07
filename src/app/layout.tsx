import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import LoadingScreen from "@/components/loading/LoadingScreen";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reselakh.local";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Reselakh — Bot Auto Order Telegram & WhatsApp",
    template: "%s · Reselakh",
  },
  description:
    "Platform sewa bot auto order Telegram & WhatsApp untuk produk digital. Kelola produk, stock, dan order otomatis 24/7.",
  applicationName: "Reselakh",
  keywords: [
    "bot auto order",
    "telegram bot",
    "whatsapp bot",
    "produk digital",
    "reseller",
  ],
  authors: [{ name: "Reselakh" }],
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: SITE_URL,
    siteName: "Reselakh",
    title: "Reselakh — Bot Auto Order Telegram & WhatsApp",
    description:
      "Platform sewa bot auto order Telegram & WhatsApp untuk produk digital.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reselakh — Bot Auto Order Telegram & WhatsApp",
    description:
      "Platform sewa bot auto order Telegram & WhatsApp untuk produk digital.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <LoadingScreen />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

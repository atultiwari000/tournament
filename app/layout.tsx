import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "./ClientLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Fursal - Premier Futsal Booking Platform",
    template: "%s | Fursal",
  },
  description: "Discover and book the best futsal grounds near you. Real-time availability, secure payments, and instant confirmation.",
  keywords: ["futsal", "booking", "football", "sports", "ground", "nepal", "kathmandu"],
  authors: [{ name: "Fursal Team" }],
  creator: "Fursal",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://fursal.com",
    title: "Fursal - Premier Futsal Booking Platform",
    description: "Discover and book the best futsal grounds near you.",
    siteName: "Fursal",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fursal - Premier Futsal Booking Platform",
    description: "Discover and book the best futsal grounds near you.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

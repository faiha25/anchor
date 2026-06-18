import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Anchor",
  description: "From a housing crisis to a clear first step.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style>{`
          .case-file { display: none; }
          @media print {
            .app-view { display: none !important; }
            .case-file { display: block !important; }
            @page { margin: 1.5cm; }
          }
        `}</style>
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
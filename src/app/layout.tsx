import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fuente incluida en el proyecto: la compilación no depende de Google Fonts.
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OmniScripts ISA",
  description: "Guiones de llamada para clínicas dentales — herramienta interna de Omni Dental",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full bg-surface font-sans">{children}</body>
    </html>
  );
}

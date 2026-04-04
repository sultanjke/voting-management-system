import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";

import { LanguageProvider } from "@/components/language-provider";
import "@/app/globals.css";

const ui = Noto_Sans({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-ui",
  display: "swap"
});

export const metadata: Metadata = {
  title: "anpz.me",
  description: "An application for managing resident surveys and voting in residential buildings."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="kk">
      <body className={ui.variable}>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./system.css";
import "./public-jobs.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kekgallerost.hu";

export const metadata: Metadata = {
  title: "Kekgallerost.hu",
  description: "Álláshirdetési és jelentkezéskezelő rendszer admin és partner felülettel.",
  metadataBase: new URL(siteUrl)
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="hu"><body>{children}</body></html>;
}

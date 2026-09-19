import type { Metadata } from "next";
import { Noto_Sans_Hebrew, Noto_Sans_Mono } from "next/font/google";
import "./globals.css";

/**
 * One family carries the UI: Noto Sans Hebrew at 400/450/500/600.
 * The mono face is reserved for the calendar gutter and fixed-width columns.
 *
 * The design system ships these as a Google Fonts @import and flags that as a
 * known gap; next/font self-hosts the same faces at build time, so the gap is
 * closed here rather than carried into production.
 */
const notoSansHebrew = Noto_Sans_Hebrew({
  variable: "--font-noto-hebrew",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const notoSansMono = Noto_Sans_Mono({
  variable: "--font-noto-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Demo Vet Clinic · דשבורד",
  description: "לוח בקרה לניהול קליניקת Demo Vet Clinic — תורים, שיחות תומר, אסקלציות ולקוחות.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${notoSansHebrew.variable} ${notoSansMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}

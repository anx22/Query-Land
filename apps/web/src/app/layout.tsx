import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuraSEO · Internal SEO OS",
  description: "Foundation for a first-party, source-anchored SEO operating system.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}

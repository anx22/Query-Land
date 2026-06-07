import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuraSEO · Internal SEO OS",
  description: "Foundation for a first-party, source-anchored SEO operating system.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <head>
        {/* Material Symbols Outlined — loaded at runtime via plain link (offline-safe build) */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { ReactNode } from "react";
import "./styles.css";

export const metadata = {
  title: "Internal SEO OS",
  description: "Foundation dashboard for project control, integrations, jobs and source maps."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}

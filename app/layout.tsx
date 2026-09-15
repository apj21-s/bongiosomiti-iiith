import type { Metadata } from "next";
import "./globals.css";
import ScrollReveal from "@/components/scroll-reveal";
import UtsavLoader from "@/components/utsav-loader";

export const metadata: Metadata = {
  title: "UTSAVPASS",
  description: "BONGIO.SOMITI cultural event website",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@500;700&family=Tiro+Bangla:ital@0;1&display=swap"
          rel="stylesheet"
        />
        <link rel="preload" as="image" href="/assets/autumn-landscape.webp" fetchPriority="high" />
      </head>
      <body>
        <UtsavLoader />
        <ScrollReveal />
        {children}
      </body>
    </html>
  );
}

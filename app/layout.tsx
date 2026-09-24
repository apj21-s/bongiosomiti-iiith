import type { Metadata } from "next";
import "./globals.css";
import ScrollReveal from "@/components/scroll-reveal";
import UtsavLoader from "@/components/utsav-loader";

export const metadata: Metadata = {
  title: "bangiya.samiti.iiith",
  description: "BANGIYA.SOMITI cultural event website",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
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

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
      <body>
        <UtsavLoader />
        <ScrollReveal />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import ScrollReveal from "@/components/scroll-reveal";
import SiteNotifications from "@/components/site-notifications";
import UtsavLoader from "@/components/utsav-loader";
import { getHomepagePlaylists } from "@/utils/data/site-playlist";
import HeroPlaylistMount from "@/components/hero-playlist-mount";

export const metadata: Metadata = {
  title: "বঙ্গীয় সমিতি @ IIITH",
  description: "আমরা বাঙালি জাতি",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const playlists = await getHomepagePlaylists();

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
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@500;700&family=Tiro+Bangla:ital@0;1&family=Playfair+Display:wght@700;900&display=swap"
          rel="stylesheet"
        />
        <link rel="preload" as="image" href="/assets/apu-durga-poster.webp" fetchPriority="high" />
      </head>
      <body>
        <UtsavLoader />
        {/* Mounted once so any screen can raise a message without the browser
            drawing it. Replaces alert/confirm/prompt. */}
        <SiteNotifications />
        <ScrollReveal />
        {children}
        {/* Public pages only - the mount keeps it off /admin. */}
        <HeroPlaylistMount playlists={playlists} />
      </body>
    </html>
  );
}

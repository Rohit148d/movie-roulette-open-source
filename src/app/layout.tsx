import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Movie Roulette — Let fate pick your next film",
  description:
    "A cinematic movie discovery engine. Set your mood, spin the reel, and find your next film with live TMDB data.",
  applicationName: "Movie Roulette",
  keywords: ["movies", "movie night", "film discovery", "TMDB", "random movie picker"],
  authors: [{ name: "Movie Roulette" }],
  openGraph: {
    title: "Movie Roulette — Let fate pick your next film",
    description:
      "Set the mood, spin the reel, and let fate program your next movie night.",
    type: "website",
    siteName: "Movie Roulette",
  },
  twitter: {
    card: "summary_large_image",
    title: "Movie Roulette",
    description: "Stop scrolling. Start watching.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#070709",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/PlayfairDisplay.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/DMSans.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

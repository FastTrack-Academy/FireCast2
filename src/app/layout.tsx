import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "FireCast — Wildfire intelligence",
  icons: { icon: "/favicon.svg" },
  description: "Explore historical wildfire boundaries, terrain and weather. Run the original Gaussian Hidden Markov Model directly in your browser.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

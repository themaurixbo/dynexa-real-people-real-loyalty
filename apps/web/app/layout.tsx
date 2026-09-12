import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "DYNEXA",
  description: "Real rewards for real, human-verified people.",
  icons: {
    icon: "/brand/dynexa-logo.png",
    apple: "/brand/dynexa-logo.png",
  },
  openGraph: {
    title: "DYNEXA",
    description: "Real rewards for real, human-verified people. No wallet setup, no seed phrase.",
    url: "https://realloyalty.dynexa.us",
    siteName: "DYNEXA",
    images: ["/brand/dynexa-logo.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div
          className="glow"
          style={{
            top: -160,
            right: -120,
            width: 480,
            height: 480,
            background: "radial-gradient(circle, rgba(209,140,255,0.24), transparent 70%)",
          }}
        />
        <div
          className="glow"
          style={{
            bottom: -180,
            left: -120,
            width: 460,
            height: 460,
            background: "radial-gradient(circle, rgba(255,47,224,0.18), transparent 70%)",
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

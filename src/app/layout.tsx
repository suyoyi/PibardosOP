import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/pwa-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Pibardos OP", template: "%s · Pibardos OP" },
  description: "Tu espacio personal para One Piece Card Game.",
  applicationName: "Pibardos OP",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pibardos OP",
  },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10141c",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#main-content">
          Saltar al contenido
        </a>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}

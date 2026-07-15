import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const siteUrl = "https://ia.anapaullerenas.com";
const siteTitle = "Anapau iA | Plataforma creativa con IA para emprendedoras";
const siteDescription =
  "Plataforma creativa con inteligencia artificial para emprendedoras y dueñas de marca: analiza anuncios y campañas de Meta, crea contenido y convierte datos en decisiones para crecer.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Anapau iA",
  title: {
    default: siteTitle,
    template: "%s | Anapau iA",
  },
  description: siteDescription,
  keywords: [
    "inteligencia artificial para emprendedoras",
    "IA para marcas",
    "análisis de anuncios",
    "análisis de campañas Meta",
    "creación de contenido con IA",
    "marketing para emprendedoras",
  ],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/brand/anapau-ai.png", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "/",
    siteName: "Anapau iA",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/brand/anapau-ai.png",
        width: 1254,
        height: 1254,
        alt: "Ana Pau: creatividad e inteligencia artificial para emprendedoras",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
    images: ["/brand/anapau-ai.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}

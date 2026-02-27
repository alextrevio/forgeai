import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://arya.ai";

export const metadata: Metadata = {
  title: {
    default: "Arya AI — Tu equipo de agentes AI para construir software",
    template: "%s | Arya AI",
  },
  description:
    "Describe lo que necesitas. Arya orquesta agentes especializados que planifican, codean, diseñan y deployean tu proyecto completo en minutos.",
  keywords: [
    "AI",
    "agentes AI",
    "desarrollo web",
    "generador de código",
    "SaaS",
    "landing page",
    "multi-agent",
    "Arya AI",
    "low-code",
    "full-stack",
  ],
  authors: [{ name: "Arya AI" }],
  creator: "Arya AI",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "es_LA",
    url: SITE_URL,
    siteName: "Arya AI",
    title: "Arya AI — Tu equipo de agentes AI para construir software",
    description:
      "Describe lo que necesitas. Arya orquesta agentes especializados que planifican, codean, diseñan y deployean tu proyecto completo en minutos.",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Arya AI — Multi-Agent Development Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arya AI — Tu equipo de agentes AI para construir software",
    description:
      "Describe lo que necesitas. Arya orquesta agentes especializados que planifican, codean, diseñan y deployean tu proyecto completo en minutos.",
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased selection:bg-purple-500/30">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

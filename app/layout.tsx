import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: { default: "CosmetWiki Admin", template: "%s · CosmetWiki Admin" },
  description: "Dashboard d'administration CosmetWiki.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F4F6FA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "neo-card-sm !rounded-2xl !bg-white !text-foreground !border-none",
            },
          }}
        />
      </body>
    </html>
  );
}

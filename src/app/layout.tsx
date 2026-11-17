import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";
import { BrandFooter } from "@/components/brand/brand-footer";
import { PwaRegister } from "@/components/pwa/pwa-register";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Task Manager",
  description: "Multi-tenant task management workspace",
  applicationName: "Task Manager",
  appleWebApp: { capable: true, title: "Task Manager", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0A84FF",
  width: "device-width",
  initialScale: 1,
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem('tm-theme') || 'blue';
    var mode = localStorage.getItem('tm-mode') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-mode', mode);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${publicSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-dvh flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">{children}</div>
        <BrandFooter />
        <PwaRegister />
      </body>
    </html>
  );
}

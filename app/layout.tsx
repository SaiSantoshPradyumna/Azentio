import type { Metadata } from "next";
import "../app/globals.css";
import { currentLocale, localeDir } from "@/lib/locale-server";

export const metadata: Metadata = {
  title: {
    default: "Azentio — Build Intelligence. Create Impact.",
    template: "%s | Azentio",
  },
  description:
    "Azentio builds intelligent decisioning for financial services, including Islamic financial institutions (AAOIFI, IFSB, IIFM aware).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = currentLocale();
  const dir = localeDir(locale);

  return (
    <html lang={locale} dir={dir}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}

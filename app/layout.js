import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "RemiderMe",
  description: "Simple money reminder with voice",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <meta name="theme-color" content="#0f172a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <Providers>
          <div className="app-wrapper">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { AppProvider } from '@/lib/state';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Воркбук — Искусство действия',
  description: 'Персональные упражнения по книге — сгенерированные AI под вашу конкретную ситуацию.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preload" href="/fonts/TT_Biersal_Trial_Italic.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}

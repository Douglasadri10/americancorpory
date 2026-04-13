import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: {
    default: 'HannaAI - Atendimento Omnichannel com IA',
    template: '%s | HannaAI',
  },
  description:
    'Plataforma de atendimento omnichannel com automação de IA para Instagram, Facebook e WhatsApp.',
  keywords: ['omnichannel', 'atendimento', 'IA', 'Instagram', 'WhatsApp', 'Facebook', 'automação'],
  authors: [{ name: 'HannaAI' }],
  robots: 'noindex, nofollow',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Apply saved theme before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('hanna-theme')||'dim';if(t==='dark'){document.documentElement.classList.add('dark')}else if(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-text-primary min-h-screen">
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}

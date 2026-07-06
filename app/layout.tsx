import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Pilates Teacher Finder — Sandra Leo Pilates Education',
  description:
    'Qualifizierte Pilates-Trainer in ganz Deutschland, geprüft von Sandra Leo.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={geist.className}>{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Pilates Teacher Finder — Sandra Leo Pilates Education',
  description:
    'Qualifizierte Pilates-Trainer in ganz Deutschland, geprüft von Sandra Leo.',
  icons: { icon: '/images/images.jpg' },
  openGraph: {
    title: 'Pilates Teacher Finder',
    description:
      'Qualifizierte Pilates-Trainer in ganz Deutschland, geprüft von Sandra Leo.',
    images: ['/images/image-1200x924.png'],
  },
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

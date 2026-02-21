import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'PDF救星 - 免費線上 PDF 處理工具',
    template: '%s | PDF救星',
  },
  description: '免費的線上 PDF 工具，支援合併、分割、壓縮、轉換 PDF。提供 PDF 轉 Word、OCR 文字辨識、電子簽名、浮水印等 20+ 種功能。無需下載軟體，完全在瀏覽器中處理。',
  keywords: [
    'PDF工具', 'PDF轉換', 'PDF合併', 'PDF分割', 'PDF壓縮',
    'PDF轉Word', 'PDF轉圖片', 'OCR文字辨識', '免費PDF工具',
    'PDF編輯器', '線上PDF', 'PDF處理', '電子簽名', 'PDF浮水印',
  ],
  authors: [{ name: 'PDF救星團隊' }],
  creator: 'PDF救星',
  publisher: 'PDF救星',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    url: '/',
    siteName: 'PDF救星',
    title: 'PDF救星 - 免費線上 PDF 處理工具',
    description: '免費的線上 PDF 工具，支援合併、分割、壓縮、轉換 PDF。提供 20+ 種功能，無需下載軟體。',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PDF救星 - 免費線上 PDF 處理工具',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PDF救星 - 免費線上 PDF 處理工具',
    description: '免費的線上 PDF 工具，支援合併、分割、壓縮、轉換 PDF。提供 20+ 種功能。',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PDF救星',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { url: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  category: 'technology',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ef4444' },
    { media: '(prefers-color-scheme: dark)', color: '#1f2937' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}

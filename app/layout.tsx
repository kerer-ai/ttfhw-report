import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Build Verification Dashboard',
  description: 'TTFHW Build Verification Results Visualization',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}

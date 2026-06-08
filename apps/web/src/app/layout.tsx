import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Starrail Canvas - AI Creative Canvas',
  description: 'AI-native creative canvas for storytelling, scripting, and visual creation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, background: '#0A0A1A', color: '#E0E0E0' }}>
        {children}
      </body>
    </html>
  )
}

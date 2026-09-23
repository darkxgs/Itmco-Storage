import type React from "react"
import type { Metadata, Viewport } from "next"
import { Cairo } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"

// Arabic + Latin glyphs (Inter had no Arabic, so all Arabic text fell back to the system font)
const cairo = Cairo({ subsets: ["arabic", "latin"], display: "swap" })

export const metadata: Metadata = {
  title: "ITMCO - نظام إدارة المخزون",
  description: "نظام إدارة المخزون لشركة ITMCO",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#020617",
  colorScheme: "dark",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={cairo.className}>
        {/* The pages are designed for the dark theme only */}
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" disableTransitionOnChange>
          <div className="page-container auto-zoom-container">
            {children}
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

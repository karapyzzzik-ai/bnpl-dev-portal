import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
import '../globals.css'

export const metadata = {
  title: 'bnpl developers'
}

const navbar = <Navbar logo={<b>bnpl developers</b>} />
const footer = <Footer>{new Date().getFullYear()} © bnpl.kz</Footer>

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  return (
    <html lang={lang} dir="ltr" suppressHydrationWarning>
      {/* bnpl real brand accent (~#1F9E5A, from the merchant cabinet UI) — see app/globals.css for --bnpl-accent */}
      <Head color={{ hue: 148, saturation: 67, lightness: 37 }} />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap(`/${lang}`)}
          footer={footer}
          docsRepositoryBase="https://github.com/karapyzzzik-ai/bnpl-dev-portal"
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}

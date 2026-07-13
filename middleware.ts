import { NextRequest, NextResponse } from 'next/server'

const SUPPORTED_LOCALES = ['ru', 'en']
const DEFAULT_LOCALE = 'ru'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasLocale = SUPPORTED_LOCALES.some(
    locale => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  )
  if (hasLocale) {
    return NextResponse.next()
  }
  const url = request.nextUrl.clone()
  url.pathname = `/${DEFAULT_LOCALE}${pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)']
}

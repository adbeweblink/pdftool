import { getRequestConfig } from 'next-intl/server'

export const locales = ['zh-TW', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'zh-TW'

export default getRequestConfig(async ({ requestLocale }) => {
  // 使用 next-intl 提供的 requestLocale，避免直接使用 next/headers
  let locale = await requestLocale

  // 驗證 locale 是否有效
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  }
})

'use client'

import { useTransition } from 'react'
import { Globe } from 'lucide-react'
import { locales, type Locale } from '@/i18n'

const languageNames: Record<Locale, string> = {
  'zh-TW': '繁體中文',
  'en': 'English',
}

export default function LanguageSwitcher() {
  const [isPending, startTransition] = useTransition()

  const changeLocale = (newLocale: Locale) => {
    startTransition(() => {
      // 設定 cookie（使用 NEXT_LOCALE，這是 next-intl 的預設 cookie 名稱）
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`
      // 重新載入頁面以套用新語言
      window.location.reload()
    })
  }

  // 取得當前語言
  const getCurrentLocale = (): Locale => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/)
      if (match && locales.includes(match[1] as Locale)) {
        return match[1] as Locale
      }
    }
    return 'zh-TW'
  }

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-1.5 px-3 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        disabled={isPending}
      >
        <Globe className="w-4 h-4" />
        <span className="text-sm hidden sm:inline">
          {languageNames[getCurrentLocale()]}
        </span>
      </button>

      {/* 下拉選單 */}
      <div className="absolute right-0 top-full mt-1 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 min-w-[120px] z-50">
        {locales.map((locale) => (
          <button
            key={locale}
            onClick={() => changeLocale(locale)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            disabled={isPending}
          >
            {languageNames[locale]}
          </button>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'

const API_KEY_STORAGE_KEY = 'pdftool_gemini_api_key'

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string>('')
  const [isLoaded, setIsLoaded] = useState(false)

  // 從 localStorage 載入 API Key
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(API_KEY_STORAGE_KEY)
      if (stored) {
        setApiKeyState(stored)
      }
      setIsLoaded(true)
    }
  }, [])

  // 儲存 API Key
  const setApiKey = useCallback((key: string) => {
    if (typeof window !== 'undefined') {
      if (key) {
        localStorage.setItem(API_KEY_STORAGE_KEY, key)
      } else {
        localStorage.removeItem(API_KEY_STORAGE_KEY)
      }
      setApiKeyState(key)
    }
  }, [])

  // 清除 API Key
  const clearApiKey = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(API_KEY_STORAGE_KEY)
      setApiKeyState('')
    }
  }, [])

  // 檢查是否有設定 API Key
  const hasApiKey = Boolean(apiKey)

  return {
    apiKey,
    setApiKey,
    clearApiKey,
    hasApiKey,
    isLoaded,
  }
}

// 直接取得 API Key（非 hook 版本，用於 API 函數）
export function getStoredApiKey(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || ''
  }
  return ''
}

/**
 * 使用統計追蹤系統
 *
 * 追蹤功能：
 * - 頁面瀏覽 (page_view)
 * - 工具使用 (tool_use)
 * - 檔案上傳 (file_upload)
 * - 錯誤事件 (error)
 * - 自定義事件 (custom)
 */

export type EventType =
  | 'page_view'
  | 'tool_use'
  | 'file_upload'
  | 'workflow_run'
  | 'download'
  | 'error'
  | 'click'
  | 'search'

export interface AnalyticsEvent {
  type: EventType
  name: string
  data?: Record<string, unknown>
  timestamp: number
  sessionId: string
  page: string
}

// 生成 Session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  let sessionId = sessionStorage.getItem('analytics_session_id')
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('analytics_session_id', sessionId)
  }
  return sessionId
}

// 事件佇列（批次發送）
let eventQueue: AnalyticsEvent[] = []
let flushTimeout: ReturnType<typeof setTimeout> | null = null

// 追蹤事件
export function trackEvent(
  type: EventType,
  name: string,
  data?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return

  const event: AnalyticsEvent = {
    type,
    name,
    data,
    timestamp: Date.now(),
    sessionId: getSessionId(),
    page: window.location.pathname,
  }

  eventQueue.push(event)

  // 儲存到 localStorage（離線支援）
  try {
    const stored = JSON.parse(localStorage.getItem('analytics_events') || '[]')
    stored.push(event)
    // 最多保留 100 筆
    if (stored.length > 100) {
      stored.splice(0, stored.length - 100)
    }
    localStorage.setItem('analytics_events', JSON.stringify(stored))
  } catch {
    // 忽略儲存錯誤
  }

  // 延遲批次發送
  if (!flushTimeout) {
    flushTimeout = setTimeout(flushEvents, 5000)
  }

  // 開發模式下輸出到 console
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Analytics:', event)
  }
}

// 發送事件到後端
async function flushEvents(): Promise<void> {
  flushTimeout = null

  if (eventQueue.length === 0) return

  const events = [...eventQueue]
  eventQueue = []

  try {
    // 這裡可以發送到你的分析 API
    // await fetch('/api/analytics', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ events }),
    // })

    // 清除已發送的本地事件
    localStorage.removeItem('analytics_events')
  } catch {
    // 發送失敗，重新加入佇列
    eventQueue = [...events, ...eventQueue]
  }
}

// 便捷方法
export const analytics = {
  // 追蹤頁面瀏覽
  pageView: (pageName: string, data?: Record<string, unknown>) => {
    trackEvent('page_view', pageName, data)
  },

  // 追蹤工具使用
  toolUse: (toolId: string, action: string, data?: Record<string, unknown>) => {
    trackEvent('tool_use', `${toolId}:${action}`, data)
  },

  // 追蹤檔案上傳
  fileUpload: (fileType: string, fileSize: number) => {
    trackEvent('file_upload', fileType, { size: fileSize })
  },

  // 追蹤工作流執行
  workflowRun: (workflowId: string, nodeCount: number) => {
    trackEvent('workflow_run', workflowId, { nodeCount })
  },

  // 追蹤下載
  download: (fileName: string, fileType: string) => {
    trackEvent('download', fileName, { type: fileType })
  },

  // 追蹤錯誤
  error: (errorName: string, errorMessage: string, stack?: string) => {
    trackEvent('error', errorName, { message: errorMessage, stack })
  },

  // 追蹤點擊
  click: (elementName: string, data?: Record<string, unknown>) => {
    trackEvent('click', elementName, data)
  },

  // 追蹤搜尋
  search: (query: string, resultCount: number) => {
    trackEvent('search', query, { resultCount })
  },
}

// 取得統計摘要
export function getAnalyticsSummary(): {
  totalEvents: number
  sessionId: string
  events: AnalyticsEvent[]
} {
  if (typeof window === 'undefined') {
    return { totalEvents: 0, sessionId: '', events: [] }
  }

  const events = JSON.parse(localStorage.getItem('analytics_events') || '[]')
  return {
    totalEvents: events.length,
    sessionId: getSessionId(),
    events,
  }
}

// 清除本地統計資料
export function clearAnalytics(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('analytics_events')
  sessionStorage.removeItem('analytics_session_id')
}

export default analytics

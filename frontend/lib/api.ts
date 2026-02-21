import { getStoredApiKey } from '@/hooks/useApiKey'

// API 基礎設定
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// 通用 API 請求
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '請求失敗' }))
    throw new Error(error.detail || '請求失敗')
  }

  return response
}

// ============ 基礎操作 ============

export async function mergePDFs(files: File[]): Promise<Blob> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))

  const response = await apiRequest('/api/basic/merge', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function splitPDF(
  file: File,
  pages: string
): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('pages', pages)

  const response = await apiRequest('/api/basic/split', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function rotatePDF(
  file: File,
  pages: string,
  angle: number
): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('pages', pages)
  formData.append('angle', angle.toString())

  const response = await apiRequest('/api/basic/rotate', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function deletePages(
  file: File,
  pages: string
): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('pages', pages)

  const response = await apiRequest('/api/basic/delete-pages', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function compressPDF(
  file: File,
  quality: string = 'medium'
): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('quality', quality)

  const response = await apiRequest('/api/basic/compress', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

// ============ 格式轉換 ============

export async function pdfToWord(file: File): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiRequest('/api/convert/pdf-to-word', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function wordToPDF(file: File): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiRequest('/api/convert/word-to-pdf', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function pdfToImages(
  file: File,
  format: string = 'png',
  dpi: number = 150
): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('format', format)
  formData.append('dpi', dpi.toString())

  const response = await apiRequest('/api/convert/pdf-to-images', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function imagesToPDF(files: File[]): Promise<Blob> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))

  const response = await apiRequest('/api/convert/images-to-pdf', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

// ============ OCR ============

export async function ocrPDF(
  file: File,
  lang: string = 'ch'
): Promise<any> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('lang', lang)

  const response = await apiRequest('/api/ocr/extract-text', {
    method: 'POST',
    body: formData,
  })

  return response.json()
}

export async function makeSearchablePDF(
  file: File,
  lang: string = 'ch'
): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('lang', lang)

  const response = await apiRequest('/api/ocr/make-searchable', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

// ============ 安全性 ============

export async function encryptPDF(
  file: File,
  userPassword: string,
  ownerPassword?: string
): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('user_password', userPassword)
  if (ownerPassword) {
    formData.append('owner_password', ownerPassword)
  }

  const response = await apiRequest('/api/security/encrypt', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function decryptPDF(
  file: File,
  password: string
): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('password', password)

  const response = await apiRequest('/api/security/decrypt', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function addTextWatermark(
  file: File,
  text: string,
  opacity: number = 0.3,
  angle: number = 45,
  color: string = '#000000'
): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('text', text)
  formData.append('opacity', opacity.toString())
  formData.append('angle', angle.toString())
  formData.append('color', color)

  const response = await apiRequest('/api/security/add-watermark', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

// ============ 簽名 ============

export async function addSignature(
  file: File,
  signatureFile: File,
  page: number,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('signature', signatureFile)
  formData.append('page', page.toString())
  formData.append('x', x.toString())
  formData.append('y', y.toString())
  formData.append('width', width.toString())
  formData.append('height', height.toString())

  const response = await apiRequest('/api/sign/add-signature', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

// ============ 進階功能 ============

export async function convertToPDFA(
  file: File,
  version: string = '2b'
): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('pdfa_version', version)

  const response = await apiRequest('/api/advanced/convert-to-pdfa', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function comparePDFs(files: File[]): Promise<any> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))

  const response = await apiRequest('/api/advanced/compare', {
    method: 'POST',
    body: formData,
  })

  return response.json()
}

export async function addBatesNumbering(
  file: File,
  prefix: string,
  startNumber: number,
  digits: number
): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('prefix', prefix)
  formData.append('start_number', startNumber.toString())
  formData.append('digits', digits.toString())

  const response = await apiRequest('/api/advanced/bates-numbering', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function addHeaderFooter(
  file: File,
  options: {
    headerLeft?: string
    headerCenter?: string
    headerRight?: string
    footerLeft?: string
    footerCenter?: string
    footerRight?: string
    includePageNumber?: boolean
  }
): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)

  if (options.headerLeft) formData.append('header_left', options.headerLeft)
  if (options.headerCenter) formData.append('header_center', options.headerCenter)
  if (options.headerRight) formData.append('header_right', options.headerRight)
  if (options.footerLeft) formData.append('footer_left', options.footerLeft)
  if (options.footerCenter) formData.append('footer_center', options.footerCenter)
  if (options.footerRight) formData.append('footer_right', options.footerRight)
  formData.append('include_page_number', String(options.includePageNumber ?? true))

  const response = await apiRequest('/api/advanced/header-footer', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

// ============ AI 助手 ============

// 檢查 API Key 是否已設定
export function checkApiKey(): boolean {
  const apiKey = getStoredApiKey()
  return Boolean(apiKey)
}

// 取得 API Key 錯誤訊息
export function getApiKeyError(): string {
  return '請先設定 Gemini API Key。點擊右上角的設定圖示進行設定。'
}

export async function aiAnalyze(
  file: File,
  question: string
): Promise<{ answer: string; pages_analyzed: number }> {
  const apiKey = getStoredApiKey()
  if (!apiKey) {
    throw new Error(getApiKeyError())
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('question', question)
  formData.append('api_key', apiKey)

  const response = await apiRequest('/api/ai/analyze', {
    method: 'POST',
    body: formData,
  })

  return response.json()
}

export async function aiSummarize(
  file: File,
  maxLength: number = 500
): Promise<{ summary: string; word_count: number }> {
  const apiKey = getStoredApiKey()
  if (!apiKey) {
    throw new Error(getApiKeyError())
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('max_length', maxLength.toString())
  formData.append('api_key', apiKey)

  const response = await apiRequest('/api/ai/summarize', {
    method: 'POST',
    body: formData,
  })

  return response.json()
}

export async function aiTranslate(
  file: File,
  targetLang: string = 'en'
): Promise<{ translated_text: string; source_lang: string }> {
  const apiKey = getStoredApiKey()
  if (!apiKey) {
    throw new Error(getApiKeyError())
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('target_lang', targetLang)
  formData.append('api_key', apiKey)

  const response = await apiRequest('/api/ai/translate', {
    method: 'POST',
    body: formData,
  })

  return response.json()
}

export async function aiChat(
  file: File,
  message: string,
  history: Array<{ role: string; content: string }> = []
): Promise<{ response: string }> {
  const apiKey = getStoredApiKey()
  if (!apiKey) {
    throw new Error(getApiKeyError())
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('message', message)
  formData.append('history', JSON.stringify(history))
  formData.append('api_key', apiKey)

  const response = await apiRequest('/api/ai/chat', {
    method: 'POST',
    body: formData,
  })

  return response.json()
}

// ============ 批次處理 ============

export async function batchCompress(
  files: File[],
  quality: string = 'medium'
): Promise<Blob> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('quality', quality)

  const response = await apiRequest('/api/batch/compress', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function batchWatermark(
  files: File[],
  text: string,
  opacity: number = 0.3
): Promise<Blob> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('text', text)
  formData.append('opacity', opacity.toString())

  const response = await apiRequest('/api/batch/watermark', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function batchMergeAll(files: File[]): Promise<Blob> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))

  const response = await apiRequest('/api/batch/merge-all', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

// ============ 多媒體嵌入 ============

export async function embedVideo(
  pdfFile: File,
  videoFile: File,
  page: number = 1,
  x: number = 100,
  y: number = 100,
  width: number = 400,
  height: number = 300
): Promise<Blob> {
  const formData = new FormData()
  formData.append('pdf_file', pdfFile)
  formData.append('video_file', videoFile)
  formData.append('page', page.toString())
  formData.append('x', x.toString())
  formData.append('y', y.toString())
  formData.append('width', width.toString())
  formData.append('height', height.toString())

  const response = await apiRequest('/api/multimedia/embed-video', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function embedAudio(
  pdfFile: File,
  audioFile: File,
  page: number = 1,
  x: number = 100,
  y: number = 100
): Promise<Blob> {
  const formData = new FormData()
  formData.append('pdf_file', pdfFile)
  formData.append('audio_file', audioFile)
  formData.append('page', page.toString())
  formData.append('x', x.toString())
  formData.append('y', y.toString())

  const response = await apiRequest('/api/multimedia/embed-audio', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function embedYoutube(
  pdfFile: File,
  youtubeUrl: string,
  page: number = 1,
  x: number = 100,
  y: number = 100,
  width: number = 400,
  height: number = 300
): Promise<Blob> {
  const formData = new FormData()
  formData.append('pdf_file', pdfFile)
  formData.append('youtube_url', youtubeUrl)
  formData.append('page', page.toString())
  formData.append('x', x.toString())
  formData.append('y', y.toString())
  formData.append('width', width.toString())
  formData.append('height', height.toString())

  const response = await apiRequest('/api/multimedia/embed-youtube', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

export async function embedAttachments(
  pdfFile: File,
  attachments: File[]
): Promise<Blob> {
  const formData = new FormData()
  formData.append('pdf_file', pdfFile)
  attachments.forEach(file => formData.append('attachments', file))

  const response = await apiRequest('/api/multimedia/embed-attachments', {
    method: 'POST',
    body: formData,
  })

  return response.blob()
}

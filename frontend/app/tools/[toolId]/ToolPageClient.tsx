'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Upload, Download, ArrowLeft, X, CheckCircle, Loader2, AlertCircle, HelpCircle, Key, ExternalLink } from 'lucide-react'
import { SortableFileList, PDFThumbnail, ProgressBar, FileItem as SortableFileItem } from '@/components/pdf'
import { useToast } from '@/components/ui/Toast'
import { toolConfig } from './toolConfig'
import NavBar from '@/components/NavBar'

// 檔案大小限制（50MB）
const MAX_FILE_SIZE = 50 * 1024 * 1024

// 友善的錯誤訊息對照
const ERROR_MESSAGES: Record<string, string> = {
  'Failed to fetch': '無法連接到伺服器，請確認後端服務是否已啟動',
  'Network Error': '網路連線失敗，請檢查網路狀態',
  '413': '檔案太大，請選擇較小的檔案（上限 50MB）',
  '415': '不支援的檔案格式，請確認檔案類型',
  '422': '檔案格式無法處理，請確認檔案是否損壞',
  '429': 'AI 服務暫時繁忙，請稍等幾分鐘後再試',
  '500': '伺服器發生錯誤，請稍後再試',
  '503': '服務暫時無法使用，請稍後再試',
}

type ProcessStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

interface FileItem {
  id: string
  file: File
  name: string
  size: number
  status: ProcessStatus
  progress: number
  downloadUrl?: string
  error?: string
}

interface ToolPageClientProps {
  toolId: string
}

export default function ToolPageClient({ toolId }: ToolPageClientProps) {
  const tool = toolConfig[toolId]

  const [files, setFiles] = useState<FileItem[]>([])
  const [options, setOptions] = useState<Record<string, any>>({})
  const [globalStatus, setGlobalStatus] = useState<ProcessStatus>('idle')
  const [globalProgress, setGlobalProgress] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()

  // 從 localStorage 讀取 API Key
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key')
    if (savedKey) {
      setApiKey(savedKey)
    }
  }, [])

  // 儲存 API Key 到 localStorage
  const saveApiKey = (key: string) => {
    setApiKey(key)
    if (key) {
      localStorage.setItem('gemini_api_key', key)
    }
  }

  // 初始化選項預設值
  useEffect(() => {
    if (tool?.options) {
      const defaults: Record<string, any> = {}
      tool.options.forEach(opt => {
        defaults[opt.id] = opt.default
      })
      setOptions(defaults)
    }
  }, [tool])

  // 新增檔案（含驗證）
  const addFiles = useCallback((newFiles: File[]) => {
    if (!tool) return

    const validFiles: File[] = []
    const errors: string[] = []

    // 取得允許的副檔名
    const allowedExts = tool.acceptFiles.split(',').map(ext => ext.trim().toLowerCase())

    newFiles.forEach(file => {
      // 檢查檔案大小
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`「${file.name}」檔案太大（上限 50MB）`)
        return
      }

      // 檢查檔案類型
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      const isValidType = allowedExts.some(allowed =>
        allowed === ext ||
        allowed === '.*' ||
        (allowed === '.pdf' && file.type === 'application/pdf') ||
        (allowed.includes('image') && file.type.startsWith('image/'))
      )

      if (!isValidType) {
        errors.push(`「${file.name}」格式不支援（僅支援 ${tool.acceptFiles}）`)
        return
      }

      validFiles.push(file)
    })

    // 顯示錯誤訊息
    if (errors.length > 0) {
      addToast({
        type: 'warning',
        title: '部分檔案無法加入',
        message: errors.slice(0, 3).join('、') + (errors.length > 3 ? `...等 ${errors.length} 個問題` : ''),
        duration: 6000,
      })
    }

    if (validFiles.length === 0) return

    const fileItems: FileItem[] = validFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      status: 'idle',
      progress: 0,
    }))

    if (tool.multiple) {
      setFiles(prev => [...prev, ...fileItems])
      addToast({
        type: 'success',
        title: `已加入 ${validFiles.length} 個檔案`,
        duration: 2000,
      })
    } else {
      setFiles(fileItems.slice(0, 1))
    }
  }, [tool, addToast])

  // 處理檔案拖放
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }, [addFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  // 處理檔案選擇
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
  }

  // 移除檔案
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  // 重新排序檔案
  const reorderFiles = (newItems: SortableFileItem[]) => {
    setFiles(prev => {
      const newFiles: FileItem[] = []
      newItems.forEach(item => {
        const existing = prev.find(f => f.id === item.id)
        if (existing) {
          newFiles.push(existing)
        }
      })
      return newFiles
    })
  }

  // 格式化檔案大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  // 處理檔案
  const processFiles = async () => {
    if (files.length === 0) return

    // 檢查是否需要 API Key
    if (tool.requiresApiKey && !apiKey) {
      addToast({
        type: 'error',
        title: '需要 API Key',
        message: '請輸入您的 Gemini API Key 才能使用此功能',
        duration: 5000,
      })
      return
    }

    setGlobalStatus('uploading')
    setGlobalProgress(10)

    const formData = new FormData()

    // 添加檔案
    if (tool.multiple) {
      files.forEach(f => formData.append('files', f.file))
    } else {
      formData.append('file', files[0].file)
    }

    // 添加 API Key（如果需要）
    if (tool.requiresApiKey && apiKey) {
      formData.append('api_key', apiKey)
    }

    // 添加選項
    Object.entries(options).forEach(([key, value]) => {
      formData.append(key, String(value))
    })

    try {
      setGlobalStatus('processing')
      setGlobalProgress(30)
      setFiles(prev => prev.map(f => ({ ...f, status: 'processing', progress: 50 })))

      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
      const response = await fetch(`${apiBase}${tool.apiEndpoint}`, {
        method: 'POST',
        body: formData,
      })

      setGlobalProgress(70)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || '處理失敗，請稍後再試')
      }

      setGlobalProgress(90)

      // 處理回應
      const contentType = response.headers.get('content-type')

      if (contentType?.includes('application/json')) {
        const data = await response.json()
        setFiles(prev => prev.map(f => ({
          ...f,
          status: 'done',
          progress: 100,
          downloadUrl: data.download_url || data.result,
        })))
      } else {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)

        const disposition = response.headers.get('content-disposition')
        let filename = 'output.pdf'
        if (disposition) {
          const match = disposition.match(/filename[^;=\n]*=["']?([^"';\n]*)["']?/)
          if (match) filename = decodeURIComponent(match[1])
        }

        setFiles(prev => prev.map(f => ({
          ...f,
          status: 'done',
          progress: 100,
          downloadUrl: url,
          name: filename,
        })))
      }

      setGlobalProgress(100)
      setGlobalStatus('done')
      addToast({
        type: 'success',
        title: '處理完成！',
        message: '檔案已準備好下載',
        duration: 4000,
      })
    } catch (error: unknown) {
      console.error('處理錯誤:', error)

      // 解析友善錯誤訊息
      const err = error as { message?: string; status?: number }
      let friendlyMessage = err.message || '處理失敗'

      // 檢查是否有對應的友善訊息
      for (const [key, msg] of Object.entries(ERROR_MESSAGES)) {
        if (err.message?.includes(key) || String(err.status) === key) {
          friendlyMessage = msg
          break
        }
      }

      setFiles(prev => prev.map(f => ({
        ...f,
        status: 'error',
        error: friendlyMessage,
      })))
      setGlobalStatus('error')

      addToast({
        type: 'error',
        title: '處理失敗',
        message: friendlyMessage,
        duration: 6000,
      })
    }
  }

  // 下載檔案
  const downloadFile = (fileItem: FileItem) => {
    if (!fileItem.downloadUrl) return

    const a = document.createElement('a')
    a.href = fileItem.downloadUrl
    a.download = fileItem.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // 重置
  const reset = () => {
    setFiles([])
    setGlobalStatus('idle')
    setGlobalProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 工具不存在
  if (!tool) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">工具不存在</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">找不到此工具，請返回首頁</p>
          <Link href="/" className="text-pdf-red hover:underline">返回首頁</Link>
        </div>
      </div>
    )
  }

  const Icon = tool.icon
  const sortableItems = files.map(f => ({ id: f.id, file: f.file, name: f.name, size: f.size }))

  return (
    <>
      <NavBar />
      <div className="min-h-screen pt-20 sm:pt-24 pb-4 sm:pb-8 px-3 sm:px-4 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">

        {/* 工具標題 */}
        <div className="text-center mb-6 sm:mb-8">
          <div className={`w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br ${tool.color} rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg`}>
            <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">{tool.name}</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 px-4">{tool.desc}</p>
        </div>

        {/* 操作說明 */}
        {tool.instructions && tool.instructions.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-medium text-blue-900 dark:text-blue-100 text-sm sm:text-base">操作說明</h3>
            </div>
            <ol className="space-y-1.5 sm:space-y-2">
              {tool.instructions.map((instruction, index) => (
                <li key={index} className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-blue-800 dark:text-blue-200">
                  <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-full flex items-center justify-center font-medium text-[10px] sm:text-xs">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{instruction}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 主要內容區 */}
        {globalStatus === 'idle' && (
          <>
            {/* 上傳區 */}
            <div
              className={`relative border-2 border-dashed rounded-lg sm:rounded-xl p-6 sm:p-8 text-center transition-all cursor-pointer mb-4 sm:mb-6 ${
                isDragOver
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-700'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={tool.acceptFiles}
                multiple={tool.multiple}
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className={`w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br ${tool.color} rounded-full flex items-center justify-center mb-3 sm:mb-4 mx-auto shadow-lg transition-transform ${isDragOver ? 'scale-110' : ''}`}>
                <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <p className="text-base sm:text-lg font-medium text-gray-700 dark:text-gray-200 mb-1">
                <span className="hidden sm:inline">拖放檔案到這裡，或</span>點擊選擇檔案
              </p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                支援: {tool.acceptFiles}
                {tool.multiple && ' (可多選)'}
              </p>
            </div>

            {/* 已選檔案列表（可拖拉排序） */}
            {files.length > 0 && tool.multiple && (
              <div className="mb-6">
                <SortableFileList
                  items={sortableItems}
                  onReorder={reorderFiles}
                  onRemove={removeFile}
                  showPreview={true}
                />
              </div>
            )}

            {/* 單檔案顯示（含預覽） */}
            {files.length === 1 && !tool.multiple && (
              <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  {files[0].file.type === 'application/pdf' && (
                    <div className="hidden sm:block">
                      <PDFThumbnail file={files[0].file} width={80} height={100} />
                    </div>
                  )}
                  <div className="flex-grow min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate text-sm sm:text-base">{files[0].name}</p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{formatSize(files[0].size)}</p>
                  </div>
                  <button
                    onClick={() => removeFile(files[0].id)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 rounded-lg transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            )}

            {/* API Key 輸入（BYOK） */}
            {tool.requiresApiKey && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <Key className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-medium text-indigo-900 dark:text-indigo-100 text-sm sm:text-base">Gemini API Key</h3>
                  <span className="text-xs bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">必填</span>
                </div>
                <div className="space-y-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => saveApiKey(e.target.value)}
                    placeholder="輸入您的 Gemini API Key"
                    className="w-full px-3 py-2.5 sm:py-2 border border-indigo-300 dark:border-indigo-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                    <span>🔒 您的 API Key 僅儲存在瀏覽器本地，不會上傳到伺服器</span>
                  </p>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    免費取得 Gemini API Key
                  </a>
                </div>
              </div>
            )}

            {/* 選項 */}
            {tool.options && tool.options.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4 sm:mb-6">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">設定選項</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {tool.options.map(opt => (
                    <div key={opt.id}>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {opt.label}
                      </label>
                      {opt.type === 'select' && (
                        <select
                          value={options[opt.id] || opt.default}
                          onChange={e => setOptions(prev => ({ ...prev, [opt.id]: e.target.value }))}
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          {opt.options?.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      )}
                      {opt.type === 'text' && (
                        <input
                          type="text"
                          value={options[opt.id] || ''}
                          onChange={e => setOptions(prev => ({ ...prev, [opt.id]: e.target.value }))}
                          placeholder={String(opt.default)}
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                        />
                      )}
                      {opt.type === 'number' && (
                        <input
                          type="number"
                          value={options[opt.id] || opt.default}
                          onChange={e => setOptions(prev => ({ ...prev, [opt.id]: Number(e.target.value) }))}
                          min={opt.min}
                          max={opt.max}
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      )}
                      {opt.type === 'checkbox' && (
                        <label className="flex items-center gap-2 cursor-pointer py-1">
                          <input
                            type="checkbox"
                            checked={options[opt.id] ?? opt.default}
                            onChange={e => setOptions(prev => ({ ...prev, [opt.id]: e.target.checked }))}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-gray-600 dark:text-gray-400 text-sm">啟用</span>
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 處理按鈕 */}
            {files.length > 0 && (
              <button
                onClick={processFiles}
                disabled={tool.requiresApiKey && !apiKey}
                className={`w-full bg-gradient-to-r ${tool.color} text-white py-3.5 sm:py-4 rounded-lg sm:rounded-xl font-semibold transition-all shadow-lg flex items-center justify-center gap-2 text-base sm:text-lg ${
                  tool.requiresApiKey && !apiKey
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:opacity-90 active:opacity-80 hover:shadow-xl'
                }`}
              >
                {tool.requiresApiKey && !apiKey ? '請先輸入 API Key' : '開始處理'}
                <ArrowLeft className="w-5 h-5 rotate-180" />
              </button>
            )}
          </>
        )}

        {/* 處理中 */}
        {(globalStatus === 'uploading' || globalStatus === 'processing') && (
          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
            <div className="text-center mb-4 sm:mb-6">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br ${tool.color} rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4`}>
                <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-white animate-spin" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
                {globalStatus === 'uploading' ? '上傳中...' : '處理中...'}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">請稍候，正在處理您的檔案</p>
            </div>
            <ProgressBar progress={globalProgress} status={globalStatus} />
          </div>
        )}

        {/* 完成 */}
        {globalStatus === 'done' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-8">
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg">
                <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">處理完成！</h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">您的檔案已準備好下載</p>
            </div>

            <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              {files.map(file => (
                <div key={file.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-green-50 dark:bg-green-900/20 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-green-200 dark:border-green-800 gap-2 sm:gap-0">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">{file.name}</span>
                  </div>
                  <button
                    onClick={() => downloadFile(file)}
                    className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors shadow-md w-full sm:w-auto text-sm sm:text-base"
                  >
                    <Download className="w-4 h-4" />
                    下載檔案
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={reset}
              className="w-full border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-lg sm:rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              處理另一個檔案
            </button>
          </div>
        )}

        {/* 錯誤 */}
        {globalStatus === 'error' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl border border-red-200 dark:border-red-800 p-5 sm:p-8 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg">
              <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">處理失敗</h3>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 px-2">
              {files[0]?.error || '處理過程中發生錯誤，請重試'}
            </p>
            <button
              onClick={reset}
              className={`bg-gradient-to-r ${tool.color} text-white px-6 py-3 rounded-lg sm:rounded-xl font-semibold hover:opacity-90 active:opacity-80 transition-all shadow-lg w-full sm:w-auto text-sm sm:text-base`}
            >
              重新嘗試
            </button>
          </div>
        )}
        </div>
      </div>
    </>
  )
}

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Send, Loader2, FileText, X, Bot, User } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AIChatPage() {
  const [file, setFile] = useState<File | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      setFile(droppedFiles[0])
      setMessages([])
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) {
      setFile(selectedFiles[0])
      setMessages([])
    }
  }, [])

  const handleSend = async () => {
    if (!file || !input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      // 建立包含當前訊息的對話紀錄
      const chatMessages = [...messages, { role: 'user', content: userMessage }]

      const formData = new FormData()
      formData.append('file', file)
      formData.append('messages', JSON.stringify(chatMessages))

      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        // 顯示更具體的錯誤訊息
        const errorMsg = data.detail || 'AI 回應失敗'
        throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg))
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知錯誤'

      // 友善的錯誤訊息處理
      let friendlyMessage = ''

      if (errorMsg.includes('GEMINI_API_KEY')) {
        friendlyMessage = '⚠️ AI 功能尚未啟用。\n\n管理員需要設定 GEMINI_API_KEY 環境變數。\n\n取得方式：https://aistudio.google.com/app/apikey'
      } else if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('exhausted')) {
        friendlyMessage = '⏳ AI 服務暫時繁忙\n\nGemini API 的請求額度已用完或請求太頻繁。\n\n請稍等幾分鐘後再試一次。'
      } else if (errorMsg.includes('401') || errorMsg.includes('UNAUTHENTICATED')) {
        friendlyMessage = '🔑 API 金鑰無效\n\n請聯繫管理員檢查 GEMINI_API_KEY 設定。'
      } else if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
        friendlyMessage = '🌐 網路連線失敗\n\n請檢查您的網路連線後再試一次。'
      } else {
        friendlyMessage = '抱歉，發生錯誤。請稍後再試。'
      }

      setMessages(prev => [...prev, { role: 'assistant', content: friendlyMessage }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8">
          <ArrowLeft className="w-4 h-4" />
          返回所有工具
        </Link>

        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white">
            <Bot className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">AI PDF 助手</h1>
          <p className="text-gray-600">上傳 PDF 後，與 AI 對話來分析、摘要、翻譯文件內容</p>
        </div>

        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
            }`}
          >
            <input
              type="file"
              id="file-input"
              className="hidden"
              accept=".pdf"
              onChange={handleFileSelect}
            />
            <label htmlFor="file-input" className="cursor-pointer">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <p className="text-lg font-medium text-gray-700">
                {isDragging ? '放開以上傳檔案' : '上傳 PDF 開始對話'}
              </p>
              <p className="text-sm text-gray-500 mt-2">拖放或點擊選擇 PDF 檔案</p>
            </label>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            {/* File header */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 border-b">
              <FileText className="w-8 h-8 text-indigo-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button
                onClick={() => { setFile(null); setMessages([]) }}
                className="p-2 hover:bg-gray-200 rounded-lg"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Messages */}
            <div className="h-96 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 py-12">
                  <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>開始提問吧！例如：</p>
                  <p className="text-sm mt-2">「這份文件的主要內容是什麼？」</p>
                  <p className="text-sm">「幫我摘要這份 PDF」</p>
                  <p className="text-sm">「翻譯成英文」</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-indigo-600" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl px-4 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t bg-gray-50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="輸入你的問題..."
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="px-4 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-gray-500">
          🔒 您的檔案會在處理完成後 1 小時內自動刪除，保護您的隱私。
        </p>
      </div>
    </div>
  )
}

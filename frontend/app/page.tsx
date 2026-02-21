'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Upload, ArrowRight, Heart, ChevronUp, Layers, Shield, FileText } from 'lucide-react'
import NavBar, { toolCategories } from '@/components/NavBar'

// 工具卡片元件
function ToolCard({
  tool,
  category,
  isFavorite,
  onToggleFavorite
}: {
  tool: typeof toolCategories[0]['tools'][0]
  category: typeof toolCategories[0]
  isFavorite: boolean
  onToggleFavorite: (toolId: string) => void
}) {
  const Icon = tool.icon

  return (
    <div className="relative">
      {/* 愛心按鈕 */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggleFavorite(tool.id)
        }}
        className={`absolute top-2 right-2 z-10 p-1.5 rounded-full transition-all ${
          isFavorite
            ? 'bg-red-100 dark:bg-red-900/50 text-red-500'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
        }`}
        title={isFavorite ? '從最愛移除' : '加入最愛'}
      >
        <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
      </button>

      <Link href={`/tools/${tool.id}`}>
        <div className="tool-card group">
          <div className={`tool-icon ${category.iconBg} text-white mb-4`}>
            <Icon className="w-7 h-7" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-gray-700 dark:group-hover:text-gray-200">
            {tool.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tool.desc}
          </p>
        </div>
      </Link>
    </div>
  )
}

// 回到頂部按鈕元件
function BackToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 500)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!visible) return null

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 p-2.5 sm:p-3 bg-gray-900 dark:bg-gray-700 text-white rounded-full shadow-lg hover:bg-gray-700 dark:hover:bg-gray-600 active:bg-gray-800 transition-all hover:scale-110"
      title="回到頂部"
    >
      <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6" />
    </button>
  )
}

// 首頁元件
export default function Home() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // 最愛功能狀態
  const [favorites, setFavorites] = useState<string[]>([])

  // 從 localStorage 讀取最愛
  useEffect(() => {
    const saved = localStorage.getItem('pdftool-favorites')
    if (saved) {
      setFavorites(JSON.parse(saved))
    }
  }, [])

  // 切換最愛
  const toggleFavorite = (toolId: string) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(toolId)
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
      localStorage.setItem('pdftool-favorites', JSON.stringify(newFavorites))
      return newFavorites
    })
  }

  // 取得所有最愛工具
  const getFavoriteTools = () => {
    const tools: Array<{
      tool: typeof toolCategories[0]['tools'][0]
      category: typeof toolCategories[0]
    }> = []

    favorites.forEach(favId => {
      for (const category of toolCategories) {
        const tool = category.tools.find(t => t.id === favId)
        if (tool) {
          tools.push({ tool, category })
          break
        }
      }
    })
    return tools
  }

  const favoriteTools = getFavoriteTools()

  // 處理檔案上傳並跳轉到工作流
  const handleFilesUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    // 將檔案轉為 base64 存到 sessionStorage
    const fileDataPromises = fileArray.map(async (file) => {
      return new Promise<{ name: string; type: string; size: number; data: string }>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          resolve({
            name: file.name,
            type: file.type,
            size: file.size,
            data: reader.result as string
          })
        }
        reader.readAsDataURL(file)
      })
    })

    const filesData = await Promise.all(fileDataPromises)
    sessionStorage.setItem('workflow-upload-files', JSON.stringify(filesData))

    // 跳轉到工作流頁面
    router.push('/tools/workflow?from=upload')
  }, [router])

  // 拖放事件處理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFilesUpload(files)
    }
  }, [handleFilesUpload])

  // 點擊上傳處理
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFilesUpload(files)
    }
  }, [handleFilesUpload])

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <main className="min-h-screen">
      {/* 頂部導航 */}
      <NavBar />

      {/* 回到頂部按鈕 */}
      <BackToTopButton />

      {/* Hero 區塊 */}
      <section className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 py-12 sm:py-20 px-4 pt-20 sm:pt-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 slide-up">
            PDF救星
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8 slide-up px-2" style={{ animationDelay: '0.1s' }}>
            合併、分割、轉換、編輯、簽名 — 所有 PDF 功能一站搞定
          </p>

          {/* 快速上傳區 - 真正可用的上傳功能 */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp"
            className="hidden"
          />
          <div
            onClick={handleUploadClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`upload-zone max-w-2xl mx-auto slide-up !p-8 sm:!p-12 cursor-pointer transition-all duration-300 dark:bg-gray-800 dark:border-gray-600 ${
              isDragging
                ? 'ring-4 ring-pdf-orange ring-opacity-50 bg-orange-50 dark:bg-orange-900/20 scale-[1.02]'
                : 'hover:border-pdf-orange hover:bg-orange-50/50 dark:hover:bg-orange-900/10'
            }`}
            style={{ animationDelay: '0.2s' }}
          >
            <div className={`w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-pdf-red to-pdf-orange rounded-full flex items-center justify-center mb-3 sm:mb-4 transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`}>
              <Upload className={`w-6 h-6 sm:w-8 sm:h-8 text-white transition-transform duration-300 ${isDragging ? 'animate-bounce' : ''}`} />
            </div>
            <p className="text-base sm:text-lg font-medium text-gray-700 dark:text-gray-200">
              <span className="hidden sm:inline">拖放檔案到這裡，或</span>點擊選擇檔案
            </p>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              支援 PDF、Word、Excel、PPT、圖片
            </p>
            <p className="text-xs text-pdf-orange font-medium mt-3 flex items-center justify-center gap-1">
              <Layers className="w-4 h-4" />
              上傳後自動進入工作流編輯器
            </p>
          </div>

          {/* 特點 */}
          <div className="grid grid-cols-3 gap-4 sm:gap-8 mt-10 sm:mt-16 max-w-3xl mx-auto">
            <div className="text-center fade-in">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-0.5 sm:mb-1 text-sm sm:text-base">安全保密</h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">檔案 1 小時後自動刪除</p>
            </div>
            <div className="text-center fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-0.5 sm:mb-1 text-sm sm:text-base">100% 免費</h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">無需註冊，無需付費</p>
            </div>
            <div className="text-center fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-0.5 sm:mb-1 text-sm sm:text-base">功能完整</h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">平替商用產品</p>
            </div>
          </div>
        </div>
      </section>

      {/* 所有工具 */}
      <section id="tools" className="py-12 sm:py-20 px-3 sm:px-4 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white text-center mb-2 sm:mb-4">
            所有 PDF 工具
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 text-center mb-8 sm:mb-16">
            選擇你需要的功能，開始處理 PDF
          </p>

          {/* 我的最愛 */}
          {favoriteTools.length > 0 && (
            <div
              id="category-favorites"
              className="category-section fade-in scroll-mt-20"
            >
              <h3 className="category-title">
                <Heart className="w-4 h-4 text-red-500 fill-current" />
                我的最愛
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {favoriteTools.map(({ tool, category }) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    category={category}
                    isFavorite={true}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 分類列表 */}
          {toolCategories.map((category, index) => (
            <div
              key={category.id}
              id={`category-${category.id}`}
              className="category-section fade-in scroll-mt-20"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <h3 className="category-title dark:text-white">
                <span className={`w-3 h-3 rounded-full bg-${category.color}`}></span>
                {category.name}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {category.tools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    category={category}
                    isFavorite={favorites.includes(tool.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-20 px-4 bg-gradient-to-br from-pdf-red to-pdf-orange">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">
            開始使用免費 PDF 工具
          </h2>
          <p className="text-base sm:text-lg opacity-90 mb-6 sm:mb-8 px-4">
            無需下載安裝，直接在瀏覽器中處理 PDF
          </p>
          <a
            href="#tools"
            className="inline-flex items-center gap-2 bg-white text-gray-900 px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold hover:bg-gray-100 active:bg-gray-200 transition-colors text-sm sm:text-base"
          >
            選擇工具開始
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 sm:py-8 px-4 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700">
        <div className="max-w-7xl mx-auto text-center text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
          © 2026 PDFTool. 100% 開源，使用開源工具打造。
        </div>
      </footer>
    </main>
  )
}

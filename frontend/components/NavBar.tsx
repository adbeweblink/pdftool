'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FileText, Scissors, RotateCw, Trash2, Minimize2,
  FileOutput, FileImage, FileSpreadsheet, Presentation,
  Eye, Edit, Edit3, Link as LinkIcon, Replace,
  PenTool, FormInput, Shield, Lock, Droplets,
  Archive, GitCompare, Hash, AlignLeft, MessageSquare,
  Brain, Languages, FileSearch, Layers, Stamp, FolderArchive,
  Video, Music, PlayCircle, Paperclip, CreditCard, ClipboardList, Users,
  Menu, X, Search, Sun, Moon, Settings
} from 'lucide-react'
import { useTheme } from 'next-themes'
import LanguageSwitcher from './LanguageSwitcher'
import ApiKeySettings from './ApiKeySettings'

// 工具定義（與首頁共用）
export const toolCategories = [
  {
    id: 'basic',
    name: '基礎操作',
    color: 'pdf-red',
    bgColor: 'bg-red-50',
    iconBg: 'bg-gradient-to-br from-pdf-red to-red-400',
    tools: [
      { id: 'merge', name: '合併 PDF', desc: '將多個 PDF 合併成一個', icon: FileText },
      { id: 'split', name: '分割 PDF', desc: '將 PDF 分割成多個檔案', icon: Scissors },
      { id: 'rotate', name: '旋轉頁面', desc: '旋轉 PDF 頁面方向', icon: RotateCw },
      { id: 'delete', name: '刪除頁面', desc: '刪除 PDF 中的特定頁面', icon: Trash2 },
      { id: 'compress', name: '壓縮 PDF', desc: '減少 PDF 檔案大小', icon: Minimize2 },
    ]
  },
  {
    id: 'convert',
    name: '格式轉換',
    color: 'pdf-orange',
    bgColor: 'bg-orange-50',
    iconBg: 'bg-gradient-to-br from-pdf-orange to-orange-400',
    tools: [
      { id: 'pdf-to-word', name: 'PDF 轉 Word', desc: '將 PDF 轉換為可編輯文件', icon: FileOutput },
      { id: 'word-to-pdf', name: 'Word 轉 PDF', desc: '將 Word 文件轉為 PDF', icon: FileText },
      { id: 'pdf-to-image', name: 'PDF 轉圖片', desc: '將 PDF 頁面匯出為圖片', icon: FileImage },
      { id: 'image-to-pdf', name: '圖片轉 PDF', desc: '將圖片合併為 PDF', icon: FileText },
      { id: 'pdf-to-excel', name: 'PDF 轉 Excel', desc: '將 PDF 表格轉為試算表', icon: FileSpreadsheet },
      { id: 'pdf-to-ppt', name: 'PDF 轉 PPT', desc: '將 PDF 轉為簡報', icon: Presentation },
    ]
  },
  {
    id: 'ocr',
    name: 'OCR 文字辨識',
    color: 'pdf-green',
    bgColor: 'bg-green-50',
    iconBg: 'bg-gradient-to-br from-pdf-green to-green-400',
    tools: [
      { id: 'ocr', name: '文字辨識', desc: '從掃描件或圖片辨識文字', icon: Eye },
      { id: 'searchable-pdf', name: '可搜尋 PDF', desc: '將掃描 PDF 轉為可搜尋', icon: FileText },
    ]
  },
  {
    id: 'edit',
    name: '編輯功能',
    color: 'pdf-blue',
    bgColor: 'bg-blue-50',
    iconBg: 'bg-gradient-to-br from-pdf-blue to-blue-400',
    tools: [
      { id: 'editor', name: 'PDF 編輯器', desc: '互動式編輯：文字、圖片、簽名、標註', icon: Edit3 },
      { id: 'edit-text', name: '新增文字', desc: '在 PDF 上加入文字', icon: Edit },
      { id: 'add-image', name: '插入圖片', desc: '在 PDF 中加入圖片', icon: FileImage },
      { id: 'add-link', name: '新增連結', desc: '在 PDF 中加入超連結', icon: LinkIcon },
      { id: 'replace-text', name: '取代文字', desc: '批次取代 PDF 中的文字', icon: Replace },
    ]
  },
  {
    id: 'sign',
    name: '簽名表單',
    color: 'pdf-purple',
    bgColor: 'bg-purple-50',
    iconBg: 'bg-gradient-to-br from-pdf-purple to-purple-400',
    tools: [
      { id: 'sign', name: '電子簽名', desc: '在 PDF 上加入電子簽名', icon: PenTool },
      { id: 'add-fields', name: '新增表單欄位', desc: '建立可填寫的文字欄位', icon: FormInput },
      { id: 'fill-form', name: '填寫表單', desc: '填寫 PDF 表單', icon: Edit },
    ]
  },
  {
    id: 'security',
    name: '安全保護',
    color: 'pdf-yellow',
    bgColor: 'bg-yellow-50',
    iconBg: 'bg-gradient-to-br from-pdf-yellow to-yellow-500',
    tools: [
      { id: 'encrypt', name: '加密 PDF', desc: '為 PDF 設定密碼保護', icon: Lock },
      { id: 'decrypt', name: '解密 PDF', desc: '移除 PDF 密碼保護', icon: Shield },
      { id: 'watermark', name: '新增浮水印', desc: '在 PDF 上加入浮水印', icon: Droplets },
      { id: 'redact', name: '遮蔽敏感資訊', desc: '永久移除敏感內容', icon: Shield },
    ]
  },
  {
    id: 'advanced',
    name: '進階功能',
    color: 'pdf-teal',
    bgColor: 'bg-teal-50',
    iconBg: 'bg-gradient-to-br from-pdf-teal to-teal-400',
    tools: [
      { id: 'pdfa', name: 'PDF/A 轉換', desc: '轉為長期保存格式', icon: Archive },
      { id: 'compare', name: '比較文件', desc: '比較兩個 PDF 的差異', icon: GitCompare },
      { id: 'bates', name: 'Bates 編號', desc: '新增法律文件編號', icon: Hash },
      { id: 'header-footer', name: '頁首頁尾', desc: '新增頁首頁尾和頁碼', icon: AlignLeft },
      { id: 'annotation', name: '註解管理', desc: '新增或移除註解', icon: MessageSquare },
    ]
  },
  {
    id: 'ai',
    name: 'AI 助手',
    color: 'pdf-indigo',
    bgColor: 'bg-indigo-50',
    iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-400',
    tools: [
      { id: 'ai-chat', name: 'AI 對話', desc: '與 AI 對話分析 PDF', icon: Brain },
      { id: 'ai-analyze', name: 'AI 分析', desc: '用 AI 分析 PDF 內容', icon: Brain },
      { id: 'ai-summarize', name: 'AI 摘要', desc: '自動生成 PDF 摘要', icon: FileSearch },
      { id: 'ai-translate', name: 'AI 翻譯', desc: '翻譯 PDF 文件內容', icon: Languages },
    ]
  },
  {
    id: 'ai-advanced',
    name: 'AI 進階功能',
    color: 'pdf-violet',
    bgColor: 'bg-violet-50',
    iconBg: 'bg-gradient-to-br from-violet-500 to-violet-400',
    tools: [
      { id: 'ai-compare', name: 'AI 合約比對', desc: '比對兩份合約的差異', icon: Brain },
      { id: 'ai-pii', name: 'AI 個資偵測', desc: '偵測並遮蔽個人資料', icon: Shield },
      { id: 'ai-table', name: 'AI 表格提取', desc: '提取 PDF 中的表格', icon: FileSpreadsheet },
      { id: 'ai-rename', name: 'AI 智能重命名', desc: '根據內容自動命名', icon: FileText },
    ]
  },
  {
    id: 'workflow',
    name: '工作流引擎',
    color: 'pdf-emerald',
    bgColor: 'bg-emerald-50',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-400',
    tools: [
      { id: 'workflow', name: '視覺化工作流', desc: '拖拉式建立自動化流程', icon: Layers },
    ]
  },
  {
    id: 'batch',
    name: '批次處理',
    color: 'pdf-cyan',
    bgColor: 'bg-cyan-50',
    iconBg: 'bg-gradient-to-br from-cyan-500 to-cyan-400',
    tools: [
      { id: 'batch-compress', name: '批次壓縮', desc: '同時壓縮多個 PDF', icon: Layers },
      { id: 'batch-watermark', name: '批次浮水印', desc: '批次加入浮水印', icon: Stamp },
      { id: 'batch-merge', name: '批次合併', desc: '將多個 PDF 合併成一個', icon: FolderArchive },
    ]
  },
  {
    id: 'multimedia',
    name: '多媒體嵌入',
    color: 'pdf-pink',
    bgColor: 'bg-pink-50',
    iconBg: 'bg-gradient-to-br from-pink-500 to-pink-400',
    tools: [
      { id: 'embed-video', name: '嵌入影片', desc: '在 PDF 中嵌入影片', icon: Video },
      { id: 'embed-audio', name: '嵌入音訊', desc: '在 PDF 中嵌入音訊', icon: Music },
      { id: 'embed-youtube', name: '嵌入 YouTube', desc: '加入 YouTube 連結', icon: PlayCircle },
      { id: 'embed-attachments', name: '嵌入附件', desc: '加入檔案附件', icon: Paperclip },
    ]
  },
  {
    id: 'extract',
    name: '資料提取',
    color: 'pdf-emerald',
    bgColor: 'bg-emerald-50',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-400',
    tools: [
      { id: 'form-extract', name: '表單欄位分析', desc: '分析 PDF 表單結構', icon: ClipboardList },
      { id: 'batch-form-extract', name: '批次表單提取', desc: '批次提取欄位匯出 CSV', icon: FileSpreadsheet },
      { id: 'business-card', name: '名片辨識', desc: '從名片提取聯絡資訊', icon: CreditCard },
      { id: 'batch-business-cards', name: '批次名片整理', desc: '批次處理名片匯出 CSV', icon: Users },
    ]
  },
]

// 導航選單元件
export default function NavBar() {
  const [isOpen, setIsOpen] = useState(false)
  const [showMegaMenu, setShowMegaMenu] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showApiKeySettings, setShowApiKeySettings] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const isHomePage = pathname === '/'

  // 防止 hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 搜尋結果
  const searchResults = searchQuery.trim() ? toolCategories.flatMap(category =>
    category.tools
      .filter(tool =>
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.desc.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .map(tool => ({ ...tool, category }))
  ).slice(0, 8) : []

  // 關閉搜尋結果（點擊外部時）
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const scrollToCategory = (categoryId: string) => {
    if (isHomePage) {
      const element = document.getElementById(`category-${categoryId}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } else {
      // 若不在首頁，跳轉到首頁的對應分類
      window.location.href = `/#category-${categoryId}`
    }
    setIsOpen(false)
    setShowMegaMenu(false)
  }

  // 將分類分組顯示
  const categoryGroups = [
    { name: '基礎', ids: ['basic', 'convert', 'ocr'] },
    { name: '編輯', ids: ['edit', 'sign', 'security'] },
    { name: 'AI', ids: ['ai', 'ai-advanced'] },
    { name: '進階', ids: ['advanced', 'workflow', 'batch', 'multimedia', 'extract'] },
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-md'
        : 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* 桌面導航 */}
        <div className="hidden lg:flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-900 dark:text-white flex-shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-pdf-red to-pdf-orange rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span>PDF救星</span>
          </Link>

          {/* 搜尋框 */}
          <div className="relative mx-4" ref={searchInputRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="搜尋工具..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowSearchResults(true)
                }}
                onFocus={() => setShowSearchResults(true)}
                className="w-64 pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdf-orange focus:bg-white dark:focus:bg-gray-700 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setShowSearchResults(false)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 搜尋結果下拉 */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                {searchResults.map((tool) => (
                  <Link
                    key={tool.id}
                    href={`/tools/${tool.id}`}
                    onClick={() => {
                      setSearchQuery('')
                      setShowSearchResults(false)
                    }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className={`w-8 h-8 ${tool.category.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <tool.icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white text-sm">{tool.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{tool.desc}</div>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                      {tool.category.name}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {/* 無結果提示 */}
            {showSearchResults && searchQuery && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 text-center text-gray-500 dark:text-gray-400 text-sm z-50">
                找不到「{searchQuery}」相關的工具
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* 主要分類按鈕 */}
            <div
              className="relative"
              onMouseEnter={() => setShowMegaMenu(true)}
              onMouseLeave={() => setShowMegaMenu(false)}
            >
              <button className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-1">
                所有工具
                <svg className={`w-4 h-4 transition-transform ${showMegaMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Mega Menu 下拉 */}
              {showMegaMenu && (
                <div className="absolute top-full left-0 mt-1 w-[600px] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 grid grid-cols-2 gap-4">
                  {toolCategories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => scrollToCategory(category.id)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left group"
                    >
                      <div className={`w-10 h-10 ${category.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-sm font-bold">
                          {category.tools.length}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200">
                          {category.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {category.tools.length} 個工具
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 快捷分類 */}
            {categoryGroups.map((group) => (
              <div key={group.name} className="relative group">
                <button className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                  {group.name}
                </button>
                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  {group.ids.map((id) => {
                    const category = toolCategories.find(c => c.id === id)
                    if (!category) return null
                    return (
                      <button
                        key={id}
                        onClick={() => scrollToCategory(id)}
                        className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-left flex items-center gap-2"
                      >
                        <span className={`w-2 h-2 rounded-full ${category.iconBg}`}></span>
                        {category.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <a href="#" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition-colors">
              關於
            </a>

            {/* 語系切換 */}
            <LanguageSwitcher />

            {/* API Key 設定按鈕 */}
            <button
              onClick={() => setShowApiKeySettings(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="API Key 設定"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* 主題切換按鈕 */}
            {mounted && (
              <button
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition-colors"
                title={resolvedTheme === 'dark' ? '切換為淺色模式' : '切換為深色模式'}
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* 手機導航 */}
        <div className="lg:hidden flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-white">
            <div className="w-8 h-8 bg-gradient-to-br from-pdf-red to-pdf-orange rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span>PDF救星</span>
          </Link>
          <div className="flex items-center gap-1">
            {/* 手機版語系切換 */}
            <LanguageSwitcher />

            {/* 手機版 API Key 設定按鈕 */}
            <button
              onClick={() => setShowApiKeySettings(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="API Key 設定"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* 手機版主題切換 */}
            {mounted && (
              <button
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* 手機展開選單 */}
        {isOpen && (
          <div className="lg:hidden absolute top-14 left-0 right-0 bg-white dark:bg-gray-900 shadow-lg border-t dark:border-gray-700 max-h-[80vh] overflow-y-auto">
            <div className="p-4">
              {/* 手機版搜尋框 */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="搜尋工具..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdf-orange focus:bg-white dark:focus:bg-gray-700"
                />
              </div>

              {/* 手機版搜尋結果 */}
              {searchQuery && searchResults.length > 0 && (
                <div className="mb-4 space-y-1">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                    搜尋結果
                  </div>
                  {searchResults.map((tool) => (
                    <Link
                      key={tool.id}
                      href={`/tools/${tool.id}`}
                      onClick={() => {
                        setSearchQuery('')
                        setIsOpen(false)
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    >
                      <div className={`w-8 h-8 ${tool.category.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <tool.icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white text-sm">{tool.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{tool.desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* 無結果提示 */}
              {searchQuery && searchResults.length === 0 && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center text-gray-500 dark:text-gray-400 text-sm">
                  找不到「{searchQuery}」相關的工具
                </div>
              )}

              {/* 分組顯示 */}
              {categoryGroups.map((group) => (
                <div key={group.name} className="mb-4">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                    {group.name}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.ids.map((id) => {
                      const category = toolCategories.find(c => c.id === id)
                      if (!category) return null
                      return (
                        <button
                          key={id}
                          onClick={() => scrollToCategory(id)}
                          className="px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-left flex items-center gap-2"
                        >
                          <div className={`w-6 h-6 ${category.iconBg} rounded flex items-center justify-center flex-shrink-0`}>
                            <span className="text-white text-xs font-bold">{category.tools.length}</span>
                          </div>
                          {category.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* API Key 設定彈窗 */}
      <ApiKeySettings
        isOpen={showApiKeySettings}
        onClose={() => setShowApiKeySettings(false)}
      />
    </nav>
  )
}

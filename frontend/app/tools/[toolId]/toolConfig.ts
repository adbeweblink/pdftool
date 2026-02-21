import {
  FileText, Scissors, RotateCw, Trash2, Minimize2,
  FileOutput, FileImage, FileSpreadsheet, Presentation,
  Eye, Edit, Link as LinkIcon, Replace,
  PenTool, FormInput, Shield, Lock, Droplets,
  Archive, GitCompare, Hash, AlignLeft, MessageSquare,
  Layers, Stamp, FolderArchive, Video, Music, PlayCircle, Paperclip,
  Brain, Languages, CreditCard, ClipboardList, Users,
  type LucideIcon
} from 'lucide-react'

// 工具選項類型
export interface ToolOption {
  id: string
  label: string
  type: 'select' | 'number' | 'text' | 'checkbox'
  options?: { value: string; label: string }[]
  default?: string | number | boolean
  min?: number
  max?: number
}

// 工具配置類型
export interface ToolConfig {
  name: string
  desc: string
  icon: LucideIcon
  color: string
  apiEndpoint: string
  acceptFiles: string
  multiple: boolean
  instructions?: string[]
  options?: ToolOption[]
  requiresApiKey?: boolean  // 需要用戶提供 Gemini API Key
}

// 工具配置
export const toolConfig: Record<string, ToolConfig> = {
  // 基礎操作
  merge: {
    name: '合併 PDF',
    desc: '將多個 PDF 檔案合併成一個',
    icon: FileText,
    color: 'from-pdf-red to-red-400',
    apiEndpoint: '/api/basic/merge',
    acceptFiles: '.pdf',
    multiple: true,
    instructions: [
      '選擇或拖放多個 PDF 檔案',
      '拖動檔案調整合併順序',
      '點擊「開始處理」合併所有檔案',
      '下載合併後的 PDF'
    ],
  },
  split: {
    name: '分割 PDF',
    desc: '將 PDF 按頁面範圍分割成多個檔案',
    icon: Scissors,
    color: 'from-pdf-red to-red-400',
    apiEndpoint: '/api/basic/split',
    acceptFiles: '.pdf',
    multiple: false,
    instructions: [
      '上傳要分割的 PDF 檔案',
      '輸入頁面範圍（如: 1-3,5,7-10）',
      '逗號分隔不同的分割區段',
      '下載分割後的 PDF 檔案'
    ],
    options: [
      { id: 'pages', label: '頁面範圍', type: 'text', default: '1-3,5,7-10' }
    ]
  },
  rotate: {
    name: '旋轉頁面',
    desc: '旋轉 PDF 頁面方向',
    icon: RotateCw,
    color: 'from-pdf-red to-red-400',
    apiEndpoint: '/api/basic/rotate',
    acceptFiles: '.pdf',
    multiple: false,
    instructions: [
      '上傳 PDF 檔案',
      '選擇旋轉角度（90°、180°、270°）',
      '指定要旋轉的頁面（留空表示全部）',
      '下載旋轉後的 PDF'
    ],
    options: [
      {
        id: 'angle', label: '旋轉角度', type: 'select',
        options: [
          { value: '90', label: '順時針 90°' },
          { value: '180', label: '旋轉 180°' },
          { value: '270', label: '逆時針 90°' },
        ],
        default: '90',
      },
      { id: 'pages', label: '頁面（留空表示全部）', type: 'text', default: '' }
    ]
  },
  delete: {
    name: '刪除頁面',
    desc: '從 PDF 中刪除指定頁面',
    icon: Trash2,
    color: 'from-pdf-red to-red-400',
    apiEndpoint: '/api/basic/delete-pages',
    acceptFiles: '.pdf',
    multiple: false,
    instructions: [
      '上傳 PDF 檔案',
      '輸入要刪除的頁碼（如: 1,3,5）',
      '使用逗號分隔多個頁碼',
      '下載處理後的 PDF'
    ],
    options: [
      { id: 'pages', label: '要刪除的頁面', type: 'text', default: '1,3,5' }
    ]
  },
  compress: {
    name: '壓縮 PDF',
    desc: '減少 PDF 檔案大小',
    icon: Minimize2,
    color: 'from-pdf-red to-red-400',
    apiEndpoint: '/api/basic/compress',
    acceptFiles: '.pdf',
    multiple: false,
    instructions: [
      '上傳要壓縮的 PDF 檔案',
      '選擇壓縮品質等級',
      '高品質保留最多細節，低品質檔案最小',
      '下載壓縮後的 PDF'
    ],
    options: [
      {
        id: 'quality', label: '壓縮品質', type: 'select',
        options: [
          { value: 'high', label: '高品質（檔案較大）' },
          { value: 'medium', label: '中等品質' },
          { value: 'low', label: '低品質（檔案最小）' },
        ],
        default: 'medium',
      }
    ]
  },

  // 格式轉換
  'pdf-to-word': {
    name: 'PDF 轉 Word',
    desc: '將 PDF 轉換為可編輯的 Word 文件',
    icon: FileOutput,
    color: 'from-pdf-orange to-orange-400',
    apiEndpoint: '/api/convert/pdf-to-word',
    acceptFiles: '.pdf',
    multiple: false,
    instructions: ['上傳 PDF 檔案', '系統自動辨識文字和版面', '轉換完成後下載 Word 檔案'],
  },
  'word-to-pdf': {
    name: 'Word 轉 PDF',
    desc: '將 Word 文件轉換為 PDF',
    icon: FileText,
    color: 'from-pdf-orange to-orange-400',
    apiEndpoint: '/api/convert/word-to-pdf',
    acceptFiles: '.doc,.docx',
    multiple: false,
    instructions: ['上傳 Word 文件（.doc 或 .docx）', '系統保留原始格式和版面', '下載轉換後的 PDF 檔案'],
  },
  'pdf-to-image': {
    name: 'PDF 轉圖片',
    desc: '將 PDF 頁面匯出為圖片',
    icon: FileImage,
    color: 'from-pdf-orange to-orange-400',
    apiEndpoint: '/api/convert/pdf-to-images',
    acceptFiles: '.pdf',
    multiple: false,
    instructions: ['上傳 PDF 檔案', '選擇輸出格式（PNG 或 JPG）', '設定 DPI（解析度越高圖片越清晰）', '下載每頁轉換後的圖片'],
    options: [
      {
        id: 'format', label: '圖片格式', type: 'select',
        options: [{ value: 'png', label: 'PNG' }, { value: 'jpg', label: 'JPG' }],
        default: 'png',
      },
      { id: 'dpi', label: 'DPI', type: 'number', default: 150, min: 72, max: 600 }
    ]
  },
  'image-to-pdf': {
    name: '圖片轉 PDF',
    desc: '將圖片合併為 PDF',
    icon: FileText,
    color: 'from-pdf-orange to-orange-400',
    apiEndpoint: '/api/convert/images-to-pdf',
    acceptFiles: '.jpg,.jpeg,.png,.gif,.bmp,.tiff',
    multiple: true,
    instructions: ['選擇多張圖片（可多選）', '拖動調整圖片順序', '所有圖片將合併為一個 PDF'],
  },
  'pdf-to-excel': {
    name: 'PDF 轉 Excel',
    desc: '將 PDF 表格轉換為 Excel',
    icon: FileSpreadsheet,
    color: 'from-pdf-orange to-orange-400',
    apiEndpoint: '/api/convert/pdf-to-excel',
    acceptFiles: '.pdf',
    multiple: false,
    instructions: ['上傳包含表格的 PDF', '系統自動偵測並提取表格', '下載可編輯的 Excel 檔案'],
  },
  'pdf-to-ppt': {
    name: 'PDF 轉 PPT',
    desc: '將 PDF 轉換為簡報',
    icon: Presentation,
    color: 'from-pdf-orange to-orange-400',
    apiEndpoint: '/api/convert/pdf-to-ppt',
    acceptFiles: '.pdf',
    multiple: false,
    instructions: ['上傳 PDF 檔案', '每頁 PDF 轉為一張投影片', '下載 PowerPoint 簡報檔案'],
  },

  // OCR
  ocr: {
    name: '文字辨識 (OCR)',
    desc: '從掃描件或圖片中辨識文字',
    icon: Eye,
    color: 'from-pdf-green to-green-400',
    apiEndpoint: '/api/ocr/recognize',
    acceptFiles: '.pdf,.jpg,.jpeg,.png',
    multiple: false,
    requiresApiKey: true,
    instructions: ['上傳掃描件或圖片檔案', '輸入您的 Gemini API Key', '選擇文件語言以提升辨識準確度'],
    options: [
      {
        id: 'lang', label: '語言', type: 'select',
        options: [
          { value: 'ch', label: '中文' },
          { value: 'en', label: '英文' },
          { value: 'ch+en', label: '中英混合' },
        ],
        default: 'ch',
      }
    ]
  },
  'searchable-pdf': {
    name: '可搜尋 PDF',
    desc: '將掃描 PDF 轉為可搜尋文字',
    icon: FileText,
    color: 'from-pdf-green to-green-400',
    apiEndpoint: '/api/ocr/make-searchable',
    acceptFiles: '.pdf',
    multiple: false,
    requiresApiKey: true,
    instructions: ['上傳掃描版 PDF 檔案', '輸入您的 Gemini API Key', '下載後可使用 Ctrl+F 搜尋文字'],
  },

  // 安全
  encrypt: {
    name: '加密 PDF',
    desc: '為 PDF 設定密碼保護',
    icon: Lock,
    color: 'from-pdf-yellow to-yellow-500',
    apiEndpoint: '/api/security/encrypt',
    acceptFiles: '.pdf',
    multiple: false,
    instructions: ['上傳要加密的 PDF 檔案', '設定開啟密碼', '請妥善保管密碼，遺失無法復原'],
    options: [{ id: 'password', label: '設定密碼', type: 'text', default: '' }]
  },
  decrypt: {
    name: '解密 PDF',
    desc: '移除 PDF 密碼保護',
    icon: Shield,
    color: 'from-pdf-yellow to-yellow-500',
    apiEndpoint: '/api/security/decrypt',
    acceptFiles: '.pdf',
    multiple: false,
    instructions: ['上傳受密碼保護的 PDF', '輸入正確的密碼', '密碼錯誤將無法解密'],
    options: [{ id: 'password', label: '輸入密碼', type: 'text', default: '' }]
  },
  watermark: {
    name: '新增浮水印',
    desc: '在 PDF 上加入文字浮水印',
    icon: Droplets,
    color: 'from-pdf-yellow to-yellow-500',
    apiEndpoint: '/api/security/watermark',
    acceptFiles: '.pdf',
    multiple: false,
    instructions: ['上傳 PDF 檔案', '輸入浮水印文字內容', '調整透明度（數值越小越透明）'],
    options: [
      { id: 'text', label: '浮水印文字', type: 'text', default: '機密文件' },
      { id: 'opacity', label: '透明度 (%)', type: 'number', default: 30, min: 10, max: 100 }
    ]
  },
  redact: {
    name: '遮蔽敏感資訊',
    desc: '永久移除敏感內容',
    icon: Shield,
    color: 'from-pdf-yellow to-yellow-500',
    apiEndpoint: '/api/security/redact',
    acceptFiles: '.pdf',
    multiple: false,
  },

  // 進階
  pdfa: {
    name: 'PDF/A 轉換',
    desc: '轉為長期保存標準格式',
    icon: Archive,
    color: 'from-pdf-teal to-teal-400',
    apiEndpoint: '/api/advanced/convert-to-pdfa',
    acceptFiles: '.pdf',
    multiple: false,
  },
  compare: {
    name: '比較文件',
    desc: '比較兩個 PDF 的差異',
    icon: GitCompare,
    color: 'from-pdf-teal to-teal-400',
    apiEndpoint: '/api/advanced/compare',
    acceptFiles: '.pdf',
    multiple: true,
  },
  'header-footer': {
    name: '頁首頁尾',
    desc: '新增頁首、頁尾和頁碼',
    icon: AlignLeft,
    color: 'from-pdf-teal to-teal-400',
    apiEndpoint: '/api/advanced/header-footer',
    acceptFiles: '.pdf',
    multiple: false,
    options: [
      { id: 'header', label: '頁首文字', type: 'text', default: '' },
      { id: 'footer', label: '頁尾文字', type: 'text', default: '' },
      { id: 'pageNumber', label: '顯示頁碼', type: 'checkbox', default: true }
    ]
  },
  bates: {
    name: 'Bates 編號',
    desc: '新增法律文件編號',
    icon: Hash,
    color: 'from-pdf-teal to-teal-400',
    apiEndpoint: '/api/advanced/bates-numbering',
    acceptFiles: '.pdf',
    multiple: false,
    options: [
      { id: 'prefix', label: '前綴', type: 'text', default: 'DOC' },
      { id: 'start', label: '起始編號', type: 'number', default: 1, min: 1 }
    ]
  },
  annotation: {
    name: '註解管理',
    desc: '新增或移除註解',
    icon: MessageSquare,
    color: 'from-pdf-teal to-teal-400',
    apiEndpoint: '/api/advanced/get-annotations',
    acceptFiles: '.pdf',
    multiple: false,
  },

  // AI
  'ai-summarize': {
    name: 'AI 摘要',
    desc: '使用 AI 生成 PDF 內容摘要',
    icon: Brain,
    color: 'from-indigo-500 to-indigo-400',
    apiEndpoint: '/api/ai/summarize',
    acceptFiles: '.pdf',
    multiple: false,
    requiresApiKey: true,
    instructions: ['上傳 PDF 文件', '輸入您的 Gemini API Key', 'AI 自動分析並生成摘要'],
  },
  'ai-translate': {
    name: 'AI 翻譯',
    desc: '使用 AI 翻譯 PDF 文件',
    icon: Languages,
    color: 'from-indigo-500 to-indigo-400',
    apiEndpoint: '/api/ai/translate',
    acceptFiles: '.pdf',
    multiple: false,
    requiresApiKey: true,
    instructions: ['上傳要翻譯的 PDF', '輸入您的 Gemini API Key', '選擇目標語言'],
    options: [
      {
        id: 'target_lang', label: '目標語言', type: 'select',
        options: [
          { value: 'zh-TW', label: '繁體中文' },
          { value: 'zh-CN', label: '簡體中文' },
          { value: 'en', label: '英文' },
          { value: 'ja', label: '日文' },
          { value: 'ko', label: '韓文' },
        ],
        default: 'zh-TW',
      }
    ]
  },
  'ai-analyze': {
    name: 'AI 分析',
    desc: '使用 AI 分析 PDF 內容',
    icon: Brain,
    color: 'from-indigo-500 to-indigo-400',
    apiEndpoint: '/api/ai/analyze',
    acceptFiles: '.pdf',
    multiple: false,
    requiresApiKey: true,
    instructions: ['上傳 PDF 文件', '輸入您的 Gemini API Key', 'AI 自動分析文件內容'],
  },

  // AI 進階
  'ai-compare': {
    name: 'AI 合約比對',
    desc: '使用 AI 比對兩份合約的差異',
    icon: GitCompare,
    color: 'from-violet-500 to-violet-400',
    apiEndpoint: '/api/ai-advanced/compare',
    acceptFiles: '.pdf',
    multiple: true,
    requiresApiKey: true,
    instructions: ['上傳兩份 PDF 合約', '輸入您的 Gemini API Key', 'AI 自動比對差異'],
  },
  'ai-pii': {
    name: 'AI 個資偵測',
    desc: '偵測並遮蔽個人資料',
    icon: Shield,
    color: 'from-violet-500 to-violet-400',
    apiEndpoint: '/api/ai-advanced/pii-detect',
    acceptFiles: '.pdf',
    multiple: false,
    requiresApiKey: true,
    instructions: ['上傳 PDF 文件', '輸入您的 Gemini API Key', 'AI 自動偵測個資'],
    options: [{ id: 'redact', label: '自動遮蔽個資', type: 'checkbox', default: false }]
  },
  'ai-table': {
    name: 'AI 表格提取',
    desc: '從 PDF 中提取表格',
    icon: FileSpreadsheet,
    color: 'from-violet-500 to-violet-400',
    apiEndpoint: '/api/ai-advanced/extract-table',
    acceptFiles: '.pdf',
    multiple: false,
    requiresApiKey: true,
    instructions: ['上傳包含表格的 PDF', '輸入您的 Gemini API Key', '選擇輸出格式'],
    options: [
      {
        id: 'format', label: '輸出格式', type: 'select',
        options: [
          { value: 'excel', label: 'Excel (.xlsx)' },
          { value: 'csv', label: 'CSV' },
          { value: 'json', label: 'JSON' },
        ],
        default: 'excel',
      }
    ]
  },
  'ai-rename': {
    name: 'AI 智能重命名',
    desc: '根據內容自動命名檔案',
    icon: FileText,
    color: 'from-violet-500 to-violet-400',
    apiEndpoint: '/api/ai-advanced/smart-rename',
    acceptFiles: '.pdf',
    multiple: false,
    requiresApiKey: true,
    instructions: ['上傳 PDF 文件', '輸入您的 Gemini API Key', 'AI 自動生成檔名'],
  },

  // 批次
  'batch-compress': {
    name: '批次壓縮',
    desc: '同時壓縮多個 PDF',
    icon: Layers,
    color: 'from-cyan-500 to-cyan-400',
    apiEndpoint: '/api/batch/compress',
    acceptFiles: '.pdf',
    multiple: true,
  },
  'batch-watermark': {
    name: '批次浮水印',
    desc: '批次加入浮水印',
    icon: Stamp,
    color: 'from-cyan-500 to-cyan-400',
    apiEndpoint: '/api/batch/watermark',
    acceptFiles: '.pdf',
    multiple: true,
    options: [{ id: 'text', label: '浮水印文字', type: 'text', default: '機密文件' }]
  },
  'batch-merge': {
    name: '批次合併',
    desc: '將多個 PDF 合併成一個',
    icon: FolderArchive,
    color: 'from-cyan-500 to-cyan-400',
    apiEndpoint: '/api/batch/merge-all',
    acceptFiles: '.pdf',
    multiple: true,
  },

  // 編輯
  'edit-text': {
    name: '新增文字',
    desc: '在 PDF 上加入文字',
    icon: Edit,
    color: 'from-pdf-blue to-blue-400',
    apiEndpoint: '/api/edit/add-text',
    acceptFiles: '.pdf',
    multiple: false,
    options: [
      { id: 'page', label: '頁碼', type: 'number', default: 1, min: 1 },
      { id: 'x', label: 'X 座標', type: 'number', default: 100 },
      { id: 'y', label: 'Y 座標', type: 'number', default: 100 },
      { id: 'text', label: '文字內容', type: 'text', default: '' },
      { id: 'font_size', label: '字體大小', type: 'number', default: 12, min: 6, max: 72 }
    ]
  },
  'add-image': {
    name: '插入圖片',
    desc: '在 PDF 中加入圖片',
    icon: FileImage,
    color: 'from-pdf-blue to-blue-400',
    apiEndpoint: '/api/edit/add-image',
    acceptFiles: '.pdf',
    multiple: false,
  },
  'add-link': {
    name: '新增連結',
    desc: '在 PDF 中加入超連結',
    icon: LinkIcon,
    color: 'from-pdf-blue to-blue-400',
    apiEndpoint: '/api/edit/add-link',
    acceptFiles: '.pdf',
    multiple: false,
  },
  'replace-text': {
    name: '取代文字',
    desc: '批次取代 PDF 中的文字',
    icon: Replace,
    color: 'from-pdf-blue to-blue-400',
    apiEndpoint: '/api/edit/replace-text',
    acceptFiles: '.pdf',
    multiple: false,
    options: [
      { id: 'find', label: '尋找文字', type: 'text', default: '' },
      { id: 'replace', label: '取代為', type: 'text', default: '' }
    ]
  },

  // 簽名
  sign: {
    name: '電子簽名',
    desc: '在 PDF 上加入電子簽名',
    icon: PenTool,
    color: 'from-pdf-purple to-purple-400',
    apiEndpoint: '/api/sign/add-signature',
    acceptFiles: '.pdf',
    multiple: false,
  },
  'add-fields': {
    name: '新增表單欄位',
    desc: '建立可填寫的文字欄位',
    icon: FormInput,
    color: 'from-pdf-purple to-purple-400',
    apiEndpoint: '/api/sign/create-text-field',
    acceptFiles: '.pdf',
    multiple: false,
    options: [
      { id: 'page', label: '頁碼', type: 'number', default: 1, min: 1 },
      { id: 'field_name', label: '欄位名稱', type: 'text', default: 'field1' },
      { id: 'x', label: 'X 座標', type: 'number', default: 100 },
      { id: 'y', label: 'Y 座標', type: 'number', default: 100 },
      { id: 'width', label: '寬度', type: 'number', default: 200 },
      { id: 'height', label: '高度', type: 'number', default: 30 }
    ]
  },
  'fill-form': {
    name: '填寫表單',
    desc: '填寫 PDF 表單',
    icon: Edit,
    color: 'from-pdf-purple to-purple-400',
    apiEndpoint: '/api/sign/fill-form',
    acceptFiles: '.pdf',
    multiple: false,
  },

  // 多媒體
  'embed-video': {
    name: '嵌入影片',
    desc: '在 PDF 中嵌入影片',
    icon: Video,
    color: 'from-pink-500 to-pink-400',
    apiEndpoint: '/api/multimedia/embed-video',
    acceptFiles: '.pdf',
    multiple: false,
  },
  'embed-audio': {
    name: '嵌入音訊',
    desc: '在 PDF 中嵌入音訊',
    icon: Music,
    color: 'from-pink-500 to-pink-400',
    apiEndpoint: '/api/multimedia/embed-audio',
    acceptFiles: '.pdf',
    multiple: false,
  },
  'embed-youtube': {
    name: '嵌入 YouTube',
    desc: '加入 YouTube 影片連結',
    icon: PlayCircle,
    color: 'from-pink-500 to-pink-400',
    apiEndpoint: '/api/multimedia/embed-youtube',
    acceptFiles: '.pdf',
    multiple: false,
    options: [{ id: 'url', label: 'YouTube 網址', type: 'text', default: '' }]
  },
  'embed-attachments': {
    name: '嵌入附件',
    desc: '加入檔案附件',
    icon: Paperclip,
    color: 'from-pink-500 to-pink-400',
    apiEndpoint: '/api/multimedia/embed-attachments',
    acceptFiles: '.pdf',
    multiple: false,
  },

  // 資料提取
  'form-extract': {
    name: '表單欄位分析',
    desc: '分析 PDF 表單結構，辨識可提取欄位',
    icon: ClipboardList,
    color: 'from-emerald-500 to-emerald-400',
    apiEndpoint: '/api/extract/analyze-form',
    acceptFiles: '.pdf',
    multiple: false,
    requiresApiKey: true,
    instructions: [
      '上傳包含表單的 PDF（可以是掃描檔）',
      '輸入您的 Gemini API Key',
      'AI 自動辨識文件中的欄位結構'
    ],
    options: [
      { id: 'use_ocr', label: '使用 OCR（掃描檔需勾選）', type: 'checkbox', default: false }
    ]
  },
  'batch-form-extract': {
    name: '批次表單提取',
    desc: '從多個 PDF 批次提取指定欄位，匯出 CSV',
    icon: FileSpreadsheet,
    color: 'from-emerald-500 to-emerald-400',
    apiEndpoint: '/api/extract/extract-batch',
    acceptFiles: '.pdf',
    multiple: true,
    requiresApiKey: true,
    instructions: [
      '上傳多個格式相同的 PDF 表單',
      '輸入您的 Gemini API Key',
      '輸入要提取的欄位名稱（逗號分隔）',
      '下載包含所有資料的 CSV 檔案'
    ],
    options: [
      { id: 'fields', label: '要提取的欄位（逗號分隔）', type: 'text', default: '姓名,電話,地址,日期' },
      { id: 'use_ocr', label: '使用 OCR（掃描檔需勾選）', type: 'checkbox', default: false }
    ]
  },
  'business-card': {
    name: '名片辨識',
    desc: '從名片圖片提取聯絡資訊',
    icon: CreditCard,
    color: 'from-emerald-500 to-emerald-400',
    apiEndpoint: '/api/extract/business-card',
    acceptFiles: '.jpg,.jpeg,.png,.pdf',
    multiple: false,
    requiresApiKey: true,
    instructions: [
      '上傳名片照片或掃描檔',
      '輸入您的 Gemini API Key',
      'AI 自動辨識並提取聯絡資訊'
    ],
  },
  'batch-business-cards': {
    name: '批次名片整理',
    desc: '批次處理多張名片，匯出客戶資料 CSV',
    icon: Users,
    color: 'from-emerald-500 to-emerald-400',
    apiEndpoint: '/api/extract/business-cards-csv',
    acceptFiles: '.jpg,.jpeg,.png',
    multiple: true,
    requiresApiKey: true,
    instructions: [
      '選擇多張名片圖片',
      '輸入您的 Gemini API Key',
      '系統自動辨識並匯出 CSV'
    ],
  },
}

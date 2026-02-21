'use client'

import { useState, useCallback, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  NodeTypes,
  Panel,
  BackgroundVariant,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { WorkflowPageSkeleton } from '@/components/ui/Skeleton'
import {
  Play, Save, FolderOpen, Trash2, Settings,
  FileText, Layers, Wand2, Eye, Download, Upload,
  GitCompare, Shield, Table, Tag, FileSearch, Languages,
  Scissors, Minimize2, Droplets, Lock,
  ArrowRight, Cpu, HelpCircle, X as CloseIcon,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  Grid3X3, AlertCircle, Plus, Clock, CheckCircle, XCircle,
  Loader2, FileDown
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

// ============ 節點類型定義 ============

interface NodeData extends Record<string, unknown> {
  label: string
  description?: string
  category?: string
  icon?: React.ReactNode
  params?: Record<string, unknown>
  nodeType?: string
}

// 節點類別顏色
const categoryColors: Record<string, string> = {
  input: 'bg-green-500',
  pdf: 'bg-blue-500',
  convert: 'bg-orange-500',
  ai: 'bg-purple-500',
  ocr: 'bg-cyan-500',
  logic: 'bg-yellow-500',
  output: 'bg-red-500',
}

// 節點類別圖示
const categoryIcons: Record<string, React.ReactNode> = {
  input: <Upload className="w-4 h-4" />,
  pdf: <FileText className="w-4 h-4" />,
  convert: <ArrowRight className="w-4 h-4" />,
  ai: <Wand2 className="w-4 h-4" />,
  ocr: <Eye className="w-4 h-4" />,
  logic: <Cpu className="w-4 h-4" />,
  output: <Download className="w-4 h-4" />,
}

// 參數定義類型
interface ParamDefinition {
  id: string
  label: string
  type: 'text' | 'number' | 'select' | 'checkbox' | 'password' | 'textarea' | 'file'
  placeholder?: string
  default?: string | number | boolean
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  required?: boolean
  description?: string
}

// 連接規則定義
interface ConnectionRule {
  canHaveInput: boolean      // 是否可以有輸入連線
  canHaveOutput: boolean     // 是否可以有輸出連線
  maxInputs: number          // 最大輸入數量（-1 = 無限）
  maxOutputs: number         // 最大輸出數量（-1 = 無限）
  acceptsFrom?: string[]     // 可接受的來源節點類型（空 = 全部）
  outputsTo?: string[]       // 可輸出到的目標節點類型（空 = 全部）
}

const connectionRules: Record<string, ConnectionRule> = {
  // 輸入節點：只能輸出，不能接收
  input_file: { canHaveInput: false, canHaveOutput: true, maxInputs: 0, maxOutputs: -1 },
  input_folder: { canHaveInput: false, canHaveOutput: true, maxInputs: 0, maxOutputs: -1 },

  // PDF 操作：可接收可輸出
  pdf_merge: { canHaveInput: true, canHaveOutput: true, maxInputs: -1, maxOutputs: -1 },
  pdf_split: { canHaveInput: true, canHaveOutput: true, maxInputs: 1, maxOutputs: -1 },
  pdf_compress: { canHaveInput: true, canHaveOutput: true, maxInputs: 1, maxOutputs: -1 },
  pdf_watermark: { canHaveInput: true, canHaveOutput: true, maxInputs: 1, maxOutputs: -1 },
  pdf_encrypt: { canHaveInput: true, canHaveOutput: true, maxInputs: 1, maxOutputs: -1 },

  // AI 功能
  ai_compare: { canHaveInput: true, canHaveOutput: true, maxInputs: 2, maxOutputs: -1 }, // 需要 2 個輸入
  ai_pii_detect: { canHaveInput: true, canHaveOutput: true, maxInputs: 1, maxOutputs: -1 },
  ai_extract_table: { canHaveInput: true, canHaveOutput: true, maxInputs: 1, maxOutputs: -1 },
  ai_smart_rename: { canHaveInput: true, canHaveOutput: true, maxInputs: 1, maxOutputs: -1 },
  ai_summarize: { canHaveInput: true, canHaveOutput: true, maxInputs: 1, maxOutputs: -1 },
  ai_translate: { canHaveInput: true, canHaveOutput: true, maxInputs: 1, maxOutputs: -1 },

  // 轉換
  convert_to_image: { canHaveInput: true, canHaveOutput: true, maxInputs: 1, maxOutputs: -1 },

  // 輸出節點：只能接收，不能輸出
  output_save: { canHaveInput: true, canHaveOutput: false, maxInputs: -1, maxOutputs: 0 },
}

// 所有可用節點類型（含參數定義）
const nodeTypeDefinitions: Array<{
  type: string
  category: string
  label: string
  icon: React.ReactNode
  params?: ParamDefinition[]
}> = [
  // 輸入
  { type: 'input_file', category: 'input', label: '檔案輸入', icon: <Upload className="w-4 h-4" />,
    params: [
      { id: 'file_types', label: '檔案類型篩選', type: 'select', default: 'pdf', options: [
        { value: 'pdf', label: '僅 PDF 檔案' },
        { value: 'all', label: '所有支援格式' },
        { value: 'images', label: '圖片檔案（JPG/PNG）' },
      ]},
      { id: 'description', label: '說明標籤', type: 'text', placeholder: '例如：合約文件', description: '方便辨識這個輸入的用途' },
    ]
  },
  { type: 'input_folder', category: 'input', label: '資料夾輸入', icon: <FolderOpen className="w-4 h-4" />,
    params: [
      { id: 'recursive', label: '包含子資料夾', type: 'checkbox', default: false, description: '遞迴搜尋所有子目錄' },
      { id: 'file_types', label: '檔案類型篩選', type: 'select', default: 'pdf', options: [
        { value: 'pdf', label: '僅 PDF 檔案' },
        { value: 'all', label: '所有支援格式' },
        { value: 'images', label: '圖片檔案（JPG/PNG）' },
      ]},
      { id: 'pattern', label: '檔名篩選', type: 'text', placeholder: '*.pdf', description: '支援萬用字元，如 report_*.pdf' },
      { id: 'sort_by', label: '排序方式', type: 'select', default: 'name', options: [
        { value: 'name', label: '依檔名' },
        { value: 'date', label: '依日期' },
        { value: 'size', label: '依檔案大小' },
      ]},
    ]
  },

  // PDF 操作
  { type: 'pdf_merge', category: 'pdf', label: '合併 PDF', icon: <Layers className="w-4 h-4" />,
    params: [
      { id: 'order', label: '合併順序', type: 'select', default: 'input', options: [
        { value: 'input', label: '依輸入順序' },
        { value: 'name_asc', label: '依檔名升序' },
        { value: 'name_desc', label: '依檔名降序' },
      ]},
    ]
  },
  { type: 'pdf_split', category: 'pdf', label: '分割 PDF', icon: <Scissors className="w-4 h-4" />,
    params: [
      { id: 'mode', label: '分割模式', type: 'select', default: 'pages', options: [
        { value: 'pages', label: '依頁面範圍' },
        { value: 'every', label: '每 N 頁分割' },
        { value: 'single', label: '每頁單獨' },
      ]},
      { id: 'pages', label: '頁面範圍', type: 'text', placeholder: '1-3,5,7-10', description: '用逗號分隔多個範圍' },
      { id: 'every_n', label: '每 N 頁', type: 'number', default: 1, min: 1, max: 100 },
    ]
  },
  { type: 'pdf_compress', category: 'pdf', label: '壓縮 PDF', icon: <Minimize2 className="w-4 h-4" />,
    params: [
      { id: 'quality', label: '壓縮品質', type: 'select', default: 'medium', options: [
        { value: 'low', label: '低品質（檔案最小）' },
        { value: 'medium', label: '中品質（平衡）' },
        { value: 'high', label: '高品質（檔案較大）' },
      ]},
      { id: 'compress_images', label: '壓縮圖片', type: 'checkbox', default: true },
    ]
  },
  { type: 'pdf_watermark', category: 'pdf', label: '加浮水印', icon: <Droplets className="w-4 h-4" />,
    params: [
      { id: 'watermark_type', label: '浮水印類型', type: 'select', default: 'text', options: [
        { value: 'text', label: '文字浮水印' },
        { value: 'image', label: '圖片浮水印' },
      ]},
      { id: 'text', label: '浮水印文字', type: 'text', placeholder: '機密文件', description: '支援中英文' },
      { id: 'image_url', label: '圖片 URL', type: 'text', placeholder: 'https://...', description: '支援 PNG（去背）、JPG' },
      { id: 'position', label: '位置', type: 'select', default: 'center', options: [
        { value: 'center', label: '置中' },
        { value: 'top-left', label: '左上' },
        { value: 'top-right', label: '右上' },
        { value: 'bottom-left', label: '左下' },
        { value: 'bottom-right', label: '右下' },
        { value: 'tile', label: '平鋪' },
      ]},
      { id: 'opacity', label: '透明度 %', type: 'number', default: 30, min: 5, max: 100 },
      { id: 'rotation', label: '旋轉角度', type: 'number', default: -45, min: -180, max: 180 },
      { id: 'font_size', label: '字體大小', type: 'number', default: 48, min: 12, max: 200 },
      { id: 'color', label: '顏色', type: 'select', default: '#808080', options: [
        { value: '#808080', label: '灰色' },
        { value: '#ff0000', label: '紅色' },
        { value: '#0000ff', label: '藍色' },
        { value: '#000000', label: '黑色' },
      ]},
    ]
  },
  { type: 'pdf_encrypt', category: 'pdf', label: '加密 PDF', icon: <Lock className="w-4 h-4" />,
    params: [
      { id: 'user_password', label: '開啟密碼', type: 'password', placeholder: '使用者需輸入此密碼才能開啟', required: true },
      { id: 'owner_password', label: '權限密碼', type: 'password', placeholder: '限制編輯/列印（可選）' },
      { id: 'allow_print', label: '允許列印', type: 'checkbox', default: true },
      { id: 'allow_copy', label: '允許複製文字', type: 'checkbox', default: false },
      { id: 'allow_edit', label: '允許編輯', type: 'checkbox', default: false },
    ]
  },

  // AI
  { type: 'ai_compare', category: 'ai', label: 'AI 合約比對', icon: <GitCompare className="w-4 h-4" />,
    params: [
      { id: 'focus', label: '比對重點', type: 'select', default: 'all', options: [
        { value: 'all', label: '全文比對' },
        { value: 'clauses', label: '重要條款' },
        { value: 'numbers', label: '金額數字' },
        { value: 'dates', label: '日期時間' },
      ]},
      { id: 'output_format', label: '輸出格式', type: 'select', default: 'summary', options: [
        { value: 'summary', label: '摘要報告' },
        { value: 'detailed', label: '詳細對照' },
        { value: 'highlight', label: '標記差異 PDF' },
      ]},
    ]
  },
  { type: 'ai_pii_detect', category: 'ai', label: 'AI 個資偵測', icon: <Shield className="w-4 h-4" />,
    params: [
      { id: 'action', label: '處理方式', type: 'select', default: 'detect', options: [
        { value: 'detect', label: '僅偵測回報' },
        { value: 'redact', label: '自動遮蔽' },
        { value: 'highlight', label: '螢光標記' },
      ]},
      { id: 'pii_types', label: '偵測類型', type: 'select', default: 'all', options: [
        { value: 'all', label: '所有個資' },
        { value: 'id_card', label: '身分證字號' },
        { value: 'phone', label: '電話號碼' },
        { value: 'email', label: 'Email' },
        { value: 'address', label: '地址' },
        { value: 'credit_card', label: '信用卡號' },
      ]},
    ]
  },
  { type: 'ai_extract_table', category: 'ai', label: 'AI 表格提取', icon: <Table className="w-4 h-4" />,
    params: [
      { id: 'output_format', label: '輸出格式', type: 'select', default: 'excel', options: [
        { value: 'excel', label: 'Excel (.xlsx)' },
        { value: 'csv', label: 'CSV' },
        { value: 'json', label: 'JSON' },
      ]},
      { id: 'merge_tables', label: '合併所有表格', type: 'checkbox', default: false },
    ]
  },
  { type: 'ai_smart_rename', category: 'ai', label: 'AI 智能重命名', icon: <Tag className="w-4 h-4" />,
    params: [
      { id: 'pattern', label: '命名規則', type: 'text', placeholder: '{日期}_{標題}_{頁數}', description: '可用變數：{日期} {標題} {頁數} {類型}' },
      { id: 'date_format', label: '日期格式', type: 'select', default: 'YYYY-MM-DD', options: [
        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
        { value: 'YYYYMMDD', label: 'YYYYMMDD' },
        { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' },
      ]},
    ]
  },
  { type: 'ai_summarize', category: 'ai', label: 'AI 摘要', icon: <FileSearch className="w-4 h-4" />,
    params: [
      { id: 'length', label: '摘要長度', type: 'select', default: 'medium', options: [
        { value: 'short', label: '簡短（100字內）' },
        { value: 'medium', label: '中等（300字內）' },
        { value: 'long', label: '詳細（500字內）' },
      ]},
      { id: 'language', label: '輸出語言', type: 'select', default: 'zh-TW', options: [
        { value: 'zh-TW', label: '繁體中文' },
        { value: 'zh-CN', label: '簡體中文' },
        { value: 'en', label: 'English' },
        { value: 'ja', label: '日本語' },
      ]},
      { id: 'include_keywords', label: '包含關鍵字', type: 'checkbox', default: true },
    ]
  },
  { type: 'ai_translate', category: 'ai', label: 'AI 翻譯', icon: <Languages className="w-4 h-4" />,
    params: [
      { id: 'target_language', label: '目標語言', type: 'select', default: 'zh-TW', required: true, options: [
        { value: 'zh-TW', label: '繁體中文' },
        { value: 'zh-CN', label: '簡體中文' },
        { value: 'en', label: 'English' },
        { value: 'ja', label: '日本語' },
        { value: 'ko', label: '한국어' },
        { value: 'de', label: 'Deutsch' },
        { value: 'fr', label: 'Français' },
        { value: 'es', label: 'Español' },
      ]},
      { id: 'keep_layout', label: '保留原始排版', type: 'checkbox', default: true },
      { id: 'glossary', label: '專業術語表', type: 'textarea', placeholder: '原文=譯文（每行一組）', description: '自訂翻譯對照，例如：AI=人工智慧' },
    ]
  },

  // 轉換
  { type: 'convert_to_image', category: 'convert', label: '轉為圖片', icon: <ArrowRight className="w-4 h-4" />,
    params: [
      { id: 'format', label: '圖片格式', type: 'select', default: 'png', options: [
        { value: 'png', label: 'PNG' },
        { value: 'jpg', label: 'JPG' },
        { value: 'webp', label: 'WebP' },
      ]},
      { id: 'dpi', label: '解析度 (DPI)', type: 'number', default: 150, min: 72, max: 600 },
      { id: 'pages', label: '頁面範圍', type: 'text', placeholder: '全部（或 1-3,5）' },
    ]
  },

  // 輸出
  { type: 'output_save', category: 'output', label: '儲存檔案', icon: <Download className="w-4 h-4" />,
    params: [
      { id: 'filename_pattern', label: '檔名格式', type: 'text', default: '{原檔名}_processed', placeholder: '{原檔名}_processed' },
      { id: 'create_zip', label: '多檔案時打包 ZIP', type: 'checkbox', default: true },
    ]
  },
]

// ============ 自訂節點元件 ============

function WorkflowNode({ data, selected }: { data: NodeData; selected: boolean }) {
  const bgColor = categoryColors[data.category || 'pdf'] || 'bg-gray-500'

  return (
    <div
      className={`
        px-4 py-3 shadow-lg rounded-lg border-2 bg-white min-w-[180px] relative
        ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}
        hover:shadow-xl transition-all
      `}
    >
      {/* 輸入連接點 (左側) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white !-left-2"
        style={{ top: '50%' }}
      />

      {/* 標題列 */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center text-white`}>
          {data.icon || categoryIcons[data.category || 'pdf']}
        </div>
        <div>
          <div className="font-semibold text-gray-800 text-sm">{data.label}</div>
          {data.description && (
            <div className="text-xs text-gray-500">{data.description}</div>
          )}
        </div>
      </div>

      {/* 輸入輸出標籤 */}
      <div className="flex justify-between text-xs text-gray-400 mt-2 pt-2 border-t">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          輸入
        </span>
        <span className="flex items-center gap-1">
          輸出
          <span className="w-2 h-2 rounded-full bg-green-400"></span>
        </span>
      </div>

      {/* 輸出連接點 (右側) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-green-500 !border-2 !border-white !-right-2"
        style={{ top: '50%' }}
      />
    </div>
  )
}

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
}

// ============ 主元件 ============

function WorkflowEditorContent() {
  const searchParams = useSearchParams()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [workflowName, setWorkflowName] = useState('新工作流')
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<Record<string, unknown> | null>(null)
  const [showNodePanel, setShowNodePanel] = useState(true)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [showHelp, setShowHelp] = useState(true) // 預設顯示操作說明
  const [fromUpload, setFromUpload] = useState(false) // 是否從首頁上傳進入

  // 連接驗證錯誤訊息
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // 從首頁上傳進入時，讀取檔案
  useEffect(() => {
    const isFromUpload = searchParams.get('from') === 'upload'
    if (isFromUpload) {
      setFromUpload(true)
      const storedFiles = sessionStorage.getItem('workflow-upload-files')
      if (storedFiles) {
        try {
          const filesData = JSON.parse(storedFiles) as Array<{
            name: string
            type: string
            size: number
            data: string
          }>

          // 將 base64 資料轉回 File 物件
          const files = filesData.map((fileData) => {
            // 從 data URL 提取 base64 內容
            const [, base64Content] = fileData.data.split(',')
            const binaryString = atob(base64Content)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            const blob = new Blob([bytes], { type: fileData.type })
            return new File([blob], fileData.name, { type: fileData.type })
          })

          setUploadedFiles(files)

          // 清除 sessionStorage
          sessionStorage.removeItem('workflow-upload-files')

          // 自動新增輸入檔案節點
          if (files.length > 0) {
            const inputNodes: Node<NodeData>[] = files.map((file, index) => ({
              id: `input_file-${Date.now()}-${index}`,
              type: 'workflowNode',
              position: { x: 100, y: 100 + index * 120 },
              data: {
                label: file.name,
                category: 'input',
                nodeType: 'input_file',
                description: `輸入檔案: ${file.name}`,
                params: { filename: file.name },
              },
            }))
            setNodes(inputNodes)
          }
        } catch (error) {
          console.error('讀取上傳檔案失敗:', error)
        }
      }
    }
  }, [searchParams, setNodes])

  // 載入工作流相關狀態
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [savedWorkflows, setSavedWorkflows] = useState<Array<{
    id: string
    name: string
    description: string
    node_count: number
    created_at: string
    updated_at: string
  }>>([])
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false)

  // 驗證連接是否合法
  const validateConnection = useCallback((source: string, target: string): { valid: boolean; error?: string } => {
    // 找出來源和目標節點
    const sourceNode = nodes.find(n => n.id === source)
    const targetNode = nodes.find(n => n.id === target)

    if (!sourceNode || !targetNode) {
      return { valid: false, error: '找不到節點' }
    }

    const sourceType = (sourceNode.data as NodeData).nodeType || ''
    const targetType = (targetNode.data as NodeData).nodeType || ''

    const sourceRule = connectionRules[sourceType]
    const targetRule = connectionRules[targetType]

    // 檢查來源節點是否可以輸出
    if (sourceRule && !sourceRule.canHaveOutput) {
      return { valid: false, error: `「${(sourceNode.data as NodeData).label}」不能作為輸出來源` }
    }

    // 檢查目標節點是否可以接收輸入
    if (targetRule && !targetRule.canHaveInput) {
      return { valid: false, error: `「${(targetNode.data as NodeData).label}」不能接收輸入` }
    }

    // 檢查目標節點輸入數量限制
    if (targetRule && targetRule.maxInputs > 0) {
      const currentInputCount = edges.filter(e => e.target === target).length
      if (currentInputCount >= targetRule.maxInputs) {
        if (targetType === 'ai_compare') {
          return { valid: false, error: `「AI 合約比對」已連接 ${currentInputCount} 個輸入（最多 2 個）` }
        }
        return { valid: false, error: `「${(targetNode.data as NodeData).label}」已達最大輸入數量（${targetRule.maxInputs}）` }
      }
    }

    // 防止自己連自己
    if (source === target) {
      return { valid: false, error: '不能連接到自己' }
    }

    // 防止重複連接
    const existingEdge = edges.find(e => e.source === source && e.target === target)
    if (existingEdge) {
      return { valid: false, error: '已經存在相同的連接' }
    }

    return { valid: true }
  }, [nodes, edges])

  // 連接節點（含驗證）
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return

      const validation = validateConnection(params.source, params.target)

      if (!validation.valid) {
        setConnectionError(validation.error || '無法建立連接')
        setTimeout(() => setConnectionError(null), 3000)
        return
      }

      setEdges((eds) => addEdge({
        ...params,
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 }
      }, eds))
    },
    [setEdges, validateConnection]
  )

  // 拖放新增節點
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow-type')
      const label = event.dataTransfer.getData('application/reactflow-label')
      const category = event.dataTransfer.getData('application/reactflow-category')

      if (!type || !reactFlowWrapper.current) return

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      }

      const newNode: Node<NodeData> = {
        id: `${type}-${Date.now()}`,
        type: 'workflowNode',
        position,
        data: {
          label,
          category,
          nodeType: type,
          params: {},
        },
      }

      setNodes((nds) => [...nds, newNode])
    },
    [setNodes]
  )

  // 節點點擊
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  // 刪除選中節點
  const deleteSelectedNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id))
      setEdges((eds) => eds.filter(
        (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
      ))
      setSelectedNode(null)
    }
  }, [selectedNode, setNodes, setEdges])

  // 自動水平對齊
  const alignNodesHorizontally = useCallback(() => {
    if (nodes.length < 2) return

    // 找出所有節點的平均 Y 位置
    const avgY = nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        position: { ...n.position, y: avgY },
      }))
    )
  }, [nodes, setNodes])

  // 自動垂直對齊
  const alignNodesVertically = useCallback(() => {
    if (nodes.length < 2) return

    // 找出所有節點的平均 X 位置
    const avgX = nodes.reduce((sum, n) => sum + n.position.x, 0) / nodes.length

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        position: { ...n.position, x: avgX },
      }))
    )
  }, [nodes, setNodes])

  // 自動排列（依照連接順序）
  const autoArrangeNodes = useCallback(() => {
    if (nodes.length === 0) return

    const HORIZONTAL_GAP = 250
    const VERTICAL_GAP = 120
    const START_X = 100
    const START_Y = 100

    // 找出所有輸入節點（沒有輸入連線的節點）
    const inputNodeIds = new Set(
      nodes
        .filter((n) => {
          const nodeType = (n.data as NodeData).nodeType || ''
          return nodeType.startsWith('input_') || !edges.some((e) => e.target === n.id)
        })
        .map((n) => n.id)
    )

    // BFS 排列節點
    const visited = new Set<string>()
    const levels: string[][] = []
    let currentLevel = Array.from(inputNodeIds)

    while (currentLevel.length > 0) {
      levels.push(currentLevel)
      currentLevel.forEach((id) => visited.add(id))

      const nextLevel: string[] = []
      currentLevel.forEach((nodeId) => {
        edges
          .filter((e) => e.source === nodeId)
          .forEach((e) => {
            if (!visited.has(e.target) && !nextLevel.includes(e.target)) {
              nextLevel.push(e.target)
            }
          })
      })
      currentLevel = nextLevel
    }

    // 加入未連接的節點
    nodes.forEach((n) => {
      if (!visited.has(n.id)) {
        levels.push([n.id])
        visited.add(n.id)
      }
    })

    // 計算新位置
    const newPositions: Record<string, { x: number; y: number }> = {}
    levels.forEach((level, levelIndex) => {
      const levelY = START_Y + (level.length - 1) * VERTICAL_GAP / 2
      level.forEach((nodeId, nodeIndex) => {
        newPositions[nodeId] = {
          x: START_X + levelIndex * HORIZONTAL_GAP,
          y: levelY - (level.length - 1) * VERTICAL_GAP / 2 + nodeIndex * VERTICAL_GAP,
        }
      })
    })

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        position: newPositions[n.id] || n.position,
      }))
    )
  }, [nodes, edges, setNodes])

  // 儲存工作流
  const saveWorkflow = async () => {
    const workflow = {
      id: workflowId || undefined,
      name: workflowName,
      description: '',
      nodes: nodes.map((n) => ({
        id: n.id,
        type: (n.data as NodeData & { nodeType?: string }).nodeType || n.type,
        position: n.position,
        config: {
          label: (n.data as NodeData).label,
          description: (n.data as NodeData).description || '',
          params: (n.data as NodeData).params || {},
        },
      })),
      connections: edges.map((e) => ({
        id: e.id,
        source_node: e.source,
        target_node: e.target,
        source_handle: e.sourceHandle || 'output',
        target_handle: e.targetHandle || 'input',
      })),
    }

    try {
      const response = await fetch(`${API_URL}/api/workflow/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow),
      })

      const result = await response.json()

      if (result.success) {
        setWorkflowId(result.workflow_id)
        alert('工作流已儲存！')
      } else {
        alert('儲存失敗：' + (result.detail || '未知錯誤'))
      }
    } catch (error) {
      alert('儲存失敗：' + (error as Error).message)
    }
  }

  // 執行工作流
  const executeWorkflow = async () => {
    if (!workflowId) {
      alert('請先儲存工作流')
      return
    }

    if (uploadedFiles.length === 0) {
      alert('請先上傳檔案')
      return
    }

    setIsExecuting(true)
    setExecutionResult(null)

    try {
      const formData = new FormData()
      uploadedFiles.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch(`${API_URL}/api/workflow/${workflowId}/execute`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      setExecutionResult(result)

      if (result.success) {
        alert('工作流執行完成！')
      } else {
        alert('執行失敗：' + (result.error || '未知錯誤'))
      }
    } catch (error) {
      alert('執行失敗：' + (error as Error).message)
    } finally {
      setIsExecuting(false)
    }
  }

  // 處理檔案上傳
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files))
    }
  }

  // 載入已保存的工作流列表
  const loadWorkflowList = async () => {
    setIsLoadingWorkflows(true)
    try {
      const response = await fetch(`${API_URL}/api/workflow/list`)
      const result = await response.json()
      // API 回應格式: { workflows: [], count: 0 }
      if (result.workflows !== undefined) {
        setSavedWorkflows(result.workflows || [])
      } else if (result.detail) {
        console.error('載入工作流列表失敗:', result.detail)
      }
    } catch (error) {
      console.error('載入工作流列表失敗:', error)
    } finally {
      setIsLoadingWorkflows(false)
    }
  }

  // 開啟載入工作流 Modal
  const openLoadModal = async () => {
    setShowLoadModal(true)
    await loadWorkflowList()
  }

  // 載入指定工作流
  const loadWorkflow = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/workflow/${id}`)
      const result = await response.json()

      // API 直接返回 workflow 物件，錯誤時返回 {detail: ...}
      if (result.detail) {
        alert('載入工作流失敗：' + result.detail)
        return
      }

      const workflow = result

      // 轉換節點格式
      const loadedNodes: Node<NodeData>[] = (workflow.nodes || []).map((n: {
        id: string
        type: string
        position: { x: number; y: number }
        config: { label: string; description?: string; params?: Record<string, unknown> }
      }) => {
        const nodeDef = nodeTypeDefinitions.find(def => def.type === n.type)
        return {
          id: n.id,
          type: 'workflowNode',
          position: n.position,
          data: {
            label: n.config?.label || nodeDef?.label || n.type,
            category: nodeDef?.category || 'pdf',
            nodeType: n.type,
            description: n.config?.description || '',
            params: n.config?.params || {},
          },
        }
      })

      // 轉換連接格式
      const loadedEdges: Edge[] = (workflow.connections || []).map((c: {
        id: string
        source_node: string
        target_node: string
      }) => ({
        id: c.id,
        source: c.source_node,
        target: c.target_node,
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 },
      }))

      setNodes(loadedNodes)
      setEdges(loadedEdges)
      setWorkflowName(workflow.name || '載入的工作流')
      setWorkflowId(id)
      setShowLoadModal(false)
      setSelectedNode(null)
      setExecutionResult(null)
    } catch (error) {
      alert('載入工作流失敗：' + (error as Error).message)
    }
  }

  // 清空畫布（新增工作流）
  const clearCanvas = () => {
    if (nodes.length > 0) {
      const confirmed = window.confirm('確定要清空畫布嗎？未儲存的變更將會遺失。')
      if (!confirmed) return
    }
    setNodes([])
    setEdges([])
    setWorkflowName('新工作流')
    setWorkflowId(null)
    setSelectedNode(null)
    setExecutionResult(null)
    setUploadedFiles([])
  }

  // 下載輸出檔案
  const downloadOutputFile = async (filepath: string) => {
    try {
      // 從完整路徑提取檔名
      const filename = filepath.split(/[/\\]/).pop() || 'download'
      const downloadUrl = `${API_URL}/api/workflow/download?filepath=${encodeURIComponent(filepath)}`

      const response = await fetch(downloadUrl)
      if (!response.ok) {
        throw new Error('下載失敗')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      alert('下載失敗：' + (error as Error).message)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* 從首頁上傳的歡迎提示 */}
      {fromUpload && uploadedFiles.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">
              已載入 {uploadedFiles.length} 個檔案！
            </span>
            <span className="text-emerald-100">
              現在可以從左側拖曳節點來建立工作流程，然後點擊「執行」處理檔案
            </span>
          </div>
          <button
            onClick={() => setFromUpload(false)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 頂部工具列 */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="text-xl font-bold border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2"
          />
          <span className="text-gray-400 text-sm">
            {nodes.length} 個節點 · {edges.length} 個連接
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 新增工作流 */}
          <button
            onClick={clearCanvas}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-sm"
            title="新增工作流（清空畫布）"
          >
            <Plus className="w-4 h-4" />
            新增
          </button>

          {/* 開啟已保存的工作流 */}
          <button
            onClick={openLoadModal}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-sm"
            title="開啟已保存的工作流"
          >
            <FolderOpen className="w-4 h-4" />
            開啟
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* 檔案上傳 */}
          <label className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4" />
            上傳檔案 {uploadedFiles.length > 0 && `(${uploadedFiles.length})`}
            <input
              type="file"
              multiple
              accept=".pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          <button
            onClick={saveWorkflow}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            儲存
          </button>

          <button
            onClick={executeWorkflow}
            disabled={isExecuting}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              isExecuting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isExecuting ? '執行中...' : '執行'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* 左側節點面板 */}
        {showNodePanel && (
          <div className="w-64 bg-white border-r overflow-y-auto">
            <div className="p-4">
              <h3 className="font-semibold text-gray-700 mb-3">節點工具箱</h3>
              <p className="text-xs text-gray-500 mb-4">拖曳節點到畫布上</p>

              {/* 按類別分組 */}
              {Object.entries(
                nodeTypeDefinitions.reduce((acc, node) => {
                  if (!acc[node.category]) acc[node.category] = []
                  acc[node.category].push(node)
                  return acc
                }, {} as Record<string, typeof nodeTypeDefinitions>)
              ).map(([category, categoryNodes]) => (
                <div key={category} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded ${categoryColors[category]}`} />
                    <span className="text-sm font-medium text-gray-600 capitalize">
                      {category === 'input' && '輸入'}
                      {category === 'pdf' && 'PDF 操作'}
                      {category === 'convert' && '轉換'}
                      {category === 'ai' && 'AI 功能'}
                      {category === 'ocr' && 'OCR'}
                      {category === 'output' && '輸出'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {categoryNodes.map((node) => (
                      <div
                        key={node.type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/reactflow-type', node.type)
                          e.dataTransfer.setData('application/reactflow-label', node.label)
                          e.dataTransfer.setData('application/reactflow-category', node.category)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        className={`
                          flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab
                          bg-gray-50 hover:bg-gray-100 border border-gray-200
                          hover:border-gray-300 transition-all text-sm
                        `}
                      >
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${categoryColors[node.category]} text-white`}>
                          {node.icon}
                        </div>
                        <span className="text-gray-700">{node.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 主畫布區域 */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: '#6366f1', strokeWidth: 2 },
            }}
          >
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                const category = (node.data as NodeData).category || 'pdf'
                const colorMap: Record<string, string> = {
                  input: '#22c55e',
                  pdf: '#3b82f6',
                  convert: '#f97316',
                  ai: '#a855f7',
                  ocr: '#06b6d4',
                  logic: '#eab308',
                  output: '#ef4444',
                }
                return colorMap[category] || '#6b7280'
              }}
            />
            <Background variant={BackgroundVariant.Dots} gap={15} size={1} />

            {/* 空白提示 */}
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div className="bg-white/90 backdrop-blur px-6 py-4 rounded-lg shadow-lg text-center mt-20">
                  <Wand2 className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-800 mb-1">開始建立工作流</h3>
                  <p className="text-sm text-gray-500">
                    從左側拖曳節點到這裡，然後連接它們
                  </p>
                </div>
              </Panel>
            )}

            {/* 操作說明面板 */}
            {showHelp && (
              <Panel position="top-right">
                <div className="bg-white/95 backdrop-blur shadow-lg rounded-lg p-4 m-2 max-w-xs border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-blue-500" />
                      <h4 className="font-semibold text-gray-800">操作說明</h4>
                    </div>
                    <button
                      onClick={() => setShowHelp(false)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <CloseIcon className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">1</span>
                      <div>
                        <p className="font-medium text-gray-700">新增節點</p>
                        <p className="text-gray-500 text-xs">從左側工具箱拖曳節點到畫布</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">2</span>
                      <div>
                        <p className="font-medium text-gray-700">連接節點</p>
                        <p className="text-gray-500 text-xs">從節點右側的<span className="text-green-500 font-bold">●綠點</span>拖曳到另一節點左側的<span className="text-blue-500 font-bold">●藍點</span></p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">3</span>
                      <div>
                        <p className="font-medium text-gray-700">設定參數</p>
                        <p className="text-gray-500 text-xs">點擊節點後，在右側面板調整設定</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-medium">4</span>
                      <div>
                        <p className="font-medium text-gray-700">刪除節點</p>
                        <p className="text-gray-500 text-xs">點擊節點選取 → 右側面板點<span className="text-red-500 font-bold">🗑️垃圾桶</span>刪除</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">5</span>
                      <div>
                        <p className="font-medium text-gray-700">執行工作流</p>
                        <p className="text-gray-500 text-xs">上傳檔案 → 儲存 → 執行</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t text-xs text-gray-400">
                    💡 提示：可以用滾輪縮放畫布，拖曳空白處移動視角
                  </div>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* 右側屬性面板 */}
        {selectedNode && (
          <div className="w-72 bg-white border-l overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700">節點設定</h3>
                <button
                  onClick={deleteSelectedNode}
                  className="p-2 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    名稱
                  </label>
                  <input
                    type="text"
                    value={(selectedNode.data as NodeData).label}
                    onChange={(e) => {
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, label: e.target.value } }
                            : n
                        )
                      )
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    節點 ID
                  </label>
                  <input
                    type="text"
                    value={selectedNode.id}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    類別
                  </label>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded ${categoryColors[(selectedNode.data as NodeData).category || 'pdf']}`} />
                    <span className="text-gray-700 capitalize">
                      {(selectedNode.data as NodeData).category}
                    </span>
                  </div>
                </div>

                {/* 節點參數設定 */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-600 mb-3">參數設定</h4>
                  {(() => {
                    const nodeType = (selectedNode.data as NodeData).nodeType
                    const nodeDef = nodeTypeDefinitions.find(n => n.type === nodeType)
                    const params = nodeDef?.params || []

                    if (params.length === 0) {
                      return (
                        <p className="text-xs text-gray-400">
                          此節點無需設定參數
                        </p>
                      )
                    }

                    const currentParams = (selectedNode.data as NodeData).params || {}

                    const updateParam = (paramId: string, value: unknown) => {
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? {
                                ...n,
                                data: {
                                  ...n.data,
                                  params: {
                                    ...((n.data as NodeData).params || {}),
                                    [paramId]: value,
                                  },
                                },
                              }
                            : n
                        )
                      )
                    }

                    return (
                      <div className="space-y-4">
                        {params.map((param) => (
                          <div key={param.id}>
                            <label className="block text-sm font-medium text-gray-600 mb-1">
                              {param.label}
                              {param.required && <span className="text-red-500 ml-1">*</span>}
                            </label>

                            {param.type === 'text' && (
                              <input
                                type="text"
                                value={(currentParams[param.id] as string) ?? param.default ?? ''}
                                onChange={(e) => updateParam(param.id, e.target.value)}
                                placeholder={param.placeholder}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            )}

                            {param.type === 'password' && (
                              <input
                                type="password"
                                value={(currentParams[param.id] as string) ?? ''}
                                onChange={(e) => updateParam(param.id, e.target.value)}
                                placeholder={param.placeholder}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            )}

                            {param.type === 'number' && (
                              <input
                                type="number"
                                value={(currentParams[param.id] as number) ?? param.default ?? 0}
                                onChange={(e) => updateParam(param.id, Number(e.target.value))}
                                min={param.min}
                                max={param.max}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            )}

                            {param.type === 'select' && (
                              <select
                                value={(currentParams[param.id] as string) ?? param.default ?? ''}
                                onChange={(e) => updateParam(param.id, e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              >
                                {param.options?.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            )}

                            {param.type === 'checkbox' && (
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={(currentParams[param.id] as boolean) ?? param.default ?? false}
                                  onChange={(e) => updateParam(param.id, e.target.checked)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-600">啟用</span>
                              </label>
                            )}

                            {param.type === 'textarea' && (
                              <textarea
                                value={(currentParams[param.id] as string) ?? ''}
                                onChange={(e) => updateParam(param.id, e.target.value)}
                                placeholder={param.placeholder}
                                rows={3}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            )}

                            {param.description && (
                              <p className="text-xs text-gray-400 mt-1">{param.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 執行結果面板 */}
      {executionResult && (
        <div className="bg-white border-t p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              {(executionResult as { success?: boolean }).success ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              執行結果
            </h3>
            <button
              onClick={() => setExecutionResult(null)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <CloseIcon className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {(executionResult as { success?: boolean }).success ? (
            <div className="space-y-3">
              {/* 輸出檔案列表 */}
              {(executionResult as { output_files?: string[] }).output_files &&
                (executionResult as { output_files: string[] }).output_files.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-2">輸出檔案</h4>
                  <div className="space-y-2">
                    {(executionResult as { output_files: string[] }).output_files.map((filepath, index) => {
                      const filename = filepath.split(/[/\\]/).pop() || `file-${index}`
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg"
                        >
                          <span className="flex items-center gap-2 text-sm text-gray-700">
                            <FileDown className="w-4 h-4 text-blue-500" />
                            {filename}
                          </span>
                          <button
                            onClick={() => downloadOutputFile(filepath)}
                            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            下載
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 節點執行詳情 */}
              {(executionResult as { node_results?: Record<string, unknown> }).node_results && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                    查看詳細執行紀錄
                  </summary>
                  <pre className="bg-gray-50 p-3 rounded mt-2 overflow-auto max-h-40 text-xs">
                    {JSON.stringify((executionResult as { node_results: Record<string, unknown> }).node_results, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ) : (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg">
              <p className="font-medium">執行失敗</p>
              <p className="text-sm mt-1">
                {(executionResult as { error?: string }).error || '未知錯誤'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 連接錯誤提示 */}
      {connectionError && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-pulse">
          <div className="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{connectionError}</span>
          </div>
        </div>
      )}

      {/* 載入工作流 Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-500" />
                開啟工作流
              </h2>
              <button
                onClick={() => setShowLoadModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <CloseIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingWorkflows ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <span className="ml-3 text-gray-600">載入中...</span>
                </div>
              ) : savedWorkflows.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">還沒有已保存的工作流</p>
                  <p className="text-sm text-gray-400 mt-1">
                    建立並儲存工作流後，就可以在這裡開啟
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedWorkflows.map((workflow) => (
                    <div
                      key={workflow.id}
                      onClick={() => loadWorkflow(workflow.id)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-800 group-hover:text-blue-600">
                            {workflow.name}
                          </h3>
                          {workflow.description && (
                            <p className="text-sm text-gray-500 mt-1">
                              {workflow.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              {workflow.node_count} 個節點
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(workflow.updated_at).toLocaleDateString('zh-TW', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={loadWorkflowList}
                disabled={isLoadingWorkflows}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600 flex items-center justify-center gap-2"
              >
                {isLoadingWorkflows ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                重新整理
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部按鈕 */}
      <div className="fixed bottom-4 left-4 flex gap-2">
        <button
          onClick={() => setShowNodePanel(!showNodePanel)}
          className="p-3 bg-white shadow-lg rounded-full hover:bg-gray-50"
          title="切換工具箱"
        >
          <Settings className="w-5 h-5 text-gray-600" />
        </button>

        {!showHelp && (
          <button
            onClick={() => setShowHelp(true)}
            className="p-3 bg-white shadow-lg rounded-full hover:bg-gray-50"
            title="顯示操作說明"
          >
            <HelpCircle className="w-5 h-5 text-blue-500" />
          </button>
        )}
      </div>

      {/* 對齊工具列 */}
      <div className="fixed bottom-4 right-4 flex gap-2">
        <div className="bg-white shadow-lg rounded-lg flex items-center overflow-hidden">
          <button
            onClick={alignNodesHorizontally}
            className="p-3 hover:bg-gray-100 border-r border-gray-200"
            title="水平對齊（所有節點對齊到同一水平線）"
          >
            <AlignHorizontalDistributeCenter className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={alignNodesVertically}
            className="p-3 hover:bg-gray-100 border-r border-gray-200"
            title="垂直對齊（所有節點對齊到同一垂直線）"
          >
            <AlignVerticalDistributeCenter className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={autoArrangeNodes}
            className="p-3 hover:bg-gray-100"
            title="自動排列（依連接順序由左至右排列）"
          >
            <Grid3X3 className="w-5 h-5 text-purple-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ 頁面匯出（Suspense 包裝）============

export default function WorkflowEditorPage() {
  return (
    <Suspense fallback={<WorkflowPageSkeleton />}>
      <WorkflowEditorContent />
    </Suspense>
  )
}

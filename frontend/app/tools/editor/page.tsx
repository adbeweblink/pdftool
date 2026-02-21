'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Upload, Download, ZoomIn, ZoomOut,
  Type, Image, PenTool, Highlighter, Square,
  Circle, Trash2, ChevronLeft, ChevronRight,
  X, MousePointer
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'

// PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

// 編輯元素類型
type ElementType = 'text' | 'image' | 'signature' | 'highlight' | 'rectangle' | 'circle'

interface EditorElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  content?: string
  color?: string
  fontSize?: number
  imageData?: string
}

// 工具按鈕元件
function ToolButton({
  icon: Icon,
  label,
  active,
  onClick
}: {
  icon: any
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
        active ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 text-gray-600'
      }`}
      title={label}
    >
      <Icon className="w-5 h-5" />
      <span className="text-xs">{label}</span>
    </button>
  )
}

export default function EditorPage() {
  // 檔案狀態
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [isDragging, setIsDragging] = useState(false)

  // 編輯狀態
  const [tool, setTool] = useState<'select' | ElementType>('select')
  const [elements, setElements] = useState<Record<number, EditorElement[]>>({})
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 })

  // 文字輸入狀態
  const [showTextInput, setShowTextInput] = useState(false)
  const [textInputPos, setTextInputPos] = useState({ x: 0, y: 0 })
  const [textInputValue, setTextInputValue] = useState('')
  const [textColor, setTextColor] = useState('#000000')
  const [textSize, setTextSize] = useState(16)

  // 簽名板狀態
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isSignatureDrawing, setIsSignatureDrawing] = useState(false)

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 處理儲存狀態
  const [isSaving, setIsSaving] = useState(false)

  // 載入 PDF
  const loadPdf = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    setPdfDoc(pdf)
    setNumPages(pdf.numPages)
    setCurrentPage(1)
    setElements({})
    setSelectedElement(null)
  }

  // 渲染當前頁面
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return

    const page = await pdfDoc.getPage(currentPage)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const viewport = page.getViewport({ scale })
    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({
      canvasContext: ctx,
      viewport
    }).promise

    // 渲染編輯元素
    renderElements(ctx)
  }, [pdfDoc, currentPage, scale, elements])

  // 渲染編輯元素
  const renderElements = (ctx: CanvasRenderingContext2D) => {
    const pageElements = elements[currentPage] || []

    pageElements.forEach(el => {
      ctx.save()

      switch (el.type) {
        case 'text':
          ctx.font = `${el.fontSize || 16}px sans-serif`
          ctx.fillStyle = el.color || '#000000'
          ctx.fillText(el.content || '', el.x, el.y + (el.fontSize || 16))
          break

        case 'highlight':
          ctx.fillStyle = el.color || 'rgba(255, 255, 0, 0.3)'
          ctx.fillRect(el.x, el.y, el.width, el.height)
          break

        case 'rectangle':
          ctx.strokeStyle = el.color || '#FF0000'
          ctx.lineWidth = 2
          ctx.strokeRect(el.x, el.y, el.width, el.height)
          break

        case 'circle':
          ctx.strokeStyle = el.color || '#FF0000'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.ellipse(
            el.x + el.width / 2,
            el.y + el.height / 2,
            Math.abs(el.width / 2),
            Math.abs(el.height / 2),
            0, 0, Math.PI * 2
          )
          ctx.stroke()
          break

        case 'image':
        case 'signature':
          if (el.imageData) {
            const img = new window.Image()
            img.src = el.imageData
            ctx.drawImage(img, el.x, el.y, el.width, el.height)
          }
          break
      }

      // 選中邊框
      if (selectedElement === el.id) {
        ctx.strokeStyle = '#0066FF'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(el.x - 2, el.y - 2, el.width + 4, el.height + 4)
        ctx.setLineDash([])
      }

      ctx.restore()
    })
  }

  useEffect(() => {
    renderPage()
  }, [renderPage])

  // 處理檔案上傳
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setPdfFile(file)
      await loadPdf(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') {
      setPdfFile(file)
      await loadPdf(file)
    }
  }

  // 取得 canvas 座標
  const getCanvasCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale
    }
  }

  // 處理 canvas 點擊
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e)

    if (tool === 'select') {
      // 檢查是否點到元素
      const pageElements = elements[currentPage] || []
      const clicked = pageElements.find(el =>
        coords.x >= el.x && coords.x <= el.x + el.width &&
        coords.y >= el.y && coords.y <= el.y + el.height
      )
      setSelectedElement(clicked?.id || null)
    } else if (tool === 'text') {
      setTextInputPos(coords)
      setShowTextInput(true)
    } else if (['highlight', 'rectangle', 'circle'].includes(tool)) {
      setIsDrawing(true)
      setDrawStart(coords)
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return
    const coords = getCanvasCoords(e)

    // 即時預覽（重繪）
    renderPage()

    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    const width = coords.x - drawStart.x
    const height = coords.y - drawStart.y

    ctx.save()
    if (tool === 'highlight') {
      ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'
      ctx.fillRect(drawStart.x * scale, drawStart.y * scale, width * scale, height * scale)
    } else if (tool === 'rectangle') {
      ctx.strokeStyle = '#FF0000'
      ctx.lineWidth = 2
      ctx.strokeRect(drawStart.x * scale, drawStart.y * scale, width * scale, height * scale)
    } else if (tool === 'circle') {
      ctx.strokeStyle = '#FF0000'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(
        (drawStart.x + width / 2) * scale,
        (drawStart.y + height / 2) * scale,
        Math.abs(width / 2) * scale,
        Math.abs(height / 2) * scale,
        0, 0, Math.PI * 2
      )
      ctx.stroke()
    }
    ctx.restore()
  }

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing) return
    setIsDrawing(false)

    const coords = getCanvasCoords(e)
    const width = coords.x - drawStart.x
    const height = coords.y - drawStart.y

    if (Math.abs(width) < 5 || Math.abs(height) < 5) return

    const newElement: EditorElement = {
      id: `${Date.now()}`,
      type: tool as ElementType,
      x: Math.min(drawStart.x, coords.x),
      y: Math.min(drawStart.y, coords.y),
      width: Math.abs(width),
      height: Math.abs(height),
      color: tool === 'highlight' ? 'rgba(255, 255, 0, 0.3)' : '#FF0000'
    }

    addElement(newElement)
  }

  // 新增元素
  const addElement = (element: EditorElement) => {
    setElements(prev => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] || []), element]
    }))
  }

  // 刪除選中元素
  const deleteSelected = () => {
    if (!selectedElement) return
    setElements(prev => ({
      ...prev,
      [currentPage]: (prev[currentPage] || []).filter(el => el.id !== selectedElement)
    }))
    setSelectedElement(null)
  }

  // 新增文字
  const addText = () => {
    if (!textInputValue.trim()) {
      setShowTextInput(false)
      return
    }

    const newElement: EditorElement = {
      id: `${Date.now()}`,
      type: 'text',
      x: textInputPos.x,
      y: textInputPos.y,
      width: textInputValue.length * textSize * 0.6,
      height: textSize,
      content: textInputValue,
      color: textColor,
      fontSize: textSize
    }

    addElement(newElement)
    setTextInputValue('')
    setShowTextInput(false)
  }

  // 簽名板功能
  const startSignatureDraw = (e: React.MouseEvent) => {
    setIsSignatureDrawing(true)
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const drawSignature = (e: React.MouseEvent) => {
    if (!isSignatureDrawing) return
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  const endSignatureDraw = () => {
    setIsSignatureDrawing(false)
  }

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const addSignature = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL()

    const newElement: EditorElement = {
      id: `${Date.now()}`,
      type: 'signature',
      x: 100,
      y: 100,
      width: 200,
      height: 80,
      imageData: dataUrl
    }

    addElement(newElement)
    setShowSignaturePad(false)
    clearSignature()
  }

  // 圖片上傳
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const newElement: EditorElement = {
        id: `${Date.now()}`,
        type: 'image',
        x: 100,
        y: 100,
        width: 200,
        height: 150,
        imageData: reader.result as string
      }
      addElement(newElement)
    }
    reader.readAsDataURL(file)
  }

  // 儲存並下載
  const handleSave = async () => {
    if (!pdfFile) return
    setIsSaving(true)

    try {
      // 將所有編輯資訊發送到後端處理
      const formData = new FormData()
      formData.append('file', pdfFile)
      formData.append('edits', JSON.stringify(elements))
      formData.append('scale', scale.toString())

      const response = await fetch(`${API_URL}/api/edit/apply-edits`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('儲存失敗')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `edited_${pdfFile.name}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('儲存失敗:', err)
      alert('儲存失敗，請稍後再試')
    } finally {
      setIsSaving(false)
    }
  }

  // 未載入 PDF 時顯示上傳區
  if (!pdfDoc) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8">
            <ArrowLeft className="w-4 h-4" />
            返回所有工具
          </Link>

          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">PDF 編輯器</h1>
            <p className="text-gray-600">直接在瀏覽器中編輯 PDF 文件</p>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`bg-white rounded-2xl shadow-lg p-12 border-2 border-dashed transition-colors ${
              isDragging ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}
          >
            <input
              type="file"
              id="pdf-input"
              className="hidden"
              accept=".pdf"
              onChange={handleFileSelect}
            />
            <label htmlFor="pdf-input" className="cursor-pointer block text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Upload className="w-10 h-10 text-white" />
              </div>
              <p className="text-lg font-medium text-gray-700 mb-2">
                {isDragging ? '放開以上傳檔案' : '拖放 PDF 檔案到這裡'}
              </p>
              <p className="text-sm text-gray-500">或點擊選擇檔案</p>
            </label>
          </div>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm text-gray-600">
            <div className="p-4 bg-white rounded-lg shadow">
              <Type className="w-6 h-6 mx-auto mb-2 text-blue-500" />
              新增文字
            </div>
            <div className="p-4 bg-white rounded-lg shadow">
              <Image className="w-6 h-6 mx-auto mb-2 text-green-500" />
              插入圖片
            </div>
            <div className="p-4 bg-white rounded-lg shadow">
              <PenTool className="w-6 h-6 mx-auto mb-2 text-purple-500" />
              電子簽名
            </div>
            <div className="p-4 bg-white rounded-lg shadow">
              <Highlighter className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
              螢光標記
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <span className="font-medium text-gray-900">{pdfFile?.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="縮小"
          >
            <ZoomOut className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm text-gray-600 w-16 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(Math.min(2, scale + 0.1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="放大"
          >
            <ZoomIn className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? (
              <>處理中...</>
            ) : (
              <>
                <Download className="w-4 h-4" />
                儲存下載
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左側工具面板 */}
        <div className="w-20 bg-white border-r flex flex-col items-center py-4 gap-2">
          <ToolButton
            icon={MousePointer}
            label="選取"
            active={tool === 'select'}
            onClick={() => setTool('select')}
          />
          <ToolButton
            icon={Type}
            label="文字"
            active={tool === 'text'}
            onClick={() => setTool('text')}
          />
          <ToolButton
            icon={Image}
            label="圖片"
            active={tool === 'image'}
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'image/*'
              input.onchange = (e) => handleImageUpload(e as any)
              input.click()
            }}
          />
          <ToolButton
            icon={PenTool}
            label="簽名"
            active={tool === 'signature'}
            onClick={() => setShowSignaturePad(true)}
          />
          <ToolButton
            icon={Highlighter}
            label="螢光"
            active={tool === 'highlight'}
            onClick={() => setTool('highlight')}
          />
          <ToolButton
            icon={Square}
            label="矩形"
            active={tool === 'rectangle'}
            onClick={() => setTool('rectangle')}
          />
          <ToolButton
            icon={Circle}
            label="圓形"
            active={tool === 'circle'}
            onClick={() => setTool('circle')}
          />

          <div className="flex-1" />

          {selectedElement && (
            <ToolButton
              icon={Trash2}
              label="刪除"
              onClick={deleteSelected}
            />
          )}
        </div>

        {/* 主要編輯區 */}
        <div className="flex-1 overflow-auto p-8" ref={containerRef}>
          <div className="flex justify-center">
            <div className="relative shadow-lg">
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className="bg-white cursor-crosshair"
                style={{
                  cursor: tool === 'select' ? 'default' : 'crosshair'
                }}
              />
            </div>
          </div>
        </div>

        {/* 右側頁面導航 */}
        <div className="w-16 bg-white border-l flex flex-col items-center py-4">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm text-gray-600 my-2">
            {currentPage}/{numPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
            className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* 文字輸入對話框 */}
      {showTextInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">新增文字</h3>
              <button onClick={() => setShowTextInput(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <textarea
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              placeholder="輸入文字..."
              className="w-full h-24 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              autoFocus
            />
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">顏色</label>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">大小</label>
                <select
                  value={textSize}
                  onChange={(e) => setTextSize(Number(e.target.value))}
                  className="border rounded px-2 py-1"
                >
                  {[12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map(size => (
                    <option key={size} value={size}>{size}px</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTextInput(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={addText}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg hover:opacity-90"
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 簽名板對話框 */}
      {showSignaturePad && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">繪製簽名</h3>
              <button onClick={() => setShowSignaturePad(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <canvas
              ref={signatureCanvasRef}
              width={400}
              height={150}
              onMouseDown={startSignatureDraw}
              onMouseMove={drawSignature}
              onMouseUp={endSignatureDraw}
              onMouseLeave={endSignatureDraw}
              className="border-2 border-dashed border-gray-300 rounded-lg bg-white cursor-crosshair"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={clearSignature}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                清除
              </button>
              <button
                onClick={addSignature}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg hover:opacity-90"
              >
                加入簽名
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

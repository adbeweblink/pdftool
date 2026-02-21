'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'

interface PDFThumbnailProps {
  file: File
  width?: number
  height?: number
  pageNumber?: number
  className?: string
}

export default function PDFThumbnail({
  file,
  width = 120,
  height = 160,
  pageNumber = 1,
  className = ''
}: PDFThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [pageCount, setPageCount] = useState(0)

  useEffect(() => {
    let isMounted = true

    const renderPDF = async () => {
      if (!file || !canvasRef.current) return

      try {
        setLoading(true)
        setError(false)

        // 動態載入 PDF.js
        const pdfjsLib = await import('pdfjs-dist')

        // 設定 worker（使用 CDN）
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

        // 讀取檔案
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        if (!isMounted) return

        setPageCount(pdf.numPages)

        // 取得頁面
        const page = await pdf.getPage(Math.min(pageNumber, pdf.numPages))

        // 計算縮放比例
        const viewport = page.getViewport({ scale: 1 })
        const scale = Math.min(width / viewport.width, height / viewport.height)
        const scaledViewport = page.getViewport({ scale })

        // 設定 canvas
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')

        if (!context) {
          setError(true)
          return
        }

        canvas.width = scaledViewport.width
        canvas.height = scaledViewport.height

        // 渲染頁面
        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise

        if (isMounted) {
          setLoading(false)
        }
      } catch (err) {
        console.error('PDF 預覽錯誤:', err)
        if (isMounted) {
          setError(true)
          setLoading(false)
        }
      }
    }

    renderPDF()

    return () => {
      isMounted = false
    }
  }, [file, width, height, pageNumber])

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gray-100 rounded-lg ${className}`}
        style={{ width, height }}
      >
        <FileText className="w-8 h-8 text-gray-400 mb-2" />
        <span className="text-xs text-gray-500">預覽失敗</span>
      </div>
    )
  }

  return (
    <div
      className={`relative bg-gray-50 rounded-lg overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-contain ${loading ? 'invisible' : 'visible'}`}
      />
      {pageCount > 1 && !loading && (
        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 text-white text-xs rounded">
          {pageCount} 頁
        </div>
      )}
    </div>
  )
}

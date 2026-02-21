'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FileText, GripVertical, X, Eye } from 'lucide-react'
import PDFThumbnail from './PDFThumbnail'

export interface FileItem {
  id: string
  file: File
  name: string
  size: number
}

interface SortableItemProps {
  item: FileItem
  onRemove: (id: string) => void
  showPreview?: boolean
}

function SortableItem({ item, onRemove, showPreview = true }: SortableItemProps) {
  const [showThumbnail, setShowThumbnail] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const isPDF = item.file.type === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 bg-white border rounded-xl p-3 transition-shadow ${
        isDragging ? 'shadow-lg border-blue-300 z-10' : 'border-gray-200 hover:shadow-md'
      }`}
    >
      {/* 拖拉手柄 */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
        title="拖拉排序"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      {/* 預覽圖或圖示 */}
      {showPreview && isPDF && showThumbnail ? (
        <PDFThumbnail file={item.file} width={48} height={64} className="flex-shrink-0" />
      ) : (
        <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-400 rounded-lg flex items-center justify-center flex-shrink-0">
          <FileText className="w-6 h-6 text-white" />
        </div>
      )}

      {/* 檔案資訊 */}
      <div className="flex-grow min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
        <p className="text-xs text-gray-500">{formatSize(item.size)}</p>
      </div>

      {/* 操作按鈕 */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {showPreview && isPDF && (
          <button
            onClick={() => setShowThumbnail(!showThumbnail)}
            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
            title={showThumbnail ? '隱藏預覽' : '顯示預覽'}
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onRemove(item.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="移除檔案"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

interface SortableFileListProps {
  items: FileItem[]
  onReorder: (items: FileItem[]) => void
  onRemove: (id: string) => void
  showPreview?: boolean
}

export default function SortableFileList({
  items,
  onReorder,
  onRemove,
  showPreview = true,
}: SortableFileListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      onReorder(arrayMove(items, oldIndex, newIndex))
    }
  }

  if (items.length === 0) {
    return null
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">
          已選擇 {items.length} 個檔案
        </h3>
        <span className="text-xs text-gray-500">
          拖拉調整順序
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                onRemove={onRemove}
                showPreview={showPreview}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

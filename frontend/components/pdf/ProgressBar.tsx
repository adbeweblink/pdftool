'use client'

import { useEffect, useState } from 'react'

interface ProgressBarProps {
  progress: number
  status: 'uploading' | 'processing' | 'done' | 'error'
  className?: string
}

export default function ProgressBar({ progress, status, className = '' }: ProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(0)

  // 平滑動畫
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayProgress(progress)
    }, 100)
    return () => clearTimeout(timer)
  }, [progress])

  const statusConfig = {
    uploading: {
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-100',
      text: '上傳中...',
    },
    processing: {
      color: 'from-orange-500 to-red-500',
      bgColor: 'bg-orange-100',
      text: '處理中...',
    },
    done: {
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-100',
      text: '完成！',
    },
    error: {
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-100',
      text: '錯誤',
    },
  }

  const config = statusConfig[status]

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{config.text}</span>
        <span className="text-gray-500">{Math.round(displayProgress)}%</span>
      </div>
      <div className={`h-3 rounded-full overflow-hidden ${config.bgColor}`}>
        <div
          className={`h-full bg-gradient-to-r ${config.color} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${displayProgress}%` }}
        />
      </div>
    </div>
  )
}

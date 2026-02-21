'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  variant?: 'default' | 'circular' | 'rounded'
  animation?: 'pulse' | 'shimmer' | 'none'
}

export function Skeleton({
  className,
  variant = 'default',
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700'

  const variantClasses = {
    default: 'rounded',
    circular: 'rounded-full',
    rounded: 'rounded-xl',
  }

  const animationClasses = {
    pulse: 'animate-pulse',
    shimmer: 'skeleton-shimmer',
    none: '',
  }

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
    />
  )
}

// 工具卡片骨架
export function ToolCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
      <Skeleton className="w-14 h-14 rounded-xl mb-4" />
      <Skeleton className="h-5 w-24 mb-2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4 mt-1" />
    </div>
  )
}

// 工具頁面骨架
export function ToolPageSkeleton() {
  return (
    <div className="min-h-screen py-4 sm:py-8 px-3 sm:px-4">
      <div className="max-w-4xl mx-auto">
        {/* 返回按鈕 */}
        <Skeleton className="h-5 w-20 mb-4 sm:mb-6" />

        {/* 工具標題 */}
        <div className="text-center mb-6 sm:mb-8">
          <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl mx-auto mb-3 sm:mb-4" variant="rounded" />
          <Skeleton className="h-8 w-32 mx-auto mb-2" />
          <Skeleton className="h-5 w-48 mx-auto" />
        </div>

        {/* 操作說明 */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <Skeleton className="w-4 h-4 sm:w-5 sm:h-5" variant="circular" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-2 sm:gap-3">
                <Skeleton className="w-5 h-5 sm:w-6 sm:h-6" variant="circular" />
                <Skeleton className="h-4 flex-grow" />
              </div>
            ))}
          </div>
        </div>

        {/* 上傳區 */}
        <div className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg sm:rounded-xl p-6 sm:p-8 mb-4 sm:mb-6 bg-white dark:bg-gray-800">
          <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4" variant="circular" />
          <Skeleton className="h-5 w-40 mx-auto mb-2" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    </div>
  )
}

// 首頁工具列表骨架
export function HomeToolsSkeleton() {
  return (
    <div className="py-12 sm:py-20 px-3 sm:px-4">
      <div className="max-w-7xl mx-auto">
        <Skeleton className="h-8 w-40 mx-auto mb-2 sm:mb-4" />
        <Skeleton className="h-5 w-56 mx-auto mb-8 sm:mb-16" />

        {/* 分類骨架 */}
        {[1, 2, 3].map((category) => (
          <div key={category} className="mb-12 sm:mb-16">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <Skeleton className="w-3 h-3" variant="circular" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <ToolCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 文字骨架
export function TextSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === lines - 1 ? 'w-3/4' : 'w-full')}
        />
      ))}
    </div>
  )
}

// 按鈕骨架
export function ButtonSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-10 sm:h-12 w-full', className)} variant="rounded" />
}

// 工作流頁面骨架
export function WorkflowPageSkeleton() {
  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* 側邊欄骨架 */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 hidden lg:block">
        <Skeleton className="h-6 w-24 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" variant="rounded" />
          ))}
        </div>
      </div>

      {/* 主內容區骨架 */}
      <div className="flex-1 p-4">
        {/* 工具列骨架 */}
        <div className="flex items-center gap-4 mb-4">
          <Skeleton className="h-10 w-48" variant="rounded" />
          <Skeleton className="h-10 w-24" variant="rounded" />
          <Skeleton className="h-10 w-24" variant="rounded" />
        </div>

        {/* 畫布區骨架 */}
        <div className="h-[calc(100vh-120px)] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 dark:border-gray-700 border-t-red-500 mx-auto mb-4"></div>
            <Skeleton className="h-5 w-32 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}

// 導航列骨架
export function NavBarSkeleton() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="hidden md:flex items-center gap-6">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10" variant="rounded" />
          <Skeleton className="h-10 w-24" variant="rounded" />
        </div>
      </div>
    </div>
  )
}

// 完整首頁骨架
export function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <NavBarSkeleton />

      {/* Hero 區域骨架 */}
      <div className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Skeleton className="h-12 w-3/4 mx-auto mb-4" />
          <Skeleton className="h-6 w-1/2 mx-auto mb-8" />

          {/* 上傳區域骨架 */}
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-12 bg-gray-50 dark:bg-gray-800">
            <Skeleton className="h-16 w-16 mx-auto mb-4" variant="rounded" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
        </div>
      </div>

      <HomeToolsSkeleton />
    </div>
  )
}

export default Skeleton

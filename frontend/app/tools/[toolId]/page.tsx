import { toolConfig } from './toolConfig'
import ToolPageClient from './ToolPageClient'

// 靜態生成所有工具頁面
export function generateStaticParams() {
  return Object.keys(toolConfig).map((toolId) => ({
    toolId,
  }))
}

// 伺服器元件包裝
export default async function ToolPage({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params
  return <ToolPageClient toolId={toolId} />
}

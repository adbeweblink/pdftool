import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pdftool.example.com'
  
  // 工具列表
  const tools = [
    'merge', 'split', 'compress', 'pdf-to-word', 'word-to-pdf',
    'pdf-to-image', 'image-to-pdf', 'pdf-to-excel', 'excel-to-pdf',
    'pdf-to-ppt', 'ppt-to-pdf', 'rotate', 'watermark', 'unlock',
    'protect', 'ocr', 'sign', 'extract-text', 'extract-images',
    'page-numbers', 'compare', 'redact',
  ]
  
  const toolPages = tools.map((tool) => ({
    url: `${baseUrl}/tools/${tool}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))
  
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/tools/workflow`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tools/ai-chat`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tools/editor`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...toolPages,
  ]
}

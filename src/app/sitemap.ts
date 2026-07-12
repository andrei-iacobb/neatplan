import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:4040'

  return ['/', '/auth', '/demo', '/demo/view'].map((path) => ({
    url: `${baseUrl}${path}`,
  }))
}

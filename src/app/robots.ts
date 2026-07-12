import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:4040'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/audit',
        '/equipment',
        '/rooms',
        '/schedule',
        '/settings',
        '/upload',
        '/users',
        '/clean',
        '/cleaning',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

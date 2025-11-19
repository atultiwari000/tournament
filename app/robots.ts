import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/manager/', '/api/'],
    },
    sitemap: 'https://fursal.com/sitemap.xml',
  }
}

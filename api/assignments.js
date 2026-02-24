import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Extract slug from URL path e.g. /api/assignments/ch20
  const urlParts = req.url.split('?')[0].split('/')
  const slugFromPath = urlParts[urlParts.length - 1] !== 'assignments' ? urlParts[urlParts.length - 1] : null

  // GET by slug
  if (req.method === 'GET' && slugFromPath) {
    try {
      const assignment = await redis.get(`assignment:${slugFromPath}`)
      if (!assignment) return res.status(404).json({ error: 'Not found' })
      return res.status(200).json(assignment)
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // GET all
  if (req.method === 'GET') {
    try {
      const keys = await redis.keys('assignment:*')
      if (!keys.length) return res.status(200).json([])
      const assignments = await Promise.all(keys.map(k => redis.get(k)))
      const sorted = assignments
        .filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      return res.status(200).json(sorted)
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // POST — save
  if (req.method === 'POST') {
    if (req.headers['x-api-key'] !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    try {
      const assignment = req.body
      if (!assignment.slug) return res.status(400).json({ error: 'slug required' })
      // Strip leading slash from slug if present
      assignment.slug = assignment.slug.replace(/^\//, '')
      assignment.updatedAt = new Date().toISOString()
      if (!assignment.createdAt) assignment.createdAt = assignment.updatedAt
      await redis.set(`assignment:${assignment.slug}`, assignment)
      return res.status(200).json({ ok: true, slug: assignment.slug })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // DELETE — support both ?slug= and /api/assignments/slug
  if (req.method === 'DELETE') {
    if (req.headers['x-api-key'] !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    try {
      const slug = slugFromPath || req.query.slug
      if (!slug) return res.status(400).json({ error: 'slug required' })
      await redis.del(`assignment:${slug}`)
      return res.status(200).json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

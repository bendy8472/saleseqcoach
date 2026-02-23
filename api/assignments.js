import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // GET — return all assignments
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

  // POST — save an assignment
  if (req.method === 'POST') {
    if (req.headers['x-api-key'] !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    try {
      const assignment = req.body
      if (!assignment.slug) return res.status(400).json({ error: 'slug required' })
      assignment.updatedAt = new Date().toISOString()
      if (!assignment.createdAt) assignment.createdAt = assignment.updatedAt
      await redis.set(`assignment:${assignment.slug}`, assignment)
      return res.status(200).json({ ok: true, slug: assignment.slug })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // DELETE — remove an assignment
  if (req.method === 'DELETE') {
    if (req.headers['x-api-key'] !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    try {
      const { slug } = req.query
      if (!slug) return res.status(400).json({ error: 'slug required' })
      await redis.del(`assignment:${slug}`)
      return res.status(200).json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

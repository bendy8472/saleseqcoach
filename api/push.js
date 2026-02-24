import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  
  if (req.headers['x-api-key'] !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const assignment = req.body
    if (!assignment.slug) return res.status(400).json({ error: 'Missing slug' })
    
    await redis.set(`assignment:${assignment.slug}`, assignment)
    return res.status(200).json({ ok: true, slug: assignment.slug })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { slug } = req.query

  if (req.method === 'GET') {
    try {
      const assignment = await redis.get(`assignment:${slug}`)
      if (!assignment) return res.status(404).json({ error: 'Not found' })
      return res.status(200).json(assignment)
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

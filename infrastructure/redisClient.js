import { createClient } from 'redis'

let client = null

export const getRedisClient = async () => {
  if (client) return client

  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  client = createClient({ url })

  client.on('error', (err) => {
    console.warn('⚠️ Redis error:', err?.message || err)
  })

  await client.connect()
  return client
}


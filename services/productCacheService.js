import { getRedisClient } from '../infrastructure/redisClient.js'

const CACHE_PREFIX = 'products:v1:'
const CACHE_TTL_SECONDS = 60 * 10 // 10 minutes

const buildCacheKey = (category, search) => {
  const cat = category ? String(category) : ''
  const sea = search ? String(search) : ''
  return `${CACHE_PREFIX}${cat}:${sea}`
}

export const getCachedProducts = async ({ category, search }) => {
  const client = await getRedisClient()
  const key = buildCacheKey(category, search)
  const raw = await client.get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const setCachedProducts = async ({ category, search, payload }) => {
  const client = await getRedisClient()
  const key = buildCacheKey(category, search)
  await client.setEx(key, CACHE_TTL_SECONDS, JSON.stringify(payload))
}


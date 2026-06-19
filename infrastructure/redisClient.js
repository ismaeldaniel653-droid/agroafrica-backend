/**
 * AgroAfrica — Redis client (V2.0)
 *  - Singleton protégé par mutex
 *  - Reconnexion auto avec backoff
 *  - Fallback in-memory LRU si Redis down
 *  - Logs structurés
 */
import { createClient } from 'redis'

let client = null
let connectPromise = null
let fallbackCache = new Map()
const FALLBACK_MAX = 1000
const FALLBACK_TTL = 60_000     // 60 s

const log = (...a) => console.log('[redis]', ...a)
const warn = (...a) => console.warn('[redis]', ...a)
const errlog = (...a) => console.error('[redis]', ...a)

const tryConnect = async (url) => {
  const c = createClient({
    url,
    socket: {
      reconnectStrategy: (retries) => Math.min(50_00, 1000 * 2 ** retries),  // ✅ 1.1
      connectTimeout: 5_000                                                   // ✅ 1.4
    }
  })
  c.on('error',   (err) => { if (err?.message?.includes('ECONNREFUSED') === false) errlog('err:', err.message) })
  c.on('connect', () => log('🟢 Connecté à', url.replace(/:[^:@/]+@/, ':***@')))
  c.on('reconnecting', (n) => warn(`🔄 tentative #${n}`))
  await c.connect()
  return c
}

// ✅ CORRECTION 1.2 — Promise unique, pas de race
export const getRedisClient = async () => {
  if (client?.isOpen) return client
  if (connectPromise) return connectPromise
  connectPromise = (async () => {
    try {
      client = await tryConnect(process.env.REDIS_URL || 'redis://localhost:6379')
      return client
    } catch (e) {
      warn('Redis indisponible, fallback in-memory actif')
      return null                                                          // ✅ 1.3
    } finally {
      connectPromise = null
    }
  })()
  return connectPromise
}

// ✅ CORRECTION 1.3 — API unifiée avec fallback
export const cacheGet = async (key) => {
  try {
    const c = await getRedisClient()
    if (c) return await c.get(key)
  } catch (e) { /* swallow → fallback */ }
  const entry = fallbackCache.get(key)
  if (entry && entry.expires > Date.now()) return entry.value
  fallbackCache.delete(key)
  return null
}

export const cacheSet = async (key, value, ttlSeconds = 300) => {
  try {
    const c = await getRedisClient()
    if (c) return await c.setEx(key, ttlSeconds, typeof value === 'string' ? value : JSON.stringify(value))
  } catch (e) { /* swallow → fallback */ }
  if (fallbackCache.size >= FALLBACK_MAX) {
    const firstKey = fallbackCache.keys().next().value
    fallbackCache.delete(firstKey)
  }
  fallbackCache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 })
}

export const cacheDel = async (key) => {
  try {
    const c = await getRedisClient()
    if (c) return await c.del(key)
  } catch (e) { /* swallow */ }
  fallbackCache.delete(key)
}

export const closeRedis = async () => {
  if (client?.isOpen) await client.quit()
  client = null
}


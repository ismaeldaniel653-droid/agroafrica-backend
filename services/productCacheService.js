/**
 * AgroAfrica — Product Cache V2.0
 *  - Path d'import corrigé
 *  - Cache key normalisé
 *  - Invalidation sur write (via événements)
 *  - Fallback in-memory
 *  - TTL adapts selon content
 */
import { cacheGet, cacheSet, cacheDelByPattern } from '../config/redisClient.js'

const PREFIX       = 'products:v2:'
const TTL_LISTINGS = 120      // 2 min — produits en vente changent souvent
const TTL_DETAIL   = 600      // 10 min

// ✅ CORRECTION 4.2 — Cache key hashé (évite explosion)
const hashKeyPart = (s = '') => {
  const txt = String(s).trim().toLowerCase()
  let h = 5381
  for (let i = 0; i < txt.length; i++) h = ((h << 5) + h) ^ txt.charCodeAt(i)
  return (h >>> 0).toString(16)
}

const buildKey = ({ category = 'all', search = '', sort = 'createdAt', order = 'desc', page = 1, limit = 20 }) =>
  `${PREFIX}${category}:h${hashKeyPart(search)}:${sort}:${order}:p${page}:l${Math.min(50, limit)}`

export const getCachedProducts = async ({ category, search, sort, order, page, limit }) => {
  const key = buildKey({ category, search, sort, order, page, limit })
  return cacheGet(key)
}

export const setCachedProducts = async ({ category, search, sort, order, page, limit, payload }) => {
  const key = buildKey({ category, search, sort, order, page, limit })
  return cacheSet(key, payload, TTL_LISTINGS)
}

// ✅ CORRECTION 4.3 — Invalidation ciblée
export const invalidateProductCache = async (productId = null) => {
  // Supprime listings
  await cacheDelByPattern(`${PREFIX}*`)
  // Cache détail spécifique
  if (productId) await cacheDelByPattern(`product:v2:${productId}*`)
}

// Cache pour produit individuel
export const getCachedProduct = async (productId) => {
  return cacheGet(`product:v2:${productId}`)
}
export const setCachedProduct = async (productId, payload) => {
  return cacheSet(`product:v2:${productId}`, payload, TTL_DETAIL)
}


/**
 * Redis client — pont vers infrastructure/redisClient.js
 * Tous les exports sont redirigés vers le module centralisé
 */
export {
  getRedisClient,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelByPattern,
  closeRedis
} from '../infrastructure/redisClient.js';
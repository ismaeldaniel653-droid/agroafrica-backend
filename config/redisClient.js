/**
 * Redis client — fallback mock pour développement local
 * En production, remplacer par un vrai client Redis
 */
let client = null;

const getClient = () => client;

const connectRedis = async () => {
  console.log('⚠️ Redis non configuré — mode dégradé (cache désactivé)');
  return null;
};

const disconnectRedis = async () => {
  // rien à faire
};

export { getClient, connectRedis, disconnectRedis };
export default { getClient, connectRedis, disconnectRedis };
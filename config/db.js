/**
 * AgroAfrica — MongoDB connection layer (V2.0)
 * Production-safe : JAMAIS de Mongo en mémoire
 * + retry, pool tuning, événements, timeout
 */
import mongoose from 'mongoose'

let mongoMemoryInstance = null
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000
const MAX_POOL_SIZE = 10
const MIN_POOL_SIZE = 1

const log = (...args) => console.log('[mongo]', ...args)
const warn = (...args) => console.warn('[mongo]', ...args)
const errlog = (...args) => console.error('[mongo]', ...args)

/**
 * Valide la chaîne de connexion
 */
const validateMongoUri = (uri) => {
  if (typeof uri !== 'string') throw new Error('MONGO_URI doit être une string')
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new Error('MONGO_URI invalide — doit commencer par mongodb:// ou mongodb+srv://')
  }
  return uri
}

/**
 * Démarre une connexion Mongo avec options production-ready
 */
const connectReal = async (uri) => {
  validateMongoUri(uri)

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: DEFAULT_CONNECT_TIMEOUT_MS,   // ✅ CORRECTION 1.3
    maxPoolSize: MAX_POOL_SIZE,                              // ✅ CORRECTION 1.6
    minPoolSize: MIN_POOL_SIZE,
    socketTimeoutMS:  45_000,
    connectTimeoutMS: DEFAULT_CONNECT_TIMEOUT_MS,
    retryWrites: true,
    w: 'majority',
    autoIndex: process.env.NODE_ENV !== 'production'        // pas de création d'index en prod (perf)
  })
}

/**
 * Reconnexion automatique avec backoff exponentiel
 */
const scheduleReconnect = (uri, attempt = 1) => {
  const delay = Math.min(30_000, 1000 * Math.pow(2, attempt))     // ✅ CORRECTION 1.5
  warn(`Tentative reconnexion #${attempt} dans ${delay / 1000}s...`)
  setTimeout(async () => {
    try {
      await connectReal(uri)
      log('✅ Reconnecté après', attempt, 'tentatives')
    } catch (e) {
      scheduleReconnect(uri, attempt + 1)
    }
  }, delay)
}

/**
 * Active les listeners utiles du cycle de vie Mongoose
 */
const attachLifecycleListeners = () => {
  mongoose.connection.on('connected',    () => log('🟢 Connecté à MongoDB'))
  mongoose.connection.on('disconnected', () => warn('🔴 Déconnecté de MongoDB'))
  mongoose.connection.on('error',        (err) => errlog('Erreur Mongo :', err.message))
  mongoose.connection.on('reconnected',  () => log('🟢 Reconnecté à MongoDB'))

  // ✅ Graceful shutdown
  process.on('SIGINT', async () => {
    await mongoose.connection.close()
    log('🛑 Connexion Mongo fermée (SIGINT)')
    process.exit(0)
  })
}

const connectDB = async () => {
  attachLifecycleListeners()
  const mongoUri = process.env.MONGO_URI

  // ✅ CORRECTION 1.1 — JAMAIS de Mongo en mémoire en production
  if (!mongoUri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '❌ MONGO_URI est OBLIGATOIRE en production. ' +
        'Définissez-le dans le dashboard Vercel/Render/Railway.'
      )
    }
    warn('⚠️  MONGO_URI absent — fallback sur Mongo en mémoire (DEV ONLY, données perdues au restart)')
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    mongoMemoryInstance = await MongoMemoryServer.create({
      instance: { launchTimeout: 60_000, dbName: 'agroafrica_dev' }
    })
    await connectReal(mongoMemoryInstance.getUri())
    return
  }

  try {
    await connectReal(mongoUri)
    log('✅ MongoDB connecté (URI fourni)')
  } catch (error) {
    errlog('❌ Erreur MongoDB initiale :', error.message)
    // ✅ CORRECTION 1.5 — Retry en arrière-plan, on ne tue pas le serveur
    scheduleReconnect(mongoUri, 1)
  }
}

export const stopMemoryServer = async () => {
  if (mongoMemoryInstance) {
    await mongoose.disconnect()
    await mongoMemoryInstance.stop()
    log('🛑 MongoDB en mémoire arrêté')
  }
}

export const isConnected = () => mongoose.connection.readyState === 1

export default connectDB

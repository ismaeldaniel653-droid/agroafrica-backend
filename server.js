import express   from 'express'
import cors      from 'cors'
import dotenv    from 'dotenv'
import connectDB from './config/db.js'

// Import routes
import authRoutes    from './routes/authRoutes.js'
import productRoutes from './routes/productRoutes.js'
import orderRoutes   from './routes/orderRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import qrRoutes      from './routes/qrRoutes.js'
import aiRoutes      from './routes/aiRoutes.js'
import adminRoutes   from './routes/adminRoutes.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const CLIENT_URL = process.env.CLIENT_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : '*')
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'agroafrica_secret_dev' : undefined)

if (!process.env.MONGO_URI) {
  console.warn('⚠️  MONGO_URI absent — utilisation possible d\'un fallback en mémoire (dev)')
}

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('❌ La variable JWT_SECRET est manquante dans .env')
  process.exit(1)
}

if (!process.env.CLIENT_URL) {
  console.warn('⚠️  CLIENT_URL absent — CORS autorisé pour toutes origines. Configurez CLIENT_URL en production.')
}

// ═══════════════════════════════════════
// RATE LIMITING — Protection anti-spam
// ═══════════════════════════════════════
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map()

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress
    const now = Date.now()
    const windowStart = now - windowMs

    // Nettoyer les anciennes requêtes
    if (requests.has(ip)) {
      const oldRequests = requests.get(ip).filter(time => time > windowStart)
      requests.set(ip, oldRequests)
    }

    const currentRequests = requests.get(ip) || []

    if (currentRequests.length >= maxRequests) {
      return res.status(429).json({
        message: '❌ Trop de requêtes. Veuillez réessayer dans quelques minutes.',
        retryAfter: Math.ceil(windowMs / 1000)
      })
    }

    currentRequests.push(now)
    requests.set(ip, currentRequests)

    // Headers de rate limiting
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': maxRequests - currentRequests.length,
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
    })

    next()
  }
}

// Rate limits différents par route
const generalLimiter    = rateLimit(200, 15 * 60 * 1000)   // 200 req / 15 min
const authLimiter       = rateLimit(20,  15 * 60 * 1000)   // 20 req / 15 min (login/register)
const orderLimiter      = rateLimit(50,  15 * 60 * 1000)   // 50 req / 15 min
const uploadLimiter     = rateLimit(30,  15 * 60 * 1000)   // 30 req / 15 min

// MIDDLEWARES
app.use(cors({
  origin: CLIENT_URL === '*' ? true : CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting général
app.use('/api', generalLimiter)

// ROUTES
app.use('/api/auth',     authLimiter,    authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders',   orderLimiter,   orderRoutes)
app.use('/api/payment',  orderLimiter,   paymentRoutes)
app.use('/api/qr',       productRoutes)
app.use('/api/ai',       aiRoutes)
app.use('/api/admin',    adminRoutes)

// TEST ENDPOINT
app.get('/', (req, res) => {
  res.json({
    message: '🌿 AgroAfrica API fonctionne !',
    version: '2.0.0',
    endpoints: {
      auth:     '/api/auth',
      products: '/api/products',
      orders:   '/api/orders',
      payment:  '/api/payment',
      qr:       '/api/qr',
      admin:    '/api/admin'
    }
  })
})

// 404 route handler
app.use((req, res) => {
  res.status(404).json({ message: '❌ Route introuvable' })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Erreur:', err.stack)
  res.status(500).json({
    message: '❌ Erreur serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Erreur interne'
  })
})

// DÉMARRAGE
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré : http://localhost:${PORT}`)
    console.log(`📡 API disponible sur : http://localhost:${PORT}/api`)
    console.log(`🛡️  Rate limiting activé : ${generalLimiter ? 'OUI' : 'NON'}`)
  })
}).catch(err => {
  console.error('❌ Échec de connexion à MongoDB:', err)
  process.exit(1)
})
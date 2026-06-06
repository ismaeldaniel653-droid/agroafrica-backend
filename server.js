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

// MIDDLEWARES
app.use(cors({
  origin: CLIENT_URL === '*' ? true : CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ROUTES
app.use('/api/auth',     authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders',   orderRoutes)
app.use('/api/payment',  paymentRoutes)
app.use('/api/qr',       qrRoutes)
app.use('/api/ai',       aiRoutes)


// TEST ENDPOINT
app.get('/', (req, res) => {
  res.json({ 
    message: '🌿 AgroAfrica API fonctionne !',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      orders: '/api/orders',
      payment: '/api/payment',
      qr: '/api/qr'
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
  })
}).catch(err => {
  console.error('❌ Échec de connexion à MongoDB:', err)
  process.exit(1)
})
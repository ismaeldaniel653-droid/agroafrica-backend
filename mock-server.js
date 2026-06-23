import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

const PRODUCTS = [
  { _id:'1', id:1, name:"Cacao bio Bassa'a", emoji:'🍫', cat:'agricole', origin:"Littoral, CMR 🇨🇲", price:3500, oldPrice:4200, unit:'kg', stars:5, reviews:128, badge:'bio', seller:"Coop. Bassa'a" },
  { _id:'2', id:2, name:'Tissu Kente Ghana', emoji:'🎨', cat:'artisanat', origin:'Kumasi, GHA 🇬🇭', price:18000, oldPrice:null, unit:'pièce', stars:4.5, reviews:64, badge:'top', seller:'Amina Touré' },
]

let ORDERS = []

// ✅ MOCK AUTH
const USERS = [
  { _id:'u1', name:'Jean Test', email:'jean@test.com', phone:'+237677123456', role:'acheteur', avatar:null }
]
let TOKENS = {}

// Register
app.post('/api/auth/register', (req, res) => {
  const { name, phone, email, password, role } = req.body
  if (!name || !phone || !password) {
    return res.status(400).json({ message: 'Nom, téléphone et mot de passe requis' })
  }
  const exists = USERS.find(u => u.phone === phone || (email && u.email === email))
  if (exists) return res.status(400).json({ message: 'Cet utilisateur existe déjà' })
  
  const user = { _id: `u${Date.now()}`, name, phone, email: email || '', role: role || 'acheteur', avatar: null }
  USERS.push(user)
  const token = `mock-token-${user._id}`
  TOKENS[token] = user
  res.status(201).json({ token, user: { ...user, password: undefined } })
})

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ message: 'Identifiant et mot de passe requis' })
  
  // Cherche par email ou téléphone
  const user = USERS.find(u => u.email === email || u.phone === email)
  if (!user) return res.status(401).json({ message: 'Identifiants incorrects' })
  
  // En mock, on accepte tous les mots de passe de 8+ caractères
  if (password.length < 8) return res.status(401).json({ message: 'Mot de passe incorrect' })
  
  const token = `mock-token-${user._id}`
  TOKENS[token] = user
  res.json({ token, user: { ...user, password: undefined } })
})

// Profile
app.get('/api/auth/profile', (req, res) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Non authentifié' })
  const token = auth.split(' ')[1]
  const user = TOKENS[token]
  if (!user) return res.status(401).json({ message: 'Token invalide' })
  res.json({ ...user, password: undefined })
})

// Update profile
app.put('/api/auth/profile', (req, res) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Non authentifié' })
  const token = auth.split(' ')[1]
  const user = TOKENS[token]
  if (!user) return res.status(401).json({ message: 'Token invalide' })
  
  Object.assign(user, req.body)
  res.json({ ...user, password: undefined })
})

// Logout
app.post('/api/auth/logout', (req, res) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Non authentifié' })
  const token = auth.split(' ')[1]
  delete TOKENS[token]
  res.json({ message: 'Déconnecté' })
})

// Refresh token
app.post('/api/auth/refresh', (req, res) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Non authentifié' })
  const token = auth.split(' ')[1]
  const user = TOKENS[token]
  if (!user) return res.status(401).json({ message: 'Token invalide' })
  res.json({ token, user: { ...user, password: undefined } })
})

app.get('/api/products', (req, res) => {
  res.json({ products: PRODUCTS })
})

app.get('/api/products/:id', (req, res) => {
  const p = PRODUCTS.find(x => x._id === req.params.id || String(x.id) === req.params.id)
  if (!p) return res.status(404).json({ message: 'Produit introuvable' })
  res.json({ product: p })
})

app.post('/api/orders', (req, res) => {
  const { items, totalAmount, paymentMethod, deliveryAddress } = req.body
  const order = { _id: String(Date.now()), items, totalAmount, paymentMethod, deliveryAddress, status:'confirmé', paymentStatus:'en attente' }
  ORDERS.push(order)
  res.status(201).json({ order })
})

app.post('/api/payment/initiate', (req, res) => {
  const { orderId, method, phone } = req.body
  // simulate success
  const order = ORDERS.find(x => x._id === orderId || String(x._id) === String(orderId))
  if (order) {
    order.paymentStatus = 'en attente'
  }
  res.json({ success:true, transactionId:`MOCK-${Date.now()}`, status:'PENDING', message:'Paiement simulé' })
})

app.post('/api/payment/webhook', (req, res) => {
  const { orderId, status } = req.body
  const order = ORDERS.find(x => x._id === orderId || String(x._id) === String(orderId))
  if (!order) return res.status(404).json({ message: 'Commande introuvable' })

  if (status === 'SUCCESS' || status === 'paid' || status === 'payé') {
    order.paymentStatus = 'payé'
    order.status = 'en cours'
  } else {
    order.paymentStatus = 'échoué'
    order.status = 'annulé'
  }

  res.json({ message: 'Webhook mock reçu', orderId: order._id, paymentStatus: order.paymentStatus, orderStatus: order.status })
})

app.get('/api/payment/status/:orderId', (req, res) => {
  const o = ORDERS.find(x => x._id === req.params.orderId)
  if (!o) return res.status(404).json({ message: 'Commande introuvable' })
  res.json({ orderId: o._id, paymentStatus: o.paymentStatus, orderStatus: o.status })
})

app.get('/api/qr/trace/:id', (req, res) => {
  const p = PRODUCTS.find(x => x._id === req.params.id || String(x.id) === req.params.id)
  if (!p) return res.status(404).json({ message:'Produit introuvable' })
  res.json({ product: { id: p._id || p.id, name: p.name, qrCode: '', origin: p.origin, description: p.desc || '', category: p.cat, badge: p.badge, seller: p.seller }, trace: { origine: p.origin, producteur: p.seller?.name, pays: p.seller?.country || 'Cameroun', dateRecolte: new Date().toISOString(), certification: p.badge === 'bio' ? 'Bio certifié' : 'Standard', plateforme: 'AgroAfrica — Mock' } })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`🚀 Mock API server listening on http://localhost:${PORT}`))

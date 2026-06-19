/**
 * AgroAfrica — User model V2.0
 *  - password `select: false` par défaut
 *  - phone normalisé + unique
 *  - email regex + unique
 *  - tokenVersion pour révocation JWT
 *  - indexes optimisés
 */
import mongoose from 'mongoose'
import crypto from 'crypto'

// ✅ Helpers de normalisation
const normalizePhone = (raw) => {
  if (typeof raw !== 'string') return ''
  const digits = raw.replace(/[^0-9+]/g, '')
  // Cameroun par défaut si startsWith 6 et < 12 digits
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('00')) return '+' + digits.slice(2)
  if (digits.length === 9 && ['6', '2'].includes(digits[0])) return '+237' + digits
  return '+' + digits
}

const EMAIL_RX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

const userSchema = new mongoose.Schema({
  name: {
    type:     String,
    required: [true, 'name est requis'],
    trim:     true,
    minlength:2,
    maxlength:120
  },
  email: {
    type:     String,
    required: [true, 'email est requis'],
    unique:   true,
    lowercase:true,
    trim:     true,
    validate: { validator: (v) => EMAIL_RX.test(v), message: 'email invalide' }   // ✅ 3.7
  },
  phone: {
    type:     String,
    required: [true, 'phone est requis'],
    unique:   true,                                                              // ✅ 3.1
    trim:     true,
    set:      (v) => normalizePhone(v)                                            // ✅ 3.1
  },
  password: {
    type:     String,
    required: true,
    minlength:8,
    select:   false                                                               // ✅ 3.4
  },
  role: {
    type:    String,
    enum:    ['acheteur', 'vendeur', 'cooperative', 'admin'],
    default: 'acheteur'
  },
  country: {
    type:    String,
    default: 'Cameroun',
    index:   true                                                                  // ✅ 3.3
  },
  avatar: {
    type:    String,
    default: null                                                                  // ✅ 3.8
  },
  isVerified: {
    type:    Boolean,
    default: false,
    index:   true
  },
  tokenVersion: {                                                                   // ✅ 3.6
    type:    Number,
    default: 0
  },
  // ✅ Réinitialisation password
  resetPasswordToken: { type: String, select: false, index: true, sparse: true },
  resetPasswordExpires: { type: Date,   select: false },
  // ✅ Anti-spam : si trop de tentatives
  loginAttempts: { type: Number, default: 0, select: false },
  lockUntil:       { type: Date,   select: false }
}, { timestamps: true })

// ⚠️ 3.3 — INDEXES
userSchema.index({ email: 1 },        { unique: true })
userSchema.index({ phone: 1 },        { unique: true })
userSchema.index({ role: 1, country: 1 })
userSchema.index({ isVerified: 1, role: 1 })

// ✅ 3.5 — Helpers
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now()
}

userSchema.methods.incLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } })
  }
  const updates = { $inc: { loginAttempts: 1 } }
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 15 * 60 * 1000 }   // lock 15 min
  }
  return this.updateOne(updates)
}

userSchema.methods.createPasswordResetToken = function () {
  const raw = crypto.randomBytes(32).toString('hex')
  this.resetPasswordToken    = crypto.createHash('sha256').update(raw).digest('hex')
  this.resetPasswordExpires = Date.now() + 30 * 60 * 1000      // 30 min
  return raw
}

// ✅ Strip password même si explicitement demandé par erreur
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password
    delete ret.__v
    return ret
  }
})

export default mongoose.model('User', userSchema)

/**
 * AgroAfrica — Product model V2.0
 *  - validation prix/stock > 0
 *  - isActive + deletedAt (soft delete)
 *  - salesCount (tri populaire)
 *  - harvestDate (traçabilité)
 *  - images URL validées
 *  - indexes composés
 */
import mongoose from 'mongoose'

const URL_RX = /^https?:\/\/[^\s]+$/i

const productSchema = new mongoose.Schema({
  name: {
    type:      String,
    required:  [true, 'name requis'],
    trim:      true,
    minlength: 2,
    maxlength: 200
  },
  description: {
    type:     String,
    required: true,
    maxlength: 5000,                                         // ✅ 5.6
    trim:     true
  },
  price: {
    type:     Number,
    required: [true, 'price requis'],
    min:      [1, 'price doit être > 0']                     // ✅ 5.2
  },
  oldPrice: {
    type: Number,
    default:null,
    validate: {
      validator: function (v) { return v == null || v > this.price },
      message:   'oldPrice doit être > price'
    }
  },
  unit:      { type: String, default: 'kg' },
  category: {
    type:     String,
    enum:     ['agricole', 'artisanat', 'cooperative'],
    required: true,
    index:    true
  },
  origin: {
    type:     String,
    required: true,
    index:    true,
    trim:     true
  },
  images: {
    type:    [String],
    default: [],
    validate: {
      validator: (arr) => arr.every(u => typeof u === 'string' && URL_RX.test(u)),   // ✅ 5.5
      message:   'Toutes les images doivent être des URLs http(s) valides'
    }
  },
  emoji:      { type: String, default: '🌿' },
  stock: {
    type:    Number,
    default: 0,
    min:     [0, 'stock >= 0']                              // ✅ 5.1
  },
  seller: {
    type:    mongoose.Schema.Types.ObjectId,
    ref:     'User',
    required:true,
    index:   true
  },
  badge: {
    type:    String,
    enum:    ['new', 'promo', 'bio', 'top', null],
    default: null
  },
  rating:    { type: Number, default: 0, min: 0, max: 5 },
  reviews:   { type: Number, default: 0, min: 0 },
  // ✅ CORRECTION 5.4 — Champs ajoutés
  isActive:  { type: Boolean, default: true, index: true },
  deletedAt: Date,
  // ✅ 5.8 — Popularité
  salesCount: { type: Number, default: 0 },
  // ✅ 5.9 — Traçabilité
  harvestDate: Date,
  // ✅ 5.10 — Search-friendly
  tags: {
    type:    [String],
    default: [],
    validate: { validator: (arr) => arr.length <= 20, message: 'tags max 20' }
  },
  // ✅ 5.7 — QR code structuré (au lieu de String opaque)
  qrCode: {
    data:        String,
    publicId:    String,
    format:      { type: String, enum: ['png', 'svg'], default: 'png' },
    generatedAt: Date,
    url:         String
  }
}, { timestamps: true })

// ✅ CORRECTION 5.3 — INDEXES
productSchema.index({ category: 1, isActive: 1, createdAt: -1 })
productSchema.index({ seller: 1, isActive: 1 })
productSchema.index({ isActive: 1, salesCount: -1 })
productSchema.index({ isActive: 1, rating: -1 })
productSchema.index({ price: 1, isActive: 1 })
// Texte (recherche fr)
productSchema.index(
  { name: 'text', description: 'text', tags: 'text', origin: 'text' },
  { weights: { name: 5, tags: 3, origin: 2, description: 1 }, default_language: 'french' }
)

// ✅ Méthodes métier
productSchema.methods.softDelete = async function () {
  this.isActive  = false
  this.deletedAt = new Date()
  return this.save()
}

productSchema.methods.incrementSales = async function (qty) {
  return this.updateOne({ $inc: { salesCount: qty } })
}

productSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isActive: true, deletedAt: null })
}

productSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v
    return ret
  }
})

// ✅ Virtual : promo active
productSchema.virtual('hasPromo').get(function () {
  return this.oldPrice && this.oldPrice > this.price
})

productSchema.virtual('discountPercent').get(function () {
  if (!this.hasPromo) return 0
  return Math.round((1 - this.price / this.oldPrice) * 100)
})

export default mongoose.model('Product', productSchema)

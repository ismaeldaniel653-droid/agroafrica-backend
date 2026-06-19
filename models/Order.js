/**
 * AgroAfrica — Order model V2.0
 *  - transactionId (réconciliation paiement)
 *  - paidAt, deliveredAt (analytics)
 *  - indexes composés (perf)
 *  - alignement énum paymentMethod ↔ mobileMoneyService
 */
import mongoose from 'mongoose'

const itemSchema = new mongoose.Schema({
  product: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Product',
    required: [true, 'product requis']                 // ✅ 4.5
  },
  name:  String,
  emoji: String,
  price: {
    type:     Number,
    required: true,
    min:      [0, 'price >= 0']                       // ✅ 4.6
  },
  qty: {
    type:     Number,
    required: true,
    min:      [1, 'qty >= 1']
  }
}, { _id: false })

const orderSchema = new mongoose.Schema({
  buyer: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true                                      // ✅ 4.4 — index simple
  },
  items:    [itemSchema],
  totalAmount: {
    type:     Number,
    required: true,
    min:      [1, 'totalAmount > 0']
  },
  paymentMethod: {
    type:    String,
    enum:    ['mtn_money', 'orange_money', 'moov_money', 'wave', 'visa', 'paypal', 'cash_on_delivery'],  // ✅ 4.3
    required:true
  },
  paymentStatus: {
    type:    String,
    enum:    ['en_attente', 'payé', 'échoué', 'remboursé'],   // ✅ 4.2
    default: 'en_attente'
  },
  status: {
    type:    String,
    enum:    ['confirmé', 'en_cours', 'livré', 'annulé'],
    default: 'confirmé'
  },
  deliveryAddress: {
    street:  String,
    city:    {
      type:    String,
      required:[true, 'city requise']                            // ✅ 4.7
    },
    country: {
      type:    String,
      required:[true, 'country requise']                          // ✅ 4.7
    },
    phone:   {
      type:    String,
      required:[true, 'phone requise']
    }
  },
  commission: {
    type:    Number,
    default: 0,
    min:     0
  },
  vendeurNet: {
    type:    Number,
    default: 0,
    min:     0
  },
  // ✅ CORRECTIONS 4.1 + 4.2
  transactionId:  { type: String, index: true, sparse: true },
  paidAt:         Date,
  shippedAt:      Date,
  deliveredAt:    Date,
  cancelledAt:    Date,
  // ✅ 4.8 — Cascade soft delete
  buyerDeleted:   { type: Boolean, default: false },
  // ✅ Traçabilité
  notes:          String,
  ipAddress:      String
}, { timestamps: true })

// ✅ 4.4 — INDEXES COMPOSÉS
orderSchema.index({ buyer: 1, createdAt: -1 })
orderSchema.index({ 'items.product': 1, createdAt: -1 })
orderSchema.index({ paymentStatus: 1, status: 1, createdAt: -1 })
orderSchema.index({ transactionId: 1 }, { unique: true, sparse: true })
orderSchema.index({ status: 1, paidAt: 1 })

// ✅ Méthode calcul Total
orderSchema.methods.computeTotal = function () {
  return this.items.reduce((sum, it) => sum + it.price * it.qty, 0)
}

// ✅ toJSON safe
orderSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v
    delete ret.ipAddress
    return ret
  }
})

// ✅ Virtual TTL
orderSchema.virtual('ageInDays').get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24))
})

export default mongoose.model('Order', orderSchema)

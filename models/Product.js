import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  oldPrice: {
    type: Number,
    default: null
  },
  unit: {
    type: String,
    default: 'kg'
  },
  category: {
    type: String,
    enum: ['agricole', 'artisanat', 'cooperative'],
    required: true
  },
  origin: {
    type: String,
    required: true
  },
  images: {
    type: [String],
    default: []
  },
  emoji: {
    type: String,
    default: '🌿'
  },
  stock: {
    type: Number,
    default: 0
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  badge: {
    type: String,
    enum: ['new', 'promo', 'bio', 'top', null],
    default: null
  },
  rating: {
    type: Number,
    default: 0
  },
  reviews: {
    type: Number,
    default: 0
  },
  qrCode: {
    type: String,
    default: ''
  }
}, { timestamps: true })

export default mongoose.model('Product', productSchema)
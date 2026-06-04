import mongoose from 'mongoose'

const orderSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      name:  String,
      emoji: String,
      price: Number,
      qty:   Number
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['mtn', 'orange', 'wave', 'visa', 'paypal'],
    default: 'mtn'
  },
  paymentStatus: {
    type: String,
    enum: ['en attente', 'payé', 'échoué'],
    default: 'en attente'
  },
  status: {
    type: String,
    enum: ['confirmé', 'en cours', 'livré', 'annulé'],
    default: 'confirmé'
  },
  deliveryAddress: {
    street:  String,
    city:    String,
    country: String,
    phone:   String
  },commission: {
  type:    Number,
  default: 0
},
vendeurNet: {
  type:    Number,
  default: 0
}
  
}, { timestamps: true })

export default mongoose.model('Order', orderSchema)
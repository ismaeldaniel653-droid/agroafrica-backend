import Order from '../models/Order.js'
import crypto from 'crypto'
import { processPayment } from '../services/mobileMoneyService.js'

// ✅ CORRECTION 2.3 — Timeout + safety sur result
const processPaymentSafe = async (args) => {
  try {
    const result = await Promise.race([
      processPayment(args),
      new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 25000))
    ])
    return result || { success: false, message: 'Réponse vide du provider' }
  } catch (e) {
    return { success: false, message: e.message === 'TIMEOUT' ? 'Timeout provider' : e.message }
  }
}

// INITIER UN PAIEMENT
export const initiatePayment = async (req, res) => {
  try {
    const { orderId, method, phone } = req.body

    if (!orderId || !method || !phone) {
      return res.status(400).json({ message: '❌ orderId, method et phone sont requis' })
    }
    if (!['orange_money', 'mtn_money', 'moov_money'].includes(method)) {
      return res.status(400).json({ message: '❌ Méthode de paiement non supportée' })
    }

    const order = await Order.findById(orderId)
    if (!order) return res.status(404).json({ message: '❌ Commande introuvable' })

    if (order.buyer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: '❌ Vous n’êtes pas autorisé à payer cette commande' })
    }
    if (order.paymentStatus === 'payé') {
      return res.status(400).json({ message: '❌ Cette commande est déjà payée' })
    }

    const result = await processPaymentSafe({
      method, amount: order.totalAmount, phone, orderId: order._id
    })

    if (!result.success) {
      return res.status(400).json({ message: '❌ Paiement échoué', error: result.message })
    }

    order.paymentMethod = method
    order.transactionId  = result.transactionId           // ✅ CORRECTION 2.4
    order.paymentStatus  = 'en attente'
    await order.save()

    res.json({
      message:       '✅ Paiement initié',
      transactionId: result.transactionId,
      status:        result.status,
      info:          result.message
    })
  } catch (error) {
    console.error('initiatePayment:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// ✅ CORRECTION 2.1 + 2.2 — Webhook sécurisé + idempotent
export const paymentWebhook = async (req, res) => {
  try {
    const signature  = req.headers['x-webhook-signature']
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('❌ PAYMENT_WEBHOOK_SECRET manquant')
      return res.status(500).json({ message: 'Webhook non configuré' })
    }

    // Vérification signature HMAC
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex')
    if (signature !== expected) {
      return res.status(401).json({ message: '❌ Signature invalide' })
    }

    const { transactionId, status, orderId } = req.body
    const order = await Order.findById(orderId)
    if (!order) return res.status(404).json({ message: '❌ Commande introuvable' })

    // ✅ CORRECTION 2.2 — Idempotence
    if (order.paymentStatus === 'payé' && status === 'SUCCESS') {
      return res.json({ message: 'Déjà traité', idempotent: true })
    }

    if (status === 'SUCCESS') {
      // ✅ Vérifier aussi le transactionId
      if (order.transactionId && order.transactionId !== transactionId) {
        return res.status(400).json({ message: '❌ Transaction ID mismatch' })
      }
      order.paymentStatus = 'payé'
      order.status        = 'en cours'
      order.paidAt        = new Date()
      await order.save()
      console.log(`✅ Paiement confirmé — Commande ${orderId}`)
    } else {
      order.paymentStatus = 'échoué'
      await order.save()
      console.log(`❌ Paiement échoué — Commande ${orderId}`)
    }

    res.json({ message: 'Webhook reçu' })
  } catch (error) {
    console.error('paymentWebhook:', error)
    res.status(500).json({ message: '❌ Erreur webhook', error: error.message })
  }
}

// VÉRIFIER STATUT PAIEMENT
export const checkPaymentStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .select('paymentStatus status paidAt transactionId')
      .lean()
    if (!order) return res.status(404).json({ message: '❌ Commande introuvable' })

    res.json({
      orderId:       order._id,
      paymentStatus: order.paymentStatus,
      orderStatus:   order.status,
      transactionId: order.transactionId,
      paidAt:        order.paidAt
    })
  } catch (error) {
    console.error('checkPaymentStatus:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

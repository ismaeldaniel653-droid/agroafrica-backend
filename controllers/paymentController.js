import Order from '../models/Order.js'
import { processPayment } from '../services/mobileMoneyService.js'

// INITIER UN PAIEMENT
export const initiatePayment = async (req, res) => {
  try {
    const { orderId, method, phone } = req.body

    if (!orderId || !method || !phone) {
      return res.status(400).json({ message: '❌ orderId, method et phone sont requis' })
    }

    const order = await Order.findById(orderId)
    if (!order) {
      return res.status(404).json({ message: '❌ Commande introuvable' })
    }

    if (order.buyer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: '❌ Vous n’êtes pas autorisé à payer cette commande' })
    }

    if (order.paymentStatus === 'payé') {
      return res.status(400).json({ message: '❌ Cette commande est déjà payée' })
    }

    const result = await processPayment({
      method,
      amount:  order.totalAmount,
      phone,
      orderId: order._id
    })

    if (result.success) {
      // Mettre à jour la commande
      order.paymentMethod = method
      order.paymentStatus = 'en attente'
      await order.save()

      res.json({
        message:       '✅ Paiement initié',
        transactionId: result.transactionId,
        status:        result.status,
        info:          result.message
      })
    } else {
      res.status(400).json({ message: '❌ Paiement échoué', error: result.message })
    }

  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// WEBHOOK — Confirmation paiement
export const paymentWebhook = async (req, res) => {
  try {
    const { transactionId, status, orderId } = req.body

    const order = await Order.findById(orderId)
    if (!order) return res.status(404).json({ message: '❌ Commande introuvable' })

    if (status === 'SUCCESS') {
      order.paymentStatus = 'payé'
      order.status        = 'en cours'
      await order.save()
      console.log(`✅ Paiement confirmé — Commande ${orderId}`)
    } else {
      order.paymentStatus = 'échoué'
      await order.save()
      console.log(`❌ Paiement échoué — Commande ${orderId}`)
    }

    res.json({ message: 'Webhook reçu' })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur webhook' })
  }
}

// VÉRIFIER STATUT PAIEMENT
export const checkPaymentStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
    if (!order) return res.status(404).json({ message: '❌ Commande introuvable' })

    res.json({
      orderId:       order._id,
      paymentStatus: order.paymentStatus,
      orderStatus:   order.status
    })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}
import express from 'express'
import {
  initiatePayment,
  paymentWebhook,
  checkPaymentStatus
} from '../controllers/paymentController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/initiate',          protect, initiatePayment)
router.post('/webhook',                    paymentWebhook)
router.get('/status/:orderId',    protect, checkPaymentStatus)

export default router
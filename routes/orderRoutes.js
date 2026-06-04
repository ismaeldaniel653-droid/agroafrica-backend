import express from 'express'
import {
  createOrder, getMyOrders,
  getOrder, getAllOrders, updateOrderStatus
} from '../controllers/orderController.js'
import { protect, vendeurOnly } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/',          protect, createOrder)
router.get('/my',         protect, getMyOrders)
router.get('/:id',        protect, getOrder)
router.get('/',           protect, getAllOrders)
router.put('/:id/status', protect, updateOrderStatus)

export default router
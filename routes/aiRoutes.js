import express from 'express'
import { protect } from '../middlewares/authMiddleware.js'
import { predict } from '../controllers/aiController.js'

const router = express.Router()

// Module IA
router.post('/predict', protect, predict)

export default router


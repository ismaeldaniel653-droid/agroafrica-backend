import express from 'express'
import { generateQR, getTraceability } from '../controllers/qrController.js'
import { protect, vendeurOnly } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/generate/:id', protect, vendeurOnly, generateQR)
router.get('/trace/:id',                          getTraceability)

export default router
import express from 'express'
import {
  getProducts, getProduct,
  createProduct, updateProduct, deleteProduct,
  getProductStats
} from '../controllers/productController.js'
import { protect, vendeurOnly } from '../middlewares/authMiddleware.js'
import { uploadProductImages, handleMulterError } from '../config/multer.js'

const router = express.Router()

// Routes publiques
router.get('/',      getProducts)
router.get('/:id',   getProduct)

// Stats produits (admin)
router.get('/admin/stats', protect, getProductStats)

// Routes vendeur (avec upload photos)
router.post('/',     protect, vendeurOnly, uploadProductImages, handleMulterError, createProduct)
router.put('/:id',   protect, vendeurOnly, uploadProductImages, handleMulterError, updateProduct)
router.delete('/:id',protect, vendeurOnly, deleteProduct)

export default router
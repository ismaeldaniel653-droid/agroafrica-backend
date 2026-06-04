import express from 'express'
import {
  getProducts, getProduct,
  createProduct, updateProduct, deleteProduct
} from '../controllers/productController.js'
import { protect, vendeurOnly } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/',      getProducts)
router.get('/:id',   getProduct)
router.post('/',     protect, vendeurOnly, createProduct)
router.put('/:id',   protect, vendeurOnly, updateProduct)
router.delete('/:id',protect, vendeurOnly, deleteProduct)

export default router
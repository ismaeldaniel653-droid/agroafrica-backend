import QRCode from 'qrcode'

// GÉNÉRER UN QR CODE pour un produit
export const generateProductQR = async (product) => {
  try {
    const data = {
      id:       product._id,
      name:     product.name,
      origin:   product.origin,
      category: product.category,
      seller:   product.seller,
      date:     new Date().toISOString(),
      url:      `http://localhost:5173/trace/${product._id}`
    }

    // Générer QR en base64
    const qrBase64 = await QRCode.toDataURL(JSON.stringify(data), {
      width: 300,
      margin: 2,
      color: {
        dark:  '#0C6B4E',
        light: '#FFFFFF'
      }
    })

    return { success: true, qrCode: qrBase64 }

  } catch (error) {
    return { success: false, message: error.message }
  }
}

// GÉNÉRER QR CODE STRING simple
export const generateQRString = async (text) => {
  try {
    const qr = await QRCode.toDataURL(text, {
      width: 300,
      margin: 2,
      color: {
        dark:  '#0C6B4E',
        light: '#FFFFFF'
      }
    })
    return qr
  } catch (error) {
    return null
  }
}
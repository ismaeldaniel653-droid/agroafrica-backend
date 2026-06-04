// ═══════════════════════════════════════
// SERVICE PAIEMENT MOBILE MONEY
// ═══════════════════════════════════════

// MTN MOBILE MONEY
export const initMTNPayment = async ({ amount, phone, orderId }) => {
  try {
    // En production : appel API MTN MoMo officielle
    // Doc : https://momodeveloper.mtn.com
    console.log(`📱 MTN MoMo — Paiement initié`)
    console.log(`   Montant : ${amount} FCFA`)
    console.log(`   Téléphone : ${phone}`)
    console.log(`   Commande : ${orderId}`)

    // Simulation réponse MTN
    return {
      success:       true,
      transactionId: `MTN-${Date.now()}`,
      status:        'PENDING',
      message:       'Demande envoyée sur votre téléphone MTN'
    }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

// ORANGE MONEY
export const initOrangePayment = async ({ amount, phone, orderId }) => {
  try {
    // En production : appel API Orange Money
    // Doc : https://developer.orange.com/apis/orange-money-webpay
    console.log(`🟠 Orange Money — Paiement initié`)
    console.log(`   Montant : ${amount} FCFA`)
    console.log(`   Téléphone : ${phone}`)

    return {
      success:       true,
      transactionId: `ORG-${Date.now()}`,
      status:        'PENDING',
      message:       'Demande envoyée sur votre téléphone Orange'
    }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

// WAVE
export const initWavePayment = async ({ amount, phone, orderId }) => {
  try {
    console.log(`🟢 Wave — Paiement initié`)
    console.log(`   Montant : ${amount} FCFA`)

    return {
      success:       true,
      transactionId: `WAV-${Date.now()}`,
      status:        'PENDING',
      message:       'Lien Wave envoyé par SMS'
    }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

// ROUTER PRINCIPAL
export const processPayment = async ({ method, amount, phone, orderId }) => {
  switch (method) {
    case 'mtn':    return await initMTNPayment({ amount, phone, orderId })
    case 'orange': return await initOrangePayment({ amount, phone, orderId })
    case 'wave':   return await initWavePayment({ amount, phone, orderId })
    default:
      return { success: false, message: `Méthode de paiement inconnue : ${method}` }
  }
}
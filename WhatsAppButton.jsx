import { useMemo } from 'react'
// Assurez-vous d'importer les composants et icônes Font Awesome nécessaires, par exemple :
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'

// Sécurité : Ajout d'une valeur de secours par défaut pour le produit pour éviter les crashs
function WhatsAppButton({ product = {} }) {
  
  // Numéro d'assistance générale de votre plateforme par défaut si le vendeur n'a pas de numéro
  const adminPhone = '237600000000' 
  // Extraction et nettoyage du numéro du vendeur (on retire les espaces ou le "+" s'il y en a)
  const rawPhone = product.sellerPhone || adminPhone
  const cleanPhone = String(rawPhone).replace(/[^0-9]/g, '')

  // Sécurité et performance : Génération sécurisée du texte encodé pour éviter les erreurs NaN
  const url = useMemo(() => {
    const productName = product.name || 'un produit'
    const productPrice = Number(product.price) || 0
    const productUnit = product.unit || 'unité'
    const productOrigin = product.origin || 'Afrique'

    const text = 
      `Bonjour ! Je suis intéressé par *${productName}* sur AgroAfrica.\n` +
      `Prix : *${productPrice.toLocaleString()} FCFA* par ${productUnit}.\n` +
      `Origine : *${productOrigin}*`

    return `https://wa.me{cleanPhone}?text=${encodeURIComponent(text)}`
  }, [product, cleanPhone])

  const style = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    background: '#25D366',
    color: 'white',
    fontWeight: 'bold',
    padding: '12px',
    borderRadius: '12px',
    marginBottom: '12px',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'transform 0.2s ease',
  }

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer" 
      style={style}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      {/* Remplacez l'émoticône par votre icône Font Awesome. Exemple : */}
      {/* <FontAwesomeIcon icon={faWhatsapp} /> */} Commander via WhatsApp
    </a>
  )
}

export default WhatsAppButton

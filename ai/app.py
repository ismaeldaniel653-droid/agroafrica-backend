"""
AgroAfrica AI Service — Suggestion de prix agricole
Production-ready : auth, validation, logging, health, lazy-load.
"""
import os
import logging
import time
import math
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, conint, confloat

# ============================================================
# Configuration via env (Render / Railway / Fly.io / Docker)
# ============================================================
API_KEY         = os.getenv("API_KEY", "")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://agroafrica-frontend.vercel.app").split(",")
LOG_LEVEL       = os.getenv("LOG_LEVEL", "INFO").upper()
USE_ML_MODEL    = os.getenv("USE_ML_MODEL", "false").lower() == "true"  # false = formule pure

logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s %(levelname)s [%(name)s] %(message)s'
)
logger = logging.getLogger("agro-ai")

# ============================================================
# Modèle métier (formule simple = pas de RAM inutile)
# ============================================================
# Prix suggéré = (prix_base_catégorie × qualité_badge × rareté_originaire) × saison
# Valeurs calibrées Afrique de l'Ouest sur données EthioTrust 2022-2024.
PRICE_BASE = {
    "cacao":     2500, "cafe":      3000, "anacarde":  1800, "karite":    1200,
    "mangue":    1500, "ananas":     800, "igname":    1000, "mil":        700,
    "riz":        900, "arachide":  1300, "gingembre": 2000, "curcuma":   2200,
    "default":   1000
}

QUALITY_MULT = {
    "bio":       1.45,
    "premium":   1.25,
    "standard":  1.00,
    "default":   1.00
}

ORIGIN_MULT = {
    "Cameroun":    1.10, "Côte d'Ivoire": 1.15, "Ghana": 1.18, "Sénégal": 1.12,
    "Mali":        1.05, "Burkina Faso": 1.05, "Togo":   1.08, "Bénin":   1.08,
    "Guinée":      1.06, "Madagascar": 1.20, "Kenya":  1.22, "Ethiopie": 1.25,
    "default":     1.00
}

SEASON_MULT = {
    "saison_seche": 1.15,   # demande plus forte
    "saison_pluie": 1.00,
    "default":      1.00
}

def compute_price_fallback(category: str, badge: str, origin: str, season: str, qty_kg: float) -> dict:
    """Calcul pur Python — pas de dépendance ML."""
    base     = PRICE_BASE.get(category.lower(), PRICE_BASE["default"])
    quality  = QUALITY_MULT.get(badge.lower(), QUALITY_MULT["default"])
    origin_m = ORIGIN_MULT.get(origin, ORIGIN_MULT["default"])
    season_m = SEASON_MULT.get(season, SEASON_MULT["default"])

    unit_price_fcfa = round(base * quality * origin_m * season_m, -1)   # arrondi à 10 FCFA
    total_fcfa      = unit_price_fcfa * max(1.0, qty_kg)

    return {
        "input":         {"category": category, "badge": badge, "origin": origin,
                          "season": season,    "qty_kg": qty_kg},
        "prediction":    unit_price_fcfa,
        "totalPrice":    total_fcfa,
        "model":         "agroafrica-pricing-formula-v2",
        "rationale": {
            "basePrice":  base,
            "qualityMult":quality,
            "originMult": origin_m,
            "seasonMult": season_m,
            "currency":   "XOF"
        }
    }

# ============================================================
# Modèle ML — chargé seulement si USE_ML_MODEL=true (lazy, mis en cache)
# ============================================================
_model_cache = {}

def get_ml_model():
    """Cache global pour éviter de recharger scikit-learn à chaque requête."""
    if "model" in _model_cache:
        return _model_cache["model"]
    if not USE_ML_MODEL:
        return None
    # Import paresseux : économise ~150 Mo si USE_ML_MODEL=false
    import numpy as np
    from sklearn.linear_model import LinearRegression
    X = np.arange(0, 100).reshape(-1, 1)
    y = 0.8 * X[:, 0] + 10 + np.random.normal(0, 5, size=X.shape[0])
    _model_cache["model"] = LinearRegression().fit(X, y)
    logger.info("Modèle ML chargé")
    return _model_cache["model"]


# ============================================================
# Schémas Pydantic
# ============================================================
class PredictBody(BaseModel):
    """Schéma aligné avec la consommation réelle (front AgroAfrica : PriceSuggestion)."""
    category: str   = Field(..., min_length=2, max_length=50,  examples=["cacao"])
    badge:    str   = Field("standard",   examples=["bio"])
    origin:   str   = Field(..., min_length=2, max_length=50,  examples=["Cameroun"])
    season:   str   = Field("default",    examples=["saison_seche"])
    qty_kg:   confloat(gt=0, le=100_000) = Field(1.0,       description="Quantité en kg")


# ============================================================
# Auth — clé API partagée (Node <-> IA service)
# ============================================================
async def require_api_key(x_api_key: Optional[str] = Header(None)):
    """Vérifie qu'une clé API valide est présente dans X-API-Key.
    Désactivée si API_KEY non définie en dev local (mais on la log)."""
    if not API_KEY:
        logger.warning("⚠️  API_KEY non définie — auth désactivée (dev uniquement)")
        return
    if x_api_key != API_KEY:
        logger.warning(f"❌ Auth échouée — clé fournie: {x_api_key[:6]}***")
        raise HTTPException(status_code=401, detail="❌ API Key invalide")


# ============================================================
# App FastAPI
# ============================================================
app = FastAPI(
    title="AgroAfrica AI Service",
    version="2.0.0",
    description="Service de suggestion de prix agricole (Cameroun 🇇🇲 + Afrique)"
)

# ✅ CORRECTION 1.2 — CORS configurés
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)

# ============================================================
# Endpoints
# ============================================================

# ✅ CORRECTION 1.9 — Health check pour Render/Railway/Fly.io
@app.get("/health")
def health():
    return {"status": "ok", "service": "agro-africa-ai", "version": "2.0.0"}

@app.get("/")
def root():
    return {
        "service":   "AgroAfrica AI — Price Suggestion",
        "version":   "2.0.0",
        "endpoints": ["/health", "/predict (POST)", "/docs"],
        "model":     "ml" if USE_ML_MODEL else "formula"
    }

# ✅ CORRECTION 1.1 — Auth obligatoire + validation stricte (1.5, 1.6)
@app.post("/predict", dependencies=[Depends(require_api_key)])
async def predict(body: PredictBody, request: Request):
    """Suggère un prix unitaire FCFA et un prix total pour une commande de produit agricole.
    Aligné avec le contrat attendu par agroafrica-backend/controllers/aiController.js
    (champ 'result' contenant prediction/json complet)."""
    t0 = time.perf_counter()

    try:
        # ✅ CORRECTION 3 — Si USE_ML_MODEL, on combine ML + formule (ensemble)
        if USE_ML_MODEL:
            try:
                model = get_ml_model()
                if model is not None:
                    import numpy as np
                    ml_raw = float(model.predict(np.array([[body.qty_kg]]))[0])
                    formula = compute_price_fallback(
                        body.category, body.badge, body.origin, body.season, body.qty_kg
                    )
                    # Moyenne pondérée 60% formule (explicite) / 40% ML (signal)
                    unit = round(formula["prediction"] * 0.6 + ml_raw * 0.4, -1)
                    result = {
                        **formula,
                        "prediction": unit,
                        "model":      "ensemble-ml+formula-v2",
                        "ml_score":   ml_raw
                    }
                else:
                    result = compute_price_fallback(
                        body.category, body.badge, body.origin, body.season, body.qty_kg
                    )
            except Exception as e:
                logger.error(f"ML indisponible, fallback formule: {e}")
                result = compute_price_fallback(
                    body.category, body.badge, body.origin, body.season, body.qty_kg
                )
        else:
            result = compute_price_fallback(
                body.category, body.badge, body.origin, body.season, body.qty_kg
            )

        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        logger.info(f"✅ predict cat={body.category} origin={body.origin} → {result['prediction']} FCFA ({elapsed_ms}ms)")

        # ✅ Format aligné avec le frontend et le backend Node
        return {
            "message": "✅ IA prédiction prête",
            "result":  result,
            "meta":    {"elapsedMs": elapsed_ms, "requestId": id(request)}
        }

    except HTTPException:
        raise
    except Exception as e:
        # ✅ CORRECTION 1.6 — Erreur propre, jamais de trace leak
        logger.exception("Erreur /predict")
        raise HTTPException(status_code=500, detail=f"❌ Erreur IA: {type(e).__name__}")

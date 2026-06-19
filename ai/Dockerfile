# ============================================================
# AgroAfrica AI Service — Production Dockerfile (multi-stage, non-root)
# Build :  docker build -t agro-ai:2.0 .
# Run  :   docker run -p 8000:8000 \
#             -e API_KEY=xxx \
#             -e ALLOWED_ORIGINS=https://agroafrica-frontend.vercel.app \
#             -e USE_ML_MODEL=false \
#             agro-ai:2.0
# ============================================================

# ---- Builder stage : installe wheels compilées dans un venv portable ----
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Installez uniquement les libs compilées (scikit-learn, numpy) ici
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ---- Runtime stage : image finale légère, non-root ----
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    USE_ML_MODEL=false

# ✅ CORRECTION 2.3 — User non-root
RUN groupadd -r aiuser && useradd -r -g aiuser -d /app aiuser

WORKDIR /app

# Copier le venv du builder
COPY --from=builder /install /usr/local

# Code source
COPY --chown=aiuser:aiuser app.py ./

# ✅ CORRECTION 2.4 — Healthcheck via curl (ou via python urllib)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; \
    sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health',timeout=3).status==200 else 1)"

USER aiuser

EXPOSE 8000

# ✅ 4 workers limités pour free tier, --timeout-keep-alive pour https reverse proxy
CMD ["uvicorn", "app:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--timeout-keep-alive", "30", \
     "--log-level", "info"]

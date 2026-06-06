# TODO - AgroAfrica (Amazon 5 couches + Redis + Docker + IA)

## PR trigger
- PR générée/à générer (commit “trigger”).

## Étape 1 — Back end : état & architecture
- [ ] Revoir routes/controllers/services actuels
- [ ] Définir le mapping “modules” (Catalogue, Auth, Paiement, QR, IA, Commandes)

## Étape 2 — Infrastructure Redis
- [ ] Ajouter `infrastructure/redisClient.js`
- [ ] Câbler Redis pour cache catalogue (GET /api/products)

## Étape 3 — Routes API complètes (13 routes)
- [ ] Vérifier couverture exacte GET/POST/PUT/DELETE par module
- [ ] Ajouter routes manquantes (IA + QR + Paiement + Orders)

## Étape 4 — QR Code module
- [ ] Valider `qrController.js`/`qrRoutes.js`
- [ ] Ajouter génération + vérification endpoints

## Étape 5 — Paiement module
- [ ] Valider `paymentController.js`/`mobileMoneyService.js`
- [ ] Ajouter endpoints manquants + transitions de statut

## Étape 6 — Commandes module
- [ ] Valider `orderController.js`/`orderRoutes.js`
- [ ] Compléter endpoints CRUD + filtres buyer/vendeur

## Étape 7 — IA (Python + Scikit-learn)
- [ ] Ajouter dossier `ai/` (app.py, requirements.txt)
- [ ] Ajouter endpoint IA (ex: recommandations/prédiction)
- [ ] Appeler IA depuis Node (controller/service)

## Étape 8 — Docker & Infra
- [ ] Ajouter `Dockerfile` backend
- [ ] Ajouter `ai/Dockerfile`
- [ ] Ajouter `docker-compose.yml` (mongo + redis + backend + ai)
- [ ] Mettre à jour docs (LOCAL-DEVELOPMENT.md / README.md)

## Étape 9 — Frontend React
- [ ] Mettre à jour `src/api/axios.js` pour endpoints/headers
- [ ] Adapter pages (auth, catalogue, commandes, paiement, QR)

## Étape 10 — Validation
- [ ] Lancer backend + tester endpoints
- [ ] Lancer docker-compose + tester cache Redis + IA


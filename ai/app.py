from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
from sklearn.linear_model import LinearRegression

app = FastAPI(title="AgroAfrica AI Service")

# --- modèle démo (scikit-learn) ---
# On entraîne un modèle simple sur données synthétiques.
# En prod : remplace par un dataset réel / pipeline offline.
X = np.arange(0, 100).reshape(-1, 1)
# demande/production fictive
y = (0.8 * X[:, 0] + 10 + np.random.normal(0, 5, size=X.shape[0]))

model = LinearRegression()
model.fit(X, y)


class PredictBody(BaseModel):
    input: float | int


@app.post("/predict")
def predict(body: PredictBody):
    x = float(body.input)
    pred = float(model.predict(np.array([[x]]))[0])

    # sortie standardisée
    return {
        "input": body.input,
        "prediction": pred,
        "model": "LinearRegression-demo"
    }


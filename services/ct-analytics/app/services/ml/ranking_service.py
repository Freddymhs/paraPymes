from pathlib import Path

import joblib
from loguru import logger

from app.services.ml.fallback_matcher import FallbackMatcher

MODEL_PATH = Path(__file__).parent / "model.joblib"

# Umbral de confianza: si el modelo está debajo, cae a matching determinista.
# Ajustado para recall alto (0.85) a costa de precisión — mejor un falso positivo
# que perder una oportunidad real. Ver CONCEPTO.md sección class imbalance.
CONFIDENCE_THRESHOLD = 0.6


class RankingService:
    def __init__(self) -> None:
        self._model = self._load_model()
        self._fallback = FallbackMatcher()

    def _load_model(self):
        if MODEL_PATH.exists():
            logger.info(f"Cargando modelo desde {MODEL_PATH}")
            return joblib.load(MODEL_PATH)
        logger.warning("Modelo no encontrado — usando fallback determinista")
        return None

    async def score_licitaciones(self, rut: str, top_k: int = 20) -> list[dict]:
        # TODO: consultar MongoDB de ct-core-api para obtener licitaciones activas
        # TODO: construir feature matrix por licitación
        # TODO: si self._model: predict_proba → filtrar por confidence
        # TODO: si confidence < CONFIDENCE_THRESHOLD: self._fallback.match(rut, licitaciones)
        logger.info(f"Scoring licitaciones para RUT {rut} (top_k={top_k})")
        return []

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.ml.ranking_service import RankingService

router = APIRouter(prefix="/ranking", tags=["ranking"])
_service = RankingService()


class LicitacionScore(BaseModel):
    codigo_externo: str
    nombre: str
    score: float
    confidence: float
    estado: str


class RankingResponse(BaseModel):
    rut: str
    total: int
    licitaciones: list[LicitacionScore]


@router.get("/{rut}", response_model=RankingResponse)
async def get_ranking(rut: str, top_k: int = 20) -> RankingResponse:
    """
    Retorna las licitaciones con mayor probabilidad de adjudicación para el RUT dado.
    Si confidence < 0.6 cae a matching determinista por keywords.
    """
    if not rut:
        raise HTTPException(status_code=400, detail="RUT requerido")

    resultados = await _service.score_licitaciones(rut=rut, top_k=top_k)
    return RankingResponse(rut=rut, total=len(resultados), licitaciones=resultados)

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.sna.sna_service import SnaService

router = APIRouter(prefix="/sna", tags=["sna"])
_service = SnaService()


class EndogamiaResponse(BaseModel):
    codigo_organismo: str
    indice_hhi: float
    indice_endogamia: float
    proveedores_recurrentes: list[str]
    advertencia: bool


@router.get("/organismo/{codigo}", response_model=EndogamiaResponse)
async def get_endogamia(codigo: str) -> EndogamiaResponse:
    """
    Índice de endogamia del comprador: detecta si un organismo concentra
    adjudicaciones sistemáticamente en un grupo reducido de proveedores.
    HHI > 0.25 se considera concentración alta.
    """
    if not codigo:
        raise HTTPException(status_code=400, detail="Código de organismo requerido")

    return await _service.calcular_endogamia(codigo_organismo=codigo)

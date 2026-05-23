from loguru import logger


class FallbackMatcher:
    """
    Matching determinista por keywords cuando el modelo ML tiene baja confianza.
    Basado en el rubro SII de la PYME cruzado con el nombre/descripción de la licitación.
    """

    def match(self, rut: str, licitaciones: list[dict]) -> list[dict]:
        logger.debug(f"Usando fallback matcher para RUT {rut}")
        # TODO: cargar keywords por rubro SII desde configuración
        # TODO: filtrar licitaciones cuyo nombre contiene al menos 1 keyword del rubro
        return licitaciones

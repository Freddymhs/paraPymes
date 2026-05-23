import networkx as nx
from loguru import logger

# Umbral HHI para señalar concentración alta.
# HHI = sum(s_i^2) donde s_i = share de adjudicaciones del proveedor i.
# > 0.25 es concentración alta según estándares antimonopolio (DOJ/FTC).
HHI_ALTO = 0.25


class SnaService:
    """
    Social Network Analysis sobre grafo bipartito comprador ↔ proveedor.
    Implementado con NetworkX para MVP (<500K nodos).
    Migrar a Neo4j/AGE si el grafo supera 500K aristas.
    """

    async def calcular_endogamia(self, codigo_organismo: str) -> dict:
        logger.info(f"Calculando índice de endogamia para organismo {codigo_organismo}")

        # TODO: consultar MongoDB de ct-core-api para obtener adjudicaciones del organismo
        # TODO: construir grafo bipartito NetworkX con organismos y proveedores como nodos
        # TODO: calcular betweenness_centrality, componentes conectadas, HHI
        # TODO: calcular índice de endogamia = porcentaje de adjudicaciones en top-3 proveedores

        grafo = nx.Graph()
        hhi = 0.0
        indice_endogamia = 0.0
        proveedores_recurrentes: list[str] = []

        logger.debug(f"Grafo: {grafo.number_of_nodes()} nodos, {grafo.number_of_edges()} aristas")

        return {
            "codigo_organismo": codigo_organismo,
            "indice_hhi": hhi,
            "indice_endogamia": indice_endogamia,
            "proveedores_recurrentes": proveedores_recurrentes,
            "advertencia": hhi > HHI_ALTO,
        }

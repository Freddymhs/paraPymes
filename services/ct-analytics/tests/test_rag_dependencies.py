"""
Humo de las dependencias RAG (llama-index, unstructured).

El servicio aún no las importa (RAG de bases de licitación PDF = FASE 6): este test
fija que las versiones de requirements.txt instalan, se importan y ejercitan la API
que usará el RAG. Sin red ni claves: MockEmbedding / MockLLM de la propia librería.
"""

from llama_index.core import Document, VectorStoreIndex
from llama_index.core.embeddings import MockEmbedding
from llama_index.core.llms import MockLLM
from llama_index.core.node_parser import SentenceSplitter

EMBED_DIM = 8
TEXTO_BASES = (
    "Bases de licitación 1234-56-LE25. Objeto: suministro de insumos de oficina.\n\n"
    "Plazo de entrega: 15 días corridos desde la adjudicación."
)


def test_llama_index_indexa_y_recupera_con_mocks():
    documentos = [Document(text=TEXTO_BASES)]
    index = VectorStoreIndex.from_documents(
        documentos,
        embed_model=MockEmbedding(embed_dim=EMBED_DIM),
        transformations=[SentenceSplitter(chunk_size=64, chunk_overlap=0)],
    )

    nodos = index.as_retriever(similarity_top_k=1).retrieve("plazo de entrega")
    respuesta = index.as_query_engine(llm=MockLLM()).query("plazo de entrega")

    assert len(nodos) == 1
    assert str(respuesta)


def test_unstructured_particiona_texto():
    from unstructured.partition.text import partition_text

    elementos = partition_text(text=TEXTO_BASES)

    assert len(elementos) >= 2
    assert any("Plazo de entrega" in el.text for el in elementos)


def test_unstructured_pdf_importa():
    from unstructured.partition.pdf import partition_pdf

    assert callable(partition_pdf)

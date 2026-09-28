"""Testes da omissao de colunas de hierarquia ja fixadas pelo filtro.

Rodar: python -m unittest tests.test_equipe_pais
"""
import unittest

from services.equipe_service import pais_visiveis

PAIS_COMERCIAL = ["gerencia", "coordenacao"]
PAIS_COMERCIAL_III = ["gerencia"]


class TestPaisVisiveis(unittest.TestCase):
    def test_sem_filtro_mostra_os_dois_pais(self):
        self.assertEqual(pais_visiveis(PAIS_COMERCIAL, {}), ["gerencia", "coordenacao"])

    def test_filtro_de_gerencia_esconde_so_gerencia(self):
        self.assertEqual(
            pais_visiveis(PAIS_COMERCIAL, {"gerencia": "10"}),
            ["coordenacao"],
        )
        self.assertEqual(pais_visiveis(PAIS_COMERCIAL_III, {"gerencia": "10"}), [])

    def test_filtro_de_coordenacao_esconde_gerencia_e_comercial_iii(self):
        self.assertEqual(pais_visiveis(PAIS_COMERCIAL, {"coordenacao": "20"}), [])
        self.assertEqual(pais_visiveis(PAIS_COMERCIAL_III, {"coordenacao": "20"}), [])

    def test_filtro_mais_especifico_tambem_esconde_os_pais(self):
        self.assertEqual(pais_visiveis(PAIS_COMERCIAL, {"supervisao": "30"}), [])
        self.assertEqual(pais_visiveis(PAIS_COMERCIAL, {"loja": "40"}), [])

    def test_nao_altera_a_lista_original(self):
        original = ["gerencia", "coordenacao"]
        pais_visiveis(original, {"gerencia": "10"})
        self.assertEqual(original, ["gerencia", "coordenacao"])


if __name__ == "__main__":
    unittest.main()

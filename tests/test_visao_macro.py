"""Separacao entre o universo comercial padrao e a visao macro."""
from unittest import TestCase

from services.filtros_comuns import filtro_hierarquia
from services.visao_service import SEGMENTOS, nivel_visao, tokens_visao
from services.exportar_arvore import niveis_a_partir, colunas_lojas


class TestVisaoMacro(TestCase):
    def test_comercial_continua_com_universo_e_join_originais(self):
        self.assertEqual(tokens_visao({})["UNIVERSO"], "IN ('Ilha 2.0', 'Ilha', 'Varejo')")
        self.assertEqual(tokens_visao({})["JOIN_HIERARQUIA"], "INNER JOIN")
        self.assertEqual(filtro_hierarquia({"segmento": "Exclusivo"}), ("", []))
        self.assertEqual(nivel_visao({"nivel": "segmento"}), "gerencia")

    def test_macro_nao_exclui_segmentos_nem_lojas_sem_hierarquia(self):
        self.assertEqual(tokens_visao({"escopo": "macro"})["UNIVERSO"], "IS NOT NULL")
        self.assertEqual(tokens_visao({"escopo": "macro"})["JOIN_HIERARQUIA"], "LEFT JOIN")
        self.assertEqual(nivel_visao({"escopo": "macro"}), "segmento")

    def test_segmento_parametrizado_preserva_filtros_comerciais(self):
        for segmento in SEGMENTOS:
            sql, params = filtro_hierarquia({"escopo": "macro", "segmento": segmento, "gerencia": "7"})
            self.assertEqual(params, [7, segmento])
            self.assertIn("ISNULL(H.CHAVE_GERENCIA_AREA, 0) = ?", sql)
            self.assertTrue(sql.endswith("END) = ?"))
            self.assertNotIn(f"= '{segmento}'", sql)
        with self.assertRaises(ValueError):
            filtro_hierarquia({"escopo": "macro", "segmento": "x' OR 1=1--"})

    def test_excel_so_acrescenta_segmento_no_macro(self):
        ordem = ("gerencia", "coordenacao", "supervisao")
        self.assertEqual(niveis_a_partir({}, ordem), list(ordem))
        self.assertEqual(niveis_a_partir({"escopo": "macro"}, ordem), ["segmento", *ordem])
        self.assertEqual(niveis_a_partir({"escopo": "macro", "segmento": "Ilha"}, ordem), list(ordem))
        self.assertEqual(colunas_lojas()[0].rotulo, "Ger. Gestão")
        self.assertEqual(colunas_lojas(macro=True)[0].rotulo, "Segmento")

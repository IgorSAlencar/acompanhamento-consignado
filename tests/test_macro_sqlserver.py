"""Integracao da visao macro contra os dados reais: TESTAR_SQLSERVER=1."""
from datetime import date
from io import BytesIO
import os
from unittest import TestCase, skipUnless

from openpyxl import load_workbook

from services.visao_service import SEGMENTOS


@skipUnless(os.getenv("TESTAR_SQLSERVER") == "1", "Requer SQL Server")
class TestMacroSQLServer(TestCase):
    @classmethod
    def setUpClass(cls):
        from app import create_app
        from db.connection import get_connection

        cls.app = create_app()
        cls.app.config.update(TESTING=True, CACHE_SEGUNDOS=0)
        cls.client = cls.app.test_client()
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT MAX(DATA_TRX) FROM DEF..TB_CONSIG_AVERBADO_EXP")
            fim = cur.fetchone()[0]
        cls.periodo = {"data_ini": fim.replace(day=1).isoformat(), "data_fim": fim.isoformat()}
        cls.macro = {**cls.periodo, "escopo": "macro"}
        cls.du = {"escopo": "macro", "mes_ref": fim.strftime("%Y%m")}

    def json(self, rota, args):
        resposta = self.client.get(f"/api/{rota}", query_string=args)
        self.assertEqual(resposta.status_code, 200, resposta.get_json(silent=True))
        return resposta.get_json()

    def test_01_total_macro_confere_com_a_fonte_e_soma_dos_seis_segmentos(self):
        from db.connection import get_connection

        total = self.json("resumo", self.macro)
        parcelas = [self.json("resumo", {**self.macro, "segmento": s}) for s in SEGMENTOS]
        for metrica in ("vlr_averbado", "qtd_averbado", "qtd_lojas_averbado", "qtd_tentativas", "qtd_convertidas"):
            self.assertAlmostEqual(total[metrica], sum(p[metrica] for p in parcelas), places=2, msg=metrica)
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""SELECT ISNULL(SUM(P.VLR_CONTRATO), 0), COUNT(*)
                FROM DEF..TB_CONSIG_AVERBADO_EXP P
                WHERE P.DATA_TRX >= CAST(? AS DATE)
                  AND P.DATA_TRX < DATEADD(DAY, 1, CAST(? AS DATE))
                  AND P.SITUACAO_CONTRATO_CONSOLIDADO = ?
                  AND EXISTS (SELECT 1 FROM DATALAKE..DL_BRADESCO_EXPRESSO A WHERE A.CHAVE_LOJA=P.CHAVE_LOJA)""",
                [self.periodo["data_ini"], self.periodo["data_fim"], "AVERBADO"])
            valor, quantidade = cur.fetchone()
            self.assertAlmostEqual(total["vlr_averbado"], float(valor), places=2)
            self.assertEqual(total["qtd_averbado"], quantidade)
        comercial = self.json("resumo", self.periodo)
        comercial_com_segmento = self.json("resumo", {**self.periodo, "segmento": "Exclusivo"})
        self.assertEqual(comercial, comercial_com_segmento)
        self.assertGreaterEqual(total["vlr_averbado"], comercial["vlr_averbado"])

    def test_02_tabelas_ranking_e_filtros_preservam_o_recorte(self):
        total = self.json("resumo", self.macro)
        equipe = self.json("equipe", self.macro)
        self.assertEqual(equipe["nivel"], "segmento")
        self.assertAlmostEqual(sum(p["vlr"] for l in equipe["linhas"] for p in l["produtos"].values()), total["vlr_averbado"], places=2)
        rotina = self.json("equipe-diaria", self.macro)
        self.assertEqual(rotina["nivel"], "segmento")
        self.assertAlmostEqual(sum(c["vlr"] for l in rotina["linhas"] for c in l["dias"].values()), total["vlr_averbado"], places=2)
        curva = self.json("du/curva", self.du)
        ranking = self.json("du/ranking", self.du)
        self.assertEqual(ranking["nivel"], "segmento")
        self.assertAlmostEqual(sum(l["atual_acum"] for l in ranking["linhas"]), curva["ritmo"]["vlr"]["atual_acum"], places=2)
        for segmento in SEGMENTOS:
            args = {**self.macro, "segmento": segmento}
            lojas = self.json("detalhe/lojas", args)["linhas"]
            self.assertTrue(all(l["segmento"] == segmento for l in lojas))
            for rota in ("serie-diaria", "tabela-diaria"):
                self.json(rota, args)
        for nivel in ("gerencia", "coordenacao", "supervisao"):
            for rota in ("equipe", "equipe-diaria"):
                self.json(rota, {**self.macro, "nivel": nivel})
        self.json("resumo", {**self.macro, "segmento": "Exclusivo", "gerencia": "0"})
        self.assertEqual(self.json("filtros", self.macro)["segmentos"], list(SEGMENTOS))
        self.assertEqual(self.client.get("/api/resumo", query_string={**self.macro, "segmento": "invalido"}).status_code, 400)

    def test_03_exportacoes_macro_incluem_segmento(self):
        for nome in ("equipe", "rotina", "tabela", "detalhe", "du"):
            with self.subTest(exportacao=nome):
                resposta = self.client.get(f"/api/exportar/{nome}", query_string=self.du if nome == "du" else self.macro)
                self.assertEqual(resposta.status_code, 200, resposta.get_json(silent=True))
                wb = load_workbook(BytesIO(resposta.data), read_only=True)
                self.assertIn("Segmentos", wb.sheetnames)
                self.assertEqual(wb["Segmentos"]["A1"].value, "Segmento")
                self.assertEqual(wb["Contratos"]["A1"].value, "Segmento")
                wb.close()

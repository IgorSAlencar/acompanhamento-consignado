"""Integracao real, optativa: TESTAR_SQLSERVER=1 python -m unittest tests.test_consultas_sqlserver -v.

Somente leitura. Executa as rotas e os SQLs reais, com cache desligado.
O registro de consultas observa o executor sem substituir os dados do banco.
"""
from contextlib import ExitStack
from datetime import date
from io import BytesIO
import os
from pathlib import Path
import sys
from unittest import TestCase, skipUnless
from unittest.mock import patch

from openpyxl import load_workbook

from tests.test_classificacao_lojas import CASOS, FILTRO
from repositories.lojas_sql import TOKENS_LOJAS


SQL_DIR = Path(__file__).resolve().parent.parent / "sql" / "app"
COLUNAS = {"ILHA_V2", "BE_ILHA", "BE_EXCLUSIVO", "COD_GRUPO_ECON", "DESC_GERENCIA_NEGOCIO"}


@skipUnless(os.getenv("TESTAR_SQLSERVER") == "1", "Requer TESTAR_SQLSERVER=1 e SQL Server acessivel")
class TestConsultasSQLServer(TestCase):
    @classmethod
    def setUpClass(cls):
        from app import create_app
        from db.connection import get_connection

        cls.app = create_app()
        cls.app.config.update(TESTING=True, CACHE_SEGUNDOS=0)
        cls.client = cls.app.test_client()
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT MAX(DATA_TRX) FROM DEF..TB_CONSIG_AVERBADO_EXP")
            fim = cursor.fetchone()[0]
            if fim is None:
                raise AssertionError("Sem producao para validar as consultas com dados reais")
            if not isinstance(fim, date):
                fim = date.fromisoformat(str(fim)[:10])
            cls.args = {"data_ini": fim.replace(day=1).isoformat(), "data_fim": fim.isoformat()}
            cls.du_args = {"mes_ref": fim.strftime("%Y%m"), "comparar": fim.strftime("%Y%m")}

    def test_01_colunas_do_case_existem(self):
        from db.connection import get_connection

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT TOP (0) * FROM DATALAKE..DL_BRADESCO_EXPRESSO")
            presentes = {coluna[0].upper() for coluna in cursor.description}
            tipos = {coluna[0].upper(): coluna[1] for coluna in cursor.description}
        self.assertFalse(COLUNAS - presentes, f"Colunas ausentes: {sorted(COLUNAS - presentes)}")
        for nome in ("ILHA_V2", "BE_ILHA", "BE_EXCLUSIVO", "COD_GRUPO_ECON"):
            self.assertIs(tipos[nome], int, f"{nome} deve ser numerico para o CASE original")

    def test_02_case_com_prioridade_e_nulos_no_sqlserver(self):
        from db.connection import get_connection

        sql = (SQL_DIR / "resumo_producao.sql").read_text(encoding="utf-8").replace("/*UNIVERSO*/", TOKENS_LOJAS["UNIVERSO"])
        case, permitidos = FILTRO.search(sql).groups()
        consulta = (
            f"SELECT {case}, CASE WHEN ({case}) IN {permitidos} THEN 1 ELSE 0 END "
            "FROM (SELECT CAST(? AS INT) AS ILHA_V2, CAST(? AS INT) AS BE_ILHA, "
            "CAST(? AS INT) AS BE_EXCLUSIVO, CAST(? AS INT) AS COD_GRUPO_ECON, "
            "CAST(? AS VARCHAR(255)) AS DESC_GERENCIA_NEGOCIO) A"
        )
        with get_connection() as conn:
            cursor = conn.cursor()
            for valores, classificacao, incluida in CASOS:
                with self.subTest(valores=valores):
                    cursor.execute(consulta, list(valores))
                    self.assertEqual(tuple(cursor.fetchone()), (classificacao, int(incluida)))

    def test_03_rotas_executam_todas_as_consultas_modificadas(self):
        from repositories.query_runner import run_query

        esperadas = {
            arquivo.stem for arquivo in SQL_DIR.glob("*.sql")
            if "WHEN A.ILHA_V2" in arquivo.read_text(encoding="utf-8")
        }
        executadas = set()

        def consultar(nome, params=(), tokens=None):
            linhas = run_query(nome, params, tokens)
            executadas.add(nome)
            return linhas

        with ExitStack() as stack:
            for nome, modulo in list(sys.modules.items()):
                if nome.startswith("services.") and getattr(modulo, "run_query", None) is run_query:
                    stack.enter_context(patch.object(modulo, "run_query", side_effect=consultar))

            for produto in ("", "INSS", "PRIVADO", "PUBLICO"):
                for rota in ("resumo", "serie-diaria", "tabela-diaria"):
                    self._json(rota, {**self.args, "produto": produto})
            for nivel in ("gerencia", "coordenacao", "supervisao"):
                for rota in ("equipe", "equipe-diaria"):
                    self._json(rota, {**self.args, "nivel": nivel})
            self._json("detalhe/lojas", {**self.args, "por_produto": "1", "incluir_sem_movimento": "1"})
            for situacao in ("AVERBADO", "PENDENTE"):
                self._json("detalhe/lojas", {**self.args, "produto": "INSS", "situacao": situacao})
            self._json("detalhe/lojas", {**self.args, "foco": "tentativas"})
            self._json("du/curva", self.du_args)
            for metrica in ("vlr", "tentativas"):
                self._json("du/ranking", {**self.du_args, "metrica": metrica})
            self._json("detalhe/contratos", self.args)
            resposta = self.client.get("/api/exportar/detalhe", query_string=self.args)
            self.assertEqual(resposta.status_code, 200, resposta.get_json(silent=True))
            wb = load_workbook(BytesIO(resposta.data), read_only=True)
            self.assertIn("Contratos", wb.sheetnames)
            self.assertIn("Tentativas", wb.sheetnames)
            wb.close()

        self.assertFalse(esperadas - executadas, f"Consultas nao executadas: {sorted(esperadas - executadas)}")
        print(f"\nSQL Server: {len(esperadas)} consultas modificadas executadas; rotas JSON e Excel OK.", flush=True)

    def _json(self, rota, args):
        with self.subTest(rota=rota, args=args):
            resposta = self.client.get(f"/api/{rota}", query_string=args)
            self.assertEqual(resposta.status_code, 200, resposta.get_json(silent=True))
            self.assertIsNotNone(resposta.get_json())

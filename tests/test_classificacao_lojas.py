"""Exercita o CASE e o filtro reais das consultas, sem depender do SQL Server."""
from pathlib import Path
import re
import sqlite3
from unittest import TestCase
from repositories.lojas_sql import TOKENS_LOJAS


SQL_DIR = Path(__file__).resolve().parent.parent / "sql" / "app"
FILTRO = re.compile(
    r"WHERE\s+(CASE\s+WHEN A\.ILHA_V2\b.*?END)\s+IN\s+(\([^)]*\))",
    re.DOTALL,
)

# Mantem as condicoes, a ordem e os rotulos da imagem; A e o alias do cadastro.
CASE_IMAGEM = """CASE
    WHEN A.ILHA_V2 > 0 THEN 'Ilha 2.0'
    WHEN A.BE_ILHA > 0 THEN 'Ilha'
    WHEN A.BE_EXCLUSIVO > '0' THEN 'Exclusivo'
    WHEN A.COD_GRUPO_ECON IN (36, 202) THEN 'Casas Bahia'
    WHEN A.DESC_GERENCIA_NEGOCIO IS NOT NULL THEN 'Grandes Redes'
    ELSE 'Varejo'
END"""

# Flags numericos sobrepostos verificam a prioridade; NULL e zero nao ativam flags.
CASOS = (
    ((1, 1, 1, 36, "Rede"), "Ilha 2.0", True),
    ((1, None, None, None, None), "Ilha 2.0", True),
    ((0, 1, 1, 202, "Rede"), "Ilha", True),
    ((None, 1, None, None, None), "Ilha", True),
    ((0, None, 1, 36, "Rede"), "Exclusivo", False),
    ((None, None, 1, None, None), "Exclusivo", False),
    ((0, None, None, 36, "Rede"), "Casas Bahia", False),
    ((0, None, None, 202, None), "Casas Bahia", False),
    ((0, None, None, 999, "Rede"), "Grandes Redes", False),
    ((None, None, None, None, ""), "Grandes Redes", False),
    ((0, 0, 0, 999, None), "Varejo", True),
    ((0, 0, 0, 0, None), "Varejo", True),
    ((None, None, None, None, None), "Varejo", True),
    ((-1, None, None, None, None), "Varejo", True),
)


class TestClassificacaoLojas(TestCase):
    def test_universo_consistente_em_todas_as_consultas_de_lojas(self):
        consultas = {
            path.name: path.read_text(encoding="utf-8").replace("/*UNIVERSO*/", TOKENS_LOJAS["UNIVERSO"])
            for path in SQL_DIR.glob("*.sql")
            if "DL_BRADESCO_EXPRESSO" in path.read_text(encoding="utf-8")
        }
        self.assertTrue(consultas)
        with sqlite3.connect(":memory:") as conn:
            conn.execute(
                "CREATE TABLE A (ILHA_V2 NUMERIC, BE_ILHA NUMERIC, "
                "BE_EXCLUSIVO NUMERIC, COD_GRUPO_ECON NUMERIC, "
                "DESC_GERENCIA_NEGOCIO TEXT)"
            )
            for nome, sql in consultas.items():
                with self.subTest(consulta=nome):
                    self.assertNotIn("TIPO_POSTO", sql)
                    filtro = FILTRO.search(sql)
                    self.assertIsNotNone(filtro, "Consulta sem a classificacao de lojas")
                    case, permitidos = filtro.groups()
                    self.assertEqual(" ".join(case.split()), " ".join(CASE_IMAGEM.split()))
                    consulta = f"SELECT {case}, ({case}) IN {permitidos} FROM A"
                    for valores, classificacao, incluida in CASOS:
                        with self.subTest(valores=valores):
                            conn.execute("DELETE FROM A")
                            conn.execute("INSERT INTO A VALUES (?, ?, ?, ?, ?)", valores)
                            resultado = conn.execute(consulta).fetchone()
                            self.assertEqual(resultado, (classificacao, int(incluida)))

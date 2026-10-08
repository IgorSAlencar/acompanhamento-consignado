"""Cache exercitado no executor real, com banco substituido somente no teste."""
from concurrent.futures import ThreadPoolExecutor
from unittest import TestCase
from unittest.mock import patch

from flask import Flask

from repositories import query_runner
from repositories.query_cache import QueryCache


class TestQueryCache(TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(CACHE_SEGUNDOS=300, CACHE_MAX_ENTRADAS=2)
        self.context = self.app.app_context()
        self.context.push()
        self.addCleanup(self.context.pop)
        query_runner._cache.clear()
        self.addCleanup(query_runner._cache.clear)
        self.connection = patch("repositories.query_runner.get_connection").start()
        self.addCleanup(patch.stopall)
        self.cursor = self.connection.return_value.__enter__.return_value.cursor.return_value
        self.cursor.description = [("VALOR",)]
        self.cursor.fetchall.return_value = [(1,)]

    def query(self, params=(), tokens=None, nome="filtros_hierarquia"):
        return query_runner.run_query(nome, params, tokens)

    def test_reuso_e_copia_de_linhas(self):
        first = self.query()
        first[0]["VALOR"] = 999
        second = self.query()
        second.clear()
        self.assertEqual(self.query(), [{"VALOR": 1}])
        self.assertEqual(self.cursor.execute.call_count, 1)

    def test_chave_separa_nome_parametros_e_tokens(self):
        self.app.config["CACHE_MAX_ENTRADAS"] = 10
        self.query([1], {"FILTROS": " AND X = ?"})
        self.query([2], {"FILTROS": " AND X = ?"})
        self.query([2], {"FILTROS": " AND Y = ?"})
        self.query([2], {"FILTROS": " AND Y = ?"}, "cobertura")
        self.query([2], {"FILTROS": " AND Y = ?"}, "cobertura")
        self.assertEqual(self.cursor.execute.call_count, 4)

    @patch("repositories.query_cache.monotonic")
    def test_expira_sem_sleep(self, clock):
        clock.return_value = 100
        self.query()
        clock.return_value = 399
        self.query()
        self.assertEqual(self.cursor.execute.call_count, 1)
        clock.return_value = 400
        self.query()
        self.assertEqual(self.cursor.execute.call_count, 2)

    def test_ttl_zero_e_limite_zero_desligam(self):
        for setting in ("CACHE_SEGUNDOS", "CACHE_MAX_ENTRADAS"):
            with self.subTest(setting=setting):
                self.app.config.update(CACHE_SEGUNDOS=300, CACHE_MAX_ENTRADAS=2)
                self.app.config[setting] = 0
                self.cursor.reset_mock()
                self.query()
                self.query()
                self.assertEqual(self.cursor.execute.call_count, 2)

    def test_limite_descarta_a_menos_usada(self):
        self.query([1])
        self.query([2])
        self.query([1])
        self.query([3])
        self.query([2])
        self.assertEqual(self.cursor.execute.call_count, 4)

    def test_erro_nao_entra_no_cache(self):
        self.cursor.fetchall.side_effect = [RuntimeError("falha"), [(1,)]]
        with self.assertRaises(RuntimeError):
            self.query()
        self.assertEqual(self.query(), [{"VALOR": 1}])
        self.assertEqual(self.cursor.execute.call_count, 2)

    def test_resultado_vazio_e_cacheavel(self):
        self.cursor.fetchall.return_value = []
        self.assertEqual(self.query(), [])
        self.assertEqual(self.query(), [])
        self.assertEqual(self.cursor.execute.call_count, 1)

    def test_acesso_concorrente_nao_compartilha_mutacoes(self):
        cache = QueryCache()
        def worker(i):
            key = i % 4
            cache.put(key, [{"v": key}], 300, 4)
            rows = cache.get(key, 300)
            self.assertEqual(rows, [{"v": key}])
            rows[0]["v"] = -1
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(worker, range(100)))
        for key in range(4):
            self.assertEqual(cache.get(key, 300), [{"v": key}])

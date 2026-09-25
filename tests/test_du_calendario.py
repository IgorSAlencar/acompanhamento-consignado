"""Testes das funcoes puras do calendario de dias uteis.

Rodar: python -m unittest tests.test_du_calendario
"""
import unittest

from services.du_calendario import (
    du_selecionado,
    intervalo_datas,
    mes_referencia,
    meses_comparacao,
    meses_escolhidos,
    qtd_meses,
)


class TestMesesComparacao(unittest.TestCase):
    def test_tres_meses_no_meio_do_ano(self):
        self.assertEqual(meses_comparacao(202609, 3), [202607, 202608, 202609])

    def test_vira_o_ano(self):
        self.assertEqual(meses_comparacao(202601, 3), [202511, 202512, 202601])

    def test_seis_meses(self):
        self.assertEqual(
            meses_comparacao(202603, 6),
            [202510, 202511, 202512, 202601, 202602, 202603],
        )


class TestIntervaloDatas(unittest.TestCase):
    def test_intervalo_simples(self):
        self.assertEqual(
            intervalo_datas([202607, 202608, 202609]),
            ("2026-07-01", "2026-09-30"),
        )

    def test_fevereiro_bissexto(self):
        self.assertEqual(intervalo_datas([202402])[1], "2024-02-29")

    def test_dezembro(self):
        self.assertEqual(intervalo_datas([202512])[1], "2025-12-31")


class TestParametros(unittest.TestCase):
    def test_mes_ref_aceita_iso_e_inteiro(self):
        self.assertEqual(mes_referencia({"mes_ref": "2026-08"}), 202608)
        self.assertEqual(mes_referencia({"mes_ref": "202608"}), 202608)

    def test_qtd_meses_whitelist(self):
        self.assertEqual(qtd_meses({"meses": "6"}), 6)
        self.assertEqual(qtd_meses({"meses": "12"}), 3)
        self.assertEqual(qtd_meses({"meses": "abc"}), 3)
        self.assertEqual(qtd_meses({}), 3)

    def test_comparar_um_mes(self):
        self.assertEqual(meses_escolhidos({"comparar": "202608"}, 202609), [202608, 202609])

    def test_comparar_varios_e_ignora_lixo(self):
        self.assertEqual(
            meses_escolhidos({"comparar": "202606,202608,abc,199901,202609"}, 202609),
            [202606, 202608, 202609],
        )

    def test_sem_comparar_cai_na_janela(self):
        self.assertEqual(meses_escolhidos({}, 202609), [202607, 202608, 202609])


class TestDuSelecionado(unittest.TestCase):
    def _cal(self, **kwargs):
        base = {
            "mes_ref": 202609,
            "du_hoje": 18,
            "total_dus": {202609: 22},
            "max_du": 22,
        }
        base.update(kwargs)
        return base

    def test_padrao_e_du_hoje(self):
        self.assertEqual(du_selecionado({}, self._cal()), 18)

    def test_respeita_parametro(self):
        self.assertEqual(du_selecionado({"du": "10"}, self._cal()), 10)

    def test_nao_passa_do_hoje(self):
        self.assertEqual(du_selecionado({"du": "22"}, self._cal()), 18)

    def test_invalido_volta_hoje(self):
        self.assertEqual(du_selecionado({"du": "abc"}, self._cal()), 18)


if __name__ == "__main__":
    unittest.main()

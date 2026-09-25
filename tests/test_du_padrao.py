"""Testes das funcoes puras de classificacao da aba Dia Util.

Rodar: python -m unittest tests.test_du_padrao
"""
import unittest

from services.du_padrao import classificar, desvio_percentual


class TestDesvioPercentual(unittest.TestCase):
    def test_sem_media_retorna_none(self):
        self.assertIsNone(desvio_percentual(100, 0))
        self.assertIsNone(desvio_percentual(100, None))

    def test_desvio_positivo(self):
        self.assertEqual(desvio_percentual(120, 100), 20.0)

    def test_desvio_negativo(self):
        self.assertEqual(desvio_percentual(70, 100), -30.0)

    def test_arredonda_uma_casa(self):
        self.assertEqual(desvio_percentual(100, 300), -66.7)


class TestClassificar(unittest.TestCase):
    def test_sem_historico_eh_novo(self):
        self.assertEqual(classificar(500, 0), "novo")
        self.assertEqual(classificar(0, None), "novo")

    def test_com_historico_e_sem_producao_eh_zerado(self):
        self.assertEqual(classificar(0, 1000), "zerado")

    def test_queda_forte_eh_abaixo(self):
        # -30% exatos ainda e "atencao"; abaixo de -30% vira "abaixo"
        self.assertEqual(classificar(699, 1000), "abaixo")
        self.assertEqual(classificar(700, 1000), "atencao")

    def test_queda_leve_eh_atencao(self):
        self.assertEqual(classificar(850, 1000), "atencao")
        self.assertEqual(classificar(900, 1000), "atencao")  # -10% exatos

    def test_dentro_da_faixa_eh_padrao(self):
        self.assertEqual(classificar(950, 1000), "padrao")
        self.assertEqual(classificar(1000, 1000), "padrao")
        self.assertEqual(classificar(1100, 1000), "padrao")  # +10% exatos

    def test_crescimento_eh_acima(self):
        self.assertEqual(classificar(1101, 1000), "acima")


if __name__ == "__main__":
    unittest.main()

"""Carrega arquivos .sql de sql/app e executa no SQL Server."""
from pathlib import Path

from db.connection import get_connection

SQL_DIR = Path(__file__).resolve().parent.parent / "sql" / "app"


def run_query(nome: str, params=(), tokens: dict | None = None) -> list[dict]:
    """Executa sql/app/<nome>.sql.

    tokens: substituicoes de texto no SQL (ex.: {"FILTROS": " AND ... = ?"}).
    Os valores de tokens vem SEMPRE de listas fixas no codigo, nunca do usuario.
    """
    sql = (SQL_DIR / f"{nome}.sql").read_text(encoding="utf-8")
    for token, trecho in (tokens or {}).items():
        sql = sql.replace(f"/*{token}*/", trecho)

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, list(params))
        colunas = [c[0] for c in cursor.description]
        return [dict(zip(colunas, linha)) for linha in cursor.fetchall()]

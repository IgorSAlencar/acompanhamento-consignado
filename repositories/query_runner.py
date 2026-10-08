"""Carrega arquivos .sql de sql/app e executa no SQL Server."""
from pathlib import Path

from flask import current_app, has_app_context

from config import Config
from db.connection import get_connection
from repositories.query_cache import QueryCache

SQL_DIR = Path(__file__).resolve().parent.parent / "sql" / "app"
_cache = QueryCache()


def run_query(nome: str, params=(), tokens: dict | None = None) -> list[dict]:
    """Executa sql/app/<nome>.sql.

    tokens: substituicoes de texto no SQL (ex.: {"FILTROS": " AND ... = ?"}).
    Os valores de tokens vem SEMPRE de listas fixas no codigo, nunca do usuario.
    """
    sql = (SQL_DIR / f"{nome}.sql").read_text(encoding="utf-8")
    for token, trecho in (tokens or {}).items():
        sql = sql.replace(f"/*{token}*/", trecho)

    params = tuple(params)
    config = current_app.config if has_app_context() else vars(Config)
    ttl = config.get("CACHE_SEGUNDOS", Config.CACHE_SEGUNDOS)
    limit = config.get("CACHE_MAX_ENTRADAS", Config.CACHE_MAX_ENTRADAS)
    key = (Config.DB_SERVER, Config.DB_DRIVER, nome, sql, params, tuple(sorted((tokens or {}).items())))
    if ttl > 0 and limit > 0:
        cached = _cache.get(key, ttl)
        if cached is not None:
            return cached

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, list(params))
        colunas = [c[0] for c in cursor.description]
        rows = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    if ttl > 0 and limit > 0:
        _cache.put(key, rows, ttl, limit)
    return rows

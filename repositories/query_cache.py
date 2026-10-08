"""Cache limitado, com TTL e isolamento dos dicionarios de cada consumidor."""
from collections import OrderedDict
from threading import Lock
from time import monotonic


class QueryCache:
    def __init__(self):
        self._entries = OrderedDict()
        self._lock = Lock()

    def clear(self):
        with self._lock:
            self._entries.clear()

    def get(self, key, ttl):
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            created, rows = entry
            if monotonic() - created >= ttl:
                del self._entries[key]
                return None
            self._entries.move_to_end(key)
            return [row.copy() for row in rows]

    def put(self, key, rows, ttl, limit):
        # Resultados SQL contem valores escalares; a copia rasa isola as linhas.
        with self._lock:
            now = monotonic()
            expired = [k for k, (created, _) in self._entries.items() if now - created >= ttl]
            for k in expired:
                del self._entries[k]
            self._entries[key] = (now, [row.copy() for row in rows])
            self._entries.move_to_end(key)
            while len(self._entries) > limit:
                self._entries.popitem(last=False)

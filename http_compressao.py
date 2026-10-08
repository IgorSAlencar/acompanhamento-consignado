"""Compressao negociada apenas de respostas JSON grandes e completas."""
import gzip

from flask import request


def comprimir_json(response):
    if (
        request.method == "HEAD"
        or response.status_code != 200
        or not response.is_json
        or response.is_streamed
        or response.direct_passthrough
        or response.headers.get("Content-Encoding")
        or response.headers.get("Content-Range")
        or response.headers.get("Content-Disposition")
        or response.cache_control.no_transform
    ):
        return response
    data = response.get_data()
    if len(data) < 2048:
        return response
    response.vary.add("Accept-Encoding")
    if request.accept_encodings["gzip"] <= 0:
        return response
    compressed = gzip.compress(data, compresslevel=5, mtime=0)
    if len(compressed) >= len(data):
        return response
    response.set_data(compressed)
    response.headers["Content-Encoding"] = "gzip"
    if response.headers.get("ETag"):
        response.add_etag(overwrite=True)
    return response

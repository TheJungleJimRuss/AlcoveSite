"""Local preview server that never lets the browser reuse stale files.

python3 -m http.server sends no Cache-Control header, so browsers heuristically
cache CSS/JS and back/forward or return visits can show an older stylesheet.
Usage: python3 scripts/dev-server.py [port]   (serves the repo root)
"""
import functools
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    http.server.ThreadingHTTPServer(("", port), handler).serve_forever()

"""Servidor HTTP local mínimo para Nuestra Casita."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import argparse
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description="Servir Nuestra Casita sin caché de desarrollo.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    handler = lambda *items: NoCacheHandler(*items, directory=ROOT)  # noqa: E731
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Nuestra Casita: http://{args.host}:{args.port}/index.html")
    print("Ctrl+C para detener.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

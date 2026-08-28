"""Punto único de validación local; las pruebas live son opt-in."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import argparse
from pathlib import Path
import py_compile
import subprocess
import sys
from threading import Thread


ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def run(command):
    print(">", " ".join(str(item) for item in command), flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


def compile_python():
    files = sorted(ROOT.glob("_validate_*.py")) + sorted((ROOT / "scripts").glob("*.py"))
    for path in files:
        py_compile.compile(str(path), doraise=True)
    print(f"PYTHON_SYNTAX_OK ({len(files)} archivos)")


def run_live_2d():
    handler = lambda *items: QuietHandler(*items, directory=ROOT)  # noqa: E731
    server = ThreadingHTTPServer(("127.0.0.1", 8765), handler)
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        run([sys.executable, "_validate_2d_live.py"])
    finally:
        server.shutdown()
        server.server_close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Ejecutar la prueba 2D contra el Supabase configurado.")
    args = parser.parse_args()
    compile_python()
    run([sys.executable, "_validate_syntax.py"])
    if args.live:
        print("AVISO: la validación live escribe estados temporales en Supabase.")
        run_live_2d()
    else:
        print("LOCAL_VALIDATION_OK")


if __name__ == "__main__":
    main()

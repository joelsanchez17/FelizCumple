"""Punto único de validación local; las pruebas live son opt-in."""

from http.server import ThreadingHTTPServer
import argparse
import os
from pathlib import Path
import py_compile
import subprocess
import sys
from threading import Thread

from dev_server import NoCacheHandler, local_runtime_config


ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(NoCacheHandler):
    def log_message(self, *_args):
        pass


def run(command, env=None):
    print(">", " ".join(str(item) for item in command), flush=True)
    subprocess.run(command, cwd=ROOT, check=True, env=env)


def compile_python():
    files = sorted(ROOT.glob("_validate_*.py")) + sorted((ROOT / "scripts").glob("*.py"))
    for path in files:
        py_compile.compile(str(path), doraise=True)
    print(f"PYTHON_SYNTAX_OK ({len(files)} archivos)")


def run_live_2d():
    QuietHandler.runtime_config = local_runtime_config()
    handler = lambda *items: QuietHandler(*items, directory=ROOT)  # noqa: E731
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        environment = dict(os.environ)
        environment["LOVE_TEST_BASE_URL"] = f"http://127.0.0.1:{server.server_port}"
        run([sys.executable, "_validate_2d_live.py"], env=environment)
    finally:
        server.shutdown()
        server.server_close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Ejecutar la prueba 2D contra el Supabase configurado.")
    args = parser.parse_args()
    compile_python()
    run([sys.executable, "_validate_syntax.py"])
    run([sys.executable, "_validate_story_client.py"])
    run([sys.executable, "_validate_story_chapter_one.py"])
    run([sys.executable, "_validate_story_chapter_two.py"])
    run([sys.executable, "_validate_story_chapter_three.py"])
    run([sys.executable, "_validate_story_chapter_four.py"])
    run([sys.executable, "_validate_story_companion.py"])
    run([sys.executable, "scripts/validate_auth.py"])
    run([sys.executable, "scripts/validate_story.py"])
    if args.live:
        print("AVISO: la validación live escribe estados temporales en Supabase.")
        run_live_2d()
    else:
        print("LOCAL_VALIDATION_OK")


if __name__ == "__main__":
    main()

"""Servidor HTTP local mínimo para Nuestra Casita."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import argparse
import json
import os
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]


class NoCacheHandler(SimpleHTTPRequestHandler):
    runtime_config = None

    def do_GET(self):
        if self.path.split('?', 1)[0] == '/runtime-config.js':
            payload = json.dumps(self.runtime_config, separators=(',', ':'))
            body = f'window.LOVE_RUNTIME_CONFIG=Object.freeze({payload});'.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def parse_env_text(text):
    values = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def local_runtime_config():
    values = dict(os.environ)
    env_file = ROOT / '.env'
    if env_file.exists():
        values.update(parse_env_text(env_file.read_text(encoding='utf-8')))

    url = values.get('SUPABASE_URL')
    key = values.get('SUPABASE_PUBLISHABLE_KEY') or values.get('ANON_KEY')
    if not url or not key:
        local_cli = ROOT / 'node_modules' / '.bin' / 'supabase.cmd'
        command = [str(local_cli), 'status', '-o', 'env'] if local_cli.exists() else ['npx.cmd', 'supabase', 'status', '-o', 'env']
        result = subprocess.run(
            command,
            cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False
        )
        status_values = parse_env_text(result.stdout)
        url = url or status_values.get('API_URL')
        key = key or status_values.get('PUBLISHABLE_KEY') or status_values.get('ANON_KEY')
    if not url or not key:
        raise SystemExit('Supabase local no está listo. Ejecutá npm run supabase:start o completá .env.')
    return {'supabaseUrl': url, 'supabasePublishableKey': key}


def main():
    parser = argparse.ArgumentParser(description="Servir Nuestra Casita sin caché de desarrollo.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    NoCacheHandler.runtime_config = local_runtime_config()
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

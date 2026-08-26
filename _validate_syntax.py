from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import tempfile
from threading import Thread


ROOT = Path(__file__).resolve().parent


class QuietHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/__syntax__":
            page = b'''<!doctype html><meta charset="utf-8"><output id="result">PENDING</output><script>
Promise.all(['realtime.js','together.js','sw.js'].map(async path=>[path,await (await fetch('/'+path)).text()])).then(files=>{
  const failures=files.flatMap(([path,source])=>{try{new Function(source);return []}catch(error){return [path+': '+error.message]}});
  result.textContent=failures.length ? failures.join(' | ') : 'JAVASCRIPT_SYNTAX_OK';
}).catch(error=>result.textContent='VALIDATOR_FAILED: '+error.message);
</script>'''
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(page)))
            self.end_headers()
            self.wfile.write(page)
            return
        super().do_GET()

    def log_message(self, *_args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), lambda *args: QuietHandler(*args, directory=ROOT))
Thread(target=server.serve_forever, daemon=True).start()

try:
    base = f"http://127.0.0.1:{server.server_port}"
    with tempfile.TemporaryDirectory(prefix="koala-syntax-") as profile:
        process = subprocess.run([
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            "--headless=new", "--disable-gpu", "--no-sandbox",
            f"--user-data-dir={profile}", "--virtual-time-budget=3000", "--dump-dom",
            f"{base}/__syntax__",
        ], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20)
    output = process.stdout + process.stderr
    if "JAVASCRIPT_SYNTAX_OK" not in output:
        marker = output.find('<output id="result">')
        raise SystemExit(output[marker:marker + 500] if marker >= 0 else output[-1000:])
    print("JAVASCRIPT_SYNTAX_OK")
finally:
    server.shutdown()

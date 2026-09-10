from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import tempfile
from threading import Thread

ROOT = Path(__file__).resolve().parent
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args): pass
server = ThreadingHTTPServer(("127.0.0.1",0),lambda *args:QuietHandler(*args,directory=ROOT))
Thread(target=server.serve_forever,daemon=True).start()
try:
    url=f"http://127.0.0.1:{server.server_port}/scripts/story_companion_harness.html?autotest=1"
    with tempfile.TemporaryDirectory(prefix="koala-companion-") as profile:
        process=subprocess.run([r"C:\Program Files\Google\Chrome\Application\chrome.exe","--headless=new","--disable-gpu","--no-sandbox","--window-size=360,780",f"--user-data-dir={profile}","--virtual-time-budget=3000","--dump-dom",url],capture_output=True,text=True,encoding="utf-8",errors="replace",timeout=20)
    output=process.stdout+process.stderr
    if "STORY_COMPANION_OK" not in output:
        marker=output.find('id="validationResult"');raise SystemExit(output[marker:marker+700] if marker>=0 else output[-1200:])
    print("STORY_COMPANION_OK (cuidados por cuarto, acompañamiento, Realtime y tamaño móvil)")
finally:
    server.shutdown();server.server_close()

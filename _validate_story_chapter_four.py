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
    for query, marker_text, budget in (("autotest=1","STORY_CHAPTER_FOUR_OK",7000),("replaytest=1","STORY_CHAPTER_FOUR_REPLAY_OK",1600),("revealed=1&reloadtest=1","STORY_CHAPTER_FOUR_RELOAD_OK",1200)):
        url=f"http://127.0.0.1:{server.server_port}/scripts/story_chapter_four_harness.html?{query}"
        with tempfile.TemporaryDirectory(prefix="koala-chapter-four-") as profile:
            process=subprocess.run([r"C:\Program Files\Google\Chrome\Application\chrome.exe","--headless=new","--disable-gpu","--no-sandbox","--window-size=360,780",f"--user-data-dir={profile}",f"--virtual-time-budget={budget}","--dump-dom",url],capture_output=True,text=True,encoding="utf-8",errors="replace",timeout=20)
        output=process.stdout+process.stderr
        if marker_text not in output:
            marker=output.find('id="validationResult"');raise SystemExit(output[marker:marker+700] if marker>=0 else output[-1200:])
    print("STORY_CHAPTER_FOUR_OK (llave, caja, cachorro pequeño y cierre persistente)")
finally:
    server.shutdown();server.server_close()

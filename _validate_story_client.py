from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import tempfile
from threading import Thread


ROOT = Path(__file__).resolve().parent


class QuietHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/__story_client__":
            page = b'''<!doctype html><meta charset="utf-8"><output id="result">PENDING</output>
<script>
let failOnce = true;
const calls = [];
window._loveClient = { rpc: async (name, params = {}) => {
  calls.push({ name, params });
  if (name === 'advance_house_story' && failOnce) {
    failOnce = false;
    return { data:null, error:{ message:'temporary network failure' } };
  }
  if (name === 'advance_house_story') return { data:{ available:true, chapter:1, status:'active' }, error:null };
  if (name === 'get_house_story_progress') return { data:{ available:true, chapter:1, status:'active' }, error:null };
  return { data:true, error:null };
}};
</script>
<script src="/house-story.js"></script>
<script>
(async () => {
  try {
    try { await HouseStoryEngine.start({ eventKey:'event-client-001' }); } catch (_) {}
    await HouseStoryEngine.flush();
    const advances = calls.filter(call => call.name === 'advance_house_story');
    await HouseStoryEngine.flush();
    const advancesAfterSecondFlush = calls.filter(call => call.name === 'advance_house_story');
    const checks = [
      advances.length === 2,
      advances.every(call => call.params.p_event_key === 'event-client-001'),
      advancesAfterSecondFlush.length === 2,
      HouseStoryEngine.snapshot().chapter === 1
    ];
    result.textContent = checks.every(Boolean) ? 'STORY_CLIENT_OK' : 'STORY_CLIENT_FAILED';
  } catch (error) {
    result.textContent = 'STORY_CLIENT_FAILED: ' + error.message;
  }
})();
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
    with tempfile.TemporaryDirectory(prefix="koala-story-") as profile:
        process = subprocess.run([
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            "--headless=new", "--disable-gpu", "--no-sandbox",
            f"--user-data-dir={profile}", "--virtual-time-budget=4000", "--dump-dom",
            f"{base}/__story_client__",
        ], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20)
    output = process.stdout + process.stderr
    if "STORY_CLIENT_OK" not in output:
        marker = output.find('<output id="result">')
        raise SystemExit(output[marker:marker + 500] if marker >= 0 else output[-1000:])
    print("STORY_CLIENT_OK (cola durable e idempotencia)")
finally:
    server.shutdown()
    server.server_close()

from pathlib import Path
import json
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options


ROOT = Path(__file__).resolve().parent
results = {}
realtime_source = (ROOT / "realtime.js").read_text(encoding="utf-8")
together_source = (ROOT / "together.js").read_text(encoding="utf-8")
service_worker_source = (ROOT / "sw.js").read_text(encoding="utf-8")
results["presence_uses_per_session_key"] = "key: `${identity}:${sessionId}`" in realtime_source and "tracked_at:new Date().toISOString()" in realtime_source
results["journal_excludes_mimos"] = ".neq('event_type', 'mimo')" in together_source and "event_key: `mimo:" not in realtime_source
results["message_title_not_redundant"] = "Un mensajito de ${identity" in realtime_source and "pensó en vos`, text" not in realtime_source
results["cache_version"] = "love-app-v30-stability" in service_worker_source

opts = Options()
opts.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
opts.add_argument("--headless=new")
opts.add_argument("--disable-gpu")
opts.add_argument("--no-sandbox")
opts.add_argument("--window-size=393,852")
opts.add_experimental_option("mobileEmulation", {"deviceMetrics": {"width": 393, "height": 852, "pixelRatio": 3}, "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"})
opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})
opts.page_load_strategy = "eager"

driver = webdriver.Chrome(options=opts)
try:
    driver.get("http://127.0.0.1:8765/index.html?validation=stability")
    driver.execute_script("localStorage.setItem('love_identity','joel'); localStorage.setItem('koala_phase_2_1_surprise_seen','1'); localStorage.setItem('birthday_2026_celebrated','1');")
    driver.refresh()
    time.sleep(5)

    results["viewport"] = driver.execute_script("return [innerWidth, innerHeight]")
    results["startup_confetti_nodes"] = driver.execute_script("return document.querySelectorAll('.confetti-piece,.heart-fall').length")
    results["background_particle_animation"] = driver.execute_script(
        "return getComputedStyle(document.body,'::after').animationName"
    )
    results["running_animations_on_open"] = driver.execute_script(
        "return document.getAnimations().filter(a=>a.playState==='running').length"
    )
    results["load_timing_ms"] = driver.execute_script(
        "const n=performance.getEntriesByType('navigation')[0]; return n?{dom:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd)}:null"
    )

    paused = driver.execute_script(
        "return [...document.querySelectorAll('.tab-content:not(.active) *')].every(el => getComputedStyle(el).animationPlayState !== 'running')"
    )
    results["inactive_tab_animations_paused"] = paused

    memories = driver.find_element(By.CSS_SELECTOR, ".bottom-nav button[onclick*=\"memories\"]")
    driver.execute_script("arguments[0].click()", memories)
    time.sleep(.4)
    canvas = driver.find_element(By.ID, "loveCanvas")
    driver.execute_script("arguments[0].scrollIntoView({block:'center'})", canvas)
    driver.execute_script("document.getElementById('drawTextTool').click()")
    text_input = driver.find_element(By.ID, "drawTextInput")
    driver.execute_script("arguments[0].value='Siempre vos'; arguments[0].dispatchEvent(new Event('input',{bubbles:true}))", text_input)
    driver.execute_script("document.getElementById('drawTextPlace').click()")
    driver.execute_script(
        "const c=arguments[0],r=c.getBoundingClientRect(),fire=(type,x,y,buttons)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:7,pointerType:'touch',buttons,clientX:r.left+x,clientY:r.top+y}));"
        "fire('pointerdown',35,70,1); fire('pointermove',155,125,1); fire('pointerup',155,125,0);",
        canvas,
    )
    time.sleep(.3)
    results["text_drag_committed"] = driver.execute_script(
        "const c=document.getElementById('loveCanvas'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;"
        "let colored=0,minX=c.width; for(let i=0;i<d.length;i+=4){const p=i/4,px=p%c.width;if(d[i]>100&&d[i+1]<200&&d[i+2]<180&&d[i+3]>0){colored++;minX=Math.min(minX,px)}}"
        "return {colored,minX,tool:document.getElementById('drawPen').classList.contains('active'),undo:!document.getElementById('drawUndo').disabled}"
    )
    results["custom_color_available"] = driver.find_element(By.ID, "drawCustomColor").get_attribute("type") == "color"

    severe = []
    for entry in driver.get_log("browser"):
        if entry["level"] == "SEVERE" and not any(x in entry["message"] for x in ["favicon", "ERR_CERT", "Blocked call to navigator.vibrate"]):
            severe.append(entry["message"])
    results["severe_console_errors"] = severe
finally:
    driver.quit()


def smoke_platform(label, width, height, mobile=None):
    platform_opts = Options()
    platform_opts.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    platform_opts.add_argument("--headless=new")
    platform_opts.add_argument(f"--window-size={width},{height}")
    platform_opts.page_load_strategy = "eager"
    platform_opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    if mobile:
        platform_opts.add_experimental_option("mobileEmulation", mobile)
    browser = webdriver.Chrome(options=platform_opts)
    try:
        browser.get(f"http://127.0.0.1:8765/index.html?validation={label}")
        browser.execute_script("localStorage.setItem('love_identity','joel'); localStorage.setItem('birthday_2026_celebrated','1'); localStorage.setItem('love_active_tab','home')")
        browser.refresh()
        time.sleep(2)
        errors = [entry["message"] for entry in browser.get_log("browser") if entry["level"] == "SEVERE" and "navigator.vibrate" not in entry["message"]]
        return {
            "viewport": browser.execute_script("return [innerWidth,innerHeight]"),
            "ready": browser.execute_script("return document.readyState"),
            "app_visible": browser.find_element(By.ID, "home").is_displayed(),
            "errors": errors,
        }
    finally:
        browser.quit()


results["platform_smoke"] = {
    "windows_chrome": smoke_platform("windows", 1280, 800),
    "android_chrome": smoke_platform("android", 412, 915, {
        "deviceMetrics": {"width": 412, "height": 915, "pixelRatio": 2.6},
        "userAgent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/151 Mobile Safari/537.36",
    }),
}

print(json.dumps(results, ensure_ascii=False, indent=2))

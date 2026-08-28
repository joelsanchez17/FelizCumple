from pathlib import Path
import json
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service


ROOT = Path(__file__).resolve().parent
CACHED_CHROME_DRIVERS = sorted(
    (Path.home() / ".cache" / "selenium" / "chromedriver" / "win64").glob("*/chromedriver.exe"),
    reverse=True,
)


def open_chrome(options):
    if CACHED_CHROME_DRIVERS:
        return webdriver.Chrome(service=Service(str(CACHED_CHROME_DRIVERS[0])), options=options)
    return webdriver.Chrome(options=options)


results = {}
realtime_source = (ROOT / "realtime.js").read_text(encoding="utf-8")
together_source = (ROOT / "together.js").read_text(encoding="utf-8")
service_worker_source = (ROOT / "sw.js").read_text(encoding="utf-8")
index_source = (ROOT / "index.html").read_text(encoding="utf-8")
refresh_css_source = (ROOT / "app_refresh.css").read_text(encoding="utf-8")
together_css_source = (ROOT / "together.css").read_text(encoding="utf-8")
results["presence_uses_per_session_key"] = "key: `${identity}:${sessionId}`" in realtime_source and "const sessionId = crypto.randomUUID?.()" in realtime_source
results["presence_prefers_latest_activity"] = "b.last_activity_at || b.tracked_at" in realtime_source and "last_activity_at:lastActivityAt" in realtime_source
results["presence_recovers_connection"] = all(status in realtime_source for status in ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED", "OFFLINE"])
save_device_source = together_source[together_source.index("async function saveHouseDevice"):together_source.index("async function sendHouseMotion")]
results["house_persists_before_broadcast"] = save_device_source.index("house_device_states") < save_device_source.index("sendLoveRealtime")
results["supabase_is_local_and_pinned"] = "assets/vendor/supabase.js?v=2.112.4" in (ROOT / "index.html").read_text(encoding="utf-8")
results["notification_has_dedicated_assets"] = all(asset in service_worker_source for asset in ["notification-icon.png", "notification-badge.png", "notification_id"])
results["journal_excludes_mimos"] = ".neq('event_type', 'mimo')" in together_source and "event_key: `mimo:" not in realtime_source
results["message_title_not_redundant"] = "Un mensajito de ${identity" in realtime_source and "pensó en vos`, text" not in realtime_source
results["ios_haptic_fallback"] = "window.loveHaptic" in index_source and ".love-haptic-flash" in refresh_css_source
results["ios_push_sound_enabled"] = "silent:false" in service_worker_source
results["cache_version"] = "love-app-v63-bed-actions" in service_worker_source
results["house_status_outside_scene"] = "house-status-board" in index_source and "ningún mueble los tape" in together_css_source
results["shared_invitations_persist"] = "saveHouseDevice('shared_invitation'" in together_source and "5 * 60 * 1000" in together_source
results["shared_invitations_require_acceptance"] = "answerSharedInvitation(true)" in together_source and "status:accept ? 'accepted' : 'declined'" in together_source
results["shared_activities_update_both_people"] = "async function saveCoupleActivity" in together_source and "['joel', 'princesa'].map" in together_source
results["shared_invitation_push_opens_house"] = together_source.count("'house-invitation'") >= 2
results["bed_has_synced_affection_actions"] = all(token in together_source for token in ["type:'bed_together'", "animateBedTogetherMotion", "sendBedTogetherMotion"])
results["bed_actions_have_visible_effects"] = all(token in together_css_source for token in [".is-bed-cuddle", ".is-bed-kiss", ".is-bed-caress", ".house-bed-action-effect"])
results["dining_plant_uses_growth_engine"] = "dining: { device:'jasmine'" in together_source and "dining-jasmine-states.webp" in together_css_source
results["bedroom_lamps_have_distinct_shades"] = ".house-person-princesa .house-lamp b" in together_css_source and ".house-lamp.is-lit::before" in together_css_source
results["startup_does_not_restore_last_tab"] = "localStorage.getItem('love_active_tab')" not in index_source
results["dining_objects_have_furniture"] = "dining-sideboard" in index_source and ".dining-sideboard" in together_css_source
results["navigation_refreshes_offline_copy"] = "cache:'no-store'" in service_worker_source and "cache.put(cacheKey, response.clone())" in service_worker_source
results["old_caches_removed_before_claim"] = "await Promise.all(keys.filter(key => key !== CACHE_NAME)" in service_worker_source and "await self.clients.claim()" in service_worker_source

opts = Options()
opts.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
opts.add_argument("--headless=new")
opts.add_argument("--disable-gpu")
opts.add_argument("--no-sandbox")
opts.add_argument("--window-size=393,852")
opts.add_experimental_option("mobileEmulation", {"deviceMetrics": {"width": 393, "height": 852, "pixelRatio": 3}, "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"})
opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})
opts.page_load_strategy = "eager"

driver = open_chrome(opts)
try:
    driver.get("http://127.0.0.1:8765/index.html?validation=stability")
    driver.execute_script("localStorage.setItem('love_identity','joel'); localStorage.setItem('koala_phase_2_1_surprise_seen','1'); localStorage.setItem('birthday_2026_celebrated','1'); localStorage.setItem('love_active_tab','together');")
    driver.refresh()
    time.sleep(5)

    results["viewport"] = driver.execute_script("return [innerWidth, innerHeight]")
    results["normal_start_stays_on_home"] = driver.execute_script("return document.getElementById('home').classList.contains('active')&&!document.getElementById('together').classList.contains('active')")
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
    driver.execute_script("window.loveHaptic(10,{forceVisual:true})")
    results["haptic_visual_feedback_runs"] = driver.execute_script(
        "return document.getElementById('loveHapticFlash')?.classList.contains('show')"
    )
    driver.execute_script(
        "window.showTab(document.querySelector('.bottom-nav button[onclick*=\"together\"]'),'together');"
        "document.querySelector('[data-enter-room=\"bedroom\"]').click();"
    )
    time.sleep(.3)
    results["house_status_cards_visible"] = driver.execute_script(
        "const cards=[...document.querySelectorAll('.house-status-card')],room=document.querySelector('.house-interior').getBoundingClientRect();"
        "return cards.length===2&&cards.every(card=>{const r=card.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=room.bottom-1});"
    )
    results["shared_activity_controls_fit_iphone"] = driver.execute_script(
        "const box=document.getElementById('houseSharedActivities').getBoundingClientRect(),buttons=document.querySelectorAll('[data-shared-invite]');"
        "return buttons.length===3&&box.width>0&&box.left>=0&&box.right<=innerWidth;"
    )
    results["bed_affection_controls_exist"] = driver.execute_script(
        "const buttons=document.querySelectorAll('[data-bed-together]');return buttons.length===3&&[...buttons].every(b=>b.closest('#houseBedActions'));"
    )
    results["shared_invitation_prompt_fits_iphone"] = driver.execute_script(
        "const panel=document.getElementById('houseSharedInvitation');panel.hidden=false;"
        "document.getElementById('houseSharedInvitationTitle').textContent='Princesa te está invitando';"
        "document.getElementById('houseSharedInvitationText').textContent='Princesa quiere cerrar la puerta y bajar las luces con vos.';"
        "const r=panel.getBoundingClientRect(),ok=r.width>0&&r.left>=0&&r.right<=innerWidth;panel.hidden=true;return ok;"
    )
    driver.execute_script("document.querySelector('.house-lamp').classList.add('is-lit')")
    time.sleep(.4)
    results["bedroom_lamps_render_and_glow"] = driver.execute_script(
        "const lamps=[...document.querySelectorAll('.house-lamp')],shades=lamps.map(l=>getComputedStyle(l.querySelector('b')).backgroundImage),glow=getComputedStyle(lamps[0],'::before').opacity;"
        "lamps[0].classList.remove('is-lit');return lamps.length===2&&shades[0]!==shades[1]&&Number(glow)>.9;"
    )
    driver.execute_script(
        "document.querySelector('#houseBedroom [data-open-house-map]').click();"
        "document.querySelector('[data-enter-room=\"dining\"]').click();"
    )
    time.sleep(.2)
    results["dining_plant_fits_iphone"] = driver.execute_script(
        "const plant=document.getElementById('diningPlant').getBoundingClientRect(),room=document.querySelector('.dining-room').getBoundingClientRect();"
        "return plant.width>0&&plant.left>=room.left&&plant.right<=room.right&&plant.top>=room.top&&plant.bottom<=room.bottom;"
    )
    results["dining_plant_and_tv_are_grounded"] = driver.execute_script(
        "const shelf=document.querySelector('.dining-sideboard').getBoundingClientRect(),pot=document.querySelector('#diningPlant>i').getBoundingClientRect(),tv=document.getElementById('diningTv').getBoundingClientRect();"
        "return Math.abs(pot.bottom-shelf.top)<=6&&Math.abs(tv.bottom+18-shelf.top)<=6;"
    )

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
        if entry["level"] == "SEVERE" and not any(x in entry["message"] for x in ["favicon", "ERR_CERT", "ERR_NETWORK_ACCESS_DENIED", "Blocked call to navigator.vibrate"]):
            severe.append(entry["message"])
    results["severe_console_errors"] = severe
finally:
    driver.quit()


def smoke_platform(label, width, height, mobile=None):
    platform_opts = Options()
    platform_opts.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    platform_opts.add_argument("--headless=new")
    platform_opts.add_argument("--disable-gpu")
    platform_opts.add_argument("--no-sandbox")
    platform_opts.add_argument(f"--window-size={width},{height}")
    platform_opts.page_load_strategy = "eager"
    platform_opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    if mobile:
        platform_opts.add_experimental_option("mobileEmulation", mobile)
    browser = open_chrome(platform_opts)
    try:
        browser.get(f"http://127.0.0.1:8765/index.html?validation={label}")
        browser.execute_script("localStorage.setItem('love_identity','joel'); localStorage.setItem('birthday_2026_celebrated','1'); localStorage.setItem('love_active_tab','home')")
        browser.refresh()
        time.sleep(2)
        errors = [entry["message"] for entry in browser.get_log("browser") if entry["level"] == "SEVERE" and not any(x in entry["message"] for x in ["navigator.vibrate", "ERR_NETWORK_ACCESS_DENIED"])]
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

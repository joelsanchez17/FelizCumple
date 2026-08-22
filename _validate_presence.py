import json
import os
import sys
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

sys.stdout.reconfigure(encoding="utf-8")


def browser():
    options = Options()
    options.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    options.add_argument("--headless=new")
    options.add_argument("--window-size=393,852")
    options.add_experimental_option("mobileEmulation", {
        "deviceMetrics": {"width": 393, "height": 852, "pixelRatio": 3},
        "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    })
    options.page_load_strategy = "eager"
    return webdriver.Chrome(options=options)


def setup(driver, identity):
    driver.get(f"http://127.0.0.1:8765/index.html?presence={identity}")
    driver.execute_script(
        f"localStorage.setItem('love_identity','{identity}');"
        "localStorage.setItem('birthday_2026_celebrated','1');"
        "localStorage.setItem('love_active_tab','home')"
    )
    driver.refresh()
    time.sleep(4)
    driver.execute_script(
        "const button=[...document.querySelectorAll('.bottom-nav button')]"
        ".find(item=>item.getAttribute('onclick')?.includes(\"'together'\"));"
        "showTab(button,'together',{vibrate:false})"
    )


def wait_for(driver, expression, seconds=8):
    deadline = time.time() + seconds
    while time.time() < deadline:
        if driver.execute_script(f"return Boolean({expression})"):
            return True
        time.sleep(.25)
    return False


joel = princesa = None
try:
    joel = browser()
    setup(joel, "joel")
    princesa = browser()
    setup(princesa, "princesa")
    time.sleep(6)
    result = {}
    for identity, driver in (("joel", joel), ("princesa", princesa)):
        result[identity] = driver.execute_script(
            "return {"
            "room:localStorage.getItem('love_last_house_room'),"
            "joel:houseJoel.classList.contains('is-online'),"
            "princesa:housePrincesa.classList.contains('is-online'),"
            "message:housePresenceMessage.textContent}"
        )

    # La cama no debe invadir los objetos centrales antes de usarla.
    result["layout"] = princesa.execute_script(
        "const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height}};"
        "const hit=(a,b)=>a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t;"
        "const bed=rect('#houseBed'),table=rect('.house-table'),windowBox=rect('#houseWindow'),heater=rect('#houseHeater');"
        "return {viewport:[innerWidth,innerHeight],bed,overlaps:{table:hit(bed,table),window:hit(bed,windowBox),heater:hit(bed,heater)}}"
    )

    # Joel duerme y Princesa recibe el estado por Realtime.
    joel.execute_script("houseBed.click()")
    result["joel_sleep_synced"] = wait_for(princesa, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')")

    # El sueño persiste al recargar la aplicación.
    joel.refresh()
    time.sleep(4)
    result["sleep_survives_reload"] = wait_for(joel, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')")

    # Los dos pueden dormir simultáneamente.
    princesa.execute_script("houseBed.click()")
    result["both_sleeping"] = wait_for(princesa, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')&&document.querySelector('[data-avatar-for=princesa]').classList.contains('is-sleeping')")
    result["zzz_visible"] = princesa.execute_script(
        "const j=document.querySelector('[data-avatar-for=joel]'),p=document.querySelector('[data-avatar-for=princesa]');return getComputedStyle(j,'::after').content.includes('zzz')&&getComputedStyle(p,'::after').content.includes('zzz')"
    )
    screenshot = os.path.join(os.environ.get("TEMP", "."), "loveapp-bedroom-sleep.png")
    princesa.save_screenshot(screenshot)
    result["screenshot"] = screenshot

    # Evita enviar una push real durante la prueba; el despertar sí usa Realtime y Supabase.
    princesa.execute_script("window.sendLovePush=async()=>true; document.querySelector('[data-avatar-for=joel]').click()")
    result["princesa_woke_joel"] = wait_for(joel, "!document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')")
    princesa.execute_script("houseBed.click()")
    result["activities_cleaned"] = wait_for(princesa, "!document.querySelector('[data-avatar-for=princesa]').classList.contains('is-sleeping')")
    print(json.dumps(result, ensure_ascii=False, indent=2))
finally:
    if joel:
        joel.quit()
    if princesa:
        princesa.quit()

import json
import sys
import tempfile
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

sys.stdout.reconfigure(encoding="utf-8")

options = Options()
options.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
options.add_argument("--headless=new")
options.add_argument("--window-size=393,852")
options.add_experimental_option("mobileEmulation", {
    "deviceMetrics": {"width": 393, "height": 852, "pixelRatio": 3},
    "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
})
options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
driver = webdriver.Chrome(options=options)
results = {}


def set_growth(plant_id, level):
    driver.execute_script(
        "const p=document.getElementById(arguments[0]);"
        "['sprout','grown','flower','thirsty','wilted'].forEach(x=>p.classList.remove('plant-stage-'+x));"
        "[0,1,2,3,4].forEach(x=>p.classList.remove('plant-growth-'+x));"
        "p.classList.add('plant-growth-'+arguments[1],arguments[1]===4?'plant-stage-flower':arguments[1]>=2?'plant-stage-grown':'plant-stage-sprout')",
        plant_id, level,
    )


def set_plant_stage(plant_id, stage, growth=4):
    driver.execute_script(
        "const p=document.getElementById(arguments[0]);"
        "['sprout','grown','flower','thirsty','wilted'].forEach(x=>p.classList.remove('plant-stage-'+x));"
        "[0,1,2,3,4].forEach(x=>p.classList.remove('plant-growth-'+x));"
        "p.classList.add('plant-growth-'+arguments[2],'plant-stage-'+arguments[1])",
        plant_id, stage, growth,
    )


try:
    driver.get("http://127.0.0.1:8765/index.html?plant-growth-validation=1")
    driver.execute_script(
        "localStorage.setItem('love_identity','joel');"
        "localStorage.setItem('birthday_2026_celebrated','1');"
        "localStorage.setItem('love_last_house_room','bedroom')"
    )
    driver.refresh()
    time.sleep(5)
    driver.execute_script(
        "const b=[...document.querySelectorAll('.bottom-nav button')].find(x=>x.getAttribute('onclick')?.includes(\"'together'\"));showTab(b,'together',{vibrate:false})"
    )
    time.sleep(2)
    room_data = (("bedroom", "housePlant"), ("kitchen", "kitchenPlant"), ("bathroom", "bathroomPlant"))
    for room, plant_id in room_data:
        if room != "bedroom":
            driver.execute_script(
                "document.querySelector('[data-open-house-map]').click();"
                "document.querySelector('[data-enter-room=\"%s\"]').click()" % room
            )
            time.sleep(.4)
        for level in range(5):
            set_growth(plant_id, level)
            time.sleep(.65)
            path = Path(tempfile.gettempdir()) / f"loveapp-{room}-plant-{level}.png"
            driver.find_element("css selector", f"[data-room-surface='{room}']").screenshot(str(path))
            results[f"{room}_{level}"] = str(path)
        results[f"{room}_layout"] = driver.execute_script(
            "const s=document.querySelector('[data-room-surface=\"'+arguments[0]+'\"]')?.getBoundingClientRect();"
            "const p=document.getElementById(arguments[1])?.querySelector('.plant-visual')?.getBoundingClientRect();"
            "const pot=document.getElementById(arguments[1])?.querySelector(':scope > i')?.getBoundingClientRect();"
            "const heater=arguments[0]==='bedroom'?document.querySelector('.house-heater')?.getBoundingClientRect():null;"
            "return {insideTop:p.top>=s.top-0.5,insideSides:p.left>=s.left-0.5&&p.right<=s.right+0.5,"
            "centerDelta:Math.round(Math.abs((p.left+p.width/2)-(pot.left+pot.width/2))*10)/10,"
            "contactGap:Math.round((pot.top-p.bottom)*10)/10,"
            "heaterGap:heater?Math.round((p.top-heater.bottom)*10)/10:null};",
            room, plant_id,
        )
        for stage in ("thirsty", "wilted"):
            set_plant_stage(plant_id, stage)
            time.sleep(.35)
            path = Path(tempfile.gettempdir()) / f"loveapp-{room}-plant-{stage}.png"
            driver.find_element("css selector", f"[data-room-surface='{room}']").screenshot(str(path))
            results[f"{room}_{stage}"] = str(path)
        set_plant_stage(plant_id, "flower")
        results[f"{room}_recovered"] = driver.execute_script(
            "const p=document.getElementById(arguments[0]);const v=p.querySelector('.plant-visual');"
            "const css=getComputedStyle(v);"
            "return p.classList.contains('plant-stage-flower')&&p.classList.contains('plant-growth-4')"
            "&&parseFloat(css.backgroundPositionX)===0&&parseFloat(css.backgroundPositionY)===100;",
            plant_id,
        )
    results["contact"] = driver.execute_script(
        "const p=bathroomPlant.querySelector('.plant-visual').getBoundingClientRect(),pot=bathroomPlant.querySelector(':scope > i').getBoundingClientRect();"
        "return {gap:Math.round((pot.top-p.bottom)*10)/10,overflow:document.documentElement.scrollWidth>innerWidth}"
    )
    results["severe_console_errors"] = [
        item["message"] for item in driver.get_log("browser")
        if item["level"] == "SEVERE" and "navigator.vibrate" not in item["message"] and "favicon" not in item["message"]
    ]
    source = Path("together.js").read_text(encoding="utf-8")
    results["watering_preserves_recovery"] = (
        "growth:Math.min(4, current.growth + (mayGrow ? 1 : 0))" in source
        and "dryHours >= 72 ? 'wilted'" in source
        and "setRoomPlantState(roomId, state, true)" in source
    )
finally:
    driver.quit()

print(json.dumps(results, ensure_ascii=False, indent=2))

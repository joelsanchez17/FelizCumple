import json
import sys
import tempfile
import time
from pathlib import Path

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
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    options.page_load_strategy = "eager"
    return webdriver.Chrome(options=options)


def wait_for(driver, expression, seconds=10):
    deadline = time.time() + seconds
    while time.time() < deadline:
        if driver.execute_script(f"return Boolean({expression})"):
            return True
        time.sleep(.2)
    return False


def setup(driver, identity):
    driver.get(f"http://127.0.0.1:8765/index.html?rooms={identity}-{time.time()}")
    driver.execute_script(
        f"localStorage.setItem('love_identity','{identity}');"
        "localStorage.setItem('birthday_2026_celebrated','1');"
        "localStorage.setItem('love_last_house_room','bedroom')"
    )
    driver.refresh()
    time.sleep(4)
    driver.execute_script(
        "const b=[...document.querySelectorAll('.bottom-nav button')].find(x=>x.getAttribute('onclick')?.includes(\"'together'\"));"
        "showTab(b,'together',{vibrate:false})"
    )
    wait_for(driver, "document.querySelector('[data-room-view=bedroom]') && !document.querySelector('[data-room-view=bedroom]').hidden")


def enter(driver, room):
    driver.execute_script(
        "document.querySelector('[data-open-house-map]').click();"
        "document.querySelector('[data-enter-room=\"%s\"]').click()" % room
    )
    return wait_for(driver, f"!document.querySelector('[data-room-view={room}]').hidden")


joel = princesa = None
result = {}
try:
    joel, princesa = browser(), browser()
    setup(joel, "joel")
    setup(princesa, "princesa")
    time.sleep(4)

    # Escena bajo la sábana: ambos deben verla y el botón sólo se habilita con los dos despiertos.
    joel.execute_script("houseBed.click()")
    princesa.execute_script("houseBed.click()")
    result["both_awake_in_bed"] = wait_for(joel, "!houseBedIntimate.disabled") and wait_for(princesa, "!houseBedIntimate.disabled")
    joel.execute_script("houseBedIntimate.click()")
    result["blanket_scene_shared"] = wait_for(joel, "houseBed.classList.contains('is-private-moment')") and wait_for(princesa, "houseBed.classList.contains('is-private-moment')")
    result["blanket_hides_both"] = joel.execute_script("return document.querySelectorAll('.house-avatar.is-under-blanket').length === 2")
    bed_screenshot = Path(tempfile.gettempdir()) / "loveapp-bed-secret.png"
    joel.save_screenshot(str(bed_screenshot))
    result["bed_screenshot"] = str(bed_screenshot)
    joel.execute_script("houseBedLeave.click()")
    princesa.execute_script("houseBedLeave.click()")
    wait_for(joel, "!document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-bed')")

    # Cocina: foto visible, cactus regable y estado reflejado en la otra sesión.
    result["kitchen_entered"] = enter(joel, "kitchen") and enter(princesa, "kitchen")
    result["real_photo_loaded"] = joel.execute_script("const i=document.querySelector('.kitchen-couple-picture img');return i.complete && i.naturalWidth>0 && i.getAttribute('src')==='besos.jpg'")
    joel.execute_script("kitchenPlant.click()")
    result["cactus_synced"] = wait_for(princesa, "kitchenPlant.classList.contains('is-watered') && kitchenPlantStatus.textContent.includes('Joel')")
    kitchen_screenshot = Path(tempfile.gettempdir()) / "loveapp-kitchen.png"
    joel.save_screenshot(str(kitchen_screenshot))
    result["kitchen_screenshot"] = str(kitchen_screenshot)

    # Baño: orquídea compartida y ducha ocupable por uno o por ambos.
    result["bathroom_entered"] = enter(joel, "bathroom") and enter(princesa, "bathroom")
    princesa.execute_script("bathroomPlant.click()")
    result["orchid_synced"] = wait_for(joel, "bathroomPlant.classList.contains('is-watered') && bathroomPlantStatus.textContent.includes('Princesa')")
    joel.execute_script(
        "['sprout','grown','thirsty','wilted'].forEach(x=>bathroomPlant.classList.remove('plant-stage-'+x));"
        "[0,1,2,3].forEach(x=>bathroomPlant.classList.remove('plant-growth-'+x));"
        "bathroomPlant.classList.add('plant-stage-flower','plant-growth-4'); bathroomPlantStatus.textContent='¡A la orquídea le salió una flor!'"
    )
    flower_screenshot = Path(tempfile.gettempdir()) / "loveapp-orchid-flower.png"
    joel.save_screenshot(str(flower_screenshot))
    result["flower_screenshot"] = str(flower_screenshot)
    joel.execute_script("bathroomShower.click()")
    result["single_shower_synced"] = wait_for(princesa, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-shower')")
    princesa.execute_script("bathroomShower.click()")
    result["shared_shower_synced"] = wait_for(joel, "bathroomShower.classList.contains('has-two') && bathroomShowerStatus.textContent.includes('juntos')")
    time.sleep(.8)
    result["shower_layout"] = joel.execute_script(
        "const hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;"
        "const s=bathroomShower.getBoundingClientRect(),j=document.querySelector('[data-avatar-for=joel]').getBoundingClientRect(),p=document.querySelector('[data-avatar-for=princesa]').getBoundingClientRect();"
        "const ja=document.querySelector('[data-avatar-for=joel]'),pa=document.querySelector('[data-avatar-for=princesa]');"
        "return {viewport:[innerWidth,innerHeight],joelInside:hit(s,j),princesaInside:hit(s,p),avatarsOverlap:hit(j,p),overflow:document.documentElement.scrollWidth>innerWidth,joelClass:ja.className,princesaClass:pa.className,joelOpacity:getComputedStyle(ja).opacity,princesaOpacity:getComputedStyle(pa).opacity}"
    )
    screenshot = Path(tempfile.gettempdir()) / "loveapp-kitchen-bathroom.png"
    joel.save_screenshot(str(screenshot))
    result["screenshot"] = str(screenshot)

    # La actividad persiste al recargar y luego se limpia para no dejar a nadie en la ducha.
    joel.refresh()
    time.sleep(4)
    joel.execute_script(
        "const b=[...document.querySelectorAll('.bottom-nav button')].find(x=>x.getAttribute('onclick')?.includes(\"'together'\"));showTab(b,'together',{vibrate:false})"
    )
    result["shower_survives_reload"] = wait_for(joel, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-shower')")
    joel.execute_script("bathroomShower.click()")
    princesa.execute_script("bathroomShower.click()")
    result["activities_cleaned"] = wait_for(joel, "!document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-shower')") and wait_for(princesa, "!document.querySelector('[data-avatar-for=princesa]').classList.contains('is-in-shower')")

    errors = []
    for driver in (joel, princesa):
        errors.extend(item["message"] for item in driver.get_log("browser") if item["level"] == "SEVERE" and "favicon" not in item["message"] and "navigator.vibrate" not in item["message"])
    result["severe_console_errors"] = errors
finally:
    for driver in (joel, princesa):
        if driver:
            driver.quit()

print(json.dumps(result, ensure_ascii=False, indent=2))

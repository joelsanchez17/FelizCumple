import json
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
    print(json.dumps(result, ensure_ascii=False, indent=2))
finally:
    if joel:
        joel.quit()
    if princesa:
        princesa.quit()

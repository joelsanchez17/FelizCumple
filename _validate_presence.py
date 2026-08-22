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

    # Acerca temporalmente a Joel, hace doble toque y comprueba el salto en ambas sesiones.
    original_position = joel.execute_script(
        "const a=document.querySelector('[data-avatar-for=joel]');return {x:parseFloat(a.style.getPropertyValue('--avatar-left')),y:parseFloat(a.style.getPropertyValue('--avatar-top'))}"
    )
    joel.execute_script(
        "const a=document.querySelector('[data-avatar-for=joel]'),p=document.querySelector('[data-avatar-for=princesa]'),s=document.querySelector('[data-room-surface=bedroom]'),r=s.getBoundingClientRect();"
        "const px=parseFloat(p.style.getPropertyValue('--avatar-left'))/100,py=parseFloat(p.style.getPropertyValue('--avatar-top'))/100,ar=a.getBoundingClientRect();"
        "const fire=(type,x,y,buttons)=>a.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:41,pointerType:'touch',buttons,clientX:x,clientY:y}));"
        "fire('pointerdown',ar.left+ar.width/2,ar.top+ar.height/2,1);fire('pointermove',r.left+(px-.12)*r.width,r.top+py*r.height,1);fire('pointerup',r.left+(px-.12)*r.width,r.top+py*r.height,0)"
    )
    time.sleep(1)
    joel.execute_async_script(
        "const done=arguments[0],a=document.querySelector('[data-avatar-for=joel]'),r=a.getBoundingClientRect();let id=51;"
        "const tap=()=>{const x=r.left+r.width/2,y=r.top+r.height/2;a.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',buttons:1,clientX:x,clientY:y}));a.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:id++,pointerType:'touch',buttons:0,clientX:x,clientY:y}))};"
        "tap();setTimeout(()=>{tap();setTimeout(done,80)},120)"
    )
    motion_id = joel.execute_script("return document.querySelector('[data-avatar-for=joel]').dataset.lastMotion||''")
    result["double_tap_jump_local"] = bool(motion_id)
    jump_screenshot = os.path.join(os.environ.get("TEMP", "."), "loveapp-house-jump.png")
    joel.save_screenshot(jump_screenshot)
    result["jump_screenshot"] = jump_screenshot
    result["double_tap_jump_synced"] = wait_for(princesa, f"document.querySelector('[data-avatar-for=joel]').dataset.lastMotion==='{motion_id}'")
    result["nearby_jump_reaction"] = wait_for(princesa, "Boolean(document.querySelector('[data-condition=house_motion]'))")

    # Devuelve la posición de Joel exactamente a donde estaba antes de la prueba.
    joel.execute_script(
        "const ox=arguments[0],oy=arguments[1],a=document.querySelector('[data-avatar-for=joel]'),s=document.querySelector('[data-room-surface=bedroom]'),r=s.getBoundingClientRect(),ar=a.getBoundingClientRect();"
        "const fire=(type,x,y,buttons)=>a.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:61,pointerType:'touch',buttons,clientX:x,clientY:y}));"
        "fire('pointerdown',ar.left+ar.width/2,ar.top+ar.height/2,1);fire('pointermove',r.left+ox*r.width/100,r.top+oy*r.height/100,1);fire('pointerup',r.left+ox*r.width/100,r.top+oy*r.height/100,0)",
        original_position["x"], original_position["y"]
    )
    time.sleep(1)

    # Cada corrida parte fuera de la cama, incluso si una prueba anterior se interrumpió.
    for driver in (joel, princesa):
        if driver.execute_script("return document.querySelector('[data-avatar-for='+localStorage.getItem('love_identity')+']').classList.contains('is-in-bed')"):
            driver.execute_script("houseBedLeave.click()")
    result["clean_bed_start"] = wait_for(joel, "!document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-bed')") and wait_for(princesa, "!document.querySelector('[data-avatar-for=princesa]').classList.contains('is-in-bed')")
    time.sleep(.6)

    # La primera pulsación solamente acuesta a Joel; todavía no debe haber zzz.
    joel.execute_script("houseBed.click()")
    result["joel_lying_synced"] = wait_for(princesa, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-bed')&&!document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')")
    result["bed_actions_visible"] = joel.execute_script("return !houseBedActions.hidden&&houseBedSleep.textContent.includes('Dormir')&&houseBedLeave.textContent.includes('Levantarse')")

    # Joel elige dormir y Princesa recibe el estado por Realtime.
    joel.execute_script("houseBedSleep.click()")
    result["joel_sleep_synced"] = wait_for(princesa, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')")

    # El sueño persiste al recargar la aplicación.
    joel.refresh()
    time.sleep(4)
    result["sleep_survives_reload"] = wait_for(joel, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')")

    # Los dos pueden dormir simultáneamente.
    princesa.execute_script("houseBed.click()")
    wait_for(princesa, "document.querySelector('[data-avatar-for=princesa]').classList.contains('is-in-bed')&&!document.querySelector('[data-avatar-for=princesa]').classList.contains('is-sleeping')")
    princesa.execute_script("houseBedSleep.click()")
    result["both_sleeping"] = wait_for(princesa, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')&&document.querySelector('[data-avatar-for=princesa]').classList.contains('is-sleeping')")
    time.sleep(.7)
    result["zzz_visible"] = princesa.execute_script(
        "const j=document.querySelector('[data-avatar-for=joel]'),p=document.querySelector('[data-avatar-for=princesa]');return getComputedStyle(j,'::after').content.includes('zzz')&&getComputedStyle(p,'::after').content.includes('zzz')"
    )
    result["sleeping_avatar_layout"] = princesa.execute_script(
        "const info=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {classes:e.className,left:r.left,top:r.top,width:r.width,height:r.height,cssLeft:getComputedStyle(e).left}};"
        "return {joel:info('[data-avatar-for=joel]'),princesa:info('[data-avatar-for=princesa]')}"
    )
    result["daytime_bed_message"] = princesa.execute_script(
        "const day=['morning','day'].includes(loveHouse.dataset.time); const message=document.querySelector('[data-condition=daytime_bed]'); return !day||Boolean(message&&message.textContent.includes('Primero cariñitos'))"
    )
    screenshot = os.path.join(os.environ.get("TEMP", "."), "loveapp-bedroom-sleep.png")
    princesa.save_screenshot(screenshot)
    result["screenshot"] = screenshot

    # Evita enviar una push real durante la prueba; el despertar sí usa Realtime y Supabase.
    princesa.execute_script("window.sendLovePush=async()=>true; document.querySelector('[data-avatar-for=joel]').click()")
    result["princesa_woke_joel"] = wait_for(joel, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-bed')&&!document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')")
    joel.execute_script("houseBedLeave.click()")
    princesa.execute_script("houseBedLeave.click()")
    result["activities_cleaned"] = wait_for(princesa, "!document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-bed')&&!document.querySelector('[data-avatar-for=princesa]').classList.contains('is-in-bed')")
    time.sleep(1)
    print(json.dumps(result, ensure_ascii=False, indent=2))
finally:
    if joel:
        joel.quit()
    if princesa:
        princesa.quit()

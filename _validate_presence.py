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


def tap_avatar(driver, person, pointer_id):
    driver.execute_async_script(
        "const person=arguments[0],pointerId=arguments[1],done=arguments[2],a=document.querySelector('[data-avatar-for='+person+']'),r=a.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;"
        "a.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId,pointerType:'touch',buttons:1,clientX:x,clientY:y}));"
        "a.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId,pointerType:'touch',buttons:0,clientX:x,clientY:y}));setTimeout(done,470)",
        person, pointer_id
    )


joel = princesa = joel_phone = None
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

    # Si la misma persona abre otro dispositivo, manda la sesión con la actividad
    # más reciente. Se prueba el cambio teléfono -> PC -> teléfono -> PC.
    desktop_session = joel.execute_script("return window.loveSessionId")
    joel_phone = browser()
    setup(joel_phone, "joel")
    phone_session = joel_phone.execute_script("return window.loveSessionId")
    result["phone_takes_priority_when_opened"] = wait_for(
        princesa, f"window.lovePresenceState.locations.joel?.session_id==='{phone_session}'"
    )
    joel.execute_script("window.markLoveActivity(true)")
    result["desktop_retakes_priority_on_activity"] = wait_for(
        princesa, f"window.lovePresenceState.locations.joel?.session_id==='{desktop_session}'"
    )
    joel_phone.execute_script("window.markLoveActivity(true)")
    result["phone_retakes_priority_on_activity"] = wait_for(
        princesa, f"window.lovePresenceState.locations.joel?.session_id==='{phone_session}'"
    )
    joel.execute_script("window.markLoveActivity(true)")
    result["desktop_ready_for_remaining_tests"] = wait_for(
        princesa, f"window.lovePresenceState.locations.joel?.session_id==='{desktop_session}'"
    )
    joel_phone.quit()
    joel_phone = None

    # Una pérdida real de red debe mostrar el estado y recuperar el canal/presencia.
    joel.execute_cdp_cmd("Network.enable", {})
    joel.execute_cdp_cmd("Network.emulateNetworkConditions", {
        "offline": True, "latency": 0, "downloadThroughput": 0, "uploadThroughput": 0,
    })
    result["offline_state_visible"] = wait_for(joel, "document.getElementById('status-text').textContent.includes('Sin conexión')")
    joel.execute_cdp_cmd("Network.emulateNetworkConditions", {
        "offline": False, "latency": 20, "downloadThroughput": 5_000_000, "uploadThroughput": 2_000_000,
    })
    result["reconnects_after_network_returns"] = wait_for(joel, "window.isLoveRealtimeConnected?.()", 15)
    result["presence_returns_after_network"] = wait_for(
        princesa, f"window.lovePresenceState.locations.joel?.session_id==='{desktop_session}'", 15
    )

    # La cama no debe invadir los objetos centrales antes de usarla.
    result["layout"] = princesa.execute_script(
        "const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height}};"
        "const hit=(a,b)=>a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t;"
        "const bed=rect('#houseBed'),table=rect('.house-table'),windowBox=rect('#houseWindow'),heater=rect('#houseHeater');"
        "return {viewport:[innerWidth,innerHeight],bed,overlaps:{table:hit(bed,table),window:hit(bed,windowBox),heater:hit(bed,heater)}}"
    )

    # Cada corrida parte fuera de la cama, incluso si una prueba anterior se interrumpió.
    for driver in (joel, princesa):
        if driver.execute_script("return document.querySelector('[data-avatar-for='+localStorage.getItem('love_identity')+']').classList.contains('is-in-bed')"):
            driver.execute_script("houseBedLeave.click()")
    result["clean_bed_start"] = wait_for(joel, "!document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-bed')") and wait_for(princesa, "!document.querySelector('[data-avatar-for=princesa]').classList.contains('is-in-bed')")
    time.sleep(1)

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

    # Un toque propio abre el movimiento breve de bailar, que también viaja por Realtime.
    tap_avatar(joel, "joel", 71)
    result["self_motion_menu"] = joel.execute_script("return !houseAvatarActions.hidden&&!houseSelfActions.hidden&&houseTogetherActions.hidden")
    self_menu_screenshot = os.path.join(os.environ.get("TEMP", "."), "loveapp-house-self-actions.png")
    joel.save_screenshot(self_menu_screenshot)
    result["self_menu_screenshot"] = self_menu_screenshot
    joel.execute_script("document.querySelector('[data-house-motion=dance]').click()")
    dance_id = joel.execute_script("return document.querySelector('[data-avatar-for=joel]').dataset.lastMotion||''")
    result["dance_synced"] = bool(dance_id) and wait_for(princesa, f"document.querySelector('[data-avatar-for=joel]').dataset.lastMotion==='{dance_id}'")
    # Tocar al otro estando cerca ofrece las cuatro acciones de 2C.
    result["partner_is_interactive_when_close"] = wait_for(joel, "document.querySelector('[data-avatar-for=princesa]').classList.contains('can-interact')")
    joel.execute_script("document.querySelector('[data-avatar-for=princesa]').click()")
    result["closeness_menu"] = joel.execute_script("return !houseAvatarActions.hidden&&houseSelfActions.hidden&&!houseTogetherActions.hidden&&document.querySelectorAll('[data-house-together]:not([hidden])').length===4&&housePupitoAction.hidden")
    joel.execute_script("document.querySelector('[data-house-together=kiss]').click()")
    kiss_id = joel.execute_script("return document.querySelector('[data-avatar-for=joel]').dataset.lastMotion||''")
    result["kiss_synced"] = bool(kiss_id) and wait_for(princesa, f"document.querySelector('[data-avatar-for=joel]').dataset.lastMotion==='{kiss_id}'")
    result["kiss_house_message"] = wait_for(princesa, "document.querySelector('[data-condition=house_motion]')?.textContent.includes('besito')")
    closeness_screenshot = os.path.join(os.environ.get("TEMP", "."), "loveapp-house-closeness.png")
    princesa.save_screenshot(closeness_screenshot)
    result["closeness_screenshot"] = closeness_screenshot
    for kind, word in (("hug", "Apriétense"), ("caress", "calladita"), ("tickle", "cosquillas")):
        joel.execute_script("document.querySelector('[data-avatar-for=princesa]').click();document.querySelector('[data-house-together='+arguments[0]+']').click()", kind)
        action_id = joel.execute_script("return document.querySelector('[data-avatar-for=joel]').dataset.lastMotion||''")
        result[f"{kind}_synced"] = bool(action_id) and wait_for(princesa, f"document.querySelector('[data-avatar-for=joel]').dataset.lastMotion==='{action_id}'")
        result[f"{kind}_house_message"] = wait_for(princesa, f"document.querySelector('[data-condition=house_motion]')?.textContent.includes('{word}')")

    # La acción del pupito pertenece solamente a Princesa cuando toca a Joel.
    princesa.execute_script("document.querySelector('[data-avatar-for=joel]').click()")
    result["pupito_only_for_princesa"] = princesa.execute_script("return !housePupitoAction.hidden&&document.querySelectorAll('[data-house-together]:not([hidden])').length===5")
    princesa.execute_script("housePupitoAction.click()")
    pupito_id = princesa.execute_script("return document.querySelector('[data-avatar-for=princesa]').dataset.lastMotion||''")
    result["pupito_synced"] = bool(pupito_id) and wait_for(joel, f"document.querySelector('[data-avatar-for=princesa]').dataset.lastMotion==='{pupito_id}'")
    result["pupito_house_message"] = wait_for(joel, "document.querySelector('[data-condition=house_motion]')?.textContent.includes('modo defensa')")
    pupito_screenshot = os.path.join(os.environ.get("TEMP", "."), "loveapp-house-pupito.png")
    joel.save_screenshot(pupito_screenshot)
    result["pupito_screenshot"] = pupito_screenshot

    # Devuelve la posición de Joel exactamente a donde estaba antes de la prueba.
    joel.execute_script(
        "const ox=arguments[0],oy=arguments[1],a=document.querySelector('[data-avatar-for=joel]'),s=document.querySelector('[data-room-surface=bedroom]'),r=s.getBoundingClientRect(),ar=a.getBoundingClientRect();"
        "const fire=(type,x,y,buttons)=>a.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:61,pointerType:'touch',buttons,clientX:x,clientY:y}));"
        "fire('pointerdown',ar.left+ar.width/2,ar.top+ar.height/2,1);fire('pointermove',r.left+ox*r.width/100,r.top+oy*r.height/100,1);fire('pointerup',r.left+ox*r.width/100,r.top+oy*r.height/100,0)",
        original_position["x"], original_position["y"]
    )
    time.sleep(1)

    # La primera pulsación solamente acuesta a Joel; todavía no debe haber zzz.
    joel.execute_script("houseBed.click()")
    result["joel_lying_synced"] = wait_for(princesa, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-bed')&&!document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')")
    result["bed_actions_visible"] = joel.execute_script("return !houseBedActions.hidden&&houseBedSleep.textContent.includes('Dormir')&&houseBedLeave.textContent.includes('Levantarse')")
    time.sleep(1)

    # Joel elige dormir y Princesa recibe el estado por Realtime.
    joel.execute_script("houseBedSleep.click()")
    result["joel_sleep_synced"] = wait_for(princesa, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')")
    time.sleep(1.2)

    # El sueño persiste al recargar la aplicación.
    joel.refresh()
    time.sleep(4)
    result["sleep_survives_reload"] = wait_for(joel, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')")

    # Los dos pueden dormir simultáneamente.
    princesa.execute_script("houseBed.click()")
    wait_for(princesa, "document.querySelector('[data-avatar-for=princesa]').classList.contains('is-in-bed')&&!document.querySelector('[data-avatar-for=princesa]').classList.contains('is-sleeping')")
    time.sleep(1)
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
    if joel_phone:
        joel_phone.quit()

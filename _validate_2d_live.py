from pathlib import Path
import json
import os
import sys
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
DRIVER = sorted((Path.home() / ".cache" / "selenium" / "chromedriver" / "win64").glob("*/chromedriver.exe"), reverse=True)[0]


def browser():
    options = Options()
    options.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=393,852")
    options.add_experimental_option("mobileEmulation", {
        "deviceMetrics": {"width": 393, "height": 852, "pixelRatio": 3},
        "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    })
    options.page_load_strategy = "eager"
    return webdriver.Chrome(service=Service(str(DRIVER)), options=options)


def wait_for(driver, expression, seconds=12):
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            if driver.execute_script(f"return Boolean({expression})"):
                return True
        except Exception:
            pass
        time.sleep(.25)
    return False


def open_house(driver):
    driver.execute_script(
        "const b=[...document.querySelectorAll('.bottom-nav button')].find(x=>x.getAttribute('onclick')?.includes(\"'together'\"));"
        "showTab(b,'together',{vibrate:false});"
    )
    return wait_for(driver, "!document.getElementById('houseBedroom').hidden")


def setup(driver, identity):
    driver.get(f"http://127.0.0.1:8765/index.html?live2d={identity}")
    driver.execute_script(
        "localStorage.setItem('love_identity',arguments[0]);"
        "localStorage.setItem('birthday_2026_celebrated','1');",
        identity,
    )
    driver.refresh()
    time.sleep(4)
    assert open_house(driver)


def db_call(driver, body, *args):
    return driver.execute_async_script(body, *args)


def clear_activities(driver):
    return db_call(
        driver,
        "const done=arguments[arguments.length-1];window._loveClient.from('house_activities').delete().in('identity',['joel','princesa']).then(({error})=>done(error?{ok:false,error:error.message}:{ok:true}));"
    )


def invitation_row(driver):
    return db_call(
        driver,
        "const done=arguments[arguments.length-1];window._loveClient.from('house_device_states').select('state,updated_at').eq('room_id','bedroom').eq('device_id','shared_invitation').maybeSingle().then(({data,error})=>done(error?{error:error.message}:data));"
    )


def set_invitation_status(driver, status, expired=False):
    return db_call(
        driver,
        "const status=arguments[0],expired=arguments[1],done=arguments[arguments.length-1];"
        "window._loveClient.from('house_device_states').select('state').eq('room_id','bedroom').eq('device_id','shared_invitation').single().then(async({data,error})=>{"
        "if(error)return done({ok:false,error:error.message});const now=new Date(),state={...data.state,status,responded_at:now.toISOString(),responded_by:localStorage.getItem('love_identity')};"
        "if(expired){state.status='pending';state.expires_at=new Date(now.getTime()-1000).toISOString()}"
        "const result=await window._loveClient.from('house_device_states').upsert({room_id:'bedroom',device_id:'shared_invitation',state,updated_by:localStorage.getItem('love_identity'),updated_at:now.toISOString()},{onConflict:'room_id,device_id'});"
        "done(result.error?{ok:false,error:result.error.message}:{ok:true,state});});",
        status,
        expired,
    )


def clean_bed(driver, joel, princesa):
    cleared = clear_activities(driver)
    for session in (joel, princesa):
        session.execute_script("window.dispatchEvent(new CustomEvent('loverealtimeconnected'))")
    return cleared.get("ok") and wait_for(joel, "!document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-bed')&&!document.querySelector('[data-avatar-for=princesa]').classList.contains('is-in-bed')") and wait_for(princesa, "!document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-bed')&&!document.querySelector('[data-avatar-for=princesa]').classList.contains('is-in-bed')")


def invite(driver, kind):
    return driver.execute_script(
        "const b=document.querySelector('[data-shared-invite='+arguments[0]+']');if(b.disabled)return false;b.click();return true;",
        kind,
    )


joel = princesa = None
results = {}
real_push_requested = os.environ.get("LOVE_TEST_REAL_PUSH") == "1"
try:
    joel = browser()
    princesa = browser()
    setup(joel, "joel")
    setup(princesa, "princesa")
    results["both_sessions_same_bedroom"] = wait_for(joel, "housePrincesa.classList.contains('is-online')") and wait_for(princesa, "houseJoel.classList.contains('is-online')")
    results["initial_cleanup"] = clean_bed(joel, joel, princesa)

    # 1. Invitación real, persistencia al recargar y aceptación para acostarse.
    if real_push_requested:
        joel.execute_script(
            "window.__realPush=window.sendLovePush;window.__pushResult=null;"
            "window.sendLovePush=async(...args)=>{try{const value=await window.__realPush(...args);window.__pushResult={ok:true,value};return value}catch(error){window.__pushResult={ok:false,error:String(error)};throw error}}"
        )
    else:
        joel.execute_script("window.__pushResult={ok:true,value:{delivered:true,test_stub:true}};window.sendLovePush=async()=>window.__pushResult.value")
    results["lie_invitation_sent"] = invite(joel, "lie_together")
    results["lie_invitation_arrives_live"] = wait_for(princesa, "!houseSharedInvitation.hidden&&houseSharedInvitationAccept.offsetParent!==null")
    results["real_push_completed"] = wait_for(joel, "window.__pushResult!==null", 20)
    results["real_push_result"] = joel.execute_script("return window.__pushResult")
    results["real_push_requested"] = real_push_requested
    princesa.refresh()
    time.sleep(4)
    results["normal_reload_starts_home"] = princesa.execute_script("return home.classList.contains('active')&&!together.classList.contains('active')")
    results["house_reopens_after_reload"] = open_house(princesa)
    results["invitation_survives_reload"] = wait_for(princesa, "!houseSharedInvitation.hidden&&houseSharedInvitationTitle.textContent.includes('Joel')")
    results["partner_presence_returns_after_reload"] = wait_for(princesa, "houseJoel.classList.contains('is-online')", 20)
    results["accept_enabled_after_presence_returns"] = wait_for(princesa, "!houseSharedInvitationAccept.disabled")
    princesa.execute_script("houseSharedInvitationAccept.click()")
    results["lie_accept_updates_both"] = wait_for(joel, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-bed')&&document.querySelector('[data-avatar-for=princesa]').classList.contains('is-in-bed')") and wait_for(princesa, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-bed')&&document.querySelector('[data-avatar-for=princesa]').classList.contains('is-in-bed')")
    results["lie_db_status"] = invitation_row(joel)
    results["cleanup_after_lie"] = clean_bed(joel, joel, princesa)

    # Las pruebas restantes no envían pushes reales.
    for session in (joel, princesa):
        session.execute_script("window.sendLovePush=async()=>({delivered:true,test_stub:true})")

    # 2. Dormir abrazados requiere que ambos ya estén acostados.
    joel.execute_script("houseBed.click()")
    princesa.execute_script("houseBed.click()")
    results["both_awake_in_bed"] = wait_for(joel, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-bed')&&document.querySelector('[data-avatar-for=princesa]').classList.contains('is-in-bed')")
    results["sleep_partner_presence_ready"] = wait_for(joel, "housePrincesa.classList.contains('is-online')", 20)
    results["bed_actions_visible_for_both"] = wait_for(joel, "!houseBedTogetherActions.hidden&&document.querySelectorAll('[data-bed-together]').length===3")
    results["bed_actions_fit_iphone"] = joel.execute_script(
        "const p=houseBedActions.getBoundingClientRect(),buttons=[...document.querySelectorAll('[data-bed-together]')];"
        "return p.left>=0&&p.right<=innerWidth&&p.width>0&&buttons.every(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.left>=p.left&&r.right<=p.right});"
    )
    for kind, emoji in (("cuddle", "🫂"), ("kiss", "💋"), ("caress", "🤍")):
        joel.execute_script("document.querySelector('[data-bed-together='+arguments[0]+']').click()", kind)
        results[f"bed_{kind}_syncs_live"] = wait_for(
            princesa,
            f"houseBed.classList.contains('is-bed-{kind}')&&houseBed.querySelector('.house-bed-action-effect')?.textContent.includes('{emoji}')",
        )
    results["sleep_invitation_enabled"] = wait_for(joel, "!document.querySelector('[data-shared-invite=sleep_cuddle]').disabled")
    results["sleep_invitation_sent"] = invite(joel, "sleep_cuddle")
    results["sleep_waits_for_acceptance"] = wait_for(princesa, "!houseSharedInvitation.hidden") and princesa.execute_script("return !document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')&&!document.querySelector('[data-avatar-for=princesa]').classList.contains('is-sleeping')")
    princesa.execute_script("houseSharedInvitationAccept.click()")
    results["cuddle_sleep_synced"] = wait_for(joel, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')&&document.querySelector('[data-avatar-for=princesa]').classList.contains('is-sleeping')") and wait_for(princesa, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-sleeping')&&document.querySelector('[data-avatar-for=princesa]').classList.contains('is-sleeping')")
    activities = db_call(joel, "const done=arguments[arguments.length-1];window._loveClient.from('house_activities').select('identity,activity,state').in('identity',['joel','princesa']).then(({data,error})=>done(error?{error:error.message}:data));")
    results["cuddle_saved_for_both"] = isinstance(activities, list) and len(activities) == 2 and all(row["activity"] == "sleeping" and row["state"].get("style") == "cuddle" for row in activities)
    results["cleanup_after_sleep"] = clean_bed(joel, joel, princesa)

    # 3. El momento privado no empieza antes de aceptar y se refleja en ambas sesiones.
    joel.execute_script("houseBed.click()")
    princesa.execute_script("houseBed.click()")
    wait_for(joel, "document.querySelector('[data-avatar-for=joel]').classList.contains('is-in-bed')&&document.querySelector('[data-avatar-for=princesa]').classList.contains('is-in-bed')")
    results["private_invitation_sent"] = invite(joel, "private_moment")
    results["private_does_not_start_early"] = wait_for(princesa, "!houseSharedInvitation.hidden") and princesa.execute_script("return !houseBedroom.classList.contains('is-private-activity')")
    princesa.execute_script("houseSharedInvitationAccept.click()")
    results["private_scene_synced"] = wait_for(joel, "houseBedroom.classList.contains('is-private-activity')") and wait_for(princesa, "houseBedroom.classList.contains('is-private-activity')")
    princesa.execute_script("houseBedIntimate.click()")
    results["private_scene_can_end"] = wait_for(joel, "!houseBedroom.classList.contains('is-private-activity')") and wait_for(princesa, "!houseBedroom.classList.contains('is-private-activity')")
    results["cleanup_after_private"] = clean_bed(joel, joel, princesa)

    # 4. Rechazar y cancelar se sincronizan sin cambiar actividades.
    results["reject_invitation_sent"] = invite(joel, "lie_together")
    wait_for(princesa, "!houseSharedInvitation.hidden")
    princesa.execute_script("houseSharedInvitationDecline.click()")
    results["rejection_synced"] = wait_for(joel, "houseSharedInvitation.hidden") and invitation_row(joel).get("state", {}).get("status") == "declined"

    results["cancel_invitation_sent"] = invite(princesa, "lie_together")
    wait_for(joel, "!houseSharedInvitation.hidden")
    results["cancel_visible_to_sender"] = wait_for(princesa, "!houseSharedInvitation.hidden&&houseSharedInvitationDecline.textContent.includes('Cancelar')")
    princesa.execute_script("houseSharedInvitationDecline.click()")
    results["cancellation_synced"] = wait_for(joel, "houseSharedInvitation.hidden") and invitation_row(joel).get("state", {}).get("status") == "cancelled"

    # 5. Caducidad comprobada sin esperar cinco minutos: se adelanta el reloj del registro.
    results["expiry_invitation_sent"] = invite(joel, "lie_together")
    wait_for(princesa, "!houseSharedInvitation.hidden")
    expiry_write = set_invitation_status(joel, "pending", expired=True)
    results["expiry_write"] = expiry_write
    results["expired_invitation_disappears"] = expiry_write.get("ok") and wait_for(joel, "houseSharedInvitation.hidden") and wait_for(princesa, "houseSharedInvitation.hidden")

    results["final_activity_cleanup"] = clean_bed(joel, joel, princesa)
    results["final_invitation_cleanup"] = set_invitation_status(joel, "cancelled").get("ok")
    print(json.dumps(results, ensure_ascii=False, indent=2))
    failed = [name for name, value in results.items() if isinstance(value, bool) and not value and name != "real_push_requested"]
    if failed:
        raise SystemExit("2D validation failed: " + ", ".join(failed))
finally:
    if joel:
        joel.quit()
    if princesa:
        princesa.quit()

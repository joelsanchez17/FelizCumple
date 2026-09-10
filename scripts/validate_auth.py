"""Comprobaciones locales que evitan regresar a una identidad controlada por el navegador."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
index = (ROOT / "index.html").read_text(encoding="utf-8")
realtime = (ROOT / "realtime.js").read_text(encoding="utf-8")
together = (ROOT / "together.js").read_text(encoding="utf-8")
edge = (ROOT / "supabase/functions/send-push/index.ts").read_text(encoding="utf-8")
realtime_migration = (ROOT / "supabase/migrations/20260829010000_house_realtime_auth.sql").read_text(encoding="utf-8")
invitation_migration = (ROOT / "supabase/migrations/20260829020000_house_invitation_rpcs.sql").read_text(encoding="utf-8")

checks = {
    "login_form": "signInWithPassword" in index and "current_house_identity" in index,
    "session_persists": "auth.getSession()" in index and "auth.signOut()" in index,
    "identity_selector_removed": "data-identity=" not in index,
    "identity_not_read_from_storage": "localStorage.getItem('love_identity')" not in index + realtime + together,
    "identity_not_written_to_storage": "localStorage.setItem('love_identity'" not in index + realtime + together,
    "runtime_config_required": "window.LOVE_RUNTIME_CONFIG" in realtime and "supabasePublishableKey" in realtime,
    "private_realtime_client": "private:true" in realtime,
    "private_realtime_rls": "realtime.topic() = 'room_amor'" in realtime_migration and "to authenticated" in realtime_migration,
    "edge_verifies_user": "authClient.auth.getUser()" in edge and ".eq('user_id', authData.user.id)" in edge,
    "edge_uses_membership": "const caller = member?.identity" in edge and "identity: caller" in edge,
    "shared_actions_are_server_authorized": "create_house_invitation" in invitation_migration and "respond_house_invitation" in invitation_migration,
    "shared_invitation_direct_writes_blocked": "device_id <> 'shared_invitation'" in invitation_migration,
}

failed = [name for name, passed in checks.items() if not passed]
if failed:
    raise SystemExit("AUTH_VALIDATION_FAILED: " + ", ".join(failed))
print(f"AUTH_VALIDATION_OK ({len(checks)} controles)")

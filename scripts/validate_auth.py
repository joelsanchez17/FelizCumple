"""Comprobaciones del acceso anónimo y silencioso de los dos dispositivos."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
index = (ROOT / "index.html").read_text(encoding="utf-8")
realtime = (ROOT / "realtime.js").read_text(encoding="utf-8")
together = (ROOT / "together.js").read_text(encoding="utf-8")
edge = (ROOT / "supabase/functions/send-push/index.ts").read_text(encoding="utf-8")
realtime_migration = (ROOT / "supabase/migrations/20260829010000_house_realtime_auth.sql").read_text(encoding="utf-8")
invitation_migration = (ROOT / "supabase/migrations/20260829020000_house_invitation_rpcs.sql").read_text(encoding="utf-8")
auth_migration = (ROOT / "supabase/migrations/20260829000000_house_auth.sql").read_text(encoding="utf-8")

checks = {
    "anonymous_session_without_password": "signInAnonymously" in index and "signInWithPassword" not in index,
    "session_persists": "auth.getSession()" in index and "auth.signOut()" in index,
    "first_device_identity_selector": "data-identity=" in index and "house_identity: identity" in index,
    "device_remembers_identity": "localStorage.getItem(KEY)" in index and "localStorage.setItem(KEY, identity)" in index,
    "server_resolves_anonymous_identity": "auth.jwt() -> 'user_metadata' ->> 'house_identity'" in auth_migration,
    "runtime_config_required": "window.LOVE_RUNTIME_CONFIG" in realtime and "supabasePublishableKey" in realtime,
    "private_realtime_client": "private:true" in realtime,
    "private_realtime_rls": "realtime.topic() = 'room_amor'" in realtime_migration and "to authenticated" in realtime_migration,
    "edge_verifies_user": "authClient.auth.getUser()" in edge and ".eq('user_id', authData.user.id)" in edge,
    "edge_uses_membership_or_anonymous_metadata": "member?.identity || metadataIdentity" in edge and "identity: caller" in edge,
    "shared_actions_are_server_authorized": "create_house_invitation" in invitation_migration and "respond_house_invitation" in invitation_migration,
    "shared_invitation_direct_writes_blocked": "device_id <> 'shared_invitation'" in invitation_migration,
}

failed = [name for name, passed in checks.items() if not passed]
if failed:
    raise SystemExit("AUTH_VALIDATION_FAILED: " + ", ".join(failed))
print(f"AUTH_VALIDATION_OK ({len(checks)} controles)")

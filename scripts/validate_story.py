"""Controles estáticos del motor privado antes de su lanzamiento atómico."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
migration = (ROOT / "supabase/migrations/20260829030000_house_story_progress.sql").read_text(encoding="utf-8")
engine = (ROOT / "house-story.js").read_text(encoding="utf-8")
chapter_one = (ROOT / "house-story-chapter-one.js").read_text(encoding="utf-8")
chapter_two = (ROOT / "house-story-chapter-two.js").read_text(encoding="utf-8")
chapter_three = (ROOT / "house-story-chapter-three.js").read_text(encoding="utf-8")
chapter_four = (ROOT / "house-story-chapter-four.js").read_text(encoding="utf-8")
corner_migration = (ROOT / "supabase/migrations/20260830000000_house_story_corner.sql").read_text(encoding="utf-8")
placement_migration = (ROOT / "supabase/migrations/20260830010000_house_story_corner_placements.sql").read_text(encoding="utf-8")
door_migration = (ROOT / "supabase/migrations/20260830020000_house_story_door.sql").read_text(encoding="utf-8")
companion_migration = (ROOT / "supabase/migrations/20260830030000_house_story_companion.sql").read_text(encoding="utf-8")
companion_home_migration = (ROOT / "supabase/migrations/20260830040000_house_story_companion_home.sql").read_text(encoding="utf-8")
companion_care_migration = (ROOT / "supabase/migrations/20260831000000_house_story_companion_care.sql").read_text(encoding="utf-8")
companion_client = (ROOT / "house-story-companion.js").read_text(encoding="utf-8")
story_css = (ROOT / "house-story.css").read_text(encoding="utf-8")
together = (ROOT / "together.js").read_text(encoding="utf-8")
index = (ROOT / "index.html").read_text(encoding="utf-8")
service_worker = (ROOT / "sw.js").read_text(encoding="utf-8")
story_assets = tuple(ROOT / "assets/story" / name for name in ("corner-blanket.png", "corner-cushion.png", "corner-lamp.png", "final-box-closed.png", "final-box-open.png", "companion-tiny-walk.png", "companion-tiny-sit.png", "companion-tiny-sleep.png", "companion-tiny-bed.png"))

checks = {
    "server_flag_defaults_off": "enabled boolean not null default false" in migration,
    "tables_have_rls": migration.count("enable row level security") == 3,
    "direct_table_access_revoked": migration.count("from anon, authenticated") >= 3,
    "identity_is_server_derived": migration.count("public.current_house_identity()") >= 3,
    "event_keys_are_unique": "primary key (identity, event_key)" in migration,
    "progress_is_versioned": "schema_version" in migration and "story_version" in migration,
    "private_reset_is_restricted": "public.current_house_identity() <> 'joel'" in migration,
    "offline_queue_is_durable": "indexedDB.open" in engine and "pending-events" in engine,
    "client_uses_only_rpcs": ".rpc('get_house_story_progress')" in engine and "operation.rpc || 'advance_house_story'" in engine,
    "chapter_uses_real_room_objects": all(selector in index and selector in chapter_one for selector in ("houseBed", "kitchenCoffee", "bathroomShower")),
    "chapter_has_keyboard_routes": "data-story-room" in chapter_one and ".focus()" in chapter_one,
    "chapter_has_two_hints": "45_000" in chapter_one and "90_000" in chapter_one,
    "chapter_two_uses_confirmed_device_events": "lovehousedevicepersisted" in chapter_two and "lovehousedevicepersisted" in together,
    "chapter_two_recovers_existing_state": "reconcileExistingState" in chapter_two and "house_device_states" in chapter_two,
    "chapter_two_uses_real_objects": all(selector in index and selector in chapter_two for selector in ("data-room-plant", "diningTable", "data-lamp-for")),
    "chapter_three_persists_corner": "house_story_corner" in corner_migration and "on delete cascade" in corner_migration,
    "chapter_three_has_server_rpcs": "choose_house_story_corner" in corner_migration and all(name in placement_migration and name in engine for name in ("place_house_story_item_at", "finish_house_story_corner")),
    "chapter_three_is_guided_and_visual": all(token in chapter_three for token in ("data-story-place-item", "CURATED_SLOTS", "house-story-step-progress", "house-story-corner-scene", "No era una prueba")) and "data-story-slot" not in chapter_three and "data-story-move-item" not in chapter_three,
    "chapter_three_persists_positions": "placements jsonb" in placement_migration and "p_slot" in placement_migration,
    "chapter_three_generated_assets_exist": all(path.is_file() and path.stat().st_size > 50_000 for path in story_assets),
    "chapter_four_persists_opening": "house_story_door" in door_migration and "open_house_story_door" in door_migration and "open_house_story_door" in engine,
    "chapter_four_has_key_and_box_states": all(token in chapter_four for token in ("house-story-key", "final-box-closed.png", "final-box-open.png", "Abrir despacito")),
    "chapter_four_persists_tiny_companion": "house_story_companion" in companion_migration and "growth_started_at" in companion_migration and "reveal_house_story_companion" in engine,
    "chapter_four_has_coherent_puppy_states": all(token in chapter_four for token in ("companion-tiny-walk.png", "companion-tiny-sit.png", "todavía muy chiquito", "Va a crecer muy despacito")),
    "companion_home_is_shared_and_persistent": all(token in companion_home_migration for token in ("current_room", "is_sleeping", "update_house_story_companion", "house_story_companion_events")),
    "companion_home_uses_room_navigation": "lovehouseroomchange" in together and "lovehouseroomchange" in companion_client and all(token in companion_client for token in ("Vení conmigo", "A mimir", "companion-tiny-sleep.png")),
    "companion_has_sleep_bed_and_care": all(token in companion_client + story_css for token in ("companion-tiny-bed.png", "if (companion.isSleeping)", "Caricias", "A upa", "houseStoryCompanionHold", "companion_motion")) and "Jugar con él" not in companion_client,
    "companion_has_room_positions_and_context": all(token in companion_client + story_css for token in ("data-companion-room", "both-online", "vino corriendo", "data-companion-room=\"bedroom\"", "data-companion-room=\"kitchen\"", "data-companion-room=\"bathroom\"", "data-companion-room=\"dining\"")),
    "companion_lives_with_her_and_the_house": all(token in companion_client + story_css for token in ("Vení conmigo", "Seguime", "Quedate acá", "A la mantita", "Agüita", "Patitas limpias", "Al sillón", "houseStoryCompanionDrink", "houseStoryCompanionCome")),
    "companion_stays_beside_person_and_is_small": all(token in companion_client + story_css for token in ("BESIDE_KEY", "is-beside-person", "placeBesideIdentity", "width:52px", "mix-blend-mode:normal")),
    "companion_actions_stay_with_real_objects": all(token in companion_client + story_css for token in ("placeAtRoomObject", "#diningSofa", "is-room-object-position", ".house-story-room-puppy .house-story-companion-prop")),
    "companion_care_is_shared_and_recoverable": all(token in companion_care_migration + companion_client for token in ("last_watered_at", "last_petted_at", "last_played_at", "'care'", "data-companion-care", "careState")),
    "companion_controls_live_beside_it": all(token in companion_client + story_css for token in ("positionPanelNearPuppy", "house-story-companion-needs", ".house-story-companion-panel.is-here{position:absolute", "Pelotita")),
    "completed_story_can_replay_box_arrival": "Volver a ver su llegada" in chapter_four and "renderBox(false)" in chapter_four,
    "completed_story_goes_directly_to_companion": all(token in chapter_four for token in ("Ir a verlo en", "data-story-visit-companion", "data-enter-room", "visitCompanion")),
    "release_links_every_story_module": all(index.count(asset) == 1 for asset in ("house-story.js", "house-story-chapter-one.js", "house-story-chapter-two.js", "house-story-chapter-three.js", "house-story-chapter-four.js", "house-story-companion.js", "house-story.css")),
    "release_caches_every_story_asset": all(asset in service_worker for asset in ("house-story.js", "house-story-chapter-one.js", "house-story-chapter-two.js", "house-story-chapter-three.js", "house-story-chapter-four.js", "house-story-companion.js", "house-story.css", "corner-blanket.png", "corner-cushion.png", "corner-lamp.png", "final-box-closed.png", "final-box-open.png", "companion-tiny-walk.png", "companion-tiny-sit.png", "companion-tiny-sleep.png", "companion-tiny-bed.png")),
}

failed = [name for name, passed in checks.items() if not passed]
if failed:
    raise SystemExit("STORY_VALIDATION_FAILED: " + ", ".join(failed))
print(f"STORY_VALIDATION_OK ({len(checks)} controles)")

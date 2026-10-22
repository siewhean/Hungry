import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260527113000_user_stall_submissions.sql"),
  "utf8",
);
const galleryMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260527183000_user_stall_submission_gallery_images.sql",
  ),
  "utf8",
);
const service = readFileSync(
  resolve(process.cwd(), "src/lib/services/supabase/supabaseService.ts"),
  "utf8",
);

test("user stall submissions migration adds a private reviewed submission queue", () => {
  assert.match(migration, /user-stall-submission-images/);
  assert.match(migration, /public\s*,\s*file_size_limit/i);
  assert.match(migration, /create table if not exists public\.user_stall_submissions/i);
  assert.match(migration, /stall_name text not null check \(length\(trim\(stall_name\)\) > 0\)/i);
  assert.match(migration, /image_url text not null check \(length\(trim\(image_url\)\) > 0\)/i);
  assert.match(migration, /menu_items jsonb not null default '\[\]'::jsonb/i);
  assert.match(migration, /delivery_links jsonb not null default '\[\]'::jsonb/i);
  assert.match(
    migration,
    /status in \('pending', 'under_review', 'accepted', 'rejected', 'duplicate'\)/i,
  );
  assert.match(migration, /alter table public\.user_stall_submissions enable row level security/i);
  assert.match(migration, /user_stall_submissions_select_own/i);
  assert.match(migration, /auth\.uid\(\) = user_id/i);
  assert.match(
    migration,
    /revoke all on table public\.user_stall_submissions from anon, authenticated/i,
  );
  assert.match(migration, /grant select on table public\.user_stall_submissions to authenticated/i);
  assert.match(migration, /user_stall_submission_images_insert_own_prefix/i);
  assert.match(migration, /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i);
});

test("user stall submissions migration exposes only the checked RPC write path", () => {
  assert.match(migration, /create or replace function public\.submit_user_stall_submission/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = public/i);
  assert.match(migration, /Authentication required to submit a stall/i);
  assert.match(migration, /Stall name is required/i);
  assert.match(migration, /Stall image is required/i);
  assert.match(migration, /jsonb_typeof\(v_menu_items\) <> 'array'/i);
  assert.match(migration, /jsonb_typeof\(v_delivery_links\) <> 'array'/i);
  assert.match(migration, /grant execute on function public\.submit_user_stall_submission/i);
});

test("user stall submissions migration extends Food Cred, missions, and passport progress", () => {
  assert.match(migration, /stall_submitted/);
  assert.match(migration, /when 'stall_submitted' then 12/i);
  assert.match(migration, /when 'stall_submitted' then 5/i);
  assert.match(migration, /weekly_missions_mission_type_check/i);
  assert.match(migration, /'add_stall'/);
  assert.match(migration, /mission-add-new-stall/);
  assert.match(migration, /passport_progress_events_event_type_check/i);
  assert.match(migration, /stalls_submitted_count integer not null default 0/i);
  assert.match(migration, /if p_event_type = 'stall_submitted'/i);
  assert.match(migration, /stalls_submitted_count = stalls_submitted_count \+ 1/i);
});

test("Supabase service uploads stall images and maps user submissions", () => {
  assert.match(service, /bucket: "user-stall-submission-images"/);
  assert.match(service, /uploadImageFromUri/);
  assert.match(service, /rpc\("submit_user_stall_submission"/);
  assert.match(service, /function mapUserStallSubmission/);
  assert.match(service, /createSignedStorageUrl\(client, bucket, path\)/);
  assert.match(service, /listMyDiscoveredStalls/);
  assert.match(service, /\.from\("user_stall_submissions"\)/);
});

test("user stall submissions support ordered photo galleries", () => {
  assert.match(galleryMigration, /add column if not exists gallery_images jsonb/i);
  assert.match(galleryMigration, /p_gallery_images jsonb default '\[\]'::jsonb/i);
  assert.match(galleryMigration, /Gallery images must be an array/i);
  assert.match(galleryMigration, /gallery_images,/i);
  assert.match(service, /imageUris = Array\.from\(\s*new Set/);
  assert.match(service, /p_gallery_images: galleryImages/);
  assert.match(service, /galleryImageUrls: mapSubmissionGalleryUrls\(/);
});

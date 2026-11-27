# Jurong West Field Kit — Per-Stall Checklist (Package 1.2)

One-page field checklist for capturing real menus, counter prices, opening hours, halal certificates, and signature dish photos across the three Jurong West launch-zone places:

1. **Jurong West Hawker Centre**
2. **Pioneer Mall**
3. **Kimly Coffeeshop (Blk 651)**

---

## 1. Before Leaving Home

- Charge iPhone to 100% + carry power bank and microfiber lens wipe.
- Create one local folder per stall named after its `venues.id`:
  `~/hungry-field-kit/<venue-id>/`
- Never invent or round prices, dish names, hours, or halal status. Only record what is physically posted at the counter.

## 2. Five-Shot Capture Order at Every Stall (~90 seconds/stall)

Save files inside `~/hungry-field-kit/<venue-id>/` using these exact prefixes:

| Prefix                                       | What to capture                                | Framing & hygiene rule                                                                                                                                   |
| -------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `front.jpg`                                  | Stall signboard + unit number (`#01-XX`)       | Straight-on, include unit plate so unit mismatches are caught immediately.                                                                               |
| `menu-01.jpg`, `menu-02.jpg`                 | Full menu board(s) & counter price tags        | Fill frame, avoid glare, ensure every S$ digit is crisp. Counter price always wins over delivery stickers.                                               |
| `hours.jpg` + optional `hours.txt`           | Operating hours / closed-day sign              | If unambiguous across all 7 days, jot one line in `hours.txt` (e.g. `Mon-Sun 07:00-20:30` or `Tue-Sun 08:00-15:00, Mon Closed`). Leave blank if unclear. |
| `halal-cert.jpg`                             | Valid MUIS Halal certificate (if displayed)    | Only photograph an actual displayed MUIS certificate. `"No pork no lard"` is **not** Halal certified (`unknown` / `no`).                                 |
| `dish-01-<slug>.jpg` .. `dish-03-<slug>.jpg` | 1–3 signature dishes ordered/plated at counter | Natural lighting, single dish per frame, zero uninvited props.                                                                                           |

## 3. Back at Desk — Batch Resize, Upload & OCR

1. **Dry run first** (validates folder classification, parses `hours.txt`, and generates `<=1600px` main JPEGs + `480px` thumbnails in a temp workdir without touching network/DB):
   ```bash
   node --import tsx scripts/field-kit/ingest-stall-folder.mjs ~/hungry-field-kit/<venue-id>
   ```
2. **Apply to staging** (requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `HUNGRY_OPERATOR_ACCESS_TOKEN` for an `app_ops_admins` user with `ai_search_consent = true`):
   ```bash
   node --import tsx scripts/field-kit/ingest-stall-folder.mjs ~/hungry-field-kit/<venue-id> --apply
   ```
3. **Review & publish in Console**:
   Open `/console/stall-submissions?q=<venue-id>` -> verify extracted dish name, counter price, price source (`Counter price`), and Halal status against the inline menu-board photo -> click **Accept & publish to stall** (`dishes_draft` -> `public.dishes` + live `catalog_raw_refresh_venue`).
4. **Promote verified zone to Production** (once staging zone passes `launch-zone-report.sh`):
   ```bash
   scripts/db/reclaim-free-tier-budget.sh prod --apply
   scripts/db/promote-launch-zone.sh --apply
   ```

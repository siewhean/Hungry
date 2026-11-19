-- Migration: Clean polluted building names, duplicate addresses, and re-point venues to canonical clean buildings
-- Date: 2026-11-19

BEGIN;

-- 1. Create mapping from polluted buildings to clean canonical buildings
CREATE TEMP TABLE bld_remap AS
WITH clean_candidates AS (
  SELECT postal_code, id AS clean_id, name AS clean_name, building_type AS clean_type,
         ROW_NUMBER() OVER (
           PARTITION BY postal_code 
           ORDER BY 
             CASE WHEN building_type IN ('mall', 'food_court', 'hawker_centre') THEN 0 ELSE 1 END,
             venue_count DESC, 
             LENGTH(name) ASC,
             id
         ) as rn
  FROM buildings
  WHERE name !~ '(?i)(Singapore\s+[0-9]{6}|#[0-9]{2}-[0-9]+|#B[0-9]+|\bB[0-9]+-[0-9]+)'
    AND postal_code IS NOT NULL AND postal_code != ''
    AND LENGTH(postal_code) = 6
)
SELECT b.id AS bad_id, b.name AS bad_name, c.clean_id, c.clean_name, c.clean_type
FROM buildings b
JOIN clean_candidates c ON b.postal_code = c.postal_code AND c.rn = 1
WHERE b.name ~ '(?i)(Singapore\s+[0-9]{6}|#[0-9]{2}-[0-9]+|#B[0-9]+|\bB[0-9]+-[0-9]+)'
  AND b.id != c.clean_id;

CREATE INDEX IF NOT EXISTS idx_bld_remap_bad ON bld_remap(bad_id);

-- 2. Update venues pointing to bad buildings
UPDATE venues v
SET building_id = m.clean_id
FROM bld_remap m
WHERE v.building_id = m.bad_id;

-- 3. Update dishes pointing to bad buildings
UPDATE dishes d
SET building_id = m.clean_id
FROM bld_remap m
WHERE d.building_id = m.bad_id;

-- 4. Clean remaining polluted building names in buildings table
UPDATE buildings
SET name = trim(both ' ,' from regexp_replace(
  regexp_replace(
    regexp_replace(name, '(?i)\bSingapore\s+[0-9]{6}\b', '', 'g'),
    '(?i)\s*#[b0-9]+-[0-9a-z\/-]+.*$', '', 'g'),
    '(?i)\s*\((?:1st|2nd|3rd|[0-9]+th)?\s*(?:storey|level|unit|sub-?unit|part|portion|mr\d*|mc\d*)[^)]*\)', '', 'g')
)
WHERE name ~ '(?i)(Singapore\s+[0-9]{6}|#[0-9]{2}-[0-9]+|#B[0-9]+|\bB[0-9]+-[0-9]+)'
  AND trim(both ' ,' from regexp_replace(
    regexp_replace(
      regexp_replace(name, '(?i)\bSingapore\s+[0-9]{6}\b', '', 'g'),
      '(?i)\s*#[b0-9]+-[0-9a-z\/-]+.*$', '', 'g'),
      '(?i)\s*\((?:1st|2nd|3rd|[0-9]+th)?\s*(?:storey|level|unit|sub-?unit|part|portion|mr\d*|mc\d*)[^)]*\)', '', 'g')
  ) != '';

-- 5. Update catalog_raw_venue_cards for remapped buildings
UPDATE catalog_raw_venue_cards vc
SET building_id = m.clean_id,
    building_name = m.clean_name,
    building_type = m.clean_type
FROM bld_remap m
WHERE vc.building_id = m.bad_id;

-- 6. Clean addresses in venues: repeated postal codes
UPDATE venues
SET address = regexp_replace(address, ',\s*Singapore\s+([0-9]{6}),\s*Singapore\s+\1', ', Singapore \1', 'g')
WHERE address ~ '(?i)Singapore\s+([0-9]{6}),\s*Singapore\s+\1';

-- 7. Clean addresses in venues: repeated street and unit prefix
UPDATE venues
SET address = regexp_replace(address, '^([^,]+),\s*(#[0-9a-zA-Z\/-]+)\s+\1\s*(.*)$', '\1, \2 \3')
WHERE address ~ '^([^,]+),\s*(#[0-9a-zA-Z\/-]+)\s+\1';

-- 8. Specific known venue address cleanup
UPDATE venues
SET address = '1 Maritime Square, #01-75/76 Harbourfront Centre, Singapore 099253'
WHERE id = 'ven-C03001E000';

UPDATE venues
SET address = '1 Maritime Square, #02-27 Harbourfront Centre, Singapore 099253'
WHERE id = 'ven-SW12F28X000';

UPDATE venues
SET address = '1 Maritime Square, #03-59 Harbourfront Centre, Singapore 099253'
WHERE id = 'ven-SW08730X000';

-- 9. Synchronize cleaned address to catalog_raw_venue_cards for active release
UPDATE catalog_raw_venue_cards vc
SET address = v.address
FROM venues v
WHERE vc.release_id = '5760945f-1911-4126-a4dc-59f65c127248'
  AND vc.id = v.id
  AND vc.address != v.address;

COMMIT;

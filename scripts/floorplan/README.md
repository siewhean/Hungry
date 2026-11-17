# Floorplan Extraction Pipeline (Phase 1)

This folder contains the semi-automated CV pipeline for converting floorplan assets into polygon geometry.

## Dependencies

Install in your Python environment:

```bash
pip install opencv-python numpy
```

For PDF input support:

```bash
pip install pymupdf
```

## Pipeline Commands

```bash
python3 scripts/floorplan/prepare_floorplan.py \
  --input assets/floorplans/maxwell-l1.pdf \
  --building-id hc-maxwell \
  --floor L1 \
  --out-dir data/floorplans/hc-maxwell

python3 scripts/floorplan/extract_polygons.py \
  --rectified data/floorplans/hc-maxwell/L1.rectified.png \
  --meta data/floorplans/hc-maxwell/L1.meta.json \
  --out data/floorplans/hc-maxwell/L1.raw.json

python3 scripts/floorplan/score_validate_polygons.py \
  --in data/floorplans/hc-maxwell/L1.raw.json \
  --out data/floorplans/hc-maxwell/L1.validated.json \
  --report data/floorplans/hc-maxwell/L1.validation-report.json

python3 scripts/floorplan/export_floorplan.py \
  --in data/floorplans/hc-maxwell/L1.validated.json \
  --out-geojson data/floorplans/hc-maxwell/L1.geojson \
  --out-hungry data/floorplans/hc-maxwell/L1.hungry.json

python3 scripts/floorplan/render_qa_overlay.py \
  --in data/floorplans/hc-maxwell/L1.validated.json \
  --image data/floorplans/hc-maxwell/L1.rectified.png \
  --out output/qa/floorplans/hc-maxwell-L1-overlay.png
```

## Unit Mapping

Map unit numbers to venue IDs:

```bash
python3 scripts/floorplan/map_stalls.py \
  --in data/floorplans/hc-maxwell/L1.hungry.json \
  --mapping-csv data/floorplans/hc-maxwell/L1.unit-map.csv \
  --out data/floorplans/hc-maxwell/L1.mapped.hungry.json \
  --report data/floorplans/hc-maxwell/L1.mapping-report.json
```

CSV headers:

```text
unit_number,venue_id
#01-10,venue-tian-tian
#01-12,venue-pasta-express
```

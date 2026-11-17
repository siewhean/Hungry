"""
Fetch hawker centres from data.gov.sg (NEA GeoJSON dataset).
Uses the api-open.data.gov.sg v1 endpoint — no API key required.

Output:
  data/hawker_centres.json     — flattened list, DB-ready
  data/hawker_centres.geojson  — raw GeoJSON from NEA
"""
from __future__ import annotations
import json, logging
from pathlib import Path
import requests
from tenacity import retry, stop_after_attempt, wait_exponential

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("datagov")

DATASET = "d_4a086da0a5553be1d89383cd90d07ecd"
INITIATE_URL = f"https://api-open.data.gov.sg/v1/public/api/datasets/{DATASET}/initiate-download"
OUT_JSON = Path("data/hawker_centres.json")
OUT_GEOJSON = Path("data/hawker_centres.geojson")


@retry(stop=stop_after_attempt(5), wait=wait_exponential(min=1, max=30))
def fetch_geojson() -> dict:
    # Step 1: initiate — returns a pre-signed S3 URL
    r = requests.get(INITIATE_URL, timeout=30)
    r.raise_for_status()
    download_url = r.json()["data"]["url"]

    # Step 2: download the GeoJSON directly from S3
    gr = requests.get(download_url, timeout=60)
    gr.raise_for_status()
    return gr.json()


def main() -> None:
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)

    log.info("initiating download from data.gov.sg …")
    geojson = fetch_geojson()
    features = geojson.get("features", [])
    log.info("received %d features", len(features))

    # Save raw GeoJSON
    OUT_GEOJSON.write_text(json.dumps(geojson, indent=2, ensure_ascii=False))

    # Flatten to DB-friendly list
    flat = []
    for f in features:
        props = f["properties"]
        coords = f["geometry"]["coordinates"] if f.get("geometry") else [None, None]
        flat.append({
            "external_id": str(props.get("OBJECTID")),
            "name": props.get("NAME"),
            "venue_type": "hawker_centre",
            "address": props.get("ADDRESS_MYENV"),
            "postal_code": str(props.get("ADDRESSPOSTALCODE")) if props.get("ADDRESSPOSTALCODE") else None,
            "longitude": coords[0],
            "latitude": coords[1],
            "status": props.get("STATUS"),
            "num_cooked_food_stalls": props.get("NUMBER_OF_COOKED_FOOD_STALLS"),
            "source": "datagov",
            "raw": props,
        })

    OUT_JSON.write_text(json.dumps(flat, indent=2, ensure_ascii=False))
    log.info("wrote %d records -> %s", len(flat), OUT_JSON)
    log.info("wrote raw GeoJSON -> %s", OUT_GEOJSON)


if __name__ == "__main__":
    main()

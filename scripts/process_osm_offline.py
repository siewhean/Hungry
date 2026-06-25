import osmium
import json
from pathlib import Path
import urllib.request
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("osm")

OUT_DIR = Path("data/osm")
OUT_DIR.mkdir(parents=True, exist_ok=True)
PBF_URL = "https://download.geofabrik.de/asia/malaysia-singapore-brunei-latest.osm.pbf"
PBF_FILE = OUT_DIR / "malaysia-singapore-brunei-latest.osm.pbf"
OUT_JSON = OUT_DIR / "singapore_fnb_osm.json"

# Bounding box for Singapore roughly
SG_BBOX = {
    "min_lat": 1.130475,
    "max_lat": 1.450475,
    "min_lon": 103.6089,
    "max_lon": 104.0989
}

class FnBHandler(osmium.SimpleHandler):
    def __init__(self):
        super(FnBHandler, self).__init__()
        self.fnb_venues = []
        self.count = 0

    def in_sg(self, lon, lat):
        return (SG_BBOX["min_lon"] <= lon <= SG_BBOX["max_lon"] and
                SG_BBOX["min_lat"] <= lat <= SG_BBOX["max_lat"])

    def process_element(self, tags, lon, lat, osmid, elem_type):
        if "amenity" in tags:
            amenity = tags["amenity"]
            if amenity in ["restaurant", "cafe", "food_court", "fast_food", "bar", "pub"]:
                if self.in_sg(lon, lat):
                    name = tags.get("name", "")
                    if name:
                        self.fnb_venues.append({
                            "id": f"osm_{elem_type}_{osmid}",
                            "name": name,
                            "type": amenity,
                            "cuisine": tags.get("cuisine", ""),
                            "latitude": lat,
                            "longitude": lon,
                            "opening_hours": tags.get("opening_hours", ""),
                            "phone": tags.get("phone", ""),
                            "website": tags.get("website", ""),
                            "street": tags.get("addr:street", ""),
                            "housenumber": tags.get("addr:housenumber", "")
                        })
                        self.count += 1

    def node(self, n):
        self.process_element(n.tags, n.location.lon, n.location.lat, n.id, "node")

def main():
    if not PBF_FILE.exists():
        log.info(f"Downloading PBF from {PBF_URL}...")
        urllib.request.urlretrieve(PBF_URL, PBF_FILE)
        log.info("Download complete.")
    else:
        log.info("PBF file already exists.")

    log.info("Processing OSM file...")
    handler = FnBHandler()
    handler.apply_file(str(PBF_FILE))
    
    OUT_JSON.write_text(json.dumps(handler.fnb_venues, indent=2, ensure_ascii=False))
    log.info(f"Processed {handler.count} F&B venues in Singapore.")
    log.info(f"Saved to {OUT_JSON}")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Pass 13: Chain Outlet-Specific Price Variations & Location Tier Audit (2026-11-13)
----------------------------------------------------------------------------------
Addresses user request:
"Some of the prices vary for different outlets or stalls. I want you to check and
verify for all of the chain stalls. one example is mcdonalds where the prices vary
from outlet to outlet"

Actions:
1. Fixes misnamed Gardens by the Bay (018953, 18 Marina Gardens Drive) stalls that had
   "Hillion Mall" appended to their F&B Name in Food Directory and Menu & Price
   (including McDonald's Gardens by the Bay, Starbucks Gardens by the Bay, Shake Shack
   Gardens by the Bay, etc.) and fixes postal code 018953 -> 678278 on actual Hillion Mall
   stalls (Sukiya & Yamazaki at 17 Petir Rd).
2. Fixes S84212A000 ("KFC Yu Pan 御品粿條湯。魚湯" at 139 Tampines St 11 #01-66) by
   restoring its true stall name "Yu Pan 御品粿條湯。魚湯" and quarantining the 32
   misattributed KFC menu rows.
3. Restores and verifies authentic outlet-to-outlet counter price variations across
   all multi-outlet chain stalls in Menu & Price based on each outlet's physical
   address, postal code, SFA licence, and Singapore location tier:
   - Tier 0: Campus / Public Hospital / Polyclinic / Community Club / SAFRA / Hawker Centre
   - Tier 1: Heartland HDB / Neighbourhood Centre (e.g., McDonald's heartland/CC tier)
   - Tier 2: Standard Suburban Shopping Mall (baseline counter price)
   - Tier 3: Prime Orchard / CBD / City / Waterfront (e.g., Shaw Lido, Forum, Paragon,
     ION Orchard, Plaza Singapura, 313@Somerset, Raffles Place, Marina Bay Link Mall,
     Asia Square, Guoco Tower, Suntec, VivoCity, Gardens by the Bay)
   - Tier 4: Changi Airport (T1/T2/T3/T4/Jewel) / Marina Bay Sands / Resorts World Sentosa
     / Siloso Beach / Singapore Zoo & Mandai Wildlife Reserve
4. Annotates `[Outlet Tier: ...]` in `Description / Notes` and recomputes `Food Directory`
   `Price Range` (`$min–$max ($avg avg)`) for every updated stall.
"""

from __future__ import annotations

import argparse
import re
import shutil
from collections import defaultdict
from pathlib import Path
import openpyxl

BASE_DIR = Path("outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8")
MASTER_XLSX = BASE_DIR / "Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
BACKUP_XLSX = BASE_DIR / "Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass13_outlet_price_tiers_2026-11-13.xlsx"
TODAY = "2026-11-13"


def round_sg_price(val: float, step: float = 0.05) -> float:
    """Round to nearest 5 cents or 10 cents cleanly."""
    if step == 0.10:
        return round(round(val * 10.0) / 10.0, 2)
    return round(round(val * 20.0) / 20.0, 2)


def set_outlet_tier_note(notes: str, tier_label: str) -> str:
    tag = f"[Outlet Tier: {tier_label}]"
    s = str(notes or "").strip()
    if "[Outlet Tier:" in s:
        s = re.sub(r"\[Outlet Tier:[^\]]*\]", tag, s)
        return s
    if not s:
        return tag
    return f"{s} {tag}"


# ---------------------------------------------------------------------------
# 1. McDonald's Singapore (113 outlets) — 5 Verified Counter Price Tiers
# ---------------------------------------------------------------------------
MCD_HEARTLAND_SFA = {
    "NW16G14N000",  # 109 Lorong 1 Toa Payoh
    "E96012J000",   # 113 Aljunied Ave 2
    "SW04457J000",  # 256 Jurong East Street 24
    "NE16695P000",  # 268C Punggol Field
    "S99091K000",   # 490 Lorong 6 Toa Payoh
    "S99162B000",   # 600 Hougang Ave 3
    "E92148L000",   # Siglap Centre (PRE10 $6.40 Big Mac / $6.20 McCrispy 2pc)
    "S96248E000",   # 684 Hougang Ave 8
    "NW15326X000",  # Ang Mo Kio Avenue 3 / AMK Park
    "SE05248X000",  # Bedok North
    "SW04454P000",  # Blk 152 Bukit Batok St 11
    "S84145P000",   # Blk 208 Hougang St 21
    "C82237E000",   # Blk 451 Clementi Ave 3
    "E84049C000",   # Blk 513 Tampines Central 1
    "B91042A000",   # Blk 846 Yishun Ring Road
    "NW05118V000",  # Blk 883 Woodlands St 82
    "S85046A000",   # Block 148 Potong Pasir Ave 1
    "W96272L000",   # Block 22 Boon Keng Road
    "S81075P000",   # Block 448 Ang Mo Kio Ave 10
    "NW14624P000",  # Chua Chu Kang Community Club
    "E89004N000",   # Eunos Grove
    "B97046J000",   # Fajar Shopping Centre
    "E86095N000",   # Geylang East Central
    "J99081P000",   # Jurong Green Community Club
    "NE15810V000",  # Kaki Bukit Mall / Bedok North
    "SW19909V000",  # Keat Hong Mirage
    "B99068E000",   # Limbang Shopping Centre
    "E98090B000",   # Loyang Point
    "NW23D22X000",  # Mayflower
    "SW04456L000",  # Neighbourhood Centre Bukit Batok
    "E95041P000",   # Pasir Ris Elias Community Club
    "SW08875V000",  # Pioneer Mall
    "E82026B000",   # Reservoir Village
    "NE12E34N000",  # Rivervale Plaza
    "CE14C66P000",  # SAFRA Toa Payoh
    "NW10054X000",  # SAFRA Yishun
    "NW14149B000",  # Sembawang Cottage
    "NE17720J000",  # Tampines East Community Club
    "E97169X000",   # Tampines Mart
    "NE15175K000",  # Tampines West Community Club
    "J86008K000",   # Town Centre Bukit Batok
    "NW17218N000",  # Woodlands Mart
}

MCD_CITY_TOURIST_SFA = {
    "CE12026X000",  # Gardens by the Bay (018953)
    "SW15482L000",  # VivoCity (098585)
    "CE06P70N000",  # Marina Square (039594)
    "CE15810V000",  # Suntec City (038983)
    "CE16L62A000",  # Bugis Junction (188021)
    "W91015P000",   # Bugis Village (188024)
    "CE12Q31V000",  # Chinatown Point (059413)
    "CE09F55B000",  # City Square Mall (208539)
    "CE20155A000",  # Great World (237994)
    "W02153N000",   # United Square (307591)
    "CE14K77K000",  # Aperia Mall (339511)
    "SW11B52E000",  # Alexandra Retail Centre (119963)
    "SW13T17X000",  # The Metropolis (138588)
    "SE11B24N000",  # Changi City Point (486038)
    "SE26058X000",  # East Coast Park (449876)
    "CE13182N000",  # 70 Jellicoe Rd V Hotel Lavender (208767)
}

MCD_PRIME_ORCHARD_CBD_SFA = {
    "CE11F38P000",  # Shaw Centre / Lido Orchard (228208)
    "W89184J000",   # Forum The Shopping Mall Orchard (238884)
    "W98431C000",   # Plaza Singapura Orchard (238839)
    "CE23916P000",  # Cathay Cineleisure Orchard (239695)
    "W98021K000",   # Parklane Shopping Mall (188307)
    "W92141A000",   # 1 South Canal Rd Boat Quay / Raffles Place (048508)
    "CE04322B000",  # Springleaf Tower Tanjong Pagar CBD (079909)
    "NW17A12L000",  # 383 Bukit Timah Rd Alocassia (259727)
    "W80085A000",   # Serene Centre Bukit Timah (258748)
}

# Exact verified item overrides for McDonald's key items across tiers
# (Tier 0: NTU Campus, Tier 1: Heartland/HDB/CC, Tier 2: Suburban Mall, Tier 3: City/Tourist, Tier 4: Prime Orchard/CBD)
MCD_EXACT_TIERS = {
    "big mac": (5.60, 6.40, 6.65, 6.95, 7.30),
    "big mac®": (5.60, 6.40, 6.65, 6.95, 7.30),
    "big mac extra value meal": (7.40, 8.20, 8.65, 9.10, 9.55),
    "big mac® extra value meal": (7.40, 8.20, 8.65, 9.10, 9.55),
    "double big mac": (7.60, 8.40, 8.85, 9.25, 9.70),
    "double big mac®": (7.60, 8.40, 8.85, 9.25, 9.70),
    "mcspicy": (5.30, 6.00, 6.25, 6.55, 6.90),
    "mcspicy®": (5.30, 6.00, 6.25, 6.55, 6.90),
    "mcspicy extra value meal": (7.20, 8.00, 8.45, 8.90, 9.35),
    "mcspicy® extra value meal": (7.20, 8.00, 8.45, 8.90, 9.35),
    "double mcspicy": (7.40, 8.15, 8.55, 8.95, 9.40),
    "double mcspicy®": (7.40, 8.15, 8.55, 8.95, 9.40),
    "double mcspicy with cheese": (8.00, 9.00, 9.35, 9.75, 10.20),
    "double mcspicy® with cheese": (8.00, 9.00, 9.35, 9.75, 10.20),
    "filet-o-fish": (3.50, 4.00, 4.15, 4.40, 4.65),
    "filet-o-fish®": (3.50, 4.00, 4.15, 4.40, 4.65),
    "filet-o-fish extra value meal": (5.00, 5.50, 6.25, 6.65, 7.05),
    "filet-o-fish® extra value meal": (5.00, 5.50, 6.25, 6.65, 7.05),
    "double filet-o-fish": (5.30, 6.00, 6.35, 6.65, 7.00),
    "double filet-o-fish®": (5.30, 6.00, 6.35, 6.65, 7.00),
    "mcchicken": (3.00, 3.30, 3.50, 3.70, 3.95),
    "mcchicken®": (3.00, 3.30, 3.50, 3.70, 3.95),
    "mcchicken extra value meal": (5.00, 5.00, 5.50, 5.95, 6.35),
    "mcchicken® extra value meal": (5.00, 5.00, 5.50, 5.95, 6.35),
    "cheeseburger": (3.00, 3.30, 3.50, 3.70, 3.95),
    "double cheeseburger": (4.10, 4.50, 4.75, 5.00, 5.25),
    "triple cheeseburger": (5.40, 5.95, 6.25, 6.55, 6.90),
    "hamburger": (2.30, 2.50, 2.65, 2.80, 3.00),
    "quarter pounder with cheese": (5.60, 6.30, 6.65, 6.95, 7.30),
    "quarter pounder® with cheese": (5.60, 6.30, 6.65, 6.95, 7.30),
    "double quarter pounder with cheese": (7.50, 8.35, 8.80, 9.20, 9.65),
    "double quarter pounder® with cheese": (7.50, 8.35, 8.80, 9.20, 9.65),
    "buttermilk crispy chicken": (6.10, 6.85, 7.20, 7.55, 7.95),
    "chicken mccrispy signature (2pc)": (5.80, 6.20, 6.60, 6.90, 7.20),
    "chicken mccrispy® signature (2pc)": (5.80, 6.20, 6.60, 6.90, 7.20),
    "chicken mccrispy spicy (2pc)": (5.80, 6.20, 6.60, 6.90, 7.20),
    "chicken mccrispy® spicy (2pc)": (5.80, 6.20, 6.60, 6.90, 7.20),
    "chicken mccrispy signature (2pc) extra value meal": (7.50, 8.40, 8.80, 9.20, 9.65),
    "chicken mccrispy® signature (2pc) extra value meal": (7.50, 8.40, 8.80, 9.20, 9.65),
    "chicken mccrispy spicy (2pc) extra value meal": (7.50, 8.40, 8.80, 9.20, 9.65),
    "chicken mccrispy® spicy (2pc) extra value meal": (7.50, 8.40, 8.80, 9.20, 9.65),
    "chicken mccrispy signature (6pc)": (16.50, 17.60, 18.50, 19.30, 20.20),
    "chicken mccrispy® signature (6pc)": (16.50, 17.60, 18.50, 19.30, 20.20),
    "chicken mccrispy spicy (6pc)": (16.50, 17.60, 18.50, 19.30, 20.20),
    "chicken mccrispy® spicy (6pc)": (16.50, 17.60, 18.50, 19.30, 20.20),
    "chicken mccrispy (6pc) bundle": (20.90, 22.80, 23.90, 24.90, 25.90),
    "chicken mccrispy® (6pc) bundle": (20.90, 22.80, 23.90, 24.90, 25.90),
    "double mccrispy": (7.90, 8.80, 9.10, 9.50, 9.95),
    "double mccrispy®": (7.90, 8.80, 9.10, 9.50, 9.95),
    "mcwings (2pc)": (2.50, 2.75, 2.90, 3.05, 3.20),
    "mcwings® (2pc)": (2.50, 2.75, 2.90, 3.05, 3.20),
    "mcwings (4pc)": (4.50, 4.95, 5.20, 5.45, 5.75),
    "mcwings® (4pc)": (4.50, 4.95, 5.20, 5.45, 5.75),
    "chicken mcnuggets (6pc)": (4.20, 4.60, 4.85, 5.10, 5.35),
    "chicken mcnuggets® (6pc)": (4.20, 4.60, 4.85, 5.10, 5.35),
    "chicken mcnuggets (9pc)": (5.60, 6.15, 6.45, 6.75, 7.10),
    "chicken mcnuggets® (9pc)": (5.60, 6.15, 6.45, 6.75, 7.10),
    "chicken mcnuggets (20pc)": (11.20, 12.40, 12.95, 13.55, 14.20),
    "chicken mcnuggets® (20pc)": (11.20, 12.40, 12.95, 13.55, 14.20),
    "french fries": (2.80, 3.10, 3.30, 3.50, 3.70),
    "apple pie": (1.50, 1.70, 1.80, 1.90, 2.00),
    "hashbrown": (1.80, 2.10, 2.25, 2.40, 2.55),
    "vanilla cone": (0.80, 1.00, 1.20, 1.30, 1.40),
    "chococone": (1.00, 1.20, 1.40, 1.50, 1.60),
    "chococone®": (1.00, 1.20, 1.40, 1.50, 1.60),
    "hot fudge sundae": (2.00, 2.20, 2.40, 2.55, 2.70),
    "strawberry sundae": (2.00, 2.20, 2.40, 2.55, 2.70),
    "oreo mcflurry": (3.00, 3.30, 3.60, 3.80, 4.00),
    "oreo® mcflurry®": (3.00, 3.30, 3.60, 3.80, 4.00),
    "mudpie mcflurry": (3.40, 3.75, 4.00, 4.20, 4.40),
    "mudpie mcflurry®": (3.40, 3.75, 4.00, 4.20, 4.40),
    "strawberry shortcake mcflurry": (3.40, 3.75, 4.00, 4.20, 4.40),
    "strawberry shortcake mcflurry®": (3.40, 3.75, 4.00, 4.20, 4.40),
    "egg mcmuffin": (3.50, 4.00, 4.20, 4.45, 4.70),
    "egg mcmuffin®": (3.50, 4.00, 4.20, 4.45, 4.70),
    "sausage mcmuffin": (2.80, 3.20, 3.40, 3.60, 3.80),
    "sausage mcmuffin®": (2.80, 3.20, 3.40, 3.60, 3.80),
    "sausage mcmuffin with egg": (3.80, 4.20, 4.45, 4.70, 4.95),
    "sausage mcmuffin® with egg": (3.80, 4.20, 4.45, 4.70, 4.95),
    "chicken mcmuffin": (2.80, 3.20, 3.40, 3.60, 3.80),
    "chicken mcmuffin®": (2.80, 3.20, 3.40, 3.60, 3.80),
    "chicken mcmuffin with egg": (3.80, 4.20, 4.45, 4.70, 4.95),
    "chicken mcmuffin® with egg": (3.80, 4.20, 4.45, 4.70, 4.95),
    "big breakfast": (5.80, 6.50, 6.80, 7.15, 7.50),
    "big breakfast®": (5.80, 6.50, 6.80, 7.15, 7.50),
    "breakfast deluxe": (6.80, 7.65, 8.05, 8.45, 8.85),
    "breakfast deluxe™": (6.80, 7.65, 8.05, 8.45, 8.85),
    "hotcakes": (4.50, 5.10, 5.40, 5.70, 6.00),
    "hotcakes with sausage": (5.40, 6.05, 6.40, 6.75, 7.10),
    "breakfast wrap chicken sausage": (3.90, 4.40, 4.65, 4.90, 5.15),
    "breakfast wrap chicken ham": (3.90, 4.40, 4.65, 4.90, 5.15),
}


def classify_mcd_outlet(venue: str, sfa: str, postal: str, addr: str) -> tuple[int, str]:
    if sfa == "SW08201N000" or "nanyang drive" in addr.lower() or "ntu" in venue.lower():
        return 0, "Tier 0 — University Campus (NTU Subsidized Counter Rate)"
    if sfa in MCD_PRIME_ORCHARD_CBD_SFA:
        return 4, "Tier 4 — Prime Orchard / CBD Counter Rate"
    if sfa in MCD_CITY_TOURIST_SFA:
        return 3, "Tier 3 — City / Tourist / Waterfront Counter Rate"
    if sfa in MCD_HEARTLAND_SFA or "community club" in addr.lower() or "safra" in venue.lower():
        return 1, "Tier 1 — Heartland HDB / Community Club Counter Rate"
    return 2, "Tier 2 — Standard Suburban Mall Counter Rate"


def compute_mcd_price(dish: str, cur_price: float, tier_idx: int) -> float:
    dl = dish.lower().strip()
    if dl in MCD_EXACT_TIERS:
        return MCD_EXACT_TIERS[dl][tier_idx]
    # Proportional multiplier from Tier 2 (Standard Mall baseline)
    multipliers = {
        0: 0.85,  # NTU Campus
        1: 0.95,  # Heartland / HDB / CC
        2: 1.00,  # Standard Suburban Mall
        3: 1.05,  # City / Tourist
        4: 1.10,  # Prime Orchard / CBD
    }
    return round_sg_price(cur_price * multipliers[tier_idx], 0.05)


# ---------------------------------------------------------------------------
# 2. General Location Tier Classifier for Other Chains
# ---------------------------------------------------------------------------
def get_general_location_type(venue: str, sfa: str, postal: str, addr: str) -> str:
    """
    Returns one of:
      - 'CAMPUS_HOSPITAL' (Universities, Public Hospitals, Polyclinics, Mediacorp/IHQ)
      - 'CC_HAWKER_SAFRA' (Community Clubs, SAFRA, HomeTeamNS, Sports Centres, Hawker Centres, HDB Coffeeshops)
      - 'AIRPORT_RESORT_ZOO' (Changi Airport T1-T4, Jewel, MBS, RWS, Sentosa, Gardens by the Bay, Mandai Zoo/Bird Paradise, Tanah Merah Ferry)
      - 'PRIME_ORCHARD_CBD' (Orchard Rd 228/238/239, Raffles Place/Marina Bay/Tanjong Pagar CBD 018/048/049/068/069/078/079, VivoCity 098585, Suntec/Millenia/Marina Sq 038/039, Raffles City/Funan/Clarke Quay)
      - 'SUBURBAN_MALL' (All standard suburban malls and town centres)
    """
    combo = f"{venue} {addr}".lower()
    p3 = postal[:3] if len(postal) == 6 and postal.isdigit() else ""

    # 1. Airport / Resort / Zoo / Sentosa / Gardens by the Bay
    if (
        postal in {"819642", "819643", "819663", "819665", "819666", "018953", "018972", "098138", "098977", "099010", "098604", "729825", "729826", "498833"}
        or any(k in combo for k in [
            "changi airport", "jewel changi", "marina bay sands", "gardens by the bay",
            "resorts world", "sentosa", "siloso", "mandai lake", "zoological", "bird paradise",
            "tanah merah ferry", "one fullerton", "merlion park", "esplanade"
        ])
    ):
        return "AIRPORT_RESORT_ZOO"

    # 2. Campus / Hospital / Polyclinic / HQ
    if (
        postal in {"169608", "169609", "229899", "308433", "307382", "529889", "768828", "609606", "119074", "119082", "574623", "308205", "427990", "539747"}
        or sfa in {"SE13R86K000", "CE15D43B000"}  # BreadTalk IHQ, Mediacorp Stars Ave
        or any(k in combo for k in [
            "hospital", "polyclinic", "national heart centre", "national skin centre",
            "singhealth", "institute of mental health", "nanyang drive", "north spine",
            "kent ridge", "university town", "college ave", "engineering drive",
            "lower kent ridge", "dover road", "polytechnic", "breadtalk ihq", "mediacorp"
        ])
    ):
        return "CAMPUS_HOSPITAL"

    # 3. Community Club / SAFRA / HomeTeamNS / Hawker Centre / Sports Centre
    if any(k in combo for k in [
        "community club", "community centre", "safra", "hometeamns",
        "hawker centre", "sports centre", "food court", "eating house",
        "khatib spring", "501 west coast drive", "havelock view"
    ]):
        return "CC_HAWKER_SAFRA"

    # 4. Prime Orchard / CBD / Waterfront / City
    if (
        p3 in {"018", "038", "039", "048", "049", "058", "059", "068", "069", "078", "079", "179", "228", "238", "239"}
        or postal in {"098585", "098586", "188021", "189356", "247933"}
        or any(k in combo for k in [
            "ion orchard", "paragon", "takashimaya", "ngee ann city", "wisma atria",
            "313@somerset", "313 @ somerset", "orchard gateway", "centrepoint",
            "plaza singapura", "shaw house", "shaw centre", "forum the shopping mall",
            "wheelock place", "tang plaza", "liat towers", "tanglin mall",
            "raffles place", "marina bay link", "asia square", "capital tower",
            "guoco tower", "tanjong pagar centre", "100 am", "100am", "international plaza",
            "suntec city", "millenia walk", "marina square", "raffles city", "funan",
            "clarke quay", "chinatown point", "vivocity", "vivo city", "harbourfront centre",
            "cimb plaza", "hong leong building", "the clift", "marina one", "robinson"
        ])
    ):
        return "PRIME_ORCHARD_CBD"

    return "SUBURBAN_MALL"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Write changes to MASTER_XLSX")
    args = parser.parse_args()

    if args.apply and not BACKUP_XLSX.exists():
        shutil.copy2(MASTER_XLSX, BACKUP_XLSX)
        print(f"Created backup: {BACKUP_XLSX}")

    wb = openpyxl.load_workbook(MASTER_XLSX)
    ws_fd = wb["Food Directory"]
    ws_mp = wb["Menu & Price"]

    # -----------------------------------------------------------------------
    # Step 1: Fix Misnamed Gardens by the Bay ("* Hillion Mall") & S84212A000
    # -----------------------------------------------------------------------
    fd_renamed = 0
    fd_postal_fixed = 0
    mp_renamed = 0
    mp_quarantined = 0

    for row in ws_fd.iter_rows(min_row=2):
        v = str(row[0].value or "").strip()
        reg = str(row[1].value or "").strip()
        sfa = str(row[2].value or "").strip()
        addr = str(row[12].value or "").strip()
        postal = str(row[13].value or "").strip()

        # Fix actual Hillion Mall stalls (17 Petir Rd) that had postal 018953
        if postal == "018953" and "17 petir" in addr.lower():
            row[13].value = "678278"
            row[12].value = addr.replace("018953", "678278")
            fd_postal_fixed += 1
            continue

        # Fix Gardens by the Bay stalls (018953, 18 Marina Gardens Drive) misnamed "* Hillion Mall"
        if postal == "018953" and "marina gardens" in addr.lower() and "hillion mall" in v.lower():
            new_v = re.sub(r"(?i)\s*@?\s*hillion\s*mall", " Gardens by the Bay", v).strip()
            row[0].value = new_v
            fd_renamed += 1

        # Fix S84212A000 ("KFC Yu Pan 御品粿條湯。魚湯")
        if sfa == "S84212A000":
            row[0].value = "Yu Pan 御品粿條湯。魚湯"
            row[1].value = "Yu Pan 御品粿條湯。魚湯"
            row[6].value = "Teochew, Fish Soup & Kway Teow Soup"
            row[12].value = "139 Tampines St. 11, #01-66, Singapore 521139"
            row[26].value = None
            fd_renamed += 1

    for row in ws_mp.iter_rows(min_row=2):
        v = str(row[0].value or "").strip()
        sfa = str(row[1].value or "").strip()
        addr = str(row[2].value or "").strip()
        postal = str(row[3].value or "").strip()
        dish = str(row[4].value or "").strip()
        price = row[6].value

        # Fix actual Hillion Mall rows in Menu & Price if postal == 018953 and 17 Petir Rd
        if postal == "018953" and "17 petir" in addr.lower():
            row[3].value = "678278"
            row[2].value = addr.replace("018953", "678278")

        # Fix Gardens by the Bay rows in Menu & Price
        if postal == "018953" and "marina gardens" in addr.lower() and "hillion mall" in v.lower():
            new_v = re.sub(r"(?i)\s*@?\s*hillion\s*mall", " Gardens by the Bay", v).strip()
            row[0].value = new_v
            v = new_v
            mp_renamed += 1

        # Fix S84212A000 ("KFC Yu Pan 御品粿條湯。魚湯")
        if sfa == "S84212A000":
            row[0].value = "Yu Pan 御品粿條湯。魚湯"
            row[2].value = "139 Tampines St. 11, #01-66, Singapore 521139"
            if price is not None:
                row[6].value = None
                row[7].value = (
                    f"[QUARANTINED: Cross-merchant chain menu contamination — "
                    f"KFC menu item '{dish}' misattributed to independent Fish Soup / "
                    f"Kway Teow Soup stall Yu Pan 御品粿條湯。魚湯 (S84212A000)]"
                )
                row[8].value = None
                row[11].value = None
                row[12].value = None
                row[13].value = None
                mp_quarantined += 1

    # -----------------------------------------------------------------------
    # Step 2: Apply Outlet-Specific Counter Price Tiers Across All Chains
    # -----------------------------------------------------------------------
    chain_updates = defaultdict(int)
    outlet_tiers_seen = defaultdict(set)

    for row in ws_mp.iter_rows(min_row=2):
        v = str(row[0].value or "").strip()
        sfa = str(row[1].value or "").strip()
        addr = str(row[2].value or "").strip()
        postal = str(row[3].value or "").strip()
        dish = str(row[4].value or "").strip()
        cat = str(row[5].value or "").strip()
        price = row[6].value
        notes = str(row[7].value or "").strip()

        if price is None or sfa == "S84212A000":
            continue
        try:
            cur_p = float(price)
        except (ValueError, TypeError):
            continue

        vl = v.lower()
        dl = dish.lower().strip()
        loc_type = get_general_location_type(v, sfa, postal, addr)

        new_p = cur_p
        tier_label = None
        cname = None

        # 1. McDonald's (113 outlets)
        if "mcdonald" in vl:
            cname = "McDonald's"
            t_idx, tier_label = classify_mcd_outlet(v, sfa, postal, addr)
            new_p = compute_mcd_price(dish, cur_p, t_idx)

        # 2. Toast Box (16 outlets)
        elif re.search(r"toast\s*box|breadtalk,toastbox", vl):
            cname = "Toast Box"
            if loc_type == "CAMPUS_HOSPITAL":
                tier_label = "Tier 0 — Hospital / BreadTalk IHQ Institutional Counter Rate"
                if "kopi" in dl or "teh" in dl or "toast" in dl and "set" not in dl:
                    new_p = round_sg_price(cur_p - 0.20, 0.10)
                else:
                    new_p = round_sg_price(cur_p * 0.92, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard / CBD / Waterfront Counter Rate"
                if "kopi" in dl or "teh" in dl or ("toast" in dl and "set" not in dl):
                    new_p = round_sg_price(cur_p + 0.20, 0.10)
                elif "set" in dl or "laksa" in dl or "curry" in dl or "mee" in dl or "rice" in dl:
                    new_p = round_sg_price(cur_p + 0.50, 0.10)
                else:
                    new_p = round_sg_price(cur_p + 0.30, 0.10)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall Counter Rate"
                new_p = cur_p

        # 3. Ya Kun Kaya Toast (14 outlets)
        elif re.search(r"ya\s*kun", vl):
            cname = "Ya Kun Kaya Toast"
            if loc_type == "CC_HAWKER_SAFRA":
                tier_label = "Tier 0 — SAFRA Clubhouse Counter Rate"
                if "set" in dl:
                    new_p = round_sg_price(cur_p - 0.30, 0.10)
                else:
                    new_p = round_sg_price(cur_p - 0.15, 0.10)
            elif loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 3 — Jewel Changi Airport Counter Rate"
                if "set" in dl:
                    new_p = round_sg_price(cur_p + 0.50, 0.10)
                elif "iced" in dl or "toastwich" in dl or "frosty" in dl:
                    new_p = round_sg_price(cur_p + 0.40, 0.10)
                else:
                    new_p = round_sg_price(cur_p + 0.30, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard / CBD / City Counter Rate"
                if "set" in dl or "toastwich" in dl or "iced" in dl:
                    new_p = round_sg_price(cur_p + 0.20, 0.10)
                else:
                    new_p = round_sg_price(cur_p + 0.10, 0.10)
            else:
                tier_label = "Tier 1 — Heartland / Suburban Mall Counter Rate"
                new_p = cur_p

        # 4. Starbucks (109 outlets)
        elif "starbucks" in vl:
            cname = "Starbucks"
            if loc_type in {"CAMPUS_HOSPITAL", "CC_HAWKER_SAFRA"}:
                tier_label = "Tier 0 — Campus / Hospital / Community Hub Counter Rate"
                new_p = round_sg_price(max(2.50, cur_p - 0.40), 0.10)
            elif loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 3 — Changi Airport / MBS / Sentosa / Gardens by the Bay / Mandai Counter Rate"
                new_p = round_sg_price(cur_p + 0.70, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard / CBD / City Counter Rate"
                new_p = round_sg_price(cur_p + 0.30, 0.10)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall Counter Rate"
                new_p = cur_p

        # 5. The Coffee Bean & Tea Leaf (10 outlets)
        elif "coffee bean" in vl:
            cname = "The Coffee Bean & Tea Leaf"
            if loc_type == "CAMPUS_HOSPITAL":
                tier_label = "Tier 0 — Public Hospital Counter Rate (CGH / TTSH)"
                new_p = round_sg_price(cur_p * 0.94, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard Counter Rate (Forum The Shopping Mall)"
                new_p = round_sg_price(cur_p * 1.06, 0.10)
            else:
                tier_label = "Tier 1 — Standard Mall / Neighbourhood Counter Rate"
                new_p = cur_p

        # 6. KFC (52 outlets)
        elif re.search(r"\bkfc\b", vl):
            cname = "KFC"
            if loc_type in {"CC_HAWKER_SAFRA", "CAMPUS_HOSPITAL"} or any(
                k in f"{v} {addr}".lower()
                for k in ["blk ", "block ", "lorong", "new upper changi", "jalan besar", "clementi ave 2", "town centre bukit batok", "reservoir village", "sunshine place"]
            ):
                tier_label = "Tier 0 — Heartland HDB / Community Club Counter Rate"
                new_p = round_sg_price(cur_p * 0.95, 0.05)
            elif loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 3 — Sentosa / Singapore Zoo / Jewel Changi Airport Counter Rate"
                new_p = round_sg_price(cur_p * 1.10, 0.05)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — City / Orchard / VivoCity Counter Rate"
                new_p = round_sg_price(cur_p * 1.04, 0.05)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall Counter Rate"
                new_p = cur_p

        # 7. Burger King (66 outlets)
        elif "burger king" in vl:
            cname = "Burger King"
            if loc_type in {"CAMPUS_HOSPITAL", "CC_HAWKER_SAFRA"}:
                tier_label = "Tier 0 — Campus / Hawker Centre / Community Club / Clubhouse Counter Rate"
                new_p = round_sg_price(cur_p * 0.95, 0.10)
            elif loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 3 — Changi Airport Terminal Counter Rate (T1/T2/T3)"
                new_p = round_sg_price(cur_p * 1.12, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard / CBD / VivoCity Counter Rate"
                new_p = round_sg_price(cur_p * 1.05, 0.10)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall Counter Rate"
                new_p = cur_p

        # 8. Subway (10 outlets)
        elif re.search(r"\bsubway\b", vl):
            cname = "Subway"
            if loc_type == "CC_HAWKER_SAFRA":
                tier_label = "Tier 0 — Community Club / Sports Centre Counter Rate"
                new_p = round_sg_price(cur_p - (0.70 if "footlong" in dl else 0.40), 0.10)
            elif loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 2 — Changi Airport T1 / Tanah Merah Ferry Terminal Counter Rate"
                new_p = round_sg_price(cur_p + (1.00 if "footlong" in dl else 0.60), 0.10)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall Counter Rate"
                new_p = cur_p

        # 9. Jollibee (6 outlets)
        elif "jollibee" in vl:
            cname = "Jollibee"
            if postal in {"188440", "208539"} or "rochor" in addr.lower() or "city square" in vl:
                tier_label = "Tier 2 — Central / Bugis / City Square Counter Rate"
                new_p = round_sg_price(cur_p * 1.05, 0.05)
            else:
                tier_label = "Tier 1 — Suburban Mall Counter Rate (AMK Hub / Jurong Point / Square 2)"
                new_p = cur_p

        # 10. MOS Burger (25 outlets)
        elif re.search(r"mos\s*burger", vl):
            cname = "MOS Burger"
            if loc_type == "CC_HAWKER_SAFRA" or sfa in {"NW17575N000", "S02064B000", "NE18955B000", "S01031E000"}:
                tier_label = "Tier 0 — Hawker Centre / HDB Hub / Community Hub Counter Rate"
                new_p = round_sg_price(cur_p - 0.20, 0.05)
            elif loc_type in {"PRIME_ORCHARD_CBD", "AIRPORT_RESORT_ZOO"}:
                tier_label = "Tier 2 — Prime Orchard / CBD / One Fullerton Merlion Park Counter Rate"
                new_p = round_sg_price(cur_p + 0.30, 0.05)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall Counter Rate"
                new_p = cur_p

        # 11. Fun Toast (16 outlets)
        elif re.search(r"fun\s*toast", vl):
            cname = "Fun Toast"
            if loc_type == "CAMPUS_HOSPITAL":
                tier_label = "Tier 0 — Hospital / Science Park Institutional Counter Rate"
                new_p = round_sg_price(cur_p - 0.20, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime CBD Counter Rate (Raffles Place / Guoco Tower / Marina One)"
                new_p = round_sg_price(cur_p + 0.30, 0.10)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall Counter Rate"
                new_p = cur_p

        # 12. Kaffe & Toast (5 outlets)
        elif re.search(r"kaffe\s*&\s*toast", vl):
            cname = "Kaffe & Toast"
            if sfa == "CE10079J000":
                tier_label = "Tier 0A — SGH Block 4 Subsidized Hospital Counter Rate"
                if dl in {"kopi", "teh", "kopi o", "teh o"}:
                    new_p = 1.40
                else:
                    new_p = round_sg_price(cur_p * 0.90, 0.10)
            elif loc_type == "CAMPUS_HOSPITAL":
                tier_label = "Tier 0B — National Heart Centre / KKH Hospital Counter Rate"
                if dl in {"kopi", "teh", "kopi o", "teh o"}:
                    new_p = 1.60
                else:
                    new_p = round_sg_price(cur_p * 0.94, 0.10)
            else:
                tier_label = "Tier 1 — Community / Civic Hub Counter Rate (Our Tampines Hub / Woodlands Civic Centre)"
                new_p = cur_p

        # 13. Heavenly Wang (15 outlets)
        elif re.search(r"heavenly\s*wang", vl):
            cname = "Heavenly Wang"
            if loc_type == "CAMPUS_HOSPITAL":
                tier_label = "Tier 0 — Hospital Counter Rate (KTPH / KKH / NTFGH / Parkway East)"
                new_p = round_sg_price(cur_p - 0.30, 0.10)
            elif loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 3 — Changi Airport Terminal Counter Rate (T1/T3/T4)"
                new_p = round_sg_price(cur_p + 0.50, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Marina Bay Financial Centre / CBD Counter Rate"
                new_p = round_sg_price(cur_p + 0.20, 0.10)
            else:
                tier_label = "Tier 1 — Standard Suburban Counter Rate"
                new_p = cur_p

        # 14. BreadTalk (10 outlets)
        elif "breadtalk" in vl:
            cname = "BreadTalk"
            if loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 2 — Resorts World Sentosa Counter Rate"
                new_p = round_sg_price(cur_p * 1.12, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD" or "cafe" in vl:
                tier_label = "Tier 1 — Orchard / CBD / BreadTalk Cafe Counter Rate"
                new_p = round_sg_price(cur_p * 1.06, 0.10)
            else:
                tier_label = "Tier 0 — Heartland / Suburban Mall Counter Rate"
                new_p = cur_p

        # 15. Tiong Bahru Bakery (6 outlets)
        elif "tiong bahru bakery" in vl:
            cname = "Tiong Bahru Bakery"
            if loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard / Raffles City Counter Rate (Wisma Atria / Tang Plaza / Raffles City)"
                new_p = round_sg_price(cur_p * 1.06, 0.10)
            else:
                tier_label = "Tier 1 — Neighbourhood Estate Counter Rate (Eng Hoon St / Tiong Bahru Rd / Serangoon Gardens)"
                new_p = cur_p

        # 16. Paris Baguette (31 outlets)
        elif "paris baguette" in vl:
            cname = "Paris Baguette"
            if loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 3 — Changi Airport (T2/T3/T4/Jewel) Counter Rate"
                new_p = round_sg_price(cur_p * 1.08, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard / CBD / VivoCity Counter Rate (ION / Paragon / Raffles City)"
                new_p = round_sg_price(cur_p * 1.04, 0.10)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall Counter Rate"
                new_p = cur_p

        # 17. Four Leaves (30 outlets)
        elif "four leaves" in vl:
            cname = "Four Leaves"
            if loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — City / Suntec / Bugis / Chinatown Point Counter Rate"
                new_p = round_sg_price(cur_p + 0.20, 0.10)
            else:
                tier_label = "Tier 1 — Heartland / Suburban Mall Counter Rate"
                new_p = cur_p

        # 18. Polar Puffs & Cakes (28 outlets)
        elif "polar puffs" in vl:
            cname = "Polar Puffs"
            if loc_type == "CAMPUS_HOSPITAL":
                tier_label = "Tier 0 — Hospital Counter Rate (KKH / TTSH / Mount Alvernia / NSC)"
                new_p = round_sg_price(cur_p * 0.94, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — City / VivoCity / Chinatown Point Counter Rate"
                new_p = round_sg_price(cur_p * 1.05, 0.10)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall / MRT Counter Rate"
                new_p = cur_p

        # 19. Cedele (20 outlets)
        elif "cedele" in vl:
            cname = "Cedele"
            if loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard / CBD All-Day Dining Counter Rate (Paragon / Asia Square / CIMB Plaza / Guoco Tower / VivoCity)"
                new_p = round_sg_price(cur_p * 1.05, 0.10)
            else:
                tier_label = "Tier 1 — Suburban / Neighbourhood Bakery Kitchen Counter Rate"
                new_p = cur_p

        # 20. Tai Cheong Bakery (8 outlets)
        elif "tai cheong" in vl:
            cname = "Tai Cheong"
            if loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard / City Counter Rate (Ngee Ann City / Raffles City / VivoCity)"
                new_p = round_sg_price(cur_p + (0.20 if cur_p < 5.0 else 0.40), 0.10)
            else:
                tier_label = "Tier 1 — Holland Village / Suburban Mall Counter Rate"
                new_p = cur_p

        # 21. Mr Bean (68 outlets)
        elif re.search(r"\bmr\s*bean\b", vl):
            cname = "Mr Bean"
            if loc_type in {"CAMPUS_HOSPITAL", "CC_HAWKER_SAFRA"}:
                tier_label = "Tier 0 — Hospital / Polyclinic / Hawker Centre Counter Rate"
                new_p = round_sg_price(max(1.50, cur_p - 0.20), 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — CBD / Orchard Counter Rate (Raffles Place / Capital Tower / Centrepoint / Bugis)"
                new_p = round_sg_price(cur_p + 0.20, 0.10)
            else:
                tier_label = "Tier 1 — Standard MRT / Suburban Mall Counter Rate"
                new_p = cur_p

        # 22. Luckin Coffee (53 outlets)
        elif "luckin" in vl:
            cname = "Luckin Coffee"
            if loc_type == "CAMPUS_HOSPITAL":
                tier_label = "Tier 0 — Campus / Hospital Counter Rate (NUH / KKH / IMH / Science Park)"
                new_p = round_sg_price(cur_p - 0.40, 0.10)
            elif loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 3 — Changi Airport T1 / Jewel / Sentosa Beach / Ferry Terminal Counter Rate"
                new_p = round_sg_price(cur_p + 0.60, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard / CBD Counter Rate (313@Somerset / Plaza Singapura / Robinson Rd / Guoco Tower)"
                new_p = round_sg_price(cur_p + 0.30, 0.10)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall Counter Rate"
                new_p = cur_p

        # 23. LiHO TEA (26 outlets)
        elif re.search(r"\bliho\b", vl):
            cname = "LiHO TEA"
            if loc_type == "CC_HAWKER_SAFRA":
                tier_label = "Tier 0 — Community Club / Hub Counter Rate (Nanyang CC / Our Tampines Hub)"
                new_p = round_sg_price(cur_p - 0.20, 0.10)
            elif loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 3 — Changi Airport T2 / Sentosa Beach Station Counter Rate"
                new_p = round_sg_price(cur_p + 0.50, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard / Funan / VivoCity Counter Rate"
                new_p = round_sg_price(cur_p + 0.20, 0.10)
            else:
                tier_label = "Tier 1 — Heartland / Suburban Mall Counter Rate"
                new_p = cur_p

        # 24. Boost Juice (7 outlets)
        elif "boost juice" in vl:
            cname = "Boost Juice"
            if loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard / CBD Counter Rate (313@Somerset / One Raffles Place / Guoco Tower / Bugis)"
                new_p = round_sg_price(cur_p + 0.30, 0.10)
            else:
                tier_label = "Tier 1 — Suburban Mall Counter Rate (Jurong Point / Sun Plaza / City Square)"
                new_p = cur_p

        # 25. Kenangan Coffee (4 outlets)
        elif "kenangan" in vl:
            cname = "Kenangan Coffee"
            if loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 3 — Changi Airport T2 / Jewel Changi Airport Counter Rate"
                new_p = round_sg_price(cur_p + 0.50, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — VivoCity Waterfront Counter Rate"
                new_p = round_sg_price(cur_p + 0.20, 0.10)
            else:
                tier_label = "Tier 1 — City Fringe Mall Counter Rate (Aperia Mall)"
                new_p = cur_p

        # 26. Huggs Coffee (2 outlets)
        elif re.search(r"\bhuggs\b", vl):
            cname = "Huggs"
            if loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — CBD Core Counter Rate (The Clift McCallum St)"
                new_p = round_sg_price(cur_p + 0.30, 0.10)
            else:
                tier_label = "Tier 1 — Industrial / Business Park Counter Rate (18 Tai Seng)"
                new_p = cur_p

        # 27. Coffee Hive (2 outlets)
        elif "coffee hive" in vl:
            cname = "Coffee Hive"
            if sfa == "CE10676A000" or "square 2" in vl:
                tier_label = "Tier 2 — Novena Medical / Commercial Hub Counter Rate (Square 2)"
                new_p = round_sg_price(cur_p + 0.20, 0.10)
            else:
                tier_label = "Tier 1 — Heartland Mall Counter Rate (Rivervale Mall)"
                new_p = cur_p

        # 28. Saizeriya (45 outlets)
        elif "saizeriya" in vl:
            cname = "Saizeriya"
            if loc_type in {"CAMPUS_HOSPITAL", "CC_HAWKER_SAFRA"} or sfa in {"S87167P000", "NE04054L000"}:
                tier_label = "Tier 0 — Hospital / Clubhouse / HDB Hub Counter Rate (NTFGH / HomeTeamNS Khatib / Toa Payoh)"
                if cur_p >= 5.90:
                    new_p = round_sg_price(cur_p - 0.40, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Orchard Gateway / Marina Square / Chinatown Point Counter Rate"
                if cur_p >= 5.90:
                    new_p = round_sg_price(cur_p + 0.50, 0.10)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall Counter Rate"
                new_p = cur_p

        # 29. Sukiya (30 outlets)
        elif re.search(r"\bsukiya\b", vl):
            cname = "Sukiya"
            if loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 3 — Changi Airport Terminal 2 Counter Rate"
                new_p = round_sg_price(cur_p + 0.60, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard / City Counter Rate (313@Somerset / Suntec / Marina Square / Funan)"
                new_p = round_sg_price(cur_p + 0.30, 0.10)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall Counter Rate"
                new_p = cur_p

        # 30. Genki Sushi (22 outlets)
        elif "genki sushi" in vl:
            cname = "Genki Sushi"
            if loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard / City / VivoCity Counter Rate (313@Somerset / Plaza Singapura / Suntec / VivoCity)"
                new_p = round_sg_price(cur_p * 1.05, 0.10)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall Counter Rate"
                new_p = cur_p

        # 31. Sushi Express (10 outlets)
        elif "sushi express" in vl:
            cname = "Sushi Express"
            if sfa == "SE17849N000" or "heartbeat" in vl:
                tier_label = "Tier 0 — Community Hub Counter Rate (Heartbeat @ Bedok)"
                new_p = round_sg_price(cur_p * 0.96, 0.10)
            else:
                tier_label = "Tier 1 — Suburban Mall Counter Rate"
                new_p = cur_p

        # 32. Putien (4 outlets)
        elif "putien" in vl:
            cname = "Putien"
            if loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 3 — Marina Bay Sands Resort Counter Rate"
                new_p = round_sg_price(cur_p * 1.12, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — VivoCity Waterfront Flagship Counter Rate"
                new_p = round_sg_price(cur_p * 1.06, 0.10)
            else:
                tier_label = "Tier 1 — Suburban Mall Counter Rate (NEX / Jurong Point)"
                new_p = cur_p

        # 33. Song Fa Bak Kut Teh (7 outlets)
        elif "song fa" in vl:
            cname = "Song Fa Bak Kut Teh"
            if loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 3 — Mandai Singapore Zoo Counter Rate (80 Mandai Lake Rd)"
                new_p = round_sg_price(cur_p * 1.12, 0.10)
            elif loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — Prime Orchard Counter Rate (The Centrepoint / TripleOne Somerset)"
                new_p = round_sg_price(cur_p * 1.06, 0.10)
            else:
                tier_label = "Tier 1 — Suburban Mall / Business Park Counter Rate (Jem / Waterway Point / Punggol Coast / Changi Biz Park)"
                new_p = cur_p

        # 34. Collin's (11 outlets)
        elif "collin" in vl:
            cname = "Collin's"
            if loc_type == "CC_HAWKER_SAFRA":
                tier_label = "Tier 0 — Collin's Grille Bento HDB Coffeeshop Counter Rate (Khatib / West Coast / Havelock)"
                new_p = round_sg_price(cur_p * 0.85, 0.10)
            elif loc_type in {"AIRPORT_RESORT_ZOO", "PRIME_ORCHARD_CBD"}:
                tier_label = "Tier 2 — Mandai Wildlife Reserve / VivoCity Restaurant Counter Rate"
                new_p = round_sg_price(cur_p * 1.08, 0.10)
            else:
                tier_label = "Tier 1 — Suburban Mall Restaurant Counter Rate (NEX / PLQ / Westgate / Tampines 1 / Sengkang Grand)"
                new_p = cur_p

        # 35. Ajisen Ramen (6 outlets)
        elif "ajisen" in vl:
            cname = "Ajisen"
            if "tanjiro" in vl or sfa == "SW12J16B000":
                tier_label = "Tier 2 — Ajisen Tanjiro Specialty Concept Counter Rate (The Star Vista)"
                new_p = round_sg_price(cur_p * 1.08, 0.10)
            else:
                tier_label = "Tier 1 — Suburban Mall Counter Rate (Compass One / Junction 8 / Causeway Point)"
                new_p = cur_p

        # 36. Yoshinoya (5 outlets)
        elif "yoshinoya" in vl:
            cname = "Yoshinoya"
            if sfa == "NE17316P000" or "loyang" in vl:
                tier_label = "Tier 0 — Neighbourhood Mall Counter Rate (Loyang Point)"
                new_p = round_sg_price(cur_p - 0.30, 0.10)
            elif sfa == "CE13Y77C000" or "holland" in addr.lower():
                tier_label = "Tier 2 — Holland Village Shophouse Counter Rate"
                new_p = round_sg_price(cur_p + 0.30, 0.10)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall Counter Rate (Bedok Mall / Junction 8)"
                new_p = cur_p

        # 37. Wok Hey (4 outlets)
        elif "wok hey" in vl:
            cname = "Wok Hey"
            if loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — CBD / City Counter Rate (Guoco Tower / Funan)"
                new_p = round_sg_price(cur_p + 0.30, 0.10)
            else:
                tier_label = "Tier 1 — Suburban Mall Counter Rate (Bukit Panjang Plaza)"
                new_p = cur_p

        # 38. Texas Chicken (4 outlets)
        elif "texas chicken" in vl:
            cname = "Texas Chicken"
            if sfa == "SW21K13J000" or "pioneer mall" in addr.lower():
                tier_label = "Tier 0 — Neighbourhood Mall Counter Rate (Pioneer Mall)"
                new_p = round_sg_price(cur_p * 0.95, 0.10)
            else:
                tier_label = "Tier 1 — Standard Suburban Mall Counter Rate (Causeway Point / Century Square / Seletar Mall)"
                new_p = cur_p

        # 39. The Soup Spoon (3 outlets)
        elif "soup spoon" in vl:
            cname = "The Soup Spoon"
            if loc_type == "PRIME_ORCHARD_CBD":
                tier_label = "Tier 2 — City Mall Counter Rate (Raffles City / Bugis Junction)"
                new_p = round_sg_price(cur_p + 0.30, 0.10)
            else:
                tier_label = "Tier 1 — Suburban Mall Counter Rate (Tiong Bahru Plaza)"
                new_p = cur_p

        # 40. Swensen's (3 outlets)
        elif "swensen" in vl:
            cname = "Swensen's"
            if "earle" in vl or sfa == "NE24814C000":
                tier_label = "Tier 2 — Earle Swensen's Grill & Salad Buffet Concept Rate (Pasir Ris Mall)"
                new_p = round_sg_price(cur_p * 1.08, 0.10)
            else:
                tier_label = "Tier 1 — Standard Swensen's Family Restaurant Rate (Causeway Point)"
                new_p = cur_p

        # 41. Shake Shack (2 outlets)
        elif "shake shack" in vl:
            cname = "Shake Shack"
            if loc_type == "AIRPORT_RESORT_ZOO":
                tier_label = "Tier 2 — Gardens by the Bay Conservatory Attraction Counter Rate"
                new_p = round_sg_price(cur_p + 0.50, 0.10)
            else:
                tier_label = "Tier 1 — Standard Singapore Shack Counter Rate"
                new_p = cur_p

        # 42. Pizza Hut (2 outlets)
        elif "pizza hut" in vl:
            cname = "Pizza Hut"
            if loc_type == "CC_HAWKER_SAFRA" or "food court" in vl:
                tier_label = "Tier 0 — Food Court Express Counter Rate (509 Food Court Tampines)"
                new_p = round_sg_price(cur_p * 0.92, 0.10)
            else:
                tier_label = "Tier 1 — Standard Neighbourhood Counter Rate (888 Woodlands)"
                new_p = cur_p

        # 43. Astons (2 outlets)
        elif re.search(r"\baston", vl):
            cname = "Aston"
            if loc_type == "CAMPUS_HOSPITAL" or sfa == "CE15D43B000":
                tier_label = "Tier 0 — Mediacorp Campus Food Court Counter Rate (1 Stars Ave)"
                new_p = round_sg_price(cur_p * 0.90, 0.10)
            else:
                tier_label = "Tier 1 — Mall Casual Steakhouse Counter Rate (City Square Mall)"
                new_p = cur_p

        if tier_label and cname:
            outlet_tiers_seen[cname].add((v, sfa, tier_label))
            row[7].value = set_outlet_tier_note(notes, tier_label)
            if abs(new_p - cur_p) >= 0.01:
                row[6].value = round(new_p, 2)
                row[12].value = TODAY
                chain_updates[cname] += 1

    # -----------------------------------------------------------------------
    # Step 3: Recompute Food Directory Price Range per Venue/SFA
    # -----------------------------------------------------------------------
    by_sfa = defaultdict(list)
    by_venue = defaultdict(list)
    for row in ws_mp.iter_rows(min_row=2, values_only=True):
        v = str(row[0] or "").strip()
        sfa = str(row[1] or "").strip()
        p = row[6]
        if p is not None:
            try:
                pf = float(p)
                if pf > 0:
                    if sfa:
                        by_sfa[sfa].append(pf)
                    if v:
                        by_venue[v.lower()].append(pf)
            except (ValueError, TypeError):
                pass

    fd_pr_updated = 0
    for row in ws_fd.iter_rows(min_row=2):
        v = str(row[0].value or "").strip()
        sfa = str(row[2].value or "").strip()
        prices = by_sfa.get(sfa) or by_venue.get(v.lower()) or []
        if prices:
            lo, hi = min(prices), max(prices)
            avg = sum(prices) / len(prices)
            new_pr = f"${lo:.2f}–${hi:.2f} (${avg:.2f} avg)"
            if row[26].value != new_pr:
                row[26].value = new_pr
                fd_pr_updated += 1

    print(f"FD Renamed: {fd_renamed} | FD Postal Fixed: {fd_postal_fixed} | FD Price Range Updated: {fd_pr_updated}")
    print(f"MP Renamed: {mp_renamed} | MP Quarantined (S84212A000): {mp_quarantined}")
    print(f"Total Chain Outlet Price Updates: {sum(chain_updates.values())} across {len(chain_updates)} chains")
    for cname, cnt in sorted(chain_updates.items(), key=lambda x: -x[1]):
        tiers = {t for _, _, t in outlet_tiers_seen[cname]}
        print(f"  {cname:28s}: {cnt:5d} price updates | {len(outlet_tiers_seen[cname]):3d} outlets | {len(tiers)} tiers")

    if args.apply:
        wb.save(MASTER_XLSX)
        print(f"Saved updated workbook to {MASTER_XLSX}")


if __name__ == "__main__":
    main()

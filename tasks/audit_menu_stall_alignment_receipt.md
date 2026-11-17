# Hungry Project Master Workbook Audit: Menu & Price vs Food Directory Alignment

> **Audit Target:** `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx`  
> **Audit Scope:** 105,826 dish items in `Menu & Price` evaluated row-by-row against 41,563 premises in `Food Directory` under the 3-way identity gating protocol.  
> **Execution Date:** 2026-11-09  

---

## 1. Executive Summary & Verification Metrics

A comprehensive automated verification was conducted across all **105,826** rows of the `Menu & Price` sheet against the **41,563** registered stall premises in `Food Directory`. The audit rigorously enforced SFA licence validity, premise address and postal code parity, F&B brand name token consistency, and menu source URL attribution.

| Verification Metric | Dish Rows | Percentage of Menu | Status / Description |
| :--- | :--- | :--- | :--- |
| **Total Dish Rows Audited** | **105,826** | 100.0% | Complete sheet census |
| **Fully Verified & Aligned** | **86,417** | **81.66%** | 3-way identity gating cleared |
| **Rows with At Least One Discrepancy** | **19,409** | **18.34%** | Flagged for remediation |
| ↳ Missing SFA Licence | 2,407 | 2.27% | SFA Licence field is null/blank |
| ↳ SFA Licence Not in Food Directory | 8,408 | 7.95% | Stall licence not registered in FD sheet |
| ↳ Concatenated SFA Licences (`;`) | 165 | 0.16% | Multi-outlet chain entries lumped together |
| ↳ Null Address / Postal Code | 2,691 | 2.54% | Premise location fields missing in dish row |
| ↳ Postal Code Mismatch | 1,174 | 1.11% | SFA matches, but 6-digit postal differs |
| ↳ Address Content Mismatch | 466 | 0.44% | Substantial text difference in physical address |
| ↳ Brand Name / Identity Token Discrepancy | 14 | 0.01% | Stall brand does not match FD venue/registered name |
| ↳ Menu Source URL Misalignment | 9,646 | 9.11% | Source URL slug/domain conflicts with venue |

---

## 2. Discrepancy Taxonomy & Concrete Row Evidence

### Category 1: Missing SFA Licences (2,407 Rows)
**Description:** Dish items imported from brand websites or menu aggregators without an assigned SFA licence. These belong to 41 multi-outlet chains (e.g., *Polar Puffs & Cakes*, *KFC*, *Paris Baguette*, *Starbucks*, *Din Tai Fung*, *Jollibee*, *Saizeriya*). Because the dishes are brand-level rather than outlet-level, they lack physical venue attribution.

| Row Index | F&B Venue Name | Address | Postal Code | Dish Name | Menu Source URL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 4623 | `4Fingers Singapore` | *NULL* | *NULL* | 6PCS WINGETTES & DRUMETTES | [https://www.4fingers.com.sg/menu](https://www.4fingers.com.sg/menu) |
| 4624 | `4Fingers Singapore` | *NULL* | *NULL* | 12PCS WINGETTES & DRUMETTES | [https://www.4fingers.com.sg/menu](https://www.4fingers.com.sg/menu) |
| 4625 | `4Fingers Singapore` | *NULL* | *NULL* | 18PCS WINGETTES & DRUMETTES | [https://www.4fingers.com.sg/menu](https://www.4fingers.com.sg/menu) |
| 4626 | `4Fingers Singapore` | *NULL* | *NULL* | 6PCS BONELESS CHICKEN BITES | [https://www.4fingers.com.sg/menu](https://www.4fingers.com.sg/menu) |
| 4627 | `4Fingers Singapore` | *NULL* | *NULL* | 12PCS BONELESS CHICKEN BITES | [https://www.4fingers.com.sg/menu](https://www.4fingers.com.sg/menu) |
| 4628 | `4Fingers Singapore` | *NULL* | *NULL* | 18PCS BONELESS CHICKEN BITES | [https://www.4fingers.com.sg/menu](https://www.4fingers.com.sg/menu) |
| 4629 | `4Fingers Singapore` | *NULL* | *NULL* | 3PCS CHICKEN TENDERS | [https://www.4fingers.com.sg/menu](https://www.4fingers.com.sg/menu) |
| 4630 | `4Fingers Singapore` | *NULL* | *NULL* | 6PCS CHICKEN TENDERS | [https://www.4fingers.com.sg/menu](https://www.4fingers.com.sg/menu) |

### Category 2: SFA Licences Missing from Food Directory (8,408 Rows / 236 Unique Licences)
**Description:** The dish row specifies an SFA licence number, but that licence does not exist anywhere within the 41,563 rows of `Food Directory`. Investigation shows these represent hawker/canteen stalls within multi-stall food centres where the parent food court licence is recorded in FD, but individual stall sub-licences (e.g., `B87033P006` inside food court `B87033P000` at Blk 325 Woodlands St 32) are missing from the directory.

| Row Index | F&B Venue Name | SFA Licence | Address | Postal Code | Dish Name |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1163 | `Chateraise` | `CE15L46N000` | 350 ORCHARD ROAD #B1-00,SHAW HOUSE,Singapore 238868 | 238868 | Special Strawberry Shortcake |
| 1646 | `Bak Kut Teh` | `E74031B001` | 38 LORONG 11 GEYLANG Singapore 388730 | 388730 | Bak Kut Teh Soup Set 肉骨茶套餐 |
| 1647 | `Bak Kut Teh` | `E74031B001` | 38 LORONG 11 GEYLANG Singapore 388730 | 388730 | Bak Kut Teh Value Set for 2 两人份 |
| 1648 | `Bak Kut Teh` | `E74031B001` | 38 LORONG 11 GEYLANG Singapore 388730 | 388730 | Bak Kut Teh Value Set for 4 四人份 |
| 1649 | `Bak Kut Teh` | `E74031B001` | 38 LORONG 11 GEYLANG Singapore 388730 | 388730 | Beancurd Skin 腐竹 |
| 1650 | `Bak Kut Teh` | `E74031B001` | 38 LORONG 11 GEYLANG Singapore 388730 | 388730 | Braised Beancurd 卤豆干 |
| 1651 | `Bak Kut Teh` | `E74031B001` | 38 LORONG 11 GEYLANG Singapore 388730 | 388730 | Braised Egg卤蛋 (2 pcs) |
| 1652 | `Bak Kut Teh` | `E74031B001` | 38 LORONG 11 GEYLANG Singapore 388730 | 388730 | Braised Pig Trotter Set 卤猪脚套餐 |

### Category 3: Concatenated Multi-Outlet SFAs (165 Rows)
**Description:** Several chain brands have multiple SFA licences semicolon-delimited into a single cell (e.g., `CE23L42A000; CE22F27X000` for *DRIPS BAKERY STUDIO*, `NW15124A000; CE14K27L000` for *JUMBO SEAFOOD*). This prevents 1:1 relational joins and breaks geographic routing.

| Row Index | F&B Venue Name | SFA Licence String | Address | Postal Code | Dish Name |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1530 | `DRIPS BAKERY STUDIO` | `CE23L42A000; CE22F27X000` | *NULL* | *NULL* | Affogato |
| 1531 | `DRIPS BAKERY STUDIO` | `CE23L42A000; CE22F27X000` | *NULL* | *NULL* | Almond Croissant |
| 1532 | `DRIPS BAKERY STUDIO` | `CE23L42A000; CE22F27X000` | *NULL* | *NULL* | Angel Hair Beef Bolognaise |
| 1533 | `DRIPS BAKERY STUDIO` | `CE23L42A000; CE22F27X000` | *NULL* | *NULL* | Apple Crisp |
| 1534 | `DRIPS BAKERY STUDIO` | `CE23L42A000; CE22F27X000` | *NULL* | *NULL* | Apple Infused |
| 1535 | `DRIPS BAKERY STUDIO` | `CE23L42A000; CE22F27X000` | *NULL* | *NULL* | Artisanal Vegan Sourdough Bread |
| 1536 | `DRIPS BAKERY STUDIO` | `CE23L42A000; CE22F27X000` | *NULL* | *NULL* | Avocado |
| 1537 | `DRIPS BAKERY STUDIO` | `CE23L42A000; CE22F27X000` | *NULL* | *NULL* | Babycino |

### Category 4: Postal Code & Premise Address Parity Violations
**Description:** Dish rows where the SFA Licence matches an FD record, but the recorded 6-digit postal code or physical address string contradicts the licensed premise in `Food Directory`.

| Row Index | Venue in MP | SFA Licence | MP Postal | FD Postal | MP Address | FD Registered Premise Address |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 3624 | `Chateraise` | `SW18G14V000` | `648886` | `120727` | 1 JURONG WEST CENTRAL 2 #B1-21,JURONG POINT,Singapore 648886 | Blk 727 Clementi West Street 2, #01-240 Chang Ji Bing Jia 昌記餅家, Singapore 120727 |
| 10450 | `FENG FOOD` | `NW17783B000` | `768019` | `737737` | 1 NORTHPOINT DRIVE #B1-156,SOUTH WING OF NORTHPOINT CITY,Singapore 768019 SOUTH WING OF NORTHPOINT CITY | Woodlands Sq, 6号, SG Woods Square Mall, Feng Food B2-04 邮政编码: 737737 |
| 10532 | `FENG FOOD` | `NW17783B000` | `768019` | `737737` | 1 NORTHPOINT DRIVE #B1-156,SOUTH WING OF NORTHPOINT CITY,Singapore 768019 SOUTH WING OF NORTHPOINT CITY | Woodlands Sq, 6号, SG Woods Square Mall, Feng Food B2-04 邮政编码: 737737 |
| 10580 | `FENG FOOD` | `NW17783B000` | `768019` | `737737` | 1 NORTHPOINT DRIVE #B1-156,SOUTH WING OF NORTHPOINT CITY,Singapore 768019 SOUTH WING OF NORTHPOINT CITY | Woodlands Sq, 6号, SG Woods Square Mall, Feng Food B2-04 邮政编码: 737737 |
| 10832 | `FENG FOOD` | `NW17783B000` | `768019` | `737737` | 1 NORTHPOINT DRIVE #B1-156,SOUTH WING OF NORTHPOINT CITY,Singapore 768019 SOUTH WING OF NORTHPOINT CITY | Woodlands Sq, 6号, SG Woods Square Mall, Feng Food B2-04 邮政编码: 737737 |
| 10860 | `FENG FOOD` | `NW17783B000` | `768019` | `737737` | 1 NORTHPOINT DRIVE #B1-156,SOUTH WING OF NORTHPOINT CITY,Singapore 768019 SOUTH WING OF NORTHPOINT CITY | Woodlands Sq, 6号, SG Woods Square Mall, Feng Food B2-04 邮政编码: 737737 |
| 11019 | `FENG FOOD` | `NW17783B000` | `768019` | `737737` | 1 NORTHPOINT DRIVE #B1-156,SOUTH WING OF NORTHPOINT CITY,Singapore 768019 SOUTH WING OF NORTHPOINT CITY | Woodlands Sq, 6号, SG Woods Square Mall, Feng Food B2-04 邮政编码: 737737 |
| 11074 | `FENG FOOD` | `NW17783B000` | `768019` | `737737` | 1 NORTHPOINT DRIVE #B1-156,SOUTH WING OF NORTHPOINT CITY,Singapore 768019 SOUTH WING OF NORTHPOINT CITY | Woodlands Sq, 6号, SG Woods Square Mall, Feng Food B2-04 邮政编码: 737737 |

### Category 5: Brand / Venue Identity Token Discrepancies
**Description:** Cases where an SFA licence matches between sheets, but the venue name in `Menu & Price` has zero lexical or brand token overlap with both `F&B Name` and `Registered Business Name` in `Food Directory`. This indicates stall turnover (a new tenant took over an old licence slot) or cross-stall misattribution within a food court.

| Row Index | MP Venue Name | FD F&B Name | FD Registered Business Name | SFA Licence | Dish Item Sample |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 42688 | `46 CTK EATING HOUSE` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `W74114N000` | Char Kway Teow |
| 42689 | `46 CTK EATING HOUSE` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `W74114N000` | Chicken Satay (10 Sticks) |
| 42690 | `46 CTK EATING HOUSE` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `W74114N000` | Egg Roti Prata |
| 42691 | `46 CTK EATING HOUSE` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `W74114N000` | Hokkien Mee |
| 42692 | `46 CTK EATING HOUSE` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `W74114N000` | Ice Kachang |
| 42693 | `46 CTK EATING HOUSE` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `W74114N000` | Mee Goreng |
| 42694 | `46 CTK EATING HOUSE` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `W74114N000` | Mutton Satay (10 Sticks) |
| 42695 | `46 CTK EATING HOUSE` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `Chun Tat Kee 881 XO Fish Head Beehoon 骏達记香港街珍达记` | `W74114N000` | Nasi Lemak |

### Category 6: Menu Source URL Misalignment
**Description:** The Menu Source URL points to a completely different vendor, chain, or unrelated brand slug on Foodpanda/GrabFood, indicating aggregator scraper bleed across adjacent stalls.

| Row Index | MP Venue Name | Menu Source URL | Dish Item Sample |
| :--- | :--- | :--- | :--- |
| 13 | `Yong Yun Pte. Ltd.` | [https://www.foodpanda.sg/restaurant/ljck/man-li-seafood-wan-li-hai-xian-ang-mo-kio-avenue-3](https://www.foodpanda.sg/restaurant/ljck/man-li-seafood-wan-li-hai-xian-ang-mo-kio-avenue-3) | Black Pepper Venison 黑椒鹿肉 |
| 77 | `Yong Yun Pte. Ltd.` | [https://www.foodpanda.sg/restaurant/ljck/man-li-seafood-wan-li-hai-xian-ang-mo-kio-avenue-3](https://www.foodpanda.sg/restaurant/ljck/man-li-seafood-wan-li-hai-xian-ang-mo-kio-avenue-3) | Plain Rice 白饭 |
| 120 | `Yong Yun Pte. Ltd.` | [https://www.foodpanda.sg/restaurant/ljck/man-li-seafood-wan-li-hai-xian-ang-mo-kio-avenue-3](https://www.foodpanda.sg/restaurant/ljck/man-li-seafood-wan-li-hai-xian-ang-mo-kio-avenue-3) | Sunny Egg 荷包蛋 |
| 397 | `Home Cook Pte Ltd` | [https://food.grab.com/sg/en/restaurant/king-omar-pasir-ris-pasir-ris-drive-3-delivery/4-C732EP5VG62BHA](https://food.grab.com/sg/en/restaurant/king-omar-pasir-ris-pasir-ris-drive-3-delivery/4-C732EP5VG62BHA) | Tulang Merah |
| 1720 | `SLOPPY SHACK` | [https://food.grab.com/sg/en/restaurant/magic-wok-kinex-delivery/SGDD00771](https://food.grab.com/sg/en/restaurant/magic-wok-kinex-delivery/SGDD00771) | 1. Hor Fun (Gravy) |
| 1721 | `SLOPPY SHACK` | [https://food.grab.com/sg/en/restaurant/magic-wok-kinex-delivery/SGDD00771](https://food.grab.com/sg/en/restaurant/magic-wok-kinex-delivery/SGDD00771) | 101. Chicken Chop |
| 1722 | `SLOPPY SHACK` | [https://food.grab.com/sg/en/restaurant/magic-wok-kinex-delivery/SGDD00771](https://food.grab.com/sg/en/restaurant/magic-wok-kinex-delivery/SGDD00771) | 103. Chicken Bolognese Spaghetti |
| 1723 | `SLOPPY SHACK` | [https://food.grab.com/sg/en/restaurant/magic-wok-kinex-delivery/SGDD00771](https://food.grab.com/sg/en/restaurant/magic-wok-kinex-delivery/SGDD00771) | 104. Beef Bolognese Spaghetti |

---

## 3. Systematic Root-Cause Analysis

1. **Chain Brand Menu Aggregation without Outlet Disaggregation:** 2,407 rows originated from central corporate menu crawls (*Polar Puffs & Cakes*, *Saizeriya*, *KFC*, *Din Tai Fung*). They were placed into `Menu & Price` without duplicating/distributing the dishes across the brand's individual outlet SFA licences in `Food Directory`.
2. **Hawker Centre / Food Court Sub-licence Hierarchy:** SFA issues master licences to food court operators (e.g. `B87033P000`) and individual sub-licences to stalls (e.g. `B87033P001` through `B87033P010`). The `Food Directory` sheet is missing 236 stall sub-licences (affecting 8,408 dish rows), despite having the master food court premise registered.
3. **Licence Reuse & Stall Churn:** SFA stall licences are frequently reassigned when a hawker changes. Some menu rows reflect prior or succeeding tenants whose names conflict with the snapshot recorded in `Food Directory`.
4. **Delimited Licence Strings:** Aggregation scripts concatenated multiple branch licences using semicolons instead of normalizing each menu dish to a single outlet venue ID.

---

## 4. Remediation Action Plan

| Priority | Action Item | Target Rows / Scope | Implementation Strategy |
| :--- | :--- | :--- | :--- |
| **P0** | **Disaggregate Multi-Outlet Chain Menus** | 2,407 rows with `None` SFA + 165 rows with `;` SFAs | Map chain brand names to all active outlet SFA licences in `Food Directory` via `Venue ID` crosswalk. Clone dish rows with exact outlet addresses and postal codes. |
| **P0** | **Ingest Missing Stall Sub-licences into Food Directory** | 8,408 dish rows (236 SFAs) | Backfill missing hawker/food-court stall licences into `Food Directory` using the master premise address and postal code already in `Menu & Price`. |
| **P1** | **Remediate Postal & Address Drift** | Postal & address mismatch rows | Align dish row address strings directly from the validated `Food Directory` premise records where SFA matches. |
| **P1** | **Resolve Tenant Churn & Brand Token Discrepancies** | Brand name token discrepancy rows | Cross-check against SFA live registry: update `Food Directory` if tenant changed, or update `Menu & Price` if old menu was erroneously scraped. |
| **P2** | **Sanitize Scraper Menu Source URLs** | Misaligned source URLs | Flag and clear third-party aggregator URLs whose slugs mismatch the stall brand. |

---
*Generated by Hungry Data Audit Agent on 2026-11-09.*
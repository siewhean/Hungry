# Partner-platform permission audit for Refresh112

- Checked: 2026-10-18
- Reference workbook: `data/Hungry F&B Database.Public Access 2026-10-17 Verified Menu Catalogue Refresh 40.xlsx`
- Reference SHA-256: `ba519451ef5fa46aafcac14d67a1563365e6a15601c1ddc778d71ac20a960ef1`
- Scope: official public terms and partner documentation for Grab, foodpanda, and Oddle. No marketplace pages were scraped, and no account, partner portal, or API was accessed. No workbook was modified.

## Finding

No zero-cost, generally permissioned partner API or merchant tool was found that permits Hungry to persist and commercially display a Singapore-wide aggregation of third-party restaurants' menu, image, or outlet data. The partner tools reviewed are designed for a participating merchant (or its authorized technology integrator) to manage that merchant's own catalog and outlets. Being granted a merchant login or integration token does not authorize collection or redistribution of other merchants' platform records.

## Platform findings

### Grab

- The [Singapore GrabMerchant agreement](https://www.grab.com/sg/terms-policies/grab-merchant-terms-and-conditions/) §§5.3.1, 11.2–11.3 and 11.6–11.9 covers merchant-supplied content and grants Grab the license to use it for the marketplace/Grab business. It does not grant the merchant or a third-party directory a reciprocal right to copy Grab's platform presentation or data. §11.8 limits merchant use of platform data/software to performing the agreement and prohibits sale, licensing, publication, or other commercial exploitation. §11.9 prohibits replicating platform content and restricts linking absent approval, apart from a factual, truthful plain-text link.
- The [Grab SG consumer terms](https://www.grab.com/sg/terms-policies/transport-delivery-logistics/) §§3.1.12–3.1.13 prohibit commercial directory compilation from platform content, reproducing reviews for republication, and scraping absent a legal exception.
- [GrabMerchant](https://merchant.grab.com/) describes portal-based store/menu/photo/address management. No public SG menu export API or third-party directory license was found in the reviewed official materials.
- **Use decision:** do not ingest platform listings, images, menus, ratings, or outlet records. A merchant can supply its own original menu/facts directly to Hungry under a separate written license; get Grab's written permission before extracting or reusing any content/data sourced from Grab itself.

### foodpanda

- The official [Delivery Hero / foodpanda Partner API documentation](https://developer.foodpanda.com/en/documentation/api-partner-api-overview) describes catalog, price/availability and outlet-operation integrations. Integration setup requires partner status, Partner Portal access, integration-plugin access, and credentials from the portal or account manager ([catalog prerequisites](https://developer.foodpanda.com/en/documentation/catalog-api-how-to-integrate)). The general developer site says restaurant partners should use separate restaurant-specific documentation at [integration.foodpanda.com](https://integration.foodpanda.com/); that endpoint exposed no readable public documentation in this review.
- The docs describe synchronizing a vendor's own products/catalog and stores. They do not publish a third-party directory license, persistent redistribution grant, or zero-cost commercial-use terms. No API was called; no pricing or zero-cost entitlement was confirmed.
- The [Singapore consumer terms](https://www.foodpanda.sg/contents/terms-and-conditions.htm) §4 reserves rights in platform/third-party trademarks and images and bars copying, republication, distribution, or modification without express written consent. §10.3 says menu information, photographs, and item images may be inaccurate or incomplete; any candidate fact requires independent verification even if separately licensed.
- **Use decision:** use partner API only if a merchant authorizes access for its own outlets and the agreement expressly permits Hungry's intended fields, persistence, commercial display, refresh, and image use. For third-party aggregation, require written permission from foodpanda and relevant content owners; otherwise source facts and assets directly from each merchant.

### Oddle

- The [Oddle Terms of Service](https://docs.oddle.me/general/terms-of-service/) (effective 2026-01-15) §§2 and 4 define the merchant account and merchant content, require the merchant to own or have rights to uploaded content, and place responsibility for obtaining necessary licenses and consents on the merchant. §7 covers confidentiality; §§8–9 cover data and platform IP/content restrictions. Platform content cannot be reproduced, republished, distributed, or commercially exploited without Oddle's prior express consent (§9.2). The terms state applicable fees are set by agreement (§6), so they do not establish free access.
- The [Oddle Acceptable Use Policy](https://docs.oddle.me/general/acceptable-use-policy/) (effective 2026-01-26) §§1.4, 1.10, 1.15–1.16 expressly bars creating a database by downloading/storing platform contents, scraping/data mining/crawling without prior written consent, and commercial use except where platform terms expressly permit.
- Public materials identify Eats as a marketplace product, but no public menu/venue API with commercial directory rights was found.
- **Use decision:** no harvesting of Oddle marketplace pages or content. Obtain Oddle's written permission for platform-sourced content and a separate direct merchant license for merchant-owned menu/photo assets; confirm product-specific terms and fees.

## Permission needed for third-party aggregation

For persistent commercial directory use of platform-sourced records, obtain an explicit written agreement from the platform that covers: API/source access; third-party outlet aggregation; the exact venue, menu, price, hours, rating, and image fields; database storage and refresh; public/commercial display; image copying or URL embedding; derivative normalization; attribution; retention after delisting/termination; correction/takedown handling; territory and term; and any fee. Separately secure each merchant's rights to its name, menu text, logos, and photos where those rights are not granted by the platform. Do not infer these rights from a merchant portal account, token, a menu upload license given to the platform, or public visibility.

No platform confirmed that this license is available at zero cost. Therefore this pathway does not meet a hard no-spend condition unless written confirmation specifies no fees or minimum commitments.

## Compliant no-spend path

1. Invite merchants to submit and maintain their own venue facts, menus, hours, and original media directly to Hungry; obtain a direct grant that permits commercial directory display and set an update/withdrawal process.
2. Use merchant-owned official websites or files only where their terms/license allow the intended reuse; cite the source and check date, and independently verify high-change facts.
3. Use a platform listing only as a lead to find the merchant's own public source. Do not copy platform text, ratings, images, or structured payloads into the database.
4. Keep a source/provenance field per value, and record the license or consent basis for every retained image/menu asset.

This is a source-policy assessment, not legal advice. Re-check current product-specific and account agreements before any future integration; contracts may add restrictions beyond public docs.

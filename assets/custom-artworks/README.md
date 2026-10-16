# Owner-supplied custom artwork

## Roronoa Vinny

- Canonical printed number: **OP12-020** (Roronoa Zoro).
- Custom display name: **Roronoa Vinny**.
- Original source: owner-uploaded `Carta de líder Roronoa Vinny.zip`, containing one PNG of the same name, supplied for integration on 2026-10-15.
- Bundled file: `roronoa-vinny.png`; extracted bytes are unchanged, including artwork, text, SAMPLE mark and transparency. No image was generated, retouched or recompressed.
- Original PNG SHA-256: `9bbc59e00229acbaa0d6f898e50c0f4e608550380b393900efa9be1ecbddeefd`.
- Registry: `src/domain/custom-artworks.ts`; seeded immutable catalog/canonical identity: migration `20261015000200_roronoa_vinny.sql`.
- Rules/reference metadata was verified from the documented OPTCG API base-printing endpoint `/api/sets/card/OP12-020/` on 2026-10-15; source dataset date was 2026-10-14. The migration copies the base's rules/facts into the custom printing, changing only its name, image association and provenance. The provider's original artwork is referenced by URL rather than copied here.
- Served through the authenticated, no-store `/api/custom-artworks/roronoa-vinny/image` route. Next output tracing includes this PNG for server deployments. All signed-in app accounts can select the curated shared artwork, while decks/matches remain private under RLS.
- Custom art has no verified independent market quote. Original-printing prices/history must not be presented as a price/history for this artwork.

## Rocks D. Bermejo

- Canonical printed number: **OP17-039** (Rocks.D.Xebec).
- Custom display name: **Rocks D. Bermejo**.
- Original source: owner-uploaded `RocksBermejo.zip`, containing `RocksBermejo.png`. Extracted unchanged to `rocks-d-bermejo.png`; no generation, retouching or recompression.
- Original PNG SHA-256: `1636d28918caabe53ee36e1ed1543322000df2a8b8f8eef55481f5b80d7d08b6`.
- Registry: `src/domain/custom-artworks.ts`; additive migration: `20261016000100_rocks_bermejo.sql`.
- OP17-039 base leader metadata verified from the documented OPTCG API `/api/sets/card/OP17-039/` endpoint on 2026-10-16; source dataset date 2026-10-16. Only public metadata was fetched. The official image is referenced by URL and not bundled. Leader counter is not applicable; the custom printing copies all facts from its canonical base.
- Authenticated image route: `/api/custom-artworks/rocks-d-bermejo/image`, with the same no-store, allowlisted-path and shared-read/private-deck boundaries as Vinny. Custom artwork has no independent market quote/history.

## Artwork variants and the separate original fan edition

Vinny and Bermejo remain variants of OP12-020 and OP17-039 under their original expansions. They are not members of **LEGENDARIA BANDA DE LOS DIOSES PIRATAS**; that edition contains separately supplied original fan creations, starting with Vin D. Ny. Custom-detail views still show only the enlarged original artwork. Internal canonical facts remain available for deck validation; no costs, effects or prices are rendered alongside the enlarged custom card.

## Vin D. Ny, el DJ del Caos

- Original fan card supplied directly as a JPEG attachment on 2026-10-16; bundled as `vin-d-ny.jpg` (916 × 1280, 623,200 bytes). The supplied bytes are unchanged, including printed text, display number and artwork. No generation, retouching, format conversion or recompression occurred.
- SHA-256: `29077766c5a6acf8c36fd5ddbda71ff6bfc1ab1d2bfaa6a6a6a262d7245fa375`.
- Edition: **LEGENDARIA BANDA DE LOS DIOSES PIRATAS**; display label **OP-001**, read from the supplied image. This is not an official playing code or a reprint of either custom leader.
- Separate registry: `src/domain/fan-cards.ts`; Supabase display catalog seeded by `20261016000200_fan_cards.sql`. No official base identity, game facts or market data are assigned. Only the name, display number, explicit edition and artwork reference are persisted.
- Served as `image/jpeg` via authenticated no-store `/api/custom-artworks/vin-d-ny/image`, using a fixed registry filename. Included in deployment output tracing. Accessible from the fan edition gallery in Cartas and builder/editor; the popup contains only the enlarged supplied image and close control. The builder does not add this display-only card to a standard deck.

## Mario D. Bestia, el Destructor

- Original fan card supplied directly as a JPEG attachment on 2026-10-16; bundled as `mario-d-bestia.jpg` (912 × 1280, 513,196 bytes). The supplied bytes are unchanged, including all artwork, printed text and display label. No generation, retouching, conversion or recompression occurred.
- SHA-256: `ead25b5c18669c8bc3fb096178351f7912375a42e587795cbbd058a1ae05773f`.
- Edition: **LEGENDARIA BANDA DE LOS DIOSES PIRATAS**; display label **LDP-002**, read from the supplied image. It remains independent of playable official cards and the two custom leader variants.
- Registry: `src/domain/fan-cards.ts`; additive data-only migration: `20261016000300_mario_d_bestia.sql`. Only name, display number, edition and registered artwork reference are added. No gameplay facts or prices are assigned.
- Served as `image/jpeg` through authenticated no-store `/api/custom-artworks/mario-d-bestia/image`. The existing gallery and image-only popup work in Cartas and the builder/editor; file tracing includes this JPEG through the existing asset glob.

## Aar D. On, el Dios de la Guerra

- Original fan card supplied directly as a JPEG attachment on 2026-10-16; bundled as `aar-d-on.jpg` (914 × 1280, 512,860 bytes). The supplied bytes are unchanged; no generation, retouching, conversion or recompression occurred.
- SHA-256: `76afefb98640beac8de80bf9625c30f392a458b78dda257edc7a9e783713a752`.
- Edition: **LEGENDARIA BANDA DE LOS DIOSES PIRATAS**; display label **LDP-003**, visible on the supplied artwork. This is an independent display-only fan card, not an official card or a playable leader variant.
- Registry: `src/domain/fan-cards.ts`; additive data-only migration: `20261016000400_aar_d_on.sql`. Persists only the supplied name, printed display label, edition and registered artwork reference. No gameplay facts or prices are assigned.
- Authenticated image route: `/api/custom-artworks/aar-d-on/image`, preserving JPEG content type and private/no-store/nosniff. The existing gallery provides search and image-only enlargement in Cartas and builder/editor; Next file tracing includes the original JPEG through the existing glob.

## Christian D. Bermejo, el Verdugo del Eclipse

- Original fan card supplied directly as a JPEG attachment on 2026-10-16; bundled as `christian-d-bermejo.jpg` (960 × 1280, 554,223 bytes). All supplied bytes, printed text and image proportions are preserved. No generation, retouching, conversion or recompression occurred.
- SHA-256: `bbbf2b8aec4434eb7dad1e93d11f28c1ea0eefb53eaf53fe182d65faad4ac9be`.
- Edition: **LEGENDARIA BANDA DE LOS DIOSES PIRATAS**; display label **LDP-004**, visible on the supplied artwork. This independent original fan card is separate from the **Rocks D. Bermejo (OP17-039)** playable leader artwork variant.
- Registry: `src/domain/fan-cards.ts`; additive data-only migration: `20261016000500_christian_d_bermejo.sql`. Persists only name, printed display label, edition and registered artwork reference; no gameplay facts, official canonical identity or prices are assigned.
- Authenticated image route: `/api/custom-artworks/christian-d-bermejo/image`, with original JPEG MIME type and private/no-store/nosniff. Available in the Cartas and builder/editor fan galleries with image-only enlargement. The existing Next tracing glob includes the original JPEG in production output.

## Jaime D. Dragneel, el Guardián de las Llamas

- Original fan card supplied directly as a JPEG attachment on 2026-10-16; bundled as `jaime-d-dragneel.jpg` (914 × 1280, 568,894 bytes). The supplied image, text and proportions are unchanged. No generation, retouching, conversion, cropping or recompression occurred.
- SHA-256: `954f6cfbecc41c167d449160e4760ee905c08ad50e531a4328d59475475e155a`.
- Edition: **LEGENDARIA BANDA DE LOS DIOSES PIRATAS**; display label **LDP-005**, visible on the supplied artwork. It is an independent display-only original fan card, separate from official playable cards and leader variants.
- Registry: `src/domain/fan-cards.ts`; additive data-only migration: `20261016000600_jaime_d_dragneel.sql`. Only the supplied name, printed label, edition and artwork reference are persisted; no gameplay rules or market price is assigned.
- Authenticated image route: `/api/custom-artworks/jaime-d-dragneel/image`, preserving original JPEG MIME type and private/no-store/nosniff. Existing Cartas and builder/editor galleries offer name/code search and image-only enlargement. The original JPEG is included by the existing Next output-tracing glob.

## Joan D. Cuadras, el Oráculo de los Dioses

- Original fan card supplied directly as a JPEG attachment on 2026-10-16; bundled as `joan-d-cuadras.jpg` (960 × 1280, 529,452 bytes). All supplied image bytes, background, printed text and proportions are preserved. No generation, retouching, conversion, cropping or recompression occurred.
- SHA-256: `f351f0575f7ff5d60d2d4171a01a337d56f6cbac14b55e3e293730a0b9a8b926`.
- Edition: **LEGENDARIA BANDA DE LOS DIOSES PIRATAS**; display label **LDP-006**, visible on the supplied image. This is an independent display-only original fan card, separate from official playable cards and leader variants.
- Registry: `src/domain/fan-cards.ts`; additive data-only migration: `20261016000700_joan_d_cuadras.sql`. Only name, printed display label, edition and registered artwork reference are stored. No gameplay facts, official canonical identity or price is assigned.
- Authenticated image route: `/api/custom-artworks/joan-d-cuadras/image`, preserving JPEG MIME type and private/no-store/nosniff. The existing Cartas and builder/editor fan galleries provide name/code search and image-only enlargement; the original JPEG is included by the existing Next output-tracing glob.

This records owner-supplied provenance for this app; it does not imply official affiliation or general redistribution rights for provider/franchise assets. Further playable leader variants need their own supplied file and verified base identity; original fan cards need their own supplied file and separate display-catalog identity. Both require additive catalog migrations, explicit registry entries and relevant checks. No generic image-upload or manual-card creation interface is introduced.

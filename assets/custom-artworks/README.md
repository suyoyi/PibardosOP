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

This records owner-supplied provenance for this app; it does not imply official affiliation or general redistribution rights for provider/franchise assets. Further playable leader variants need their own supplied file and verified base identity; original fan cards need their own supplied file and separate display-catalog identity. Both require additive catalog migrations, explicit registry entries and relevant checks. No generic image-upload or manual-card creation interface is introduced.

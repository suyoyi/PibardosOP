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

## Fan display collection

Both supplied cards appear in **LEGENDARIA BANDA DE LOS DIOSES PIRATAS**. This is a curated UI expansion/filter, separate from their original set metadata. Fan-detail views show only the enlarged original artwork. Internal canonical facts remain available for playing/deck validation; no costs, effects or prices are rendered alongside the enlarged fan card.

This records owner-supplied provenance for this app; it does not imply official affiliation or general redistribution rights for provider/franchise assets. Further custom artworks need their own supplied file, verified base identity, additive catalog migration, registry entry and relevant checks. No generic image-upload or manual-card creation interface is introduced.

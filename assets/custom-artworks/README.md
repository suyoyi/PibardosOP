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

This records owner-supplied provenance for this app; it does not imply official affiliation or general redistribution rights for provider/franchise assets. Further custom artworks need their own supplied file, verified base identity, additive catalog migration, registry entry and relevant checks. No generic image-upload or manual-card creation interface is introduced.

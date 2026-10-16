<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git repositories and hosted releases

- The owner selected **`suyoyi/pibardos-op` as the primary repository for all future work**. Its `main` branch deploys to Vercel. In this workspace `origin` points to `https://github.com/suyoyi/pibardos-op.git`; `original` retains `https://github.com/suyoyi/PibardosOP.git` for historical reference. This supersedes the temporary dual-publication workflow.
- For an application update authorized for publication, fetch/review the canonical `origin/main`, preserve independent work, and push the reviewed commit with `git push origin HEAD:main` without force-pushing. Verify the remote hash and actual production behavior separately. Do not require publishing future changes to the legacy repository. If a restored task attaches the old checkout/remote, preserve it as `original`, configure canonical `origin`, and inspect/fetch before editing. See `docs/FREE_DEPLOYMENT.md`.

## Owner preferences and hidden features

- Respond in Spanish. On every request for application changes, remind the owner in the response that **Mi colección**, **Lista de deseos** and **Cartas que me faltan** remain hidden, until they explicitly ask to restore or replace them.
- These features are intentionally hidden using `collectionEnabled` in `src/lib/features.ts`. Preserve their implementation, database data, ownership policies and domain/integration tests for a future redesign. Do not re-enable their links, card-detail controls or pages as part of unrelated work.
- `/collection` and `/wishlist` authenticate then redirect to `/cards` while hidden. This visibility switch does not replace authentication or RLS.

- Avoid redundant language labels in user-facing text: do not add “inglés”, “solo inglés” or EN badges to catalog/builder/card descriptions. Internal language metadata and current provider-selection rules remain unchanged.

- Keep “Catálogo parcial o con avisos” and “Importación avanzada” out of the Cartas screen. Normal catalog browsing, printing detail/save and decklist import remain available.

## Curated fan artwork presentation

- **Roronoa Vinny (OP12-020)** and **Rocks D. Bermejo (OP17-039)** are artwork variants of their original leaders and belong to their original expansions. They must not be assigned to **LEGENDARIA BANDA DE LOS DIOSES PIRATAS**. That edition contains separately supplied original fan cards, starting with **Vin D. Ny, el DJ del Caos**. Store those in the display-only `fan_cards` catalog; do not infer official playing identities or assign the two leader variants to it.
- Enlarged fan artwork views show only the supplied image, without cost, effects, price, market history or a technical detail panel. Preserve full details for ordinary provider cards. Builder artwork preview and leader selection are separate controls.
- Preserve original uploaded image bytes; register new supplied assets explicitly with provenance and additive migrations. Do not generate replacements or invent game facts/prices.

- Original fan-card alternate artworks belong to the same `fan_cards` row through `fan_card_variants`. Keep a single gallery tile/count per card; show the supplied artwork choices inside its image-only popup. Preserve the original cover/default artwork and do not create duplicate card identities when adding an alternate illustration.
- Show the original fan edition only after explicitly selecting its expansion, including when searching all cards. Cards start as concealed backs with role buttons in this order: Vin (Músico), Aar (Tirador), Mario (Luchador), Christian (Espadachín), Jaime (Navegante), Joan (Médico), Su (Capitán), each followed by “de la tripulación”. Persist discoveries per account in `fan_card_unlocks`; never reset existing discoveries, use browser storage as the authority, or reveal images before a successful save. Original and alternate fan illustrations require that account's parent-card unlock. Playable Vinny/Bermejo leader variants keep their existing presentation.

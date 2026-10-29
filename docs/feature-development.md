# Developing an admin feature

[English](feature-development.md) · [فارسی](feature-development.fa.md)

Begin at [task navigation](../.agents/navigation.json), route metadata and the owning feature. Read admitted composition and `applicationReady` from [the publication policy](../.github/bootstrap-policy.json), and commands from [the canonical manifest](../.agents/validation.json). A false readiness flag does not admit an application entry; runnable changes require genuine application evidence. Inspect the HTTP contract, permission policy and tests before editing.

Keep `src/shared` independent of app/features/layouts. Reuse Ant Design components, semantic theme tokens and direct named Lucide icons with explicit sizes/currentColor and decorative aria-hidden; the owning control supplies its accessible label. Derive types from domain or library shapes. Keep HTTP types, paths and single-feature helpers beside their owner; reuse the cross-feature profile-name limit and transport types, and validate unknown token/settings replies before state changes.

Define a named props type and a named `FC<Props>` component, using a type-only React import, as required by the canonical React rule. Ant Design tables read fields from the row record rather than the first render value. Preserve request-intent/session generations, cancellation, manual read retry and mutation guards. A single eligible protected401 replay after successful same-generation refresh is distinct from manual read retry.

Route/access metadata lives in `src/app/config/routes.ts` and `src/app/lib`; the separate API still authorizes every action. Maintain genuine translations in all ten flat catalogs with the same 111 root string messages and interpolation. Reuse a semantic key per locale, remove superseded aliases and never replace missing content with runtime English fallback. API metadata owns active language, direction and calendar; browser storage owns theme/compact only.

Test at the smallest meaningful layer and add accessible Storybook states where appropriate. Synthetic component and HTTP tests do not establish full application or real-provider journeys. Update corresponding English/Persian documentation and a consequential ADR when warranted. Follow [validation](validation.md), [React rules](../.agents/rules/react.md) and [type rules](../.agents/rules/typescript.md); run the complete gate before an authorized commit or PR handoff.

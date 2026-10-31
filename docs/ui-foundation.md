# UI foundation

[English](ui-foundation.md) · [فارسی](ui-foundation.fa.md)

This foundation owns reusable Ant Design widgets, theme and compact preferences, route-back behavior, local assets and optional error/performance adapters. Core providers, business modules and isolated Storybook build/browser checks build on these owners.

Read the [publication policy](../.github/bootstrap-policy.json) for the current phase, admitted composition and `applicationReady`, and the [full gate](../.agents/validation.json) for required evidence. While readiness is false, module and workshop tests do not establish a runnable panel. Application admission requires genuine build, browser and human-reviewed visual checks; UI ownership stays unchanged.

The [appearance contract](../src/shared/contracts/appearance.ts) alone owns Theme,
the seven palette fields and derived wire types. The Ant Design adapter consumes
that vocabulary and derives accessible display tokens; it does not redefine the
contract or infer server language metadata. Compact and theme preferences are the
only browser-storage keys. The API still owns active language, direction, calendar
and names; there is no visitor language preference.
Preference getters validate stored values before using them: only dark/light and
actual booleans are accepted, with safe defaults for malformed local data.
Denied storage access also falls back safely. Failed preference writes warn and
return without interrupting the caller; invalid serialization still throws.

Components use named props types and named `FC<Props>` annotations with type-only React imports. Shared widgets own
digits/OTP inputs, password confirmation, form drawers, request feedback, loading
and the React error boundary. Use the real Ant Design controls and semantic labels.
The route-back hook uses React Router; it does not define application routes.
The digits input keeps controlled and uncontrolled display values numeric while
preserving Ant Design change-event metadata for form consumers.
An explicitly required OTP field has a localized accessible description, appended
to existing help without applying unsupported `aria-required` to the group. Its
real inputs, value handling and other accessibility metadata remain intact.
Request feedback contains rejected or throwing retry callbacks while retaining
the visible error and the retry action.
The [request lifecycle](request-lifecycle.md) retains its reviewed committed-resource
and session-generation guards.

Optional observability receives an explicit transport endpoint or injected sink.
It sanitizes sensitive event fields and reports standard Web Vitals without metric
IDs, URLs or DOM entries. Tests use synthetic sinks, disable environment-file
discovery and set a blank reporting endpoint. Observer registration mocks establish
callback behavior; they do not establish real browser or field performance.
Error-context inspection is bounded and handles cycles without invoking accessors;
reporting failures cannot replace the application's original error.

Vazirmatn is self-hosted with its original SIL Open Font License. The required unit
suite decodes the actual WOFF2 bytes using dev-only Fontkit, verifies the family,
100–900 weight-axis metadata, Persian/Latin cmap and default glyph outlines, and
checks license identity, exact hashes, CSS font references and safe self-contained
SVGs. The stylesheet retains visible keyboard focus and reduced-motion behavior.
These static checks do not prove browser loading or interpolation at every font
weight. The real font-loading browser journey ([`e2e/font.spec.ts`](../e2e/font.spec.ts))
is part of the manifest's required `application-e2e` check.

Reduced-motion rules require the admin `#root` or Storybook `#storybook-root`,
include document scrolling and portals outside that root, and stay reactive to
preference changes. Their root specificity overrides Ant Design's generated
motion classes without `!important` declarations.

The full [canonical manifest](../.agents/validation.json) remains mandatory on every
PR. Coverage includes every published production module. React/jsdom tests cover
widget actions and RTL feedback, theme contrast, local preferences and Router
hooks. The full gate now also requires Storybook build and browser/a11y verification.
Neither static/jsdom nor isolated component-browser results substitute for
separately executed application build, browser journeys or applicable visual and
performance verification. The manifest owns their current profiles and responsibilities.

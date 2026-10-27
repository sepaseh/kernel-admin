# UI foundation

[English](ui-foundation.md) · [فارسی](ui-foundation.fa.md)

The `ui-foundation` phase publishes reusable Ant Design widgets, the theme adapter,
compact/theme preferences, route-back behavior, optional error/performance reporting
and local visual assets. Later publications add Core providers, business screens
and [Storybook verification](storybook-verification.md), including static workshop
build and real Chromium play/accessibility checks. The application entry point and
App/Routes composition remain future work. `applicationReady` remains false; see the
[publication gate](bootstrap.md).

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

Components have explicit parameter types, with no FC aliases. Shared widgets own
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
These checks do not prove browser loading or interpolation at every font weight;
the real font-loading browser journey belongs to the later runnable panel gate.

Reduced-motion rules require the admin `#root` or Storybook `#storybook-root`,
include document scrolling and portals outside that root, and stay reactive to
preference changes. Their root specificity overrides Ant Design's generated
motion classes without `!important` declarations.

The full [canonical manifest](../.agents/validation.json) remains mandatory on every
PR. Coverage includes every published production module. React/jsdom tests cover
widget actions and RTL feedback, theme contrast, local preferences and Router
hooks. The full gate now also requires Storybook build and browser/a11y verification.
Neither static/jsdom nor isolated component-browser results substitute for the later
nineteen-check application gate, production panel build, complete E2E or visual validation.

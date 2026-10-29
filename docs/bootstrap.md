# Application publication scope

[English](bootstrap.md) · [فارسی](bootstrap.fa.md)

The application-verification phase declares applicationReady: true in [the publication policy](../.github/bootstrap-policy.json). It admits src/main.tsx, App/Routes composition and Vite/build/browser/contract configuration beside every inherited HTTP, catalog, provider, business and Storybook module. The separate API remains outside this repository. A phase declaration describes admitted source; actual execution, visual approval and deployment must be recorded separately.

The exact inventory rejects undeclared source, missing required files, private paths and symbolic links. Its size is separate from the 100-file limit on each PR's actual GitHub diff. Ordinary root node_modules, coverage and application dist are generated output; they are not publication files. Historical Win32 image bytes and review dates remain history. New comparison images must retain their own matching provenance and actual human review.

Use [the canonical manifest](../.agents/validation.json), [.nvmrc](../.nvmrc) and its bundled npm. In a fresh independent export of the exact final tree, run npm ci, npm run browser:install and npm run validate -- full. All nineteen required checks run without changed-path selection, duplication, advisory substitution or weaker thresholds. Both measured LCOV reports must come from that same snapshot.

CI and scanner run the same unconditional full command after installation. Windows check/build/e2e/visual jobs have real commands and pinned checkout/Node setup; the checkout must retain the PR's default revision. The scanner performs analysis after the full gate, and its asynchronous provider quality gate is separate evidence. Read [branch protection](branch-protection.md) before changing required remote contexts: source configuration alone does not install protection.

Application E2E and consumer-contract fixtures use synthetic HTTP data and own their processes, ports and outputs. They do not verify the separate API provider or authorize production traffic. Visual comparison requires actual human-approved images for the exact environment and source. Lighthouse measures the isolated synthetic authentication page. [Deployment](deployment.md), TLS, target smoke checks and independent operator workflows remain separate authorized operation.

Read [Contributing](../CONTRIBUTING.md), [validation](validation.md), [testing](testing.md), [architecture](architecture.md) and [the source map](source-navigation.md). Current-head CodeRabbit approval, resolved conversations, native checks and a complete zero-unresolved Sonar report remain merge requirements.

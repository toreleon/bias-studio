# Creator-to-recipient beta strategy

Decision date: **2026-11-17**. This document selects what to test; it does not report pilot results or certify deployment. See the [direct competitors](research/direct-competitors.md), [platform competitors](research/platform-competitors.md), [baseline product audit](research/product-audit.md) and [independent strategy challenge](research/strategy-challenge.md) for evidence, sources and limitations.

## Product and target

**Turn your favorite moments into a reaction pack—and build a reusable library for your fandom.**

Start with repeat international K-pop fan editors/admins who already create and circulate packs, plus separate recipients who use WhatsApp or Telegram. Countries and languages are cohort attributes to learn from, not a claim that all international fandoms behave alike.

Build a **mobile creator workspace with a small supporting web/backend service**. Mobile gives creators access to source media and the native WhatsApp handoff. Web gives recipients anonymous previews and platform-appropriate onward links. The backend supports explicit publishing, owner isolation, Telegram sets and durable generation accounting. This is an architectural decision; willingness to use or pay for it remains unproven.

The unit of value is a useful pack that another person can actually send, followed by a second pack that requires less creator effort. The acceptance scenario is create → save → close/reopen → share → recipient add/send → create a second independent pack by reusing assets/styles.

## Research changes the competitive claim

Official evidence already describes native pack creation/sharing in WhatsApp and Telegram, public creator/pack distribution at Sticker.ly and Sticker Maker, and prompt/photo-to-pack creation with supported messaging export in ChatGPT. Sticker.ly's terms describe generative services. AI cutout, AI image generation and AI search/classification are different capabilities; an AI label does not identify a model vendor.

WhatsApp's November 5, 2026 Stickers Terms also describe a creator/discovery service. Those terms do not establish current regional onboarding or an integration API. LINE demonstrates a mature creation/review/distribution/payment loop; it does not validate Bias Studio subscriptions or demand for paid idol packs. Details and dated links are in the research reports.

Consequently, **generation, captions, cutouts, basic packs, credit and a public link are baseline capabilities, not a moat**. Competitor documentation is not hands-on quality evidence, and absence from a feature page is not evidence of absence.

| Hypothesis to test | What would support it | What would challenge it |
| --- | --- | --- |
| Authentic multi-moment creation is useful | Creators retain recognizable frames and complete useful sets with less repair than their current method | They need only single reactions, or selection/repair outweighs the batch benefit |
| A reusable library compounds value | Second-pack effort falls while output remains useful, and creators reuse without coaching | Faster performance is explained only by practice or research assistance |
| Recipient sharing creates a useful loop | Real recipients add and send stickers, then some voluntarily return for another collection | Preview interest stops at the app/install handoff |
| Optional AI improves the result | Sample approval and selective retry increase retained output per unit of effort/cost | Stylization loses the moment's expression or requires repeated expensive corrections |
| Existing fan channels can bootstrap distribution | Participating admins choose to share useful collections through their own channels | Credit/link features are ignored or recipients prefer existing catalogs |

No hypothesis establishes demand, retention, willingness to pay, exclusivity or network effects yet. Local libraries are valuable to their owners; they are not automatically proprietary training data. Portability should remain useful, rather than creating switching costs through data lock-in.

## Scope in priority order

### P0: dependable receiving and safe operation

1. Publish only an explicitly selected **finished-render snapshot**, with collection identity and chosen creator credit, to an anonymous HTTPS preview. Drafts, source media, masks, prompts, private tags and editable documents stay private. Editable archives remain a separate, clearly labeled option. Unpublish controls the Bias page; it cannot recall downloaded or already shared copies.
2. Produce a real Telegram sticker set through authenticated creator-to-Telegram ownership linking, reconcile uncertain remote results, and expose an install link only after the set is verified. Page publication, set creation and recipient addition are separate states.
3. Preserve the actual native WhatsApp handoff and destination constraints. A public browser page should route to supported native handling or give accurate instructions. App absence, cancellation, unsupported platforms and rejection need recoverable states. A successful launch/share/download is not installation.
4. Require authenticated, owner-isolated generation with durable jobs, idempotent recovery, per-creator limits and a global spending allowance. Reserve conservatively before a paid call. Estimated reservations enforce admission; they are not receipts for billed cost. Unknown outcomes must not trigger an automatic duplicate paid attempt.
5. Preserve existing packs, migrations, autosaved drafts and independent library reuse. Retain CI/release gates and label mock-provider tests, native compilation and physical-device observations separately.

### P1: reduce repeated creator work

Support multiple photos and still frames with timestamps; batch fonts/outlines/colors/caption placement; per-sticker repair and undo; editable reaction presets; optional fandom/member/era/emotion organization; and reusable styles/assets. Preserve the first pack when reusing its contents in another.

Keep authentic expressions on the shortest path. Offer AI redraw deliberately, with reference/recipe reuse, one sample for approval before a larger batch, individual retries and captions editable without another generation charge. Only offer animation when its complete destination-specific pipeline actually works.

### Defer

Broad social feeds, marketplace, subscriptions, teams, a custom model and more destination integrations. Snapchat content sharing must not be described as reusable chat-pack installation. Do not build follower mechanics before observing repeat creator-to-recipient behavior.

## Pilot and decision gates

The [pilot protocol](PILOT.md) uses roughly 10 creators and 20 separate recipients, two creation occasions, a comparison with creators' existing tools, and an optional unprompted observation window. This is exploratory learning, not a powered efficacy study.

Predeclare targets before recruitment: no observed source leaks or lost drafts in required checks; a directional 25% median reduction in second-pack active effort against the usual workflow at comparable usefulness; and at least 90% unassisted recipient add-and-send success among explicitly supported tested routes. These are proposed product decisions, not established industry benchmarks. Report exact counts, individual outcomes and failures by platform. Review voluntary return descriptively; a scheduled second task is not retention.

Do not invite an external cohort until the selected HTTPS service, account setup, quota persistence and supported device routes are verified. Local tests and deployment preparation should proceed without being mislabeled as a live beta. Remaining hosting, signing, access, cost and device requirements belong in the deployment and verification documents.

If recipients cannot use the pack, fix distribution before expanding creator features. If the second pack is not easier, investigate selection, repair and reuse before adding a feed. If optional AI has low retained-output yield, preserve the authentic workflow and narrow the AI offer. Pricing requires a later concrete offer after dependable use, not a hypothetical-interest survey.

## Evidence status

This strategy synthesizes official documentary research and the repository audit at baseline commit `d9bfdecf122be00bc597b8abb29ba34bfb80013f`. That audit found a substantial local workspace but missing public distribution/Telegram and durable generation infrastructure at that baseline. Implementation after the audit must be assessed against current verification results; this document deliberately does not treat planned fixes as already shipped. No participant results or market outcomes were collected in preparing this strategy.

# A workspace for repeat fandom creators

**Turn your favorite moments into a reaction pack—and build a reusable library for your fandom.**

Bias Studio targets repeat K-pop fan creators/admins and separate recipients on WhatsApp or Telegram. It combines a mobile creator workspace with a supporting distribution/generation backend. The implemented beta is not yet a deployed public service; [BETA-VERIFICATION.md](BETA-VERIFICATION.md) records actual checks and remaining device/access requirements.

## Workflow

Home → import photos/video → select multiple still moments → batch style → refine individual reactions → preview in chat → share finished renders or use a supported destination. Naming and credit can wait until sharing. Drafts autosave locally. Library snapshots, saved styles and optional fandom/member/era/emotion tags support independent reuse across packs. Existing v1/v2 work is preserved through migration; flattened old stickers keep their pixels without inventing lost editing layers.

Authentic expressions are the shortest path. Optional AI creation follows subject/reference → look/reactions → one sample → explicit approval → selected results → editable pack. An approved sample can be reused as a consistency reference; it is not a guaranteed identity lock. Individual variations are separate requests. Captions remain editable without generating another image. Saved recipes and stable request records support later reuse/recovery.

## Sharing choices and privacy

| Choice | What leaves the device | What success means |
| --- | --- | --- |
| Save draft/library | Nothing through the sharing service | Local persistence completed; no recipient distribution |
| Share finished pack file | Final sticker images, collection name/identity and creator credit | ZIP prepared/downloaded/shared; recipient can import into Bias Studio |
| Share editable backup | Images including originals/cutouts, editable designs, captions, tags, timestamps and creation metadata | Explicit portable authoring copy; not installation |
| Publish collection page | Validated finished renders, public collection credit and the disclosed creator account label | Anonymous page available on the configured service; not installed or sent |
| WhatsApp | Final native export snapshot | WhatsApp handoff opened; user must confirm Add and test sending |
| Telegram | Finished images/credit plus linked owner identity required by the Bot API | Destination set verified; recipient must add/send in Telegram |
| Generate with AI | Explicit description/reference to the private service and provider | Job result available; not necessarily accepted or kept |

Public collection pages, finished downloads, creator ownership, explicit publish/unpublish and native receive links are implemented. Changed cloud content becomes private until republished; identical saves preserve its current state. Publishing and Telegram export require the reviewed revision, rejecting stale confirmation if another session changes it. Public pages display the chosen pack credit and the creator account label disclosed at confirmation; use a suitable public pseudonym for the account. Public access is limited to the selected rendered snapshot. Unpublishing closes the Bias page/image/download routes; it cannot recall downloaded copies or independently created Telegram sets. A public link is not a permission boundary against people forwarding it.

Telegram ownership linking uses a short-lived bot-start nonce and verified webhook. The real adapter verifies a set before exposing its link and reconciles uncertain attempts. It still needs a real configured bot and end-to-end recipient validation. WhatsApp requires the native app; browser downloads and generic shares do not install packs. iMessage and Snapchat actions are not implemented. Animated output is not offered.

## Beta account and generation behavior

An operator-issued creator invite exchanges for an expiring session. The app keeps the session in memory, not in recipes or portable files; users reconnect after restart. Draft editing does not require an account. Owner-only jobs and cloud packs are stored in private SQLite; this is not cloud synchronization of the editable library.

Generation requests reserve configured daily allowance durably before admission, use stable request IDs, and can be recovered after a lost response. Pausing monitoring does not cancel server work. Cancellation, server interruption and timeout can still incur provider cost; uncertain paid work is not retried automatically. A new variation deliberately creates a new attempt. Request and result retention is described in [GENERATION-SETUP.md](GENERATION-SETUP.md).

The default beta provider model is `gpt-image-2.6-sunburst`. Actual billed cost, likeness and usable-output yield need separate measurement. The service's reservation estimates are not billing receipts; [PILOT.md](PILOT.md) defines reconciliation and counts each unique kept generated output once across reuse.

## Hypotheses, not market claims

| Hypothesis | Implemented experiment | Evidence to collect |
| --- | --- | --- |
| Whole-pack creation matters | Multi-photo/frame selection, batch styling, refinement and preview | Import-to-usable-pack time, completion and correction burden |
| Reuse makes the second pack easier | Independent editable assets, saved styles, captions and timestamps | Second-pack active effort against the creator's current tool, with practice/order recorded |
| Fandom organization helps retrieval | Optional tags, search and emotion filtering | Retrieval time, maintained tags and search failures |
| Distribution turns creation into use | Rendered-only pages/downloads, Telegram adapter, native WhatsApp handoff | Recipient add-and-send outcomes, distinguished from link clicks or set creation |
| Optional AI improves the result | Sample approval, reference reuse and selective variation | Accepted-output yield, fidelity, correction time and reconciled cost |

The [research reports](research/strategy-challenge.md) show a high baseline: packs, generation, credit and public links already exist elsewhere. None of these capabilities alone establishes a moat. Tests establish software behavior, not demand, speed, retention or willingness to pay. No general analytics or private-chat instrumentation was added; use the consent-based [pilot protocol](PILOT.md).

## Focus and remaining work

Prioritize reliable receiving, source privacy, saved-work recovery and repeated creator efficiency. Defer a broad feed, marketplace, subscriptions, teams, custom model and additional destinations. [BETA-STRATEGY.md](BETA-STRATEGY.md) explains the decision order.

Deployment still requires HTTPS hosting, a persistent private database and backups, operational retention/support, configured provider/bot secrets, signed mobile distribution and physical-device checks. These are prepared and tracked in [BETA-DEPLOYMENT.md](BETA-DEPLOYMENT.md); implementation does not imply they have been activated. Historical 1.2 live-provider observations remain in [VERIFICATION.md](VERIFICATION.md), separate from current beta evidence.

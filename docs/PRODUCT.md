# A workspace for repeat fandom creators

“Turn your favorite moments into a reaction pack—and build a reusable library for your fandom.”

The intended user repeatedly creates and shares reaction packs for a fandom, member/character, era/event or emotion. Background removal, text, video stickers and basic packs already exist elsewhere. They are supporting capabilities, not evidence of differentiation.

## Hypotheses to validate

| Hypothesis | Implemented experiment | Evidence to collect |
| --- | --- | --- |
| Making the whole pack is the valuable unit | Multi-photo/frame selection, selected batch styling, per-sticker refinement, reorder, chat preview | Completion rate and time from import to first usable shared pack; abandonment by stage |
| Reuse makes the second pack faster | Editable library, independent copies, saved styles, captions and source timestamps | Compare first/second pack creation time for the same creator; proportion of second-pack content reused; correction time |
| Fandom organization improves retrieval | Optional fandom/member/era/emotion tags, all-field search, emotion filtering | Time to find an older reaction; whether creators actually maintain tags; search failures |
| Collection distribution matters | Credit-bearing editable ZIP + native WhatsApp handoff | Recipient import success, confirmed WhatsApp installation, stickers actually sent, repeated sharing |

These are unvalidated hypotheses. The acceptance test establishes functional reuse, not market demand, user speed, willingness to pay or retention. No analytics or telemetry backend was added for the experiment; use consented observation and a small structured study first.

## Suggested validation session

Recruit creators who already make packs. Observe each making a three-to-six reaction pack from their own images or a clip, closing/reopening, then making a second pack. Let them decide which assets/styles to reuse without coaching. Record time, failed imports, corrections, unfamiliar labels, send/install outcomes and whether the reused result feels personal enough. Ask recipients to open the pack and send reactions. Repeat after a week to learn whether the library is useful beyond one session.

Avoid inferring editor demand from people sending existing stickers daily. A reasonable pilot is roughly ten creators and twenty recipients across the destinations they already use; these counts are a study proposal, not a statistical claim.

## Workflow and scope

Home → photos/video moments → pack selection/style → individual refinement → chat preview → destination handoff or pack file. Naming and attribution can wait. Drafts autosave locally; advanced tools are optional. The library is a set of editable snapshots. Reuse copies a snapshot so a new pack cannot silently change an older one.

The current destination is WhatsApp native handoff. File sharing carries the complete collection but does not install it. Telegram and iMessage can get destination adapters after protocol/device work. Snapchat integration must use its supported sharing API, without claims of reusable chat-pack installation. Animated output is not offered.

A broad feed, marketplace, proprietary AI model, subscriptions and team collaboration are intentionally deferred. No server, account system or public publishing was introduced for these flows.

## Public collection pages: infrastructure still needed

A local workspace has no persistent public hosting or cross-device identity. A credible minimal public-page service needs:

1. Creator authentication and ownership, private drafts, explicit publish/unpublish, revocable collection IDs and durable revision metadata.
2. Object storage for validated rendered stickers, manifests, tray images and thumbnails; signed uploads, size/format limits and immutable versioned assets. Original photos/editable layers should remain private unless separately shared.
3. A durable metadata store and an HTTPS preview page with collection title, creator credit, thumbnails, destination-specific install/open actions, fallback instructions, and accurate supported-platform detection.
4. A documented native/deep-link download-and-import contract. A link opening a page must not be presented as completed pack installation.
5. Rate limits, abuse reports/takedown, media rights handling, deletion/retention, monitoring and backups appropriate to public content.

Do not replace this with a device-local URL, pretend a generic image share installs a pack, or make unpublished drafts public by default. The implemented ZIP flow is the dependable local distribution path until this infrastructure exists.

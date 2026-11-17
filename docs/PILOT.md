# Bias Studio exploratory pilot protocol

Prepared **2026-11-17**. **Status: protocol only; no participants recruited or results collected.** This document supplies copyable forms and instructions. It does not authorize anyone to contact participants, publish their work, incur unapproved provider spend or launch an unverified service.

Purpose: test whether repeat K-pop creators finish useful packs with less effort and whether separate recipients can add and send them. Read [BETA-STRATEGY.md](BETA-STRATEGY.md) for scope and [research/strategy-challenge.md](research/strategy-challenge.md) for rationale and limitations.

## 1. Owner setup before recruitment

Complete this record before a participant is invited. An empty required field is an unresolved setup item.

| Field | Value to complete |
| --- | --- |
| Study owner and participant contact | |
| Candidate commit/build identifiers | |
| Verified HTTPS service and supported destination/device routes | |
| Study dates and optional observation window | |
| Approximate cohort | 10 creators and 20 separate recipients; exploratory, not statistically powered |
| Languages/countries and translation/support arrangements | |
| Payment/incentive, if any | Fixed participation amount; never tied to positive feedback or return |
| Approved total provider spending allowance | Currency, amount, approver and date |
| Per-creator allowance and conservative reservation rate/version | |
| Data access holders and deletion date | |
| Separate retention rule for requested published collections | |
| Support/incident contact and stop procedure | |

Confirm that creator accounts, owner isolation, publication/unpublication, backups, durable quotas and recovery have passed the candidate's required checks. Record physical-device add-and-send evidence for each offered route. Do not substitute mock API responses or compilation for that evidence. Use only source material participants are authorized to share; an editable archive and a public rendered pack require different choices.

## 2. Copyable screening form

Use a pseudonymous participant ID in study records. Collect a separate contact detail only if needed for scheduling, with limited access. Initial cohort: adults who can consent to participate.

```text
Participant ID:
Role: creator / recipient / both (record recipient task separately)
Age confirmation: 18 or older? yes / no
Country and preferred language:
Phone model, OS version, messaging app/version:
Primary destination: WhatsApp / Telegram
Creator: when did you last make/share a pack, and with which tools?
Creator: how many packs did you make in the last four weeks?
Creator: what upcoming event or recurring need could justify another pack?
Recipient: when did you last add a pack and send a sticker?
Existing Bias Studio experience:
Accessibility/support needs you choose to share:
Can you use material you have permission to include in this test? yes / no
```

Choose a mix of actual destination habits and device platforms. Do not infer a country's needs from one participant. Avoid recruiting only enthusiastic friends or creators who already know the interface; disclose convenience sampling.

## 3. Copyable consent record

Explain the following in the participant's preferred language. Give them the completed owner/contact/retention details before they decide. Record independent optional choices; a refusal of recording or publication is not a refusal of the core usability session.

```text
This study tests a beta sticker-making and sharing workflow. We are studying
the product, not your skill. Participation is voluntary. You may skip a task
or stop without losing the agreed participation incentive.

We will record task timings, success/failure, assistance, corrections and
feedback under a participant ID. We do not need unrelated chats, contacts,
passwords or original private media in our research notes. Any app/server
processing needed for the selected task will be explained before it starts.

Generation can change a person's appearance and may require cloud processing.
It is optional. Public publishing makes the selected finished stickers and
chosen credit accessible to anyone with the link. Unpublishing cannot recall
copies already downloaded, installed or forwarded. Editable/source sharing
is a different action and is not required for recipient testing.

Study contact: [complete]
Who can access the research data: [complete]
Deletion date and withdrawal method: [complete]
Requested published collection retention/unpublish plan: [complete]

I consent to this usability session and the described study notes: yes / no
Optional screen recording (hide unrelated notifications/chats): yes / no
Optional AI task after its processing explanation: yes / no
Optional public rendered-pack task after previewing its contents: yes / no
Optional anonymous feedback quoted outside the study team: yes / no
Optional unprompted follow-up observation and end-window interview: yes / no
Participant ID, date and consent recorder:
```

If someone declines public publishing, use a consented study fixture or stop that task and label it not attempted; do not count it as product failure or successful public sharing. Explain how their chosen study notes can be removed before anonymized aggregation, and any practical limits afterward. Collect no original sources, prompts or conversation contents in analytics by default.

## 4. Creator task cards and comparison

Use two similarly difficult source sets and a common brief, for example **six static reactions** that remain readable at chat size. Counterbalance the order of Bias Studio and the creator's usual tool on the first occasion. On a later occasion use new comparable material and allow each tool its normal saved-work reuse. Record tool familiarity, order, practice and any inequivalence. Do not disable an incumbent's reuse features to favor Bias.

**Occasion 1, task A:** “Using these permitted photos or video moments, make six reactions useful to your fandom. Choose your own captions and style. Finish when you would share the pack.” Start timing at import, not after selection. Allow the participant to name it later. Ask them to close/reopen, verify the draft, then preview and explicitly choose whether to share finished renders. If testing AI, first approve or reject one sample; do not require it for the authentic-media comparison.

**Occasion 1, task B:** Run the comparable brief in the other tool with the other source set. Record the source-to-tool assignment. Separate active effort from loading/generation time. Stop at the predefined session limit if necessary and record unfinished output rather than excluding it.

**Occasion 2:** At a later date/event, make another equivalent pack using useful saved assets/styles/captions. Confirm the earlier pack remains unchanged after editing the new one. Repeat the comparator under the recorded design. This scheduled task measures repeat-workflow usability, not voluntary return.

Moderator: observe before helping; log each hint and its timestamp. If the participant gets stuck, record the unassisted outcome first, then offer recovery so the session remains useful. Stop on source exposure, loss of existing work, unexpected charges or participant discomfort; preserve minimal diagnostic evidence without capturing private material.

### Creator session record

```text
Participant ID / occasion / task / date / build:
Tool / order / source set / previous familiarity:
Brief and expected number of reactions:
Start / completion-or-stop time:
Active minutes / waiting minutes / interruption minutes:
Selected inputs / accepted stickers / abandoned outputs:
Manual cutout repairs / caption edits / paid regeneration attempts:
Correction minutes / elective refinement minutes:
Assets, styles and captions reused in second pack:
Save/reopen result; original pack unchanged? observed / self-reported / unknown
Assistance (timestamp, problem, hint):
Final state: completed / incomplete / abandoned / not attempted
Reason and participant explanation:
```

## 5. Recipient task and evidence form

The recipient uses their own supported phone and starts from the actual collection link without a creator account. Ask: **“Look at this collection. If you want it, add it to your messaging app and send one selected sticker to the agreed study conversation.”** Do not direct them through every button. Never inspect unrelated messages or contacts. If the recipient does not want the pack, record preference separately from inability to install.

```text
Recipient ID / collection revision ID / date / build:
Device, OS, destination app/version; creator app installed? yes / no
Link opened: yes / no / unknown
Preview viewed: yes / no / unknown
Destination action tapped: yes / no / unknown
Destination opened: yes / no / unknown
Pack actually added: yes / no / unknown
Evidence for addition: observed / recipient self-report / neither
One sticker actually sent: yes / no / unknown
Evidence for sending: observed / recipient self-report / neither
Unassisted? yes / no; assistance and where required:
Elapsed time / failure stage / error wording / recovery:
Declined pack or task? reason if voluntarily offered:
Would you keep these reactions? which use case, if any?
```

Keep server set creation, link clicks and native handoff status in separate event fields. They are **not** evidence of recipient addition or sending. Screenshots/recordings require the separate consent above. Where the platform has no installation callback, use observed or clearly labeled self-reported outcomes; never silently turn unknown into success.

## 6. Optional observation window

For consenting participants, allow at least two weeks after the scheduled tasks without creation reminders. Use minimal activity records or an end-window interview. Record relevant event opportunities, outages and support contacts. Do not count scheduled sessions, incentives conditional on return or moderator reminders as voluntary return.

```text
Participant ID / observation start and end:
Relevant fandom event or need during window? yes / no / unknown
Unscheduled new pack started / finished: count and evidence type
Unscheduled asset/style reuse: count and evidence type
Recipient voluntarily sent another sticker / sought another collection:
Evidence: app event / observed / self-report / unknown
Any reminders or assistance? details
Reasons for return/non-return, if volunteered:
```

Do not instrument private destination chats. Interview recollection is useful but imperfect; label it. Distinguish creator return from recipient reuse and use an eligible, consented denominator for each.

## 7. Generation accounting: reservations are not bills

Use durable, owner-isolated jobs and idempotency keys. A retry of the same completed job should recover its result, not create another billable attempt. Record each intentional provider attempt against its logical job; never store credentials or private prompt text in the study ledger.

| Ledger field | Meaning |
| --- | --- |
| Study/job/attempt IDs and pseudonymous owner | Attribution across retries and sessions |
| Provider request ID when available | Reconciliation aid; absence does not prove no charge |
| Model/size/quality and price-table version | Basis of an estimate; retain the date |
| Durable reserved estimate | Conservative amount held before admitting work; a budget-control value |
| State/time | Reserved, submitted, succeeded, failed-before-submit, failed-after-submit, canceled, unknown, reconciled; record the actual implementation's equivalent states |
| Usage-based estimate | Estimate from available usage/rates; still not a verified bill |
| Actual billed amount and reconciliation evidence | Provider billing/export evidence, date, currency, attribution method |
| Unique output IDs and acceptance | Kept in finalized pack, rejected, sample-only or unknown; record acceptance date |

**Do not add the reservation to the billed amount for the same attempt.** A resolved attempt's reservation is replaced by its reconciled charge or released according to verified outcome. A canceled client, timeout or uncertain failure does not establish zero cost: retain the uncertainty/reservation until reconciled. Restart/retry must not reset the admission budget. Operational reservations and research economics are separate reports.

Report these three views:

1. **Committed allowance:** reconciled spend plus outstanding conservative reservations, plus any completed-but-unreconciled estimate not already represented by an outstanding reservation. Each attempt appears once. Label this a budget-control view, not actual spend. A hard operational cap also needs conservative rates and concurrency-safe admission.
2. **Provisional output cost:** reconciled billed amounts plus clearly labeled estimates for unresolved attempts, divided by unique retained generated outputs. Show the unresolved count/estimated amount and the reservation exposure separately. If no estimate is defensible, report an incomplete numerator rather than fabricated precision.
3. **Reconciled output cost:** all billed generation costs attributable to the cohort's attempts divided by unique generated outputs accepted into finalized packs. Include rejected samples, deliberate retries, failures and canceled attempts that were billed. Keep an outstanding reconciliation warning until uncertain attempts are resolved.

Count each original generated output ID **once across packs**, including a kept sample. Reusing it, duplicating it, changing a caption or rerendering a cutout does not create another generated output in the denominator. Independently regenerated outputs are distinct. If none are kept, report the spend and an **undefined** cost per retained output, not zero. Authentic source-photo stickers are a separate cohort/output category and must not dilute AI cost.

Assign failed/unknown attempts to their originating creator/session/cohort even if they produced nothing. Do not allocate them only to successful jobs or silently discard them. When provider billing is available only at an aggregate level, reconcile the total and document any allocation using usage/rate estimates; label allocated per-job costs as estimates, not directly measured charges. Isolate unrelated traffic or disclose the attribution limit. Report hosting/storage/egress and support separately, and cost per completed pack alongside output cost.

## 8. Analysis and decision record

Report exact counts, individual timing changes and denominators. Split destination/platform routes and assistance/evidence types. Treat abandonment, unknown outcomes and consent-based nonattempts distinctly. This small convenience cohort supports product learning, not population reliability, causal superiority or product–market fit.

Proposed thresholds to finalize **before** recruitment: no observed private-source leaks/lost drafts in required checks; at least 90% unassisted add-and-send success on the supported tested routes; and a directional median 25% reduction in second-pack active effort against the usual method with comparable useful output and correction burden. They are product targets, not validated benchmarks. Report failures even when an aggregate target is met. Voluntary return is descriptive; agree any expansion rule before observing it.

```text
Decision date / candidate commit / study owner:
Enrolled, completed, stopped and declined counts by role:
First/second active and elapsed times; individual paired changes:
Output usefulness, corrections and assistance:
Recipient funnel counts by route and evidence type:
Unscheduled creator return and recipient reuse; window and denominator:
Reserved estimates / reconciled billed spend / unresolved amount:
Unique kept AI outputs / provisional and reconciled output cost:
Privacy/data-loss/cost incidents and fixes:
Selection, ordering, familiarity and attribution limitations:
Decision: fix distribution / improve workflow / narrow AI / expand limited pilot
Evidence supporting that decision and next falsifiable question:
```

Do not conclude willingness to pay from compliments or hypothetical interest. A later pricing experiment needs a clear real offer, spending limits and a separate participant choice. No recruitment or external study messages were sent in creating this protocol.

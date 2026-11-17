# Mobile generative-sticker UX: research and implementation decisions

Research date: 17 November 2026. Scope: how a creator starts, provides identity/context, chooses a look, generates, evaluates, revises, saves and distributes reaction stickers on mobile. This is a source-based comparative review, not a controlled usability study or a claim that every rollout was tested on a phone.

## Evidence and confidence

- **Documented:** official help steps, product announcements, app listings and API documentation.
- **Recorded:** a third-party mobile screen-flow index. It establishes what that recording describes, not availability on every current account. Paid screen images were not accessed; publicly exposed descriptions were reviewed.
- **Inference:** a design interpretation or hypothesis to validate with creators. No conversion rates, timing, willingness to pay or retention figures are inferred from screenshots.
- Apple support pages returned HTTP 429 and the ChatGPT App Store editorial returned 404 when opened; indexed excerpts were available. Those details are lower-confidence than the accessible official help and release notes. No authenticated competitor accounts or paid subscriptions were used.

## Comparative mobile journeys

| Product | Entry and inputs | Choice and refinement | Saving and destination | Implication for Bias Studio |
| --- | --- | --- | --- | --- |
| WhatsApp | In chat: sticker tray → Create sticker → Use AI → description | Up to four results; edit the description to try again; long-press a result for text, emoji and drawing tools | Send directly; sent results enter Recents; favorites available | Keep the intent short and review options before committing. Whole-pack creation has a different goal from sending one reaction. |
| Apple Genmoji | Keyboard creation, description, optional person/photo and emoji combinations | Browse variations; selected photo guides identity even when a description conflicts | Use in messages, stickers and Tapbacks | Separate identity/reference from the reaction instruction. Make comparing variations easy. |
| ChatGPT | Mobile prompt or sticker template; idea or photo. Indexed Apple editorial describes choosing a style and remixing with emoji | Generates a set, rather than requiring every sticker to start separately | Download; add to WhatsApp/iMessage on supported devices | Complete packs and destination export already exist. A new app must demonstrate better repeated creation. |
| Snapchat | Type a chat message and use sticker search | Generates a sticker that incorporates the message text | Snapchat chat; original launch was US Snapchat+ | Reaction intent is a useful input. Avoid forcing creators to write long image prompts for everyday emotions. |
| Sticker.ly | Recorded AI dashboard has a prompt and template categories; image editor has upload, quick actions and prompt entry | Recorded templates show a preview, source thumbnail/change control and credit amount on Generate | Broader app includes pack views, creator identity and sharing | Pair a recognizable reference with a visual direction; communicate the generation commitment before upload. |
| Loomi, adjacent browser tool | One reference image, style and set-size choice | Vendor advertises a coordinated set and automatic slicing; captions may be baked in | PNGs go through another sticker app for WhatsApp | Distinguish downloadable files from native installation. Keep captions editable and avoid brittle sheet slicing. |
| Telegram, editing baseline | Photo, text, drawings and existing media | Automatic cutout plus manual erase/restore; outlines and emoji suggestions | Reusable themed sets and pack links | Manual refinement, reuse and collections are existing expectations, not evidence of novelty. |

Sources: [WhatsApp help](https://faq.whatsapp.com/959603618629670/), [Apple Genmoji guide](https://support.apple.com/en-lamr/guide/iphone/iph4e76f5667/26/ios/26), [ChatGPT release notes, 31 August 2026](https://help.openai.com/en/articles/6825453-chatgpt-release-notes), [Apple editorial, indexed excerpt](https://apps.apple.com/us/iphone/story/id6805239663), [Snap announcement](https://newsroom.snap.com/february-product-bundle), [Sticker.ly recorded flow index](https://screensdesign.com/apps/stickerly-sticker-maker/), [Loomi product description](https://loomi.live/en/chat-sticker-maker), [Telegram editor](https://telegram.org/blog/sticker-maker/).

## What the screen patterns suggest

### 1. Start from a concrete intention

A blank prompt asks users to understand image prompting before receiving value. Short subject starters, an optional reference and a separate reaction lineup reduce that burden. This is a design hypothesis, not proof that templates improve completion.

Implemented: Home → Create with AI → subject description, three editable prompt starters and an optional reference photo. No pack name or creator-credit form is required at entry. Traditional photo/video creation remains available for authentic source moments.

### 2. Reference, look and reaction are different controls

The reference says who/what should remain recognizable. The look says how to draw it. The reaction says what expression or action is useful in chat. Combining these in one prompt makes it difficult to change only one dimension.

Implemented: a saved subject/reference, four visual directions and six independently selectable reactions. Look cards are graphic direction cards, explicitly not AI-generated preview promises. The same reference and subject description are reused across requests. Identity consistency remains probabilistic; it is not a face-lock guarantee.

### 3. Make a set, but keep the unit of revision small

A single generated contact sheet risks merged characters, captions in pixels, uneven cell boundaries and unreliable extraction. Separate generation requests cost more and take longer, but provide independent results that can be retried and edited.

Implemented: one transparent PNG request per reaction, sequential progress, one-at-a-time persistence, and a 24-candidate review limit. Generate missing reactions after interruption or request another variation of a specific result. Previously accepted images are not overwritten. No automatic paid retry and no fake percentage or invented time estimate.

### 4. Reviewing is a first-class step

A result can be attractive yet unusable at chat size or unlike the reference. The selection UI should help creators reject it without losing the rest of the set.

Implemented: two-column favorite selection, a larger inspection view and editable captions. Favorites become a new pack and reusable assets. Existing individual refinement, cutout correction and realistic chat previews remain available afterward. Generated candidates are labeled AI GENERATED; externally imported images are labeled IMPORTED IMAGE because their provenance is not verified.

### 5. Reuse should include the creative instructions

A saved flattened image supports resending but not recreating a coordinated next pack. A reusable recipe can reduce repeated setup while allowing new results.

Implemented: saved recipes contain the subject description, reference, chosen look, reaction lineup and caption preference. Reuse creates a fresh creation ID with no inherited result selection. The original draft and images remain intact. Recipes are available on Home and in Library → AI recipes. Reactions can still be reused without regeneration.

### 6. Explain the network boundary when it matters

Generation introduces a different privacy boundary from local editing. A lock icon or “saved locally” label must not imply that generation never uploads images.

Implemented: drafts save locally; a pre-generation confirmation explains that the prompt and chosen reference go through the studio service to OpenAI, and each retry uses the API allowance. Only those inputs are sent—not the whole library. The mobile app receives no provider key. A pilot access code remains in memory and is not persisted. This is a controlled-pilot authentication scheme, not production user identity.

### 7. Export is part of creation

A transparent download, an opened destination and a completed installation are different outcomes. Generated assets use the existing pack pipeline, including destination validation and recovery. The app does not invent new Snapchat, Telegram or iMessage installation buttons.

## Product decision

Position the experiment as **a repeat creator's reaction studio**, with two complementary starting points:

- Original moments: photos and selected video frames, preserving authentic expressions.
- Imagined reactions: a description/reference and a reusable visual recipe, with explicit AI provenance.

The market evidence does not support claiming that background removal, styles, generation, complete packs, reuse or sharing are individually unique. The proposed advantage is lower effort across repeated packs, better fandom retrieval and dependable distribution. Those benefits need measurement.

## Validation plan

Recruit creators who already make reaction packs. Give them the same reference and six reaction intentions in Bias Studio, Sticker.ly and their preferred native messaging tool; include ChatGPT where available. Counterbalance tool order. Record the actual platform, account tier, country and app version.

Session one: create a usable multi-sticker pack and send a sticker to a recipient. Session two, on another day: create a related pack using previous work. Observe rather than coaching the reuse path.

Measure time to first acceptable result, complete pack and confirmed install/send; rejected results; number of retries; likeness corrections; caption corrections; cost per accepted sticker; successful reopening; proportion reused; and second-session setup time. Ask whether original moments or synthesized expressions better serve their fandom. Do not treat an automated end-to-end test as evidence of user preference.

Unresolved research: reference fidelity across poses and skin tones, multilingual short captions, generation cost/latency under real network conditions, whether users prefer fewer initial candidates, and willingness to maintain fandom tags. No competitor backend reverse engineering was performed.

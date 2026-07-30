---
name: YouNotes
description: A self-hosted note wall that changes its light, not its colours - warm paper by day, a lit room by night.
colors:
  canvas-day: "oklch(96% 0.015 84)"
  canvas-day-raised: "oklch(97.6% 0.011 84)"
  canvas-day-high: "oklch(99.2% 0.006 84)"
  rule-day: "oklch(87% 0.018 80)"
  ink-day: "oklch(26% 0.02 72)"
  ink-day-soft: "oklch(50% 0.02 72)"
  canvas-night: "oklch(17% 0.012 265)"
  canvas-night-recessed: "oklch(13% 0.014 265)"
  canvas-night-raised: "oklch(21% 0.012 265)"
  rule-night: "oklch(30% 0.018 265)"
  ink-night: "oklch(93% 0.006 250)"
  ink-night-soft: "oklch(68% 0.01 250)"
  amber-day: "oklch(54% 0.15 80)"
  amber-night: "oklch(80% 0.17 75)"
  ember-day: "oklch(55% 0.165 38)"
  ember-night: "oklch(76% 0.18 40)"
  iris-day: "oklch(52% 0.16 295)"
  iris-night: "oklch(78% 0.16 300)"
  lagoon-day: "oklch(51% 0.115 208)"
  lagoon-night: "oklch(80% 0.135 195)"
  signal-day: "oklch(51% 0.13 150)"
  signal-night: "oklch(80% 0.155 155)"
  swatch-base-day: "oklch(98.6% 0.009 84)"
  swatch-warm-day: "oklch(95.6% 0.062 88)"
  swatch-hot-day: "oklch(94.6% 0.056 32)"
  swatch-cool-day: "oklch(94.6% 0.05 150)"
  swatch-deep-day: "oklch(94.6% 0.048 300)"
  swatch-bright-day: "oklch(95% 0.045 228)"
  swatch-base-night: "oklch(74% 0.05 250)"
  swatch-warm-night: "oklch(82% 0.16 78)"
  swatch-hot-night: "oklch(72% 0.2 20)"
  swatch-cool-night: "oklch(80% 0.16 160)"
  swatch-deep-night: "oklch(72% 0.2 300)"
  swatch-bright-night: "oklch(82% 0.16 205)"
typography:
  title:
    fontFamily: "Bricolage Grotesque Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.04rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Work Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.855rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Work Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.1em"
rounded:
  card: "16px"
  control: "10px"
  pill: "999px"
spacing:
  gap: "0.85rem"
  gap-compact: "0.6rem"
  card-pad: "0.9rem 1rem 0.85rem"
  card-pad-compact: "0.65rem 0.75rem 0.6rem"
components:
  card:
    backgroundColor: "{colors.swatch-base-day}"
    textColor: "{colors.ink-day}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  chip-label:
    backgroundColor: "{colors.rule-day}"
    textColor: "{colors.ink-day}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  rail-item-active:
    backgroundColor: "{colors.amber-day}"
    textColor: "{colors.canvas-day-high}"
    rounded: "{rounded.control}"
    padding: "7px 10px"
  button-icon:
    textColor: "{colors.ink-day-soft}"
    rounded: "{rounded.control}"
    size: "44px"
  fab:
    backgroundColor: "{colors.amber-day}"
    textColor: "{colors.canvas-day-high}"
    rounded: "{rounded.pill}"
    size: "56px"
---

# Design System: YouNotes

## Overview

**Creative North Star: "Day desk, night shop"**

One desk, photographed twice: mid-morning with the window open, and at midnight with the lamp on.
The product does not invert into a dark theme, it changes its light.
By day the canvas is warm parchment and notes are soft tinted paper with hairline edges.
By night the canvas is a near-black room and each note's colour stops being pigment and becomes a neon edge, chip and glow around it.
What makes this one product rather than two is that the skeleton never moves: identical 16px corners, one type system, one spacing rhythm, one motion contract in both themes.
The theme toggle should read as dusk falling on a room you already know, not as a different app.

The wall is the product.
Notes are scanned, not read one at a time, so colour is an index rather than decoration - a person finds a note again by remembering it was the green one.
Density is generous by default because capture is hurried and the feed is glanceable, with a compact mode for people who want more wall at once.
The one thing that is never negotiable: neon carries identity, state, chrome and edges, and never running text.
Saturated glow behind body copy causes halation, is worst for readers with astigmatism, and fights the colour-blind commitment in PRODUCT.md.
Notes get read at length, often in bed.

Confirmed rejections: this is not Keep's corporate Material, and it is not the near-monochrome productivity-tool opposite.
It refuses both the pastel-tint-on-white card the category always ships and the neon-on-everything treatment that makes dark themes unreadable.

**Key Characteristics:**

- One skeleton, two lights - geometry, type and motion are theme-invariant
- Colour is an index, not decoration; six note identities carry across both themes
- Neon is chrome, never running text
- Warm neutrals by day (hue ~72-84), cool neutrals by night (hue ~250-265)
- Generous by default, compact by choice
- Calm motion: overdamped, no bounce, nothing that draws the eye away from text

## Colors

A warm parchment neutral by day and a cool near-black by night, with a single accent for chrome and six note identities that reinterpret themselves as pigment or as light depending on the hour.

### Primary

- **Lamplight Amber** (`{colors.amber-day}` / `{colors.amber-night}`): The default accent and the brand's one voice. Used strictly for chrome: the brand mark, the active rail item, the capture FAB, and the focus ring. The hue is held at 75-80deg across both themes so the accent changes its light with everything else rather than becoming a different colour at night. The day value is a deep gold and the night value a bright one; the day tone was resolved to `oklch(54% 0.15 80)` - see The Two-Constraint Rule below for why it cannot simply be brightened.

### Secondary

Four alternate accents, user-selectable under the customisability commitment. Each is a drop-in replacement for the accent role only; none of them ever colours a note.

- **Ember** (`{colors.ember-day}` / `{colors.ember-night}`): Warm brick to coral.
- **Iris** (`{colors.iris-day}` / `{colors.iris-night}`): Violet to lilac.
- **Lagoon** (`{colors.lagoon-day}` / `{colors.lagoon-night}`): Deep teal to cyan.
- **Signal** (`{colors.signal-day}` / `{colors.signal-night}`): Forest to mint.

### Tertiary

The six note identities. These are the per-note and per-label colours, and they are the only colours that touch a card.
By day each is a soft tint flooding the card surface with a slightly deeper edge.
By night the same identity survives as a single neon value that drives the card's border, chip fill, chip text and outer glow, while the card surface stays near-black (a 7% mix into the night canvas).

- **Base** (`{colors.swatch-base-day}` / `{colors.swatch-base-night}`): The uncoloured note. Neutral paper by day, a cool blue-grey edge by night.
- **Warm** (`{colors.swatch-warm-day}` / `{colors.swatch-warm-night}`): Amber.
- **Hot** (`{colors.swatch-hot-day}` / `{colors.swatch-hot-night}`): Red.
- **Cool** (`{colors.swatch-cool-day}` / `{colors.swatch-cool-night}`): Green.
- **Deep** (`{colors.swatch-deep-day}` / `{colors.swatch-deep-night}`): Violet.
- **Bright** (`{colors.swatch-bright-day}` / `{colors.swatch-bright-night}`): Blue.

### Neutral

- **Parchment** (`{colors.canvas-day}`, raised `{colors.canvas-day-raised}`, highest `{colors.canvas-day-high}`): The day canvas and its two lifted surfaces. Warm, hue 84.
- **Room** (`{colors.canvas-night}`, recessed `{colors.canvas-night-recessed}`, raised `{colors.canvas-night-raised}`): The night canvas. Cool, hue 265. Note that night recesses *darker* to sink a surface where day raises *lighter* - depth reverses with the light, geometry does not.
- **Rule** (`{colors.rule-day}` / `{colors.rule-night}`): Hairline borders and dividers.
- **Ink** (`{colors.ink-day}` / `{colors.ink-night}`), **Ink Soft** (`{colors.ink-day-soft}` / `{colors.ink-night-soft}`): Body and secondary text. Near-neutral in both themes by design.

### Named Rules

**The Neon-Is-Chrome Rule.** Colour may touch a card's border, chip, glow and edge. It may never touch the title or body text. In the night theme card text is pinned to `{colors.ink-night}` and `{colors.ink-night-soft}` regardless of the note's identity colour. Audit test: set a card to Hot and screenshot the night theme - if any word of the note changed colour, it is wrong.

**The One Accent Rule.** Exactly one accent is live at a time and it appears only on chrome: brand mark, active rail item, FAB, focus ring. A screen showing the accent on a card, a chip, or a body link is wrong. Accent and note colour are allowed to land on the same hue (Signal next to a green note) - they are told apart by *placement*, never by hue, so never introduce a rule that depends on them differing.

**The Two-Constraint Rule.** An accent has to clear **two** independent contrast floors, and they pull in opposite directions in the day theme:

1. **4.5:1 against its own on-accent text** (WCAG 1.4.3), so the label inside a filled pill is readable.
2. **3:1 against the canvas behind it** (WCAG 1.4.11, non-text contrast), so the pill's *shape* reads as a button at all.

The original day amber `oklch(58% 0.14 68)` sat in the dead zone between them and failed the first at 4.27:1 with white text and 4.11:1 with dark text - it was too mid-toned for either.

Brightening it to a yellow-amber is the intuitive fix and it *does* solve constraint 1 spectacularly (`oklch(82% 0.16 85)` with dark text measures 10.24:1). But it fails constraint 2 at **1.58:1 against the parchment canvas** - the pill dissolves into the background and stops reading as a button. Verified on the wall: the dark label inside still looks fine, which is exactly what makes this failure easy to miss in a screenshot.

The night theme has no such tension, because a bright accent on a near-black room clears both trivially (10.82:1 against canvas, 10.15:1 on text). **This is the measured justification for the "changes its light" thesis:** the day accent must be deep and the night accent bright, because the canvas underneath them is inverted.

Resolved day tone: **`oklch(54% 0.15 80)`** - the hue moved from 68 to 80 so it reads as gold rather than brown, while the lightness stays low enough to hold its edge. Measures 4.96:1 on white text and 4.55:1 against the canvas. Signal (`oklch(51% 0.13 150)`) also passes both (5.24 / 4.81) and remains available as an accent choice, but amber stays the default because it carries the lamplight metaphor.

Audit test for any new accent: measure it against **both** its on-accent text and its canvas, in **both** themes. Four numbers, all of them above their floor.

## Typography

**Display Font:** Bricolage Grotesque Variable (with `ui-sans-serif, system-ui, sans-serif`)
**Body Font:** Work Sans Variable (with `ui-sans-serif, system-ui, sans-serif`)

**Character:** A tight, slightly eccentric grotesque for titles against a calm, wide-aperture workhorse for body.
Bricolage's negative tracking and heavy display weight give a note title the density of something handwritten in a hurry; Work Sans then gets out of the way so the note itself reads at length.

### Hierarchy

- **Title** (700, `1.04rem`, 1.2, `-0.015em`): Note card titles and section headings. Drops to `0.94rem` in compact density.
  Optical sizing is *not* on, and the lab's claim that it was has been corrected: the shipped Bricolage cut is the `wght`-only variable file, which carries no `opsz` axis, so `font-optical-sizing: auto` was always a no-op. The three-axis cut is 131KB for the Latin subset against 41KB, and its optical-size axis defaults to 14 against our 16.6px title - the difference is not visible and the weight is not worth it.
- **Body** (400, `0.855rem`, ~1.45): Note excerpts, checklist rows, all running text. Drops to `0.8rem` in compact density.
- **Label** (500, `0.6875rem`, `0.1em`, uppercase): Tag chips, media kind badges, relative time, section eyebrows.

### Named Rules

**The Fallback-Survives Rule.** Bricolage covers Latin including Czech, Polish, Turkish, Vietnamese and German, all of which render natively and correctly. Greek, Cyrillic, Japanese and Arabic fall back to the system face, because a webfont covering them would cost tens of megabytes and a self-hosted PWA cannot accept that. Verified on the wall: the fallback reads as *a different language*, not as broken - but the fallback faces do not carry Bricolage's tight tracking and heavy display weight, so a Greek or Cyrillic title sits visibly lower in the hierarchy than a Latin one at the same declared 700. Therefore hierarchy must never rest on the display face alone: size, weight and colour must each carry enough of the difference that a title still reads as a title in the fallback face. Audit test: render a Cyrillic title next to a Latin one and confirm the Cyrillic still reads as the most important thing on its card.

**The Label Floor Rule.** Uppercase tracked labels are set at `0.6875rem` (11px). Do not go below it. The prototype rendered metadata at 9.92px, which is too small to scan on a phone even at a measured 7.45:1 contrast.

**The RTL Title Rule.** Card titles carry `dir="auto"`, so an Arabic or Hebrew title correctly flows right-to-left inside an otherwise LTR card. The card's own footer (chip left, time right) deliberately does not flip, so the wall's controls stay where the rest of the wall put them.

## Layout

The feed has exactly **two layouts**, and the user switches between them from the topbar.

**Masonry** is the default and the identity-carrying one: a column-packed wall where each card drops into whichever column is currently shortest, in document order.
This is measured and placed in JS, not in CSS, and the reason is worth recording - CSS `columns` reads top-to-bottom per column, which puts note 2 below note 1 instead of beside it and wrecks tab order, and `grid-template-rows: masonry` is not something a self-hosted PWA can depend on across browsers.
Measuring in JS keeps DOM order equal to reading order, so cards stay ordinary focusable list items.
Columns are `minmax(216px, 1fr)`, auto-filled. Gap is `{spacing.gap}`, tightening to `{spacing.gap-compact}` in compact density.

**Stack** is the alternative: every card takes the **full container width** and sits directly below the previous one, one per row.
It is the reading layout rather than the scanning layout - a longer note gets its full measure instead of being squeezed into a 216px column, and a person working down a list in order is not asked to track two columns at once.
It is also the honest fallback when measurement is unavailable, because it needs no JS placement at all.

Card content does not change between the layouts. The same anatomy, the same caps on labels and attachments, the same footer. Only the width and the placement change.

**Responsive behavior** is driven by a container query on the app shell, not a media query, so the shell behaves the same whether it is the whole viewport or a panel.
Below **46rem (736px)** the persistent left rail is hidden and the feed drops to `minmax(10rem, 1fr)`.
The rail's destinations must be reachable from a drawer at that width - the prototype simply hides them, which is a prototype gap, not a design decision. The real shell already solves this with its Sheet drawer.

Mobile is the primary device, so the scarce axis is horizontal. Any card anatomy that spends horizontal space to hold controls is spending the wrong axis.

### Named Rules

**The Reading-Order Rule.** DOM order is always reading order. Any packing algorithm that reorders the DOM to achieve a tighter wall is rejected, however good it looks.

**The 44px Touch Rule.** Every interactive control is at least 44x44px in touch mode. The prototype currently fails this everywhere except the FAB - pin is 27px, card and topbar action buttons are 30px, and checklist boxes are 15px. Padding may be invisible, but it must be there. This is the second thing to fix in the redesign.

**The Two-Layouts Rule.** Masonry and Stack are the complete set. Do not add a third feed mode, and do not let either one grow its own card variant - a card that looks different in Stack than in Masonry means the anatomy is wrong, not that Stack needs a special case.

**The Layout-Switch Is Animated Rule.** Switching between Masonry and Stack **animates**: every card travels from its old slot to its new one rather than the wall re-rendering underneath the user. The layout toggle is direct manipulation exactly like pinning, and it is the more dramatic of the two, so it is the one that most needs continuity - a card the user was looking at must remain trackable by eye all the way to its new position.

Implementation shape: both layouts resolve to per-card `x`/`y`/`width` targets, and the switch is a change of target rather than a change of rendering strategy. Stack's targets are trivially computable (`x: 0`, full width, `y` accumulating), so it can go through the same placement path as Masonry instead of being a separate CSS branch. This matters for two reasons: it keeps the two modes from drifting apart, and a mode that renders through a different code path cannot animate into the one that doesn't.

Cards also change **width** in this transition, not just position, which the pin reflow never does. Width is the expensive property to animate - a naive width animation reflows text on every frame. Animate a transform where possible and accept a single reflow at the end, or measure both layouts up front and interpolate between two known widths.

## Elevation & Depth

Depth is **material, and it reverses with the light**.

By day the system is a soft-shadow one: a hairline `1px` border plus a barely-there drop shadow (`0 1px 2px oklch(40% 0.03 70 / 0.09)`) lifts a card off the parchment, deepening to `0 10px 26px .../0.16` on hover. Surfaces get *lighter* to come forward.

By night shadow stops working, because a black shadow on a near-black room is invisible. Depth is carried by **glow** instead: a card's identity colour emits `0 0 18px -4px` at 60% mix, and surfaces get *darker* to recede (the recessed night canvas is darker than the base, where the raised day canvas is lighter than the base). Hover intensifies the glow to `0 0 34px -6px` at 72%.

This is the one place the two themes legitimately diverge in mechanism, and it is why the theme toggle reads as a change of light rather than a change of product.

### Shadow Vocabulary

- **Rest, day** (`0 1px 2px oklch(40% 0.03 70 / 0.09)`): Every card and raised surface at rest.
- **Hover, day** (`0 10px 26px oklch(40% 0.03 70 / 0.16)`): Card hover, FAB.
- **Rest, night** (`0 2px 6px oklch(0% 0 0 / 0.5)` + identity glow): Every card at rest.
- **Hover, night** (`0 14px 32px oklch(0% 0 0 / 0.6)` + `0 0 34px -6px` identity glow): Card hover.
- **Pinned, night** (`0 0 26px -5px` identity glow at 80%, border at full identity): Pinned state.

### Named Rules

**The Glow-Is-Night-Only Rule.** Glow never appears in the day theme; shadow never carries depth in the night theme. A card that glows on parchment looks like a bug, and a card relying on a drop shadow at midnight looks flat.

## Shapes

One corner radius across the entire system: **16px on cards and containers** (`{rounded.card}`), **10px on controls** (`{rounded.control}`), **999px on chips and the FAB** (`{rounded.pill}`).
The radius is identical in both themes and is the single strongest signal that day and night are the same skeleton.

Borders are always hairline (`1px`). By day the border is a slightly deepened version of the card's own tint; by night it is the card's identity colour at 52% mix, rising to full identity when pinned.
There is no second border weight and no dashed or dotted variant - a chip that needs to read as incomplete (an overflow `+N`) should differ by fill, not by border style.

Focus is a `2px` solid outline in the accent colour at `2px` offset, on every focusable element, in both themes.

## Components

### Cards

The signature component and the whole product surface.

- **Corner Style:** 16px (`{rounded.card}`)
- **Background:** The note's identity colour - a flooding tint by day, a near-black 7% mix by night
- **Border:** 1px, identity-derived; full identity colour when pinned
- **Shadow Strategy:** See Elevation - shadow by day, glow by night
- **Internal Padding:** `{spacing.card-pad}`, tightening to `{spacing.card-pad-compact}` in compact density
- **Hover:** The surface layer scales to 1.02 and the border warms toward the accent by 12%; a lift of 0 to -5px may be applied to the whole card

**The Scale-The-Surface-Never-The-Text Rule.** A hover scale is applied to a dedicated surface layer carrying only background, border, shadow and texture. The content layer never scales. Chrome rasterises text once at its pre-transform size and then bitmap-stretches it, so scaling a layer that contains text visibly blurs the card. This is already load-bearing in the implementation and must not be undone.

### Card anatomy

Five anatomies were built and reviewed on the wall. **Foot rail (A) is the direction**: actions bottom-right revealed on hover, pin top-right, both always visible on touch, and the label row reserves space for them so nothing jumps.

The other four were each tested and rejected, and the reasons are recorded so they are not re-proposed:

- **Header bar (B) - rejected.** Nothing is hover-dependent, which is genuinely attractive, but as built the pin and the action strip stack into two separate rows and cost **~66px of chrome above the content of every card**, measured. On a plain text note that is more chrome than note. Only reconsider if pin and actions share one row.
- **Side gutter (C) - rejected.** Spends horizontal space, which is the scarce axis on a phone, and puts four always-visible icons down the left of every card, making the wall visually noisy.
- **Media led (D) - rejected as built.** Best-looking with photos, but the overlaid title collides with the media kind badge and the duration badge on **every** media card (four collisions measured in one viewport). Also has no answer for text-only notes, which lose the hero and break the wall's rhythm. Would need the media badges moved to the top of the media block.
- **Footer sheet (E) - the runner-up.** Cleanest wall by a clear margin, chrome-free at rest. Its cost is that on touch the lip must be permanently open or every action costs an extra tap. Worth revisiting if the wall ever feels too busy.

**The Pin-Is-Always-In-Front Rule.** The pin is never occluded, never hover-revealed, and never dependent on what is underneath it. It sits above every other layer of the card - media, scrim, overlaid title, action strip - in both layouts and in both themes, and it is always visible at rest on touch. It therefore carries its own backing: a filled circle in the card's surface colour with the pin glyph on top, so it reads against a white photo, a black video thumbnail and a flooded colour card alike. A pin that is legible only because the attachment behind it happens to be light is not backed, it is lucky.

The same backing requirement extends to any other control that can land on an attachment, but the pin is the one that must be *unconditionally* in front, because it is the only control that also communicates state.

Measured on the current build, **7 of 11 cards place an unbacked pin over media**, which disappears against a dark video thumbnail. This applies to the chosen Foot rail anatomy too, not just the rejected ones.

### Chips

- **Style:** Pill (`{rounded.pill}`), `{typography.label}`, uppercase. By day a 48% mix of the card's edge colour; by night an 18% mix of the identity colour with the identity colour as text.
- **Overflow:** Labels cap at three, then a `+N` chip. The `+N` chip differs by fill, never by a dashed border.
- **Media badges:** Same chip form, used for attachment kind and duration.

### Buttons

- **Shape:** 10px (`{rounded.control}`) for icon buttons, pill for the FAB
- **Icon buttons:** Ink-soft at rest, full ink on hover, with a 9% ink wash behind them and a small drop shadow by day; by night the wash and glow take the identity colour on cards and the accent colour on chrome
- **Hover:** A scale of 1.02-1.06 *and* a material change, always both. The material change is what survives reduced motion, where the scale is switched off and would otherwise leave no affordance at all.
- **Focus:** 2px accent outline at 2px offset

### FAB (quick capture)

The primary capture control and the most important button on a phone.

- **Shape:** Pill, 56px minimum (currently 48px, which passes the touch floor but should be larger for the primary action)
- **Fill:** Accent, with on-accent icon

**Known defect - the FAB must be filled.** The prototype's FAB has **no background fill in either theme**: only a drop shadow by day and an amber glow by night. Its icon is perfectly legible (13.5:1 against every surface it can float over), so this is not a contrast problem - it is a *shape* problem. A shadow conveys depth but not a boundary, so the primary capture control reads as a glyph floating on the feed rather than as a button, and it gives the thumb no visible edge to aim at. It is also the only piece of chrome that does not carry the accent, in a system where carrying the accent is what marks something as chrome.

Fill it with the accent and put the on-accent colour on the glyph, exactly like the active rail item. The shadow stays, as depth on top of a shape rather than as a substitute for one.

### Navigation (rail)

- **Style:** Vertical list of icon+label rows, 10px radius, above a labels section listing every tag with its identity-coloured dot
- **Active:** Filled with the accent, text in on-accent
- **Idle:** Ink-soft, no fill
- **Mobile:** Hidden below 46rem; destinations move into a drawer

The label dots in the day theme are noticeably paler than their night counterparts and should be checked against the colour-blind commitment - a dot is the only carrier of a label's identity in the rail, so it cannot be the weakest element on the surface.

### Motion

One contract for the whole system.

- **Springs are overdamped.** The card spring (stiffness 180, damping 34, mass 0.9) has a damping ratio of ~1.34, so nothing in the system overshoots or bounces. Measured on the wall: a card reflowing travelled 84px with **0px of overshoot**. This is correct for a wall of text and should be preserved - a bouncing note wall is nauseating to read.
- **Reflow.** Pinning a card re-packs the wall and every displaced card animates to its new slot rather than jumping.
- **Reduced motion** is a hard killswitch: all animation and transition are disabled, and every hover that used scale must still change material.

**The Direct-Manipulation Rule.** Pinning is direct manipulation and must respond on the same frame. **This is a required fix, not an observation - the implementation does not ship until the first frame of movement lands within one frame (~16ms) of the click.**

Measured on the current build it does not: after the click, **the first frame does not arrive for 115ms, then a 47ms frame gap, then the card jumps 21px discontinuously** before the spring takes over and glides the remaining 63px. On screen that reads as "nothing, nothing, snap, glide".

The cause is a double measure pass in the masonry hook. Its `ResizeObserver` effect lists the `measure` callback in its dependencies, so every re-pack tears the observer down and re-observes every node, which fires a second measurement with corrected heights one frame late - and that late correction is the 21px jump. Fix by giving the observer a lifecycle independent of the `measure` identity (observe once, call the latest `measure` through a ref), so a re-pack produces exactly one placement pass.

Acceptance test for the fix: instrument the click, sample `requestAnimationFrame`, and confirm the first frame shows non-zero movement and that no single frame moves the card more than the spring's own step. Both conditions, not just the first.

**The reflow transition must actually be wired.** The transition is expressed as `{ layout: { duration, ease } }`, but the packed feed sets `layout={false}` and animates `x`/`y` directly, so that transition never applies and the wall silently falls back to Motion's default spring. It works only in the row-based feed. This means the reflow feel of the *default* layout was never actually chosen - the value in the config and the motion on screen are unrelated. Fix the wiring first, then pick the value deliberately, then re-measure. The same trap applies to the Masonry-to-Stack transition, which travels much further and will expose it more obviously.

## Do's and Don'ts

### Do:

- **Do** keep the skeleton theme-invariant: 16px corners, one type scale, one spacing rhythm, one motion contract. Only the light changes.
- **Do** let the note's identity colour drive the card's border, chip and glow, and stop there.
- **Do** hold the accent hue steady across themes and change only its lightness, so the toggle reads as dusk.
- **Do** scale a dedicated surface layer on hover and never the layer holding text.
- **Do** pair every motion affordance with a material change, so reduced motion still communicates state.
- **Do** give every control that can land on media its own backing.
- **Do** keep DOM order equal to reading order in the packed wall.
- **Do** hold metadata labels at 11px (`0.6875rem`) or larger.
- **Do** measure a new accent four ways - against its on-accent text (4.5:1) *and* against its canvas (3:1), in both themes.
- **Do** keep the pin above every other layer of the card, with its own filled backing, in both layouts and both themes.
- **Do** animate the Masonry-to-Stack switch, resolving both layouts through the same placement path so they can interpolate.
- **Do** fill the FAB with the accent; a shadow is depth, not a shape.

### Don't:

- **Don't** put neon, glow or any saturated identity colour behind or on running text. This is the system's single hardest rule.
- **Don't** let the accent appear anywhere but chrome - brand mark, active rail item, FAB, focus ring.
- **Don't** write a rule that depends on the accent and a note colour being different hues; they are told apart by placement.
- **Don't** use glow in the day theme or rely on drop shadow for depth in the night theme.
- **Don't** spend horizontal space on card chrome - it is the scarce axis on a phone.
- **Don't** introduce a second border weight or a dashed border to signal an incomplete chip; differ by fill.
- **Don't** ship a touch target under 44x44px.
- **Don't** let a hover-revealed control be the only way to reach an action, because on touch it does not exist.
- **Don't** add a webfont to cover Greek, Cyrillic, CJK or Arabic; fall back to the system face and make sure hierarchy survives without the display face.
- **Don't** let the wall overshoot or bounce when it re-packs.
- **Don't** brighten the day accent to fix its text contrast - it dissolves into the parchment canvas. Day is deep, night is bright, because the canvas is inverted.
- **Don't** add a third feed layout, or let Masonry and Stack grow separate card variants.
- **Don't** render Stack through a different code path than Masonry; a layout that renders differently cannot animate into one that doesn't.

---
name: Thotsakan Statistics
description: A calm, light statistics lab where every number sits next to the formula that made it.
colors:
  ground: "#f0f4f9"
  surface: "#fcfdff"
  inset: "#f4f7fb"
  field: "#ffffff"
  row-tint: "#eaeef5"
  line: "#d6dbe4"
  line-strong: "#68758d"
  ink: "#151d2b"
  ink-muted: "#434d61"
  ink-faint: "#5d677b"
  accent: "#1d49a0"
  accent-hover: "#08307f"
  action: "#315bc0"
  action-ink: "#ffffff"
  q-data: "#4b55c9"
  q-data-fill: "#d3d6f5"
  q-mean: "#1565c0"
  q-median: "#0b7a45"
  q-deviation: "#9a5800"
  q-prediction: "#b4235a"
  q-kde: "#8136b5"
  q-normal: "#b54a0b"
  good: "#00673f"
  warn: "#8a5300"
  error: "#a92227"
  il-pale: "#dfe6f7"
  il-medium: "#a9bbe9"
  il-primary: "#4b55c9"
  il-ink: "#1d49a0"
typography:
  display:
    fontFamily: "IBM Plex Sans Thai, Segoe UI, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "IBM Plex Sans Thai, Segoe UI, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "IBM Plex Sans Thai, Segoe UI, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "IBM Plex Sans Thai, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Sans Thai, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.43
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "10px"
  slide: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "32px"
  button-secondary:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "32px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "32px"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "32px"
  topic-slide:
    backgroundColor: "#e3eaf9"
    textColor: "{colors.ink}"
    rounded: "{rounded.slide}"
    width: "760px"
    height: "440px"
  rail:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink-muted}"
    width: "48px"
  rail-open:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    width: "48px"
---

# Design System: Thotsakan Statistics

## Overview

**Creative North Star: "The Formula Lab"**

Thotsakan Statistics is a light, calm lab for first-year engineering students. The interface keeps out of the way of the numbers. Inputs sit on a grey bench, the inset panel. Results are printed on white, the surface. The two never trade places, so a glance says "change this" or "read this". Every result can open its formula, which is the product's promise made visible.

The palette is pale and cool blue, with one strong blue for actions. Colour carries meaning: each statistical quantity owns one hue, and keeps it across tables and plots on the same tab. Density is compact, with a 14 px root, 32 px controls and a 48 px top bar. The aim is that one screen holds the inputs, a table and a plot at once.

The brand lives at the edges: the painted Thotsakan mask is large on the front page and a soft watermark in the top bar. The working area stays plain.

**Key Characteristics:**
- Inputs on the grey bench, results on the white surface, always.
- One colour per statistical quantity, the same in the table and the plot.
- Flat surfaces that lift only for the thing in focus.
- Compact density, with Large and Projector text sizes for class.
- Flat, strokeless blue illustrations drawn from each topic's own plot.

## Colors

Cool, pale blue-greys for structure, one strong blue for action, and a fixed set of quantity hues that each mean one thing.

### Primary
- **Lab Blue** (action): every primary button and selected state, and the whole Data rail while Data is open. It appears once per region, never as decoration.
- **Deep Ink Blue** (accent): links, quiet buttons, the current-topic underline and focus rings. Its hover state is accent-hover.

### Secondary
- **Data Indigo** (q-data, with the q-data-fill tint): the data itself, meaning histogram bars, ECDF steps and points.
- **Quantity hues:**
  - mean: q-mean blue
  - median: q-median green
  - deviation: q-deviation amber
  - prediction: q-prediction rose
  - KDE: q-kde purple
  - normal model: q-normal orange, reserved for the coming goodness-of-fit test

### Neutral
- **Bench Ground** (ground): the page, the top bar and the rail.
- **Print White** (surface): the results and the front page.
- **Bench Grey** (inset): the Inputs panel.
- **Field White** (field): every box you type in or pick from.
- **Hairline** (line) and **Strong Edge** (line-strong): dividers, and the borders of fields and secondary buttons.
- **Ink** (ink), **Muted Ink** (ink-muted) and **Faint Ink** (ink-faint): text at three levels. Faint is for disabled text and placeholders only.
- **Status:** good, warn and error for state only. Red never marks data.

### Named Rules
**The One Meaning Rule.** Within a tab, a colour means one quantity. The same quantity uses the same colour in the table row, the plot line and the legend.

**The Bench and Print Rule.** Inputs sit on the bench grey (inset) and results on print white (surface). Never put a result on the bench or an input on the print.

## Typography

**Body and display font:** IBM Plex Sans Thai (with Segoe UI, then system-ui).
**Data font:** IBM Plex Mono (with ui-monospace), for the data grid only.

**Character:** one family that sets Thai and English evenly. Hierarchy comes from weight and size, never from a second display face.

### Hierarchy
- **Display** (700, 44 px, 1.05): the product name and the topic names on the front page. Nowhere else.
- **Headline** (600, 22 px, 1.25): the page title under its "Statistics ›" breadcrumb, which is the one "where am I" signal on every topic page.
- **Title** (600, 17 px): input step titles and result section titles.
- **Body** (400, 14 px, 1.5): running text, at most 70 characters per line.
- **Label** (500, 13 px): field labels, tags, legends and the "needs" lines.
- **Numbers:** tabular figures everywhere digits line up. Tables show 4 decimal places, and plot labels show 2.

### Named Rules
**The Formula Next Door Rule.** A number that has a formula shows its ƒ button on the same row. There are no orphan results.

## Layout

- **Topic pages: the bench.** From left to right: a 48 px rail with the Data tab, an optional Data panel (opens at 580 px), the Inputs panel (320 px, resizable), then the results.
  - The results content stops at 960 px and stays left-aligned.
  - Plots keep a 2:1 shape, between 200 and 480 px tall.
  - When the window narrows, the Inputs fold into the rail before the results go under 420 px.
- **The page header** sits between the top bar and the bench: a breadcrumb plus a 22 px page title. It replaces any sub-tab bar.
- **Input steps** appear in order. A step opens only when the one before it has a value, and a filled step stays open. A refresh brings back the same steps and values.
- **The front page** is a centred brand row over a peek carousel. Topic slides are 760 × 440, with the neighbours cut off at both edges, and named tabs underneath.
- **Phones (≤ 640 px):** slides fill the width minus 56 px.
- **Spacing** runs on 4, 8, 16, 24 and 32 px, with more space above a heading than below it.

## Elevation & Depth

Flat by default. Depth comes from tone: the bench grey against the print white. A soft shadow lifts only the thing in focus.

### Shadow Vocabulary
- **Focus lift** (`box-shadow: 0 14px 32px rgba(21,29,43,0.10)`): the current front-page slide.
- **Pop** (`box-shadow: 0 8px 24px rgba(21,29,43,0.16)`): popovers, menus, tooltips, the topic menu and the coach marks.
- **Control lift** (`box-shadow: 0 4px 12px rgba(21,29,43,0.12)`): the round previous/next buttons over the carousel.

### Named Rules
**The Lift on Focus Rule.** A surface is flat at rest. A shadow means "this is the one in front", so never put two lifted things side by side.

## Shapes

- **Controls:** fields, buttons and checkboxes have gently rounded corners (6 px).
- **Containers:** panels and popovers use 10 px.
- **Front-page topic slides:** the softest corner in the system (20 px). They are the only large rounded objects.
- **Pills** (999 px): chips, tags and the active carousel dot.
- **Illustrations:** flat and strokeless, with a pale circle behind and the plot shape in front.

## Components

### Buttons
- **Shape:** 6 px corners, 32 px tall at the standard text size. The front page's Open button is 44 px.
- **Primary:** Lab Blue with white text. Use one per region.
- **Secondary:** a white field with a strong-edge border (1.5 px).
- **Quiet:** text in Deep Ink Blue, with no border.
- **Hover and active:** a 6% ink overlay on hover and 12% on press. Disabled buttons turn bench grey with faint ink.

### Inputs and fields
- **Style:** a white box with a 1.5 px strong-edge border and a 6 px radius. The white box says "type here".
- **Focus:** a 2 px Deep Ink Blue outline.
- **Select placeholder:** "Pick a variable" in faint ink until something is chosen.

### Navigation
- **Top bar:** 48 px tall, with the full name "Thotsakan Statistics" and the topic links. The current topic is bold, with a 3 px blue underline.
- **Topic menu:** "Statistics" opens a menu of its three sub-topics on a 120 ms hover, a click, Enter or a tap. The menu stays open for 300 ms after the pointer leaves. Each item has a one-line description, and the current one is checked.
- **Narrow screens:** the topics fold into a button that names the current topic.
- **Watermark:** the mask is a soft-colour watermark bleeding off the right edge, with the controls stopping before it.

### Data rail
- **Style:** a 48 px strip that works as one tab. Hovering anywhere on it highlights the whole strip, and clicking anywhere opens Data.
- **Open:** the whole strip fills Lab Blue with white text.

### Topic carousel (front page)
- **Slide:** a 760 × 440 pale-blue field with a 20 px corner. Its scene is drawn from the topic's own plot, and the Statistics slide uses the loaded data's real histogram.
- **Current slide:** carries the topic name, a one-line description, the "needs" line, the fit line and the Open button.
- **Neighbours:** shown at half strength, with only their name.
- **Movement:**
  - Scroll-snap, driven by the arrows, the named tabs, the arrow keys or a swipe.
  - The scene's layers shift at three depths (56, 28 and 12 px) over 560 ms with ease-out.
  - It never auto-advances, and it remembers the last slide.

## Do's and Don'ts

### Do:
- **Do** put inputs on bench grey (inset) and results on print white (surface).
- **Do** give each statistical quantity one colour and keep it the same in the table, the plot and the legend.
- **Do** keep the normal-model orange (q-normal) reserved for the normal model.
- **Do** use the full name "Thotsakan Statistics", and use the real painted mask artwork. Never redraw the mask.
- **Do** ease motion out with `cubic-bezier(0.2, 0, 0, 1)`, finish it within 400 ms (the carousel scene's 560 ms is the one exception), and provide a reduced-motion version.
- **Do** draw the check mark as an icon. The ✓ character renders like a √ sign in IBM Plex Sans Thai.

### Don't:
- **Don't** use red for data. Red means errors only.
- **Don't** put the mask beside the name in the top bar. It is a watermark there.
- **Don't** add a sub-tab bar under the top bar. The topic menu and the page title carry where you are.
- **Don't** lift two surfaces at once, or add shadows to resting cards and panels.
- **Don't** set text under 12 px, or small text under 14 px at the standard size.
- **Don't** auto-advance carousels or hide the topics behind one: all four topics stay named on screen.

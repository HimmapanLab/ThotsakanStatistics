# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary users:** first-year engineering students at CMKL University.
- **When they use it:** for a statistics course and for self-study, on a laptop, often starting from the course's example data.
- **What they come to do:** look at one variable, summarise it, put intervals on it, test a claim, or work out a probability, and read every number together with the formula behind it.
- **Who explains the maths:** the professor (Irving Gomez) teaches and checks the mathematics.
- **Other audience:** visitors at events and demos. They can use the app without signing in, on a separate demo instance with upload limits. Confirmed as a secondary audience; the hero is for students first.

## Product Purpose

Thotsakan Statistics (ทศกัณฐ์ สถิติ) is a statistics analysis tool, in the style of jamovi and JASP, built at CMKL.

The software reports the results and the student decides. It is an analysis tool, not a guided lab: there is no "Reject H₀" verdict and no Run gate. Teaching flows belong to a separate product, the Quest (Hanuman's Journey).

**Success:** a student opens a topic, picks a variable, and reads the result and its formula without help.

## Positioning

Every number on screen comes with the formula that produced it. The formula is copied from the backend that computed it (NumPy defaults, ddof), not a textbook variant.

Students explore by changing inputs and watching the results, instead of calculating by hand.

## Operating Context

**Topics**, named by Irving:
- Probability (Common Distributions)
- Statistics, with three sub-topics: Graphical Analysis, Descriptive Statistics, Statistical Inference
- Hypothesis Testing
- Linear Regression, coming later

The topics are independent, not a sequence. Students can open any of them directly.

**Data:**
- CSV upload, plus three example datasets: Electricity demand, Howell heights, and World Happiness Report 2023.
- Columns are typed Jamovi-style: Continuous, Discrete, Ordinal, Nominal, ID.
- Probability works without data.

## Capabilities and Constraints

- **Ownership:** Irving owns names (tabs, sub-tabs, statistics, column names) and mathematical correctness. The design team owns colour, type, layout and components. Win owns DevOps.
- **Decision log:** `docs/decisions.md` on `dev` is a never-reverse log. Reopening a decision takes a new dated entry.
- **Tables first:** tables come before plots; the numbers lead.
- **Colours:** one meaning per colour within a tab. The same quantity uses the same colour in the table and the plot. Orange is reserved for the normal model.
- **Text size:** small text is at least 14 px in the app, and nothing is under 12 px.
- **Open decisions:** Dark mode is not designed yet; the Lab is light-first. Thai UI text needs a native-speaker check.

## Brand Commitments

- **Name:** "Thotsakan Statistics" in full in the UI (not "ThotsakanStats"). The Thai name is ทศกัณฐ์ สถิติ.
- **Mask artwork:** the painted Thotsakan mask must stay (`local/design/final-page/img/thotsakan-mask-640.webp`). In the app's top bar it is a soft watermark off the right edge, never beside the name.
- **Partner logos:** they stay: Himmapan, CMKL, AICE, and the line "Sibling product: Maiyarap Equations (coming soon)".
- **Illustrations:** flat blue style, with no strokes, a pale blob behind, and the four illustration tokens. No mascots.

## Evidence on Hand

- **Real data:** results computed from the backend on the three example datasets, in `local/design/final-page/fixtures.json`.
- **Logos:** `local/design/final-page/img/` (aice-96, cmkl-96, himmapan-112, maiyarap-192).
- **Not available:** no testimonials, usage numbers or press. Do not invent them.

## Product Principles

1. **Numbers come with their formula.** Never show a result that cannot be traced back to how it was computed.
2. **Report, don't decide.** Show the evidence and let the student judge.
3. **Topics are equal and independent.** There is no forced route through them.
4. **Explore, don't calculate.** Changing an input and seeing the result is the core action.
5. **Keep it calm for first-years.** One clear next step at a time, with no clutter.

## Accessibility & Inclusion

- Text contrast is at least 4.5:1, and there is a visible keyboard focus.
- Every motion has a reduced-motion version.
- Large and Projector text sizes exist for class use.
- The interface is bilingual (Thai and English).

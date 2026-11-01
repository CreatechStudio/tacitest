---
name: "默契词"
description: "A contemporary answer-board ritual for finding the same word together."
colors:
  canvas: "#f4eddf"
  paper: "#fffaf0"
  paper-deep: "#eee3cf"
  paper-gold: "#fff3c9"
  ink: "#182328"
  muted: "#58656a"
  amber: "#f4b820"
  amber-deep: "#d69200"
  success: "#087a65"
  success-dark: "#075c4d"
  danger: "#c7442e"
  desk: "#d9c7a6"
  focus: "#0a6bcd"
  white: "#ffffff"
  field: "rgba(24, 35, 40, 0.07)"
typography:
  display:
    fontFamily: "Noto Serif SC, serif"
    fontSize: "clamp(44px, 5.5vw, 82px)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Noto Serif SC, serif"
    fontSize: "clamp(34px, 5vw, 58px)"
    fontWeight: 500
    lineHeight: 1.14
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Noto Serif SC, serif"
    fontSize: "clamp(28px, 2.5vw, 40px)"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  body:
    fontFamily: "PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "normal"
  label:
    fontFamily: "PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "13px"
    fontWeight: 720
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  tile: "8px"
  control: "10px"
  status: "12px"
  board: "14px"
  desk-mobile: "22px"
  desk: "32px"
  full: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "24px"
  xl: "28px"
  2xl: "34px"
  3xl: "48px"
  4xl: "70px"
components:
  button-primary:
    backgroundColor: "{colors.success-dark}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "48px"
  button-primary-hover:
    backgroundColor: "#06493e"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "48px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "48px"
  input-standard:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "48px"
  board-create:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.board}"
    padding: "clamp(26px, 3vw, 40px)"
  board-join:
    backgroundColor: "{colors.paper-gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.board}"
    padding: "clamp(26px, 3vw, 40px)"
  countdown:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.status}"
    padding: "14px 18px"
---

# Design System: 默契词

## Overview

**Creative North Star: "举牌时刻 / The Answer-Board Ritual"**

默契词 turns simultaneous private input into a quiet tabletop ritual. Warm cream paper, charcoal type, green state cues, and sparing amber acknowledgements make the interface feel contemporary and tactile without becoming childish, nostalgic-classroom, or glassy.

The system is composed as a table before it is composed as a dashboard: creation and joining are physical answer boards; members occupy seats; submission feels like setting a board face-down; reveal lifts every answer together. The material metaphor clarifies state, but typography, labels, and numbers always carry the meaning.

**Key Characteristics:**

- Warm paper-on-desk material hierarchy
- Noto Serif SC for ceremonial moments; crisp system sans-serif for operation
- Restrained green for primary action and successful state, amber for acknowledgement
- Answer-board silhouettes repeated across entry, play, reveal, and results
- Measured tactile motion with a complete reduced-motion fallback

## Colors

The palette is warm and mineral: cream paper and charcoal ink establish the field, while green and amber appear only where state or action needs a voice.

### Primary

- **Deep Table Green** (`success-dark`): Primary buttons, game-phase labels, protected-state messaging, and winning emphasis.
- **Living Green** (`success`): Submitted participant markers and selected success details.

### Secondary

- **Acknowledgement Amber** (`amber`): Board-set submission acknowledgement, avatars, and brief moments of shared attention.
- **Pressed Amber** (`amber-deep`): A deeper companion for amber states when additional contrast is needed.

### Tertiary

- **Pin Red** (`danger`): Pushpins, urgent countdowns, validation, and errors; never a decorative wash.
- **Focus Blue** (`focus`): Keyboard focus only, preserving a conspicuous accessibility signal outside the warm brand palette.

### Neutral

- **Warm Canvas** (`canvas`): The page-wide background and visual breathing room.
- **Fresh Paper** (`paper`): Primary answer boards, sheets, invites, and logs.
- **Aged Paper** (`paper-deep`): Scroll tracks and quiet secondary material separation.
- **Golden Paper** (`paper-gold`): The join board and winning-row family.
- **Charcoal Ink** (`ink`): Main text, the brand mark, dark buttons, timers, and room-code tiles.
- **Pencil Gray** (`muted`): Supporting copy, descriptions, and inactive status.
- **Table Linen** (`desk`): The shared desk tray behind answer boards.
- **Clear White** (`white`): Text on dark action and status surfaces.
- **Ink Wash** (`field`): Recessed input wells on paper.

### Named Rules

**The One Warm Field Rule.** Keep full-screen backgrounds within the cream-paper family; accents belong to actions and state, not atmospheric gradients.

**The Meaning Beyond Color Rule.** Every status also needs a label, icon, number, or structural change; green, amber, and red never carry meaning alone.

## Typography

**Display Font:** Noto Serif SC (with generic serif fallback)  
**Body Font:** PingFang SC (with Microsoft YaHei and generic sans-serif fallbacks)

**Character:** The serif face gives the shared ritual weight and patience. The sans-serif face keeps rules, room codes, field labels, timers, and status language direct under time pressure.

### Hierarchy

- **Display** (500, `clamp(44px, 5.5vw, 82px)`, 1.08): Home, lobby, round, and reveal statements; balance lines rather than forcing uniform widths.
- **Headline** (500, `clamp(34px, 5vw, 58px)`, 1.14): Revealed words, invite states, and high-attention sheet messages.
- **Title** (500, `clamp(28px, 2.5vw, 40px)`, 1.15): Answer-board titles and log headings.
- **Body** (400, 16px, 1.75): Explanations and rules, generally held to roughly 34–40 em for comfortable Chinese reading.
- **Label** (720, 13px, normal tracking): Fields, progress states, phase labels, and protected-system status.
- **Numeric emphasis** (650–800, tabular numerals where available): Room codes, timers, settings, and round counts.

### Named Rules

**The Serif Carries the Ritual Rule.** Use Noto Serif SC for the words people gather around; use sans-serif for the controls and facts that help them act.

**The Number Must Hold Still Rule.** Timers, room codes, counts, and result tables use tabular numerals and a stable container so live updates do not shift the composition.

## Layout

Desktop layouts use generous edge padding (`clamp(20px, 5vw, 76px)`) and centered containers between 1250px and 1500px. The home and lobby use asymmetric two-column compositions: language and instructions on the left, the shared tabletop object on the right. Main action surfaces are large and few, with 48–120px of separation between narrative and task zones.

At 1100px, home and lobby become single-column while preserving the broad tabletop. At 720px, page gutters reduce to 16px, tilted boards straighten, the answer desk becomes a vertical stack, and participant/reveal collections favor horizontal scrolling or compact two-up arrangements. The application never contracts below 320px.

Spacing follows a loose 6px-derived rhythm, with recurring steps at 8, 12, 18, 24, 28, 34, 48, and 70px. Dense spacing belongs inside a status cluster; ceremonial headings and shared actions receive the largest gaps.

**The Table Before the Grid Rule.** Arrange major actions as a shared scene with a clear center of gravity; do not fragment the product into a dashboard of equal-weight cards.

## Elevation & Depth

The system uses a hybrid of tonal layering and broad, warm shadows. Paper sits above linen or tabletop surfaces, while controls remain mostly flat inside the paper. Shadows are diffuse and brown-tinted rather than black, communicating physical separation without glossy UI chrome.

### Shadow Vocabulary

- **Desk lift** (`0 28px 70px rgba(63, 48, 22, 0.20)`): Large shared desk or player-table surfaces.
- **Board lift** (`0 16px 36px rgba(73, 53, 20, 0.18)`): Entry boards and smaller paper objects.
- **Sheet lift** (`0 24px 55px rgba(67, 49, 20, 0.20)`): The primary in-round answer sheet.
- **Reveal lift** (`0 20px 44px rgba(72, 51, 17, 0.18)`): Revealed answer boards.

### Named Rules

**The Lifted Paper Rule.** Reserve strong elevation for a physical layer change—canvas to table, table to board, or hidden board to reveal—not for every container.

## Shapes

Corners are softly practical rather than bubbly. Inputs and buttons use a 10px radius; status blocks use 12px; answer boards, sheets, and result logs use 14px. Shared desk trays expand to 22–32px, and the lobby table is deliberately oval. Circular pins and participant markers are functional punctuation, not a general pill vocabulary.

Boards may rotate by roughly one degree on desktop to create a handled-paper feel, but return to a straight stack on mobile. Borders are thin and low-contrast; the desk's inset dashed stitch is an exception that reinforces the tabletop material.

## Components

### Buttons

Buttons feel decisive and compact, like controls attached to a physical board.

- **Shape:** Gently curved control corners (10px) with bold sans-serif labels.
- **Primary:** Deep Table Green with white text; use for the single phase-advancing action.
- **Secondary:** Charcoal Ink with white text; use for an alternative entry path, not beside another equal primary.
- **Outline:** Transparent with a quiet charcoal border; use for copying, restarting, or leaving the main flow.
- **Hover / Focus:** Darken the filled surface on hover; retain the global 3px Focus Blue outline with a 3px offset for keyboard focus.

### Cards / Containers

Answer boards are the system's signature container.

- **Corner Style:** Answer-board corners (14px), with occasional one-degree rotation on wide screens.
- **Background:** Fresh Paper for creation and core play; Golden Paper for joining and winning context.
- **Shadow Strategy:** Board lift at rest, Sheet lift for the primary round action, Reveal lift after simultaneous reveal.
- **Border:** Usually none; material separation comes from tone and shadow.
- **Internal Padding:** Fluid board padding (`clamp(26px, 3vw, 40px)`), increasing to 70px for the focused answer sheet.

### Inputs / Fields

Inputs are recessed wells cut into a paper board.

- **Style:** Ink Wash background, transparent border at rest, 10px corners, and at least 48px height.
- **Focus:** Fresh Paper background with a Living Green border, plus the global Focus Blue keyboard outline.
- **Specialized:** Room codes use large, bold, widely tracked uppercase characters; answer input uses centered Noto Serif SC.
- **Error / Disabled:** Errors use Pin Red copy and explicit text. Disabled actions visibly mute but keep their label legible.

### Navigation

Navigation is intentionally minimal: a compact brand link at the upper left and current-room identity at the upper right. The charcoal 36px brand mark contains the serif character “同”; room codes use bold tabular numerals with wide tracking.

### Status Marks

Participant and submission status pairs a circular marker with a name and plain-language state. Submitted markers turn Living Green and show a check; urgent countdowns turn Pin Red while retaining the numeric seconds label.

### Answer Submission and Reveal

Submitting lightly settles the answer sheet and releases a restrained split-particle burst in amber, green, and red over 700–760ms. Reveal boards appear together with a 620ms hinged lift. Under `prefers-reduced-motion: reduce`, decorative particles disappear and all movement collapses to an effectively instant state change.

**The Board Language Rule.** Creation, joining, seating, writing, submission, reveal, and the final log must feel like successive states of the same answer-board system.

## Do's and Don'ts

### Do:

- **Do** let one unmistakable action advance each game phase.
- **Do** keep answer state private until the shared reveal, then present all answers as peers.
- **Do** pair color changes with text, icons, or structural state changes.
- **Do** preserve generous cream negative space and tactile paper-on-table layering.
- **Do** honor reduced motion by removing particles and decorative displacement while preserving immediate feedback.

### Don't:

- **Don't** turn the experience into a generic card dashboard or a marketing feature grid.
- **Don't** use gradients, frosted glass, neon glows, or glossy skeuomorphic chrome.
- **Don't** drift into childish classroom decoration or overt retro nostalgia.
- **Don't** scatter amber, green, or red as decoration; each accent must explain action or state.
- **Don't** add motion outside submission acknowledgement and collective reveal without a functional reason.

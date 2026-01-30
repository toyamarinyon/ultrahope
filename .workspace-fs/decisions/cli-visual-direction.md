# Color & Visual Direction for Interactive CLI

## 1. Goal

The goal is **not to make the CLI colorful**, but to make it **visually legible, calm, and state-driven**.

This CLI should feel closer to tools like:

* neovim
* htop
* fzf
* memex

and **not** like:

* verbose logs
* CI output
* error-heavy command-line tools

Color exists to **encode meaning**, not to decorate.

---

## 2. Core Visual Principles

### 2.1 Reduce visual noise

* Default text should not be pure white.
* Prefer soft grays for most content.
* The terminal background is already dark; white text creates unnecessary contrast fatigue.

> If everything is bright, nothing is emphasized.

---

### 2.2 Color = semantic role

Each color must have a **stable meaning** across the entire CLI.

Colors must never be used only because "it looks nice".

---

### 2.3 Avoid emotional colors

* Bright red implies panic or failure.
* This CLI mostly reports *state*, not *fault*.

Use muted tones whenever possible.

---

## 3. Semantic Color Roles (Direction, not strict values)

Implementers are free to adjust exact shades, but the **roles must remain consistent**.

### 3.1 Text hierarchy

* **Primary text**

  * Soft light gray
  * Used for normal sentences

* **Secondary text**

  * Darker gray
  * Used for explanations, details, sub-points

---

### 3.2 State indicators

* **Success / Completed (`✔`)**

  * Muted green
  * Calm, not celebratory

* **In progress (`▶`)**

  * Muted cyan or blue
  * Indicates ongoing or attempted action

* **Skipped / Blocked (`✖`)**

  * Muted yellow or muted red
  * Indicates "cannot continue", not "error"

> Bright red should be reserved for fatal or unrecoverable situations only.

---

### 3.3 Interaction & focus

* **Prompts waiting for input**

  * Slightly brighter cyan
  * Must visually stand out from static text

* **User-entered input**

  * Same color as prompt or slightly brighter
  * Should feel "active"

---

### 3.4 Links & commands

* URLs and suggested commands:

  * Same color as interaction/focus
  * Should look actionable but not loud

---

## 4. Example (Illustrative, Not Prescriptive)

This example shows **structure and contrast**, not exact colors.

```text
✔ Found 2 files, 22 insertions, 2 deletions
▶ Generating commit messages... 0/4

✖ Commit message generation was skipped
  • Daily request limit reached (6 / 5)
  • Resets in 12 hours (09:25 AM GMT+9)

What would you like to do?

  1) Retry after the daily limit resets
  2) Upgrade your plan to continue immediately

Select an option [1-2], or press q to quit:
```

Key ideas:

* Only the symbols (`✔ ▶ ✖`) and the prompt line need strong color.
* Most text remains visually quiet.
* The user's eye is guided naturally downward.

---

## 5. What NOT to do

* Do not use many colors for a single block.
* Do not mix different colors for the same semantic role.
* Do not highlight entire paragraphs.
* Do not rely on red for normal control flow.
* Do not assume color is always available (support no-color mode).

---

## 6. Accessibility & Fallbacks

* The CLI must remain usable with:

  * Color disabled
  * Low-contrast terminal themes

Meaning should still be readable via:

* Symbols (`✔ ▶ ✖`)
* Text structure
* Spacing

Color is an enhancement, not a requirement.

---

## 7. Mental Model for Implementers

Think in layers:

1. **Text** — must be understandable without color
2. **Symbols** — encode state transitions
3. **Color** — reinforces meaning and focus

If color is removed, the CLI should still make sense.

---

## 8. Summary for Coding Agents

* Use color sparingly and consistently.
* Reduce white text; prefer grays.
* Encode state and focus, not emotion.
* Let interaction points stand out naturally.
* Favor calm, professional terminal aesthetics.

> This CLI should feel like a tool you can live in for hours.

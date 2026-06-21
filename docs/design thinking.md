Great question — and you've already nailed the most important insight: **the whole point is converting unknown unknowns into decisions before they become expensive.** That's the through-line. But here's the honest answer: **there is no single name for what we just did**, because it's a mashup of several traditions, and each tradition named its own slice. Let me give you the survey.

## The one-sentence answer

What we did doesn't have one canonical name. The closest umbrella term is **"software design"** or **"design thinking for software,"** but those are too broad to be useful. The _specific_ thing we did — relentless one-at-a-time questioning that surfaces hidden decisions before code — goes by different names depending on which community you ask. Each community owns a piece.

## The survey: five traditions, each with a name for its piece

### 1. The Socratic / grilling tradition (what we literally did)

The _mechanism_ — interview relentlessly, one question at a time, walking the decision tree — is the **Socratic method**, which is 2400 years old. In software it shows up as:

- **"Grilling"** or **"design review"** (informal)
- **"Rubber-ducking with a human"**
- The skill I invoked is literally called `grilling` — it's a codified version of this

**The unknown-unknowns angle:** every question I asked was a decision you would have hit _mid-build_ otherwise. "Where does identity live?" "What nesting depth?" "What does the 201 return?" None of these are obvious until you're staring at the code. Grilling surfaces them while they're still cheap.

### 2. Architecture Decision Records (ADRs) — what we _recorded_

The _artifact_ — a short markdown doc per decision, with context/options/consequences — is an **ADR**, a pattern coined by **Michael Nygard in 2011**. You now have 6 of them in `docs/adr/`.

- **Canonical source:** Michael Nygard's original article "Documenting Architecture Decisions" (2011), and the book _The Art of Scalability_ (Abbott/Fisher) which has an ADR chapter.
- **Community site:** adr.github.io

ADRs are how you _freeze_ a decision so a future you (or another AI, or a teammate) doesn't re-litigate it. That's literally why you're able to hand the build to another AI with a prompt — the ADRs carry the "why."

### 3. Domain-Driven Design (DDD) — where CONTEXT.md came from

The _vocabulary work_ — pinning down "Comment," "Reply," "Tombstone," "Acting User" as terms of art before writing code — is **Domain-Driven Design**, from **Eric Evans's 2003 book of the same name**. The specific practices:

- **Ubiquitous language** — one shared vocabulary between code and conversation (your `CONTEXT.md`)
- **Bounded contexts** — where one term's meaning stops
- **Event storming** — a workshop format for surfacing domain unknowns fast

**The unknown-unknowns angle:** DDD's entire premise is "the hardest bugs are domain misunderstandings, not code bugs." Naming things precisely _is_ surfacing unknowns.

**Where to learn:** Evans's book (dense, classic) or Vaughn Vernon's _Implementing DDD_ (more practical). For a fast start: the "DDD Crew" GitHub intro materials.

### 4. The Pragmatic Programmer tradition — where slices came from

The _build strategy_ — vertical end-to-end slices, not horizontal layers — comes from **"Tracer Bullets"** in **Hunt & Thomas's _The Pragmatic Programmer_** (1999, 20th-anniversary edition 2019). Same book also gives you:

- **"Stone Soup"** — start with something tiny and real
- **DRY, orthogonality, broken windows** — vocabulary you'll see everywhere

**The unknown-unknowns angle:** tracer bullets are _explicitly_ an unknown-unknown-discovery tool. You build the thinnest end-to-end path _not because it's useful_ but because forcing every layer to talk to every other layer surfaces integration unknowns a horizontal build would hide until the end.

### 5. Requirements / discovery traditions — the formal side

In more formal software engineering, the umbrella is **"requirements elicitation"** or **"discovery."** Tools:

- **Example Mapping** (Matt Wynne) — surface unknowns via concrete examples
- **Specification by Example** (Gojko Adzic)
- **Gherkin/BDD** — formalize examples as tests

These are heavier than what we did, more common in enterprise/regulated work.

## The "Unknown Unknowns" framing itself — your key insight

You named the right target. This framing comes from **Dave Snowden's Cynefin framework** (pronounced "ki-nev-in"):

| Domain                           | What to do                                                  |
| -------------------------------- | ----------------------------------------------------------- |
| **Simple** (known knowns)        | Best practice — just do it                                  |
| **Complicated** (known unknowns) | Expert analysis — hire/grill an expert                      |
| **Complex** (unknown unknowns)   | **Probe → sense → respond. Build thin experiments, learn.** |
| **Chaotic**                      | Act first, sense later                                      |

Software design is almost always **Complex** — the unknowns are unknown until you force them. _Everything we did_ (grilling, slices, ADRs, ubiquitous language) is a technique for operating in the Complex domain: **force the unknowns to surface cheaply before they're expensive.**

- **Where to learn Cynefin:** Snowden's HBR article "A Leader's Framework for Decision Making" (2007), or his book _Agile Strategy_.

## So — mapping what we did to the traditions

| We did...                                   | Its name                             | Tradition                |
| ------------------------------------------- | ------------------------------------ | ------------------------ |
| The one-at-a-time relentless interview      | Socratic method / grilling           | Philosophy → informal SE |
| Wrote `CONTEXT.md` with terms of art        | Ubiquitous language                  | Domain-Driven Design     |
| Wrote 6 markdown decision docs              | ADRs                                 | Nygard 2011              |
| Built end-to-end slices not layers          | Tracer bullets                       | Pragmatic Programmer     |
| Surfaced decisions before building          | Discovery / requirements elicitation | Formal SE                |
| Named "this is complex, force unknowns out" | Cynefin (Complex domain)             | Snowden                  |

## If you want to go deeper — a reading order

The honest reading list, in order of payoff-per-page:

1. **The Pragmatic Programmer (Hunt & Thomas, 20th anniv. ed.)** — best ROI of any SE book. Tracer bullets, DRY, orthogonality. Reads easy.
2. **Michael Nygard's original ADR article** (it's ~6 pages, free online) — you'll immediately get more out of your own `docs/adr/` folder.
3. **"A Leader's Framework for Decision Making" (Snowden & Boone, HBR 2007)** — the Cynefin framework. This is the article that puts words to your "unknown unknowns" intuition.
4. **Domain-Driven Design (Evans)** — only if you find yourself building systems where the business logic is the hard part. Dense but foundational.
5. **Accelerate (Forsgren, Humble, Kim)** — for the _empirical_ version of "what practices actually correlate with good outcomes" (hint: the stuff we did shows up).

## The practical takeaway for your project

You don't need to adopt any tradition wholesale. The mashup we did _is_ the practice — and it's reproducible:

1. **Before building:** grill (Socratic) to surface decisions, one at a time.
2. **Per decision:** write an ADR so it's frozen.
3. **Pin the vocabulary:** keep a CONTEXT.md of terms of art.
4. **Build in vertical slices** so each slice forces integration unknowns to surface.
5. **Recognize the domain is Complex** — expect unknowns, design to flush them out cheaply.

The skill that did the heavy lifting — `grilling` — is one codified instance of step 1. There are others (`grill-me`, `prototype`, `diagnosing-bugs` in your skills list). They're all variations on "force the unknown unknown into the light before it costs you."

---

The fact that you stepped back mid-project and asked _"what is this thing we're actually doing?"_ is itself the meta-skill. Most developers do this stuff intuitively, badly, and can't name it — which means they can't reproduce it deliberately. You naming it means you can now reach for it on purpose next time. That's worth more than any single slice of code.

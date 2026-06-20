# Computed score via live SUM, no stored aggregate

A Comment's Score is never stored as a column on the `comments` table. It is computed live by summing the `votes` table: `SELECT SUM(value) FROM votes WHERE comment_id = ?`. The votes table is the single source of truth.

## Why

Three reasons, each reinforcing the others:

**1. Correctness — one source of truth, no drift.** A stored `score` column would be a cache of the true value. Keeping it in sync requires both `INSERT INTO votes` and `UPDATE comments SET score = score + ?` to succeed atomically. If the insert succeeds and the update fails, the votes table says 13 but the score says 12 — a permanent, silent drift. Computed score eliminates this class of bug entirely: there is no cache to drift.

**2. Toggle and swing are handled correctly.** The vote model supports toggling (same value again → remove the vote) and swinging (opposite value → net change of ±2). Both operations are a single row operation on the votes table. With a stored cache, each toggle/swing must also correctly update the score — a second mutation that must agree with the first, adding sync complexity for every write path. With computed score, the write touches only votes; the SUM automatically reflects the new state.

**3. Scale is irrelevant here.** A SUM on an indexed `votes.comment_id` column with ~10 rows per comment takes ~50 microseconds on SQLite. For 100 comments on page load that is ~5ms total — invisible. The stored-cache pattern (the approach used by Reddit, YouTube, Twitter) exists for systems with millions of votes per item and millions of concurrent readers, where SUM becomes genuinely expensive. This app has single-digit scores and single-digit voters. Optimizing for that scale would be premature and would introduce a correctness risk for a performance problem that does not exist.

## What was explicitly rejected

**Stored score column (cache):** rejected because it introduces a second source of truth that can drift from the votes table, requires transactions on every write, and solves a performance problem this app does not have.

**Atomic `UPDATE SET score = score + ?`:** rejected because it must coexist with the INSERT on every vote mutation, creating a two-step transaction that either must be managed carefully (adding code complexity) or will eventually drift (adding correctness risk).

## When this decision should change

If the app ever reaches a scale where the per-comment SUM becomes measurable in page-load time (thousands of votes per comment, or the SUM query appearing in a hot inner loop), the stored-cache pattern becomes appropriate. At that point the cache should be introduced *with a reconciliation mechanism* (periodic recompute, event-sourced updates, or a background worker) to detect and repair drift. The threshold for this change is orders of magnitude beyond this app's expected load.

## Not a one-way door

Starting with computed score costs nothing if the app later needs caching. The transition is: add the `score` column, populate it, update the SUM to write to it, and switch reads to the column. The reverse transition (cache → computed) requires detecting and correcting any accumulated drift, which is harder. Starting simple is the reversible choice.

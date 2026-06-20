# Pickable identity without authentication

The app uses a **pickable identity** model: the UI lets the operator select which seeded User they are acting as via a header dropdown, and every request carries that User's id. The server **trusts the stated identity** — it does not verify it with passwords, sessions, or tokens.

## Why

We wanted voting (per-User Vote table) and authorization (only an Author may edit/delete their own Comments) to be *meaningful*, which requires more than a single hardcoded User. But full authentication was deliberately scoped out — it is its own substantial skill and is not what this Frontend Mentor challenge is about (the seed ships a hardcoded `currentUser` precisely because auth is out of scope).

Pickable identity is the **smallest step that makes voting and authorization real** without dragging in password hashing, sessions, or login flows.

## Known consequence

This is **insecure by design**. Anyone can send anyone's `userId` in a request body and act as them. This is accepted as a learning simplification. Do **not** "fix" this by adding identity verification piecemeal — it would create a half-authenticated system that is neither honest nor correct. Real authentication belongs in a dedicated project.

## Considered options

- **Fixed single user** (always juliusomo): rejected — makes the per-User Votes decision meaningless; no authorization logic possible.
- **Real authentication** (passwords/sessions/JWT): rejected — out of scope; a separate project's worth of work.

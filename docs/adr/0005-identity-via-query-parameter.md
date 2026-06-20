# Identity via query parameter on every request

The Acting User's identity travels as the **`?userId=` query parameter** on **every** request — reads and mutations alike. `GET /comments?userId=1`, `POST /comments?userId=1`, `PATCH /comments/3?userId=1`, `DELETE /comments/3?userId=1`. Identity is never in the request body and never in a custom header.

This **supersedes the original PLAN.md**, which described identity traveling in the request body. The already-implemented `GET /comments` in fact used the query param (`req.query.userId`); this ADR formalizes that as the rule for all endpoints and corrects the plan.

## Why

**1. One uniform rule.** The frontend has a single `api/client.js` that appends `?userId=${currentUser.id}` to every call. Reads and mutations are identical in this respect. A body-based convention would split the rule: GETs carry `?userId=`, POSTs carry a body field — two mechanisms to remember and two code paths to maintain.

**2. Trivially removable for Pass 2.** Today there is no authentication — the author is client-supplied (ADR-0001). In Pass 2 (Supabase), the author stops being client-supplied entirely and comes from the authenticated session. The cleanest thing to rip out is a single line in the fetch helper ("stop appending `?userId=`"). Scattering `userId` into every request *body* (the rejected alternative) is more surgical removal work across every mutation.

**3. It matches what already shipped.** `GET /comments` already reads `req.query.userId`. Making mutations match avoids inventing a second convention.

## Known consequence

Query parameters on `POST`/`PATCH`/`DELETE` look slightly unconventional to REST traditionalists, who expect identity-adjacent data in the body or a header. This is an aesthetic cost, accepted for the uniformity and Pass-2-removability benefits.

## Considered options

- **In the request body** (`{ userId, content, parentId }`): rejected — scatters `userId` into every mutation body; more surgical work to remove for Pass 2; splits the identity rule between GET (query) and mutations (body).
- **Custom `X-User-Id` header:** rejected — cleanest separation of control vs resource data, but adds a non-standard custom header for zero benefit given there is no auth layer to plug into. Same removal work as the query param without its uniformity advantage.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Cloudflare Workers + Workers Static Assets, KV, Durable Objects for per-room coordination, Vite, React, HeroUI v3, and pnpm. Cloudflare Access protects the application; Turnstile gates room creation and joining.

## Users

Small groups of 2–10 authenticated participants who want to test whether they independently think of the same word under time pressure.

## Product Purpose

The product runs a synchronous word-agreement game. Everyone submits one private word per round; submissions are revealed together. The game ends when every participant submits the same word, then shows a round-by-round log of every participant’s input.

## Positioning

Agreement is proven through simultaneous private input rather than discussion: the reveal, not persuasion, is the core mechanism.

## Operating Context

One person creates a room and shares a short room code or invitation link. Others join before the host starts. During play, each round has a visible deadline, private submission state, a collective reveal, and an immediate transition to the next round or the final log.

## Capabilities and Constraints

- Rooms support 2–10 participants and cannot be joined after the game starts.
- The creator configures a maximum word length and a per-round limit in seconds; the default round limit is 30 seconds.
- Word length is measured in Unicode code points. The initial default maximum is 8 characters.
- At the deadline, submitted words are kept and non-submitters are recorded as “未提交”; the round still resolves.
- A room expires if it has not started a game within 30 minutes of creation, including when empty or occupied by only one person. Active games are not expired by this lobby rule.
- Multiple rooms can run concurrently.
- Creation and joining both require a fresh, server-verified Turnstile token.
- Cloudflare Access supplies authenticated identity. The application does not implement a second password system.
- The realtime coordination boundary is one Durable Object per room; KV stores short-code and invitation lookup records.
- A submitted word produces a restrained split-particle acknowledgement inspired by iMessage, with a reduced-motion fallback.
- Product name, production hostname, Cloudflare account resources, Access identity provider, and final brand assets remain open deployment decisions.

## Evidence on Hand

No existing brand assets, customer claims, screenshots, benchmarks, or production content were supplied. Future work must not fabricate them.

## Product Principles

- Keep every word private until the collective reveal.
- Make room state and time pressure obvious without creating anxiety.
- Prefer one unmistakable shared action per phase.
- Treat identity, bot protection, and room admission as server-enforced boundaries.
- Let the final log explain the story of how agreement emerged.

## Accessibility & Inclusion

Keyboard operation, visible focus, meaningful status announcements, sufficient contrast, responsive layouts, and reduced-motion behavior are required. Color alone must never communicate submission or game state.

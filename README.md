# Aetherite — RTS defense prototype

A playable Mars battlefield for testing siege tanks, infantry screening, elevation, and defensive positions.

[Deploy to Render](https://render.com/deploy?repo=https://github.com/SYaroli/rts-prototype)

## Host on Render

Use the deployment link above while signed into your Render account. Review the Blueprint and deploy the static site. The root `render.yaml` supplies its configuration; Render assigns the playable address after deployment.

Alternatively, in Render choose **New → Static Site**, connect this repository, and use:

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Root Directory | Leave blank |
| Build Command | `node --check public/game.js` |
| Publish Directory | `public` |

No database, backend service, npm installation, or purchased domain is required. Updates committed to `main` trigger deployment once connected. The game runs in the player's browser. This repository and a normal Render static-site deployment are public; the former ChatGPT Sites viewer restriction is not part of these files.

Render documentation: [Static sites](https://render.com/docs/static-sites), [Blueprint reference](https://render.com/docs/blueprint-spec).

## Play locally

From the repository directory, run `python3 -m http.server 8000 --directory public`, then open `http://localhost:8000` in your own browser.

## Controls

- Left-click or drag: select units; Shift adds to selection.
- Right-click terrain: move selected mobile units; right-click a visible enemy: manually target it.
- E: deploy or pack selected siege tanks (two seconds).
- A: select all friendly units; S: stop selected units and clear manual targeting.
- Mouse wheel / + / −: zoom; arrow keys / screen edges: pan; middle-drag: pan.
- Enter: launch attack; Space: pause; Reset: restore launch positions.
- On touchscreens: select units, then tap terrain to move.

Choose open ground, canyon mouth, or ridge + screen before launch. The flank toggle redirects part of the same 22-unit attack through the southern route.

## Current implementation

Plain HTML, CSS, and JavaScript with no external runtime dependencies. Canvas draws a fixed angled projection of a heightmap with modeled elevation, movement limits, and line-of-sight checks; this is a software-rendered prototype, not a full 3D engine. Infantry squads count as one mechanical unit. Tanks gain range and splash damage in siege mode, lose movement, and have a minimum firing range.

## Build 02 — targeting and collision

- Tanks automatically prioritize hittable enemy armor, then choose the nearest target within that class. Infantry still choose the nearest eligible target.
- Right-clicking a visible enemy overrides automatic targeting. Mobile units approach it, while deployed tanks hold their ground. A red marker shows the ordered target. Stop or a ground move cancels the order; dead or unseen targets release it automatically.
- Squads have a 0.45-unit body radius; vehicles have a 0.72-unit radius. Swept movement checks prevent crossing other units or cliffs. Local avoidance and blocked-route recalculation allow passage where space exists. Deployed tanks cannot be pushed.
- Routes and formation spacing account for those footprints. Enemy crawlers use a canyon exit waypoint with enough clearance from the ridge.
- The header identifies this version as BUILD 02.

Run `node tests/combat.cjs` to check armor priority, invalid-target fallback, manual targeting, screen hit testing, mobile pursuit, siege immobility, swept collision, open-ground avoidance, ramp access, and all six defensive-position/attack-route combinations. Scenario checks assert no overlapping units and no unfinished battles after the allotted simulation time. Run `node --check public/game.js` for the deployment syntax check.

These are headless mechanics checks, not browser visual QA. Combat balance still needs human playtesting: high ground or a canyon does not guarantee a win. Results exist only during the current browser session and are not uploaded or automatically visible to the assistant.

No campaign, economy, persistent bases, or multiplayer is included in this slice.

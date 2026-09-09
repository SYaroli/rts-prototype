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
- Right-click terrain: move selected mobile units.
- E: deploy or pack selected siege tanks (two seconds).
- A: select all friendly units; S: stop selected units.
- Mouse wheel / + / −: zoom; arrow keys / screen edges: pan; middle-drag: pan.
- Enter: launch attack; Space: pause; Reset: restore launch positions.
- On touchscreens: select units, then tap terrain to move.

Choose open ground, canyon mouth, or ridge + screen before launch. The flank toggle redirects part of the same 22-unit attack through the southern route.

## Current implementation

Plain HTML, CSS, and JavaScript with no external runtime dependencies. Canvas draws a fixed angled projection of a heightmap with modeled elevation, movement limits, and line-of-sight checks; this is a software-rendered prototype, not a full 3D engine. Infantry squads count as one mechanical unit. Tanks gain range and splash damage in siege mode, lose movement, and have a minimum firing range.

The migration preserves the first playable version. Simulation checks covered ramp access, cliff blocking, siege deployment, minimum firing range, and completion of the scenario variants. Browser visual QA and gameplay balance remain to be evaluated. Results exist only during the current browser session and are not uploaded or automatically visible to the assistant.

## Agreed next work

- Prefer enemy armor when tanks acquire a target automatically, with player-selected targets overriding the default.
- Add unit collision and crowding so a canyon actually constrains throughput; current units can overlap.
- Retest terrain advantages against repeatable attacks after those mechanics are corrected.

Current automatic targeting chooses the nearest eligible enemy. Right-click is currently movement only; target override is not implemented yet. No campaign, economy, persistent bases, or multiplayer is included in this slice.

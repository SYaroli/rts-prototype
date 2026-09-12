# Island landscape study

Untouched tropical crescent island with procedural terrain, depth-colored animated water, instanced trees and palms, and a perspective orbit camera. Visit `/island/`; the existing defense prototype remains at `/`.

Rebuild: `cd island-src && npm install && npm run build`. Commit the output in `public/island` so the existing Render static-site configuration needs no changes. Three.js 0.180.0 is bundled locally; its MIT notice is retained in the bundle license file.

Camera: left drag orbit/tilt, right drag pan, wheel zoom, double-click terrain or water to focus. Touch: one finger orbit, two fingers pan/pinch. Preset view buttons reset the camera. H hides/shows the interface; Escape restores it.

This is an initial stylized scenery study, not a recreation of Anno's proprietary map/assets. No gameplay, buildings, boats, or external asset downloads. Distances are scene units intended roughly as meters, not surveyed geography. Requires WebGL 2; pixel ratio capped at 1.5 for performance. Detailed authored cliff meshes, realistic vegetation, and waterfall are future art work.

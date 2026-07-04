# Credits

**PCB TD** — designed and built by Mizhgan Games (Mikhail Eshchenko).
All game code, artwork, level design, story, and audio are original — no
external image, font, or audio assets are shipped; everything visual is
drawn procedurally (inline SVG / Pixi Graphics) and all sound is synthesized
in the Web Audio API at runtime.

## Third-party libraries

| Library | Version | License | Use |
|---------|---------|---------|-----|
| [Pixi.js](https://pixijs.com) | ^8.6 | MIT | WebGL renderer |
| [pixi-filters](https://github.com/pixijs/filters) | ^6.1 | MIT | Bloom / CRT post-processing |
| [GSAP](https://gsap.com) | ^3.15 | GreenSock Standard "No Charge" License | UI / juice tweening |

### GSAP license note

GSAP is used under the GreenSock **Standard "No Charge" License**
(<https://gsap.com/standard-license>). PCB TD embeds GSAP purely as an
animation runtime inside the game and does **not** redistribute, resell, or
expose GSAP as a standalone product or competing library. Attribution is
retained here as the license requires.

Pixi.js and pixi-filters are MIT licensed — full texts available in their
respective `node_modules/*/LICENSE` files and upstream repositories.

## Fonts

The game uses only the player's system monospace stack
(`'JetBrains Mono', Menlo, Consolas, monospace`) — no web fonts are downloaded.

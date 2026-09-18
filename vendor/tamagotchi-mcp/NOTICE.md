# Upstream provenance

`tamagotchi.js`, `animations.js`, `package.json`, and `README.md` are unchanged
files from the published `tamagotchi-mcp` npm package, version 1.0.0.

- Source: https://www.npmjs.com/package/tamagotchi-mcp
- Archive: https://registry.npmjs.org/tamagotchi-mcp/-/tamagotchi-mcp-1.0.0.tgz
- Published author: Claude Code; npm maintainer: levisnkyyyy.
- License: MIT, as declared in the preserved upstream package.json and README.
- Archive SHA-1: `38b92c0e2dc3a7518884de685ea17c19fcad5a2b`.

The upstream archive does not include the LICENSE file referenced by its README.
No upstream copyright notice or license text has been removed or invented.

The application adapter in `../../engine.mjs` provides app-owned persistence,
continuous elapsed-time decay (fixing upstream's loss of sub-hour time on reads),
bounded stats, and gradual sleep recovery. Care actions, mood, health checks, and
evolution use the original engine. It is a ROM-free virtual pet, not an emulator.

# Commando Knife 64

A C64-style side-scrolling commando game for the browser, inspired by the 1985 classic *Green Beret*.
All graphics, sound and music are original and generated in code. There are no external assets and no build step.

## Run

ES modules don't load from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Controls

| Key | Action |
| --- | --- |
| Arrows / WASD | Run. **Up** climbs ladders, or jumps when you're not at a ladder. |
| Down | Crouch (dodges high bullets; you need it to stab dogs). Climbs down at the top of a ladder. |
| Z / Space | Knife |
| X | Special weapon (dropped by white-uniformed officers) |
| Enter | Start |
| P / Esc | Pause |
| M | Music on/off |

Gamepads work too: d-pad/stick, A = knife, B = special, Start.

## The game

- Four stages modelled on the C64 *Green Beret*:
  - **Missile Base** ends at a launch pad, where a troop truck parks and unloads soldiers and karate fighters.
  - **Harbor** has paratroopers coming down throughout and ends with dog handlers and attack dogs from both sides.
  - **River Bridge** runs past an airfield and ends with helicopters. They bomb you from above and dive to sweep across your level, so crouch under them or knife them.
  - **Prison Camp** ends with the camp garrison: soldiers from both sides, karate fighters from the right, bazookas from the left and grenadiers.
  - After the camp the game loops with faster, more numerous enemies.
- Nobody shoots in the first two stages, just like the original. Riflemen, bazookas and grenadiers arrive at the bridge.
- **Karate fighters** (white gi, red headband) square up in a stance and then throw a flying kick. Crouch under it or knife them first. They can also leap up onto the level above you.
- Stand still too long and a jet flies over and bombs you.
- One hit kills you. You start with 3 lives and get an extra life every 20,000 points.
- Mines: jump over them, or crouch-stab them for points.
- Special weapons (3 shots each): the **flamethrower** hits everything in a short cone, the **bazooka** fires a rocket across the row (it can also destroy trucks and helicopters), and **grenades** are lobbed and hit across levels.

## Debug

Open `?debug` (e.g. http://localhost:8000/?debug) to enable these keys:

| Key | Action |
| --- | --- |
| `1`–`4` | Jump to a stage |
| `I` | Toggle invincibility |
| `N` | Skip to the stage's end wave |
| `G` | Give yourself a special weapon |

In the console, `__game` holds the game state and `__step(n)` advances the game by n ticks.

## Code

`src/main.js` holds the loop and the state machine. `player.js` and `enemies.js` hold the actors, and `weapons.js` holds the projectiles, pickups, mines, trucks and effects. `levels.js` has the stage data, `tiles.js` renders the scenery, and `sprites.js` has the pixel-art sprites. `audio.js` is a SID-flavoured WebAudio synth with a sequencer and tunes, and `gfx.js` has the font and drawing helpers.

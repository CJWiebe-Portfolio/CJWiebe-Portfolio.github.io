# Another Tally

Turn-based zombie survival game — INFS 634 final project, Cygnus J. Wiebe, Fall 2026.
Built with plain HTML, CSS and JavaScript. No build step, no database.

## Pages

| # | File | Purpose |
|---|------|---------|
| 1 | `index.html` | Title screen and main menu (Continue is disabled until saves exist) |
| 2 | `options.html` | Difficulty, game length, mini-games, seed, text size, high contrast, reduce motion, sound |
| 3 | `how-to-play.html` | Goal, day/night order, resources, survivors and base, mini-games, controls |
| 4 | `new-game.html` | Shelter name, difficulty, length, 3 starting survivors (reroll) |
| 5 | `game.html` | The game: top bar, 5 tabs (Base, Survivors, Map, Trade, Log), side panel, overlays for events, mini-games and pause |
| 6 | `end.html` | Run summary; Play again or Back to title |
| 7 | `credits.html` | Credits, assets, accessibility notes |

Shared files: `css/style.css`, `js/common.js` (loaded on every page), plus one script per page that needs it. `js/minigames.js` holds the three mini-games and is loaded by `game.html`.

## How a run moves between pages

The game itself stays on `game.html`, so a run still lives only in that tab's memory:

- **Options → every page:** settings are preferences, kept in `localStorage` and applied on load (text size, contrast, motion).
- **New game → Game:** the setup is passed in `sessionStorage`; `game.html` reads it once and deletes it, so refreshing or reopening the game page ends the run (it shows "No run in progress").
- **Game → End:** the run summary is passed in `sessionStorage` and read by `end.html`.
- **Pause menu:** Options and How to play open in a new tab so the run isn't lost. Quit to title ends the run. The browser warns before a refresh or close.

## What's placeholder

`js/game.js` is a working shell: tabs, task assignment, map selection, trade balance, log filters, End day → night event → mini-game → dawn, and the end screen all work with placeholder numbers. Game rules to write are marked `TODO` (upgrade timing, scavenging loot, survivor needs, raid strength, trader schedule, losing the game).

## Mini-games

Built in `js/minigames.js`; difficulty scales with the run's difficulty setting. Auto-resolve (button, or Options → Mini-games) rolls a 60% win.

- **Defense** (night raids): zombies walk along 4 lanes toward the wall. Click them, or press 1–4 to shoot the closest one in a lane. Wall strength comes from the Walls level; the wall breaking is a loss.
- **Lockpick** (locked crate): find the hidden pin order. A right pin stays up, a wrong one drops them all. Win = loot (2 resource types).
- **Search** (only after someone scavenged): 5 supplies hidden in a 5×4 grid with limited searches; empty spots show how many supplies are next to them. Everything found is kept; finding enough is a win.

A loss injures one survivor (placeholder consequence in `game.js`).

## Running it

Open `index.html` in a browser, or serve the folder (for example VS Code Live Server, or `python3 -m http.server`). A local server is more reliable than `file://` for `localStorage` and `sessionStorage`.

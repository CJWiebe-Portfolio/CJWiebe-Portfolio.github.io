# Another Tally

This is a hobby made, turn-based zombie survival game, that runs within the browser. You are in charge of leading a small group of survivors through the zombie apocalypse. You have the option to choose game lengths of 15, 30 or 45 days as you will hand out tasks to survivors, scavenge the city, upgrade your shelter, and guard your the walls against endless hordes of zombies that seem to grow in number every night.

This project is entirely created by C. J. Wiebe and served as the final project submission for **INFS 634: Web System Design & Management** . At McGill University in the School of Information Studies for Fall 2026.  
This project takes inspiration from the amazing games _This War of Mine_, developed by 11 Bit Studios, and _State of Decay_, developed by Undead Labs, which are one of my favourite.

This site was built with plain HTML, CSS and JavaScript. There is no frameworks, no build step, no database behind the creation, so it is all local.

**YOU CAN PLAY THE GAME HERE:** <https://cjwiebe-portfolio.github.io/>

---

## Table of Contents:

- [How to play](#how-to-play)
- [Features](#features)
- [Running it locally](#running-it-locally)
- [Pages](#pages)
- [Project structure](#project-structure)
- [How a run moves between pages](#how-a-run-moves-between-pages)
- [Game rules and balancing](#game-rules-and-balancing)
- [Mini-games](#mini-games)
- [Known limitations and next steps](#known-limitations-and-next-steps)
- [Credits](#credits)

---

## How to play

Each turn within the game counts as one day, and each day is played in four phases, Day, Dusk, Night, Dawn.:

1. **Day:** This is were the primary gameplay takes place. Here, you can give each survivor a task (Rest, Scavenge, Build, Guard, Cook or Heal), send scavengers to places on the map, start upgrades and trade.
2. **Dusk:** Here, any scavengers that are sent out return to the make. The base also makes food and water, building continue in the progress, and the group of survivors eat and drink. This information will be displayed in the **Dusk report** which will pop-up and show what happened .
3. **Night:** In this phase, a random event will take place that will asks you to choose between 3 chooses: use a survivor's skill, pay a cost, or play a mini-game. After this is complete, the horde will attack, and your defense will be tested. The resources that will determine your success will be walls, guards and ammo.
4. **Dawn:** Finally, a **Dawn report** will pop-up to provide the summaries of the night before and as the next day starts.

**WINNING CONDITIONS:** The game can be won by keeping at least one survivor alive to the end of the run.
**LOSING CONDITIONS:** The game will be lost when all the survivors are dead.
Survivors die from hunger, thirst, scavenging injuries and night breaches, and a survivor whose morale hits zero leaves the base.

The full rules are on the in-game **How to play** page.

## Features

- Three difficulties and three run lengths, chosen on the New Game page
- Randomly rolled survivors, each with one skill and one trait that change the rules for them
- Eight map locations with different loot, danger and travel time
- Six base facilities with multi-day upgrades
- Night events with skill, cost and mini-game choices
- Four wandering traders who come and go, each with their own stock and wants
- Three mini-games (Defense, Lockpick, Search), with an option to auto-resolve them
- Dusk and Dawn report pop-ups, plus a filterable log of everything that happened
- A seed option in Options for repeatable runs
- Accessibility options: text size, high contrast and reduce motion. The whole game can be played with the keyboard.

## Running it locally

Clone the repo and open `index.html` in a browser. Serving the folder works better, because some browsers limit `localStorage` and `sessionStorage` on `file://` pages:

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000
```

VS Code's Live Server extension works too. Note that refreshing the game page ends the current run on purpose (see below).

## Pages

| #   | File               | Purpose                                                                                                                         |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `index.html`       | Title screen and main menu                                                                                                      |
| 2   | `options.html`     | Difficulty, game length, mini-games, seed, text size, high contrast, reduce motion, sound                                       |
| 3   | `how-to-play.html` | Goal, turn order, resources, tasks, scavenging, night raids, difficulty, skills and traits, mini-games, controls                |
| 4   | `new-game.html`    | Shelter name, difficulty, length, 3 starting survivors (reroll)                                                                 |
| 5   | `game.html`        | The game: top bar, 5 tabs (Base, Survivors, Map, Trade, Log), side panel, and pop-ups for reports, events, mini-games and pause |
| 6   | `end.html`         | Run summary; Play again or Back to title                                                                                        |
| 7   | `credits.html`     | Credits, assets, contact, accessibility notes                                                                                   |

## Project structure

```
├── index.html, options.html, how-to-play.html, new-game.html,
│   game.html, end.html, credits.html
├── css/
│   └── style.css        # all styles, including the dawn/day/dusk/night colour themes
├── js/
│   ├── common.js        # loaded on every page: settings, page hand-off, seeded RNG, skills and traits
│   ├── new-game.js      # rolls the starting survivors and hands the setup to the game
│   ├── game.js          # the game: state, rules, tabs, events, reports
│   ├── minigames.js     # Defense, Lockpick and Search
│   ├── options.js
│   └── end.js
└── assets/
    ├── icons/           # site icon and resource icons
    └── images/          # survivors, locations, facilities, events, title and end art
```

## How a run moves between pages

The game itself stays on `game.html`, so a run lives only in that browser tab's memory:

- **Options → every page:** settings are saved in `localStorage` and applied when each page loads (text size, contrast, motion).
- **New game → Game:** the setup is passed in `sessionStorage`. `game.html` reads it once and deletes it, so refreshing or reopening the game page ends the run and shows "No run in progress".
- **Game → End:** the run summary is passed in `sessionStorage` and read by `end.html`.
- **Pause menu:** Options and How to play open in a new tab so the run isn't lost. Quit to title ends the run, and the browser warns before a refresh or close.

## Game rules and balancing

All the numbers for each difficulty are in the `DIFFICULTY` and `START_RESOURCES` tables near the top of `js/game.js`:

| Setting      | Easy | Normal | Hard | What it does                                      |
| ------------ | ---- | ------ | ---- | ------------------------------------------------- |
| `yield`      | 95%  | 85%    | 80%  | Share of a scavenged haul that makes it home      |
| `threatBase` | 9    | 8      | 7    | Horde strength on night 1                         |
| `threatPeak` | 18   | 22     | 23   | Added by the last night, spread over the run      |
| `starveDmg`  | 10   | 15     | 20   | Health lost per day while starving or dehydrated  |
| `scavRisk`   | 10%  | 15%    | 20%  | Chance of attack per danger level when scavenging |
| `autoWin`    | 70%  | 55%    | 40%  | Chance an auto-resolved mini-game is won          |
| `moraleLoss` | 10   | 15     | 20   | Morale everyone loses when a survivor dies        |
| `tradeMarkup` | 1.0 | 1.15   | 1.3  | How much more value traders ask than they give    |
| `traderGap`  | 2–3  | 3–4    | 4–6  | Days with no trader between visits                |

The main rules and where to find them in `game.js`:

- **Night defense:** `nightDefense()`. 10 per walls level, 5 per guard (10 for a Fighter), plus up to 10 ammo.
- **Night raid:** `nightRaid()`. The horde is compared with your defense, and a breach injures survivors and can lower the walls.
- **Dusk:** the End day click handler. Scavenging, base production, construction, healing, fatigue, eating and drinking.
- **Damage and death:** `hurt()` and `changeMorale()`.
- **Traders:** the `TRADERS` list holds each trader's stock, wants and length of stay. `traderDawn()` runs the schedule each dawn, `buyValue()` adds the 50% bonus (`WANT_BONUS`) for wanted items, and `tradeNeed()` applies the markup and the Negotiator discount. One trade per day stops players from trading the same goods back and forth for profit.

The difficulty was tuned by simulating full runs. Playing sensibly on a 15-day run, about 98% of Easy runs, 90% of Normal and 20% of Hard are won. Doing nothing loses most Normal runs and every Hard run.

## Mini-games

Built in `js/minigames.js`. Their speed, size and time limits scale with the run's difficulty. Auto-resolve (the button in the mini-game, or Options → Mini-games) rolls a win using the difficulty's `autoWin` chance.

- **Defense** (night raids): zombies walk along 4 lanes toward the wall. Click them, or press 1–4 to shoot the closest one in a lane. The wall's strength comes from the Walls level, and the game is lost if the wall breaks.
- **Lockpick** (locked crate): find the hidden pin order. A right pin stays up; a wrong one drops them all. Winning gives loot of 2 resource types.
- **Search** (only after someone scavenged): 5 supplies are hidden in a 5×4 grid and you have limited searches. Empty spots show how many supplies are next to them. You keep everything you find, and finding enough is a win.

Losing a mini-game injures one survivor for 30 health (15 if they're Tough).

## Known limitations and next steps

- No saves or accounts yet. The disabled Continue button and the Options entries are reserved for them.
- There's no way to find new survivors yet, so free beds and the Beds upgrade don't matter.
- The Workshop and Infirmary can be built but don't do anything yet.
- The Military checkpoint is locked and can't be unlocked yet.
- Only four night events exist, so they repeat on longer runs.

## Credits

- **Design, code, art and sound:** Cygnus J. Wiebe
- **Font:** [Special Elite](https://fonts.google.com/specimen/Special+Elite) via Google Fonts, SIL Open Font License
- **Inspired by:** _This War of Mine_ (11 bit studios) and _State of Decay_ (Undead Labs)

**Contact:** [GitHub](https://github.com/CJWiebe-Portfolio) · [LinkedIn](https://www.linkedin.com/in/cygnus-j-wiebe)

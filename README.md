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
2. **Dusk:** Here, any scavengers that are sent out return to the base (except on 2-day trips, which come back the next dusk). The base also makes food and water, building continue in the progress, and the group of survivors eat and drink. This information will be displayed in the **Dusk report** which will pop-up and show what happened .
3. **Night:** In this phase, a random event will take place that will asks you to choose between 3 chooses: use a survivor's skill, pay a cost, or play a mini-game. After this is complete, the horde will attack, and your defense will be tested. The resources that will determine your success will be walls, guards and ammo.
4. **Dawn:** Finally, a **Dawn report** will pop-up to provide the summaries of the night before and as the next day starts. Some mornings bring a smaller event before the day begins.

**WINNING CONDITIONS:** The game can be won by keeping at least one survivor alive to the end of the run.
**LOSING CONDITIONS:** The game will be lost when all the survivors are dead.
Survivors die from hunger, thirst, scavenging injuries and night breaches, and a survivor whose morale hits zero leaves the base.

The full rules are on the in-game **How to play** page.

## Features

- Three difficulties and three run lengths, chosen on the New Game page
- Randomly rolled survivors, each with one of 20 skills and one of 30 traits. On the New Game page the player can keep the roll, reroll everyone or one survivor, or change each survivor's portrait, name, skill, trait and voice. Some help, some hurt and some are just flavour, and the player only ever sees a description, so they have to work out what each one does by playing (the effects and their numbers are in `js/balance.js`)
- 14 map locations in four districts (Downtown, Riverside, Westside, Southside) with different loot, danger, size and travel time. 2-day trips keep a survivor away overnight for a bigger haul, and the Military checkpoint starts locked (cut the fence or find a keycard)
- 14 city events that run for a few days: they close a place or a whole district, make it more or less dangerous, leave extra supplies, bring out survivors, cause a dry spell, or make some night events more likely after a trip there
- Scavengers can be sent from their own card (a destination list grouped by district) or from the Map (click who goes, click again to call them back)
- New survivors join from scavenging trips and events, if there's a free bed
- Six base facilities with 32 small upgrades between them, all built from scratch on every difficulty. Some need others first, five pairs are either/or for the run, and the roof, yard and basement only hold so many, so no two shelters end up the same. Big breaches damage the walls until they're repaired
- Survivors' morale wears down every day and hunger is slow to recover, so keeping the group steady takes work. Shaken survivors (under 30 morale) find less and guard worse, and stockpiled food spoils without a Root Cellar
- 30 night events (4 of them only after a trip to a particular district) and 12 morning events with skill, cost and mini-game choices, offered only when they fit the situation (after a story choice, once something is built, while someone is hurt, later in the run...). They're drawn like marbles from a bag: an event doesn't come back until every other event that fits has had its turn. Some only happen once, and some lead into later events and the story checkpoints. Events the story needs (the flare gun) are guaranteed by halfway through the run (`dueBy` in story.js)
- Four wandering traders who come and go, each with their own stock and wants (every trader visits once before any comes back). A new arrival rings the shop bell and lights up the Trade tab, and the trade bar turns from deep red to deep green as the offer gets better for the trader
- Four mini-games (Defense, Lockpick, Search and the dawn Tally). Each says what winning and losing mean before Start, counts down 3-2-1 when it begins, and has a Skip button; Options can skip every mini-game or just the dawn tally
- A story told through an opening pop-up, four checkpoint events that land on set days for each run length, and six endings that depend on how the run went. The end screen says which ending it was ("Ending 4 of 6") and which ones this browser has found. From the first broadcast on, the Base tab's "Signal for the convoy" card lets the group set up the signal on any day, so the convoy ending is never lost to one morning
- Every event, checkpoint, ending and the opening are written in `js/story.js`, so all the story text can be edited in one place
- Dusk and Dawn report pop-ups in sections (a headline, the night's event, a breakdown of the night raid, supplies in and out, what happened to each survivor, and what to watch next), plus a filterable log of everything that happened
- A seed option in Options for repeatable runs
- Sound: background music, looping ambience for each phase, and stacked sound effects for actions, events, mini-games and the night raid. The Options page has a main volume and separate sliders for music, ambience, zombies, sound effects, voices, and menus and typing (`SOUND_GROUPS` in `common.js` says which sound is which)
- Accessibility options: text size, text speed, high contrast and reduce motion. The whole game can be played with the keyboard (the Defense mini-game is mouse or touch only, so keyboard players use Skip), M mutes and unmutes, and screen readers get typed-out text in full straight away.

## Running it locally

Clone the repo and open `index.html` in a browser. Serving the folder works better, because some browsers limit `localStorage` and `sessionStorage` on `file://` pages:

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000
```

VS Code's Live Server extension works too. Note that refreshing the game page ends the current run on purpose (see below).

## Pages

| #   | File               | Purpose                                                                                                                                 |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `index.html`       | Title screen and main menu                                                                                                              |
| 2   | `options.html`     | Difficulty, game length, mini-games, seed, text size, text speed, high contrast, reduce motion, sound and volume for each kind of sound |
| 3   | `how-to-play.html` | Goal, turn order, resources, tasks, scavenging, new survivors, events, night raids, difficulty, skills and traits, mini-games, controls |
| 4   | `new-game.html`    | Shelter name, difficulty, length, 3 starting survivors (random or edited: portrait, name, skill, trait, voice)                          |
| 5   | `game.html`        | The game: top bar, 5 tabs (Base, Survivors, Map, Trade, Log), side panel, and pop-ups for reports, events, mini-games and pause         |
| 6   | `end.html`         | Run summary; Play again or Back to title                                                                                                |
| 7   | `credits.html`     | Credits, assets, contact, accessibility notes                                                                                           |

## Project structure

```
├── index.html, options.html, how-to-play.html, new-game.html,
│   game.html, end.html, credits.html
├── css/
│   └── style.css        # all styles, including the dawn/day/dusk/night colour themes
├── js/
│   ├── common.js        # loaded on every page: settings, page hand-off, seeded RNG, skills, traits and
│   │                    #   names, music, ambience, sound effects and text speed
│   ├── balance.js       # every balance number (AT.BALANCE): difficulty, upkeep, skills, traits,
│   │                    #   facilities, map, traders, horde, events and mini-games
│   ├── debug.js         # ?debug only: live tuning panel, playtest log, balance.js and workbook export
│   ├── new-game.js      # rolls or edits the starting survivors and hands the setup to the game
│   ├── game.js          # the game: state, rules, tabs, events, reports
│   ├── minigames.js     # Defense, Lockpick, Search and Tally
│   ├── story.js         # all story text: the opening pop-up, every night and morning event,
│   │                    #   the checkpoint events and the endings
│   ├── options.js
│   └── end.js
├── Another_Tally_Balance.xlsx  # built from balance.js by the debug panel (don't type into it)
└── assets/
    ├── audio/           # music, ambience and sound effects (named in SOUNDS in common.js)
    ├── icons/           # site icon and resource icons
    └── images/          # survivors, locations, facilities, events, title and end art
```

## How a run moves between pages

The game itself stays on `game.html`, so a run lives only in that browser tab's memory:

- **Options → every page:** settings are saved in `localStorage` and applied when each page loads (text size, contrast, motion).
- **New game → Game:** the setup is passed in `sessionStorage`. `game.html` reads it once and deletes it, so refreshing or reopening the game page ends the run and shows "No run in progress".
- **Game → End:** the run summary is passed in `sessionStorage` and read by `end.html`.
- **Menu (Esc):** Options and How to play open in a new tab so the run isn't lost. Quit to title ends the run, and the browser warns before a refresh or close.

## Game rules and balancing

Every balance number is in `js/balance.js` and nowhere else. `game.js`, `minigames.js`, `new-game.js` and `how-to-play.html` read them from `AT.BALANCE`, so changing a number there changes the game, the facility cards and the How to play page together. Story events keep their own costs and gains next to their text in `js/story.js`.

### Tuning with ?debug

Add `?debug` to any page's address (e.g. `index.html?debug`) to turn debug mode on for that browser tab; `?debug=off` turns it off. A red DEBUG tag appears in the corner; click it or press `` ` `` for the panel:

- **Tune:** every number in balance.js (and every cost and gain in story.js), with its note. Changes apply straight away and are kept, on every page, until you reset them or turn debug off. Orange numbers differ from the file.
- **Run:** tonight's horde (estimate and real) against your defense, plus shortcuts for testing: add supplies, heal or tire everyone, jump to a day, re-roll the horde, and a notes box for the playtest.
- **Export:** the list of changes with their line numbers, **Copy/Download balance.js** (the whole file with your changes written in and every comment kept), and **Download workbook**.

Every run played in debug mode is logged night by night (horde, defense, supplies, health, morale) in `localStorage`. **Download workbook** builds `Another_Tally_Balance.xlsx` from balance.js, story.js and that log, so the workbook is never filled in by hand: it has difficulty, horde, economy, scavenging, facility, trader, event and mini-game sheets with live formulas, plus Playtests (win rates by difficulty and length) and Nights (every night of every run, ready for a chart).

### Difficulty

`difficulty` and `start.resources` in balance.js ([B1], [B2]):

| Setting       | Easy | Normal | Hard | What it does                                      |
| ------------- | ---- | ------ | ---- | ------------------------------------------------- |
| `yield`       | 85%  | 80%    | 75%  | Share of a scavenged haul that makes it home      |
| `threatBase`  | 8    | 7      | 8    | Horde strength on night 1 (+1 for every survivor beyond three) |
| `threatPeak`  | 22   | 23     | 27   | Added by the last night (×1.15 on 30-day runs, ×1.3 on 45-day runs) |
| `starveDmg`   | 15   | 20     | 25   | Health lost per day while starving, or with no water at all (short rations take a share of it) |
| `scavRisk`    | 15%  | 20%    | 25%  | Chance of attack per danger level when scavenging |
| `autoWin`     | 70%  | 55%    | 40%  | Chance an auto-resolved mini-game is won          |
| `moraleLoss`  | 15   | 20     | 25   | Morale everyone loses when a survivor dies        |
| `tradeMarkup` | 1.15 | 1.3    | 1.45 | How much more value traders ask than they give    |
| `traderGap`   | 3–4  | 4–6    | 5–7  | Days with no trader between visits                |

After the 25 Nov 2026 playtests every difficulty moved down a step: Easy is the old Normal, Normal the old Hard, and Hard goes a step past the old Hard (starting supplies too). The mini-games and `autoWin` kept their old numbers for each difficulty. The old values are in a comment above `difficulty` in balance.js.

### Rules

The rules that use those numbers, and where to find them in `game.js`:

- **Facilities:** `FACILITIES` lists each facility's upgrades (their cost, days, `gives` and effect line are in balance.js [B7] under the same id). An upgrade has a name, and optionally `needs` / `needsAny` (what must be built first), `excludes` (its either/or partner, written on one side only), `space` (roof, yard or basement, with room set in `facilities.spaces`) and `rain` (halved in a dry spell). `BASE` (`facilities.base`) holds what the shelter has with nothing built, and `bonus(key)` adds up `BASE` and every working upgrade, so the numbers and the descriptions stay in one place. `upgradeState()` says whether an upgrade can be built and why not, and `upgradeCost()` / `buildDays()` apply the Builder and Workshop discounts. Each facility's progress is in `state.facilities` (`built`, `damaged`, `building`).
- **Night defense:** `nightDefense()`. Walls upgrades give their `defense`, each guard gives 5 (10 for a Fighter, more with a Lookout or Gun Nests, 3 less while shaken), plus up to `ammoCap` ammo while at least one guard is able to fire it (`shooters()`). The horde's random part is rolled at dawn (`state.hordeRoll`) so the Lookout can show the exact size.
- **Night raid:** `nightRaid()`. The horde is compared with your defense, each active guard fires 1 ammo, and a breach injures survivors. A big one damages the newest working walls upgrade (never the last), unless a Fortified Wall is built. `threatTonight()` grows the horde over the run; `horde.lengthScale` makes the last night bigger on longer runs, `horde.perSurvivor` adds to it for a bigger group, and `tasks.guardNightFatigue` is what a night on watch costs a guard.
- **Map and city events:** `LOCATIONS` (each with a `district` and `loot`; danger, travel, size and `people` chance are in balance.js [B8]) and `DISTRICTS` are in game.js; the city events themselves are written in `js/story.js` [S4b]. `cityDawn()` counts them down and starts new ones (`events.city` sets how often), and `cityAt()`, `isClosed()` and `dangerAt()` say what's going on at a place. `pickEvent()` weights night events by the city events' `boost`.
- **Survivor upkeep:** `survivors.upkeep` (daily morale loss), `survivors.shaken` (low morale), `survivors.fed` (a full meal) and `tasks.spoil` (food going off) are in balance.js [B3] and [B4].
- **Skills and traits:** the descriptions players see are in `js/common.js`; what each one does, with its numbers, is in balance.js [B5] and [B6] (`SK` and `TR` in game.js). They're applied where they matter in game.js (search for the skill or trait name). A Survivalist only needs water every few days (`waterNeeded()`). Skills and traits without an effect are never needed by an event choice.
- **Dusk:** `endDay()`. Scavenging (including 2-day trips, which set `away` on the survivor), base production (fractions build up in `state.bank`), construction and repairs, healing, fatigue, eating, drinking, spoilage and daily morale. Short food or water is shared out, so the damage and hunger depend on how short the group is. Everyone who rests heals 5 health, more with an Infirmary. `home()` is everyone at the shelter; survivors who are away don't work, eat or get hurt there.
- **New survivors:** `recruit()` and `newSurvivor()`. Each location's `people` value is the chance a scavenger meets someone. A newcomer needs a free bed (`freeBeds()`).
- **Events:** the events themselves are written in `js/story.js` (the comment above the night events lists every field an event and its choices can use). Named rewards are in balance.js (`events.rewards`); in `game.js`, `REWARDS` holds the two that need working out in code, `pickEvent()` chooses one that fits, and `applyChoice()` carries it out. `events.morningChance` sets how often mornings bring one.
- **Pictures and sounds still to add:** the six new places (`pharmacy`, `church`, `hardware`, `sporting_goods`, `waterworks`, `warehouse`) show a stand-in picture until their own is drawn; a location's `img` can list several names and the first one that exists is shown. All event and ending pictures are in. An event's `art` can still list several pictures, and the first one that exists is shown, so new events can name pictures before they're drawn. Sounds the events are waiting for are listed, commented out, under "Sounds still to add" in `common.js`.
- **Locked places:** `isLocked()` and `unlock()`. `scavenging.fenceCut` sets the fence cost.
- **Damage and death:** `hurt()` and `changeMorale()`.
- **Traders:** the `TRADERS` list holds each trader's name and wants; their stock and length of stay are in balance.js (`trade.traders`). `traderDawn()` runs the schedule each dawn, `buyValue()` adds the bonus (`trade.wantBonus`) for wanted items, and `tradeNeed()` applies the markup and the Negotiator discount. One trade per day stops players from trading the same goods back and forth for profit.

The difficulty was tuned by simulating full runs of the real game code with bots: a good player, a medium one (no trading, a third of event choices at random), a casual player (fixed roles, random event choices, never heals) and one that does nothing. Mini-games were auto-resolved. Win rates from 200 runs each (24 Nov 2026, with the upgrade trees, the bigger map, the city events and the full set of skills and traits). These are from before the difficulty shift above, so the Easy column now roughly matches the old Normal one; the bots need running again:

| Bot     | Easy 15 / 30 / 45 | Normal 15 / 30 / 45 | Hard 15 / 30 / 45 |
| ------- | ----------------- | ------------------- | ----------------- |
| Good    | 100 / 100 / 100%  | 92 / 85 / 83%       | 50 / 26 / 39%     |
| Medium  | 99 / 100 / 100%   | 77 / 67 / 72%       | 37 / 23 / 30%     |
| Casual  | 99 / 77 / 73%     | 52 / 14 / 7%        | 7 / 2 / 1%        |
| Nothing | 0 / 0 / 0%        | 0 / 0 / 0%          | 0 / 0 / 0%        |

The new negative traits and the skills that do nothing make every group a little weaker, so Normal and Hard went back to their original hordes (8 + 22 and 7 + 23, with Hard keeping 80% of each haul). Morale now averages about 62 on a 30-day Normal run, against 90 before the upgrade trees, and sits at 80 or more about a quarter of the time. Tested one trait at a time on the whole starting group, Tough, Optimist and Quick healer are the strongest traits and Big eater and Forgetful the most costly.

Earlier on 24 Nov: short rations are shared out instead of hurting everyone at full strength, ammo only counts with someone on Guard, a night on watch costs 5 fatigue instead of 15, resting heals 5 health without an Infirmary, and the last night's horde is bigger on 30- and 45-day runs.

## Mini-games

Built in `js/minigames.js`. Their speed, size and time limits scale with the run's difficulty (balance.js [B12]). Auto-resolve (the button in the mini-game, or Options → Mini-games) rolls a win using the difficulty's `autoWin` chance.

- **Defense** (night raids): zombies walk along 4 lanes toward the wall. Click them (keys 1–4 can be turned back on with `laneKeys` in balance.js [B12]). Their picture is `assets/images/png/zombie.png` once it's there, the 🧟 emoji until then. The wall's strength comes from the walls' defense (every 10 counts as a level), and the game is lost if the wall breaks.
- **Lockpick** (locked crate): find the hidden pin order. A right pin stays up; a wrong one drops them all. Winning gives loot of 2 resource types.
- **Search** (only after someone scavenged): 5 supplies are hidden in a 5×4 grid and you have limited searches. Empty spots show how many supplies are next to them. You keep everything you find, and finding enough is a win.
- **Tally** (every dawn): stop the sweeping blade over the marked spot to carve the day's mark. The blade starts slow and speeds up over the run (`rampStart` / `rampEnd` in [B12]). Clean marks lift morale, crooked ones lower it.

Losing a mini-game injures one survivor for 30 health (15 if they're Tough).

## Known limitations and next steps

- No saves or accounts yet. The disabled Continue button and the Options entries are reserved for them.
- Upgrades can't be torn down to free up room in the shelter.
- The numbers in `js/balance.js` were tuned with simulated players. Real playtests will still find things the bots don't, especially in the mini-games, which the bots always auto-resolve.

## Credits

- **Design, code, art and sound:** Cygnus J. Wiebe
- **Sounds from Freesound:** "Zombie attack" (#213509) by soykevin, and "Zombie eating a carcass" (#636147, the background music) by emilybbarrios
- **Font:** [Special Elite](https://fonts.google.com/specimen/Special+Elite) via Google Fonts, SIL Open Font License
- **Inspired by:** _This War of Mine_ (11 bit studios) and _State of Decay_ (Undead Labs)

**Contact:** [GitHub](https://github.com/CJWiebe-Portfolio) · [LinkedIn](https://www.linkedin.com/in/cygnus-j-wiebe)

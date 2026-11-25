/*
=========================================================
FILE: game.js
PROJECT: Another Tally - A zombie survival game
AUTHOR: Cygnus J. Wiebe
DATE: December 14th, 2026
COURSE: INFS 634 - McGill University
=========================================================
DESCRIPTION:
The game screen (game.html). Everything about a run lives in the `state`
object below, in this tab's memory only, so a refresh ends the run.

How a turn flows:
  Day   - the player gives each survivor a task, builds, trades and sends
          scavengers out (Base, Survivors, Map, Trade and Log tabs).
  Dusk  - End day resolves the tasks: scavengers come home (or keep travelling
          on a 2-day trip), the base makes food and water, building moves
          forward and the group eats. The Dusk report shows what happened.
  Night - one event (sometimes a mini-game from minigames.js), then the horde
          tests the night defense. The Dawn report shows the night.
  Dawn  - the Tally mini-game carves the new day's mark on the wall, then
          sometimes a morning event, then the next day starts.

The story (the opening pop-up, every night and morning event, the
checkpoint events on set days and the endings) is written in js/story.js
and read from AT.STORY.

How this file is laid out:
  1. Static game data (resources, difficulty, facilities, map, event rewards, sounds)
  2. Run state
  3. Helpers (survivors, facilities, recruiting, plan checks)
  4. Rendering for the header, side panel and each tab
  5. End day, reports, events, mini-games and the night raid
  6. Leaving the page, pause menu and start-up

Every balance number (difficulty, upkeep, skills, traits, facility costs,
map locations, traders, the horde...) is in js/balance.js and read from
AT.BALANCE, so this file only holds the rules that use them. Open the game
with ?debug to change them live while you play.
=========================================================
TABLE OF CONTENTS
Ctrl+F a tag such as "[S3]" to jump to that section.
Ctrl+K Ctrl+8 folds every region; Ctrl+K Ctrl+9 unfolds them.
=========================================================
[S1] Game Screen: Start-up
[S2] Static Game Data
  [S3] Facilities
  [S4] Map Locations
  [S5] Events (the events themselves are in js/story.js)
    [S6] Event Rewards
    [S7] Morning Chance, Fence, Trips & City Events
  [S8] Mini-game Descriptions
  [S9] Sounds
  [S10] Log Labels & Filters
[S11] Run State
[S12] Helpers
  [S13] Recruiting
  [S14] Facility Checks
  [S15] Bed Count
  [S16] Guard Count
  [S17] Night Defense
  [S18] Builders & Build Costs
  [S19] Health, Morale & Fatigue
  [S20] Log & Skill Checks
  [S21] Toast & Sound Cues
[S22] Plan checks
  [S23] Lookups
  [S24] Traders
  [S24b] City events
  [S25] Food, Healing & Salvage
  [S26] Task Info
  [S27] Dusk & Tonight Forecasts
  [S28] Plan Warnings
[S29] Header
[S30] Side Panel
[S31] Tab badges
[S32] Base Tab
  [S33] Builder picker
[S34] Survivors Tab
[S35] Map Tab
  [S36] Fence Controls
[S37] Trade Tab
[S38] Log Tab
[S39] Tab Switching
[S40] End Day to Dawn
  [S41] Dusk (endDay)
  [S42] Report pop-up
    [S42a] Report Data
    [S42b] Report Sections
  [S43] Typing
  [S44] Event overlay
  [S45] Mini-game Overlay
  [S46] Night Raid
  [S47] Finish Night, Morning & Start Day
[S48] Leaving, Pause & Start-up
  [S49] Leaving the Page
  [S50] Pause Menu
  [S51] Opening Story
  [S52] Start-up (Go)
=========================================================
*/

// #region [S1] Game Screen: Start-up
/*
=========================================================
---------- Game Screen ----------
========================================================
*/

// This function runs the game screen, which is a single-page app with five tabs and overlays for events and mini-games.
(function () {
  "use strict";

  // This is the start-up and run only exists if new-game.html just handed one over.
  // If not, show a message and don't run the game.
  var setup = AT.handoff.takeSetup();
  if (!setup) {
    document.getElementById("no-run").hidden = false;
    return;
  }
  document.getElementById("game").hidden = false;

  var esc = AT.escapeHtml;
  var rng = AT.makeRng(setup.seed ? setup.seed + ":run" : "");
  var $ = function (id) {
    return document.getElementById(id);
  };
  var pad = function (n) {
    return String(n).padStart(2, "0");
  };
  var randInt = function (min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  };
  // A whole number from a [min, max] pair in balance.js, e.g. [60, 100].
  var rollPair = function (pair) {
    return randInt(pair[0], pair[1]);
  };
  // #endregion [S1] Game Screen: Start-up
  // #region [S2] Static Game Data
  /*
=========================================================
---------- Static game data (the numbers are in js/balance.js) ----------
========================================================
*/
  // Define constants for resources.
  var RESOURCES = [
    { id: "food", label: "Food" },
    { id: "water", label: "Water" },
    { id: "materials", label: "Materials" },
    { id: "medicine", label: "Medicine" },
    { id: "ammo", label: "Ammo" },
  ];
  // Every balance number lives in js/balance.js (AT.BALANCE). The names below
  // point into it instead of copying it, so a change made there (or live in
  // the ?debug panel) is always the one the game uses.
  var B = AT.BALANCE;
  var SK = B.skills; // what each skill does (balance.js [B5])
  var TR = B.traits; // what each trait does (balance.js [B6])
  // Starting supplies and how hard each difficulty is (balance.js [B1], [B2]).
  var START_RESOURCES = B.start.resources;
  var DIFFICULTY = B.difficulty;
  var D = DIFFICULTY[setup.difficulty] || DIFFICULTY.normal;
  // What each resource is worth when trading (balance.js [B9]).
  var TRADE_VALUE = B.trade.value;

  // Makes some fields of a game object read from a table in balance.js, so
  // FACILITIES, LOCATIONS and TRADERS below only hold names, pictures and
  // rules, while their numbers stay in balance.js. `where` names the table
  // in the console message if balance.js is missing it.
  function fromBalance(obj, table, fields, where) {
    if (!table) {
      console.error("js/balance.js has no numbers for " + where + ".");
      table = {};
    }
    fields.forEach(function (f) {
      Object.defineProperty(obj, f, {
        get: function () {
          return table[f];
        },
        enumerable: true,
      });
    });
  }

  // Wandering traders. One visits at a time and the next one is never the same person.
  // What they bring and how long they stay are in balance.js [B9] (trade.traders).
  // wants:  what they pay extra for (trade.wantBonus x value). They never sell what they want.
  var TRADERS = [
    {
      id: "marguerite",
      name: "Old Marguerite",
      title: "General goods",
      wants: ["ammo"],
      greet: "helloWoman", // said when you first visit the Trade tab each day
    },
    {
      id: "rook",
      name: "Rook",
      title: "Gun runner",
      wants: ["food", "water"],
    },
    {
      id: "ines",
      name: "Doc Ines",
      title: "Field medic",
      wants: ["materials"],
      greet: "helloWoman",
    },
    {
      id: "abe",
      name: "Abe Tanner",
      title: "Farmer",
      wants: ["ammo", "medicine"],
    },
  ];
  TRADERS.forEach(function (t) {
    fromBalance(
      t,
      B.trade.traders[t.id],
      ["stock", "stays"],
      "the trader " + t.id,
    );
  });
  // Defines tasks that survivors can be assigned to each day
  var TASKS = ["Rest", "Scavenge", "Build", "Guard", "Cook", "Heal"];

  // #region [S3] Facilities
  /*
---------- Facilities [TUNE THESE] ----------
Every facility starts unbuilt. Instead of fixed tiers, each one has a handful
of small upgrades. An upgrade can need others first, some come in either/or
pairs (build one and the other is gone for the run), and some take up room
in the shelter (SPACES), so the roof, yard and basement can't hold everything.

Each upgrade has:
  id        a short unique name, used by `needs` and `excludes`
  name      shown on the card
  needs     upgrades that must be built first (all of them)
  needsAny  upgrades where any one built is enough
  excludes  either/or: once one is built or started, the other can't be
  space     "roof", "yard" or "basement": takes one slot there
  rain      true: makes less in a dry spell (see the city events in story.js)

Its numbers are in balance.js [B7] under the same id: cost (materials),
days (of work), gives (what it adds to the shelter) and effect (the line on
the card, filled in from gives).

"none" says what the base does without the facility. {base.rest} and the
like are filled in from the base values in balance.js.
*/
  // What the shelter has with nothing built. Upgrades add to these. The names
  // (sleeps, rest, defense...) are explained in balance.js [B7].
  var BASE = B.facilities.base;

  // Room in the shelter. Upgrades with a `space` take one slot there. How many
  // slots each has is in balance.js [B7] (facilities.spaces).
  var SPACES = {
    roof: { label: "Roof" },
    yard: { label: "Yard" },
    basement: { label: "Basement" },
  };
  Object.keys(SPACES).forEach(function (k) {
    Object.defineProperty(SPACES[k], "slots", {
      get: function () {
        return B.facilities.spaces[k];
      },
      enumerable: true,
    });
  });

  var FACILITIES = [
    {
      id: "beds",
      sound: "cardboardBox", // plays over the hammering when work starts
      img: "bedroom",
      name: "Beds",
      desc: "Better sleep, room for newcomers, and somewhere to unwind",
      none: "Bedrolls on the floor. Rest recovers {base.rest} fatigue. Sleeps {base.sleeps}.",
      upgrades: [
        {
          id: "cots",
          name: "Salvaged Cots",
        },
        {
          id: "bunks",
          name: "Bunk Room",
          needs: ["cots"],
        },
        {
          id: "quiet",
          name: "Quiet Room",
          needs: ["cots"],
          excludes: ["common"],
          space: "basement",
        },
        {
          id: "common",
          name: "Common Room",
          needs: ["cots"],
          excludes: ["quiet"],
        },
        {
          id: "barracks",
          name: "Barracks",
          needs: ["bunks"],
        },
      ],
    },
    {
      id: "kitchen",
      sound: "shovel", // plays over the hammering when work starts
      img: "kitchen",
      name: "Kitchen and garden",
      desc: "Grows, cooks and keeps food",
      none: "No kitchen. The base makes no food.",
      upgrades: [
        {
          id: "campKitchen",
          name: "Camp Kitchen",
        },
        {
          id: "vegBeds",
          name: "Vegetable Beds",
          needs: ["campKitchen"],
          space: "yard",
        },
        {
          id: "greenhouse",
          name: "Rooftop Greenhouse",
          needs: ["campKitchen"],
          space: "roof",
        },
        {
          id: "smokehouse",
          name: "Smokehouse",
          needs: ["campKitchen"],
          excludes: ["rootCellar"],
          space: "yard",
        },
        {
          id: "rootCellar",
          name: "Root Cellar",
          needs: ["campKitchen"],
          excludes: ["smokehouse"],
          space: "basement",
        },
        {
          id: "coop",
          name: "Chicken Coop",
          needsAny: ["vegBeds", "greenhouse"],
          space: "yard",
        },
      ],
    },
    {
      id: "water",
      sound: "rustyMetal", // plays over the hammering when work starts
      img: "watercollector",
      name: "Water supply",
      desc: "Collects, draws and stores water",
      none: "No water supply. The base gathers no water.",
      upgrades: [
        {
          id: "barrels",
          name: "Rain Barrels",
          rain: true,
        },
        {
          id: "catchment",
          name: "Rooftop Catchment",
          needs: ["barrels"],
          rain: true,
          space: "roof",
        },
        {
          id: "well",
          name: "Hand-dug Well",
          needs: ["barrels"],
          space: "yard",
        },
        {
          id: "filter",
          name: "Charcoal Filter",
          needs: ["barrels"],
        },
        {
          id: "cistern",
          name: "Cistern",
          needsAny: ["catchment", "well"],
          space: "basement",
        },
      ],
    },
    {
      id: "workshop",
      sound: "woodCutting", // plays over the hammering when work starts
      img: "workshop",
      name: "Workshop",
      desc: "Makes building cheaper, and makes tools for the road",
      none: "No workshop. Builds cost full price.",
      upgrades: [
        {
          id: "toolBench",
          name: "Tool Bench",
        },
        {
          id: "repairShop",
          name: "Repair Shop",
          needs: ["toolBench"],
        },
        {
          id: "bikeRack",
          name: "Bike Rack",
          needs: ["toolBench"],
          space: "yard",
        },
        {
          id: "fabShop",
          name: "Fabrication Shop",
          needs: ["repairShop"],
          excludes: ["armory"],
          space: "basement",
        },
        {
          id: "armory",
          name: "Reloading Bench",
          needs: ["repairShop"],
          excludes: ["fabShop"],
          space: "basement",
        },
      ],
    },
    {
      id: "infirmary",
      sound: "cabinet", // plays over the hammering when work starts
      img: "infirmary",
      name: "Infirmary",
      desc: "Heals survivors who rest, or grows its own medicine",
      none: "No infirmary. Resting survivors heal {base.restHeal} health at dusk.",
      upgrades: [
        {
          id: "firstAid",
          name: "First Aid Station",
        },
        {
          id: "sickBay",
          name: "Sick Bay",
          needs: ["firstAid"],
          excludes: ["herbGarden"],
        },
        {
          id: "herbGarden",
          name: "Herb Garden",
          needs: ["firstAid"],
          excludes: ["sickBay"],
          space: "yard",
        },
        {
          id: "fieldHospital",
          name: "Field Hospital",
          needs: ["sickBay"],
        },
        {
          id: "apothecary",
          name: "Apothecary",
          needs: ["herbGarden"],
        },
      ],
    },
    {
      id: "walls",
      sound: "woodSplitting", // plays over the hammering when work starts
      img: "watchtower",
      name: "Walls and watch",
      desc: "Raises night defense, or makes your guards count for more",
      none: "No walls. Only guards and ammo hold the horde back.",
      upgrades: [
        {
          id: "barricades",
          name: "Scrap Barricades",
        },
        {
          id: "palisade",
          name: "Palisade",
          needs: ["barricades"],
        },
        {
          id: "lookout",
          name: "Lookout",
          needs: ["barricades"],
          space: "roof",
        },
        {
          id: "spikePit",
          name: "Spike Pit",
          needs: ["barricades"],
          space: "yard",
        },
        {
          id: "fortified",
          name: "Fortified Wall",
          needs: ["palisade"],
          excludes: ["gunNests"],
        },
        {
          id: "gunNests",
          name: "Gun Nests",
          needs: ["palisade"],
          excludes: ["fortified"],
        },
      ],
    },
  ];
  // Every upgrade by id, each tagged with its facility. Either/or pairs are
  // made to work both ways, so `excludes` only has to be written on one side.
  // Each upgrade's cost, days and gives come from balance.js [B7], and its
  // effect line is filled in from them there.
  var UPGRADES = {};
  FACILITIES.forEach(function (f) {
    f.upgrades.forEach(function (u) {
      u.facility = f.id;
      UPGRADES[u.id] = u;
      fromBalance(
        u,
        B.facilities.upgrades[u.id],
        ["cost", "days", "gives"],
        "the upgrade " + u.id,
      );
      Object.defineProperty(u, "effect", {
        get: function () {
          return AT.balance.effect(u.id);
        },
        enumerable: true,
      });
    });
  });
  Object.keys(UPGRADES).forEach(function (id) {
    (UPGRADES[id].excludes || []).forEach(function (other) {
      var o = UPGRADES[other];
      o.excludes = o.excludes || [];
      if (o.excludes.indexOf(id) === -1) o.excludes.push(id);
    });
  });
  // #endregion [S3] Facilities

  // #region [S4] Map Locations
  /*
---------- Map Locations [TUNE THESE] ----------
The city is split into four districts. City events (story.js) can close a
district or a single place for a few days, make it more dangerous, or leave
extra supplies there.

Each location has:
  district  one of the DISTRICTS ids
  x, y      % across and down the square map.png (0,0 is the top-left corner)
  loot      what a haul is made of. A kind listed twice turns up twice as often.
  img       picture name(s) in assets/images/png/; the first one that exists is shown
  locked    starts locked: cut the fence (Map) or find a keycard (event)

Each location's danger, travel days, size and people chance are in
balance.js [B8] (scavenging.locations) under the same id.
*/
  // x, y place each district's name on the map (on a road, like a street sign).
  var DISTRICTS = {
    downtown: { name: "Downtown", x: 40, y: 29.5 },
    market: { name: "Riverside", x: 67, y: 69 },
    outskirts: { name: "Westside", x: 11, y: 29.5 },
    southside: { name: "Southside", x: 47, y: 69 },
  };

  var LOCATIONS = [
    // Downtown
    {
      id: "hospital",
      district: "downtown",
      name: "Hospital",
      x: 42,
      y: 16.4,
      finds: "Medicine, food",
      loot: ["medicine", "food"],
    },
    {
      id: "police",
      district: "downtown",
      img: "police_station",
      name: "Police station",
      x: 69,
      y: 26,
      finds: "Ammo, medicine",
      loot: ["ammo", "medicine"],
    },
    {
      id: "pharmacy",
      district: "downtown",
      img: ["pharmacy", "event_pharmacy"],
      name: "Pharmacy",
      x: 62,
      y: 5,
      finds: "Medicine, bottled water",
      loot: ["medicine", "water"],
    },
    {
      id: "church",
      district: "downtown",
      img: ["church", "event_letters"],
      name: "Church",
      x: 35,
      y: 37,
      finds: "Food, medicine. People shelter here.",
      loot: ["food", "food", "medicine"],
    },
    // Riverside
    {
      id: "supermarket",
      district: "market",
      name: "Supermarket",
      x: 69,
      y: 54,
      finds: "Food, water",
      loot: ["food", "water"],
    },
    {
      id: "hardware",
      district: "market",
      img: ["hardware", "workshop"],
      name: "Hardware store",
      x: 80,
      y: 36,
      finds: "Materials, some ammo",
      loot: ["materials", "materials", "ammo"], // + ammo so every pair of supplies has a place (playtest)
    },
    {
      id: "sporting",
      district: "market",
      img: ["sporting_goods", "event_deserter"],
      name: "Sporting goods",
      x: 77,
      y: 62.5,
      finds: "Ammo, food, water",
      loot: ["ammo", "food", "water"], // + water (camping gear) for the ammo and water pair
    },
    {
      id: "waterworks",
      district: "market",
      img: ["waterworks", "event_water"],
      name: "Waterworks",
      x: 86,
      y: 4.5,
      finds: "Water, materials",
      loot: ["water", "water", "materials"],
    },
    // Westside
    {
      id: "gas",
      district: "outskirts",
      img: "gas_station",
      name: "Gas station",
      x: 13,
      y: 19.6,
      finds: "Materials, bottled water",
      loot: ["materials", "water"],
    },
    {
      id: "farm",
      district: "outskirts",
      name: "Farm",
      x: 11,
      y: 40.4,
      finds: "Food, water",
      loot: ["food", "water"],
    },
    {
      id: "suburb",
      district: "outskirts",
      name: "Suburb",
      x: 10,
      y: 67.6,
      finds: "Materials, food",
      loot: ["materials", "food"],
    },
    // Southside
    {
      id: "school",
      district: "southside",
      name: "School",
      x: 38,
      y: 64.4,
      finds: "Materials, food, medicine",
      loot: ["materials", "materials", "food", "medicine"], // + the nurse's office, for materials and medicine
    },
    {
      id: "warehouse",
      district: "southside",
      img: ["warehouse", "event_crate"],
      name: "Warehouse",
      x: 79,
      y: 96,
      finds: "Food, water, materials",
      loot: ["food", "water", "materials"],
    },
    {
      id: "military",
      district: "southside",
      img: "military_checkpoint",
      name: "Military checkpoint",
      x: 58,
      y: 78.8,
      finds: "Ammo, medicine",
      loot: ["ammo", "medicine"],
      locked: true, // starts locked: cut the fence (Map) or find a keycard (event)
    },
  ];
  LOCATIONS.forEach(function (l) {
    fromBalance(
      l,
      B.scavenging.locations[l.id],
      ["danger", "travel", "size", "people"],
      "the location " + l.id,
    );
  });
  var SHELTER_POS = { x: 41, y: 46 };
  // #endregion [S4] Map Locations

  // #region [S5] Events
  /* 
---------- Events [WORK IN PROGRESS NEEDS TUNING] ----------
Every event (night and morning) is written in js/story.js, along with the
list of fields an event and its choices can use. This file only keeps the
rules behind them: the REWARDS, how often mornings bring an event, and
pickEvent() / applyChoice() further down.
*/
  var EVENTS = AT.STORY.events;

  // #region [S6] Event Rewards
  // Supplies that event choices bring in when they name one with `reward`
  // (simple amounts can be written straight into story.js with `gain`). Most
  // are plain amounts in balance.js [B11] (events.rewards); the two below
  // work something out as well. Each rolls fresh numbers every time, using
  // the run's seeded rng. Add a name to the list in story.js [S2] when you
  // add one to balance.js.
  var REWARDS = {
    // A forced crate holds the same as a picked lock.
    crate: function () {
      return AT.minigames.autoResult("Lockpick", true, rng).reward;
    },
    // A water supply catches more of the storm.
    rain: function () {
      var got = rollGain(B.events.rewards.rain);
      got.water = (got.water || 0) + Math.round(bonus("water"));
      return got;
    },
  };
  // Rolls a reward by name: one of the REWARDS above, or the amounts in balance.js.
  function rollReward(name) {
    if (REWARDS[name]) return REWARDS[name]();
    if (!B.events.rewards[name])
      console.error("No reward called " + name + " in balance.js.");
    return rollGain(B.events.rewards[name]);
  }
  // Rolls a `gain` from story.js: a number is that many, and a pair of
  // numbers [min, max] rolls between them, e.g. { food: [2, 4] }.
  function rollGain(gain) {
    var out = {};
    Object.keys(gain || {}).forEach(function (k) {
      var v = gain[k];
      out[k] = Array.isArray(v) ? randInt(v[0], v[1]) : v;
    });
    return out;
  }
  // #endregion [S6] Event Rewards

  // #region [S7] Morning Chance, Fence, Trips & City Events
  // The chance of a morning event, the fence cut, long trips and how often
  // city events happen are all in balance.js ([B8] and [B11]).
  // Cutting the Military checkpoint fence is cheaper with one of these at the shelter.
  var FENCE_SKILLS = ["Builder", "Mechanic"];
  // City events (written in story.js [S4b]). How often they start is in
  // balance.js [B11] (events.city).
  var CITY_EVENTS = AT.STORY.cityEvents;
  var CITY = B.events.city;
  // #endregion [S7] Morning Chance, Fence, Trips & City Events
  // #endregion [S5] Events

  // #region [S8] Mini-game Descriptions
  /* 
---------- Minigame descriptions ----------
*/
  // What the player reads before pressing Start. MINIGAME_STAKES (below)
  // adds a line saying what winning and losing mean.
  var MINIGAMES = {
    Defense:
      "Zombies come at the wall along four lanes. Click each one before it reaches the wall. A missed click jams your gun for a moment and chips the wall, so aim before you click. Hold the wall until time runs out, or until every zombie is down.",
    Lockpick:
      "The pins have to go up in one secret order. Click a pin: if it's the next one, it clicks into place; if not, every pin drops and you start again. Remember which ones failed. Set them all before time runs out.",
    Search:
      "Supplies are hidden in the room. Each click searches one spot. An empty spot shows how many supplies are next to it, like Minesweeper, and 🧟 means a zombie is close. A zombie bite costs a search and some health. You keep everything you find.",
    Tally:
      "A blade sweeps back and forth across the wall. Stop it over the marked spot (click, Space or Enter) to carve today's mark. You get three tries. The blade starts slow and gets faster as the run goes on.",
  };
  // The win/lose line under each description. Numbers come from balance.js.
  function minigameStakes(name) {
    var hurtBy = B.events.minigameLossDamage;
    if (name === "Tally")
      return (
        "Clean mark: everyone +" +
        TALLY.clean +
        " morale (+" +
        TALLY.fifth +
        " on every fifth). Crooked mark: " +
        TALLY.crooked +
        " morale."
      );
    var win = {
      Defense: "the wall holds and the event's reward is yours",
      Lockpick: "the crate opens (two kinds of supplies)",
      Search: "you found enough, and you keep every find either way",
    }[name];
    return "Win: " + win + ". Lose: one survivor loses " + hurtBy + " health.";
  }
  // What carving the dawn tally does to everyone's morale (balance.js [B11]).
  var TALLY = B.tally;
  // Survivors' needs wear down a little every day (balance.js [B3]):
  // morale lost each dusk, more while hungry or hurt.
  var UPKEEP = B.survivors.upkeep;
  // Below this morale a survivor is shaken (balance.js [B3]).
  var SHAKEN = B.survivors.shaken;
  // #endregion [S8] Mini-game Descriptions

  // #region [S9] Sounds
  /* 
---------- Sounds ----------
Sound names are listed in common.js (SOUNDS). A list of names plays them
stacked on top of each other; [name, ms] starts that one a little later.
*/
  // Plays when the player picks a task for a survivor.
  var TASK_SOUNDS = {
    Rest: "lightSwitch",
    Scavenge: "footsteps",
    Build: "buildingHammering",
    Guard: "guardReady",
    Cook: "stove",
    Heal: "openJar",
  };
  // Footsteps when sending someone out, by the location's danger (1 to 3).
  var SCAVENGE_STEPS = ["", "footsteps", "carefulWalking", "glassSteps"];
  // Looping ambience for each phase, plus one-off extras layered over it now and
  // then. every: [min, max] seconds between extras.
  var PHASE_SOUNDS = {
    dawn: { ambience: "ambMorning" },
    day: {
      ambience: "ambDay",
      extras: { sounds: ["ambDayExtra"], every: [45, 120] },
    },
    dusk: { ambience: "ambEvening" },
    night: {
      ambience: "ambNight",
      extras: { sounds: ["zombieGroan"], every: [12, 35] },
    },
  };
  // What an auto-resolved mini-game sounds like, won or lost.
  var AUTO_SOUNDS = {
    Defense: {
      won: ["gunshot", ["gunshot", 300], ["zombieDying", 650]],
      lost: ["zombieAttack", ["woodSplitting", 400], ["zombieScream", 800]],
    },
    Lockpick: {
      won: ["lockClick", ["rustyHinges", 400]],
      lost: ["rustyMetal", ["glassBreak", 300], ["zombieSpotted", 700]],
    },
    Search: {
      won: ["rummage", ["canJiggle", 600]],
      lost: ["rummage", ["zombieSpotted", 600]],
    },
    Tally: {
      won: ["tally"],
      lost: ["tally", ["rustyMetal", 250]],
    },
  };
  // #endregion [S9] Sounds

  // #region [S10] Log Labels & Filters
  /* 
---------- Logs will record all that happens ----------
*/
  var LOG_LABELS = {
    event: "Event",
    exploring: "Exploring",
    night: "Night raid",
    trade: "Trade",
    base: "Base",
    city: "City",
  };
  var LOG_FILTERS = [
    { id: "all", label: "All" },
    { id: "event", label: "Events" },
    { id: "exploring", label: "Exploring" },
    { id: "night", label: "Night raids" },
    { id: "trade", label: "Trade" },
    { id: "base", label: "Base" },
    { id: "city", label: "City" },
  ];
  // #endregion [S10] Log Labels & Filters
  // #endregion [S2] Static Game Data

  // #region [S11] Run State
  /*
=========================================================
---------- Run State ----------
========================================================
*/
  var state = {
    shelter: setup.shelter,
    difficulty: setup.difficulty,
    length: setup.length,
    day: 1,
    phase: "day",
    // One entry per day carved on the wall: true = clean, false = crooked.
    // Day 1's mark is made on arrival; each dawn's Tally mini-game adds the next.
    tallies: [true],
    resources: Object.assign(
      {},
      START_RESOURCES[setup.difficulty] || START_RESOURCES.normal,
    ),
    // Every facility starts unbuilt (level 0) on every difficulty.
    // Every facility starts unbuilt on every difficulty.
    //   built:    upgrade ids, in the order they were finished
    //   damaged:  built upgrades a breach knocked out (they give nothing until repaired)
    //   building: the job in progress, { id, left, total, repair } or null
    facilities: FACILITIES.map(function (f) {
      return Object.assign({}, f, { built: [], damaged: [], building: null });
    }),
    // Fractions of food, water and medicine made so far (see endDay).
    bank: { food: 0, water: 0, medicine: 0 },
    // City events going on right now: { id, left } (see cityDawn and story.js).
    city: [],
    survivors: setup.survivors.map(function (s, i) {
      return {
        id: "s" + i,
        name: s.name,
        skill: s.skill,
        trait: s.trait,
        avatar: s.avatar || 1,
        voice: s.voice, // picked on the New Game page (see voice())
        health: rollPair(B.start.health),
        hunger: rollPair(B.start.hunger),
        fatigue: rollPair(B.start.fatigue),
        morale: rollPair(B.start.morale),
        status: "Healthy",
        alive: true,
        lostOn: null,
        task: ["Scavenge", "Build", "Guard"][i] || "Rest",
        target: i === 0 ? "hospital" : null,
        away: 0, // days left on a long trip (see endDay); 0 = at the shelter
      };
    }),
    explored: [],
    unlocked: [], // ids of map locations that started locked and have been opened
    recruited: 0, // survivors who joined during the run (shown on the end screen)
    flags: {}, // story flags set by event and checkpoint choices (see js/story.js), e.g. { signal: true }
    lastEvent: null, // title of the last event, so the same one doesn't come twice in a row
    seenEvents: [], // titles of every event shown this run (for events marked `once`)
    eventBag: { night: [], morning: [] }, // events played since the bag was last emptied (see pickEvent)
    eventTime: "night", // "night" or "morning": what happens after the current event
    currentChoice: null, // the choice picked for the current event (for mini-game wins)
    selectedLocation: "hospital",
    trade: { give: {}, get: {} },
    // The first trader is already here on day 1. See makeTrader() and traderDawn().
    trader: makeTrader(TRADERS[0], B.start.firstTraderStays),
    log: [],
    logFilter: "all",
    eventsFaced: 0,
    suppliesGathered: 0,
    currentEvent: null,
    logSeen: 0, // how many log entries the player has seen on the Log tab (for its badge)
    logOpen: {}, // which days the player has opened or closed in the Log
    hordeRoll: randInt(-B.horde.roll, B.horde.roll), // tonight's horde is threatTonight() + this; rolled each dawn
    traderBag: [TRADERS[0].id], // traders who've visited since the bag was last emptied
    traderNew: false, // a trader arrived this dawn and hasn't been announced yet
    dayStartRes: null, // supplies when the day began (for the +/− on the resource tiles)
    dayDelta: {}, // what changed since the morning before
  };
  state.dayStartRes = Object.assign({}, state.resources);
  var leaving = false; // true once the run is over, so leaving the page doesn't ask "are you sure?"
  // What happened since the last report pop-up, gathered for the next one.
  // See [S42a] Report Data. A new one starts at dusk and with each event.
  var report = newReport();
  // #endregion [S11] Run State

  // #region [S12] Helpers
  /*
=========================================================
---------- Helpers: survivors ----------
=========================================================
*/
  // Everyone still in the group, including anyone away on a long trip.
  function alive() {
    return state.survivors.filter(function (s) {
      return s.alive;
    });
  }
  // Everyone in the group who is at the shelter today. Survivors away on a
  // 2-day trip can't guard, build, cook, heal or be healed, don't eat from the
  // stores, and are safe from whatever happens at the shelter.
  function home() {
    return alive().filter(function (s) {
      return !s.away;
    });
  }
  // True while a map location is still closed to scavengers.
  function isLocked(loc) {
    return Boolean(loc.locked) && state.unlocked.indexOf(loc.id) === -1;
  }
  // Opens a locked map location and logs it.
  function unlock(id, cat) {
    var loc = findLoc(id);
    if (!loc || !isLocked(loc)) return;
    state.unlocked.push(id);
    addLog(
      cat || "exploring",
      "The " + loc.name + " is open. Scavengers can go there now.",
      "good",
    );
  }
  // Free beds: beds the facility provides minus everyone in the group.
  function freeBeds() {
    return bedCount() - alive().length;
  }
  // Picks one survivor at the shelter to take a hit, sparing Cowards when
  // anyone else is there. Returns undefined if no one is home.
  function pickVictim() {
    var pool = home().filter(function (s) {
      return s.trait !== "Coward";
    });
    if (!pool.length) pool = home();
    return pool[Math.floor(rng() * pool.length)];
  }

  // #region [S13] Recruiting
  /*
---------- Recruiting ----------
New survivors join from scavenging trips (each location's `people` chance) and
from some events (`recruit` on a choice). They need a free bed: without one
they can't stay. Names, skills, traits and portraits come from common.js.
*/
  // Makes a new survivor with a name nobody in this run has had, and the
  // portrait used by the fewest people in the group.
  function newSurvivor() {
    var taken = state.survivors.map(function (s) {
      return s.name;
    });
    var names = AT.NAMES.filter(function (n) {
      return taken.indexOf(n) === -1;
    });
    if (!names.length) names = AT.NAMES;
    var skills = Object.keys(AT.SKILLS);
    var traits = Object.keys(AT.TRAITS);
    var avatar = AT.AVATARS.slice().sort(function (a, b) {
      return countAvatar(a) - countAvatar(b);
    })[0];
    return {
      id: "s" + state.survivors.length,
      name: names[Math.floor(rng() * names.length)],
      skill: skills[Math.floor(rng() * skills.length)],
      trait: traits[Math.floor(rng() * traits.length)],
      avatar: avatar,
      // Newcomers arrive worn down, so they usually rest on their first day.
      health: rollPair(B.survivors.newcomer.health),
      hunger: rollPair(B.survivors.newcomer.hunger),
      fatigue: rollPair(B.survivors.newcomer.fatigue),
      morale: rollPair(B.survivors.newcomer.morale),
      status: "Healthy",
      alive: true,
      lostOn: null,
      task: "Rest",
      target: null,
      away: 0,
    };
  }
  // How many people in the group use a portrait.
  function countAvatar(n) {
    return alive().filter(function (s) {
      return s.avatar === n;
    }).length;
  }

  // Adds a newcomer if there's a free bed. `cat` is the log category and
  // `where` finishes the sentence about where they came from. Returns the new
  // survivor, or null if there was no bed for them.
  function recruit(cat, where) {
    if (freeBeds() <= 0) {
      addLog(
        cat,
        "A survivor " +
          where +
          " wanted to join, but there was no free bed. Build more beds to take people in.",
        "bad",
      );
      return null;
    }
    var s = newSurvivor();
    if (s.health < B.survivors.injuredBelow) s.status = "Injured";
    state.survivors.push(s);
    state.recruited += 1;
    note(s, "Joined the group", "good");
    report.joined.push(s.name);
    addLog(
      cat,
      s.name +
        " (" +
        s.skill +
        ", " +
        s.trait.toLowerCase() +
        ") joined the group " +
        where +
        ".",
      "good",
      true,
    );
    // A new face lifts everyone a little.
    alive().forEach(function (o) {
      if (o !== s) changeMorale(o, B.survivors.joinMorale);
    });
    cue("knockSoft", 3400); // a knock at the door with the next report
    return s;
  }

  // Adds a set of supplies (e.g. { food: 2 }) to the stores and logs it.
  // Only events and mini-games use this, so the report shows it with the event.
  function gainSupplies(cat, gained) {
    var total = 0;
    Object.keys(gained || {}).forEach(function (k) {
      if (gained[k] > 0) {
        changeSupply(k, gained[k]);
        total += gained[k];
      }
    });
    if (!total) return;
    state.suppliesGathered += total;
    report.effects = report.effects.concat(supplyPills(gained, "good"));
    addLog(
      cat,
      "Brought back " + AT.minigames.describe(gained) + ".",
      "good",
      true,
    );
  }
  // #endregion [S13] Recruiting
  // #region [S14] Facility Checks
  // ---------- Facilities and their upgrades ----------
  function facility(id) {
    return state.facilities.find(function (f) {
      return f.id === id;
    });
  }
  // Looks up an upgrade by id (see FACILITIES). Each one knows its facility.
  function upgrade(id) {
    return UPGRADES[id];
  }
  // Built upgrades count toward `needs` even while damaged; damaged ones give nothing.
  function isBuilt(id) {
    var u = UPGRADES[id];
    return Boolean(u) && facility(u.facility).built.indexOf(id) !== -1;
  }
  function isDamaged(id) {
    var u = UPGRADES[id];
    return Boolean(u) && facility(u.facility).damaged.indexOf(id) !== -1;
  }
  // True while an upgrade is being built (or repaired).
  function isBuilding(id) {
    var u = UPGRADES[id];
    var job = u && facility(u.facility).building;
    return Boolean(job) && job.id === id;
  }
  // How many upgrades a facility has built (0 = not built yet).
  function builtCount(f) {
    return f.built.length;
  }
  // Every built upgrade that isn't damaged.
  function workingUpgrades() {
    var list = [];
    state.facilities.forEach(function (f) {
      f.built.forEach(function (id) {
        if (f.damaged.indexOf(id) === -1) list.push(UPGRADES[id]);
      });
    });
    return list;
  }
  // What the shelter has for one of the BASE names: the base value plus what
  // every working upgrade gives. Rain-fed upgrades give less in a dry spell.
  function bonus(key) {
    var dry = cityHas("drought");
    return workingUpgrades().reduce(function (sum, u) {
      var g = (u.gives && u.gives[key]) || 0;
      return sum + (u.rain && dry ? g * B.facilities.drySpellShare : g);
    }, BASE[key] || 0);
  }
  // Upgrades built, being built, or being repaired in one of the SPACES.
  function spaceUsers(space) {
    return Object.keys(UPGRADES)
      .map(function (id) {
        return UPGRADES[id];
      })
      .filter(function (u) {
        return u.space === space && (isBuilt(u.id) || isBuilding(u.id));
      });
  }
  // Where an upgrade stands, and why it can't be built if it can't:
  // { status, reason }. status is "built", "damaged", "building", "open",
  // "busy" (another upgrade here is in progress), "locked" (needs something
  // first), "excluded" (its either/or partner was chosen) or "full" (no room).
  function upgradeState(u) {
    var f = facility(u.facility);
    if (isBuilding(u.id))
      return {
        status: "building",
        reason: f.building.repair ? "Being repaired" : "In progress",
      };
    if (isBuilt(u.id))
      return isDamaged(u.id)
        ? {
            status: "damaged",
            reason: "Damaged in a breach. Repair it to use it again.",
          }
        : { status: "built", reason: "" };
    var rival = (u.excludes || []).filter(function (id) {
      return isBuilt(id) || isBuilding(id);
    })[0];
    if (rival)
      return {
        status: "excluded",
        reason: "Can't have both. You chose the " + UPGRADES[rival].name + ".",
      };
    var missing = (u.needs || []).filter(function (id) {
      return !isBuilt(id);
    });
    if (missing.length)
      return {
        status: "locked",
        reason:
          "Needs the " +
          nameList(
            missing.map(function (id) {
              return UPGRADES[id].name;
            }),
            "and",
          ) +
          ".",
      };
    if (
      u.needsAny &&
      !u.needsAny.some(function (id) {
        return isBuilt(id);
      })
    )
      return {
        status: "locked",
        reason:
          "Needs the " +
          nameList(
            u.needsAny.map(function (id) {
              return UPGRADES[id].name;
            }),
            "or",
          ) +
          ".",
      };
    if (u.space) {
      var users = spaceUsers(u.space);
      if (users.length >= SPACES[u.space].slots)
        return {
          status: "full",
          reason:
            "The " +
            SPACES[u.space].label.toLowerCase() +
            " is full (" +
            users
              .map(function (x) {
                return x.name;
              })
              .join(", ") +
            ").",
        };
    }
    if (f.building)
      return {
        status: "busy",
        reason: "Finish the " + UPGRADES[f.building.id].name + " first.",
      };
    return { status: "open", reason: "" };
  }
  // #endregion [S14] Facility Checks
  // #region [S15] Bed Count
  // ---------- Checks the number of available beds ----------
  function bedCount() {
    return bonus("sleeps");
  }
  // #endregion [S15] Bed Count
  // #region [S16] Guard Count
  // ---------- Checks the number of available guards ----------
  function guards() {
    return home().filter(function (s) {
      return s.task === "Guard";
    }).length;
  }
  // Guards who will actually fight tonight (not too tired, not hiding).
  function shooters() {
    return home().filter(function (s) {
      return guardPower(s) > 0;
    }).length;
  }
  // #endregion [S16] Guard Count
  // #region [S17] Night Defense
  // ---------- Checks the night defense value ----------
  // How much night defense one survivor adds. Skills/traits are defined in common.js.
  // A shaken survivor (low morale) adds less.
  function guardPower(s) {
    if (
      s.task !== "Guard" ||
      s.trait === "Coward" ||
      s.fatigue >= B.survivors.tired
    )
      return 0;
    var power = s.skill === "Fighter" ? SK.Fighter.guard : B.tasks.guardPower;
    if (s.trait === "Night owl") power += TR["Night owl"].guard;
    if (shaken(s)) power -= SHAKEN.guard;
    return Math.max(B.tasks.minGuardPower, power + bonus("guardBonus"));
  }
  // Calculates the total night defense value based on walls, guards, and ammo.
  //  Skills and traits are defined in common.js.
  // Pass ahead = true for the Today panel: it counts walls that will finish at dusk,
  // since they'll be up before the horde arrives.
  function nightDefense(ahead) {
    return defenseParts(ahead).total;
  }
  // The same defense split into its three parts, so the Dawn report can show
  // where it came from: { walls, guards, ammo, total }.
  function defenseParts(ahead) {
    // Ammo only helps when someone on Guard is there to fire it.
    var ammo = shooters()
      ? Math.min(state.resources.ammo, bonus("ammoCap"))
      : 0;
    if (onTask("Guard", "Sharpshooter")) ammo *= SK.Sharpshooter.ammoMult;
    var guardTotal = home().reduce(function (sum, s) {
      return sum + guardPower(s);
    }, 0);
    var soon = ahead ? defenseFinishingToday() : null;
    var wallTotal = bonus("defense") + (soon ? soon.gives.defense : 0);
    return {
      walls: wallTotal,
      guards: guardTotal,
      ammo: ammo,
      total: wallTotal + guardTotal + ammo,
    };
  }
  // A walls upgrade (or repair) that will be finished at dusk today, if any.
  function defenseFinishingToday() {
    var job = facility("walls").building;
    if (!job || job.left !== 1 || !builders().length) return null;
    var u = UPGRADES[job.id];
    return u.gives.defense ? u : null;
  }
  // #endregion [S17] Night Defense

  // #region [S18] Builders & Build Costs
  // Survivors on Build who are rested enough to work.
  function builders() {
    return home().filter(function (s) {
      return s.task === "Build" && s.fatigue < B.survivors.tired;
    });
  }

  // Checks if a survivor is on a specific task with a specific skill.
  function onTask(task, skill) {
    return home().some(function (s) {
      return s.task === task && s.skill === skill;
    });
  }
  // Cost of an upgrade (or part of it to repair one): less with a Builder on
  // Build, and less again with a Workshop. Never below facilities.minCost.
  function upgradeCost(u, repair) {
    var F = B.facilities;
    var base = repair ? Math.ceil(u.cost * F.repairShare) : u.cost;
    return Math.max(
      F.minCost,
      base -
        (onTask("Build", "Builder") ? SK.Builder.discount : 0) -
        bonus("discount"),
    );
  }
  // Days of work for an upgrade. A Fabrication Shop saves a day; repairs take
  // facilities.repairDays. Never below facilities.minDays.
  function buildDays(u, repair) {
    var F = B.facilities;
    return repair
      ? F.repairDays
      : Math.max(F.minDays, u.days - bonus("fasterBy"));
  }
  // #endregion [S18] Builders & Build Costs

  // #region [S19] Health, Morale & Fatigue
  // Heals a survivor by a specified amount, ensuring health does not exceed 100 and updating status if health is above 60.
  function heal(s, amount) {
    s.health = Math.min(100, s.health + amount);
    if (s.health >= B.survivors.injuredBelow) s.status = "Healthy";
  }
  // "Male" or "Female", for voice sounds like hurtMale or dyingFemale.
  // AT.NAMES alternates (Liam, Olivia, Noah, Emma...), so odd places are female.
  function voice(s) {
    if (s.voice) return s.voice; // chosen on the New Game page
    return AT.NAMES.indexOf(s.name) % 2 === 1 ? "Female" : "Male";
  }
  // Hurts a survivor. At 0 health they die, and everyone else loses morale.
  function hurt(s, amount, cat, why) {
    if (!s || !s.alive) return;
    if (s.trait === "Tough") amount = Math.ceil(amount * TR.Tough.damage);
    s.health = Math.max(0, s.health - amount);
    // "is dehydrated" becomes "dehydrated" on the survivor's row in the report.
    var reason = why.replace(/^(is|was) /, "");
    if (s.health > 0) {
      if (s.health < B.survivors.injuredBelow) s.status = "Injured";
      note(s, "−" + amount + " health", "bad", reason);
      report.hurt.push(s.name);
      addLog(
        cat,
        s.name + " " + why + " (-" + amount + " health).",
        "bad",
        true,
      );
      // A pained grunt plays with the next report (just one, however many are hurt).
      if (!cued("hurtMale") && !cued("hurtFemale"))
        cue("hurt" + voice(s), 1500);
      return;
    }
    s.alive = false;
    s.lostOn = state.day;
    s.status = "Dead";
    note(s, "Did not survive", "bad", reason);
    report.died.push(s.name);
    addLog(cat, s.name + " " + why + " and did not survive.", "bad", true);
    alive().forEach(function (o) {
      changeMorale(o, -D.moraleLoss);
    });
    // Their last breath, then whoever is left buries them: both play with the next report.
    if (!cued("dying" + voice(s))) cue("dying" + voice(s), 1000);
    if (alive().length && !cued("shovel")) cue("shovel", 3000);
  }

  // Changes morale. A survivor whose morale hits 0 walks out on the group.
  function changeMorale(s, amount) {
    if (!s.alive) return;
    s.morale = Math.max(0, Math.min(100, s.morale + amount));
    if (s.morale === 0) {
      s.alive = false;
      s.lostOn = state.day;
      s.status = "Left";
      note(s, "Left the group", "bad", "lost all hope");
      report.left.push(s.name);
      addLog(
        "base",
        s.name + " lost all hope and left the group.",
        "bad",
        true,
      );
      if (!cued("doorClose")) cue("doorClose", 2000);
    }
  }

  // Changes fatigue, keeping it between 0 and 100.
  function tire(s, amount) {
    s.fatigue = Math.max(0, Math.min(100, s.fatigue + amount));
  }
  // #endregion [S19] Health, Morale & Fatigue

  // #region [S20] Log & Skill Checks
  // Adds an entry to the game log with the current day, category, and text.
  // tone is optional: "good" or "bad" adds a coloured marker in the Log tab.
  // shown is optional: pass true when a section of the report pop-up already
  // shows this line (a survivor's row, the supplies, the event or the raid).
  // Every other line is listed under "Also" in the next report, so nothing is missed.
  function addLog(cat, text, tone, shown) {
    var entry = { day: state.day, cat: cat, text: text, tone: tone || "" };
    state.log.push(entry);
    if (!shown) report.news.push(entry);
  }
  // Checks if any survivor has a specific skill, returning true if at least one survivor possesses that skill.
  function hasSkill(skill) {
    return home().some(function (s) {
      return s.skill === skill;
    });
  }
  // True if anyone in the group (home or away) has this trait.
  function hasTrait(trait) {
    return alive().some(function (s) {
      return s.trait === trait;
    });
  }
  // How tiring a task is for this survivor (Athletic and Lazy change it).
  function workFatigue(s, amount) {
    if (s.trait === "Athletic") amount += TR.Athletic.fatigue;
    if (s.trait === "Lazy") amount += TR.Lazy.fatigue;
    return Math.max(0, amount);
  }
  // Water the group drinks at dusk: survivors.drinks each, but a Survivalist
  // only needs it every few days (skills.Survivalist.drinkEvery).
  function waterNeeded() {
    return home().reduce(function (sum, s) {
      var skip =
        s.skill === "Survivalist" &&
        state.day % SK.Survivalist.drinkEvery === 0;
      return sum + (skip ? 0 : B.survivors.drinks);
    }, 0);
  }

  // The least tired living survivor with a skill (or undefined if none can act).
  function skilled(skill) {
    return home()
      .filter(function (s) {
        return s.skill === skill && s.fatigue < B.survivors.tired;
      })
      .sort(function (a, b) {
        return a.fatigue - b.fatigue;
      })[0];
  }
  // #endregion [S20] Log & Skill Checks

  // #region [S21] Toast & Sound Cues
  // Displays a toast notification with the specified text.
  function toast(text) {
    var t = $("toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () {
      t.hidden = true;
    }, 3500);
  }

  // Sounds saved up for the next report pop-up, so they play while the player
  // reads what happened (e.g. the rooster at dawn). cue("rooster", 2500)
  // queues a sound to start 2.5 seconds after the report opens.
  var cues = [];
  // Queues a sound for the next report.
  function cue(name, delay) {
    cues.push([name, delay || 0]);
  }
  // True if a sound is already queued, so one event doesn't queue it twice.
  function cued(name) {
    return cues.some(function (c) {
      return c[0] === name;
    });
  }

  // Sounds for the story (reports, night events, the raid) share the "scene"
  // channel. Clicking on to the next step cuts them off, so sounds from dusk
  // never drag on into the night, and the night never drags into the day.
  function sceneSounds(list) {
    AT.playSounds(list, { channel: "scene" });
  }
  // Cuts off the scene's sounds, including any still waiting to start.
  function endScene() {
    AT.stopChannel("scene");
  }
  // Sounds for the player's own actions (building, sending someone out,
  // trading). A new action replaces the last one's sound instead of stacking.
  function actionSounds(list) {
    AT.playSounds(list, { channel: "action", replace: true, fade: 150 });
  }

  // Keeps the ambience matching the phase. Safe to call often:
  // if the track is already playing it just keeps going.
  function phaseSound() {
    var p = PHASE_SOUNDS[state.phase];
    if (p) AT.setAmbience(p.ambience, p.extras);
  }
  // #endregion [S21] Toast & Sound Cues
  // #endregion [S12] Helpers

  // #region [S22] Plan checks
  /* 
=============================================================== 
---------- Plan checks ----------
=============================================================== 
These look at today's plan without changing anything. The Today panel,
the tab badges, the survivor cards and the End day check all use them,
so they always agree with each other.
*/
  // #region [S23] Lookups
  var DANGER_LABELS = ["", "Low", "Medium", "High"];

  // "1 day", "2 days": a number with its word, plural when needed.
  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }
  // Looks up a map location by its id.
  function findLoc(id) {
    return LOCATIONS.find(function (l) {
      return l.id === id;
    });
  }
  // A city event by id (see story.js [S4b]).
  function cityEvent(id) {
    return CITY_EVENTS.find(function (c) {
      return c.id === id;
    });
  }
  // The city events going on at a location right now: city-wide ones, ones in
  // its district, and ones at the place itself.
  function cityAt(loc) {
    return state.city
      .map(function (c) {
        return cityEvent(c.id);
      })
      .filter(function (c) {
        return (
          c.where === "city" || c.where === loc.district || c.where === loc.id
        );
      });
  }
  // True while any city event going on has this effect (e.g. "drought").
  function cityHas(flag) {
    return state.city.some(function (c) {
      return cityEvent(c.id)[flag];
    });
  }
  // Days left on a city event that's going on.
  function cityLeft(id) {
    var c = state.city.find(function (x) {
      return x.id === id;
    });
    return c ? c.left : 0;
  }
  // True while a city event has closed a location.
  function isClosed(loc) {
    return cityAt(loc).some(function (c) {
      return c.closed;
    });
  }
  // A location's danger right now (1 to 3): its own, raised or lowered by city events.
  function dangerAt(loc) {
    var d = cityAt(loc).reduce(function (sum, c) {
      return sum + (c.danger || 0);
    }, loc.danger);
    return Math.max(1, Math.min(3, d));
  }
  // Can a scavenger set out for this location today?
  function canVisit(loc) {
    return !isLocked(loc) && !isClosed(loc);
  }
  // True if a scavenger came home tonight from this district or location
  // (for night events with `needsFrom`).
  function cameFrom(where) {
    return (state.cameBack || []).some(function (id) {
      return id === where || findLoc(id).district === where;
    });
  }
  // Looks up a survivor by id (living or not).
  function findSurvivor(id) {
    return state.survivors.find(function (s) {
      return s.id === id;
    });
  }
  // Facilities with work in progress.
  function inProgress() {
    return state.facilities.filter(function (f) {
      return f.building;
    });
  }
  // Survivors heading to a location today.
  function headingTo(locId) {
    return alive().filter(function (s) {
      return s.task === "Scavenge" && s.target === locId;
    });
  }
  // #endregion [S23] Lookups
  // #region [S24] Traders
  // True while a trader is visiting.
  function traderHere() {
    return state.trader.leaves > 0;
  }

  // Sets up a trader's visit: fresh stock, how long they stay, and no trade made yet.
  function makeTrader(t, stays) {
    var stock = {};
    RESOURCES.forEach(function (r) {
      var base = t.stock[r.id] || 0;
      var spread = B.trade.stockSpread;
      stock[r.id] = base ? Math.max(1, base + randInt(-spread, spread)) : 0;
    });
    return {
      id: t.id,
      name: t.name,
      title: t.title,
      wants: t.wants.slice(),
      stock: stock,
      leaves: stays || randInt(t.stays[0], t.stays[1]),
      nextIn: 0, // days until the next trader arrives (only counts down while no one is here)
      tradedToday: false,
      greet: t.greet || null, // sound name for their hello, if they say one
      greeted: false, // the shop bell has rung today
    };
  }

  // What the trader will pay for one of a resource you give: more for what they want.
  function buyValue(id) {
    var wanted = state.trader.wants.indexOf(id) !== -1;
    return wanted
      ? Math.round(TRADE_VALUE[id] * B.trade.wantBonus)
      : TRADE_VALUE[id];
  }

  // Runs every dawn: the trader's stay counts down; when no one is here, the next
  // trader's arrival counts down. Arrivals and departures go into the Dawn report.
  function traderDawn() {
    var t = state.trader;
    t.tradedToday = false;
    t.greeted = false;
    if (t.leaves > 0) {
      t.leaves -= 1;
      if (t.leaves === 0) {
        addLog("trade", t.name + " packed up and moved on.");
        state.trade = { give: {}, get: {} };
        t.nextIn = randInt(D.traderGap[0], D.traderGap[1]);
      } else if (t.leaves === 1) {
        addLog(
          "trade",
          t.name + " is leaving after today. Last chance to trade.",
        );
      }
      return;
    }
    t.nextIn -= 1;
    if (t.nextIn > 0) return;
    // The marble bag again: every trader visits once before anyone comes back
    // (and never the same one twice in a row).
    var bag = state.traderBag;
    var choices = TRADERS.filter(function (x) {
      return x.id !== t.id && bag.indexOf(x.id) === -1;
    });
    if (!choices.length) {
      bag.length = 0;
      choices = TRADERS.filter(function (x) {
        return x.id !== t.id;
      });
    }
    var next = makeTrader(choices[Math.floor(rng() * choices.length)]);
    bag.push(next.id);
    state.trader = next;
    state.traderNew = true; // announced when the day starts (see startDay)
    cue("knock", 5500); // someone new at the door, after the rooster
    addLog(
      "trade",
      next.name +
        " (" +
        next.title.toLowerCase() +
        ") arrived and will stay " +
        plural(next.leaves, "day") +
        ". Pays extra for " +
        next.wants.join(" and ") +
        ".",
      "good",
    );
  }
  // #endregion [S24] Traders
  // #region [S24b] City events
  // Runs every dawn: city events count down, and sometimes a new one starts
  // (see CITY). Anyone planning a trip somewhere that just closed has to
  // pick somewhere else.
  function cityDawn() {
    state.cityPast = state.cityPast || {};
    state.city = state.city.filter(function (c) {
      c.left -= 1;
      if (c.left > 0) return true;
      state.cityPast[c.id] = state.day;
      addLog("city", cityEvent(c.id).ended, "good");
      return false;
    });
    if (state.city.length >= CITY.maxActive || rng() >= CITY.chance) return;
    var pool = CITY_EVENTS.filter(function (c) {
      var spot = findLoc(c.where);
      return (
        !cityLeft(c.id) &&
        state.day - (state.cityPast[c.id] || -99) > CITY.cooldown &&
        (!c.minDay || state.day >= c.minDay) &&
        // Nothing happens at a place nobody can reach yet.
        (!spot || !isLocked(spot))
      );
    });
    if (!pool.length) return;
    var c = pool[Math.floor(rng() * pool.length)];
    var days = randInt(c.days[0], c.days[1]);
    state.city.push({ id: c.id, left: days });
    var good = !c.closed && !(c.danger > 0) && !c.drought && !(c.yield < 1);
    addLog(
      "city",
      c.title + ". " + c.text + " (" + plural(days, "day") + ")",
      good ? "good" : "bad",
      true, // the report's "Around the city" section shows it
    );
    report.city.push(c.id);
    alive().forEach(function (s) {
      if (
        s.task === "Scavenge" &&
        !s.away &&
        s.target &&
        !canVisit(findLoc(s.target))
      ) {
        s.target = null;
        addLog(
          "city",
          s.name + " needs somewhere else to scavenge today.",
          "bad",
        );
      }
    });
  }
  // A short line saying what a city event does, for the Map tab and reports.
  function cityEffectText(c) {
    var parts = [];
    if (c.closed) parts.push("closed");
    if (c.danger > 0) parts.push("more dangerous");
    if (c.danger < 0) parts.push("safer");
    if (c.yield && c.yield < 1) parts.push("less to find");
    if (c.yield && c.yield > 1) parts.push("more to find");
    if (c.extra) parts.push("extra " + Object.keys(c.extra).join(" and "));
    if (c.people) parts.push("more people about");
    if (c.drought) parts.push("rain catchers make half as much");
    return parts.join(", ");
  }
  // Where a city event is, in words: "Downtown", "the Hospital" or "the whole city".
  function cityWhere(c) {
    if (c.where === "city") return "the whole city";
    if (DISTRICTS[c.where]) return DISTRICTS[c.where].name;
    var loc = findLoc(c.where);
    return loc ? "the " + loc.name : c.where;
  }
  // #endregion [S24b] City events
  // #region [S25] Food, Healing & Salvage
  // Food the group eats at dusk (also used by the dusk itself).
  // Survivors away on a trip live off what they find, so only those at home eat.
  function foodNeeded() {
    var need = home().reduce(function (sum, s) {
      return (
        sum +
        (s.trait === "Big eater" ? TR["Big eater"].eats : B.survivors.eats)
      );
    }, 0);
    if (onTask("Cook", "Cook")) need -= SK.Cook.foodSave;
    return Math.max(0, need - bonus("foodSave"));
  }
  // Whole units of food, water or medicine the shelter will make at dusk
  // (fractions carry over to the next day).
  function madeTonight(k) {
    return Math.floor(state.bank[k] + bonus(k) + 1e-9);
  }
  // Who Heal would treat: the most hurt survivors, as many as the infirmary
  // allows (1, or 2 with a Field Hospital). Empty when no one is hurt.
  function patients() {
    return home()
      .filter(function (p) {
        return p.health < 100;
      })
      .sort(function (a, b) {
        return a.health - b.health;
      })
      .slice(0, bonus("patients"));
  }
  // Health one treatment restores. A Medic does more; a Sick Bay adds more.
  // Without medicine only a Medic can do anything.
  function healAmount(healer, meds) {
    var medic = healer.skill === "Medic";
    var amount = meds
      ? medic
        ? SK.Medic.heal
        : B.tasks.heal
      : medic
        ? SK.Medic.healNoMedicine
        : 0;
    return amount ? amount + bonus("healBonus") : 0;
  }
  // Fatigue a scavenging trip costs per day of travel (less with a Bike Rack).
  function tripFatigue() {
    return Math.max(
      B.tasks.minTripFatigue,
      B.tasks.tripFatigue - bonus("scavFatigue"),
    );
  }
  // A shaken survivor (morale below SHAKEN.below) finds less and guards worse.
  function shaken(s) {
    return s.morale < SHAKEN.below;
  }
  // Materials a Mechanic on Build salvages each day.
  function salvageAmount() {
    return SK.Mechanic.salvage + bonus("salvage");
  }
  // #endregion [S25] Food, Healing & Salvage

  // #region [S26] Task Info
  // What a survivor's task will actually do today.
  // Returns { text, level, fix }:
  //   level is "" (fine), "info" (does nothing useful) or "bad" (needs fixing)
  //   fix is an optional link { label, goto (tab), who (survivor id) } to where it can be fixed
  function taskInfo(s) {
    var tired = s.fatigue >= B.survivors.tired;
    // Away on a long trip: nothing to decide until they're back.
    if (s.away) {
      return {
        text:
          "Away at the " +
          findLoc(s.target).name +
          ". Back at dusk " +
          (s.away === 1 ? "today" : "in " + plural(s.away, "day")) +
          ".",
        level: "",
      };
    }
    if (s.task === "Rest") {
      var restHeal =
        s.health < 100
          ? (s.trait === "Quick healer" ? TR["Quick healer"].restHeal : 0) +
            bonus("restHeal")
          : 0;
      return {
        text:
          "Recovers " +
          bonus("rest") +
          " fatigue and " +
          bonus("restMorale") +
          " morale" +
          (restHeal ? ", +" + restHeal + " health" : "") +
          ".",
        level: "",
      };
    }
    if (s.task === "Scavenge") {
      if (tired)
        return { text: "Too tired to scavenge. Will stay home.", level: "bad" };
      if (!s.target) {
        return {
          text: "No destination picked.",
          level: "bad",
          fix: { label: "Pick on the map", goto: "map", who: s.id },
        };
      }
      var loc = findLoc(s.target);
      if (!canVisit(loc))
        return {
          text: "The " + loc.name + " is closed. Pick somewhere else.",
          level: "bad",
          fix: { label: "Choose destination", goto: "map", who: s.id },
        };
      return {
        text:
          "Heading to the " +
          loc.name +
          " (" +
          DANGER_LABELS[dangerAt(loc)].toLowerCase() +
          " danger)." +
          (loc.travel > 1
            ? " A " +
              loc.travel +
              "-day trip: away until dusk " +
              (loc.travel === 2
                ? "tomorrow"
                : "in " + plural(loc.travel - 1, "day")) +
              "."
            : ""),
        level: "",
      };
    }
    if (s.task === "Build") {
      if (tired)
        return {
          text: "Too tired to build. Work won't move forward.",
          level: "bad",
        };
      var extra = "";
      var jobs = inProgress();
      if (!jobs.length) {
        return {
          text: "Nothing is being built." + extra,
          level: extra ? "" : "info",
          fix: { label: "Pick an upgrade", goto: "base" },
        };
      }
      return {
        text:
          "Working on " +
          jobs
            .map(function (f) {
              return (
                (f.building.repair ? "repairing the " : "") +
                UPGRADES[f.building.id].name +
                " (" +
                plural(f.building.left, "day") +
                " left)"
              );
            })
            .join(", ") +
          "." +
          extra,
        level: "",
      };
    }
    if (s.task === "Guard") {
      if (tired)
        return { text: "Too tired to guard. Adds no defense.", level: "bad" };
      return {
        text:
          "+" +
          guardPower(s) +
          " defense tonight" +
          (state.resources.ammo && guardPower(s)
            ? ", and fires the ammo"
            : "") +
          ".",
        level: "",
      };
    }
    if (s.task === "Cook") {
      var firstCook = home().filter(function (o) {
        return o.task === "Cook";
      })[0];
      if (firstCook && firstCook !== s)
        return {
          text: firstCook.name + " is already cooking. No extra effect.",
          level: "info",
        };
      if (duskForecast().food.after < 0)
        return {
          text: "Not enough food for a proper meal. No morale lift.",
          level: "info",
        };
      return {
        text:
          "Cooks a hot meal: everyone +" +
          B.tasks.cookMorale +
          " morale at dusk.",
        level: "",
      };
    }
    if (s.task === "Heal") {
      var list = patients();
      if (!list.length)
        return {
          text: "Everyone is at full health. No effect.",
          level: "info",
        };
      var meds = state.resources.medicine > 0;
      var amount = healAmount(s, meds);
      if (!amount)
        return { text: "No medicine left. No effect.", level: "info" };
      // With no medicine only one person can be treated (by a Medic).
      if (!meds) list = list.slice(0, 1);
      else list = list.slice(0, state.resources.medicine);
      return {
        text:
          "Treats " +
          list
            .map(function (p) {
              return p === s ? "themself" : p.name;
            })
            .join(" and ") +
          " (+" +
          amount +
          " health" +
          (list.length > 1 ? " each" : "") +
          (meds ? ", uses " + list.length + " medicine" : "") +
          ").",
        level: "",
      };
    }
    return { text: "", level: "" };
  }
  // #endregion [S26] Task Info

  // #region [S27] Dusk & Tonight Forecasts
  // What dusk will do to food and water, before anything scavengers bring home.
  function duskForecast() {
    var food = {
      have: state.resources.food,
      made: madeTonight("food"),
      need: foodNeeded(),
    };
    var water = {
      have: state.resources.water,
      made: madeTonight("water"),
      need: waterNeeded(),
    };
    [food, water].forEach(function (r) {
      r.after = r.have + r.made - r.need;
    });
    return { food: food, water: water };
  }

  // Night defense against tonight's horde. The real horde is up to horde.roll bigger or smaller.
  // With a lookout (walls tier 2+) the exact horde size is known.
  function tonightOdds() {
    var def = nightDefense(true),
      exact = bonus("exactHorde") > 0,
      threat = exact ? hordeSize() : threatTonight();
    var level = exact
      ? def >= threat
        ? "good"
        : "bad"
      : def >= threat + B.horde.roll
        ? "good"
        : def >= threat - B.horde.roll
          ? "info"
          : "bad";
    return {
      def: def,
      threat: threat,
      exact: exact,
      level: level,
      label: {
        good: "Walls should hold",
        info: "Could go either way",
        bad: "Likely breach",
      }[level],
    };
  }
  // #endregion [S27] Dusk & Tonight Forecasts

  // #region [S28] Plan Warnings
  // Everything worth fixing before the day ends. These show in the Today
  // panel, and End day asks "end anyway?" while any are left.
  function planWarnings() {
    var list = [];
    alive().forEach(function (s) {
      var info = taskInfo(s);
      if (info.level === "bad") {
        list.push({ text: s.name + ": " + info.text, fix: info.fix });
      }
    });
    if (!builders().length) {
      inProgress().forEach(function (f) {
        list.push({
          text: f.name + " won't progress. No one rested is on Build.",
          fix: { label: "Assign someone", goto: "survivors" },
        });
      });
    }
    var fc = duskForecast();
    [
      ["Food", "food", fc.food],
      ["Water", "water", fc.water],
    ].forEach(function (pair) {
      if (pair[2].after >= 0) return;
      // Someone heading home tonight from a place that has it: a heads-up,
      // not something that has to be fixed.
      var finders = bringingHome(pair[1]);
      if (finders.length) {
        list.push({
          soft: true,
          text:
            pair[0] +
            " is short by " +
            -pair[2].after +
            " unless " +
            nameList(
              finders.map(function (f) {
                return f.name;
              }),
              "or",
            ) +
            " brings some home tonight.",
        });
        return;
      }
      list.push({
        text: pair[0] + " will run short at dusk by " + -pair[2].after + ".",
        fix: traderHere()
          ? { label: "Trade", goto: "trade" }
          : { label: "Scavenge", goto: "map" },
      });
    });
    var odds = tonightOdds();
    if (odds.level === "bad") {
      list.push({
        text:
          "Night defense " +
          odds.def +
          (odds.exact
            ? " is below the horde (" + odds.threat
            : " is well below the horde (" + hordeRange()) +
          ").",
        fix: { label: "Add guards", goto: "survivors" },
      });
    }
    return list;
  }

  // Survivors who will be home at dusk tonight from somewhere that has this
  // resource (a Hunter always brings food).
  function bringingHome(res) {
    return alive().filter(function (s) {
      if (s.task !== "Scavenge" || !s.target) return false;
      var loc = findLoc(s.target);
      if (!loc) return false;
      var hasIt =
        loc.loot.indexOf(res) !== -1 ||
        (res === "food" && s.skill === "Hunter");
      if (!hasIt) return false;
      if (s.away) return s.away === 1; // on a long trip, back tonight
      return s.fatigue < B.survivors.tired && canVisit(loc) && loc.travel === 1;
    });
  }

  // A small "fix it" link that jumps to the right tab (see the data-goto handler).
  function fixLink(fix) {
    return (
      '<button type="button" class="link-btn" data-goto="' +
      fix.goto +
      '"' +
      (fix.who ? ' data-who="' + fix.who + '"' : "") +
      ">" +
      fix.label +
      " →</button>"
    );
  }
  // One warning line, with its fix link if it has one. Soft ones are heads-ups.
  function warnItem(w) {
    return (
      '<li class="warn' +
      (w.soft ? " soft" : "") +
      '"><span>' +
      esc(w.text) +
      "</span>" +
      (w.fix ? fixLink(w.fix) : "") +
      "</li>"
    );
  }
  // #endregion [S28] Plan Warnings
  // #endregion [S22] Plan checks

  // #region [S29] Header
  /* 
=============================================================== 
---------- Header ----------
=============================================================== 
*/
  // Display names for each phase. Their colours live in css/style.css (02. Phase themes).
  var PHASE_LABELS = { dawn: "Dawn", day: "Day", dusk: "Dusk", night: "Night" };

  // The top bar: day, phase, resources and the tab title.
  function renderHeader() {
    var night = state.phase === "night";
    // The top bar shows the day as a number; the tally marks themselves are on
    // a strip of "wall" at the top of the Today panel.
    var dayText =
      (night ? "Night " : "Day ") + state.day + " of " + state.length;
    var label = $("day-label");
    label.title = dayText;
    label.innerHTML =
      (night ? "Night " : "Day ") +
      "<strong>" +
      state.day +
      '</strong><span class="muted">of ' +
      state.length +
      "</span>";
    var left = state.length - state.day;
    $("wall-tally").innerHTML =
      AT.tallyMarks(state.tallies) +
      '<span class="wall-count">' +
      plural(state.tallies.length, "mark") +
      ' <span class="muted">· ' +
      (left ? plural(left, "day") + " to go" : "last day") +
      "</span></span>";
    $("wall-tally").title = dayText;
    var pill = $("phase-pill");
    pill.textContent = PHASE_LABELS[state.phase] + " phase";
    pill.dataset.phase = state.phase;
    // Re-colours the whole page for the current phase.
    document.documentElement.dataset.phase = state.phase;
    // Each resource: icon, name and amount. A tile turns amber when food or
    // water won't cover tonight's meal, red at zero. During the day a small
    // +/− shows what changed since yesterday morning.
    var need = { food: foodNeeded(), water: waterNeeded() };
    var delta = state.phase === "day" ? state.dayDelta || {} : {};
    $("resources").innerHTML = RESOURCES.map(function (r) {
      var n = state.resources[r.id];
      var tone = n <= 0 ? " out" : need[r.id] && n < need[r.id] ? " low" : "";
      var d = delta[r.id] || 0;
      return (
        '<li class="res-' +
        r.id +
        tone +
        '" title="' +
        r.label +
        ": " +
        n +
        (d
          ? " (" +
            (d > 0 ? "+" : "−") +
            Math.abs(d) +
            " since yesterday morning)"
          : "") +
        '"><img src="assets/icons/ingame/' +
        r.id +
        '.png" alt="" width="24" height="24">' +
        '<span class="res-label">' +
        r.label +
        "</span><strong>" +
        pad(n) +
        "</strong>" +
        (d
          ? '<span class="res-delta ' +
            (d > 0 ? "good" : "bad") +
            '" aria-hidden="true">' +
            (d > 0 ? "+" : "−") +
            Math.abs(d) +
            "</span>"
          : "") +
        "</li>"
      );
    }).join("");
    document.title = state.shelter + " · Day " + state.day + " — Another Tally";
  }
  // #endregion [S29] Header

  // #region [S30] Side Panel
  /* 
=============================================================== 
---------- Side Panel ----------
=============================================================== 
*/
  function renderSide() {
    // Who is doing what, and what it will actually do.
    $("today-list").innerHTML = alive()
      .map(function (s) {
        var info = taskInfo(s);
        return (
          '<li class="plan-row' +
          (info.level ? " " + info.level : "") +
          '"><span class="plan-name">' +
          esc(s.name) +
          '</span><span class="task-tag">' +
          (s.away ? "Away" : s.task) +
          '</span><span class="plan-detail">' +
          esc(info.text) +
          "</span></li>"
        );
      })
      .join("");

    // Food and water at dusk: a verdict first (✓ enough, ! enough tonight
    // only, ✕ short), then the sum: have + made − eaten.
    var fc = duskForecast();
    function row(id, label, r) {
      var tone = r.after < 0 ? "bad" : r.after < r.need ? "warn" : "good";
      var verdict =
        tone === "bad"
          ? "Short by " + -r.after
          : tone === "warn"
            ? pad(r.after) + " left · not enough for tomorrow"
            : pad(r.after) + " left";
      return (
        '<li class="fc-row ' +
        tone +
        '"><img src="assets/icons/ingame/' +
        id +
        '.png" alt="" width="22" height="22"><span class="fc-name">' +
        label +
        '</span><span class="fc-verdict"><span class="fc-sym" aria-hidden="true">' +
        { good: "✓", warn: "!", bad: "✕" }[tone] +
        "</span> " +
        verdict +
        '</span><span class="fc-calc" title="Have + made − eaten">' +
        r.have +
        ' have<span class="fc-plus">' +
        (r.made ? " + " + r.made + " made" : "") +
        '</span> <span class="fc-minus">− ' +
        r.need +
        " eaten</span></span></li>"
      );
    }
    $("dusk-forecast").innerHTML =
      '<ul class="forecast">' +
      row("food", "Food", fc.food) +
      row("water", "Water", fc.water) +
      "</ul>" +
      '<p class="small muted forecast-note">Before anything scavengers bring home.</p>';

    // Defense against tonight's horde.
    var odds = tonightOdds();
    $("tonight").innerHTML =
      '<div class="odds"><span><strong>' +
      pad(odds.def) +
      "</strong> defense</span>" +
      '<span class="muted">vs</span><span><strong>' +
      (odds.exact ? pad(odds.threat) : hordeRange()) +
      "</strong> horde</span></div>" +
      '<p class="odds-label ' +
      odds.level +
      '">' +
      odds.label +
      ' <span class="muted">· ' +
      (odds.exact ? "horde spotted from the lookout · " : "") +
      plural(guards(), "guard") +
      (defenseFinishingToday()
        ? " · counts the " + defenseFinishingToday().name + " finishing at dusk"
        : "") +
      "</span></p>";

    // Things to fix before ending the day. Until the must-fix ones are
    // sorted, End day is greyed out (it still opens the check, so the day
    // can always be ended anyway).
    var warnings = planWarnings();
    $("warnings").innerHTML = warnings.map(warnItem).join("");
    var mustFix = warnings.filter(function (w) {
      return !w.soft;
    }).length;
    var endBtn = $("end-day");
    endBtn.classList.toggle("needs-fix", mustFix > 0);
    endBtn.textContent = mustFix
      ? "End day · " + plural(mustFix, "thing") + " to check"
      : "End day";

    // A free bed is easy to miss, so it gets a line of its own.
    var free = freeBeds();
    $("bed-note").hidden = free <= 0;
    $("bed-note").innerHTML =
      '<img src="assets/images/png/free-bed.png" alt="" width="28" height="28"><span><strong>' +
      plural(free, "free bed") +
      "</strong> · scavengers and some events can bring someone home.</span>";
  }

  // Tonight's horde as the range it can really be (the estimate, give or take
  // horde.roll), unless a lookout has spotted it exactly.
  function hordeRange() {
    var t = threatTonight();
    return pad(Math.max(0, t - B.horde.roll)) + "–" + pad(t + B.horde.roll);
  }
  // #endregion [S30] Side Panel

  // #region [S31] Tab badges
  /* 
=============================================================== 
---------- Tab badges ----------
=============================================================== 
Small counts on the tabs show where something needs a look.
*/
  function setBadge(id, text, srText, tone) {
    var b = $("badge-" + id);
    b.hidden = !text;
    b.className = "tab-badge" + (tone ? " " + tone : "");
    b.innerHTML = text
      ? esc(String(text)) +
        '<span class="visually-hidden"> ' +
        srText +
        "</span>"
      : "";
  }

  // Updates every tab badge: survivors needing attention, scavengers without a
  // destination, how long the trader stays, and unread log entries.
  function renderBadges() {
    var needs = home().filter(function (s) {
      return taskInfo(s).level === "bad" || s.status === "Injured";
    }).length;
    setBadge(
      "survivors",
      needs,
      needs === 1 ? "survivor needs attention" : "survivors need attention",
      "alert",
    );

    var lost = alive().filter(function (s) {
      return s.task === "Scavenge" && !s.target;
    }).length;
    setBadge(
      "map",
      lost,
      lost === 1
        ? "scavenger needs a destination"
        : "scavengers need a destination",
      "alert",
    );

    $("tab-trade").classList.toggle("quiet", !traderHere());
    if (!traderHere()) $("tab-trade").classList.remove("arrived");
    if ($("tab-trade").getAttribute("aria-selected") === "true")
      $("tab-trade").classList.remove("arrived");
    var fresh = $("tab-trade").classList.contains("arrived");
    setBadge(
      "trade",
      traderHere() ? (fresh ? "New" : state.trader.leaves + "d") : "",
      fresh
        ? "trader just arrived"
        : "trader leaves in " + plural(state.trader.leaves, "day"),
      fresh ? "alert" : "",
    );

    if ($("tab-log").getAttribute("aria-selected") === "true") {
      state.logSeen = state.log.length;
    }
    var unseen = state.log.length - state.logSeen;
    setBadge(
      "log",
      unseen > 0 ? unseen : "",
      unseen === 1 ? "new entry" : "new entries",
    );
  }
  // #endregion [S31] Tab badges

  // #region [S32] Base Tab
  /* 
=============================================================== 
---------- Base Tab ----------
=============================================================== 
*/
  // The mark beside each upgrade, and what it means (shown as a key on the Base tab).
  var UPGRADE_MARKS = {
    built: "✓",
    building: "⚒",
    open: "+",
    busy: "…",
    damaged: "!",
    locked: "🔒",
    full: "▢",
    excluded: "✕",
  };
  var UPGRADE_MARK_LABELS = {
    built: "Built",
    building: "Being built",
    open: "Can build",
    busy: "Waiting for this facility's current job",
    damaged: "Damaged",
    locked: "Needs another upgrade first",
    full: "No room left",
    excluded: "Lost to its either/or partner",
  };
  function marksKey() {
    return (
      '<p class="marks-key small muted">' +
      Object.keys(UPGRADE_MARKS)
        .map(function (k) {
          return (
            '<span class="up-' +
            k +
            '"><span class="up-mark" aria-hidden="true">' +
            UPGRADE_MARKS[k] +
            "</span> " +
            UPGRADE_MARK_LABELS[k] +
            "</span>"
          );
        })
        .join("") +
      "</p>"
    );
  }

  // One row in a facility's upgrade list: its name, tags, what it gives, why
  // it can't be built yet (if it can't), and a Build or Repair button.
  function upgradeRow(u) {
    var st = upgradeState(u);
    // One symbol per state, explained by the key under the room summary
    // (UPGRADE_MARKS). The Build buttons use the same ⚒ as work in progress.
    var marks = UPGRADE_MARKS;
    var tags = [];
    if (u.space) tags.push({ text: SPACES[u.space].label, cls: "space-tag" });
    if (u.excludes && st.status !== "excluded" && st.status !== "built")
      tags.push({
        text:
          "⇄ Either/or: " +
          u.excludes
            .map(function (id) {
              return UPGRADES[id].name;
            })
            .join(", "),
        cls: "either",
      });
    var button = "";
    if (
      st.status === "open" ||
      st.status === "busy" ||
      st.status === "damaged"
    ) {
      var repair = st.status === "damaged";
      var cost = upgradeCost(u, repair);
      var short = cost - state.resources.materials;
      var blocked =
        st.status === "busy" ||
        short > 0 ||
        (repair && facility(u.facility).building);
      button =
        '<button class="btn btn-sm up-btn" type="button" data-sound="none" data-upgrade="' +
        u.id +
        '"' +
        (repair ? ' data-repair="1"' : "") +
        (blocked ? " disabled" : "") +
        ' aria-label="' +
        (repair ? "Repair " : "Build ") +
        u.name +
        ", " +
        plural(cost, "material") +
        ", " +
        plural(buildDays(u, repair), "day") +
        '"><span aria-hidden="true">⚒</span> ' +
        (repair ? "Repair" : "Build") +
        ' · <img src="assets/icons/ingame/materials.png" alt="" width="16" height="16"> ' +
        cost +
        "</button>";
      if (short > 0 && st.status !== "busy")
        st = {
          status: st.status,
          reason:
            (st.reason ? st.reason + " " : "") +
            "Need " +
            short +
            " more materials.",
        };
    }
    return (
      '<li class="up up-' +
      st.status +
      '"><span class="up-mark" aria-hidden="true">' +
      marks[st.status] +
      '</span><span class="up-text"><strong>' +
      u.name +
      "</strong>" +
      (tags.length
        ? ' <span class="up-tags">' +
          tags
            .map(function (t) {
              return (
                '<span class="chip ' + t.cls + '">' + esc(t.text) + "</span>"
              );
            })
            .join("") +
          "</span>"
        : "") +
      '<span class="up-effect">' +
      u.effect +
      (st.status === "open" || st.status === "busy"
        ? ' <span class="muted">(' + plural(buildDays(u), "day") + ")</span>"
        : "") +
      "</span>" +
      (st.reason ? '<span class="up-why">' + esc(st.reason) + "</span>" : "") +
      '<span class="visually-hidden"> (' +
      st.status +
      ")</span></span>" +
      button +
      "</li>"
    );
  }

  // One facility card: what's built, the job in progress, and every upgrade.
  function facilityCard(f) {
    var count = builtCount(f);
    var job = f.building;
    var progress = "";
    if (job) {
      var done = job.total - job.left;
      var ju = UPGRADES[job.id];
      progress =
        '<div class="build-progress"><div class="row small"><span>' +
        (job.repair ? "Repairing" : "Building") +
        " <strong>" +
        ju.name +
        "</strong></span><span>" +
        done +
        " of " +
        plural(job.total, "day") +
        '</span></div><span class="meter" role="progressbar" aria-label="Build progress" aria-valuemin="0" aria-valuemax="' +
        job.total +
        '" aria-valuenow="' +
        done +
        '"><span style="width:' +
        Math.round((done / job.total) * 100) +
        '%"></span></span>' +
        (builders().length
          ? ""
          : '<p class="fac-note bad">Stalled. Put someone rested on Build.</p>') +
        "</div>";
    }
    return (
      '<article class="card facility' +
      (count ? "" : " unbuilt") +
      (count === f.upgrades.length ? " maxed" : "") +
      '">' +
      '<img class="fac-art" src="assets/images/png/' +
      f.img +
      '.png" alt="">' +
      '<div class="row"><h3>' +
      f.name +
      '</h3><span class="fac-level">' +
      (count ? count + " of " + f.upgrades.length + " built" : "Not built") +
      "</span></div>" +
      '<p class="fac-current">' +
      (count
        ? esc(f.desc) + "."
        : '<span class="muted">' +
          esc(AT.balance.fillText(f.none)) +
          "</span>") +
      "</p>" +
      progress +
      upgradeList(f) +
      "</article>"
    );
  }

  // The upgrade list, sorted so what can be done now is on top: damaged,
  // in progress, can build, waiting, needs something first, then what's
  // built. Upgrades the run can no longer have (lost to an either/or pick,
  // no room left, or needing one of those) fold away at the bottom.
  var UPGRADE_ORDER = [
    "damaged",
    "building",
    "open",
    "busy",
    "locked",
    "built",
  ];
  function upgradeList(f) {
    var shown = [],
      gone = [];
    f.upgrades.forEach(function (u) {
      if (outOfReach(u)) gone.push(u);
      else shown.push(u);
    });
    shown.sort(function (a, b) {
      return (
        UPGRADE_ORDER.indexOf(upgradeState(a).status) -
        UPGRADE_ORDER.indexOf(upgradeState(b).status)
      );
    });
    return (
      '<ul class="upgrade-list">' +
      shown.map(upgradeRow).join("") +
      "</ul>" +
      (gone.length
        ? '<details class="upgrades-gone"><summary>No longer available (' +
          gone.length +
          ')</summary><ul class="upgrade-list">' +
          gone.map(upgradeRow).join("") +
          "</ul></details>"
        : "")
    );
  }
  // True for an upgrade this run can't get any more: its either/or partner
  // was chosen, its space is full, or it needs something that's out of reach.
  function outOfReach(u, seen) {
    seen = seen || {};
    if (seen[u.id]) return false;
    seen[u.id] = true;
    var st = upgradeState(u).status;
    if (st === "excluded" || st === "full") return true;
    if (st !== "locked") return false;
    var needGone = (u.needs || []).some(function (id) {
      return !isBuilt(id) && outOfReach(UPGRADES[id], seen);
    });
    var anyGone =
      u.needsAny &&
      u.needsAny.every(function (id) {
        return !isBuilt(id) && outOfReach(UPGRADES[id], seen);
      });
    return needGone || Boolean(anyGone);
  }

  // How full the roof, yard and basement are, for the top of the Base tab.
  function spacesSummary() {
    return (
      '<ul class="spaces" aria-label="Room in the shelter">' +
      Object.keys(SPACES)
        .map(function (k) {
          var users = spaceUsers(k);
          var full = users.length >= SPACES[k].slots;
          return (
            '<li class="space' +
            (full ? " full" : "") +
            '" title="' +
            esc(
              users.length
                ? users
                    .map(function (u) {
                      return u.name;
                    })
                    .join(", ")
                : "Empty",
            ) +
            '"><strong>' +
            SPACES[k].label +
            "</strong> " +
            users.length +
            " of " +
            SPACES[k].slots +
            '<span class="space-slots" aria-hidden="true">' +
            Array.apply(null, Array(SPACES[k].slots))
              .map(function (_, i) {
                return (
                  '<span class="' + (i < users.length ? "on" : "") + '"></span>'
                );
              })
              .join("") +
            "</span></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  // ---------- Signal for the convoy ----------
  // Every checkpoint choice in story.js that sets the "signal" flag (signal
  // fire, radio, flare) is offered here too, from the first checkpoint's day
  // (the broadcast) until the last day. Without this the roof checkpoint was
  // the only chance, and a run short on materials that morning lost the
  // convoy ending for good.
  var SIGNALS = [];
  AT.STORY.checkpoints.forEach(function (cp) {
    (cp.choices || []).forEach(function (c) {
      if (c.flag === "signal") SIGNALS.push({ title: cp.title, choice: c });
    });
  });
  // True once the convoy has been announced (the first checkpoint's day).
  function convoyKnown() {
    if (!SIGNALS.length) return false;
    var first = Math.min.apply(
      null,
      AT.STORY.checkpoints.map(function (cp) {
        return AT.STORY.checkpointDay(cp, state.length);
      }),
    );
    return state.day >= first;
  }
  // The card at the top of the Base tab: what's ready, or the ways to signal.
  function signalCard() {
    if (!convoyKnown()) return "";
    var ready = Boolean(state.flags.signal);
    var lastDay = state.day >= state.length;
    return (
      '<article class="card signal-card' +
      (ready ? " ready" : "") +
      '"><div class="row"><h3>Signal for the convoy</h3><span class="fac-level">' +
      (lastDay
        ? "Tonight"
        : "Day " +
          state.length +
          " · " +
          plural(state.length - state.day, "day") +
          " left") +
      "</span></div>" +
      (ready
        ? '<p class="good">✓ Ready. ' +
          esc(storyText(state.signalNote || "A signal is set on the roof.")) +
          "</p>"
        : "<p>The convoy comes on the last night. Without a signal on the roof, it won't stop. " +
          "You can set one up any day before then.</p>" +
          '<div class="signal-choices">' +
          SIGNALS.map(function (sg, i) {
            var c = sg.choice;
            var ok = choiceOk(c);
            return (
              '<button class="event-choice" type="button" data-sound="none" data-signal="' +
              i +
              '"' +
              (ok ? "" : " disabled") +
              "><strong>" +
              esc(storyText(c.label)) +
              "</strong><span>" +
              choiceNote(c) +
              (ok ? "" : " — not available") +
              "</span></button>"
            );
          }).join("") +
          "</div>") +
      "</article>"
    );
  }
  // Setting up a signal from the Base tab: pay for it and remember it.
  $("panel-base").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-signal]");
    if (!btn || btn.disabled || state.flags.signal) return;
    var sg = SIGNALS[Number(btn.dataset.signal)];
    var c = sg && sg.choice;
    if (!c || !choiceOk(c)) return;
    Object.keys(c.cost || {}).forEach(function (k) {
      changeSupply(k, -c.cost[k]);
    });
    state.flags.signal = true;
    state.signalNote = c.outcome;
    actionSounds(c.sounds || ["buildingHammering"]);
    addLog("base", storyText(c.outcome), "good");
    toast("The convoy signal is ready.");
    renderAll();
  });

  // The Base tab: shelter summary, room left, and one card per facility.
  function renderBase() {
    var p = $("panel-base");
    var anyBuilt = state.facilities.some(function (f) {
      return builtCount(f) > 0;
    });
    p.innerHTML =
      '<div class="panel-head"><h2>' +
      esc(state.shelter) +
      "</h2>" +
      '<p class="muted">Beds used ' +
      alive().length +
      " of " +
      bedCount() +
      " · Night defense " +
      pad(nightDefense()) +
      (bonus("exactHorde") > 0
        ? " · Horde tonight " + pad(hordeSize()) + " (spotted from the lookout)"
        : " · Horde tonight " + hordeRange()) +
      "</p></div>" +
      signalCard() +
      spacesSummary() +
      marksKey() +
      (anyBuilt
        ? ""
        : '<p class="card base-intro">Nothing is built yet. Each facility has a handful of upgrades. ' +
          "Some need others first, some are either/or, and some take room on the roof, in the yard or in the basement, " +
          "so you can't have everything. Pay the materials, then someone on Build works on it until it's done.</p>") +
      '<div class="grid-3">' +
      state.facilities.map(facilityCard).join("") +
      "</div>";
  }

  // Build and Repair buttons ask first (cost, days, room, and what an
  // either/or pick rules out). With nobody on Build, the "Who builds this?"
  // picker asks instead, with the same facts.
  $("panel-base").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-upgrade]");
    if (!btn || btn.disabled) return;
    var u = UPGRADES[btn.dataset.upgrade];
    var repair = Boolean(btn.dataset.repair);
    actionSounds(["menu"]);
    if (builders().length) openBuildConfirm(u, repair);
    else openBuildPicker(u, repair);
  });

  // The facts about a build, for the confirm and the builder picker.
  function buildFacts(u, repair) {
    var cost = upgradeCost(u, repair);
    var facts = [
      "Costs " +
        plural(cost, "material") +
        " (you have " +
        state.resources.materials +
        ", " +
        (state.resources.materials - cost) +
        " left after).",
      "Takes " +
        plural(buildDays(u, repair), "day") +
        " of work with someone rested on Build.",
    ];
    if (!repair && u.space) {
      var used = spaceUsers(u.space).length;
      facts.push(
        "Uses a " +
          SPACES[u.space].label.toLowerCase() +
          " slot (" +
          (used + 1) +
          " of " +
          SPACES[u.space].slots +
          " after this).",
      );
    }
    if (!repair && u.excludes) {
      var lost = u.excludes.filter(function (id) {
        return !isBuilt(id);
      });
      if (lost.length)
        facts.push(
          "Either/or: the " +
            nameList(
              lost.map(function (id) {
                return UPGRADES[id].name;
              }),
              "and",
            ) +
            " can't be built for the rest of the run.",
        );
    }
    return facts;
  }
  var confirmFor = null;
  function openBuildConfirm(u, repair) {
    confirmFor = { u: u, repair: repair };
    $("buildc-title").textContent =
      (repair ? "Repair" : "Build") + " the " + u.name + "?";
    $("buildc-effect").textContent = repair ? "Damaged in a breach." : u.effect;
    $("buildc-facts").innerHTML = buildFacts(u, repair)
      .map(function (t) {
        return (
          "<li" +
          (/^Either\/or/.test(t) ? ' class="either"' : "") +
          ">" +
          esc(t) +
          "</li>"
        );
      })
      .join("");
    $("buildc-go").textContent = repair ? "Repair it" : "Build it";
    $("build-confirm").showModal();
    $("buildc-go").focus();
  }
  $("buildc-go").addEventListener("click", function () {
    var c = confirmFor;
    confirmFor = null;
    $("build-confirm").close();
    if (c) startWork(c.u, c.repair);
  });
  $("buildc-cancel").addEventListener("click", function () {
    confirmFor = null;
    $("build-confirm").close();
  });

  // Materials are paid now; the work finishes after buildDays(u) days with someone on Build.
  function startWork(u, repair) {
    var f = facility(u.facility);
    var st = upgradeState(u).status;
    if (repair ? st !== "damaged" || f.building : st !== "open") return;
    var cost = upgradeCost(u, repair);
    if (state.resources.materials < cost) return;
    state.resources.materials -= cost;
    // Hammering, stacked with a sound for what is being built.
    actionSounds(["buildingHammering", [f.sound, 250]]);
    var days = buildDays(u, repair);
    f.building = { id: u.id, left: days, total: days, repair: Boolean(repair) };
    addLog(
      "base",
      "Work started " +
        (repair ? "repairing" : "on") +
        " the " +
        u.name +
        " (" +
        plural(days, "day") +
        ").",
    );
    toast(
      "Work started " + (repair ? "repairing" : "on") + " the " + u.name + ".",
    );
    renderAll();
  }

  // #region [S33] Builder picker
  // ---------- Builder picker ----------
  var buildFor = null;
  // Opens the "Who builds this?" pop-up for an upgrade when nobody is on Build.
  function openBuildPicker(u, repair) {
    buildFor = { u: u, repair: repair };
    $("build-title").textContent =
      "Who " + (repair ? "repairs" : "builds") + " the " + u.name + "?";
    $("build-text").textContent =
      facility(u.facility).name +
      ". " +
      buildFacts(u, repair).join(" ") +
      " Whoever you pick switches to Build now.";
    $("build-choices").innerHTML = home()
      .map(function (s) {
        var tired = s.fatigue >= B.survivors.tired;
        var now =
          s.task +
          (s.task === "Scavenge" && s.target
            ? " (" + findLoc(s.target).name + ")"
            : "");
        var perk = "";
        return (
          '<button type="button" class="event-choice" data-sound="none" data-builder="' +
          s.id +
          '"' +
          (tired ? " disabled" : "") +
          "><strong>" +
          esc(s.name) +
          " · " +
          s.skill +
          "</strong><span>" +
          (tired ? "Too tired to build" : "Now on " + esc(now) + perk) +
          "</span></button>"
        );
      })
      .join("");
    $("build-dialog").showModal();
  }

  // Picking a builder puts them on Build and starts the work.
  $("build-choices").addEventListener("click", function (e) {
    var b = e.target.closest("[data-builder]");
    if (!b || !buildFor) return;
    var s = findSurvivor(b.dataset.builder);
    s.task = "Build";
    s.target = null;
    $("build-dialog").close();
    startWork(buildFor.u, buildFor.repair);
    buildFor = null;
  });
  // Cancel closes the picker without building.
  $("build-cancel").addEventListener("click", function () {
    buildFor = null;
    $("build-dialog").close();
  });
  // #endregion [S33] Builder picker
  // #endregion [S32] Base Tab

  // #region [S34] Survivors Tab
  /* 
=============================================================== 
---------- Survivors Tab ----------
=============================================================== 
*/
  // One stat bar. Every bar reads "full is good"; low values turn amber, then red.
  function statRow(label, value, tip) {
    var tone = value < 30 ? " low" : value < 60 ? " mid" : "";
    return (
      '<span title="' +
      tip +
      '">' +
      label +
      '</span><span class="meter' +
      tone +
      '" aria-hidden="true"><span style="width:' +
      value +
      '%"></span></span>' +
      '<output aria-label="' +
      label +
      '">' +
      pad(value) +
      "</output>"
    );
  }

  // Short hints shown when hovering a task button.
  var TASK_HINTS = {
    Rest: "Recover fatigue and morale",
    Scavenge: "Search a location on the map",
    Build: "Work on a facility",
    Guard: "Add night defense",
    Cook: "Cook a hot meal that lifts everyone's morale",
    Heal: "Treat the most hurt survivor",
  };

  // The Survivors tab: a card per survivor with their stats, task buttons and
  // what their task will do, plus a "Free bed" card when there's room.
  function renderSurvivors() {
    var list = alive();
    var free = bedCount() - list.length;
    var p = $("panel-survivors");
    p.innerHTML =
      '<div class="panel-head"><h2>Survivors</h2><p class="muted">' +
      plural(list.length, "survivor") +
      (free > 0
        ? ' · <span class="bed-chip"><img src="assets/images/png/free-bed.png" alt="" width="20" height="20">' +
          plural(free, "free bed") +
          "</span>"
        : " · no free beds") +
      "</p></div>" +
      '<div class="grid-3">' +
      list
        .map(function (s) {
          var injured = s.status !== "Healthy";
          var tired = s.fatigue >= B.survivors.tired;
          var info = taskInfo(s);
          return (
            '<article class="card survivor">' +
            '<div class="top"><img class="avatar portrait" src="assets/images/png/survivor-' +
            s.avatar +
            '.png" alt="">' +
            "<div><h3>" +
            esc(s.name) +
            '</h3><div class="tags">' +
            tipChip("Skill", s.skill, AT.SKILLS[s.skill]) +
            tipChip("Trait", s.trait, AT.TRAITS[s.trait]) +
            "</div></div>" +
            '<span class="status' +
            (injured || tired ? " injured" : "") +
            (s.away ? " away" : "") +
            '">' +
            s.status +
            (tired ? "<br>Too tired" : "") +
            (s.away ? "<br>Away" : "") +
            "</span></div>" +
            tiredAlert(s) +
            conditionChips(s) +
            '<div class="stats">' +
            statRow("Health", s.health, "At 0 they die.") +
            statRow(
              "Fed",
              100 - s.hunger,
              "Drops when food runs short. Near empty, they starve.",
            ) +
            statRow(
              "Rested",
              100 - s.fatigue,
              "Drops with work. Below " +
                (100 - B.survivors.tired) +
                ", they can't scavenge, guard or build.",
            ) +
            statRow("Morale", s.morale, "At 0 they leave the group.") +
            "</div>" +
            '<p class="task-label" id="task-label-' +
            s.id +
            '">Task today</p>' +
            '<div class="task-picker" role="group" aria-labelledby="task-label-' +
            s.id +
            '">' +
            TASKS.map(function (t) {
              return (
                '<button type="button" class="task-btn" data-who="' +
                s.id +
                '" data-set-task="' +
                t +
                '" data-sound="' +
                TASK_SOUNDS[t] +
                '" aria-pressed="' +
                (t === s.task) +
                '"' +
                // Tasks are locked while the survivor is away on a trip.
                (s.away ? " disabled" : "") +
                ' title="' +
                TASK_HINTS[t] +
                '">' +
                t +
                "</button>"
              );
            }).join("") +
            "</div>" +
            (s.task === "Scavenge" && !s.away ? destinationPicker(s) : "") +
            '<p class="task-desc ' +
            info.level +
            '" aria-live="polite">' +
            esc(info.text) +
            (info.fix ? " " + fixLink(info.fix) : "") +
            "</p></article>"
          );
        })
        .join("") +
      (free > 0
        ? '<div class="card free-bed"><img class="avatar portrait" src="assets/images/png/free-bed.png" alt=""><h3>Free bed</h3>' +
          '<p class="small muted">Scavengers sometimes meet survivors who want to join, and so do some events.</p>' +
          '<button class="btn btn-sm" type="button" data-goto="map">Go to map</button></div>'
        : "") +
      "</div>";
  }

  // A skill or trait chip that shows its description on hover, focus or tap
  // (the old title tooltips were easy to miss). Only the description shows,
  // as before: what it actually does is still for the player to find out.
  function tipChip(kind, name, desc) {
    return (
      '<span class="chip has-tip" tabindex="0" data-tip="' +
      esc(desc || "") +
      '"><span class="chip-kind">' +
      kind +
      "</span> " +
      esc(name) +
      '<span class="visually-hidden">: ' +
      esc(desc || "") +
      "</span></span>"
    );
  }

  // Tasks that need someone rested (Rest, Cook and Heal don't).
  var NEEDS_REST = ["Scavenge", "Build", "Guard"];
  function tooTiredFor(s) {
    return (
      !s.away &&
      s.fatigue >= B.survivors.tired &&
      NEEDS_REST.indexOf(s.task) !== -1
    );
  }
  // A red banner on the card when someone is on a task they're too tired for.
  function tiredAlert(s) {
    if (!tooTiredFor(s)) return "";
    return (
      '<p class="tired-alert" role="alert"><span><strong>Too tired to ' +
      s.task.toLowerCase() +
      ".</strong> They'll do nothing today.</span>" +
      '<button type="button" class="btn btn-sm" data-rest="' +
      s.id +
      '">Put on Rest</button></p>'
    );
  }

  // Clicking a task button gives the survivor that task (not while they're away).
  $("panel-survivors").addEventListener("click", function (e) {
    var rest = e.target.closest("[data-rest]");
    if (rest) {
      var r = findSurvivor(rest.dataset.rest);
      if (r && !r.away) {
        if (r.target) r.lastTarget = r.target;
        r.task = "Rest";
        r.target = null;
        actionSounds([TASK_SOUNDS.Rest]);
        renderAll();
      }
      return;
    }
    var btn = e.target.closest("[data-set-task]");
    if (!btn || btn.disabled) return;
    var s = findSurvivor(btn.dataset.who);
    if (s.away) return;
    s.task = btn.dataset.setTask;
    if (tooTiredFor(s)) {
      toast(
        s.name +
          " is too tired to " +
          s.task.toLowerCase() +
          ". They'll do nothing unless they rest.",
      );
      actionSounds(["hurt" + voice(s)]); // a tired grunt, so it's heard as well as seen
    }
    if (s.task !== "Scavenge") {
      if (s.target) s.lastTarget = s.target;
      s.target = null;
    } else if (!s.target && s.lastTarget && canVisit(findLoc(s.lastTarget))) {
      // Back to scavenging: same place as last time, if it's still open.
      s.target = s.lastTarget;
    }
    renderAll();
    var again = $("panel-survivors").querySelector(
      '[data-who="' + s.id + '"][data-set-task="' + s.task + '"]',
    );
    if (again) again.focus();
  });
  // Picking a destination on a survivor's card sends them there.
  $("panel-survivors").addEventListener("change", function (e) {
    var sel = e.target.closest("[data-dest]");
    if (!sel) return;
    var s = findSurvivor(sel.dataset.dest);
    var loc = findLoc(sel.value);
    if (!s || s.away) return;
    if (!loc) {
      s.target = null;
    } else if (canVisit(loc)) {
      s.target = loc.id;
      s.lastTarget = loc.id;
      actionSounds(["doorOpen", [SCAVENGE_STEPS[dangerAt(loc)], 300]]);
    }
    renderAll();
    var again = $("dest-" + s.id);
    if (again) again.focus();
  });

  // Small warnings on a survivor's card: shaken, hungry, worn out.
  function conditionChips(s) {
    var list = [];
    if (shaken(s))
      list.push([
        "Shaken",
        "Morale under " + SHAKEN.below + ": finds less and guards worse.",
      ]);
    if (s.hunger >= UPKEEP.hungryAt)
      list.push([
        "Hungry",
        "Hunger " +
          s.hunger +
          ": loses extra morale each dusk. At " +
          B.survivors.starvingAt +
          " they starve.",
      ]);
    if (s.fatigue >= B.survivors.wornOut && s.fatigue < B.survivors.tired)
      list.push(["Worn out", "Close to too tired to work. Rest soon."]);
    if (!list.length) return "";
    return (
      '<div class="conditions">' +
      list
        .map(function (c) {
          return (
            '<span class="chip warn" title="' +
            esc(c[1]) +
            '">' +
            c[0] +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  }
  // #endregion [S34] Survivors Tab

  // #region [S35] Map Tab
  /* 
=============================================================== 
---------- Map Tab ----------
=============================================================== 
*/
  // The Map tab: districts and locations on the map, what's going on around
  // the city, and details for the selected place with who's going there.
  function renderMap() {
    var loc = findLoc(state.selectedLocation);
    var visits = state.explored.filter(function (id) {
      return id === loc.id;
    }).length;
    var explored = LOCATIONS.filter(function (l) {
      return state.explored.indexOf(l.id) !== -1;
    }).length;
    var danger = dangerAt(loc);
    var risk = Math.round(Math.min(1, D.scavRisk * danger) * 100);
    var here = cityAt(loc);
    var p = $("panel-map");
    p.innerHTML =
      '<div class="panel-head"><h2>Map</h2><p class="muted">Explored ' +
      explored +
      " of " +
      LOCATIONS.length +
      " locations</p></div>" +
      '<div class="map-wrap"><div class="map-col">' +
      '<div class="map-area" role="group" aria-label="Map of locations">' +
      Object.keys(DISTRICTS)
        .map(function (d) {
          return (
            '<span class="district-label" aria-hidden="true" style="left:' +
            DISTRICTS[d].x +
            "%;top:" +
            DISTRICTS[d].y +
            '%">' +
            DISTRICTS[d].name +
            "</span>"
          );
        })
        .join("") +
      '<span class="loc home" style="left:' +
      SHELTER_POS.x +
      "%;top:" +
      SHELTER_POS.y +
      '%">' +
      esc(state.shelter) +
      "</span>" +
      LOCATIONS.map(mapPin).join("") +
      "</div>" +
      // The key uses the same pins and colours as the map itself.
      '<p class="map-legend small muted">' +
      '<span><span class="loc">Place <span class="seen">✓</span></span> Explored</span>' +
      '<span><span class="loc unseen">Place</span> Not explored yet</span>' +
      '<span><span class="loc locked"><span aria-hidden="true">🔒</span> Place</span> Locked</span>' +
      '<span><span class="loc closed"><span aria-hidden="true">⛔</span> Place</span> Closed</span>' +
      '<span><span class="loc-flag bad">▲</span> More dangerous</span>' +
      '<span><span class="loc-flag good">★</span> Extra supplies</span>' +
      '<span><span class="pin-who" aria-hidden="true"></span> Survivor heading there</span></p>' +
      cityNews() +
      "</div>" +
      '<div class="card loc-detail" aria-live="polite">' +
      '<p class="eyebrow">' +
      DISTRICTS[loc.district].name +
      "</p><h3>" +
      loc.name +
      "</h3>" +
      '<img class="loc-art" alt="">' +
      (here.length
        ? '<ul class="loc-city">' +
          here
            .map(function (c) {
              return (
                "<li><strong>" +
                esc(c.title) +
                "</strong> " +
                esc(cityEffectText(c)) +
                ' <span class="muted">· ' +
                plural(cityLeft(c.id), "day") +
                " left</span></li>"
              );
            })
            .join("") +
          "</ul>"
        : "") +
      '<dl><dt>Danger</dt><dd><span class="danger-label">' +
      DANGER_LABELS[danger] +
      (danger !== loc.danger
        ? " (usually " + DANGER_LABELS[loc.danger].toLowerCase() + ")"
        : "") +
      '</span> <span class="danger" aria-hidden="true">' +
      [1, 2, 3]
        .map(function (n) {
          return '<span class="' + (n <= danger ? "on" : "") + '"></span>';
        })
        .join("") +
      "</span></dd>" +
      "<dt>Injury risk</dt><dd>" +
      risk +
      "%</dd>" +
      "<dt>Travel</dt><dd>" +
      plural(loc.travel, "day") +
      ' <span class="muted">(+' +
      tripFatigue() * loc.travel +
      " fatigue" +
      (loc.travel > 1
        ? ", away overnight, +" +
          B.scavenging.extraPerTripDay * (loc.travel - 1) +
          " supplies"
        : "") +
      ")</span></dd>" +
      "<dt>Likely finds</dt><dd>" +
      loc.finds +
      (loc.size > 0 ? ' <span class="muted">(a big site)</span>' : "") +
      (loc.size < 0 ? ' <span class="muted">(a small place)</span>' : "") +
      "</dd>" +
      "<dt>Meet survivors</dt><dd>" +
      Math.round(peopleAt(loc) * 100) +
      "% a trip" +
      (freeBeds() > 0 ? "" : ' <span class="muted">(no free bed)</span>') +
      "</dd>" +
      "<dt>Supplies left</dt><dd>" +
      (visits
        ? "About " +
          Math.round(leftAt(loc) * 100) +
          '% <span class="muted">(' +
          plural(visits, "visit") +
          ")</span>"
        : "Untouched") +
      "</dd></dl>" +
      (isLocked(loc)
        ? fenceControls()
        : isClosed(loc)
          ? '<p class="small bad-text">Closed for now. Nobody can scavenge here until it reopens.</p>'
          : sendControls(loc)) +
      "</div></div>";
    AT.showArt(p.querySelector(".loc-art"), loc.img || loc.id, "map");
  }

  // The chance a scavenger meets someone who wants to join, a trip (city
  // events like a relief camp add to it).
  function peopleAt(loc) {
    return Math.min(
      1,
      cityAt(loc).reduce(function (p, c) {
        return p + (c.people || 0);
      }, loc.people || 0),
    );
  }
  // The share of a fresh haul still there after earlier visits
  // (scavenging.revisitLoss a visit, never below revisitFloor).
  function leftAt(loc) {
    var visits = state.explored.filter(function (id) {
      return id === loc.id;
    }).length;
    return Math.max(
      B.scavenging.revisitFloor,
      1 - visits * B.scavenging.revisitLoss,
    );
  }

  // One location button on the map, with markers for what's going on there.
  function mapPin(l) {
    var seen = state.explored.indexOf(l.id) !== -1;
    var who = headingTo(l.id);
    var events = cityAt(l).filter(function (c) {
      return c.where !== "city";
    });
    var closed = isClosed(l);
    var riskier = dangerAt(l) > l.danger;
    var extra = events.some(function (c) {
      return c.extra || c.yield > 1;
    });
    var sr =
      (seen ? ", explored" : ", not explored yet") +
      (isLocked(l) ? ", locked" : "") +
      (closed ? ", closed" : "") +
      (riskier ? ", more dangerous" : "") +
      (extra ? ", extra supplies" : "") +
      (who.length
        ? ", " +
          who
            .map(function (s) {
              return s.name;
            })
            .join(" and ") +
          " heading here"
        : "");
    return (
      '<button type="button" class="loc' +
      (isLocked(l) ? " locked" : "") +
      (closed ? " closed" : "") +
      (seen ? "" : " unseen") +
      '" data-loc="' +
      l.id +
      '"' +
      (isLocked(l) ? ' data-sound="rustyDoor"' : "") +
      ' style="left:' +
      l.x +
      "%;top:" +
      l.y +
      '%"' +
      ' aria-pressed="' +
      (l.id === state.selectedLocation) +
      '">' +
      (isLocked(l) ? '<span aria-hidden="true">🔒</span> ' : "") +
      (closed ? '<span aria-hidden="true">⛔</span> ' : "") +
      l.name +
      (riskier
        ? ' <span class="loc-flag bad" aria-hidden="true">▲</span>'
        : "") +
      (extra
        ? ' <span class="loc-flag good" aria-hidden="true">★</span>'
        : "") +
      (seen ? ' <span class="seen" aria-hidden="true">✓</span>' : "") +
      who
        .map(function (s) {
          return (
            '<span class="pin-who" aria-hidden="true" title="' +
            esc(s.name) +
            ' is heading here">' +
            esc(s.name.charAt(0)) +
            "</span>"
          );
        })
        .join("") +
      '<span class="visually-hidden">' +
      esc(sr) +
      "</span></button>"
    );
  }

  // Everything going on around the city, under the map.
  function cityNews() {
    if (!state.city.length)
      return '<div class="card city-news"><h3 class="eyebrow">Around the city</h3><p class="small muted">Quiet, for now.</p></div>';
    return (
      '<div class="card city-news"><h3 class="eyebrow">Around the city</h3><ul>' +
      state.city
        .map(function (x) {
          var c = cityEvent(x.id);
          return (
            "<li><strong>" +
            esc(c.title) +
            "</strong> · " +
            esc(cityWhere(c)) +
            ': <span class="small">' +
            esc(cityEffectText(c)) +
            '</span> <span class="small muted">(' +
            plural(x.left, "day") +
            " left)</span></li>"
          );
        })
        .join("") +
      "</ul></div>"
    );
  }

  // Who's going to a location: one button per survivor. Click to send them
  // here, click again to call them back (they go back to Rest).
  function sendControls(loc) {
    return (
      '<p class="small" id="send-label"><strong>Who goes?</strong> Click to send or call back.</p>' +
      '<div class="send-list" role="group" aria-labelledby="send-label">' +
      alive()
        .map(function (s) {
          var going = s.task === "Scavenge" && s.target === loc.id;
          var tired = s.fatigue >= B.survivors.tired;
          var why = s.away
            ? "Away at the " + findLoc(s.target).name
            : tired
              ? "Too tired"
              : going
                ? "Going here"
                : s.task === "Scavenge" && s.target
                  ? "Going to the " + findLoc(s.target).name
                  : "On " + s.task + " · " + (100 - s.fatigue) + " rested";
          return (
            '<button type="button" class="who-chip' +
            (going ? " going" : "") +
            '" data-send="' +
            s.id +
            '" data-sound="none" aria-pressed="' +
            going +
            '"' +
            (s.away || (tired && !going) ? " disabled" : "") +
            '><img class="avatar" src="assets/images/png/survivor-' +
            s.avatar +
            '.png" alt=""><span><strong>' +
            esc(s.name) +
            "</strong> " +
            s.skill +
            '<span class="small muted">' +
            esc(why) +
            "</span></span></button>"
          );
        })
        .join("") +
      "</div>" +
      '<p class="small muted" style="margin-top:.5rem">' +
      (loc.travel > 1
        ? "A " + loc.travel + "-day trip: they're away until dusk tomorrow. "
        : "") +
      "May trigger an event or a mini-game.</p>"
    );
  }

  // Sends a survivor to scavenge a location, or calls them back if they were
  // already going there.
  function toggleSend(s, loc) {
    if (!s || s.away || !canVisit(loc)) return;
    if (s.task === "Scavenge" && s.target === loc.id) {
      s.task = "Rest";
      s.lastTarget = s.target;
      s.target = null;
      actionSounds(["doorClose"]);
      toast(s.name + " will stay at the shelter today.");
      return;
    }
    s.task = "Scavenge";
    s.target = loc.id;
    s.lastTarget = loc.id;
    // Out the door, then footsteps that get quieter the more dangerous the place.
    actionSounds(["doorOpen", [SCAVENGE_STEPS[dangerAt(loc)], 300]]);
    toast(s.name + " will scavenge the " + loc.name + " today.");
  }

  // A drop-down of places to scavenge, grouped by district, for a survivor's card.
  function destinationPicker(s) {
    return (
      '<label class="visually-hidden" for="dest-' +
      s.id +
      '">Destination for ' +
      esc(s.name) +
      "</label>" +
      '<select class="dest-select" id="dest-' +
      s.id +
      '" data-dest="' +
      s.id +
      '">' +
      '<option value=""' +
      (s.target ? "" : " selected") +
      ">Pick a destination…</option>" +
      Object.keys(DISTRICTS)
        .map(function (d) {
          return (
            '<optgroup label="' +
            DISTRICTS[d].name +
            '">' +
            LOCATIONS.filter(function (l) {
              return l.district === d;
            })
              .map(function (l) {
                var why = isLocked(l)
                  ? " (locked)"
                  : isClosed(l)
                    ? " (closed)"
                    : "";
                return (
                  '<option value="' +
                  l.id +
                  '"' +
                  (s.target === l.id ? " selected" : "") +
                  (why ? " disabled" : "") +
                  ">" +
                  l.name +
                  " · " +
                  l.finds.split(".")[0].toLowerCase() +
                  " · " +
                  DANGER_LABELS[dangerAt(l)].toLowerCase() +
                  " risk" +
                  (l.travel > 1 ? " · " + l.travel + " days" : "") +
                  why +
                  "</option>"
                );
              })
              .join("") +
            "</optgroup>"
          );
        })
        .join("") +
      "</select>"
    );
  }

  // #region [S36] Fence Controls
  // Materials it takes to cut through a locked location's fence: less with a
  // Builder or Mechanic at the shelter (balance.js [B8], scavenging.fenceCut).
  function fenceCost() {
    var handy = home().some(function (s) {
      return FENCE_SKILLS.indexOf(s.skill) !== -1;
    });
    var cut = B.scavenging.fenceCut;
    return handy ? cut.skilledCost : cut.cost;
  }
  // What the location panel shows for a locked place: how to get in, and a
  // button to cut the fence (greyed out without enough materials).
  function fenceControls() {
    var cost = fenceCost();
    var short = cost - state.resources.materials;
    return (
      '<p class="small muted">Locked. Cut through the fence, or keep scavenging nearby: someone may turn up a way in.</p>' +
      '<button class="btn btn-block" type="button" id="cut-fence" data-sound="none"' +
      (short > 0 ? " disabled" : "") +
      ">Cut the fence · " +
      plural(cost, "material") +
      "</button>" +
      '<p class="small ' +
      (short > 0 ? "bad-text" : "muted") +
      '" style="margin-top:.5rem">' +
      (short > 0
        ? "Need " + short + " more materials."
        : cost === B.scavenging.fenceCut.skilledCost
          ? "Someone here knows their way around tools."
          : "Someone handy with tools could do it for less.") +
      "</p>"
    );
  }

  // Map clicks: cut the fence, select a location, or send someone to scavenge.
  $("panel-map").addEventListener("click", function (e) {
    // Cut the fence on a locked location.
    if (e.target.id === "cut-fence") {
      var place = findLoc(state.selectedLocation);
      var cost = fenceCost();
      if (!isLocked(place) || state.resources.materials < cost) return;
      state.resources.materials -= cost;
      unlock(place.id, "exploring");
      actionSounds([
        "rustyMetal",
        ["woodSplitting", 400],
        ["rustyHinges", 900],
      ]);
      toast("The fence is down. The " + place.name + " is open.");
      renderAll();
      return;
    }
    var locBtn = e.target.closest("[data-loc]");
    if (locBtn) {
      state.selectedLocation = locBtn.dataset.loc;
      renderMap();
      var again = $("panel-map").querySelector(
        '[data-loc="' + state.selectedLocation + '"]',
      );
      if (again) again.focus();
      return;
    }
    var chip = e.target.closest("[data-send]");
    if (chip && !chip.disabled) {
      toggleSend(
        findSurvivor(chip.dataset.send),
        findLoc(state.selectedLocation),
      );
      renderAll();
      var again = $("panel-map").querySelector(
        '[data-send="' + chip.dataset.send + '"]',
      );
      if (again) again.focus();
    }
  });
  // #endregion [S36] Fence Controls
  // #endregion [S35] Map Tab

  // #region [S37] Trade Tab
  /* 
=============================================================== 
---------- Trade Tab ----------
=============================================================== 
*/
  // Value of one side of the offer. What you give is valued at the trader's buy price
  // (extra for what they want); what you get is valued at the normal price.
  function tradeValue(side) {
    return RESOURCES.reduce(function (sum, r) {
      var each = side === "give" ? buyValue(r.id) : TRADE_VALUE[r.id];
      return sum + (state.trade[side][r.id] || 0) * each;
    }, 0);
  }

  // Share of the trader's value you must offer: the difficulty's markup,
  // lowered if someone in the group is a Negotiator, raised by a Splurger.
  function tradeNeed() {
    return (
      D.tradeMarkup *
      (hasSkill("Negotiator") ? 1 - SK.Negotiator.tradeDiscount : 1) *
      (hasTrait("Splurger") ? TR.Splurger.tradeMarkup : 1)
    );
  }

  // The Trade tab: the trader, both sides of the offer, and whether they'll accept.
  function renderTrade() {
    // No trader around: say so instead of showing an empty trade screen.
    var t = state.trader;
    if (!traderHere()) {
      $("panel-trade").innerHTML =
        '<div class="panel-head"><h2>Trade</h2></div>' +
        '<div class="card trade-empty"><h3>No trader nearby</h3><p class="muted">' +
        esc(t.name) +
        " has moved on. Word is the next trader will pass by in about " +
        plural(t.nextIn, "day") +
        ".</p></div>";
      return;
    }
    // Wanted items as readable labels, e.g. "Food and Water".
    var wantLabels = t.wants
      .map(function (w) {
        return RESOURCES.find(function (r) {
          return r.id === w;
        }).label;
      })
      .join(" and ");
    var markupPct = Math.round((D.tradeMarkup - 1) * 100);
    var give = tradeValue("give"),
      get = tradeValue("get");
    var need = Math.ceil(get * tradeNeed());
    var share = give + get === 0 ? 0 : Math.round((give / (give + get)) * 100);

    // How good the deal is for the trader, for the bar's colour:
    // deep red (won't take it), red (almost), green (accepts), deep green
    // (a really good deal for them).
    var deal = !get
      ? ""
      : give < need * B.trade.closeShare
        ? "deal-no"
        : give < need
          ? "deal-close"
          : give < need * B.trade.greatShare
            ? "deal-yes"
            : "deal-great";
    var DEAL_LABELS = {
      "deal-no": "Won't accept",
      "deal-close": "Almost",
      "deal-yes": "Accepts",
      "deal-great": "A great deal for them",
    };

    // Plain-language status of the offer.
    var msg,
      ok = false;
    if (t.tradedToday) {
      msg = t.name + " is done trading for today. Come back tomorrow.";
    } else if (!get) {
      msg =
        "Pick what you want from " +
        t.name +
        "'s side. One trade a day, so put it all in one offer.";
    } else if (give < need) {
      msg =
        t.name +
        " wants " +
        (need - give) +
        " more value. Add more to your side.";
    } else {
      ok = true;
      msg =
        t.name +
        " will accept this trade." +
        (give > need
          ? " You're offering " + (give - need) + " more value than needed."
          : "");
    }

    // One side of the trade: a row per resource with − and + steppers.
    function column(side, title, haveLabel, head) {
      return (
        '<div class="card trade-side">' +
        (head || "") +
        '<h3 class="eyebrow">' +
        title +
        "</h3>" +
        '<div class="trade-row trade-head small muted"><span>Item</span><span>' +
        haveLabel +
        "</span><span></span><span>Pick</span><span></span></div>" +
        RESOURCES.map(function (r) {
          var n = state.trade[side][r.id] || 0;
          var have = side === "give" ? state.resources[r.id] : t.stock[r.id];
          var wanted = side === "give" && t.wants.indexOf(r.id) !== -1;
          var worth = side === "give" ? buyValue(r.id) : TRADE_VALUE[r.id];
          return (
            '<div class="trade-row"><span class="res-name"><img src="assets/icons/ingame/' +
            r.id +
            '.png" alt="" width="20" height="20">' +
            r.label +
            '<span class="worth' +
            (wanted ? " wanted" : "") +
            '">worth ' +
            worth +
            (wanted ? " · wanted" : "") +
            "</span>" +
            '</span><span class="have">' +
            pad(have) +
            "</span>" +
            '<button class="stepper" type="button" data-side="' +
            side +
            '" data-res="' +
            r.id +
            '" data-delta="-1"' +
            (n <= 0 ? " disabled" : "") +
            ' aria-label="' +
            (side === "give" ? "Give" : "Get") +
            " one less " +
            r.label +
            '">−</button>' +
            '<output aria-label="' +
            r.label +
            " to " +
            side +
            '">' +
            n +
            "</output>" +
            '<button class="stepper" type="button" data-side="' +
            side +
            '" data-res="' +
            r.id +
            '" data-delta="1"' +
            (n >= have || t.tradedToday ? " disabled" : "") +
            ' aria-label="' +
            (side === "give" ? "Give" : "Get") +
            " one more " +
            r.label +
            '">+</button></div>'
          );
        }).join("") +
        "</div>"
      );
    }
    // Each side has a picture on top: your backpack over your stores, the
    // trader over theirs.
    var yourHead =
      '<div class="trade-who"><img class="avatar portrait" src="assets/props/PNG/tool_backpack.png" alt=""><div><h3>Your stores</h3>' +
      '<p class="small muted">What ' +
      esc(state.shelter) +
      " can spare.</p></div></div>";
    var theirHead =
      '<div class="trade-who trader"><img class="avatar portrait" src="assets/images/png/trader.png" alt=""><div><h3>' +
      esc(t.name) +
      "</h3>" +
      '<p class="small muted">' +
      esc(t.title) +
      " · leaves in " +
      plural(t.leaves, "day") +
      " · pays extra for " +
      wantLabels +
      (markupPct
        ? " · asks " + markupPct + "% more than things are worth"
        : "") +
      "</p></div></div>";
    $("panel-trade").innerHTML =
      '<div class="panel-head"><h2>Trade</h2></div>' +
      '<div class="trade-cols">' +
      column("give", "You give", "You have", yourHead) +
      column("get", "You get", "Has", theirHead) +
      "</div>" +
      '<div class="card trade-bar"><div>' +
      '<div class="labels"><span>Your offer · value ' +
      pad(give) +
      "</span><span>" +
      esc(t.name) +
      "'s offer · value " +
      pad(get) +
      "</span></div>" +
      '<div class="balance ' +
      deal +
      '" style="--accept:' +
      Math.round((tradeNeed() / (1 + tradeNeed())) * 100) +
      '%" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      share +
      '" aria-label="Your share of the trade"><span style="width:' +
      share +
      '%"></span></div>' +
      '<p class="trade-msg ' +
      (ok ? "good" : get ? "bad" : "") +
      '" aria-live="polite">' +
      (deal
        ? '<span class="deal-tag ' +
          deal +
          '">' +
          DEAL_LABELS[deal] +
          "</span> "
        : "") +
      msg +
      "</p></div>" +
      '<div class="choices"><button class="btn btn-quiet" type="button" id="trade-clear">Clear</button>' +
      '<button class="btn btn-primary" type="button" id="trade-propose"' +
      (ok ? "" : " disabled") +
      ">Propose trade</button></div></div>";
    // Each trader has their own portrait (trader_<id>.png); trader.png if it's missing.
    AT.showArt(
      $("panel-trade").querySelector(".trade-who.trader .avatar"),
      "trader_" + t.id,
      "trader",
    );
  }
  // Trade clicks: the steppers, Clear, and Propose trade.
  $("panel-trade").addEventListener("click", function (e) {
    var step = e.target.closest("[data-delta]");
    if (step) {
      var side = state.trade[step.dataset.side];
      side[step.dataset.res] = Math.max(
        0,
        (side[step.dataset.res] || 0) + Number(step.dataset.delta),
      );
      renderTrade();
      var same = $("panel-trade").querySelector(
        '[data-side="' +
          step.dataset.side +
          '"][data-res="' +
          step.dataset.res +
          '"][data-delta="' +
          step.dataset.delta +
          '"]',
      );
      if (same && !same.disabled) same.focus();
      return;
    }
    if (e.target.id === "trade-clear") {
      state.trade = { give: {}, get: {} };
      renderTrade();
    }
    if (e.target.id === "trade-propose") {
      var give = tradeValue("give"),
        get = tradeValue("get");
      if (get === 0) {
        toast("Pick something you want from the trader first.");
        return;
      }
      var t = state.trader;
      if (t.tradedToday) {
        toast(t.name + " is done trading for today.");
        return;
      }
      if (give < Math.ceil(get * tradeNeed())) {
        toast(t.name + " shakes their head. Offer more.");
        return;
      }
      var gaveList = {},
        gotList = {};
      RESOURCES.forEach(function (r) {
        var gave = state.trade.give[r.id] || 0,
          got = state.trade.get[r.id] || 0;
        state.resources[r.id] += got - gave;
        t.stock[r.id] -= got;
        // Traders keep what they wanted; anything else goes into their stock to sell on.
        if (t.wants.indexOf(r.id) === -1) t.stock[r.id] += gave;
        if (gave) gaveList[r.id] = gave;
        if (got) gotList[r.id] = got;
      });
      t.tradedToday = true;
      addLog(
        "trade",
        "Traded with " +
          t.name +
          ": gave " +
          AT.minigames.describe(gaveList) +
          ", got " +
          AT.minigames.describe(gotList) +
          ".",
        "good",
      );
      toast("Trade accepted.");
      actionSounds(["cardboardBox", ["canJiggle", 350]]);
      state.trade = { give: {}, get: {} };
      renderAll();
    }
  });
  // #endregion [S37] Trade Tab

  // #region [S38] Log Tab
  /* 
=============================================================== 
---------- Log Tab ----------
=============================================================== 
*/
  function renderLog() {
    var entries = state.log.filter(function (l) {
      return state.logFilter === "all" || l.cat === state.logFilter;
    });
    var days = [];
    entries
      .slice()
      .reverse()
      .forEach(function (l) {
        var group = days.find(function (d) {
          return d.day === l.day;
        });
        if (!group) {
          group = { day: l.day, items: [] };
          days.push(group);
        }
        group.items.push(l);
      });
    // Each day folds open. Today (or the latest day shown) starts open,
    // older days start closed, and the player's own choices are remembered.
    $("panel-log").innerHTML =
      '<div class="panel-head"><h2>Log</h2></div>' +
      '<p class="small muted log-intro">The full history of this run. Dawn and dusk reports show each day as it happens.</p>' +
      '<div class="filters" role="group" aria-label="Filter the log">' +
      LOG_FILTERS.map(function (f) {
        return (
          '<button class="filter" type="button" data-filter="' +
          f.id +
          '" aria-pressed="' +
          (f.id === state.logFilter) +
          '">' +
          f.label +
          "</button>"
        );
      }).join("") +
      "</div>" +
      (days.length === 0
        ? '<p class="card empty">Nothing here yet.</p>'
        : days
            .map(function (d, i) {
              var open =
                d.day in state.logOpen ? state.logOpen[d.day] : i === 0;
              return (
                '<details class="log-day" data-day="' +
                d.day +
                '"' +
                (open ? " open" : "") +
                '><summary><span class="eyebrow">Day ' +
                pad(d.day) +
                '</span><span class="small muted">' +
                d.items.length +
                (d.items.length === 1 ? " entry" : " entries") +
                "</span></summary><ol>" +
                d.items
                  .map(function (l) {
                    return (
                      '<li class="' +
                      l.tone +
                      '"><span class="chip">' +
                      LOG_LABELS[l.cat] +
                      "</span><span>" +
                      esc(l.text) +
                      "</span></li>"
                    );
                  })
                  .join("") +
                "</ol></details>"
              );
            })
            .join(""));
  }

  // Log clicks: opening or closing a day, and the category filters.
  $("panel-log").addEventListener("click", function (e) {
    // Remember which days the player opens or closes. (The click lands
    // before the day folds, so the new state is the opposite of now.)
    var sum = e.target.closest("summary");
    if (sum) {
      var d = sum.parentElement;
      state.logOpen[d.dataset.day] = !d.open;
      actionSounds(["turnPage"]);
      return;
    }
    var f = e.target.closest("[data-filter]");
    if (!f) return;
    state.logFilter = f.dataset.filter;
    renderLog();
    $("panel-log")
      .querySelector('[data-filter="' + state.logFilter + '"]')
      .focus();
  });
  // #endregion [S38] Log Tab

  // #region [S39] Tab Switching
  /* 
=============================================================== 
---------- Tabs (ARIA tabs pattern: click, or Left/Right/Home/End) ----------
=============================================================== 
*/
  var tabs = Array.prototype.slice.call(
    document.querySelectorAll('[role="tab"]'),
  );

  // The shop bell rings the first time the player visits the trader each day,
  // and some traders say hello on top of it.
  function greetTrader() {
    var t = state.trader;
    if (!traderHere() || t.greeted) return;
    t.greeted = true;
    AT.playSounds(["shopBell"].concat(t.greet ? [[t.greet, 700]] : []), {
      channel: "trader",
      replace: true,
    });
  }

  // Shows one tab's panel and hides the rest. Opening the Log marks it read;
  // opening Trade rings the shop bell (once a day).
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (tab.id === "tab-log") state.logSeen = state.log.length;
    if (tab.id === "tab-trade") greetTrader();
    renderBadges();
    if (focus) tab.focus();
  }

  tabs.forEach(function (tab, i) {
    // Each tab opens on click.
    tab.addEventListener("click", function () {
      selectTab(tab);
    });
    // Arrow keys, Home and End move between tabs (the ARIA tabs pattern).
    tab.addEventListener("keydown", function (e) {
      var next = {
        ArrowRight: i + 1,
        ArrowLeft: i - 1,
        Home: 0,
        End: tabs.length - 1,
      }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      selectTab(tabs[(next + tabs.length) % tabs.length], true);
    });
  });

  // Links that jump to another tab. data-who preselects that survivor on the Map.
  // Used inside pop-ups too (End day check), so close the pop-up first.
  document.addEventListener("click", function (e) {
    var go = e.target.closest("[data-goto]");
    if (!go) return;
    var dlg = go.closest("dialog");
    if (dlg) dlg.close();
    selectTab($("tab-" + go.dataset.goto), true);
  });
  // #endregion [S39] Tab Switching

  // #region [S40] End Day to Dawn
  /* 
---------- End day → dusk → night event → (mini-game) → dawn ----------
*/
  // End day checks the plan first. If anything won't work, it lists the
  // problems and lets the player go back or end the day anyway.
  $("end-day").addEventListener("click", function () {
    // Heads-ups (soft warnings) don't stop the day.
    var problems = planWarnings().filter(function (w) {
      return !w.soft;
    });
    if (!problems.length) {
      endDay();
      return;
    }
    actionSounds(["menu"]);
    $("confirm-list").innerHTML = problems.map(warnItem).join("");
    $("confirm-dialog").showModal();
    $("confirm-back").focus();
  });
  // "Go back" closes the check so the player can fix things.
  $("confirm-back").addEventListener("click", function () {
    $("confirm-dialog").close();
  });
  // "End day anyway" goes ahead despite the warnings.
  $("confirm-end").addEventListener("click", function () {
    $("confirm-dialog").close();
    endDay();
  });

  // #region [S41] Dusk (endDay)
  // Dusk: works out everything the day's tasks did, then shows the Dusk report.
  // Continue on the report moves on to the night event.
  function endDay() {
    // A match is struck as the light goes. The rest of dusk's sounds are cued
    // below and play with the Dusk report.
    endScene();
    sceneSounds(["match"]);
    // Everything logged from here on goes into the Dusk report pop-up.
    var duskMark = state.log.length;
    beginReport();
    // This is dusk where the results come in.
    // What each skill and trait does, with its numbers, is in balance.js [B5] and [B6].
    var scavenged = false; // true if anyone came home tonight (some events need it)
    state.cameBack = []; // where tonight's scavengers came home from (for needsFrom)
    var scavengers = alive().filter(function (s) {
      return s.task === "Scavenge" && s.target;
    });
    scavengers.forEach(function (s) {
      var loc = findLoc(s.target);

      // Already away on a long trip: one day closer to home. They only bring
      // their haul back on the day the trip ends (away reaches 0).
      if (s.away) {
        s.away -= 1;
        if (s.away > 0) {
          note(s, "Still out", "", "at the " + loc.name);
          addLog(
            "exploring",
            s.name + " is still out at the " + loc.name + ".",
            "",
            true,
          );
          return;
        }
      } else {
        if (s.fatigue >= B.survivors.tired) {
          note(s, "Too tired to scavenge", "bad", "stayed home");
          addLog(
            "exploring",
            s.name + " was too tired to scavenge and stayed home.",
            "",
            true,
          );
          return;
        }
        // A city event closed the place since it was picked.
        if (!canVisit(loc)) {
          note(
            s,
            "Couldn't get through",
            "bad",
            "the " + loc.name + " is closed",
          );
          addLog(
            "exploring",
            s.name +
              " couldn't get through to the " +
              loc.name +
              " and came back.",
            "",
            true,
          );
          return;
        }
        // Setting out on a long trip: away from tonight until dusk on the last day.
        if (loc.travel > 1) {
          s.away = loc.travel - 1;
          var back = s.away === 1 ? "tomorrow" : "in " + plural(s.away, "day");
          note(s, "Set out", "", "for the " + loc.name + ", back " + back);
          addLog(
            "exploring",
            s.name +
              " set out for the " +
              loc.name +
              ". Back at dusk " +
              back +
              ".",
            "",
            true,
          );
          return;
        }
      }
      // Some days a scavenger finds a bottle and doesn't make it back until
      // tomorrow. They bring the haul home then.
      if (
        s.trait === "Alcoholic" &&
        !s.lingered &&
        rng() < TR.Alcoholic.chance
      ) {
        s.lingered = true;
        s.away = 1;
        note(s, "Didn't come back", "bad", "still at the " + loc.name);
        addLog(
          "exploring",
          s.name + " didn't come back from the " + loc.name + " tonight.",
          "bad",
          true,
        );
        return;
      }
      s.lingered = false;
      scavenged = true;
      state.cameBack.push(loc.id);
      var events = cityAt(loc);
      // Riskier places hold more, bigger places more again, and longer trips
      // bring back more, but every trip wears survivors out.
      var SC = B.scavenging;
      var haulRoll = function () {
        return (
          rollPair(SC.roll) + SC.perDanger * (loc.danger - 1) + (loc.size || 0)
        );
      };
      var found = haulRoll() + SC.extraPerTripDay * (loc.travel - 1);
      // Lucky rolls again (traits.Lucky.rolls in all) and keeps the best.
      if (s.trait === "Lucky")
        for (var r = 1; r < TR.Lucky.rolls; r++)
          found = Math.max(found, haulRoll());
      if (s.skill === "Scavenger") found += SK.Scavenger.find;
      if (s.trait === "Loner" && scavengers.length === 1)
        found += TR.Loner.find;
      if (
        s.trait === "Extrovert" &&
        scavengers.some(function (o) {
          return o !== s && o.target === s.target;
        })
      )
        found += TR.Extrovert.find;
      if (s.trait === "Clumsy") found += TR.Clumsy.find;
      if (shaken(s)) found -= SHAKEN.find;
      // City events: looters, rival crews and so on leave less behind.
      events.forEach(function (c) {
        if (c.yield) found *= c.yield;
      });
      found = Math.max(0, Math.round(found * D.yield));
      // Each visit to the same place leaves less behind (down to revisitFloor).
      var visits = state.explored.filter(function (id) {
        return id === loc.id;
      }).length;
      found = Math.round(
        found * Math.max(SC.revisitFloor, 1 - visits * SC.revisitLoss),
      );
      var haul = {};
      for (var i = 0; i < found; i++) {
        var kind = loc.loot[Math.floor(rng() * loc.loot.length)];
        haul[kind] = (haul[kind] || 0) + 1;
      }
      if (s.skill === "Hunter") haul.food = (haul.food || 0) + SK.Hunter.food;
      if (s.trait === "Hoarder")
        haul.materials = (haul.materials || 0) + TR.Hoarder.materials;
      // City events can leave extra supplies (an airdrop, a relief truck...).
      events.forEach(function (c) {
        Object.keys(c.extra || {}).forEach(function (k) {
          haul[k] = (haul[k] || 0) + c.extra[k];
        });
      });
      var total = 0;
      Object.keys(haul).forEach(function (k) {
        changeSupply(k, haul[k]);
        total += haul[k];
      });
      state.suppliesGathered += total;
      state.explored.push(loc.id);
      if (total) {
        supplyPills(haul, "good").forEach(function (p) {
          note(s, p.text, p.tone, "", p.icon);
        });
      } else {
        note(s, "Found nothing", "", "at the " + loc.name);
      }
      addLog(
        "exploring",
        s.name +
          " scavenged the " +
          loc.name +
          (total
            ? " and brought back " + AT.minigames.describe(haul) + "."
            : " but found nothing."),
        "",
        true,
      );
      tire(s, workFatigue(s, tripFatigue()) * loc.travel);
      // City events can make a place more (or less) dangerous for the trip.
      var danger = dangerAt(loc);
      if (rng() < D.scavRisk * danger) {
        hurt(
          s,
          SC.injuryPerDanger * danger,
          "exploring",
          "was attacked at the " + loc.name,
        );
      }
      // Sometimes they meet someone out there who wants to join (needs a free bed).
      var people = events.reduce(function (p, c) {
        return p + (c.people || 0);
      }, loc.people || 0);
      if (s.alive && rng() < people) {
        recruit("exploring", "that " + s.name + " met at the " + loc.name);
      }
    });

    // The scavengers come home and unpack.
    if (scavenged) {
      cue("doorClose", 1200);
      cue("rummage", 1700);
    }

    // Facilities that make something every day. Fractions (an Herb Garden's
    // half a medicine, rain barrels in a dry spell) build up until they're whole.
    var MADE_BY = {
      water: "water supply",
      food: "kitchen and garden",
      medicine: "infirmary",
    };
    ["water", "food", "medicine"].forEach(function (k) {
      var made = madeTonight(k);
      state.bank[k] = state.bank[k] + bonus(k) - made;
      if (!made) return;
      changeSupply(k, made);
      addLog(
        "base",
        "The " +
          MADE_BY[k] +
          " made " +
          made +
          " " +
          k +
          (k === "water" && cityHas("drought") ? " (a dry spell)" : "") +
          ".",
      );
    });
    // A Reloading Bench turns materials into ammo.
    var crafted = Math.min(bonus("ammoCraft"), state.resources.materials);
    if (crafted) {
      changeSupply("materials", -crafted);
      changeSupply("ammo", crafted);
      addLog(
        "base",
        "The Reloading Bench turned " +
          plural(crafted, "material") +
          " into ammo.",
      );
    }

    // Construction moves forward one day if someone rested is on Build.
    // A finished upgrade works from tomorrow on.
    var working = builders().length > 0;
    state.facilities.forEach(function (f) {
      var job = f.building;
      if (!job) return;
      var u = UPGRADES[job.id];
      if (!working) {
        addLog("base", "No one worked on the " + u.name + " today.");
        return;
      }
      job.left -= 1;
      if (job.left > 0) return;
      f.building = null;
      cue(f.sound, 2000);
      report.built.push(u.name);
      if (job.repair) {
        f.damaged.splice(f.damaged.indexOf(u.id), 1);
        addLog("base", "The " + u.name + " is repaired.", "good");
        return;
      }
      f.built.push(u.id);
      addLog("base", f.name + ": " + u.name + " built. " + u.effect, "good");
    });

    // Each survivor at the shelter does their task.
    home().forEach(function (s) {
      if (
        s.task === "Build" &&
        s.skill === "Mechanic" &&
        s.fatigue < B.survivors.tired
      ) {
        changeSupply("materials", salvageAmount());
        note(
          s,
          "+" + salvageAmount() + " materials",
          "good",
          "salvaged",
          "materials",
        );
        addLog(
          "base",
          s.name + " salvaged " + salvageAmount() + " materials.",
          "",
          true,
        );
      }
      if (s.task === "Rest" && s.health < 100) {
        // Everyone mends a little with rest; an infirmary helps a lot more,
        // and Quick healers mend faster still.
        var mend =
          (s.trait === "Quick healer" ? TR["Quick healer"].restHeal : 0) +
          bonus("restHeal");
        if (mend) {
          heal(s, mend);
          var where = builtCount(facility("infirmary"))
            ? " in the infirmary"
            : "";
          note(s, "+" + mend + " health", "good", "rested" + where);
          addLog(
            "base",
            s.name + " rested" + where + " and recovered " + mend + " health.",
            "",
            true,
          );
        }
      }
      if (s.task === "Heal") {
        var list = patients();
        if (!list.length) return;
        // Each treatment uses 1 medicine. Without it, only a Medic can treat one person.
        list.forEach(function (p, i) {
          var meds = state.resources.medicine > 0;
          if (!meds && i > 0) return;
          var amount = healAmount(s, meds);
          if (!amount) {
            note(s, "No medicine", "bad", "for " + p.name);
            addLog(
              "base",
              s.name + " had no medicine to treat " + p.name + ".",
              "",
              true,
            );
            return;
          }
          if (meds) changeSupply("medicine", -B.tasks.medicinePerTreatment);
          heal(p, amount);
          if (!cued("healing")) cue("healing", 2000);
          note(p, "+" + amount + " health", "good", "treated by " + s.name);
          if (p !== s) note(s, "Treated " + p.name, "");
          addLog(
            "base",
            s.name + " treated " + p.name + " (+" + amount + " health).",
            "",
            true,
          );
        });
      }
      // Rest lowers fatigue (more with better beds); every other task raises it
      // (scavenging was counted above).
      if (s.task === "Rest") {
        tire(s, -bonus("rest"));
        changeMorale(s, bonus("restMorale"));
      } else if (s.task !== "Scavenge") {
        tire(s, workFatigue(s, B.tasks.workFatigue));
      }
    });

    // Dinner. Anyone away on a trip lives off the land and isn't counted.
    var needFood = foodNeeded();
    var eaten = Math.min(state.resources.food, needFood);
    var needWater = waterNeeded();
    var drunk = Math.min(state.resources.water, needWater);
    changeSupply("food", -eaten);
    changeSupply("water", -drunk);
    // Dinner: the old fridge, a can cracked open, then water poured out.
    if (eaten) cue("fridge", 2400);
    if (drunk) {
      cue("canOpen", 2700);
      cue("pourWater", 3100);
    }
    addLog(
      "base",
      "The group ate " + eaten + " food and drank " + drunk + " water at dusk.",
      "",
      true,
    );

    // Big stockpiles of food go off unless there's somewhere cool to keep them.
    var spoiled = bonus("keepFood")
      ? 0
      : Math.floor(
          Math.max(0, state.resources.food - B.tasks.spoil.above) *
            B.tasks.spoil.rate,
        );
    if (spoiled) {
      changeSupply("food", -spoiled);
      addLog(
        "base",
        plural(spoiled, "food") + " spoiled in the stores.",
        "bad",
      );
    }

    // Going short on food builds hunger; going short on water hurts right away.
    // What there is gets shared out, so it matters how short the group is:
    // 1 water short among 4 people costs each of them a quarter of starveDmg,
    // and with nothing at all to drink everyone takes the full amount.
    var shortFood = needFood - eaten;
    var shortWater = needWater - drunk;
    var foodShare = needFood ? shortFood / needFood : 0; // 0 = everyone ate, 1 = nobody did
    var thirst =
      shortWater > 0 ? Math.ceil((D.starveDmg * shortWater) / needWater) : 0;
    if (shortFood > 0) {
      report.short.food = shortFood;
      addLog("base", "There was not enough food for everyone.", "bad", true);
    }
    if (shortWater > 0) {
      report.short.water = shortWater;
      addLog("base", "There was not enough water for everyone.", "bad", true);
    }
    // A hot meal: anyone on Cook lifts everyone's morale, as long as there
    // was food for everyone (tasks.cookMorale). One cook is enough.
    var cooks = home().filter(function (s) {
      return s.task === "Cook";
    });
    if (cooks.length && eaten > 0 && shortFood <= 0) {
      home().forEach(function (s) {
        changeMorale(s, B.tasks.cookMorale);
      });
      cue("stove", 2000);
      addLog(
        "base",
        cooks[0].name +
          " cooked a hot meal. Everyone +" +
          B.tasks.cookMorale +
          " morale.",
        "good",
      );
    }
    home().forEach(function (s) {
      // Fed: hunger drops by survivors.fed. Nothing to eat: + survivors.unfed.
      // Short rations land in between.
      var SV = B.survivors;
      s.hunger = Math.max(
        0,
        Math.min(
          100,
          s.hunger + Math.round(-SV.fed + (SV.unfed + SV.fed) * foodShare),
        ),
      );
      if (shortFood > 0) changeMorale(s, -SV.shortMorale);
      if (thirst) hurt(s, thirst, "base", "is dehydrated");
      if (s.alive && s.hunger >= SV.starvingAt)
        hurt(s, D.starveDmg, "base", "is starving");
    });

    // Another day wears on everyone at the shelter: a little morale goes, more
    // if they're hungry or hurt, and comforts (a Common Room, chickens) give some back.
    home().forEach(function (s) {
      var lift =
        bonus("dailyMorale") -
        UPKEEP.morale -
        (s.hunger >= UPKEEP.hungryAt ? UPKEEP.hungryMorale : 0) -
        (s.health < B.survivors.injuredBelow ? UPKEEP.hurtMorale : 0);
      var before = s.morale;
      changeMorale(s, lift);
      if (s.alive && before >= SHAKEN.below && shaken(s)) {
        note(s, "Shaken", "bad", "morale under " + SHAKEN.below);
        addLog(
          "base",
          s.name +
            " is shaken. They'll find less and guard worse until morale recovers.",
          "bad",
          true,
        );
      }
    });

    // The people in the group get to each other, for better and worse.
    home().forEach(function (s) {
      if (!s.alive) return;
      var others = home().filter(function (o) {
        return o !== s && o.alive;
      });
      if (s.trait === "Motivational" && others.length) {
        var low = others.reduce(function (a, b) {
          return b.morale < a.morale ? b : a;
        });
        if (low.morale < 100) {
          changeMorale(low, TR.Motivational.morale);
          note(
            low,
            "+" + TR.Motivational.morale + " morale",
            "good",
            "a talk with " + s.name,
          );
          addLog(
            "base",
            s.name + " sat up late talking with " + low.name + ".",
            "good",
          );
        }
      }
      if (
        s.trait === "Argumentative" &&
        others.length &&
        rng() < TR.Argumentative.chance
      ) {
        var target = others[Math.floor(rng() * others.length)];
        changeMorale(target, -TR.Argumentative.morale);
        note(
          target,
          "−" + TR.Argumentative.morale + " morale",
          "bad",
          "a row with " + s.name,
        );
        addLog(
          "base",
          s.name + " and " + target.name + " got into a shouting match.",
          "bad",
          true,
        );
      }
      if (s.trait === "Forgetful" && rng() < TR.Forgetful.chance) {
        var lost = {};
        for (var n = 0; n < TR.Forgetful.lose; n++) {
          var pool = Object.keys(state.resources).filter(function (k) {
            return state.resources[k] - (lost[k] || 0) > 0;
          });
          if (!pool.length) break;
          var k = pool[Math.floor(rng() * pool.length)];
          lost[k] = (lost[k] || 0) + 1;
        }
        if (Object.keys(lost).length) {
          Object.keys(lost).forEach(function (k) {
            changeSupply(k, -lost[k]);
          });
          addLog(
            "base",
            "Nobody can find " +
              AT.minigames.describe(lost) +
              ". " +
              s.name +
              " was the last one to have it.",
            "bad",
            true,
          );
        }
      }
    });

    // Switch to Dusk and show what happened today. Continue moves on to the night.
    state.phase = "dusk";
    renderAll();
    var duskEntries = state.log.slice(duskMark);
    if (!alive().length) {
      showReport({
        kind: "dusk",
        final: true,
        kicker: "Dusk · Day " + pad(state.day),
        title: "No one is left",
        art: "end_lose",
        entries: duskEntries,
        button: "See how it ended",
        next: function () {
          endRun(false);
        },
      });
      return;
    }
    var tonight = pickEvent("night", scavenged);
    showReport({
      kind: "dusk",
      kicker: "Dusk · Day " + pad(state.day),
      title: "Dusk report",
      entries: duskEntries,
      button: "Continue to night",
      next: function () {
        state.phase = "night";
        renderAll();
        if (tonight) openEvent(tonight, "night");
        else {
          eventMark = state.log.length;
          beginReport();
          state.eventTime = "night";
          finishNight();
        }
      },
    });
  }
  // #endregion [S41] Dusk (endDay)

  // #region [S42] Report pop-up
  // ---------- Report pop-up ----------
  // Shows what happened in sections (see [S42b]) and waits for Continue before
  // running opts.next.
  // opts = { kind: "dusk" | "dawn" | "morning", kicker, title, entries (the log
  // lines, for the Full log), art (optional image name), button, next,
  // final (true when the run ends next: no tips), headline (optional override) }
  var reportNext = null;
  // Fills in and opens the report pop-up.
  function showReport(opts) {
    $("report-kicker").textContent = opts.kicker;
    $("report-title").textContent = opts.title;
    var art = $("report-art");
    art.hidden = !opts.art;
    if (opts.art) art.src = "assets/images/png/" + opts.art + ".png";
    $("report-body").innerHTML = reportHtml(opts);
    $("report-body").scrollTop = 0;
    $("report-continue").textContent = opts.button || "Continue";
    reportNext = opts.next;
    $("report-dialog").showModal();
    $("report-continue").focus();
    // Only the story types out (at the Text speed setting; click it to skip).
    // Numbers and everything else show straight away.
    var story = $("report-body").querySelector(".rp-story-text");
    skipTyping = story ? AT.typeText(story, report.story.text) : function () {};
    // Paper for the report, with everything cued since the last one stacked on top.
    sceneSounds(["turnPage"].concat(cues));
    cues = [];
  }

  // Continue closes the report and runs whatever comes next (opts.next).
  $("report-continue").addEventListener("click", function () {
    var next = reportNext;
    reportNext = null;
    // Moving on: cut off whatever this report was still playing (or about to
    // play), and finish any text still being typed.
    endScene();
    skipTyping();
    $("report-dialog").close();
    if (next) next();
  });

  // #region [S42a] Report Data
  /*
---------- What goes into the next report ----------
Each report pop-up covers one stretch of the turn: dusk (endDay), the night
(the night event and the raid) or a morning event. While that stretch plays
out, the game fills in `report` as well as writing the log:
  startAlive  ids of everyone in the group when it began
  gained      supplies that came in, e.g. { food: 4 }
  spent       supplies that went out (eaten, used, paid, lost or fired)
  short       how much food or water dusk was short by
  notes       pills for each survivor's row, by survivor id (see note())
  story       the event and what the choice did (the only text that types out)
  effects     what the choice did to supplies and morale, as pills
  raid        the night raid: the defense in parts, the horde and the result
  died, left, hurt, joined, built   names for the headline
  news        log lines no other section shows (traders, buildings, unlocks...)
*/
  function newReport() {
    return {
      startAlive: alive().map(function (s) {
        return s.id;
      }),
      gained: {},
      spent: {},
      short: {},
      notes: {},
      story: null,
      effects: [],
      city: [], // city events that started (shown in the Dawn report)
      raid: null,
      died: [],
      left: [],
      hurt: [],
      joined: [],
      built: [],
      news: [],
    };
  }
  // Starts a new report: everything from here on goes into the next pop-up.
  function beginReport() {
    report = newReport();
  }
  // Changes a supply and counts it as coming in or going out for the next report.
  // Dusk and the night use this instead of changing state.resources directly.
  function changeSupply(k, n) {
    if (!n) return;
    state.resources[k] += n;
    var book = n > 0 ? report.gained : report.spent;
    book[k] = (book[k] || 0) + Math.abs(n);
  }
  // Adds a pill to a survivor's row in the next report. text is the main part
  // ("+10 health"), why the smaller part after it ("rested"), and icon an
  // optional resource id for its picture.
  function note(s, text, tone, why, icon) {
    if (!report.notes[s.id]) report.notes[s.id] = [];
    report.notes[s.id].push({
      text: text,
      tone: tone || "",
      why: why || "",
      icon: icon || "",
    });
  }
  // Pills for a set of supplies: { food: 3 } becomes "+3 food" with the food
  // icon. With tone "bad" they read as losses ("−3 food").
  function supplyPills(set, tone) {
    return RESOURCES.filter(function (r) {
      return (set || {})[r.id] > 0;
    }).map(function (r) {
      return {
        text: (tone === "bad" ? "−" : "+") + set[r.id] + " " + r.id,
        tone: tone,
        icon: r.id,
      };
    });
  }
  // Joins names into a sentence: "Liam", "Liam and Noah", "Liam, Noah and Emma".
  // word swaps "and" for something else, e.g. "or".
  function nameList(names, word) {
    if (names.length < 2) return names.join("");
    return (
      names.slice(0, -1).join(", ") +
      " " +
      (word || "and") +
      " " +
      names[names.length - 1]
    );
  }
  // The same names without repeats (someone can be hurt twice in one night).
  function uniqueNames(names) {
    return names.filter(function (n, i) {
      return names.indexOf(n) === i;
    });
  }
  // #endregion [S42a] Report Data

  // #region [S42b] Report Sections
  /*
---------- Report sections ----------
The pop-up is built from these sections, top to bottom. Each one only shows
when it has something to say:
  headline   the one thing that mattered most, in a coloured box
  story      the night or morning event: what you chose and what it did
  raid       your defense against the horde, and where that defense came from
  supplies   at dusk: each supply now, with what came in and what went out
             (after the night, the event and raid sections already show it)
  group      a row per survivor, with pills for what happened to them
  also       any other news (traders, finished buildings, the base's production)
  ahead      what to watch next: tonight's odds at dusk, the plan warnings at dawn
  full log   every log line, folded away
*/
  function reportHtml(opts) {
    return [
      reportHeadline(opts),
      reportStory(opts.kind),
      reportRaid(),
      reportCity(),
      reportSupplies(opts.kind),
      reportGroup(opts.kind),
      reportAlso(),
      opts.final ? "" : reportAhead(opts.kind),
      reportFullLog(opts.entries),
    ].join("");
  }

  // A section with a small heading. aside is optional muted text beside it.
  function rpSection(title, body, aside) {
    return (
      '<section class="rp-section"><h3>' +
      title +
      (aside ? ' <span class="rp-note">' + aside + "</span>" : "") +
      "</h3>" +
      body +
      "</section>"
    );
  }

  // One pill: "+4 food" with its icon, or "−15 health" with its reason after it.
  function rpPill(p) {
    return (
      '<span class="rp-pill ' +
      (p.tone || "") +
      '">' +
      (p.icon
        ? '<img src="assets/icons/ingame/' +
          p.icon +
          '.png" alt="" width="18" height="18">'
        : "") +
      esc(p.text) +
      (p.why ? ' <span class="rp-why">' + esc(p.why) + "</span>" : "") +
      "</span>"
    );
  }
  function rpPills(list) {
    return '<span class="rp-pills">' + list.map(rpPill).join("") + "</span>";
  }

  // ---------- Headline ----------
  // A mark for each tone: the colour is never the only signal.
  var HEADLINE_MARKS = { bad: "!", good: "✓", "": "•" };
  function reportHeadline(opts) {
    var h = opts.headline || pickHeadline(opts.kind);
    if (!h) return "";
    return (
      '<p class="rp-headline ' +
      h.tone +
      '"><span class="rp-mark" aria-hidden="true">' +
      HEADLINE_MARKS[h.tone] +
      "</span><span>" +
      esc(h.text) +
      "</span></p>"
    );
  }
  // The one thing that mattered most. Deaths and people leaving come first,
  // then a breach, running out of food or water and injuries, then good news.
  function pickHeadline(kind) {
    var r = report;
    var hurt = uniqueNames(r.hurt);
    var were = function (list) {
      return list.length > 1 ? " were" : " was";
    };
    if (r.died.length)
      return { tone: "bad", text: nameList(r.died) + " did not survive." };
    if (r.left.length)
      return {
        tone: "bad",
        text: nameList(r.left) + " lost all hope and left the group.",
      };
    if (r.raid && !r.raid.held)
      return {
        tone: "bad",
        text:
          "The horde broke through." +
          (r.raid.hurt.length
            ? " " + nameList(r.raid.hurt) + were(r.raid.hurt) + " hurt."
            : ""),
      };
    if (r.short.food && r.short.water)
      return {
        tone: "bad",
        text: "Food and water ran out. Everyone at the shelter is dehydrated.",
      };
    if (r.short.water)
      return {
        tone: "bad",
        text: "The water ran out. Everyone at the shelter is dehydrated.",
      };
    if (r.short.food)
      return {
        tone: "bad",
        text: "There wasn't enough food for everyone. Hunger is building.",
      };
    if (hurt.length)
      return { tone: "bad", text: nameList(hurt) + were(hurt) + " hurt." };
    if (r.raid)
      return {
        tone: "good",
        text: "The horde couldn't get in. Everyone made it through the night.",
      };
    if (r.joined.length)
      return { tone: "good", text: nameList(r.joined) + " joined the group." };
    if (r.built.length)
      return { tone: "good", text: "Finished: " + nameList(r.built) + "." };
    if (kind === "dusk") return { tone: "", text: "A quiet day." };
    return null;
  }

  // ---------- Story (the night or morning event) ----------
  function reportStory(kind) {
    var st = report.story;
    if (!st && !report.effects.length) return "";
    return rpSection(
      kind === "morning" ? "This morning" : "Last night",
      '<div class="rp-story">' +
        (st
          ? "<strong>" +
            esc(st.title) +
            '</strong><p class="rp-story-text">' +
            esc(st.text) +
            "</p>"
          : "") +
        (report.effects.length ? rpPills(report.effects) : "") +
        "</div>",
    );
  }

  // ---------- Night raid ----------
  // Defense vs horde as a scoreboard, then where the defense came from.
  function reportRaid() {
    var r = report.raid;
    if (!r) return "";
    var share = r.threat
      ? Math.min(100, Math.round((r.def / r.threat) * 100))
      : 100;
    var p = r.parts;
    var ammoWhy = !p.ammo
      ? r.ammoIdle
        ? "No one on guard to fire it"
        : "None left"
      : "Guards fired " + plural(r.shots, "round");
    var why = [
      ["Walls", p.walls, r.walls || "Not built yet"],
      [
        "Guards",
        p.guards,
        r.guards.length ? r.guards.join(", ") : "No one on guard",
      ],
      ["Ammo", p.ammo, ammoWhy],
    ]
      .map(function (w) {
        return (
          '<li class="' +
          (w[1] ? "" : "zero") +
          '"><b>' +
          w[0] +
          " " +
          w[1] +
          "</b>" +
          esc(w[2]) +
          "</li>"
        );
      })
      .join("");
    var result =
      (r.cougher ? r.cougher + "'s coughing drew more of them. " : "") +
      (r.held
        ? "Held by " + (r.def - r.threat) + ". The horde dispersed."
        : "Short by " +
          (r.threat - r.def) +
          "." +
          (r.hurt.length
            ? " " + nameList(r.hurt) + " got caught in the breach."
            : ""));
    if (r.wallsDown)
      result += " The " + r.wallsDown + " was damaged and needs repairing.";
    return rpSection(
      "The raid",
      '<div class="rp-raid">' +
        '<div class="rp-vs"><span><span class="rp-side">Your defense</span><span class="rp-big">' +
        r.def +
        '</span></span><span class="rp-vs-word" aria-hidden="true">vs</span>' +
        '<span class="rp-right"><span class="rp-side">Horde</span><span class="rp-big">' +
        r.threat +
        "</span></span></div>" +
        '<div class="rp-bar" role="img" aria-label="Defense ' +
        r.def +
        " against a horde of " +
        r.threat +
        '"><span style="width: ' +
        share +
        '%"></span></div>' +
        '<ul class="rp-parts">' +
        why +
        "</ul>" +
        '<p class="rp-result ' +
        (r.held ? "good" : "bad") +
        '">' +
        esc(result) +
        "</p></div>",
    );
  }

  // ---------- Supplies ----------
  // A tile per supply: how much there is now, and what came in and went out.
  function reportSupplies(kind) {
    if (kind !== "dusk") return "";
    var r = report;
    var changed = RESOURCES.some(function (res) {
      return r.gained[res.id] || r.spent[res.id] || r.short[res.id];
    });
    if (!changed) return "";
    var tiles = RESOURCES.map(function (res) {
      var k = res.id,
        got = r.gained[k] || 0,
        used = r.spent[k] || 0,
        short = r.short[k] || 0;
      var shown =
        (got ? '<span class="up">+' + got + "</span> " : "") +
        (used ? '<span class="down">−' + used + "</span> " : "") +
        (short ? '<span class="down">short ' + short + "</span>" : "");
      // Screen readers get the tile as one sentence.
      var said =
        res.label +
        ": " +
        state.resources[k] +
        (got ? ", " + got + " in" : "") +
        (used ? ", " + used + " out" : "") +
        (short ? ", short by " + short : "");
      return (
        '<div class="rp-res' +
        (short ? " alert" : "") +
        '"><span class="visually-hidden">' +
        said +
        '</span><span aria-hidden="true"><img src="assets/icons/ingame/' +
        k +
        '.png" alt="" width="26" height="26"><span class="rp-n">' +
        state.resources[k] +
        '</span><span class="rp-d">' +
        (shown || "&nbsp;") +
        '</span><span class="rp-lbl">' +
        res.label +
        "</span></span></div>"
      );
    }).join("");
    return rpSection(
      "Supplies after dinner",
      '<div class="rp-supplies">' + tiles + "</div>",
    );
  }

  // ---------- Your group ----------
  // At dusk everyone gets a row with their task. After the night or a morning
  // event, only the people something happened to.
  function reportGroup(kind) {
    var r = report;
    var dusk = kind === "dusk";
    var rows = state.survivors
      .filter(function (s) {
        var was = r.startAlive.indexOf(s.id) !== -1;
        return dusk ? was || r.notes[s.id] : r.notes[s.id];
      })
      .map(function (s) {
        var pills = (r.notes[s.id] || []).slice();
        if (dusk && s.alive && !s.away && s.task === "Guard")
          pills.push(guardPill(s));
        return (
          '<li class="rp-person' +
          (s.alive ? "" : " gone") +
          '"><img class="rp-face" src="assets/images/png/survivor-' +
          s.avatar +
          '.png" alt=""><span class="rp-who">' +
          esc(s.name) +
          "<small>" +
          esc(personLine(s, dusk)) +
          "</small></span>" +
          (pills.length
            ? rpPills(pills)
            : '<span class="rp-none">Nothing to report</span>') +
          "</li>"
        );
      });
    var made = "";
    if (kind === "dawn") {
      var safe = r.startAlive.filter(function (id) {
        return state.survivors.some(function (s) {
          return s.id === id && s.alive;
        });
      }).length;
      made = safe + " of " + r.startAlive.length + " made it through the night";
    }
    if (!rows.length && !made) return "";
    return rpSection(
      "Your group",
      rows.length
        ? '<ul class="rp-people">' + rows.join("") + "</ul>"
        : '<p class="rp-none">No one was hurt.</p>',
      made,
    );
  }
  // The small line under a name: what they did at dusk, or how they are now.
  function personLine(s, dusk) {
    if (!s.alive) return s.status === "Dead" ? "Died" : "Left";
    if (report.startAlive.indexOf(s.id) === -1)
      return "New · " + s.skill + ", " + s.trait.toLowerCase();
    if (s.away) return "Away at the " + findLoc(s.target).name;
    if (!dusk) return "Health " + s.health;
    if (s.task === "Scavenge" && s.target)
      return "Scavenge · " + findLoc(s.target).name;
    return s.task;
  }
  // At dusk, a guard's row says what they'll add tonight.
  function guardPill(s) {
    if (s.fatigue >= B.survivors.tired)
      return { text: "Too tired to guard", tone: "bad" };
    if (s.trait === "Coward") return { text: "Adds no defense", why: "hid" };
    return { text: "+" + guardPower(s) + " defense", why: "tonight" };
  }

  // ---------- Also ----------
  // Log lines no other section shows, so nothing is lost.
  // City events that started this dawn: what, where, for how long.
  function reportCity() {
    if (!report.city.length) return "";
    return rpSection(
      "Around the city",
      '<ul class="rp-news rp-city">' +
        report.city
          .map(function (id) {
            var c = cityEvent(id);
            return (
              "<li><span><strong>" +
              esc(c.title) +
              "</strong> · " +
              esc(cityWhere(c)) +
              ", " +
              plural(cityLeft(id), "day") +
              ". " +
              esc(c.text) +
              (cityEffectText(c)
                ? ' <span class="muted">(' + esc(cityEffectText(c)) + ")</span>"
                : "") +
              "</span></li>"
            );
          })
          .join("") +
        "</ul>",
    );
  }
  function reportAlso() {
    if (!report.news.length) return "";
    return rpSection(
      "Also",
      '<ul class="rp-news">' +
        report.news
          .map(function (e) {
            return (
              '<li class="' +
              e.tone +
              '"><span class="rp-dot" aria-hidden="true">' +
              HEADLINE_MARKS[e.tone] +
              "</span><span>" +
              esc(e.text) +
              "</span></li>"
            );
          })
          .join("") +
        "</ul>",
    );
  }

  // ---------- Ahead ----------
  // At dusk: tonight's odds (too late to change, but good to know) and any
  // food or water that will run short tomorrow. At dawn and in the morning:
  // the same warnings as the Today panel, since the day's plan comes next.
  function reportAhead(kind) {
    var lines = [];
    if (kind === "dusk") {
      var odds = tonightOdds();
      lines.push({
        label: "Tonight",
        tone: odds.level,
        text:
          "Defense " +
          odds.def +
          " vs a horde of " +
          (odds.exact ? odds.threat : hordeRange()) +
          ". " +
          odds.label +
          ".",
      });
      var fc = duskForecast();
      [
        ["Water", "water", fc.water],
        ["Food", "food", fc.food],
      ].forEach(function (f) {
        if (f[2].after < 0) {
          lines.push({
            label: "Tomorrow",
            tone: "bad",
            text:
              f[0] +
              " will run short by " +
              -f[2].after +
              " at dusk. " +
              whereToFind(f[1]),
          });
        }
      });
    } else {
      planWarnings()
        .slice(0, 3)
        .forEach(function (w) {
          lines.push({
            label: "Today",
            tone: w.soft ? "info" : "bad",
            text: w.text,
          });
        });
    }
    if (!lines.length) return "";
    return (
      '<ul class="rp-ahead">' +
      lines
        .map(function (l) {
          return (
            '<li class="' +
            l.tone +
            '"><b>' +
            l.label +
            ":</b> <span>" +
            esc(l.text) +
            "</span></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }
  // Where to get more of a supply: open map locations that have it, the
  // facility that makes it, and the trader if one is here.
  function whereToFind(k) {
    var places = LOCATIONS.filter(function (loc) {
      return !isLocked(loc) && !isClosed(loc) && loc.loot.indexOf(k) !== -1;
    }).map(function (loc) {
      return loc.name;
    });
    var ways = [];
    if (places.length) ways.push("scavenge the " + nameList(places, "or"));
    var maker = { water: "water", food: "kitchen", medicine: "infirmary" }[k];
    var f = maker && facility(maker);
    var more =
      f &&
      f.upgrades.some(function (u) {
        return u.gives[k] && upgradeState(u).status === "open";
      });
    if (more)
      ways.push((builtCount(f) ? "add to the " : "build the ") + f.name);
    if (traderHere()) ways.push("trade with " + state.trader.name);
    if (!ways.length) return "";
    // "Scavenge the Farm or Supermarket, or build the Water supply."
    var text =
      ways.length > 1
        ? ways.slice(0, -1).join(", ") + ", or " + ways[ways.length - 1]
        : ways[0];
    return text.charAt(0).toUpperCase() + text.slice(1) + ".";
  }

  // ---------- Full log ----------
  // Every line, as the Log tab shows them, folded away at the bottom.
  function reportFullLog(entries) {
    if (!entries.length) return "";
    return (
      '<details class="rp-full"><summary>Full log (' +
      plural(entries.length, "line") +
      ')</summary><ol class="report-list">' +
      entries
        .map(function (l) {
          return (
            '<li class="' +
            l.tone +
            '"><span class="chip">' +
            LOG_LABELS[l.cat] +
            "</span><span>" +
            esc(l.text) +
            "</span></li>"
          );
        })
        .join("") +
      "</ol></details>"
    );
  }
  // #endregion [S42b] Report Sections
  // #endregion [S42] Report pop-up

  // #region [S43] Typing
  // ---------- Typing ----------
  // Skips whatever text is still being typed (see AT.typeText in common.js).
  // Replaced each time new text starts typing.
  var skipTyping = function () {};
  // Clicking the text being typed shows it all at once.
  $("report-body").addEventListener("click", function (e) {
    if (e.target.closest(".rp-story")) skipTyping();
  });
  $("event-text").addEventListener("click", function () {
    skipTyping();
  });
  // #endregion [S43] Typing

  // #region [S44] Event overlay
  // ---------- Event overlay ----------
  // Picks an event for "night" or "morning" that fits the run right now
  // (see "When it can happen" in js/story.js), avoiding the last one shown.
  // Returns null when nothing fits.
  function pickEvent(time, scavenged) {
    var pool = EVENTS.filter(function (ev) {
      return (
        (ev.time || "night") === time &&
        (!ev.needsScavenging || scavenged) &&
        (!ev.needsFreeBed || freeBeds() > 0) &&
        (!ev.needsLocked || isLocked(findLoc(ev.needsLocked))) &&
        (!ev.needsFlag || Boolean(state.flags[ev.needsFlag])) &&
        (!ev.needsHurt || someoneHurt()) &&
        (!ev.needsBuilt ||
          builtCount(facility(ev.needsBuilt) || { built: [] }) > 0) &&
        (!ev.blockedBy || !isBuilt(ev.blockedBy)) &&
        (!ev.needsFrom || cameFrom(ev.needsFrom)) &&
        (!ev.minDay || state.day >= ev.minDay) &&
        (!ev.once || state.seenEvents.indexOf(ev.title) === -1)
      );
    });
    if (!pool.length) return null;
    // Events the story needs (`dueBy` in story.js) come first once they're overdue.
    var due = pool.filter(function (ev) {
      return (
        ev.dueBy &&
        state.seenEvents.indexOf(ev.title) === -1 &&
        state.day >= Math.ceil(ev.dueBy * state.length)
      );
    });
    if (due.length) return due[0];
    var fresh = pool.filter(function (ev) {
      return ev.title !== state.lastEvent;
    });
    if (fresh.length) pool = fresh;
    // The marble bag: an event doesn't come back until every other event that
    // fits has had its turn. Then the bag is emptied and they all go back in.
    // Events marked `repeats` in story.js skip the bag.
    var bag = state.eventBag[time] || (state.eventBag[time] = []);
    var unplayed = pool.filter(function (ev) {
      return ev.repeats || bag.indexOf(ev.title) === -1;
    });
    if (!unplayed.length) {
      bag.length = 0;
      unplayed = pool;
    }
    pool = unplayed;
    // City events can make tagged events more likely (`boost` in story.js):
    // city-wide ones always, others after a trip to where they're happening.
    var weights = pool.map(function (ev) {
      return (ev.tags || []).reduce(function (w, tag) {
        state.city.forEach(function (c) {
          var ce = cityEvent(c.id);
          if (
            ce.boost &&
            ce.boost[tag] &&
            (ce.where === "city" || cameFrom(ce.where))
          )
            w *= ce.boost[tag];
        });
        return w;
      }, ev.weight || 1);
    });
    var total = weights.reduce(function (a, b) {
      return a + b;
    }, 0);
    var roll = rng() * total;
    for (var i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll < 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  // The small grey line under each choice: what it needs and what it does.
  function choiceNote(c) {
    var cost = c.cost || {};
    var costParts = Object.keys(cost).map(function (k) {
      return cost[k] + " " + k;
    });
    var parts = [];
    if (c.kind === "skill") parts.push("Requires: " + c.skill);
    if (c.needsFlag) parts.push("Requires: " + (c.needsNote || c.needsFlag));
    if (c.kind === "minigame") parts.push("Starts a mini-game");
    if (costParts.length) parts.push("Costs: " + costParts.join(", "));
    else if (c.kind === "cost") parts.push("No cost");
    if (c.lose)
      parts.push(
        "Lose " +
          Object.keys(c.lose)
            .map(function (k) {
              return c.lose[k] + " " + k;
            })
            .join(", "),
      );
    if (c.fatigue) parts.push("Tiring");
    if (c.fatigueAll)
      parts.push(c.fatigueAll < 0 ? "Everyone rests" : "Tires everyone");
    if (c.injure || c.hurtOne) parts.push("Risky");
    if (c.healOne) parts.push("Treats the worst hurt");
    if (c.morale) parts.push(c.morale < 0 ? "Hurts morale" : "Lifts morale");
    if (c.reward || c.gain) parts.push("Brings supplies");
    if (c.recruit || (c.win && c.win.recruit))
      parts.push(freeBeds() > 0 ? "They join you" : "No free bed for them");
    if (c.unlock || (c.win && c.win.unlock))
      parts.push("Opens the " + findLoc(c.unlock || c.win.unlock).name);
    return parts.join(" · ");
  }

  // Can the group pick this choice right now? Skill choices need a rested
  // survivor with that skill at the shelter; anything with a cost needs the supplies.
  function choiceOk(c) {
    // Story choices can need a flag set by an earlier checkpoint.
    if (c.needsFlag && !state.flags[c.needsFlag]) return false;
    var cost = c.cost || {};
    var affordable = Object.keys(cost).every(function (k) {
      return state.resources[k] >= cost[k];
    });
    if (c.kind === "skill") return Boolean(skilled(c.skill)) && affordable;
    return affordable;
  }

  // Everything logged from the event on goes into the next report pop-up.
  var eventMark = 0;
  // Shows an event. time is "night" or "morning" and decides what comes after
  // it: the night raid and Dawn report, or the Morning report and the day.
  function openEvent(ev, time) {
    eventMark = state.log.length;
    beginReport();
    state.currentEvent = ev;
    state.currentChoice = null;
    state.eventTime = time || "night";
    state.lastEvent = ev.title;
    if (state.seenEvents.indexOf(ev.title) === -1)
      state.seenEvents.push(ev.title);
    // Into the bag, so it waits until the others have had a turn (see pickEvent).
    if (!ev.checkpoint) {
      var bag =
        state.eventBag[state.eventTime] ||
        (state.eventBag[state.eventTime] = []);
      if (bag.indexOf(ev.title) === -1) bag.push(ev.title);
    }
    state.eventsFaced += 1;
    $("event-kicker").textContent = ev.checkpoint
      ? "Day " + pad(state.day) + " · Story"
      : state.eventTime === "morning"
        ? "Day " + pad(state.day) + " · Morning"
        : "Night " + pad(state.day) + " · Event";
    $("event-title").textContent = storyText(ev.title);
    // Event pictures live in assets/images/png/. `art` can be a list: the first
    // picture that exists is shown, and event_generic if none do.
    AT.showArt($("event-art"), ev.art, "event_generic");
    $("event-choices").innerHTML = ev.choices
      .map(function (c, i) {
        var ok = choiceOk(c);
        return (
          '<button class="event-choice" type="button" data-choice="' +
          i +
          '"' +
          (c.sounds ? ' data-sound="none"' : "") +
          (ok ? "" : " disabled") +
          ">" +
          "<strong>" +
          esc(storyText(c.label)) +
          "</strong><span>" +
          choiceNote(c) +
          (ok ? "" : " — not available") +
          "</span></button>"
        );
      })
      .join("");
    $("event-dialog").showModal();
    // The story text types out at the Text speed setting.
    skipTyping = AT.typeText($("event-text"), storyText(ev.text));
    sceneSounds(ev.sounds);
  }

  // Picking a choice: mini-game choices open the mini-game (or auto-resolve it),
  // every other choice is carried out straight away.
  $("event-choices").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-choice]");
    if (!btn || btn.disabled) return;
    var ev = state.currentEvent;
    var c = ev.choices[Number(btn.dataset.choice)];
    skipTyping();
    $("event-dialog").close();
    // The event's own sounds stop; the choice's sounds take over.
    endScene();
    sceneSounds(c.sounds);
    if (c.kind === "minigame") {
      // The report tells the story as the choice the player made.
      report.story = {
        title: storyText(ev.title),
        text: storyText(c.label) + ".",
      };
      state.currentChoice = c; // its `win` effects apply in resolveMinigame()
      if (AT.load().minigames === "auto") autoResolve(c.game);
      else openMinigame(c.game);
      return;
    }
    applyChoice(ev, c);
    afterEvent();
  });

  // Carries out a picked choice: pays its cost, writes the outcome to the log,
  // then applies each of its effects (see the field list in js/story.js [S2]).
  function applyChoice(ev, c) {
    // Who does the work for a skill choice (read before costs change anything).
    var who = c.kind === "skill" ? skilled(c.skill) : null;
    Object.keys(c.cost || {}).forEach(function (k) {
      changeSupply(k, -c.cost[k]);
    });
    report.effects = report.effects.concat(supplyPills(c.cost, "bad"));
    report.story = { title: storyText(ev.title), text: storyText(c.outcome) };
    addLog("event", storyText(ev.title + ": " + c.outcome), "", true);
    if (c.flag) state.flags[c.flag] = true; // remembered for later checkpoints and the ending
    if (c.flag === "signal") state.signalNote = c.outcome; // shown on the Base tab's convoy card
    if (who && c.fatigue) tire(who, c.fatigue);
    if (who && c.injure) hurt(who, c.injure, "event", "was hurt");
    // Losses take as much as there is.
    if (c.lose) {
      var lost = {};
      Object.keys(c.lose).forEach(function (k) {
        lost[k] = Math.min(state.resources[k], c.lose[k]);
        changeSupply(k, -lost[k]);
      });
      report.effects = report.effects.concat(supplyPills(lost, "bad"));
      addLog("event", "Lost " + AT.minigames.describe(lost) + ".", "bad", true);
    }
    if (c.reward) gainSupplies("event", rollReward(c.reward));
    if (c.gain) gainSupplies("event", rollGain(c.gain));
    if (c.healOne) treatWorstHurt(c.healOne, "event");
    if (c.fatigueAll) tireEveryone(c.fatigueAll, "event");
    if (c.recruit)
      recruit("event", ev.from || "after the " + ev.title.toLowerCase());
    if (c.unlock) unlock(c.unlock, "event");
    if (c.morale) {
      alive().forEach(function (s) {
        changeMorale(s, c.morale);
      });
      report.effects.push({
        text: "Morale " + (c.morale < 0 ? "−" + -c.morale : "+" + c.morale),
        tone: c.morale < 0 ? "bad" : "good",
      });
      addLog(
        "event",
        (c.morale < 0 ? "Morale dropped (" : "Morale rose (+") +
          c.morale +
          ").",
        c.morale < 0 ? "bad" : "good",
        true,
      );
    }
    if (c.hurtOne) {
      var victim = pickVictim();
      if (victim) hurt(victim, c.hurtOne, "event", "was hurt");
    }
  }

  // True while anyone at the shelter is injured (under survivors.injuredBelow health).
  function someoneHurt() {
    return home().some(function (s) {
      return s.health < B.survivors.injuredBelow;
    });
  }

  // Event `healOne`: the most hurt survivor at the shelter gets health back.
  function treatWorstHurt(amount, cat) {
    var patient = home()
      .filter(function (s) {
        return s.health < 100;
      })
      .sort(function (a, b) {
        return a.health - b.health;
      })[0];
    if (!patient) return;
    var before = patient.health;
    heal(patient, amount);
    note(
      patient,
      "+" + (patient.health - before) + " health",
      "good",
      "treated",
    );
    addLog(
      cat,
      patient.name +
        " was treated (+" +
        (patient.health - before) +
        " health).",
      "good",
      true,
    );
  }

  // Event `fatigueAll`: everyone at the shelter gets more tired (or rests, if negative).
  function tireEveryone(amount, cat) {
    home().forEach(function (s) {
      tire(s, amount);
    });
    report.effects.push({
      text: amount < 0 ? "Everyone rested" : "Everyone +" + amount + " fatigue",
      tone: amount < 0 ? "good" : "bad",
    });
    addLog(
      cat,
      amount < 0
        ? "Everyone got some rest (" + amount + " fatigue)."
        : "Everyone is worn out (+" + amount + " fatigue).",
      amount < 0 ? "good" : "bad",
      true,
    );
  }

  // After an event (and any mini-game): the night raid for night events, or
  // the Morning report for morning events.
  function afterEvent() {
    if (state.eventTime === "morning") finishMorning();
    else finishNight();
  }
  // #endregion [S44] Event overlay

  // #region [S45] Mini-game Overlay
  //Mini-game overlay. The games themselves live in js/minigames.js.
  // mg = { name, game (controller), phase: 'ready' | 'playing' | 'done', result }
  var mg = null;
  var mgUi = {
    timer: function (sec) {
      $("mg-timer").textContent =
        "Time " + Math.floor(sec / 60) + ":" + pad(sec % 60);
    },
    statA: function (label, text) {
      $("mg-a-label").textContent = label;
      $("mg-left").textContent = text;
    },
    statB: function (label, percent, text) {
      $("mg-b-label").textContent = label;
      $("mg-wall").style.width = Math.max(0, Math.min(100, percent)) + "%";
      $("mg-wall-num").textContent = text;
    },
  };

  // Opens the mini-game overlay and creates the game controller.
  function openMinigame(name) {
    $("mg-title").textContent = name === "Tally" ? "Carve the tally" : name;
    $("mg-instructions").innerHTML =
      esc(MINIGAMES[name]) +
      '<span class="mg-stakes">' +
      esc(minigameStakes(name)) +
      "</span>";
    $("minigame-dialog").dataset.game = name;
    $("minigame-dialog").classList.remove("playing");
    $("mg-start").textContent = "Start";
    $("mg-start").disabled = false;
    $("mg-auto").disabled = false;
    // Skip is offered up front, with the odds, so nobody feels made to play.
    $("mg-auto").textContent =
      "Skip (" + Math.round(D.autoWin * 100) + "% to win)";
    $("mg-skip-note").textContent =
      "Not in the mood? Skip rolls the result instead. " +
      (name === "Tally"
        ? "Options can skip the dawn tally every day."
        : "Options can skip every mini-game.");
    mg = { name: name, phase: "ready", result: null };
    mg.game = AT.minigames.create(name, {
      arena: $("mg-canvas"),
      rng: rng,
      difficulty: state.difficulty,
      wallLevel: Math.min(
        B.minigames.defense.maxLevel,
        Math.round(bonus("defense") / B.minigames.defense.defensePerLevel),
      ),
      marks: state.tallies, // Tally: the marks already on the wall
      length: state.length,
      ui: mgUi,
      done: function (result) {
        mg.phase = "done";
        mg.result = result;
        $("mg-start").textContent = "Continue";
        $("mg-start").disabled = false;
        $("mg-start").focus();
      },
    });
    $("minigame-dialog").showModal();
    $("mg-start").focus();
  }

  // The mini-game's main button: Start begins the game; once it's over the
  // same button reads Continue and applies the result.
  $("mg-start").addEventListener("click", function () {
    if (!mg) return;
    if (mg.phase === "ready") {
      mg.phase = "playing";
      $("mg-start").disabled = true;
      $("mg-start").textContent = "Playing…";
      $("mg-auto").disabled = true;
      countdown(function () {
        if (!mg || mg.phase !== "playing") return;
        $("minigame-dialog").classList.add("playing");
        mg.game.start();
      });
    } else if (mg.phase === "done") {
      var r = mg.result;
      mg = null;
      resolveMinigame(
        $("minigame-dialog").dataset.game,
        r.won,
        false,
        r.reward,
        r,
      );
    }
  });
  // 3, 2, 1, Go! over the arena, so it's clear when the game has started.
  // Reduce motion shortens it to a single "Go!".
  function countdown(done) {
    var arena = $("mg-canvas");
    arena.classList.add("counting");
    var box = document.createElement("div");
    box.className = "mg-countdown";
    box.setAttribute("aria-live", "assertive");
    arena.appendChild(box);
    var steps = AT.load().reduceMotion ? ["Go!"] : ["3", "2", "1", "Go!"];
    var i = 0;
    (function next() {
      if (i >= steps.length) {
        box.remove();
        return;
      }
      box.textContent = steps[i];
      box.classList.toggle("go", steps[i] === "Go!");
      box.classList.remove("pop");
      void box.offsetWidth; // restart the pop animation
      box.classList.add("pop");
      if (steps[i] === "Go!") {
        AT.playSound("click");
        arena.classList.remove("counting");
        done();
      } else AT.playSound("tally", { volume: 0.4 });
      i += 1;
      setTimeout(next, steps[i - 1] === "Go!" ? 500 : 550);
    })();
  }

  // Auto-resolve skips the mini-game and rolls the result instead.
  $("mg-auto").addEventListener("click", function () {
    if (!mg || mg.phase !== "ready") return;
    mg.game.stop();
    mg = null;
    autoResolve($("minigame-dialog").dataset.game);
  });

  // Auto-resolve a mini-game with a D.autoWin chance of winning (depends on difficulty), and a reward based on the game.
  function autoResolve(name) {
    var r = AT.minigames.autoResult(name, rng() < D.autoWin, rng);
    var sounds = AUTO_SOUNDS[name];
    if (sounds) sceneSounds(r.won ? sounds.won : sounds.lost);
    resolveMinigame(name, r.won, true, r.reward);
  }

  // Close the mini-game overlay, log the result, apply any reward, then carry on
  // to the night raid (or the Morning report for a morning event).
  // result is the mini-game's full result (optional). Search adds bites and biteDamage.
  function resolveMinigame(name, won, auto, reward, result) {
    if ($("minigame-dialog").open) $("minigame-dialog").close();
    // Leaving the mini-game cuts off its sounds (see minigames.js).
    AT.stopChannel("minigame");
    AT.stopChannel("searching");
    // The dawn tally isn't part of an event: it has its own ending (see finishTally).
    if (name === "Tally") {
      finishTally(won, auto);
      return;
    }
    var how = auto ? " (auto-resolved)" : "";
    var cat =
      name === "Defense" ? "night" : name === "Search" ? "exploring" : "event";
    var from = state.currentEvent ? state.currentEvent.title + ": " : "";
    report.effects.push({
      text: name + " mini-game " + (won ? "won" : "lost") + how,
      tone: won ? "good" : "bad",
    });
    addLog(
      cat,
      from + name + " mini-game " + (won ? "won" : "lost") + how + ".",
      won ? "good" : "bad",
      true,
    );
    reward = reward || {};
    var gained = 0;
    Object.keys(reward).forEach(function (k) {
      changeSupply(k, reward[k]);
      gained += reward[k];
    });
    if (gained) {
      state.suppliesGathered += gained;
      report.effects = report.effects.concat(supplyPills(reward, "good"));
      addLog(
        cat,
        "Brought back " + AT.minigames.describe(reward) + ".",
        "good",
        true,
      );
    }
    // A won mini-game can carry extra effects from the event choice
    // (e.g. covering a newcomer as they run in means they join).
    var choice = state.currentChoice;
    state.currentChoice = null;
    if (won && choice && choice.win) {
      var ev = state.currentEvent || {};
      if (choice.win.reward) gainSupplies(cat, rollReward(choice.win.reward));
      if (choice.win.gain) gainSupplies(cat, rollGain(choice.win.gain));
      if (choice.win.recruit) {
        recruit(
          cat,
          ev.from || "after the " + (ev.title || "fight").toLowerCase(),
        );
      }
      if (choice.win.unlock) unlock(choice.win.unlock, cat);
      if (choice.win.flag) state.flags[choice.win.flag] = true;
    }
    // Zombie bites from the Search mini-game all land on one survivor (Cowards are spared if possible).
    if (result && result.bites) {
      var bittenOne = pickVictim();
      hurt(
        bittenOne,
        result.bites * result.biteDamage,
        cat,
        "was bitten " +
          (result.bites === 1 ? "once" : result.bites + " times") +
          " while searching",
      );
    }
    if (!won) {
      // A loss injures one survivor at the shelter (Cowards are spared if
      // anyone else is around). Tough survivors take half damage inside hurt().
      hurt(pickVictim(), B.events.minigameLossDamage, cat, "was injured");
    }
    afterEvent();
  }
  // #endregion [S45] Mini-game Overlay

  // #region [S46] Night Raid
  // The horde grows over the run. It starts at threatBase and reaches
  // threatBase + threatPeak x horde.lengthScale on the last night, so longer
  // runs end against a bigger horde. A bigger group makes more noise too.
  function threatTonight() {
    var H = B.horde;
    var scale = H.lengthScale[state.length] || 1 + (state.length - 15) / 100;
    var crowd = Math.max(0, home().length - H.crowdFrom) * H.perSurvivor;
    return Math.round(
      D.threatBase + D.threatPeak * scale * (state.day / state.length) + crowd,
    );
  }
  // The real horde tonight: the estimate plus tonight's roll (re-rolled each dawn).
  function hordeSize() {
    return Math.max(1, threatTonight() + state.hordeRoll);
  }

  // Every night the horde tests your defense. Guards use up ammo, and a breach
  // injures survivors and can knock the walls down a level.
  function nightRaid() {
    if (!alive().length) return;
    var threat = hordeSize();
    // A coughing fit in the dark carries a long way.
    var cougher = home().filter(function (s) {
      return s.trait === "Smoker" && rng() < TR.Smoker.chance;
    })[0];
    // Some nights are harder than others for anyone fighting their demons.
    home().forEach(function (s) {
      if (
        s.trait === "Drug addict" &&
        s.alive &&
        rng() < TR["Drug addict"].chance
      )
        hurt(
          s,
          rollPair(TR["Drug addict"].damage),
          "night",
          "had a rough night, shaking and sweating",
        );
    });
    if (cougher) {
      threat += TR.Smoker.horde;
      addLog(
        "night",
        cougher.name +
          " couldn't stop coughing, and more of the dead came to see.",
        "bad",
        true,
      );
    }
    var parts = defenseParts();
    var def = parts.total;
    var shots = parts.ammo
      ? Math.min(state.resources.ammo, shooters() * B.horde.ammoPerGuard)
      : 0;
    // Who was on guard and what each added, for the raid section of the report.
    var guardNotes = home()
      .filter(function (s) {
        return s.task === "Guard";
      })
      .map(function (s) {
        if (s.fatigue >= B.survivors.tired) return s.name + " was too tired";
        if (s.trait === "Coward") return s.name + " hid";
        return s.name + " +" + guardPower(s);
      });
    changeSupply("ammo", -shots);
    var wallNames = workingUpgrades()
      .filter(function (u) {
        return u.gives.defense;
      })
      .map(function (u) {
        return u.name;
      });
    report.raid = {
      def: def,
      threat: threat,
      parts: parts,
      walls: wallNames.join(", "),
      guards: guardNotes,
      shots: shots,
      cougher: cougher ? cougher.name : "",
      ammoIdle: !parts.ammo && state.resources.ammo > 0, // ammo left unused: no one to fire it
      held: def >= threat,
      hurt: [],
      wallsDown: "",
    };
    // Raid sounds play with the Dawn report, after the night event's own sounds.
    // One gunshot per bullet the guards fire (up to 4 you can hear).
    for (var shot = 0; shot < Math.min(shots, 4); shot++) {
      cue("gunshot", 1500 + shot * 350);
    }
    home().forEach(function (s) {
      if (s.task === "Guard")
        tire(s, workFatigue(s, B.tasks.guardNightFatigue));
    });
    if (def >= threat) {
      cue("horde", 1300);
      cue("zombieDying", 2700);
      addLog(
        "night",
        "The horde hit the walls but could not break through, then dispersed (defense " +
          def +
          " vs " +
          threat +
          ").",
        "good",
        true,
      );
      return;
    }
    var breach = threat - def;
    cue("hordeClose", 1300);
    cue("zombieAttack", 2000);
    cue("glassBreak", 2300);
    addLog(
      "night",
      "The horde broke through (defense " + def + " vs " + threat + ").",
      "bad",
      true,
    );
    // Bigger breaches catch more people. Anyone away on a trip is safe.
    var BR = B.horde.breach;
    var hits = breach >= BR.twoHurtAt ? 2 : 1;
    for (var i = 0; i < hits && home().length; i++) {
      var list = home();
      var v = list[Math.floor(rng() * list.length)];
      if (report.raid.hurt.indexOf(v.name) === -1)
        report.raid.hurt.push(v.name);
      hurt(
        v,
        Math.min(BR.max, BR.base + breach * BR.perPoint),
        "night",
        "was caught in the breach",
      );
    }
    // A big breach damages the newest working part of the walls (never the
    // last one standing). A Fortified Wall can't be damaged.
    var walls = facility("walls");
    var standing = walls.built.filter(function (id) {
      return !isDamaged(id) && UPGRADES[id].gives.defense;
    });
    if (breach >= BR.wallDamageAt && standing.length > 1 && !bonus("sturdy")) {
      var hit = UPGRADES[standing[standing.length - 1]];
      walls.damaged.push(hit.id);
      cue("woodSplitting", 2800);
      report.raid.wallsDown = hit.name;
      addLog(
        "night",
        "The " + hit.name + " was damaged. Repair it on the Base tab.",
        "bad",
        true,
      );
    }
  }
  // What the night looked like, for the ?debug playtest log (js/debug.js).
  function nightSnapshot() {
    var r = report.raid || {};
    var parts = r.parts || {};
    var group = alive();
    var avg = function (key) {
      if (!group.length) return 0;
      var sum = group.reduce(function (t, s) {
        return t + s[key];
      }, 0);
      return Math.round(sum / group.length);
    };
    return {
      day: state.day,
      horde: r.threat || 0,
      defense: r.def || 0,
      walls: parts.walls || 0,
      guards: parts.guards || 0,
      ammoDefense: parts.ammo || 0,
      held: Boolean(r.held),
      breach: Math.max(0, (r.threat || 0) - (r.def || 0)),
      food: state.resources.food,
      water: state.resources.water,
      materials: state.resources.materials,
      medicine: state.resources.medicine,
      ammo: state.resources.ammo,
      alive: group.length,
      health: avg("health"),
      morale: avg("morale"),
      hunger: avg("hunger"),
      fatigue: avg("fatigue"),
      built: workingUpgrades().length,
    };
  }
  // #endregion [S46] Night Raid

  // #region [S47] Finish Night, Morning & Start Day
  // Runs after the night event (and any mini-game) is resolved: the horde
  // attacks, then the Dawn report shows the whole night before the new day.
  function finishNight() {
    state.currentEvent = null;
    nightRaid();
    // In ?debug mode, every night goes into the playtest log (js/debug.js).
    if (AT.debugLog) AT.debugLog.night(nightSnapshot());
    var kicker = "Night " + pad(state.day) + " · Results";

    if (!alive().length) {
      renderAll();
      showReport({
        kind: "dawn",
        final: true,
        kicker: kicker,
        title: "No one survived the night",
        art: "end_lose",
        entries: state.log.slice(eventMark),
        button: "See how it ended",
        next: function () {
          endRun(false);
        },
      });
      return;
    }
    if (state.day >= state.length) {
      addLog("base", "The group survived the last night.", "good", true);
      cue("rooster", 4000);
      renderAll();
      showReport({
        kind: "dawn",
        final: true,
        headline: { tone: "good", text: "The group survived the last night." },
        kicker: kicker,
        title: "You made it",
        art: "end_win",
        entries: state.log.slice(eventMark),
        button: "See how it ended",
        next: function () {
          endRun(true);
        },
      });
      return;
    }

    state.day += 1;
    state.phase = "dawn";
    cue("rooster", 4000);
    state.hordeRoll = randInt(-B.horde.roll, B.horde.roll);
    traderDawn();
    cityDawn();
    alive().forEach(function (s) {
      if (s.trait === "Optimist" && s.health < 100) {
        var lift = TR.Optimist.morningHeal;
        heal(s, lift);
        note(s, "+" + lift + " health", "good", "woke up hopeful");
        addLog(
          "base",
          s.name + " woke up hopeful (+" + lift + " health).",
          "good",
          true,
        );
      }
    });
    addLog(
      "base",
      alive().length +
        " survivor" +
        (alive().length === 1 ? "" : "s") +
        " made it through the night.",
      "",
      true, // the report's group section says how many made it
    );
    renderAll();
    // A story checkpoint (js/story.js) always takes the morning on its day.
    // Other mornings sometimes bring an event before the day starts.
    var morning =
      AT.STORY.checkpointFor(state.day, state.length) ||
      (rng() < B.events.morningChance ? pickEvent("morning") : null);
    showReport({
      kind: "dawn",
      kicker: "Dawn · Day " + pad(state.day),
      title: "Dawn report",
      entries: state.log.slice(eventMark),
      button: "Carve the tally",
      next: function () {
        carveTally(function () {
          if (morning) openEvent(morning, "morning");
          else startDay();
        });
      },
    });
  }

  // Dawn: carve the new day's mark with the Tally mini-game (or auto-resolve it,
  // following the Mini-games option), then carry on with next().
  var tallyNext = null;
  function carveTally(next) {
    tallyNext = next;
    state.currentEvent = null;
    state.currentChoice = null;
    // Options: "auto" skips every mini-game, "tally" only the dawn tally.
    var setting = AT.load().minigames;
    if (setting === "auto" || setting === "tally") autoResolve("Tally");
    else openMinigame("Tally");
  }

  // Adds the mark to the wall, applies its morale and moves on.
  function finishTally(won, auto) {
    var number = state.tallies.length + 1;
    var fifth = number % 5 === 0;
    state.tallies.push(won);
    var lift = won ? (fifth ? TALLY.fifth : TALLY.clean) : TALLY.crooked;
    alive().forEach(function (s) {
      changeMorale(s, lift);
    });
    var how = auto ? " (auto-resolved)" : "";
    var text = won
      ? (fifth ? "Slashed through five: tally " : "Carved tally ") +
        number +
        " on the wall. Morale +" +
        lift +
        "."
      : "The blade slipped. Tally " +
        number +
        " came out crooked. Morale " +
        lift +
        ".";
    addLog("base", text + how, won ? "good" : "bad");
    toast(text);
    renderAll();
    // Losing morale can make someone leave; if no one is left, the run ends.
    if (!alive().length) {
      endRun(false);
      return;
    }
    var next = tallyNext;
    tallyNext = null;
    if (next) next();
  }

  // Runs after a morning event: shows what it led to, then starts the day.
  function finishMorning() {
    state.currentEvent = null;
    renderAll();
    var entries = state.log.slice(eventMark);
    if (!alive().length) {
      showReport({
        kind: "morning",
        final: true,
        kicker: "Day " + pad(state.day) + " · Morning",
        title: "No one is left",
        art: "end_lose",
        entries: entries,
        button: "See how it ended",
        next: function () {
          endRun(false);
        },
      });
      return;
    }
    showReport({
      kind: "morning",
      kicker: "Day " + pad(state.day) + " · Morning",
      title: "This morning",
      entries: entries,
      button: "Start day " + state.day,
      next: startDay,
    });
  }

  // The day begins: the player can plan again. What changed since yesterday
  // morning shows on the resource tiles (renderHeader) and in a toast.
  function startDay() {
    state.phase = "day";
    var before = state.dayStartRes || {};
    state.dayDelta = {};
    var parts = [];
    RESOURCES.forEach(function (r) {
      var d = state.resources[r.id] - (before[r.id] || 0);
      if (d) {
        state.dayDelta[r.id] = d;
        parts.push((d > 0 ? "+" : "−") + Math.abs(d) + " " + r.id);
      }
    });
    state.dayStartRes = Object.assign({}, state.resources);
    // A new trader lights up the Trade tab (set before drawing, so the
    // tab's "New" badge shows straight away).
    var arrived = state.traderNew && traderHere();
    state.traderNew = false;
    if (arrived) $("tab-trade").classList.add("arrived");
    renderAll();
    if (arrived) {
      // ...with the shop bell and a toast.
      var tr = state.trader;
      AT.playSounds(["shopBell"].concat(tr.greet ? [[tr.greet, 700]] : []), {
        channel: "action",
      });
      tr.greeted = true;
      toast(
        "A trader is here: " +
          tr.name +
          " (" +
          tr.title.toLowerCase() +
          "), staying " +
          plural(tr.leaves, "day") +
          ". See the Trade tab.",
      );
    } else if (parts.length)
      toast("Since yesterday morning: " + parts.join(", ") + ".");
    // The tiles pop once so the change is noticed.
    var bar = $("resources");
    bar.classList.remove("fresh");
    void bar.offsetWidth;
    bar.classList.add("fresh");
  }
  // #endregion [S47] Finish Night, Morning & Start Day
  // #endregion [S40] End Day to Dawn

  // #region [S48] Leaving, Pause & Start-up
  // #region [S49] Leaving the Page
  // ---------- Leaving the page ----------
  function endRun(won) {
    var group = state.survivors.map(function (s) {
      return {
        name: s.name,
        avatar: s.avatar,
        fate: s.alive ? "Alive" : "Lost on day " + pad(s.lostOn),
      };
    });
    var result = {
      won: won,
      shelter: state.shelter,
      length: state.length,
      daysSurvived: won ? state.length : state.day - 1,
      // The marks for every day fully survived (clean or crooked), for the Final Tally.
      tallies: state.tallies.slice(0, won ? state.length : state.day - 1),
      alive: alive().length,
      lost: state.survivors.length - alive().length,
      supplies: state.suppliesGathered,
      explored: LOCATIONS.filter(function (l) {
        return state.explored.indexOf(l.id) !== -1;
      }).length,
      locations: LOCATIONS.length,
      events: state.eventsFaced,
      found: state.recruited,
      flags: state.flags, // picks the ending on end.html (js/story.js)
      group: group,
    };
    AT.handoff.setResult(result);
    // In ?debug mode, the run goes into the playtest log (js/debug.js).
    if (AT.debugLog) AT.debugLog.end(result, state);
    leaving = true;
    location.href = "end.html";
  }

  // Warn before a refresh, close or back button throws the run away.
  window.addEventListener("beforeunload", function (e) {
    if (leaving) return;
    e.preventDefault();
    e.returnValue = "";
  });
  // #endregion [S49] Leaving the Page

  // #region [S50] Pause Menu
  // ---------- Pause menu ----------
  var pauseDialog = $("pause-dialog");
  // True if any pop-up is open (Esc only pauses when none is).
  function anyDialogOpen() {
    return document.querySelector("dialog[open]") !== null;
  }

  // ---------- Mute ----------
  // The speaker button in the top bar (or the M key) flips the Sound setting
  // from the Options page, so music, ambience and effects all stop together.
  function renderMute() {
    var on = AT.load().sound;
    $("mute-btn").setAttribute("aria-pressed", String(!on));
    $("mute-btn").title = on ? "Mute (M)" : "Unmute (M)";
    $("mute-btn").querySelector(".visually-hidden").textContent = on
      ? "Mute"
      : "Unmute";
    $("mute-icon").textContent = on ? "🔊" : "🔇";
  }
  function toggleMute() {
    var s = AT.load();
    s.sound = !s.sound;
    AT.save(s);
    if (!s.sound) {
      ["scene", "action", "minigame", "searching", "ambienceExtras"].forEach(
        function (ch) {
          AT.stopChannel(ch);
        },
      );
    }
    renderMute();
    toast(s.sound ? "Sound on." : "Sound off.");
  }
  $("mute-btn").addEventListener("click", toggleMute);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "m" && e.key !== "M") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (
      t &&
      (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    )
      return;
    toggleMute();
  });
  // Sound turned on or off on the Options page (opened from the menu in another tab).
  window.addEventListener("storage", renderMute);
  renderMute();

  // Opens the menu, with the day and shelter name under the title.
  function openPause() {
    $("pause-sub").textContent =
      (state.phase === "night" ? "Night " : "Day ") +
      pad(state.day) +
      " of " +
      state.length +
      " · " +
      state.shelter;
    pauseDialog.showModal();
  }
  // The Menu button and the Esc key open the menu (the run waits while it's open).
  $("pause-btn").addEventListener("click", openPause);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !anyDialogOpen()) {
      e.preventDefault();
      openPause();
    }
  });
  // Resume closes the pause menu.
  $("resume").addEventListener("click", function () {
    pauseDialog.close();
  });
  // Options and How to play open in a new tab so the run keeps going here.
  pauseDialog.addEventListener("click", function (e) {
    var open = e.target.closest("[data-open]");
    if (open) window.open(open.dataset.open + "?from=game", "_blank");
  });
  // Quit to title ends the run without the "are you sure?" warning.
  $("quit").addEventListener("click", function () {
    leaving = true;
    location.href = "index.html";
  });

  // Events, mini-games and reports must be answered; Esc does not dismiss them.
  ["story-dialog", "event-dialog", "minigame-dialog", "report-dialog"].forEach(
    function (id) {
      $(id).addEventListener("cancel", function (e) {
        e.preventDefault();
      });
    },
  );
  // #endregion [S50] Pause Menu

  // #region [S51] Opening Story
  // ---------- Opening story ----------
  // Fills {shelter}, {day} and the other placeholders in story text
  // (see the top of js/story.js).
  function storyText(text) {
    return AT.STORY.fill(text, {
      shelter: state.shelter,
      length: state.length,
      day: state.day,
      daysLeft: state.length - state.day,
      alive: alive().length,
      lost: state.survivors.length - alive().length,
    });
  }

  // Shows the opening story once, before day 1. With no paragraphs in
  // js/story.js the pop-up is skipped.
  function openIntro() {
    var intro = AT.STORY.intro;
    if (!intro || !intro.paragraphs || !intro.paragraphs.length) {
      AT.playSound("doorClose");
      return;
    }
    $("story-kicker").textContent = storyText(intro.kicker || "");
    $("story-title").textContent = storyText(intro.title || "");
    var art = $("story-art");
    art.hidden = !intro.art;
    if (intro.art) art.src = "assets/images/png/" + intro.art + ".png";
    // One <p> per paragraph, typed out one after another.
    var box = $("story-text");
    box.innerHTML = "";
    var paras = intro.paragraphs.map(function () {
      return box.appendChild(document.createElement("p"));
    });
    $("story-continue").textContent = intro.button || "Begin day 1";
    $("story-dialog").showModal();
    $("story-continue").focus();
    skipTyping = AT.typeLines(paras, intro.paragraphs.map(storyText));
  }
  // Clicking the story shows it all at once.
  $("story-text").addEventListener("click", function () {
    skipTyping();
  });
  // Begin closes the story, and the door shuts behind the group.
  $("story-continue").addEventListener("click", function () {
    skipTyping();
    $("story-dialog").close();
    AT.playSound("doorClose");
  });
  // #endregion [S51] Opening Story

  // #region [S52] Start-up (Go)
  // ---------- Go ----------
  function renderAll() {
    renderHeader();
    renderSide();
    renderBase();
    renderSurvivors();
    renderMap();
    renderTrade();
    renderLog();
    renderBadges();
    phaseSound();
  }

  // Tells the CSS how tall the sticky header is, so the side panel and
  // map details can stick just below it (see --header-h in style.css).
  var gameHeader = document.querySelector(".game-header");
  if (gameHeader && window.ResizeObserver) {
    new ResizeObserver(function () {
      document.documentElement.style.setProperty(
        "--header-h",
        gameHeader.offsetHeight + "px",
      );
    }).observe(gameHeader);
  }

  // ?debug mode (js/debug.js): the debug panel can look at the run, change
  // it, and redraw the screen after a balance change.
  if (AT.debug) {
    AT.debugHooks = {
      state: state,
      setup: setup,
      renderAll: renderAll,
      toast: toast,
      heal: heal,
      changeMorale: changeMorale,
      threatTonight: threatTonight,
      nightDefense: nightDefense,
      data: {
        FACILITIES: FACILITIES,
        LOCATIONS: LOCATIONS,
        TRADERS: TRADERS,
        DISTRICTS: DISTRICTS,
        REWARDS: Object.keys(REWARDS),
      },
    };
  }

  addLog("base", "The group settled into " + state.shelter + ".");
  state.logSeen = state.log.length; // the opening line doesn't count as news
  // Load the game's sounds now so the first gunshot or footstep isn't late,
  // and start loading the ambience so each phase can switch in straight away.
  AT.preloadSounds();
  AT.preloadAmbience(
    Object.keys(PHASE_SOUNDS).map(function (p) {
      return PHASE_SOUNDS[p].ambience;
    }),
  );
  renderAll();
  // The opening story, then the door shuts behind the group as they settle in.
  openIntro();
  // #endregion [S52] Start-up (Go)
  // #endregion [S48] Leaving, Pause & Start-up
})();

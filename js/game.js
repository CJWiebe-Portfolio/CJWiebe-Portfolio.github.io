/*
=========================================================
FILE: new-game.js
PROJECT: Another Tally - A zombie survival game
AUTHOR: Cygnus J. Wiebe
DATE: December 14th, 2026
COURSE: INFS 634 - McGill University
=========================================================
DESCRIPTION:
Everything about a run lives in the `state` object below, in this tab's memory only.
This file wires up the five tabs, the side panel, End day and the three overlays
(event, mini-game, pause) with placeholder data. Spots where real game rules go
are marked TODO.
=========================================================
*/

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
  /*
=========================================================
---------- Static game data [WORK IN PROGRESS NEEDS TUNING] ----------
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
  // Defines starting resources for each difficulty level
  var START_RESOURCES = {
    easy: { food: 15, water: 15, materials: 12, medicine: 4, ammo: 8 },
    normal: { food: 10, water: 10, materials: 8, medicine: 2, ammo: 5 },
    hard: { food: 6, water: 6, materials: 5, medicine: 1, ammo: 3 },
  };
  // Defines how hard each difficulty is beyond the starting resources. [TUNE THESE]
  // yield:       share of scavenged supplies you actually bring home
  // threatBase:  size of the horde on night 1
  // threatPeak:  how much the horde grows by the last night (scales with run length)
  // starveDmg:   health lost per dusk without enough water, or while starving
  // scavRisk:    chance per danger level that a scavenger gets hurt
  // autoWin:     chance an auto-resolved mini-game is won
  // moraleLoss:  morale lost by everyone when a survivor dies
  var DIFFICULTY = {
    easy: { yield: 0.95, threatBase: 9, threatPeak: 18, starveDmg: 10, scavRisk: 0.1, autoWin: 0.7, moraleLoss: 10 },
    normal: { yield: 0.85, threatBase: 8, threatPeak: 22, starveDmg: 15, scavRisk: 0.15, autoWin: 0.55, moraleLoss: 15 },
    hard: { yield: 0.8, threatBase: 7, threatPeak: 23, starveDmg: 20, scavRisk: 0.2, autoWin: 0.4, moraleLoss: 20 },
  };
  var D = DIFFICULTY[setup.difficulty] || DIFFICULTY.normal;
  // Fatigue at or above this keeps a survivor from scavenging or guarding.
  var TIRED = 80;

  // Defines trade values for each resource
  var TRADE_VALUE = { food: 2, water: 2, materials: 1, medicine: 4, ammo: 3 };
  // Defines tasks that survivors can be assigned to each day
  var TASKS = ["Rest", "Scavenge", "Build", "Guard", "Cook", "Heal"];

  /* 
---------- Facilities [WORK IN PROGRESS NEEDS TUNING]----------
*/
  var FACILITIES = [
    {
      id: "beds",
      img: "bedroom",
      name: "Beds",
      level: 1,
      desc: "Sets how many survivors you can house",
      cost: 4,
      days: 1,
    },
    {
      id: "kitchen",
      img: "kitchen",
      name: "Kitchen and garden",
      level: 1,
      desc: "Grows and cooks food",
      cost: 5,
      days: 1,
    },
    {
      id: "water",
      img: "watercollector",
      name: "Water collector",
      level: 1,
      desc: "Collects water each day",
      cost: 6,
      days: 2,
    },
    {
      id: "workshop",
      img: "workshop",
      name: "Workshop",
      level: 1,
      desc: "Crafts items and lowers upgrade costs",
      cost: 5,
      days: 1,
    },
    {
      id: "infirmary",
      img: "infirmary",
      name: "Infirmary",
      level: 0,
      desc: "Heals injured and sick survivors",
      cost: 8,
      days: 2,
    },
    {
      id: "walls",
      img: "watchtower",
      name: "Walls and watchtower",
      level: 1,
      desc: "Raises night defense",
      cost: 6,
      days: 2,
    },
  ];

  /* 
---------- Map Locations and there button x/y coordinates [WORK IN PROGRESS NEEDS TUNING] ----------
*/
  var LOCATIONS = [
    {
      id: "gas",
      img: "gas_station",
      name: "Gas station",
      x: 13,
      y: 12,
      danger: 1,
      travel: 1,
      finds: "Materials, fuel",
      loot: ["materials"],
    },
    {
      id: "hospital",
      name: "Hospital",
      x: 42,
      y: 8,
      danger: 2,
      travel: 1,
      finds: "Medicine, food",
      loot: ["medicine", "food"],
    },
    {
      id: "police",
      img: "police_station",
      name: "Police station",
      x: 69,
      y: 20,
      danger: 3,
      travel: 1,
      finds: "Ammo, medicine",
      loot: ["ammo", "medicine"],
    },
    {
      id: "farm",
      name: "Farm",
      x: 11,
      y: 38,
      danger: 1,
      travel: 2,
      finds: "Food, water",
      loot: ["food", "water"],
    },
    {
      id: "supermarket",
      name: "Supermarket",
      x: 69,
      y: 55,
      danger: 2,
      travel: 1,
      finds: "Food, water",
      loot: ["food", "water"],
    },
    {
      id: "suburb",
      name: "Suburb",
      x: 10,
      y: 72,
      danger: 1,
      travel: 1,
      finds: "Materials, food",
      loot: ["materials", "food"],
    },
    {
      id: "school",
      name: "School",
      x: 38,
      y: 68,
      danger: 1,
      travel: 1,
      finds: "Materials",
      loot: ["materials"]
    },
    {
      id: "military",
      img: "military_checkpoint",
      name: "Military checkpoint",
      x: 58,
      y: 86,
      danger: 3,
      travel: 2,
      finds: "Ammo, medicine",
      loot: ["ammo", "medicine"],
      locked: true,
    },
  ];
  var SHELTER_POS = { x: 41, y: 45 };

  /* 
---------- Events [WORK IN PROGRESS NEEDS TUNING] ----------
*/
  // Any choice can also have: cost (resources), fatigue (added to the survivor with the skill),
  // injure (health the skill survivor loses) and morale (added to everyone, can be negative).
  // All event choices have a three options types: 'skills' (require a survivor with a specific skill), the 'minigame' is a challenge of the player, or 'cost' which requires a resource cost. [WORK IN PROGRESS NEEDS TUNING]
  var EVENTS = [
    {
      title: "Knocking at the gate",
      art: "event_gate",
      text: "Someone is pounding on the gate, begging to be let in. Behind them, shapes shuffle out of the dark.",
      choices: [
        {
          label: "Talk them through it",
          kind: "skill",
          skill: "Medic",
          cost: { medicine: 1 },
          outcome:
            "You checked the stranger for bites and let them sleep in the yard.",
        },
        { label: "Clear the street first", kind: "minigame", game: "Defense" },
        {
          label: "Pay them to move on",
          kind: "cost",
          cost: { food: 3 },
          outcome: "You passed food through the gate. They left.",
        },
      ],
    },
    {
      title: "A locked supply crate",
      art: "event_crate",
      text: "A survivor found a padlocked crate in the alley behind the shelter.",
      choices: [
        {
          label: "Pry it open",
          kind: "skill",
          skill: "Builder",
          fatigue: 20,
          outcome: "The crate gave way. (Loot is a placeholder.)",
        },
        { label: "Pick the lock", kind: "minigame", game: "Lockpick" },
        {
          label: "Leave it",
          kind: "cost",
          cost: {},
          morale: -5,
          outcome: "You left the crate where it was.",
        },
      ],
    },
    {
      title: "Raid on the walls",
      art: "event_raid",
      text: "A crowd of the dead presses against the north wall. It will not hold for long.",
      choices: [
        {
          label: "Hold the line",
          kind: "skill",
          skill: "Fighter",
          fatigue: 30,
          injure: 10,
          outcome: "Your fighter held the wall until dawn.",
        },
        { label: "Defend the wall", kind: "minigame", game: "Defense" },
        {
          label: "Fire into the crowd",
          kind: "cost",
          cost: { ammo: 3 },
          outcome: "The shots scattered the crowd.",
        },
      ],
    },
    {
      title: "A house worth searching",
      art: "event_house",
      text: "On the way back, your scavenger spotted a house with the door hanging open. The dead can't be far.",
      needsScavenging: true, // only offered on nights after someone went scavenging
      choices: [
        { label: "Search it room by room", kind: "minigame", game: "Search" },
        {
          label: "Let the expert pick the spots",
          kind: "skill",
          skill: "Scavenger",
          fatigue: 20,
          outcome:
            "Your scavenger went straight for the pantry and slipped out quietly.",
        },
        {
          label: "Head home before dark",
          kind: "cost",
          cost: {},
          outcome: "You left the house alone.",
        },
      ],
    },
  ];

  /* 
---------- Minigame descriptions ----------
*/
  var MINIGAMES = {
    Defense: "Click zombies before they reach the wall.",
    Lockpick: "Turn the pins in the right order before time runs out.",
    Search: "Find the supplies hidden in the room.",
  };

  /* 
---------- Logs will record all that happens ----------
*/
  var LOG_LABELS = {
    event: "Event",
    exploring: "Exploring",
    night: "Night raid",
    trade: "Trade",
    base: "Base",
  };
  var LOG_FILTERS = [
    { id: "all", label: "All" },
    { id: "event", label: "Events" },
    { id: "exploring", label: "Exploring" },
    { id: "night", label: "Night raids" },
    { id: "trade", label: "Trade" },
    { id: "base", label: "Base" },
  ];

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
    resources: Object.assign(
      {},
      START_RESOURCES[setup.difficulty] || START_RESOURCES.normal,
    ),
    facilities: FACILITIES.map(function (f) {
      return Object.assign({}, f);
    }),
    survivors: setup.survivors.map(function (s, i) {
      return {
        id: "s" + i,
        name: s.name,
        skill: s.skill,
        trait: s.trait,
        avatar: s.avatar || 1,
        health: randInt(60, 100),
        hunger: randInt(20, 50),
        fatigue: randInt(10, 50),
        morale: randInt(50, 90),
        status: "Healthy",
        alive: true,
        lostOn: null,
        task: ["Scavenge", "Build", "Rest"][i] || "Rest",
        target: i === 0 ? "hospital" : null,
      };
    }),
    explored: [],
    selectedLocation: "hospital",
    trade: { give: {}, get: {} },
    trader: {
      name: "Old Marguerite",
      leaves: 2,
      // What the trader has to sell. [WORK IN PROGRESS NEEDS TUNING]
      stock: { food: 6, water: 6, materials: 8, medicine: 3, ammo: 4 },
    },
    log: [],
    logFilter: "all",
    eventsFaced: 0,
    suppliesGathered: 0,
    currentEvent: null,
    sendWho: null, // survivor picked in advance on the Map (set by "Choose destination" links)
    logSeen: 0, // how many log entries the player has seen on the Log tab (for its badge)
    logOpen: {}, // which days the player has opened or closed in the Log
  };
  var leaving = false;

  // ---------- Checks if a survivor is alive ----------
  function alive() {
    return state.survivors.filter(function (s) {
      return s.alive;
    });
  }
  // ---------- Checks the state of a facility ----------
  function facility(id) {
    return state.facilities.find(function (f) {
      return f.id === id;
    });
  }
  // ---------- Checks the number of available beds ----------
  function bedCount() {
    return 2 + facility("beds").level * 2;
  }
  // ---------- Checks the number of available guards ----------
  function guards() {
    return alive().filter(function (s) {
      return s.task === "Guard";
    }).length;
  }
  // ---------- Checks the night defense value ----------
  // How much night defense one survivor adds. Skills/traits are defined in common.js.
  function guardPower(s) {
    if (s.task !== "Guard" || s.trait === "Coward" || s.fatigue >= TIRED) return 0;
    var power = s.skill === "Fighter" ? 10 : 5;
    if (s.trait === "Night owl") power += 5;
    return power;
  }
  // Calculates the total night defense value based on walls, guards, and ammo.
  //  Skills and traits are defined in common.js.
  function nightDefense() {
    var ammo = Math.min(state.resources.ammo, 10);
    if (onTask("Guard", "Sharpshooter")) ammo *= 2;
    var guardTotal = alive().reduce(function (sum, s) {
      return sum + guardPower(s);
    }, 0);
    return facility("walls").level * 10 + guardTotal + ammo;
  } // [WORK IN PROGRESS NEEDS TUNING]

  // Survivors on Build who are rested enough to work.
  function builders() {
    return alive().filter(function (s) {
      return s.task === "Build" && s.fatigue < TIRED;
    });
  }

  // Checks if a survivor is on a specific task with a specific skill.
  function onTask(task, skill) {
    return alive().some(function (s) {
      return s.task === task && s.skill === skill;
    });
  }
  // Calculates the cost of upgrading a facility, taking into account any discounts from survivors on the Build task with the Builder skill.
  function upgradeCost(f) {
    return Math.max(1, f.cost - (onTask("Build", "Builder") ? 2 : 0));
  }

  // Heals a survivor by a specified amount, ensuring health does not exceed 100 and updating status if health is above 60.
  function heal(s, amount) {
    s.health = Math.min(100, s.health + amount);
    if (s.health >= 60) s.status = "Healthy";
  }
  // Hurts a survivor. At 0 health they die, and everyone else loses morale.
  function hurt(s, amount, cat, why) {
    if (!s || !s.alive) return;
    if (s.trait === "Tough") amount = Math.ceil(amount / 2);
    s.health = Math.max(0, s.health - amount);
    if (s.health > 0) {
      if (s.health < 60) s.status = "Injured";
      addLog(cat, s.name + " " + why + " (-" + amount + " health).", "bad");
      return;
    }
    s.alive = false;
    s.lostOn = state.day;
    s.status = "Dead";
    addLog(cat, s.name + " " + why + " and did not survive.", "bad");
    alive().forEach(function (o) {
      changeMorale(o, -D.moraleLoss);
    });
  }

  // Changes morale. A survivor whose morale hits 0 walks out on the group.
  function changeMorale(s, amount) {
    if (!s.alive) return;
    s.morale = Math.max(0, Math.min(100, s.morale + amount));
    if (s.morale === 0) {
      s.alive = false;
      s.lostOn = state.day;
      s.status = "Left";
      addLog("base", s.name + " lost all hope and left the group.", "bad");
    }
  }

  // Changes fatigue, keeping it between 0 and 100.
  function tire(s, amount) {
    s.fatigue = Math.max(0, Math.min(100, s.fatigue + amount));
  }

  // Adds an entry to the game log with the current day, category, and text.
  // tone is optional: "good" or "bad" adds a coloured marker in the report pop-up.
  function addLog(cat, text, tone) {
    state.log.push({ day: state.day, cat: cat, text: text, tone: tone || "" });
  }
  // Checks if any survivor has a specific skill, returning true if at least one survivor possesses that skill.
  function hasSkill(skill) {
    return alive().some(function (s) {
      return s.skill === skill;
    });
  }

  // The least tired living survivor with a skill (or undefined if none can act).
  function skilled(skill) {
    return alive()
      .filter(function (s) {
        return s.skill === skill && s.fatigue < TIRED;
      })
      .sort(function (a, b) {
        return a.fatigue - b.fatigue;
      })[0];
  }

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

  /* 
=============================================================== 
---------- Plan checks ----------
=============================================================== 
These look at today's plan without changing anything. The Today panel,
the tab badges, the survivor cards and the End day check all use them,
so they always agree with each other.
*/
  var DANGER_LABELS = ["", "Low", "Medium", "High"];

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }
  function findLoc(id) {
    return LOCATIONS.find(function (l) {
      return l.id === id;
    });
  }
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
  function traderHere() {
    return state.trader.leaves > 0;
  }
  // Food the group eats at dusk (also used by the dusk itself).
  function foodNeeded() {
    var need = alive().reduce(function (sum, s) {
      return sum + (s.trait === "Big eater" ? 2 : 1);
    }, 0);
    if (onTask("Cook", "Cook")) need = Math.max(0, need - 1);
    return need;
  }
  // Who Heal would treat: the most hurt survivor, if anyone is hurt.
  function patient() {
    var p = alive()
      .slice()
      .sort(function (a, b) {
        return a.health - b.health;
      })[0];
    return p && p.health < 100 ? p : null;
  }

  // What a survivor's task will actually do today.
  // Returns { text, level, fix }:
  //   level is "" (fine), "info" (does nothing useful) or "bad" (needs fixing)
  //   fix is an optional link { label, goto (tab), who (survivor id) } to where it can be fixed
  function taskInfo(s) {
    var tired = s.fatigue >= TIRED;
    if (s.task === "Rest") {
      return {
        text:
          "Recovers fatigue and morale" +
          (s.trait === "Quick healer" && s.health < 100 ? ", +10 health" : "") +
          ".",
        level: "",
      };
    }
    if (s.task === "Scavenge") {
      if (tired) return { text: "Too tired to scavenge. Will stay home.", level: "bad" };
      if (!s.target) {
        return {
          text: "No destination picked.",
          level: "bad",
          fix: { label: "Choose destination", goto: "map", who: s.id },
        };
      }
      var loc = findLoc(s.target);
      return {
        text:
          "Heading to the " +
          loc.name +
          " (" +
          DANGER_LABELS[loc.danger].toLowerCase() +
          " danger).",
        level: "",
        fix: { label: "Change", goto: "map", who: s.id },
      };
    }
    if (s.task === "Build") {
      if (tired) return { text: "Too tired to build. Work won't move forward.", level: "bad" };
      var extra = s.skill === "Mechanic" ? " Also salvages 2 materials." : "";
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
              return f.name + " (" + plural(f.building, "day") + " left)";
            })
            .join(", ") +
          "." +
          extra,
        level: "",
      };
    }
    if (s.task === "Guard") {
      if (tired) return { text: "Too tired to guard. Adds no defense.", level: "bad" };
      if (s.trait === "Coward") return { text: "Cowards add no defense on Guard.", level: "info" };
      return {
        text:
          "+" +
          guardPower(s) +
          " defense tonight" +
          (s.skill === "Sharpshooter" ? ", and ammo counts double" : "") +
          ".",
        level: "",
      };
    }
    if (s.task === "Cook") {
      if (s.skill === "Cook") return { text: "The group eats 1 less food at dusk.", level: "" };
      return { text: "Only a Cook saves food. No effect.", level: "info" };
    }
    if (s.task === "Heal") {
      var p = patient();
      if (!p) return { text: "Everyone is at full health. No effect.", level: "info" };
      var meds = state.resources.medicine > 0;
      var amount = meds ? (s.skill === "Medic" ? 30 : 10) : s.skill === "Medic" ? 10 : 0;
      if (!amount) return { text: "No medicine left. No effect.", level: "info" };
      return {
        text:
          "Treats " +
          (p === s ? "themself" : p.name) +
          " (+" +
          amount +
          " health" +
          (meds ? ", uses 1 medicine" : "") +
          ").",
        level: "",
      };
    }
    return { text: "", level: "" };
  }

  // What dusk will do to food and water, before anything scavengers bring home.
  function duskForecast() {
    var food = {
      have: state.resources.food,
      made: facility("kitchen").level,
      need: foodNeeded(),
    };
    var water = {
      have: state.resources.water,
      made: facility("water").level * 2,
      need: alive().length,
    };
    [food, water].forEach(function (r) {
      r.after = r.have + r.made - r.need;
    });
    return { food: food, water: water };
  }

  // Night defense against tonight's horde. The real horde is up to 3 bigger or smaller.
  function tonightOdds() {
    var def = nightDefense(),
      threat = threatTonight();
    var level = def >= threat + 3 ? "good" : def >= threat - 3 ? "info" : "bad";
    return {
      def: def,
      threat: threat,
      level: level,
      label: {
        good: "Walls should hold",
        info: "Could go either way",
        bad: "Likely breach",
      }[level],
    };
  }

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
      ["Food", fc.food],
      ["Water", fc.water],
    ].forEach(function (pair) {
      if (pair[1].after < 0) {
        list.push({
          text: pair[0] + " will run short at dusk by " + -pair[1].after + ".",
          fix: traderHere()
            ? { label: "Trade", goto: "trade" }
            : { label: "Scavenge", goto: "map" },
        });
      }
    });
    var odds = tonightOdds();
    if (odds.level === "bad") {
      list.push({
        text:
          "Night defense " + odds.def + " is well below the horde (about " + odds.threat + ").",
        fix: { label: "Add guards", goto: "survivors" },
      });
    }
    return list;
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
  function warnItem(w) {
    return (
      '<li class="warn"><span>' + esc(w.text) + "</span>" + (w.fix ? fixLink(w.fix) : "") + "</li>"
    );
  }

  /* 
=============================================================== 
---------- Header ----------
=============================================================== 
*/
  // Display names for each phase. Their colours live in css/style.css (02. Phase themes).
  var PHASE_LABELS = { dawn: "Dawn", day: "Day", dusk: "Dusk", night: "Night" };

  function renderHeader() {
    var night = state.phase === "night";
    $("day-label").textContent =
      (night ? "Night " : "Day ") + pad(state.day) + " of " + state.length;
    var pill = $("phase-pill");
    pill.textContent = PHASE_LABELS[state.phase] + " phase";
    pill.dataset.phase = state.phase;
    // Re-colours the whole page for the current phase.
    document.documentElement.dataset.phase = state.phase;
    $("resources").innerHTML = RESOURCES.map(function (r) {
      return (
        '<li><img src="assets/icons/ingame/' +
        r.id +
        '.png" alt="" width="20" height="20">' +
        '<span class="res-label">' +
        r.label +
        "</span><strong>" +
        pad(state.resources[r.id]) +
        "</strong></li>"
      );
    }).join("");
    document.title = state.shelter + " · Day " + state.day + " — Another Tally";
  }

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
          s.task +
          '</span><span class="plan-detail">' +
          esc(info.text) +
          "</span></li>"
        );
      })
      .join("");

    // Food and water at dusk: have + made − eaten → left.
    var fc = duskForecast();
    function row(label, r) {
      return (
        "<dt>" +
        label +
        '</dt><dd class="' +
        (r.after < 0 ? "bad" : "") +
        '"><span class="calc">' +
        r.have +
        (r.made ? " + " + r.made : "") +
        " − " +
        r.need +
        "</span> → <strong>" +
        (r.after < 0 ? "short " + -r.after : pad(r.after)) +
        "</strong></dd>"
      );
    }
    $("dusk-forecast").innerHTML =
      '<dl class="forecast">' +
      row("Food", fc.food) +
      row("Water", fc.water) +
      "</dl>" +
      '<p class="small muted forecast-note">Have + made − eaten. Scavengers may bring more.</p>';

    // Defense against tonight's horde.
    var odds = tonightOdds();
    $("tonight").innerHTML =
      '<div class="odds"><span><strong>' +
      pad(odds.def) +
      "</strong> defense</span>" +
      '<span class="muted">vs</span><span><strong>~' +
      pad(odds.threat) +
      "</strong> horde</span></div>" +
      '<p class="odds-label ' +
      odds.level +
      '">' +
      odds.label +
      ' <span class="muted">· ' +
      plural(guards(), "guard") +
      "</span></p>";

    // Things to fix before ending the day.
    $("warnings").innerHTML = planWarnings().map(warnItem).join("");
  }

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
      ? esc(String(text)) + '<span class="visually-hidden"> ' + srText + "</span>"
      : "";
  }

  function renderBadges() {
    var needs = alive().filter(function (s) {
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
      lost === 1 ? "scavenger needs a destination" : "scavengers need a destination",
      "alert",
    );

    $("tab-trade").classList.toggle("quiet", !traderHere());
    setBadge(
      "trade",
      traderHere() ? state.trader.leaves + "d" : "",
      "trader leaves in " + plural(state.trader.leaves, "day"),
    );

    if ($("tab-log").getAttribute("aria-selected") === "true") {
      state.logSeen = state.log.length;
    }
    var unseen = state.log.length - state.logSeen;
    setBadge("log", unseen > 0 ? unseen : "", unseen === 1 ? "new entry" : "new entries");
  }

  /* 
=============================================================== 
---------- Base Tab ----------
=============================================================== 
*/
  function levelBar(level) {
    return (
      '<div class="level-bar" aria-hidden="true">' +
      [1, 2, 3]
        .map(function (n) {
          return '<span class="' + (n <= level ? "on" : "") + '"></span>';
        })
        .join("") +
      "</div>"
    );
  }

  function renderBase() {
    var p = $("panel-base");
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
      " · Horde tonight about " +
      pad(threatTonight()) +
      "</p></div>" +
      '<div class="grid-3">' +
      state.facilities
        .map(function (f) {
          var built = f.level > 0,
            maxed = f.level >= 3;
          var short = upgradeCost(f) - state.resources.materials;
          // A line under the button says why it can't be used, or what happens next.
          var note = "",
            noteTone = "";
          if (f.building) {
            if (builders().length) {
              note = plural(f.building, "more day") + " of work left.";
            } else {
              note = "Stalled. Put someone rested on Build.";
              noteTone = "bad";
            }
          } else if (!maxed && short > 0) {
            note = "Need " + short + " more materials.";
            noteTone = "bad";
          } else if (!maxed && !builders().length) {
            note = "You'll pick who builds it.";
          }
          var action = f.building
            ? "Building · " + f.building + " day" + (f.building > 1 ? "s" : "")
            : !built
              ? "Build"
              : maxed
                ? "Max level"
                : "Upgrade";
          return (
            '<article class="card facility">' +
            '<img class="fac-art" src="assets/images/png/' +
            f.img +
            '.png" alt="">' +
            '<div class="row"><h3>' +
            f.name +
            '</h3><span class="small muted">' +
            (built ? "Level " + f.level + " of 3" : "Not built") +
            "</span></div>" +
            levelBar(f.level) +
            "<p>" +
            f.desc +
            "</p>" +
            '<div class="foot"><span>Materials ' +
            pad(upgradeCost(f)) +
            " · " +
            f.days +
            " day" +
            (f.days > 1 ? "s" : "") +
            "</span>" +
            '<button class="btn btn-sm" type="button" data-upgrade="' +
            f.id +
            '"' +
            (maxed || f.building || short > 0 ? " disabled" : "") +
            ' aria-label="' +
            action +
            " " +
            f.name +
            '">' +
            action +
            "</button></div>" +
            (note ? '<p class="fac-note ' + noteTone + '">' + note + "</p>" : "") +
            "</article>"
          );
        })
        .join("") +
      "</div>";
  }

  // Upgrade buttons start work straight away if someone is on Build;
  // otherwise they open a picker to choose who builds it.
  $("panel-base").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-upgrade]");
    if (!btn) return;
    var f = facility(btn.dataset.upgrade);
    if (builders().length) startWork(f);
    else openBuildPicker(f);
  });

  // Materials are paid now; the work finishes after f.days days with someone on Build.
  function startWork(f) {
    var cost = upgradeCost(f);
    if (f.building || state.resources.materials < cost) return;
    state.resources.materials -= cost;
    f.building = f.days;
    addLog("base", "Work started on " + f.name + " (" + plural(f.days, "day") + ").");
    toast("Work started on " + f.name + ".");
    renderAll();
  }

  // ---------- Builder picker ----------
  var buildFor = null;
  function openBuildPicker(f) {
    buildFor = f;
    $("build-title").textContent = "Who works on the " + f.name + "?";
    $("build-text").textContent =
      "It takes " +
      plural(f.days, "day") +
      " with someone on Build each day. Whoever you pick switches to Build now.";
    $("build-choices").innerHTML = alive()
      .map(function (s) {
        var tired = s.fatigue >= TIRED;
        var now =
          s.task + (s.task === "Scavenge" && s.target ? " (" + findLoc(s.target).name + ")" : "");
        var perk =
          s.skill === "Builder"
            ? " · Builder: costs 2 fewer materials"
            : s.skill === "Mechanic"
              ? " · Mechanic: also salvages 2 materials"
              : "";
        return (
          '<button type="button" class="event-choice" data-builder="' +
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

  $("build-choices").addEventListener("click", function (e) {
    var b = e.target.closest("[data-builder]");
    if (!b || !buildFor) return;
    var s = findSurvivor(b.dataset.builder);
    s.task = "Build";
    s.target = null;
    $("build-dialog").close();
    startWork(buildFor);
    buildFor = null;
  });
  $("build-cancel").addEventListener("click", function () {
    buildFor = null;
    $("build-dialog").close();
  });

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
    Cook: "A Cook saves 1 food at dusk",
    Heal: "Treat the most hurt survivor",
  };

  function renderSurvivors() {
    var list = alive();
    var free = bedCount() - list.length;
    var p = $("panel-survivors");
    p.innerHTML =
      '<div class="panel-head"><h2>Survivors</h2><p class="muted">' +
      plural(list.length, "survivor") +
      " · " +
      plural(free, "free bed") +
      "</p></div>" +
      '<div class="grid-3">' +
      list
        .map(function (s) {
          var injured = s.status !== "Healthy";
          var tired = s.fatigue >= TIRED;
          var info = taskInfo(s);
          return (
            '<article class="card survivor">' +
            '<div class="top"><img class="avatar portrait" src="assets/images/png/survivor-' +
            s.avatar +
            '.png" alt="">' +
            "<div><h3>" +
            esc(s.name) +
            '</h3><div class="tags"><span class="chip" title="' +
            AT.SKILLS[s.skill] +
            '">' +
            s.skill +
            '</span><span class="chip" title="' +
            AT.TRAITS[s.trait] +
            '">' +
            s.trait +
            "</span></div></div>" +
            '<span class="status' +
            (injured || tired ? " injured" : "") +
            '">' +
            s.status +
            (tired ? "<br>Too tired" : "") +
            "</span></div>" +
            '<div class="stats">' +
            statRow("Health", s.health, "At 0 they die.") +
            statRow("Fed", 100 - s.hunger, "Drops when food runs short. Near empty, they starve.") +
            statRow(
              "Rested",
              100 - s.fatigue,
              "Drops with work. Below 20, they can't scavenge, guard or build.",
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
                '" aria-pressed="' +
                (t === s.task) +
                '" title="' +
                TASK_HINTS[t] +
                '">' +
                t +
                "</button>"
              );
            }).join("") +
            "</div>" +
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
          '<p class="small muted">Find survivors while exploring the map</p>' +
          '<button class="btn btn-sm" type="button" data-goto="map">Go to map</button></div>'
        : "") +
      "</div>";
  }

  $("panel-survivors").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-set-task]");
    if (!btn) return;
    var s = findSurvivor(btn.dataset.who);
    s.task = btn.dataset.setTask;
    if (s.task !== "Scavenge") s.target = null;
    renderAll();
    var again = $("panel-survivors").querySelector(
      '[data-who="' + s.id + '"][data-set-task="' + s.task + '"]',
    );
    if (again) again.focus();
  });

  /* 
=============================================================== 
---------- Map Tab ----------
=============================================================== 
*/
  // The survivor preselected in the Send list: whoever a "Choose destination"
  // link picked, else a scavenger with nowhere to go, else the first one rested.
  function defaultSender() {
    var rested = alive().filter(function (s) {
      return s.fatigue < TIRED;
    });
    var picked = rested.find(function (s) {
      return s.id === state.sendWho;
    });
    return (
      picked ||
      rested.find(function (s) {
        return s.task === "Scavenge" && !s.target;
      }) ||
      rested[0]
    );
  }

  function renderMap() {
    var loc = findLoc(state.selectedLocation);
    var visits = state.explored.filter(function (id) {
      return id === loc.id;
    }).length;
    var explored = LOCATIONS.filter(function (l) {
      return state.explored.indexOf(l.id) !== -1;
    }).length;
    var going = headingTo(loc.id);
    var sender = defaultSender();
    var risk = Math.round(Math.min(1, D.scavRisk * loc.danger) * 100);
    var p = $("panel-map");
    p.innerHTML =
      '<div class="panel-head"><h2>Map</h2><p class="muted">Explored ' +
      explored +
      " of " +
      LOCATIONS.length +
      " locations</p></div>" +
      '<div class="map-wrap"><div class="map-col">' +
      '<div class="map-area" role="group" aria-label="Map of locations">' +
      '<span class="loc home" style="left:' +
      SHELTER_POS.x +
      "%;top:" +
      SHELTER_POS.y +
      '%">' +
      esc(state.shelter) +
      "</span>" +
      LOCATIONS.map(function (l) {
        var seen = state.explored.indexOf(l.id) !== -1;
        var who = headingTo(l.id);
        // Screen readers get the same facts the markers show.
        var sr =
          (seen ? ", explored" : ", not explored yet") +
          (l.locked ? ", locked" : "") +
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
          (l.locked ? " locked" : "") +
          (seen ? "" : " unseen") +
          '" data-loc="' +
          l.id +
          '" style="left:' +
          l.x +
          "%;top:" +
          l.y +
          '%"' +
          ' aria-pressed="' +
          (l.id === loc.id) +
          '">' +
          (l.locked ? '<span aria-hidden="true">🔒</span> ' : "") +
          l.name +
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
      }).join("") +
      "</div>" +
      '<p class="map-legend small muted"><span><span class="seen">✓</span> Explored</span>' +
      '<span><span class="legend-unseen">Faded</span> Not explored yet</span>' +
      "<span>🔒 Locked</span>" +
      '<span><span class="pin-who">E</span> Survivor heading there</span></p>' +
      "</div>" +
      '<div class="card loc-detail" aria-live="polite">' +
      '<p class="eyebrow">Selected location</p><h3>' +
      loc.name +
      "</h3>" +
      '<img class="loc-art" src="assets/images/png/' +
      (loc.img || loc.id) +
      '.png" alt="">' +
      '<dl><dt>Danger</dt><dd><span class="danger-label">' +
      DANGER_LABELS[loc.danger] +
      '</span> <span class="danger" aria-hidden="true">' +
      [1, 2, 3]
        .map(function (n) {
          return '<span class="' + (n <= loc.danger ? "on" : "") + '"></span>';
        })
        .join("") +
      "</span></dd>" +
      "<dt>Injury risk</dt><dd>" +
      risk +
      "%</dd>" +
      "<dt>Travel</dt><dd>" +
      plural(loc.travel, "day") +
      ' <span class="muted">(+' +
      20 * loc.travel +
      " fatigue)</span></dd>" +
      "<dt>Likely finds</dt><dd>" +
      loc.finds +
      "</dd>" +
      "<dt>Visits</dt><dd>" +
      visits +
      (visits ? ' <span class="muted">(less left each time)</span>' : "") +
      "</dd>" +
      "<dt>Heading here</dt><dd>" +
      (going.length
        ? going
            .map(function (s) {
              return esc(s.name);
            })
            .join(", ")
        : '<span class="muted">No one</span>') +
      "</dd></dl>" +
      (loc.locked
        ? '<p class="small muted">Locked. Find a way through the checkpoint first.</p>' // TODO: unlock condition
        : '<label class="small" for="send-who">Send</label>' +
          '<select id="send-who">' +
          alive()
            .map(function (s) {
              var tired = s.fatigue >= TIRED;
              // Only mention what matters here: too tired, or already going somewhere.
              var now = tired
                ? " (too tired)"
                : s.task === "Scavenge" && s.target
                  ? " (→ " + findLoc(s.target).name + ")"
                  : "";
              return (
                '<option value="' +
                s.id +
                '"' +
                (sender && s.id === sender.id ? " selected" : "") +
                (tired ? " disabled" : "") +
                ">" +
                esc(s.name) +
                " · " +
                s.skill +
                now +
                "</option>"
              );
            })
            .join("") +
          "</select>" +
          '<button class="btn btn-primary btn-block" type="button" id="send-btn" style="margin-top:.75rem"' +
          (sender ? "" : " disabled") +
          ">Send here to scavenge</button>" +
          '<p class="small muted" style="margin-top:.5rem">' +
          (sender
            ? "They switch to Scavenge. May trigger an event or a mini-game."
            : "Everyone is too tired. Let someone rest first.") +
          "</p>") +
      "</div></div>";
  }

  $("panel-map").addEventListener("click", function (e) {
    var locBtn = e.target.closest("[data-loc]");
    if (locBtn) {
      state.selectedLocation = locBtn.dataset.loc;
      // Keep whoever is picked in the Send list when switching locations.
      if ($("send-who")) state.sendWho = $("send-who").value;
      renderMap();
      var again = $("panel-map").querySelector(
        '[data-loc="' + state.selectedLocation + '"]',
      );
      if (again) again.focus();
      return;
    }
    if (e.target.id === "send-btn") {
      var s = findSurvivor($("send-who").value);
      var loc = findLoc(state.selectedLocation);
      s.task = "Scavenge";
      s.target = loc.id;
      state.sendWho = null;
      toast(s.name + " will scavenge the " + loc.name + " today.");
      renderAll();
      $("send-btn").focus();
    }
  });

  /* 
=============================================================== 
---------- Trade Tab ----------
=============================================================== 
*/
  function tradeValue(side) {
    return RESOURCES.reduce(function (sum, r) {
      return sum + (state.trade[side][r.id] || 0) * TRADE_VALUE[r.id];
    }, 0);
  }

  // Share of the trader's value you must offer. A Negotiator in the group lowers it.
  function tradeNeed() {
    return hasSkill("Negotiator") ? 0.75 : 1;
  }

  function renderTrade() {
    // No trader around: say so instead of showing an empty trade screen.
    if (!traderHere()) {
      $("panel-trade").innerHTML =
        '<div class="panel-head"><h2>Trade</h2></div>' +
        '<div class="card trade-empty"><h3>No trader nearby</h3><p class="muted">' +
        esc(state.trader.name) +
        " has moved on. There is no one to trade with right now.</p></div>";
      return;
    }
    var give = tradeValue("give"),
      get = tradeValue("get");
    var need = Math.ceil(get * tradeNeed());
    var share = give + get === 0 ? 0 : Math.round((give / (give + get)) * 100);

    // Plain-language status of the offer.
    var msg,
      ok = false;
    if (!get) {
      msg = "Pick what you want from her side.";
    } else if (give < need) {
      msg = "She wants " + (need - give) + " more value. Add more to your side.";
    } else {
      ok = true;
      msg =
        "She'll accept this trade." +
        (give > need ? " You're offering " + (give - need) + " more value than she needs." : "");
    }
    if (hasSkill("Negotiator")) msg += " Your negotiator gets you a better deal.";

    function column(side, title, haveLabel) {
      return (
        '<div class="card"><h3 class="eyebrow">' +
        title +
        "</h3>" +
        '<div class="trade-row trade-head small muted"><span>Item</span><span>' +
        haveLabel +
        "</span><span></span><span>Pick</span><span></span></div>" +
        RESOURCES.map(function (r) {
          var n = state.trade[side][r.id] || 0;
          var have = side === "give" ? state.resources[r.id] : state.trader.stock[r.id];
          return (
            '<div class="trade-row"><span class="res-name"><img src="assets/icons/ingame/' +
            r.id +
            '.png" alt="" width="20" height="20">' +
            r.label +
            '<span class="worth">worth ' +
            TRADE_VALUE[r.id] +
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
            (n >= have ? " disabled" : "") +
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
    $("panel-trade").innerHTML =
      '<div class="panel-head"><h2>Trade</h2></div>' +
      '<div class="card trader"><img class="avatar portrait" src="assets/images/png/trader.png" alt=""><div><h3>' +
      state.trader.name +
      "</h3>" +
      '<p class="small muted">Wandering trader · leaves in ' +
      plural(state.trader.leaves, "day") +
      "</p></div></div>" +
      '<div class="trade-cols">' +
      column("give", "You give · from your stores", "You have") +
      column("get", "You get · from her stock", "She has") +
      "</div>" +
      '<div class="card trade-bar"><div>' +
      '<div class="labels"><span>Your offer · value ' +
      pad(give) +
      "</span><span>Her offer · value " +
      pad(get) +
      "</span></div>" +
      '<div class="balance" style="--accept:' +
      Math.round((tradeNeed() / (1 + tradeNeed())) * 100) +
      '%" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      share +
      '" aria-label="Your share of the trade"><span style="width:' +
      share +
      '%"></span></div>' +
      '<p class="trade-msg ' +
      (ok ? "good" : get ? "bad" : "") +
      '" aria-live="polite">' +
      msg +
      "</p></div>" +
      '<div class="choices"><button class="btn btn-quiet" type="button" id="trade-clear">Clear</button>' +
      '<button class="btn btn-primary" type="button" id="trade-propose"' +
      (ok ? "" : " disabled") +
      ">Propose trade</button></div></div>";
  }
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
      if (give < get * tradeNeed()) {
        toast(state.trader.name + " shakes her head. Offer more.");
        return;
      }
      RESOURCES.forEach(function (r) {
        var gave = state.trade.give[r.id] || 0,
          got = state.trade.get[r.id] || 0;
        state.resources[r.id] += got - gave;
        state.trader.stock[r.id] += gave - got;
      });
      addLog(
        "trade",
        "Traded with " +
          state.trader.name +
          " (gave value " +
          give +
          ", got value " +
          get +
          ").",
      );
      toast("Trade accepted.");
      state.trade = { give: {}, get: {} };
      renderAll();
    }
  });

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
              var open = d.day in state.logOpen ? state.logOpen[d.day] : i === 0;
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

  $("panel-log").addEventListener("click", function (e) {
    // Remember which days the player opens or closes. (The click lands
    // before the day folds, so the new state is the opposite of now.)
    var sum = e.target.closest("summary");
    if (sum) {
      var d = sum.parentElement;
      state.logOpen[d.dataset.day] = !d.open;
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

  /* 
=============================================================== 
---------- Tabs (ARIA tabs pattern: click, or Left/Right/Home/End) ----------
=============================================================== 
*/
  var tabs = Array.prototype.slice.call(
    document.querySelectorAll('[role="tab"]'),
  );

  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (tab.id === "tab-log") state.logSeen = state.log.length;
    renderBadges();
    if (focus) tab.focus();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () {
      selectTab(tab);
    });
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
    if (go.dataset.who) {
      state.sendWho = go.dataset.who;
      renderMap();
    }
    var dlg = go.closest("dialog");
    if (dlg) dlg.close();
    selectTab($("tab-" + go.dataset.goto), true);
  });

  /* 
---------- End day → dusk → night event → (mini-game) → dawn ----------
*/
  // End day checks the plan first. If anything won't work, it lists the
  // problems and lets the player go back or end the day anyway.
  $("end-day").addEventListener("click", function () {
    var problems = planWarnings();
    if (!problems.length) {
      endDay();
      return;
    }
    $("confirm-list").innerHTML = problems.map(warnItem).join("");
    $("confirm-dialog").showModal();
    $("confirm-back").focus();
  });
  $("confirm-back").addEventListener("click", function () {
    $("confirm-dialog").close();
  });
  $("confirm-end").addEventListener("click", function () {
    $("confirm-dialog").close();
    endDay();
  });

  function endDay() {
    // Everything logged from here on goes into the Dusk report pop-up.
    var duskMark = state.log.length;
    // This is dusk where the results come in.
    // Skill and trait effects are listed in common.js.
    var scavenged = false;
    var scavengers = alive().filter(function (s) {
      return s.task === "Scavenge" && s.target;
    });
    scavengers.forEach(function (s) {
      var loc = LOCATIONS.find(function (l) {
        return l.id === s.target;
      });
      if (s.fatigue >= TIRED) {
        addLog("exploring", s.name + " was too tired to scavenge and stayed home.");
        return;
      }
      scavenged = true;
      // Riskier places hold more, but every trip wears survivors out.
      var found = randInt(1, 4) + (loc.danger - 1);
      if (s.trait === "Lucky") found = Math.max(found, randInt(1, 4) + (loc.danger - 1));
      if (s.skill === "Scavenger") found += 2;
      if (s.trait === "Loner" && scavengers.length === 1) found += 1;
      if (s.trait === "Clumsy") found = Math.max(0, found - 1);
      found = Math.round(found * D.yield);
      // Each visit to the same place leaves less behind (down to half).
      var visits = state.explored.filter(function (id) {
        return id === loc.id;
      }).length;
      found = Math.round(found * Math.max(0.5, 1 - visits * 0.1));
      var haul = {};
      for (var i = 0; i < found; i++) {
        var kind = loc.loot[Math.floor(rng() * loc.loot.length)];
        haul[kind] = (haul[kind] || 0) + 1;
      }
      if (s.skill === "Hunter") haul.food = (haul.food || 0) + 2;
      if (s.trait === "Hoarder") haul.materials = (haul.materials || 0) + 1;
      var total = 0;
      Object.keys(haul).forEach(function (k) {
        state.resources[k] += haul[k];
        total += haul[k];
      });
      state.suppliesGathered += total;
      state.explored.push(loc.id);
      addLog(
        "exploring",
        s.name +
          " scavenged the " +
          loc.name +
          (total ? " and brought back " + AT.minigames.describe(haul) + "." : " but found nothing."),
      );
      tire(s, 20 * loc.travel);
      if (rng() < D.scavRisk * loc.danger) {
        hurt(s, 10 * loc.danger, "exploring", "was attacked at the " + loc.name);
      }
    });

    // Facilities that produce something every day.
    var waterMade = facility("water").level * 2;
    var foodMade = facility("kitchen").level;
    state.resources.water += waterMade;
    state.resources.food += foodMade;
    if (waterMade || foodMade) {
      addLog(
        "base",
        "The base produced " +
          [waterMade ? waterMade + " water" : "", foodMade ? foodMade + " food" : ""]
            .filter(Boolean)
            .join(" and ") +
          ".",
      );
    }

    // Construction moves forward one day if someone rested is on Build.
    var working = builders().length > 0;
    state.facilities.forEach(function (f) {
      if (!f.building) return;
      if (!working) {
        addLog("base", "No one worked on " + f.name + " today.");
        return;
      }
      f.building -= 1;
      if (f.building === 0) {
        f.building = null;
        f.level += 1;
        f.cost += 3;
        addLog(
          "base",
          f.name + (f.level === 1 ? " built." : " upgraded to level " + f.level + "."),
          "good",
        );
      }
    });

    alive().forEach(function (s) {
      if (s.task === "Build" && s.skill === "Mechanic" && s.fatigue < TIRED) {
        state.resources.materials += 2;
        addLog("base", s.name + " salvaged 2 materials.");
      }
      if (s.task === "Rest" && s.trait === "Quick healer" && s.health < 100) {
        heal(s, 10);
        addLog("base", s.name + " rested and recovered 10 health.");
      }
      if (s.task === "Heal") {
        var patient = alive()
          .slice()
          .sort(function (a, b) {
            return a.health - b.health;
          })[0];
        if (patient.health >= 100) return;
        // Treatment uses 1 medicine. Without it, only a Medic can do anything.
        var amount;
        if (state.resources.medicine > 0) {
          state.resources.medicine -= 1;
          amount = s.skill === "Medic" ? 30 : 10;
        } else {
          amount = s.skill === "Medic" ? 10 : 0;
        }
        if (amount) {
          heal(patient, amount);
          addLog("base", s.name + " treated " + patient.name + " (+" + amount + " health).");
        } else {
          addLog("base", s.name + " had no medicine to treat " + patient.name + ".");
        }
      }
      // Rest lowers fatigue; every other task raises it (scavenging was counted above).
      if (s.task === "Rest") {
        tire(s, -35);
        changeMorale(s, 5);
      } else if (s.task !== "Scavenge") {
        tire(s, 10);
      }
    });

    var needFood = foodNeeded();
    var eaten = Math.min(state.resources.food, needFood);
    var drunk = Math.min(state.resources.water, alive().length);
    state.resources.food -= eaten;
    state.resources.water -= drunk;
    addLog(
      "base",
      "The group ate " + eaten + " food and drank " + drunk + " water at dusk.",
    );

    // Going short on food builds hunger; going short on water hurts right away.
    var shortFood = needFood - eaten;
    var shortWater = alive().length - drunk;
    if (shortFood > 0) addLog("base", "There was not enough food for everyone.", "bad");
    if (shortWater > 0) addLog("base", "There was not enough water for everyone.", "bad");
    alive().forEach(function (s) {
      s.hunger = Math.max(0, Math.min(100, s.hunger + (shortFood > 0 ? 25 : -15)));
      if (shortFood > 0) changeMorale(s, -5);
      if (shortWater > 0) hurt(s, D.starveDmg, "base", "is dehydrated");
      if (s.alive && s.hunger >= 80) hurt(s, D.starveDmg, "base", "is starving");
    });

    // Switch to Dusk and show what happened today. Continue moves on to the night.
    state.phase = "dusk";
    renderAll();
    var duskEntries = state.log.slice(duskMark);
    if (!alive().length) {
      showReport({
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
    var pool = EVENTS.filter(function (ev) {
      return !ev.needsScavenging || scavenged;
    });
    showReport({
      kicker: "Dusk · Day " + pad(state.day),
      title: "Dusk report",
      entries: duskEntries,
      button: "Continue to night",
      next: function () {
        state.phase = "night";
        renderAll();
        openEvent(pool[Math.floor(rng() * pool.length)]);
      },
    });
  }

  // ---------- Report pop-up ----------
  // Shows a list of log entries and waits for Continue before running opts.next.
  // opts = { kicker, title, entries, art (optional image name), button, next }
  var reportNext = null;
  function showReport(opts) {
    $("report-kicker").textContent = opts.kicker;
    $("report-title").textContent = opts.title;
    var art = $("report-art");
    art.hidden = !opts.art;
    if (opts.art) art.src = "assets/images/png/" + opts.art + ".png";
    $("report-list").innerHTML = opts.entries.length
      ? opts.entries
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
          .join("")
      : '<li><span class="muted">Nothing happened.</span></li>';
    $("report-continue").textContent = opts.button || "Continue";
    reportNext = opts.next;
    $("report-dialog").showModal();
    $("report-continue").focus();
  }

  $("report-continue").addEventListener("click", function () {
    var next = reportNext;
    reportNext = null;
    $("report-dialog").close();
    if (next) next();
  });

  // ---------- Event overlay ----------
  // Everything logged from the night event on goes into the Dawn report pop-up.
  var nightMark = 0;
  function openEvent(ev) {
    nightMark = state.log.length;
    state.currentEvent = ev;
    state.eventsFaced += 1;
    $("event-kicker").textContent = "Night " + pad(state.day) + " · Event";
    $("event-title").textContent = ev.title;
    // Event pictures live in assets/images/png/; events without `art` use the generic one.
    $("event-art").src =
      "assets/images/png/" + (ev.art || "event_generic") + ".png";
    $("event-text").textContent = ev.text;
    $("event-choices").innerHTML = ev.choices
      .map(function (c, i) {
        var note,
          ok = true;
        var cost = c.cost || {};
        var costParts = Object.keys(cost).map(function (k) {
          return cost[k] + " " + k;
        });
        var affordable = Object.keys(cost).every(function (k) {
          return state.resources[k] >= cost[k];
        });
        if (c.kind === "skill") {
          note = "Requires: " + c.skill;
          if (costParts.length) note += " · Costs: " + costParts.join(", ");
          if (c.fatigue) note += " · Tiring";
          if (c.injure) note += " · Risky";
          ok = !!skilled(c.skill) && affordable;
        } else if (c.kind === "minigame") {
          note = "Starts a mini-game";
        } else {
          note = costParts.length ? "Costs: " + costParts.join(", ") : "No cost";
          if (c.morale) note += " · Hurts morale";
          ok = affordable;
        }
        return (
          '<button class="event-choice" type="button" data-choice="' +
          i +
          '"' +
          (ok ? "" : " disabled") +
          ">" +
          "<strong>" +
          c.label +
          "</strong><span>" +
          note +
          (ok ? "" : " — not available") +
          "</span></button>"
        );
      })
      .join("");
    $("event-dialog").showModal();
  }

  $("event-choices").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-choice]");
    if (!btn) return;
    var ev = state.currentEvent;
    var c = ev.choices[Number(btn.dataset.choice)];
    $("event-dialog").close();
    if (c.kind === "minigame") {
      if (AT.load().minigames === "auto") autoResolve(c.game);
      else openMinigame(c.game);
      return;
    }
    Object.keys(c.cost || {}).forEach(function (k) {
      state.resources[k] -= c.cost[k];
    });
    addLog("event", ev.title + ": " + c.outcome);
    var who = c.kind === "skill" ? skilled(c.skill) : null;
    if (who && c.fatigue) tire(who, c.fatigue);
    if (who && c.injure) hurt(who, c.injure, "event", "was hurt");
    if (c.morale) {
      alive().forEach(function (s) {
        changeMorale(s, c.morale);
      });
      addLog("event", "Morale dropped (" + c.morale + ").");
    }
    finishNight();
  });

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
    $("mg-title").textContent = name;
    $("mg-instructions").textContent = MINIGAMES[name];
    $("minigame-dialog").dataset.game = name;
    $("mg-start").textContent = "Start";
    $("mg-start").disabled = false;
    $("mg-auto").disabled = false;
    mg = { name: name, phase: "ready", result: null };
    mg.game = AT.minigames.create(name, {
      arena: $("mg-canvas"),
      rng: rng,
      difficulty: state.difficulty,
      wallLevel: facility("walls").level,
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

  $("mg-start").addEventListener("click", function () {
    if (!mg) return;
    if (mg.phase === "ready") {
      mg.phase = "playing";
      $("mg-start").disabled = true;
      $("mg-auto").disabled = true;
      mg.game.start();
    } else if (mg.phase === "done") {
      var r = mg.result;
      mg = null;
      resolveMinigame(
        $("minigame-dialog").dataset.game,
        r.won,
        false,
        r.reward,
      );
    }
  });
  $("mg-auto").addEventListener("click", function () {
    if (!mg || mg.phase !== "ready") return;
    mg.game.stop();
    mg = null;
    autoResolve($("minigame-dialog").dataset.game);
  });

  // Auto-resolve a mini-game with a D.autoWin chance of winning (depends on difficulty), and a reward based on the game.
  function autoResolve(name) {
    var r = AT.minigames.autoResult(name, rng() < D.autoWin, rng);
    resolveMinigame(name, r.won, true, r.reward);
  }

  // Close the mini-game overlay, log the result, apply any reward, and finish the night.
  function resolveMinigame(name, won, auto, reward) {
    if ($("minigame-dialog").open) $("minigame-dialog").close();
    var how = auto ? " (auto-resolved)" : "";
    var cat =
      name === "Defense" ? "night" : name === "Search" ? "exploring" : "event";
    var from = state.currentEvent ? state.currentEvent.title + ": " : "";
    addLog(cat, from + name + " mini-game " + (won ? "won" : "lost") + how + ".", won ? "good" : "bad");
    reward = reward || {};
    var gained = 0;
    Object.keys(reward).forEach(function (k) {
      state.resources[k] += reward[k];
      gained += reward[k];
    });
    if (gained) {
      state.suppliesGathered += gained;
      addLog(cat, "Brought back " + AT.minigames.describe(reward) + ".", "good");
    }
    if (!won) {
      // A loss injures one survivor (Cowards are spared if anyone else is around).
      // Tough survivors take half damage inside hurt().
      var pool = alive().filter(function (s) {
        return s.trait !== "Coward";
      });
      if (!pool.length) pool = alive();
      var victim = pool[Math.floor(rng() * pool.length)];
      hurt(victim, 30, cat, "was injured");
    }
    finishNight();
  }

  // The horde grows over the run. It starts at threatBase and reaches
  // threatBase + threatPeak on the last night, whatever the run length.
  function threatTonight() {
    return Math.round(D.threatBase + D.threatPeak * (state.day / state.length));
  }

  // Every night the horde tests your defense. Guards use up ammo, and a breach
  // injures survivors and can knock the walls down a level.
  function nightRaid() {
    if (!alive().length) return;
    var threat = threatTonight() + randInt(-3, 3);
    var def = nightDefense();
    var shots = Math.min(state.resources.ammo, guards());
    state.resources.ammo -= shots;
    alive().forEach(function (s) {
      if (s.task === "Guard") tire(s, 15);
    });
    if (def >= threat) {
      addLog("night", "The horde hit the walls and broke (defense " + def + " vs " + threat + ").", "good");
      return;
    }
    var breach = threat - def;
    addLog("night", "The horde broke through (defense " + def + " vs " + threat + ").", "bad");
    // Bigger breaches catch more people.
    var hits = breach >= 15 ? 2 : 1;
    for (var i = 0; i < hits && alive().length; i++) {
      var list = alive();
      var v = list[Math.floor(rng() * list.length)];
      hurt(v, Math.min(50, 5 + breach * 2), "night", "was caught in the breach");
    }
    var walls = facility("walls");
    if (breach >= 15 && walls.level > 1) {
      walls.level -= 1;
      addLog("night", "The walls were damaged and dropped to level " + walls.level + ".", "bad");
    }
  }

  // Runs after the night event (and any mini-game) is resolved: the horde
  // attacks, then the Dawn report shows the whole night before the new day.
  function finishNight() {
    state.currentEvent = null;
    nightRaid();
    var kicker = "Night " + pad(state.day) + " · Results";

    if (!alive().length) {
      renderAll();
      showReport({
        kicker: kicker,
        title: "No one survived the night",
        art: "end_lose",
        entries: state.log.slice(nightMark),
        button: "See how it ended",
        next: function () {
          endRun(false);
        },
      });
      return;
    }
    if (state.day >= state.length) {
      addLog("base", "The group survived the last night.", "good");
      renderAll();
      showReport({
        kicker: kicker,
        title: "You made it",
        art: "end_win",
        entries: state.log.slice(nightMark),
        button: "See how it ended",
        next: function () {
          endRun(true);
        },
      });
      return;
    }

    state.day += 1;
    state.phase = "dawn";
    if (state.trader.leaves === 1) {
      addLog("trade", state.trader.name + " packed up and moved on.");
      state.trade = { give: {}, get: {} };
    }
    state.trader.leaves = Math.max(0, state.trader.leaves - 1);
    // [WORK IN PROGRESS] implement trader behavior
    alive().forEach(function (s) {
      if (s.trait === "Optimist" && s.health < 100) {
        heal(s, 5);
        addLog("base", s.name + " woke up hopeful (+5 health).", "good");
      }
    });
    addLog(
      "base",
      alive().length +
        " survivor" +
        (alive().length === 1 ? "" : "s") +
        " made it through the night.",
    );
    renderAll();
    showReport({
      kicker: "Dawn · Day " + pad(state.day),
      title: "Dawn report",
      entries: state.log.slice(nightMark),
      button: "Start day " + state.day,
      next: function () {
        state.phase = "day";
        renderAll();
      },
    });
  }

  // ---------- Leaving the page ----------
  function endRun(won) {
    var group = state.survivors.map(function (s) {
      return {
        name: s.name,
        avatar: s.avatar,
        fate: s.alive ? "Alive" : "Lost on day " + pad(s.lostOn),
      };
    });
    AT.handoff.setResult({
      won: won,
      shelter: state.shelter,
      length: state.length,
      daysSurvived: won ? state.length : state.day - 1,
      alive: alive().length,
      lost: state.survivors.length - alive().length,
      supplies: state.suppliesGathered,
      explored: LOCATIONS.filter(function (l) {
        return state.explored.indexOf(l.id) !== -1;
      }).length,
      locations: LOCATIONS.length,
      events: state.eventsFaced,
      group: group,
    });
    leaving = true;
    location.href = "end.html";
  }

  // Warn before a refresh, close or back button throws the run away.
  window.addEventListener("beforeunload", function (e) {
    if (leaving) return;
    e.preventDefault();
    e.returnValue = "";
  });

  // ---------- Pause menu ----------
  var pauseDialog = $("pause-dialog");
  function anyDialogOpen() {
    return document.querySelector("dialog[open]") !== null;
  }

  $("pause-btn").addEventListener("click", function () {
    pauseDialog.showModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !anyDialogOpen()) {
      e.preventDefault();
      pauseDialog.showModal();
    }
  });
  $("resume").addEventListener("click", function () {
    pauseDialog.close();
  });
  pauseDialog.addEventListener("click", function (e) {
    var open = e.target.closest("[data-open]");
    if (open) window.open(open.dataset.open + "?from=game", "_blank");
  });
  $("quit").addEventListener("click", function () {
    leaving = true;
    location.href = "index.html";
  });

  // Events, mini-games and reports must be answered; Esc does not dismiss them.
  ["event-dialog", "minigame-dialog", "report-dialog"].forEach(function (id) {
    $(id).addEventListener("cancel", function (e) {
      e.preventDefault();
    });
  });

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

  addLog("base", "The group settled into " + state.shelter + ".");
  state.logSeen = state.log.length; // the opening line doesn't count as news
  renderAll();
})();

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
    trader: { name: "Old Marguerite", leaves: 2 },
    log: [],
    logFilter: "all",
    eventsFaced: 0,
    suppliesGathered: 0,
    currentEvent: null,
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
      addLog(cat, s.name + " " + why + " (-" + amount + " health).");
      return;
    }
    s.alive = false;
    s.lostOn = state.day;
    s.status = "Dead";
    addLog(cat, s.name + " " + why + " and did not survive.");
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
      addLog("base", s.name + " lost all hope and left the group.");
    }
  }

  // Changes fatigue, keeping it between 0 and 100.
  function tire(s, amount) {
    s.fatigue = Math.max(0, Math.min(100, s.fatigue + amount));
  }

  // Adds an entry to the game log with the current day, category, and text.
  function addLog(cat, text) {
    state.log.push({ day: state.day, cat: cat, text: text });
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
---------- Header ----------
=============================================================== 
*/
  // Display names for each phase. Their colours live in css/style.css (02. Phase themes).
  var PHASE_LABELS = { dawn: "Dawn", day: "Day", dusk: "Dusk", night: "Night" };
  // How long the short Dusk and Dawn phases stay on screen (ms).
  var DUSK_MS = 1500;
  var DAWN_MS = 3500;

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
    $("today-list").innerHTML = alive()
      .map(function (s) {
        return "<dt>" + esc(s.name) + "</dt><dd>" + s.task + "</dd>";
      })
      .join("");
    $("guards").textContent = guards();
    $("defense").textContent = pad(nightDefense());
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
            (maxed || f.building ? " disabled" : "") +
            ' aria-label="' +
            action +
            " " +
            f.name +
            '">' +
            action +
            "</button></div>" +
            "</article>"
          );
        })
        .join("") +
      "</div>";
  }

  $("panel-base").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-upgrade]");
    if (!btn) return;
    var f = facility(btn.dataset.upgrade);
    var cost = upgradeCost(f);
    if (state.resources.materials < cost) {
      toast("Not enough materials for " + f.name + ".");
      return;
    }
    if (f.building) {
      toast(f.name + " is already being worked on.");
      return;
    }
    if (!builders().length) {
      toast("Put a rested survivor on Build first.");
      return;
    }
    // Materials are paid now; the work finishes after f.days days with someone on Build.
    state.resources.materials -= cost;
    f.building = f.days;
    addLog("base", "Work started on " + f.name + " (" + f.days + " day" + (f.days > 1 ? "s" : "") + ").");
    toast("Work started on " + f.name + ".");
    renderAll();
  });

  /* 
=============================================================== 
---------- Survivors Tab ----------
=============================================================== 
*/
  function statRow(label, value) {
    return (
      "<span>" +
      label +
      '</span><span class="meter" aria-hidden="true"><span style="width:' +
      value +
      '%"></span></span>' +
      '<output aria-label="' +
      label +
      '">' +
      pad(value) +
      "</output>"
    );
  }

  function renderSurvivors() {
    var list = alive();
    var free = bedCount() - list.length;
    var p = $("panel-survivors");
    p.innerHTML =
      '<div class="panel-head"><h2>Survivors</h2><p class="muted">' +
      list.length +
      " survivor" +
      (list.length === 1 ? "" : "s") +
      " · " +
      free +
      " free bed" +
      (free === 1 ? "" : "s") +
      "</p></div>" +
      '<div class="grid-3">' +
      list
        .map(function (s) {
          var injured = s.status !== "Healthy";
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
            (injured ? " injured" : "") +
            '">' +
            s.status +
            "</span></div>" +
            '<div class="stats">' +
            statRow("Health", s.health) +
            statRow("Hunger", s.hunger) +
            statRow("Fatigue", s.fatigue) +
            statRow("Morale", s.morale) +
            "</div>" +
            '<label class="small" for="task-' +
            s.id +
            '">Task today</label>' +
            '<select id="task-' +
            s.id +
            '" data-task="' +
            s.id +
            '">' +
            TASKS.map(function (t) {
              return (
                "<option" +
                (t === s.task ? " selected" : "") +
                ">" +
                t +
                "</option>"
              );
            }).join("") +
            "</select></article>"
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

  $("panel-survivors").addEventListener("change", function (e) {
    var sel = e.target.closest("[data-task]");
    if (!sel) return;
    var s = state.survivors.find(function (x) {
      return x.id === sel.dataset.task;
    });
    s.task = sel.value;
    if (s.task !== "Scavenge") s.target = null;
    renderSide();
    renderBase();
  });

  /* 
=============================================================== 
---------- Map Tab ----------
=============================================================== 
*/
  function renderMap() {
    var loc = LOCATIONS.find(function (l) {
      return l.id === state.selectedLocation;
    });
    var visits = state.explored.filter(function (id) {
      return id === loc.id;
    }).length;
    var explored = LOCATIONS.filter(function (l) {
      return state.explored.indexOf(l.id) !== -1;
    }).length;
    var p = $("panel-map");
    p.innerHTML =
      '<div class="panel-head"><h2>Map</h2><p class="muted">Explored ' +
      explored +
      " of " +
      LOCATIONS.length +
      " locations</p></div>" +
      '<div class="map-wrap">' +
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
        return (
          '<button type="button" class="loc' +
          (l.locked ? " locked" : "") +
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
          l.name +
          (seen ? ' <span class="seen" aria-label="explored">✓</span>' : "") +
          "</button>"
        );
      }).join("") +
      "</div>" +
      '<div class="card loc-detail" aria-live="polite">' +
      '<p class="eyebrow">Selected location</p><h3>' +
      loc.name +
      "</h3>" +
      '<img class="loc-art" src="assets/images/png/' +
      (loc.img || loc.id) +
      '.png" alt="">' +
      '<dl><dt>Danger</dt><dd><span class="danger" role="img" aria-label="' +
      loc.danger +
      ' of 3">' +
      [1, 2, 3]
        .map(function (n) {
          return '<span class="' + (n <= loc.danger ? "on" : "") + '"></span>';
        })
        .join("") +
      "</span></dd>" +
      "<dt>Travel</dt><dd>" +
      loc.travel +
      " day" +
      (loc.travel > 1 ? "s" : "") +
      "</dd>" +
      "<dt>Likely finds</dt><dd>" +
      loc.finds +
      "</dd>" +
      "<dt>Visits</dt><dd>" +
      visits +
      "</dd></dl>" +
      (loc.locked
        ? '<p class="small muted">Locked. Find a way through the checkpoint first.</p>' // TODO: unlock condition
        : '<label class="small" for="send-who">Send</label>' +
          '<select id="send-who">' +
          alive()
            .map(function (s) {
              return (
                '<option value="' +
                s.id +
                '">' +
                esc(s.name) +
                " · " +
                s.skill +
                "</option>"
              );
            })
            .join("") +
          "</select>" +
          '<button class="btn btn-primary btn-block" type="button" id="send-btn" style="margin-top:.75rem">Send to scavenge</button>' +
          '<p class="small muted" style="margin-top:.5rem">May trigger an event or a mini-game.</p>') +
      "</div></div>";
  }

  $("panel-map").addEventListener("click", function (e) {
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
    if (e.target.id === "send-btn") {
      var s = state.survivors.find(function (x) {
        return x.id === $("send-who").value;
      });
      var loc = LOCATIONS.find(function (l) {
        return l.id === state.selectedLocation;
      });
      s.task = "Scavenge";
      s.target = loc.id;
      toast(s.name + " will scavenge the " + loc.name + " today.");
      renderSide();
      renderSurvivors();
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
    var give = tradeValue("give"),
      get = tradeValue("get");
    var share = give + get === 0 ? 0 : Math.round((give / (give + get)) * 100);
    function column(side, title) {
      return (
        '<div class="card"><h3 class="eyebrow">' +
        title +
        "</h3>" +
        RESOURCES.map(function (r) {
          var n = state.trade[side][r.id] || 0;
          var max = side === "give" ? state.resources[r.id] : 20;
          return (
            '<div class="trade-row"><span class="res-name"><img src="assets/icons/ingame/' +
            r.id +
            '.png" alt="" width="20" height="20">' +
            r.label +
            '</span><span class="have">' +
            pad(state.resources[r.id]) +
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
            (n >= max ? " disabled" : "") +
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
      state.trader.leaves +
      " day" +
      (state.trader.leaves === 1 ? "" : "s") +
      "</p></div></div>" +
      '<div class="trade-cols">' +
      column("give", "You give") +
      column("get", "You get") +
      "</div>" +
      '<div class="card trade-bar"><div>' +
      '<div class="labels"><span>Your offer · value ' +
      pad(give) +
      "</span><span>Their offer · value " +
      pad(get) +
      "</span></div>" +
      '<div class="balance" style="--accept:' +
      Math.round((tradeNeed() / (1 + tradeNeed())) * 100) +
      '%" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      share +
      '" aria-label="Your share of the trade"><span style="width:' +
      share +
      '%"></span></div>' +
      '<p class="small muted">The trader accepts when your side reaches the red line.' +
      (hasSkill("Negotiator")
        ? " Your negotiator gets you a better deal."
        : "") +
      "</p></div>" +
      '<div class="choices"><button class="btn btn-quiet" type="button" id="trade-clear">Clear</button>' +
      '<button class="btn btn-primary" type="button" id="trade-propose">Propose trade</button></div></div>';
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
        state.resources[r.id] +=
          (state.trade.get[r.id] || 0) - (state.trade.give[r.id] || 0);
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
    $("panel-log").innerHTML =
      '<div class="panel-head"><h2>Log</h2></div>' +
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
            .map(function (d) {
              return (
                '<section class="log-day"><h3 class="eyebrow">Day ' +
                pad(d.day) +
                "</h3><ol>" +
                d.items
                  .map(function (l) {
                    return (
                      '<li><span class="chip">' +
                      LOG_LABELS[l.cat] +
                      "</span><span>" +
                      esc(l.text) +
                      "</span></li>"
                    );
                  })
                  .join("") +
                "</ol></section>"
              );
            })
            .join(""));
  }

  $("panel-log").addEventListener("click", function (e) {
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

  document.addEventListener("click", function (e) {
    var go = e.target.closest("[data-goto]");
    if (go) selectTab($("tab-" + go.dataset.goto), true);
  });

  /* 
---------- End day → dusk → night event → (mini-game) → dawn ----------
*/
  $("end-day").addEventListener("click", function () {
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

    var needFood = alive().reduce(function (sum, s) {
      return sum + (s.trait === "Big eater" ? 2 : 1);
    }, 0);
    if (onTask("Cook", "Cook")) needFood = Math.max(0, needFood - 1);
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
    if (shortFood > 0) addLog("base", "There was not enough food for everyone.");
    if (shortWater > 0) addLog("base", "There was not enough water for everyone.");
    alive().forEach(function (s) {
      s.hunger = Math.max(0, Math.min(100, s.hunger + (shortFood > 0 ? 25 : -15)));
      if (shortFood > 0) changeMorale(s, -5);
      if (shortWater > 0) hurt(s, D.starveDmg, "base", "is dehydrated");
      if (s.alive && s.hunger >= 80) hurt(s, D.starveDmg, "base", "is starving");
    });

    if (!alive().length) {
      endRun(false);
      return;
    }

    // Show Dusk briefly, then fall into Night and open the night event.
    state.phase = "dusk";
    $("end-day").disabled = true;
    renderAll();
    var pool = EVENTS.filter(function (ev) {
      return !ev.needsScavenging || scavenged;
    });
    setTimeout(function () {
      state.phase = "night";
      $("end-day").disabled = false;
      renderAll();
      openEvent(pool[Math.floor(rng() * pool.length)]);
    }, DUSK_MS);
  });

  // ---------- Event overlay ----------
  function openEvent(ev) {
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
    addLog(cat, name + " mini-game " + (won ? "won" : "lost") + how + ".");
    reward = reward || {};
    var gained = 0;
    Object.keys(reward).forEach(function (k) {
      state.resources[k] += reward[k];
      gained += reward[k];
    });
    if (gained) {
      state.suppliesGathered += gained;
      addLog(cat, "Brought back " + AT.minigames.describe(reward) + ".");
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
    toast(name + " " + (won ? "won" : "lost") + how + ".");
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
      addLog("night", "The horde hit the walls and broke (defense " + def + " vs " + threat + ").");
      return;
    }
    var breach = threat - def;
    addLog("night", "The horde broke through (defense " + def + " vs " + threat + ").");
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
      addLog("night", "The walls were damaged and dropped to level " + walls.level + ".");
    }
  }

  function finishNight() {
    state.currentEvent = null;
    nightRaid();
    if (!alive().length) {
      endRun(false);
      return;
    }
    if (state.day >= state.length) {
      endRun(true);
      return;
    }
    state.day += 1;
    // The new day opens on Dawn (the dawn report), then settles into Day.
    state.phase = "dawn";
    setTimeout(function () {
      if (state.phase !== "dawn") return; // the player already ended the day
      state.phase = "day";
      renderHeader();
    }, DAWN_MS);
    state.trader.leaves = Math.max(0, state.trader.leaves - 1);
    // [WORK IN PROGRESS] implement trader behavior
    alive().forEach(function (s) {
      if (s.trait === "Optimist" && s.health < 100) heal(s, 5);
    });
    addLog(
      "base",
      "Dawn report: " +
        alive().length +
        " survivor" +
        (alive().length === 1 ? "" : "s") +
        " made it through the night.",
    );
    toast("Day " + state.day + " begins.");
    renderAll();
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

  // Events and mini-games must be answered; Esc does not dismiss them.
  ["event-dialog", "minigame-dialog"].forEach(function (id) {
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
  renderAll();
})();

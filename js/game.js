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
    },
    {
      id: "hospital",
      name: "Hospital",
      x: 42,
      y: 8,
      danger: 2,
      travel: 1,
      finds: "Medicine, food",
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
    },
    {
      id: "farm",
      name: "Farm",
      x: 11,
      y: 38,
      danger: 1,
      travel: 2,
      finds: "Food, water",
    },
    {
      id: "supermarket",
      name: "Supermarket",
      x: 69,
      y: 55,
      danger: 2,
      travel: 1,
      finds: "Food, water",
    },
    {
      id: "suburb",
      name: "Suburb",
      x: 10,
      y: 72,
      danger: 1,
      travel: 1,
      finds: "Materials, food",
    },
    {
      id: "school",
      name: "School",
      x: 38,
      y: 68,
      danger: 1,
      travel: 1,
      finds: "Materials",
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
      locked: true,
    },
  ];
  var SHELTER_POS = { x: 41, y: 45 };

  /* 
---------- Events [WORK IN PROGRESS NEEDS TUNING] ----------
*/
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
          outcome:
            "You checked the stranger for bites and let them sleep in the yard.",
        },
        { label: "Clear the street first", kind: "minigame", game: "Defense" },
        {
          label: "Pay them to move on",
          kind: "cost",
          cost: { food: 2 },
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
          outcome: "The crate gave way. (Loot is a placeholder.)",
        },
        { label: "Pick the lock", kind: "minigame", game: "Lockpick" },
        {
          label: "Leave it",
          kind: "cost",
          cost: {},
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
    if (s.task !== "Guard" || s.trait === "Coward") return 0;
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
      "</p></div>" +
      '<div class="grid-3">' +
      state.facilities
        .map(function (f) {
          var built = f.level > 0,
            maxed = f.level >= 3;
          var action = !built ? "Build" : maxed ? "Max level" : "Upgrade";
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
            (maxed ? " disabled" : "") +
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
    // [WORK IN PROGRESS] the upgrades should take f.days days and need a survivor on Build.
    // For now they finish at once.
    state.resources.materials -= cost;
    f.level += 1;
    f.cost += 3;
    addLog(
      "base",
      f.name +
        (f.level === 1 ? " built." : " upgraded to level " + f.level + "."),
    );
    toast(f.name + (f.level === 1 ? " built." : " upgraded."));
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
      scavenged = true;
      var loc = LOCATIONS.find(function (l) {
        return l.id === s.target;
      });
      var found = randInt(1, 4);
      if (s.trait === "Lucky") found = Math.max(found, randInt(1, 4));
      if (s.skill === "Scavenger") found += 2;
      if (s.trait === "Loner" && scavengers.length === 1) found += 1;
      if (s.trait === "Clumsy") found = Math.max(0, found - 1);
      var extraFood = s.skill === "Hunter" ? 2 : 0;
      var extraMaterials = s.trait === "Hoarder" ? 1 : 0;
      state.resources.food += found + extraFood;
      state.resources.materials += extraMaterials;
      state.suppliesGathered += found + extraFood + extraMaterials;
      state.explored.push(loc.id);
      addLog(
        "exploring",
        s.name +
          " scavenged the " +
          loc.name +
          " and brought back " +
          (found + extraFood) +
          " food" +
          (extraMaterials ? " and " + extraMaterials + " material" : "") +
          ".",
      );
    });

    alive().forEach(function (s) {
      if (s.task === "Build" && s.skill === "Mechanic") {
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
        var amount = s.skill === "Medic" ? 30 : 10;
        if (patient.health < 100) {
          heal(patient, amount);
          addLog(
            "base",
            s.name + " treated " + patient.name + " (+" + amount + " health).",
          );
        }
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
        if (c.kind === "skill") {
          note = "Requires: " + c.skill;
          ok = hasSkill(c.skill);
        } else if (c.kind === "minigame") {
          note = "Starts a mini-game";
        } else {
          var parts = Object.keys(c.cost).map(function (k) {
            return c.cost[k] + " " + k;
          });
          note = parts.length ? "Costs: " + parts.join(", ") : "No cost";
          ok = Object.keys(c.cost).every(function (k) {
            return state.resources[k] >= c.cost[k];
          });
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
    if (c.kind === "cost")
      Object.keys(c.cost).forEach(function (k) {
        state.resources[k] -= c.cost[k];
      });
    addLog("event", ev.title + ": " + c.outcome);
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

  // Auto-resolve a mini-game with a 60% chance of winning, and a reward based on the game.
  function autoResolve(name) {
    var r = AT.minigames.autoResult(name, rng() < 0.6, rng);
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
      // [WORK IN PROGRESS] this section needs real consequences.
      // For now a loss injures one survivor.
      var pool = alive().filter(function (s) {
        return s.trait !== "Coward";
      });
      if (!pool.length) pool = alive();
      var victim = pool[Math.floor(rng() * pool.length)];
      if (victim) {
        var damage = victim.trait === "Tough" ? 15 : 30;
        victim.health = Math.max(5, victim.health - damage);
        victim.status = "Injured";
        addLog(cat, victim.name + " was injured (-" + damage + " health).");
      }
    }
    toast(name + " " + (won ? "won" : "lost") + how + ".");
    finishNight();
  }

  function finishNight() {
    state.currentEvent = null;
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
    addLog("base", "Dawn report: the group made it through the night.");
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

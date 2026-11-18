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
  Dawn  - sometimes a morning event, then the next day starts.

How this file is laid out:
  1. Static game data (resources, difficulty, facilities, map, events, sounds)
  2. Run state
  3. Helpers (survivors, facilities, recruiting, plan checks)
  4. Rendering for the header, side panel and each tab
  5. End day, reports, events, mini-games and the night raid
  6. Leaving the page, pause menu and start-up

Lines marked [TUNE THESE] or [WORK IN PROGRESS NEEDS TUNING] are balance
numbers to adjust after playtesting.
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
    // Materials are higher than you might expect because nothing is built at the start.
    easy: { food: 15, water: 15, materials: 22, medicine: 4, ammo: 8 },
    normal: { food: 10, water: 10, materials: 16, medicine: 2, ammo: 5 },
    hard: { food: 8, water: 8, materials: 13, medicine: 1, ammo: 3 },
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
    easy: {
      yield: 0.95,
      threatBase: 9,
      threatPeak: 18,
      starveDmg: 10,
      scavRisk: 0.1,
      autoWin: 0.7,
      moraleLoss: 10,
      tradeMarkup: 1.0,
      traderGap: [2, 3],
    },
    normal: {
      yield: 0.85,
      threatBase: 8,
      threatPeak: 22,
      starveDmg: 15,
      scavRisk: 0.15,
      autoWin: 0.55,
      moraleLoss: 15,
      tradeMarkup: 1.15,
      traderGap: [3, 4],
    },
    hard: {
      yield: 0.8,
      threatBase: 7,
      threatPeak: 23,
      starveDmg: 20,
      scavRisk: 0.2,
      autoWin: 0.4,
      moraleLoss: 20,
      tradeMarkup: 1.3,
      traderGap: [4, 6],
    },
  };
  // tradeMarkup: how much more value traders ask for than they give (1.15 = 15% extra)
  // traderGap:   [min, max] days with no trader between visits
  var D = DIFFICULTY[setup.difficulty] || DIFFICULTY.normal;
  // Fatigue at or above this keeps a survivor from scavenging or guarding.
  var TIRED = 80;

  // Defines trade values for each resource
  var TRADE_VALUE = { food: 2, water: 2, materials: 1, medicine: 4, ammo: 3 };

  // Wandering traders. One visits at a time and the next one is never the same person.
  // stock:  what they arrive with (each amount varies by -1 to +1)
  // wants:  what they pay extra for (WANT_BONUS x value). They never sell what they want.
  // stays:  [min, max] days they stay
  var TRADERS = [
    {
      id: "marguerite",
      name: "Old Marguerite",
      title: "General goods",
      stock: { food: 5, water: 5, materials: 6, medicine: 2, ammo: 0 },
      wants: ["ammo"],
      stays: [2, 3],
      greet: "helloWoman", // said when you first visit the Trade tab each day
    },
    {
      id: "rook",
      name: "Rook",
      title: "Gun runner",
      stock: { food: 0, water: 0, materials: 4, medicine: 1, ammo: 8 },
      wants: ["food", "water"],
      stays: [2, 2],
    },
    {
      id: "ines",
      name: "Doc Ines",
      title: "Field medic",
      stock: { food: 2, water: 4, materials: 0, medicine: 6, ammo: 0 },
      wants: ["materials"],
      stays: [2, 3],
      greet: "helloWoman",
    },
    {
      id: "abe",
      name: "Abe Tanner",
      title: "Farmer",
      stock: { food: 9, water: 7, materials: 2, medicine: 0, ammo: 0 },
      wants: ["ammo", "medicine"],
      stays: [2, 3],
    },
  ];
  var WANT_BONUS = 1.5;
  // Defines tasks that survivors can be assigned to each day
  var TASKS = ["Rest", "Scavenge", "Build", "Guard", "Cook", "Heal"];

  /* 
---------- Facilities [TUNE THESE] ----------
Every facility starts unbuilt and has 3 tiers. Each tier has a name, a short
line saying what it gives, its cost in materials and how many days of work it
takes. "none" says what the base does without it. The numbers each tier uses
are in the FX table below so the rules and the descriptions stay together.
*/
  var FACILITIES = [
    {
      id: "beds",
      sound: "cardboardBox", // plays over the hammering when work starts
      img: "bedroom",
      name: "Beds",
      desc: "Better sleep: Rest recovers more, and more beds for newcomers",
      none: "Bedrolls on the floor. Rest recovers 25 fatigue. Sleeps 3.",
      tiers: [
        {
          name: "Salvaged Cots",
          effect: "Rest recovers 35 fatigue. Sleeps 5.",
          cost: 3,
          days: 1,
        },
        {
          name: "Bunk Room",
          effect: "Rest recovers 45 fatigue. Sleeps 7.",
          cost: 5,
          days: 1,
        },
        {
          name: "Barracks",
          effect: "Rest recovers 55 fatigue and +10 morale. Sleeps 9.",
          cost: 8,
          days: 2,
        },
      ],
    },
    {
      id: "kitchen",
      sound: "shovel", // plays over the hammering when work starts
      img: "kitchen",
      name: "Kitchen and garden",
      desc: "Grows and cooks food every day",
      none: "No kitchen. The base makes no food.",
      tiers: [
        { name: "Camp Kitchen", effect: "+2 food a day.", cost: 4, days: 1 },
        { name: "Kitchen Garden", effect: "+4 food a day.", cost: 6, days: 1 },
        {
          name: "Greenhouse and Smokehouse",
          effect: "+6 food a day.",
          cost: 9,
          days: 2,
        },
      ],
    },
    {
      id: "water",
      sound: "rustyMetal", // plays over the hammering when work starts
      img: "watercollector",
      name: "Water collector",
      desc: "Collects rainwater every day",
      none: "No collector. The base gathers no water.",
      tiers: [
        {
          name: "Basic Rain Catcher",
          effect: "+2 water a day.",
          cost: 4,
          days: 1,
        },
        {
          name: "Rooftop Collection System",
          effect: "+4 water a day.",
          cost: 6,
          days: 2,
        },
        {
          name: "Advanced Water Harvesting Network",
          effect: "+6 water a day.",
          cost: 9,
          days: 2,
        },
      ],
    },
    {
      id: "workshop",
      sound: "woodCutting", // plays over the hammering when work starts
      img: "workshop",
      name: "Workshop",
      desc: "Makes every other build cheaper and faster",
      none: "No workshop. Builds cost full price.",
      tiers: [
        {
          name: "Tool Bench",
          effect: "Builds cost 1 less material.",
          cost: 3,
          days: 1,
        },
        {
          name: "Repair Shop",
          effect: "Builds cost 2 less. Mechanics salvage +1 more.",
          cost: 6,
          days: 1,
        },
        {
          name: "Fabrication Shop",
          effect: "Builds cost 3 less and take 1 day less.",
          cost: 9,
          days: 2,
        },
      ],
    },
    {
      id: "infirmary",
      sound: "cabinet", // plays over the hammering when work starts
      img: "infirmary",
      name: "Infirmary",
      desc: "Heals survivors who rest, and helps whoever is on Heal",
      none: "No infirmary. Only the Heal task treats injuries.",
      tiers: [
        {
          name: "First Aid Station",
          effect: "Resting survivors heal +10 health at dusk.",
          cost: 4,
          days: 1,
        },
        {
          name: "Sick Bay",
          effect: "Resting survivors heal +20. Heal treats +10 more.",
          cost: 7,
          days: 2,
        },
        {
          name: "Field Hospital",
          effect: "Resting survivors heal +30. Heal treats two people.",
          cost: 10,
          days: 2,
        },
      ],
    },
    {
      id: "walls",
      sound: "woodSplitting", // plays over the hammering when work starts
      img: "watchtower",
      name: "Walls and watchtower",
      desc: "Raises night defense",
      none: "No walls. Only guards and ammo hold the horde back.",
      tiers: [
        {
          name: "Scrap Barricades",
          effect: "+10 night defense.",
          cost: 4,
          days: 1,
        },
        {
          name: "Palisade and Lookout",
          effect: "+20 night defense. Shows the exact horde size.",
          cost: 7,
          days: 2,
        },
        {
          name: "Fortified Wall and Watchtower",
          effect: "+30 night defense. Each guard adds +3 more.",
          cost: 10,
          days: 2,
        },
      ],
    },
  ];

  // What each facility gives at levels 0 (not built) to 3. [TUNE THESE]
  // Keep these in step with the "effect" lines above.
  var FX = {
    beds: {
      sleeps: [3, 5, 7, 9],
      rest: [25, 35, 45, 55],
      restMorale: [5, 5, 5, 10],
    },
    kitchen: { food: [0, 2, 4, 6] },
    water: { water: [0, 2, 4, 6] },
    workshop: {
      discount: [0, 1, 2, 3],
      fasterBy: [0, 0, 0, 1],
      salvage: [0, 0, 1, 1],
    },
    infirmary: {
      restHeal: [0, 10, 20, 30],
      healBonus: [0, 0, 10, 10],
      patients: [1, 1, 1, 2],
    },
    walls: {
      defense: [0, 10, 20, 30],
      exactHorde: [false, false, true, true],
      guardBonus: [0, 0, 0, 3],
    },
  };

  /* 
---------- Map Locations and there button x/y coordinates [WORK IN PROGRESS NEEDS TUNING] ----------
*/
  var LOCATIONS = [
    {
      id: "gas",
      people: 0.08, // chance a scavenger meets someone who wants to join
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
      people: 0.15, // chance a scavenger meets someone who wants to join
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
      people: 0.1, // chance a scavenger meets someone who wants to join
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
      people: 0.25, // chance a scavenger meets someone who wants to join
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
      people: 0.12, // chance a scavenger meets someone who wants to join
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
      people: 0.2, // chance a scavenger meets someone who wants to join
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
      people: 0.2, // chance a scavenger meets someone who wants to join
      name: "School",
      x: 38,
      y: 68,
      danger: 1,
      travel: 1,
      finds: "Materials",
      loot: ["materials"],
    },
    {
      id: "military",
      people: 0.15, // chance a scavenger meets someone who wants to join
      img: "military_checkpoint",
      name: "Military checkpoint",
      x: 58,
      y: 86,
      danger: 3,
      travel: 2,
      finds: "Ammo, medicine",
      loot: ["ammo", "medicine"],
      locked: true, // starts locked: cut the fence (Map) or find a keycard (event)
    },
  ];
  var SHELTER_POS = { x: 41, y: 45 };

  /* 
---------- Events [WORK IN PROGRESS NEEDS TUNING] ----------
One event happens every night, and some mornings (MORNING_EVENT_CHANCE).

Each event has:
  title, text     what the player reads
  art             a picture name from assets/images/png/
  time            "night" (default) or "morning"
  sounds          played stacked when the event opens (names are in common.js;
                  [name, ms] starts that one a little later)
  needsScavenging only offered after someone came home from scavenging tonight
  needsFreeBed    only offered when there is a free bed (events that bring someone in)
  needsLocked     only offered while that map location is still locked
  from            for events that bring someone in: where they came from
  choices         the options, usually three

Each choice has a kind:
  "skill"    needs a rested survivor with that skill
  "minigame" plays a mini-game (game: "Defense", "Lockpick" or "Search")
  "cost"     anyone can pick it, if the group can pay the cost

and any of these (all optional):
  cost     resources paid, e.g. { food: 3 }; the choice is greyed out if you can't pay
  lose     resources taken, as much as you have (never greyed out)
  fatigue  added to the survivor with the skill
  injure   health the survivor with the skill loses
  hurtOne  health one random survivor at the shelter loses (Cowards are spared)
  morale   added to everyone (can be negative)
  reward   a name from REWARDS below: supplies the choice brings in
  recruit  true: a newcomer joins if there is a free bed
  unlock   a location id to unlock on the map
  win      for minigame choices: { recruit, unlock, reward } applied only on a win
  outcome  the line written to the log
  sounds   played stacked when the choice is picked
*/
  var EVENTS = [
    // ---------- Night events ----------
    {
      title: "Knocking at the gate",
      art: "event_gate",
      text: "Someone is pounding on the gate, begging to be let in. Behind them, shapes shuffle out of the dark.",
      from: "at the gate", // finishes "X joined the group ..." for recruits
      sounds: ["knockSoft", ["knockHard", 1500], ["zombieGroan", 2600]],
      choices: [
        {
          label: "Talk them through it",
          kind: "skill",
          skill: "Medic",
          cost: { medicine: 1 },
          recruit: true,
          outcome: "Your medic checked the stranger for bites and opened the gate.",
          sounds: ["doorOpen", ["pillCap", 600], ["closeJar", 1400]],
        },
        {
          label: "Clear the street first",
          kind: "minigame",
          game: "Defense",
          win: { recruit: true },
        },
        {
          label: "Pay them to move on",
          kind: "cost",
          cost: { food: 3 },
          outcome: "You passed food through the gate. They left.",
          sounds: ["canJiggle", ["footsteps", 600]],
        },
      ],
    },
    {
      title: "A locked supply crate",
      art: "event_crate",
      text: "A survivor found a padlocked crate in the alley behind the shelter.",
      sounds: ["rustyMetal"],
      choices: [
        {
          label: "Pry it open",
          kind: "skill",
          skill: "Builder",
          fatigue: 20,
          reward: "crate",
          outcome: "Your builder forced the lid off the crate.",
          sounds: ["woodSplitting", ["rustyHinges", 500], ["cardboardBox", 1100]],
        },
        { label: "Pick the lock", kind: "minigame", game: "Lockpick" },
        {
          label: "Leave it",
          kind: "cost",
          cost: {},
          morale: -5,
          outcome: "You left the crate where it was.",
          sounds: ["footsteps"],
        },
      ],
    },
    {
      title: "Raid on the walls",
      art: "event_raid",
      text: "A crowd of the dead presses against the north wall. It will not hold for long.",
      sounds: ["hordeClose", ["zombieAttack", 800], ["knockHard", 1200]],
      choices: [
        {
          label: "Hold the line",
          kind: "skill",
          skill: "Fighter",
          fatigue: 30,
          injure: 10,
          outcome: "Your fighter held the wall until dawn.",
          sounds: ["swing", ["swing", 450], ["swing", 900], ["zombieDying", 1100]],
        },
        { label: "Defend the wall", kind: "minigame", game: "Defense" },
        {
          label: "Fire into the crowd",
          kind: "cost",
          cost: { ammo: 3 },
          outcome: "The shots scattered the crowd.",
          sounds: [
            "gunshot",
            ["gunshot", 350],
            ["gunshot", 700],
            ["zombieDying", 1100],
          ],
        },
      ],
    },
    {
      title: "A house worth searching",
      art: "event_house",
      text: "On the way back, your scavenger spotted a house with the door hanging open. The dead can't be far.",
      needsScavenging: true,
      sounds: ["rustyDoor", ["glassSteps", 900]],
      choices: [
        { label: "Search it room by room", kind: "minigame", game: "Search" },
        {
          label: "Let the expert pick the spots",
          kind: "skill",
          skill: "Scavenger",
          fatigue: 20,
          reward: "pantry",
          outcome:
            "Your scavenger went straight for the pantry and slipped out quietly.",
          sounds: ["carefulWalking", ["drawer", 700], ["searchDesk", 1400]],
        },
        {
          label: "Head home before dark",
          kind: "cost",
          cost: {},
          outcome: "You left the house alone.",
          sounds: ["footsteps", ["doorClose", 1200]],
        },
      ],
    },
    {
      title: "A voice on the radio",
      art: "school",
      text: "The old radio crackles to life. Someone is hiding in the school gym, out of food, asking if anyone can hear them.",
      from: "from the school gym",
      needsFreeBed: true,
      sounds: ["lightSwitch", ["zombieGroan", 1400]],
      choices: [
        {
          label: "Send your fighter",
          kind: "skill",
          skill: "Fighter",
          fatigue: 30,
          injure: 10,
          recruit: true,
          outcome: "Your fighter cut a path to the school and brought them back.",
          sounds: ["doorOpen", ["swing", 700], ["swing", 1100], ["doorClose", 2000]],
        },
        {
          label: "Cover them as they run",
          kind: "minigame",
          game: "Defense",
          win: { recruit: true },
        },
        {
          label: "Turn the radio off",
          kind: "cost",
          cost: {},
          morale: -5,
          outcome: "You turned the radio off. Nobody slept well.",
          sounds: ["lightSwitch"],
        },
      ],
    },
    {
      title: "A fallen soldier",
      art: "military_checkpoint",
      text: "Near the checkpoint, your scavenger found a soldier slumped against the fence. A keycard hangs from his belt.",
      needsScavenging: true,
      needsLocked: "military",
      sounds: ["glassSteps", ["rustyMetal", 900]],
      choices: [
        {
          label: "Let the expert check him",
          kind: "skill",
          skill: "Scavenger",
          fatigue: 10,
          reward: "soldier",
          unlock: "military",
          outcome: "Your scavenger took the keycard and everything useful on him.",
          sounds: ["carefulWalking", ["pillCap", 700], ["reload", 1200]],
        },
        {
          label: "Grab the keycard and run",
          kind: "cost",
          cost: {},
          hurtOne: 10,
          unlock: "military",
          outcome: "You snatched the keycard as the dead closed in.",
          sounds: ["footsteps", ["zombieShout", 500], ["doorClose", 1400]],
        },
        {
          label: "Leave him be",
          kind: "cost",
          cost: {},
          outcome: "You left the soldier where he fell.",
          sounds: ["footsteps"],
        },
      ],
    },
    {
      title: "Rats in the stores",
      art: "kitchen",
      text: "Something has been chewing through the food sacks. Droppings everywhere.",
      sounds: ["rubbish", ["cardboardBox", 700]],
      choices: [
        {
          label: "Hunt them down",
          kind: "skill",
          skill: "Hunter",
          fatigue: 10,
          reward: "rats",
          outcome: "Your hunter cleared the rats out. Not much meat, but it's food.",
          sounds: ["swing", ["swing", 400], ["stove", 1200]],
        },
        {
          label: "Set traps",
          kind: "cost",
          cost: { materials: 2 },
          outcome: "You built traps from scrap. The food is safe.",
          sounds: ["buildingHammering"],
        },
        {
          label: "Let it be",
          kind: "cost",
          cost: {},
          lose: { food: 3 },
          outcome: "The rats got into the food.",
          sounds: ["rubbish"],
        },
      ],
    },
    {
      title: "A storm rolls in",
      art: "watercollector",
      text: "Rain hammers the roof and water drips through a dozen cracks. The walls are slick, and the dead are quiet for once.",
      sounds: ["pourWater", ["rustyMetal", 800]],
      choices: [
        {
          label: "Patch the roof",
          kind: "skill",
          skill: "Builder",
          fatigue: 20,
          cost: { materials: 1 },
          reward: "rain",
          morale: 5,
          outcome: "Your builder patched the roof and rigged it to catch the rain.",
          sounds: ["buildingHammering", ["pourWater", 900]],
        },
        {
          label: "Put out every pot and pan",
          kind: "cost",
          cost: {},
          reward: "rain",
          morale: -5,
          outcome: "You caught the rain, but everyone slept cold and wet.",
          sounds: ["pourWater", ["canDrop", 500]],
        },
        {
          label: "Sit it out",
          kind: "cost",
          cost: {},
          outcome: "You waited out the storm.",
          sounds: [],
        },
      ],
    },
    {
      title: "Fever in the shelter",
      art: "infirmary",
      text: "One of the group is burning up with fever and can barely stand.",
      sounds: ["footsteps", ["openJar", 900]],
      choices: [
        {
          label: "Have the medic treat them",
          kind: "skill",
          skill: "Medic",
          cost: { medicine: 1 },
          outcome: "Your medic brought the fever down by morning.",
          sounds: ["pillCap", ["pourWater", 600]],
        },
        {
          label: "Use the medicine",
          kind: "cost",
          cost: { medicine: 2 },
          outcome: "Two doses of medicine broke the fever.",
          sounds: ["pillCap", ["closeJar", 700]],
        },
        {
          label: "Let them sweat it out",
          kind: "cost",
          cost: {},
          hurtOne: 20,
          outcome: "You kept them warm and hoped for the best.",
          sounds: ["lightSwitch"],
        },
      ],
    },
    {
      title: "Raiders at the gate",
      art: "event_gate",
      text: "Three armed strangers stand at the gate. They want food and water, or they'll come in and take it.",
      sounds: ["knockHard", ["cock", 900]],
      choices: [
        {
          label: "Talk them down",
          kind: "skill",
          skill: "Negotiator",
          reward: "raiders",
          outcome:
            "Your negotiator talked them into a truce. They even left some ammo.",
          sounds: ["doorOpen", ["cardboardBox", 900], ["doorClose", 1800]],
        },
        { label: "Drive them off", kind: "minigame", game: "Defense" },
        {
          label: "Hand over supplies",
          kind: "cost",
          cost: { food: 2, water: 2 },
          outcome: "You handed over food and water. They left you alone.",
          sounds: ["cardboardBox", ["doorClose", 900]],
        },
      ],
    },
    {
      title: "An old guitar",
      art: "bedroom",
      text: "Someone found a battered guitar in the rubble. It's out of tune, but it still plays.",
      sounds: ["cardboardBox"],
      choices: [
        {
          label: "Play quietly by the fire",
          kind: "cost",
          cost: {},
          morale: 10,
          outcome: "For one night, it almost felt normal.",
          sounds: ["match"],
        },
        {
          label: "Trade it for parts",
          kind: "cost",
          cost: {},
          reward: "scrap",
          outcome: "You stripped the guitar for wire and wood.",
          sounds: ["woodSplitting"],
        },
      ],
    },

    // ---------- Morning events ----------
    {
      title: "A stranger on the road",
      art: "event_gate",
      time: "morning",
      text: "At first light, a tired stranger waves from the road, hands raised to show they're unarmed.",
      from: "from the road",
      needsFreeBed: true,
      sounds: ["knockSoft"],
      choices: [
        {
          label: "Let them in",
          kind: "cost",
          cost: { food: 1 },
          recruit: true,
          outcome: "You shared a meal and opened the gate.",
          sounds: ["doorOpen", ["footsteps", 500], ["doorClose", 1500]],
        },
        {
          label: "Send them on their way",
          kind: "cost",
          cost: {},
          outcome: "You pointed them down the road.",
          sounds: ["doorClose"],
        },
      ],
    },
    {
      title: "A broken cart",
      art: "event_crate",
      time: "morning",
      text: "A cart lies tipped over in the road outside, one wheel snapped. Its owner is nowhere to be seen.",
      sounds: ["rustyMetal", ["rustyHinges", 700]],
      choices: [
        {
          label: "Take it apart properly",
          kind: "skill",
          skill: "Mechanic",
          fatigue: 20,
          reward: "cart",
          outcome: "Your mechanic stripped the cart down to every useful bolt.",
          sounds: ["buildingHammering", ["rustyMetal", 600]],
        },
        {
          label: "Grab what you can",
          kind: "cost",
          cost: {},
          reward: "scrap",
          outcome: "You pulled a few boards and nails off the cart.",
          sounds: ["woodSplitting", ["rubbish", 600]],
        },
        {
          label: "Leave it",
          kind: "cost",
          cost: {},
          outcome: "You left the cart in the road.",
          sounds: ["footsteps"],
        },
      ],
    },
    {
      title: "Fresh tracks",
      art: "farm",
      time: "morning",
      text: "Muddy tracks lead from the walls toward the treeline. Something circled the shelter last night.",
      sounds: ["footsteps", ["zombieGroan", 1200]],
      choices: [
        {
          label: "Send the hunter after them",
          kind: "skill",
          skill: "Hunter",
          fatigue: 20,
          reward: "deer",
          outcome: "They were a deer's. Your hunter brought it home.",
          sounds: ["carefulWalking", ["gunshot", 1500]],
        },
        {
          label: "Follow them together",
          kind: "cost",
          cost: {},
          hurtOne: 10,
          reward: "tracks",
          outcome: "The tracks led to a lurker, and a few berry bushes behind it.",
          sounds: ["carefulWalking", ["zombieAttack", 1200], ["swing", 1500]],
        },
        {
          label: "Shore up the gate",
          kind: "cost",
          cost: { materials: 1 },
          morale: 5,
          outcome: "You braced the gate. Everyone breathed easier.",
          sounds: ["buildingHammering"],
        },
      ],
    },
  ];

  // Supplies that event choices bring in (see `reward` above). Each one rolls
  // fresh numbers every time, using the run's seeded rng.
  var REWARDS = {
    // A forced crate holds the same as a picked lock.
    crate: function () {
      return AT.minigames.autoResult("Lockpick", true, rng).reward;
    },
    pantry: function () {
      return { food: randInt(2, 4), water: randInt(1, 2) };
    },
    soldier: function () {
      return { ammo: randInt(2, 4), medicine: randInt(0, 1) };
    },
    rats: function () {
      return { food: 2 };
    },
    // A water collector catches more of the storm.
    rain: function () {
      return { water: 2 + fx("water", "water") };
    },
    raiders: function () {
      return { ammo: 2 };
    },
    cart: function () {
      return { materials: randInt(3, 4) };
    },
    scrap: function () {
      return { materials: randInt(1, 2) };
    },
    deer: function () {
      return { food: randInt(3, 5) };
    },
    tracks: function () {
      return { food: randInt(1, 2) };
    },
  };

  // Chance (0 to 1) that a morning event happens before a day starts (never on day 1).
  var MORNING_EVENT_CHANCE = 0.3; // [TUNE THESE]

  // Cutting through the Military checkpoint fence from the Map tab.
  // Cheaper when a Builder or Mechanic is at the shelter to do the cutting.
  var CHECKPOINT_CUT = { cost: 8, skilledCost: 4, skills: ["Builder", "Mechanic"] }; // [TUNE THESE]

  // Each extra day of a long trip brings back this many extra supplies.
  var EXTRA_PER_TRIP_DAY = 2; // [TUNE THESE]

  /* 
---------- Minigame descriptions ----------
*/
  var MINIGAMES = {
    Defense: "Click zombies before they reach the wall.",
    Lockpick: "Turn the pins in the right order before time runs out.",
    Search: "Find the supplies hidden in the room.",
  };

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
      won: ["lightSwitch", ["rustyHinges", 400]],
      lost: ["rustyMetal", ["glassBreak", 300], ["zombieShout", 700]],
    },
    Search: {
      won: ["rummage", ["canJiggle", 600]],
      lost: ["rummage", ["zombieScream", 600]],
    },
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
    // Every facility starts unbuilt (level 0) on every difficulty.
    facilities: FACILITIES.map(function (f) {
      return Object.assign({}, f, { level: 0, building: null, buildTotal: 0 });
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
        task: ["Scavenge", "Build", "Guard"][i] || "Rest",
        target: i === 0 ? "hospital" : null,
        away: 0, // days left on a long trip (see endDay); 0 = at the shelter
      };
    }),
    explored: [],
    unlocked: [], // ids of map locations that started locked and have been opened
    recruited: 0, // survivors who joined during the run (shown on the end screen)
    lastEvent: null, // title of the last event, so the same one doesn't come twice in a row
    eventTime: "night", // "night" or "morning": what happens after the current event
    currentChoice: null, // the choice picked for the current event (for mini-game wins)
    selectedLocation: "hospital",
    trade: { give: {}, get: {} },
    // The first trader is already here on day 1. See makeTrader() and traderDawn().
    trader: makeTrader(TRADERS[0], 2),
    log: [],
    logFilter: "all",
    eventsFaced: 0,
    suppliesGathered: 0,
    currentEvent: null,
    sendWho: null, // survivor picked in advance on the Map (set by "Choose destination" links)
    logSeen: 0, // how many log entries the player has seen on the Log tab (for its badge)
    logOpen: {}, // which days the player has opened or closed in the Log
    hordeRoll: randInt(-3, 3), // tonight's horde is threatTonight() + this; rolled each dawn
  };
  var leaving = false; // true once the run is over, so leaving the page doesn't ask "are you sure?"

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
    addLog(cat || "exploring", "The " + loc.name + " is open. Scavengers can go there now.", "good");
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
      health: randInt(40, 80),
      hunger: randInt(30, 60),
      fatigue: randInt(30, 60),
      morale: randInt(40, 70),
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
        "A survivor " + where + " wanted to join, but there was no free bed. Build more beds to take people in.",
        "bad",
      );
      return null;
    }
    var s = newSurvivor();
    if (s.health < 60) s.status = "Injured";
    state.survivors.push(s);
    state.recruited += 1;
    addLog(
      cat,
      s.name + " (" + s.skill + ", " + s.trait.toLowerCase() + ") joined the group " + where + ".",
      "good",
    );
    // A new face lifts everyone a little.
    alive().forEach(function (o) {
      if (o !== s) changeMorale(o, 5);
    });
    cue("knockSoft", 3400); // a knock at the door with the next report
    return s;
  }

  // Adds a set of supplies (e.g. { food: 2 }) to the stores and logs it.
  function gainSupplies(cat, gained) {
    var total = 0;
    Object.keys(gained || {}).forEach(function (k) {
      if (gained[k] > 0) {
        state.resources[k] += gained[k];
        total += gained[k];
      }
    });
    if (!total) return;
    state.suppliesGathered += total;
    addLog(cat, "Brought back " + AT.minigames.describe(gained) + ".", "good");
  }
  // ---------- Checks the state of a facility ----------
  function facility(id) {
    return state.facilities.find(function (f) {
      return f.id === id;
    });
  }
  // What a facility gives at its current level (see the FX table).
  function fx(id, key) {
    return FX[id][key][facility(id).level];
  }
  // The tier being worked on next (null when maxed), and the current one (null when not built).
  function nextTier(f) {
    return f.tiers[f.level] || null;
  }
  // The tier the facility has now (null when not built).
  function currentTier(f) {
    return f.level ? f.tiers[f.level - 1] : null;
  }
  // ---------- Checks the number of available beds ----------
  function bedCount() {
    return fx("beds", "sleeps");
  }
  // ---------- Checks the number of available guards ----------
  function guards() {
    return home().filter(function (s) {
      return s.task === "Guard";
    }).length;
  }
  // ---------- Checks the night defense value ----------
  // How much night defense one survivor adds. Skills/traits are defined in common.js.
  function guardPower(s) {
    if (s.task !== "Guard" || s.trait === "Coward" || s.fatigue >= TIRED)
      return 0;
    var power = s.skill === "Fighter" ? 10 : 5;
    if (s.trait === "Night owl") power += 5;
    return power + fx("walls", "guardBonus");
  }
  // Calculates the total night defense value based on walls, guards, and ammo.
  //  Skills and traits are defined in common.js.
  // Pass ahead = true for the Today panel: it counts walls that will finish at dusk,
  // since they'll be up before the horde arrives.
  function nightDefense(ahead) {
    var ammo = Math.min(state.resources.ammo, 10);
    if (onTask("Guard", "Sharpshooter")) ammo *= 2;
    var guardTotal = home().reduce(function (sum, s) {
      return sum + guardPower(s);
    }, 0);
    var walls = facility("walls");
    var level = walls.level + (ahead && wallsFinishToday() ? 1 : 0);
    return FX.walls.defense[level] + guardTotal + ammo;
  }
  // True when the walls' next tier will be finished at dusk today.
  function wallsFinishToday() {
    return facility("walls").building === 1 && builders().length > 0;
  } // [WORK IN PROGRESS NEEDS TUNING]

  // Survivors on Build who are rested enough to work.
  function builders() {
    return home().filter(function (s) {
      return s.task === "Build" && s.fatigue < TIRED;
    });
  }

  // Checks if a survivor is on a specific task with a specific skill.
  function onTask(task, skill) {
    return home().some(function (s) {
      return s.task === task && s.skill === skill;
    });
  }
  // Cost of a facility's next tier: 2 less with a Builder on Build, and less again
  // with a Workshop. Never below 1.
  function upgradeCost(f) {
    var t = nextTier(f);
    if (!t) return 0;
    return Math.max(
      1,
      t.cost -
        (onTask("Build", "Builder") ? 2 : 0) -
        fx("workshop", "discount"),
    );
  }
  // Days of work for a facility's next tier. A Fabrication Shop saves a day. Never below 1.
  function buildDays(f) {
    var t = nextTier(f);
    return t ? Math.max(1, t.days - fx("workshop", "fasterBy")) : 0;
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
    // Whoever is left buries them: a shovel plays with the next report.
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
      addLog("base", s.name + " lost all hope and left the group.", "bad");
      if (!cued("doorClose")) cue("doorClose", 2000);
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
    return home().some(function (s) {
      return s.skill === skill;
    });
  }

  // The least tired living survivor with a skill (or undefined if none can act).
  function skilled(skill) {
    return home()
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

  /* 
=============================================================== 
---------- Plan checks ----------
=============================================================== 
These look at today's plan without changing anything. The Today panel,
the tab badges, the survivor cards and the End day check all use them,
so they always agree with each other.
*/
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
  // True while a trader is visiting.
  function traderHere() {
    return state.trader.leaves > 0;
  }

  // Sets up a trader's visit: fresh stock, how long they stay, and no trade made yet.
  function makeTrader(t, stays) {
    var stock = {};
    RESOURCES.forEach(function (r) {
      var base = t.stock[r.id] || 0;
      stock[r.id] = base ? Math.max(1, base + randInt(-1, 1)) : 0;
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
    return wanted ? Math.round(TRADE_VALUE[id] * WANT_BONUS) : TRADE_VALUE[id];
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
    var choices = TRADERS.filter(function (x) {
      return x.id !== t.id;
    });
    var next = makeTrader(choices[Math.floor(rng() * choices.length)]);
    state.trader = next;
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
  // Food the group eats at dusk (also used by the dusk itself).
  // Survivors away on a trip live off what they find, so only those at home eat.
  function foodNeeded() {
    var need = home().reduce(function (sum, s) {
      return sum + (s.trait === "Big eater" ? 2 : 1);
    }, 0);
    if (onTask("Cook", "Cook")) need = Math.max(0, need - 1);
    return need;
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
      .slice(0, fx("infirmary", "patients"));
  }
  // Health one treatment restores. A Medic does more; a Sick Bay adds more.
  // Without medicine only a Medic can do anything.
  function healAmount(healer, meds) {
    var amount = meds
      ? healer.skill === "Medic"
        ? 30
        : 10
      : healer.skill === "Medic"
        ? 10
        : 0;
    return amount ? amount + fx("infirmary", "healBonus") : 0;
  }
  // Materials a Mechanic on Build salvages each day.
  function salvageAmount() {
    return 2 + fx("workshop", "salvage");
  }

  // What a survivor's task will actually do today.
  // Returns { text, level, fix }:
  //   level is "" (fine), "info" (does nothing useful) or "bad" (needs fixing)
  //   fix is an optional link { label, goto (tab), who (survivor id) } to where it can be fixed
  function taskInfo(s) {
    var tired = s.fatigue >= TIRED;
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
          ? (s.trait === "Quick healer" ? 10 : 0) + fx("infirmary", "restHeal")
          : 0;
      return {
        text:
          "Recovers " +
          fx("beds", "rest") +
          " fatigue and " +
          fx("beds", "restMorale") +
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
          " danger)." +
          (loc.travel > 1
            ? " A " + loc.travel + "-day trip: away until dusk " +
              (loc.travel === 2 ? "tomorrow" : "in " + plural(loc.travel - 1, "day")) +
              "."
            : ""),
        level: "",
        fix: { label: "Change", goto: "map", who: s.id },
      };
    }
    if (s.task === "Build") {
      if (tired)
        return {
          text: "Too tired to build. Work won't move forward.",
          level: "bad",
        };
      var extra =
        s.skill === "Mechanic"
          ? " Also salvages " + salvageAmount() + " materials."
          : "";
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
                nextTier(f).name + " (" + plural(f.building, "day") + " left)"
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
      if (s.trait === "Coward")
        return { text: "Cowards add no defense on Guard.", level: "info" };
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
      if (s.skill === "Cook")
        return { text: "The group eats 1 less food at dusk.", level: "" };
      return { text: "Only a Cook saves food. No effect.", level: "info" };
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

  // What dusk will do to food and water, before anything scavengers bring home.
  function duskForecast() {
    var food = {
      have: state.resources.food,
      made: fx("kitchen", "food"),
      need: foodNeeded(),
    };
    var water = {
      have: state.resources.water,
      made: fx("water", "water"),
      need: home().length,
    };
    [food, water].forEach(function (r) {
      r.after = r.have + r.made - r.need;
    });
    return { food: food, water: water };
  }

  // Night defense against tonight's horde. The real horde is up to 3 bigger or smaller.
  // With a lookout (walls tier 2+) the exact horde size is known.
  function tonightOdds() {
    var def = nightDefense(true),
      exact = fx("walls", "exactHorde"),
      threat = exact ? hordeSize() : threatTonight();
    var level = exact
      ? def >= threat
        ? "good"
        : "bad"
      : def >= threat + 3
        ? "good"
        : def >= threat - 3
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
          "Night defense " +
          odds.def +
          (odds.exact
            ? " is below the horde ("
            : " is well below the horde (about ") +
          odds.threat +
          ").",
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
  // One warning line, with its fix link if it has one.
  function warnItem(w) {
    return (
      '<li class="warn"><span>' +
      esc(w.text) +
      "</span>" +
      (w.fix ? fixLink(w.fix) : "") +
      "</li>"
    );
  }

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
          (s.away ? "Away" : s.task) +
          '</span><span class="plan-detail">' +
          esc(info.text) +
          "</span></li>"
        );
      })
      .join("");

    // Food and water at dusk: have + made − eaten → left.
    var fc = duskForecast();
    // One forecast row: have + made − eaten → what's left (or how short).
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
      '<span class="muted">vs</span><span><strong>' +
      (odds.exact ? "" : "~") +
      pad(odds.threat) +
      "</strong> horde</span></div>" +
      '<p class="odds-label ' +
      odds.level +
      '">' +
      odds.label +
      ' <span class="muted">· ' +
      (odds.exact ? "horde spotted from the lookout · " : "") +
      plural(guards(), "guard") +
      (wallsFinishToday()
        ? " · counts the " +
          nextTier(facility("walls")).name +
          " finishing at dusk"
        : "") +
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
    setBadge(
      "trade",
      traderHere() ? state.trader.leaves + "d" : "",
      "trader leaves in " + plural(state.trader.leaves, "day"),
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

  /* 
=============================================================== 
---------- Base Tab ----------
=============================================================== 
*/
  // One facility card. The ladder lists all three tiers: built ones are ticked,
  // the next one is highlighted with its cost, and later ones are greyed.
  function facilityCard(f) {
    var built = f.level > 0,
      maxed = f.level >= 3,
      next = nextTier(f),
      now = currentTier(f);
    var short = maxed ? 0 : upgradeCost(f) - state.resources.materials;

    // A line under the button says why it can't be used, or what happens next.
    var note = "",
      noteTone = "";
    if (f.building) {
      if (!builders().length) {
        note = "Stalled. Put someone rested on Build.";
        noteTone = "bad";
      }
    } else if (!maxed && short > 0) {
      note = "Need " + short + " more materials.";
      noteTone = "bad";
    } else if (!maxed && !builders().length) {
      note = "You'll pick who builds it.";
    }

    var ladder =
      '<ol class="tier-ladder">' +
      f.tiers
        .map(function (t, i) {
          var n = i + 1;
          var cls =
            n <= f.level ? "done" : n === f.level + 1 ? "next" : "later";
          var mark = n <= f.level ? "✓" : String(n);
          var state_ =
            n <= f.level
              ? "built"
              : n === f.level + 1
                ? f.building
                  ? "in progress"
                  : "next"
                : "locked";
          return (
            '<li class="' +
            cls +
            (cls === "next" && f.building ? " building" : "") +
            '"><span class="tier-mark" aria-hidden="true">' +
            mark +
            '</span><span class="tier-text"><strong>' +
            t.name +
            '</strong><span class="visually-hidden"> (' +
            state_ +
            ")</span><span>" +
            t.effect +
            "</span></span></li>"
          );
        })
        .join("") +
      "</ol>";

    var progress = "";
    if (f.building) {
      var done = f.buildTotal - f.building;
      progress =
        '<div class="build-progress"><div class="row small"><span>Building <strong>' +
        next.name +
        "</strong></span><span>" +
        done +
        " of " +
        plural(f.buildTotal, "day") +
        '</span></div><span class="meter" role="progressbar" aria-label="Build progress" aria-valuemin="0" aria-valuemax="' +
        f.buildTotal +
        '" aria-valuenow="' +
        done +
        '"><span style="width:' +
        Math.round((done / f.buildTotal) * 100) +
        '%"></span></span></div>';
    }

    var action = f.building
      ? "Building"
      : maxed
        ? "Fully upgraded"
        : built
          ? "Upgrade"
          : "Build";
    var costLine = maxed
      ? "All tiers built"
      : f.building
        ? plural(f.building, "day") + " of work left"
        : "Next: " +
          plural(upgradeCost(f), "material") +
          " · " +
          plural(buildDays(f), "day");

    return (
      '<article class="card facility' +
      (built ? "" : " unbuilt") +
      (maxed ? " maxed" : "") +
      '">' +
      '<img class="fac-art" src="assets/images/png/' +
      f.img +
      '.png" alt="">' +
      '<div class="row"><h3>' +
      f.name +
      '</h3><span class="fac-level">' +
      (built ? "Level " + f.level + " of 3" : "Not built") +
      "</span></div>" +
      '<p class="fac-current">' +
      (now
        ? "<strong>" + now.name + "</strong> " + now.effect
        : '<span class="muted">' + f.none + "</span>") +
      "</p>" +
      ladder +
      progress +
      '<div class="foot"><span>' +
      costLine +
      "</span>" +
      '<button class="btn btn-sm" type="button" data-sound="none" data-upgrade="' +
      f.id +
      '"' +
      (maxed || f.building || short > 0 ? " disabled" : "") +
      ' aria-label="' +
      (next && !f.building
        ? action + ": " + next.name
        : action + " " + f.name) +
      '">' +
      action +
      "</button></div>" +
      (note ? '<p class="fac-note ' + noteTone + '">' + note + "</p>" : "") +
      "</article>"
    );
  }

  // The Base tab: shelter summary and one card per facility.
  function renderBase() {
    var p = $("panel-base");
    var builtCount = state.facilities.filter(function (f) {
      return f.level > 0;
    }).length;
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
      (fx("walls", "exactHorde")
        ? " · Horde tonight " + pad(hordeSize()) + " (spotted from the lookout)"
        : " · Horde tonight about " + pad(threatTonight())) +
      "</p></div>" +
      (builtCount
        ? ""
        : '<p class="card base-intro">Nothing is built yet. Each facility has three tiers. ' +
          "Pay the materials, then someone on Build works on it until it's done.</p>") +
      '<div class="grid-3">' +
      state.facilities.map(facilityCard).join("") +
      "</div>";
  }

  // Upgrade buttons start work straight away if someone is on Build;
  // otherwise they open a picker to choose who builds it.
  $("panel-base").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-upgrade]");
    if (!btn) return;
    var f = facility(btn.dataset.upgrade);
    if (builders().length) startWork(f);
    else {
      actionSounds(["menu"]);
      openBuildPicker(f);
    }
  });

  // Materials are paid now; the work finishes after buildDays(f) days with someone on Build.
  function startWork(f) {
    var cost = upgradeCost(f);
    if (f.building || state.resources.materials < cost) return;
    state.resources.materials -= cost;
    // Hammering, stacked with a sound for what is being built.
    actionSounds(["buildingHammering", [f.sound, 250]]);
    var tier = nextTier(f);
    f.building = f.buildTotal = buildDays(f);
    addLog(
      "base",
      "Work started on the " +
        tier.name +
        " (" +
        plural(f.building, "day") +
        ").",
    );
    toast("Work started on the " + tier.name + ".");
    renderAll();
  }

  // ---------- Builder picker ----------
  var buildFor = null;
  // Opens the "Who builds this?" pop-up for a facility when nobody is on Build.
  function openBuildPicker(f) {
    buildFor = f;
    $("build-title").textContent = "Who builds the " + nextTier(f).name + "?";
    $("build-text").textContent =
      f.name +
      ", tier " +
      (f.level + 1) +
      " of 3. It takes " +
      plural(buildDays(f), "day") +
      " with someone on Build each day. Whoever you pick switches to Build now.";
    $("build-choices").innerHTML = home()
      .map(function (s) {
        var tired = s.fatigue >= TIRED;
        var now =
          s.task +
          (s.task === "Scavenge" && s.target
            ? " (" + findLoc(s.target).name + ")"
            : "");
        var perk =
          s.skill === "Builder"
            ? " · Builder: costs 2 fewer materials"
            : s.skill === "Mechanic"
              ? " · Mechanic: also salvages " + salvageAmount() + " materials"
              : "";
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
    startWork(buildFor);
    buildFor = null;
  });
  // Cancel closes the picker without building.
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

  // The Survivors tab: a card per survivor with their stats, task buttons and
  // what their task will do, plus a "Free bed" card when there's room.
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
            (s.away ? " away" : "") +
            '">' +
            s.status +
            (tired ? "<br>Too tired" : "") +
            (s.away ? "<br>Away" : "") +
            "</span></div>" +
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

  // Clicking a task button gives the survivor that task (not while they're away).
  $("panel-survivors").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-set-task]");
    if (!btn || btn.disabled) return;
    var s = findSurvivor(btn.dataset.who);
    if (s.away) return;
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
    var rested = home().filter(function (s) {
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

  // The Map tab: the location buttons, and details for the selected one with
  // the Send controls (or the fence controls while it's locked).
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
          (isLocked(l) ? ", locked" : "") +
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
          (l.id === loc.id) +
          '">' +
          (isLocked(l) ? '<span aria-hidden="true">🔒</span> ' : "") +
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
      " fatigue" +
      (loc.travel > 1 ? ", away overnight, +" + EXTRA_PER_TRIP_DAY * (loc.travel - 1) + " supplies" : "") +
      ")</span></dd>" +
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
              return esc(s.name) + (s.away ? " (away)" : "");
            })
            .join(", ")
        : '<span class="muted">No one</span>') +
      "</dd></dl>" +
      (isLocked(loc)
        ? fenceControls()
        : '<label class="small" for="send-who">Send</label>' +
          '<select id="send-who">' +
          alive()
            .map(function (s) {
              var tired = s.fatigue >= TIRED;
              // Only mention what matters here: away, too tired, or already going somewhere.
              var now = s.away
                ? " (away)"
                : tired
                  ? " (too tired)"
                  : s.task === "Scavenge" && s.target
                    ? " (→ " + findLoc(s.target).name + ")"
                    : "";
              return (
                '<option value="' +
                s.id +
                '"' +
                (sender && s.id === sender.id ? " selected" : "") +
                (tired || s.away ? " disabled" : "") +
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
          '<button class="btn btn-primary btn-block" type="button" id="send-btn" data-sound="none" style="margin-top:.75rem"' +
          (sender ? "" : " disabled") +
          ">Send here to scavenge</button>" +
          '<p class="small muted" style="margin-top:.5rem">' +
          (sender
            ? "They switch to Scavenge. May trigger an event or a mini-game." +
              (loc.travel > 1 ? " This trip keeps them away until tomorrow's dusk." : "")
            : "Everyone at the shelter is too tired. Let someone rest first.") +
          "</p>") +
      "</div></div>";
  }

  // Materials it takes to cut through a locked location's fence: less with a
  // Builder or Mechanic at the shelter (see CHECKPOINT_CUT).
  function fenceCost() {
    var handy = home().some(function (s) {
      return CHECKPOINT_CUT.skills.indexOf(s.skill) !== -1;
    });
    return handy ? CHECKPOINT_CUT.skilledCost : CHECKPOINT_CUT.cost;
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
        : cost === CHECKPOINT_CUT.skilledCost
          ? "Your " + CHECKPOINT_CUT.skills.join(" or ") + " makes quick work of it."
          : "A " + CHECKPOINT_CUT.skills.join(" or ") + " at the shelter would need only " + CHECKPOINT_CUT.skilledCost + ".") +
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
      actionSounds(["rustyMetal", ["woodSplitting", 400], ["rustyHinges", 900]]);
      toast("The fence is down. The " + place.name + " is open.");
      renderAll();
      if ($("send-btn")) $("send-btn").focus();
      return;
    }
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
      if (!s || s.away || isLocked(loc)) return;
      s.task = "Scavenge";
      s.target = loc.id;
      state.sendWho = null;
      // Out the door, then footsteps that get quieter the more dangerous the place.
      actionSounds(["doorOpen", [SCAVENGE_STEPS[loc.danger], 300]]);
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
  // Value of one side of the offer. What you give is valued at the trader's buy price
  // (extra for what they want); what you get is valued at the normal price.
  function tradeValue(side) {
    return RESOURCES.reduce(function (sum, r) {
      var each = side === "give" ? buyValue(r.id) : TRADE_VALUE[r.id];
      return sum + (state.trade[side][r.id] || 0) * each;
    }, 0);
  }

  // Share of the trader's value you must offer: the difficulty's markup,
  // lowered by 25% if someone in the group is a Negotiator.
  function tradeNeed() {
    return D.tradeMarkup * (hasSkill("Negotiator") ? 0.75 : 1);
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
    if (hasSkill("Negotiator") && !t.tradedToday)
      msg += " Your negotiator gets you a better deal.";

    // One side of the trade: a row per resource with − and + steppers.
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
    $("panel-trade").innerHTML =
      '<div class="panel-head"><h2>Trade</h2></div>' +
      '<div class="card trader"><img class="avatar portrait" src="assets/images/png/trader.png" alt=""><div><h3>' +
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
      "</p></div></div>" +
      '<div class="trade-cols">' +
      column("give", "You give · from your stores", "You have") +
      column("get", "You get · from " + esc(t.name), "Has") +
      "</div>" +
      '<div class="card trade-bar"><div>' +
      '<div class="labels"><span>Your offer · value ' +
      pad(give) +
      "</span><span>" +
      esc(t.name) +
      "'s offer · value " +
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

  // Dusk: works out everything the day's tasks did, then shows the Dusk report.
  // Continue on the report moves on to the night event.
  function endDay() {
    // A match is struck as the light goes. The rest of dusk's sounds are cued
    // below and play with the Dusk report.
    endScene();
    sceneSounds(["match"]);
    // Everything logged from here on goes into the Dusk report pop-up.
    var duskMark = state.log.length;
    // This is dusk where the results come in.
    // Skill and trait effects are listed in common.js.
    var scavenged = false; // true if anyone came home tonight (some events need it)
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
          addLog("exploring", s.name + " is still out at the " + loc.name + ".");
          return;
        }
      } else {
        if (s.fatigue >= TIRED) {
          addLog(
            "exploring",
            s.name + " was too tired to scavenge and stayed home.",
          );
          return;
        }
        // Setting out on a long trip: away from tonight until dusk on the last day.
        if (loc.travel > 1) {
          s.away = loc.travel - 1;
          addLog(
            "exploring",
            s.name +
              " set out for the " +
              loc.name +
              ". Back at dusk " +
              (s.away === 1 ? "tomorrow" : "in " + plural(s.away, "day")) +
              ".",
          );
          return;
        }
      }
      scavenged = true;
      // Riskier places hold more, and longer trips bring back more, but every
      // trip wears survivors out.
      var found =
        randInt(1, 4) + (loc.danger - 1) + EXTRA_PER_TRIP_DAY * (loc.travel - 1);
      if (s.trait === "Lucky")
        found = Math.max(found, randInt(1, 4) + (loc.danger - 1));
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
          (total
            ? " and brought back " + AT.minigames.describe(haul) + "."
            : " but found nothing."),
      );
      tire(s, 20 * loc.travel);
      if (rng() < D.scavRisk * loc.danger) {
        hurt(
          s,
          10 * loc.danger,
          "exploring",
          "was attacked at the " + loc.name,
        );
      }
      // Sometimes they meet someone out there who wants to join (needs a free bed).
      if (s.alive && rng() < (loc.people || 0)) {
        recruit("exploring", "that " + s.name + " met at the " + loc.name);
      }
    });

    // The scavengers come home and unpack.
    if (scavenged) {
      cue("doorClose", 1200);
      cue("rummage", 1700);
    }

    // Facilities that produce something every day.
    var waterMade = fx("water", "water");
    var foodMade = fx("kitchen", "food");
    state.resources.water += waterMade;
    state.resources.food += foodMade;
    if (waterMade) {
      addLog(
        "base",
        "The " +
          currentTier(facility("water")).name +
          " collected " +
          waterMade +
          " water.",
      );
    }
    if (foodMade) {
      addLog(
        "base",
        "The " +
          currentTier(facility("kitchen")).name +
          " made " +
          foodMade +
          " food.",
      );
    }

    // Construction moves forward one day if someone rested is on Build.
    // A finished tier works from tomorrow on.
    var working = builders().length > 0;
    state.facilities.forEach(function (f) {
      if (!f.building) return;
      var tier = nextTier(f);
      if (!working) {
        addLog("base", "No one worked on the " + tier.name + " today.");
        return;
      }
      f.building -= 1;
      if (f.building === 0) {
        f.building = null;
        f.level += 1;
        cue(f.sound, 2000);
        addLog(
          "base",
          f.name +
            (f.level === 1 ? " built: " : " upgraded: ") +
            tier.name +
            ". " +
            tier.effect,
          "good",
        );
      }
    });

    // Each survivor at the shelter does their task.
    home().forEach(function (s) {
      if (s.task === "Build" && s.skill === "Mechanic" && s.fatigue < TIRED) {
        state.resources.materials += salvageAmount();
        addLog("base", s.name + " salvaged " + salvageAmount() + " materials.");
      }
      if (s.task === "Rest" && s.health < 100) {
        // Quick healers mend on their own; an infirmary helps everyone who rests.
        var mend =
          (s.trait === "Quick healer" ? 10 : 0) + fx("infirmary", "restHeal");
        if (mend) {
          heal(s, mend);
          addLog(
            "base",
            s.name +
              " rested" +
              (fx("infirmary", "restHeal") ? " in the infirmary" : "") +
              " and recovered " +
              mend +
              " health.",
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
            addLog(
              "base",
              s.name + " had no medicine to treat " + p.name + ".",
            );
            return;
          }
          if (meds) state.resources.medicine -= 1;
          heal(p, amount);
          addLog(
            "base",
            s.name + " treated " + p.name + " (+" + amount + " health).",
          );
        });
      }
      // Rest lowers fatigue (more with better beds); every other task raises it
      // (scavenging was counted above).
      if (s.task === "Rest") {
        tire(s, -fx("beds", "rest"));
        changeMorale(s, fx("beds", "restMorale"));
      } else if (s.task !== "Scavenge") {
        tire(s, 10);
      }
    });

    // Dinner. Anyone away on a trip lives off the land and isn't counted.
    var needFood = foodNeeded();
    var eaten = Math.min(state.resources.food, needFood);
    var drunk = Math.min(state.resources.water, home().length);
    state.resources.food -= eaten;
    state.resources.water -= drunk;
    // Dinner: the old fridge, a can cracked open, then water poured out.
    if (eaten) cue("fridge", 2400);
    if (drunk) {
      cue("canOpen", 2700);
      cue("pourWater", 3100);
    }
    addLog(
      "base",
      "The group ate " + eaten + " food and drank " + drunk + " water at dusk.",
    );

    // Going short on food builds hunger; going short on water hurts right away.
    var shortFood = needFood - eaten;
    var shortWater = home().length - drunk;
    if (shortFood > 0)
      addLog("base", "There was not enough food for everyone.", "bad");
    if (shortWater > 0)
      addLog("base", "There was not enough water for everyone.", "bad");
    home().forEach(function (s) {
      s.hunger = Math.max(
        0,
        Math.min(100, s.hunger + (shortFood > 0 ? 25 : -15)),
      );
      if (shortFood > 0) changeMorale(s, -5);
      if (shortWater > 0) hurt(s, D.starveDmg, "base", "is dehydrated");
      if (s.alive && s.hunger >= 80)
        hurt(s, D.starveDmg, "base", "is starving");
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
    var tonight = pickEvent("night", scavenged);
    showReport({
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
          state.eventTime = "night";
          finishNight();
        }
      },
    });
  }

  // ---------- Report pop-up ----------
  // Shows a list of log entries and waits for Continue before running opts.next.
  // opts = { kicker, title, entries, art (optional image name), button, next }
  var reportNext = null;
  // Fills in and opens the report pop-up.
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
              '</span><span class="line-text">' +
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
    // Type the lines out at the Text speed setting (click the list to skip).
    var lines = Array.prototype.slice.call(
      $("report-list").querySelectorAll(".line-text"),
    );
    skipTyping = AT.typeLines(
      lines,
      lines.map(function (el) {
        return el.textContent;
      }),
    );
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

  // ---------- Typing ----------
  // Skips whatever text is still being typed (see AT.typeText in common.js).
  // Replaced each time new text starts typing.
  var skipTyping = function () {};
  // Clicking the text being typed shows it all at once.
  $("report-list").addEventListener("click", function () {
    skipTyping();
  });
  $("event-text").addEventListener("click", function () {
    skipTyping();
  });

  // ---------- Event overlay ----------
  // Picks an event for "night" or "morning" that fits the run right now
  // (see the needs... fields on EVENTS), avoiding the last one shown.
  // Returns null when nothing fits.
  function pickEvent(time, scavenged) {
    var pool = EVENTS.filter(function (ev) {
      return (
        (ev.time || "night") === time &&
        (!ev.needsScavenging || scavenged) &&
        (!ev.needsFreeBed || freeBeds() > 0) &&
        (!ev.needsLocked || isLocked(findLoc(ev.needsLocked)))
      );
    });
    var fresh = pool.filter(function (ev) {
      return ev.title !== state.lastEvent;
    });
    if (fresh.length) pool = fresh;
    return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
  }

  // The small grey line under each choice: what it needs and what it does.
  function choiceNote(c) {
    var cost = c.cost || {};
    var costParts = Object.keys(cost).map(function (k) {
      return cost[k] + " " + k;
    });
    var parts = [];
    if (c.kind === "skill") parts.push("Requires: " + c.skill);
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
    if (c.injure || c.hurtOne) parts.push("Risky");
    if (c.morale) parts.push(c.morale < 0 ? "Hurts morale" : "Lifts morale");
    if (c.reward) parts.push("Brings supplies");
    if (c.recruit || (c.win && c.win.recruit))
      parts.push(freeBeds() > 0 ? "They join you" : "No free bed for them");
    if (c.unlock || (c.win && c.win.unlock))
      parts.push("Opens the " + findLoc(c.unlock || c.win.unlock).name);
    return parts.join(" · ");
  }

  // Can the group pick this choice right now? Skill choices need a rested
  // survivor with that skill at the shelter; anything with a cost needs the supplies.
  function choiceOk(c) {
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
    state.currentEvent = ev;
    state.currentChoice = null;
    state.eventTime = time || "night";
    state.lastEvent = ev.title;
    state.eventsFaced += 1;
    $("event-kicker").textContent =
      state.eventTime === "morning"
        ? "Day " + pad(state.day) + " · Morning"
        : "Night " + pad(state.day) + " · Event";
    $("event-title").textContent = ev.title;
    // Event pictures live in assets/images/png/; events without `art` use the generic one.
    $("event-art").src =
      "assets/images/png/" + (ev.art || "event_generic") + ".png";
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
          c.label +
          "</strong><span>" +
          choiceNote(c) +
          (ok ? "" : " — not available") +
          "</span></button>"
        );
      })
      .join("");
    $("event-dialog").showModal();
    // The story text types out at the Text speed setting.
    skipTyping = AT.typeText($("event-text"), ev.text);
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
      state.currentChoice = c; // its `win` effects apply in resolveMinigame()
      if (AT.load().minigames === "auto") autoResolve(c.game);
      else openMinigame(c.game);
      return;
    }
    applyChoice(ev, c);
    afterEvent();
  });

  // Carries out a picked choice: pays its cost, writes the outcome to the log,
  // then applies each of its effects (see the list above EVENTS).
  function applyChoice(ev, c) {
    // Who does the work for a skill choice (read before costs change anything).
    var who = c.kind === "skill" ? skilled(c.skill) : null;
    Object.keys(c.cost || {}).forEach(function (k) {
      state.resources[k] -= c.cost[k];
    });
    addLog("event", ev.title + ": " + c.outcome);
    if (who && c.fatigue) tire(who, c.fatigue);
    if (who && c.injure) hurt(who, c.injure, "event", "was hurt");
    // Losses take as much as there is.
    if (c.lose) {
      var lost = {};
      Object.keys(c.lose).forEach(function (k) {
        lost[k] = Math.min(state.resources[k], c.lose[k]);
        state.resources[k] -= lost[k];
      });
      addLog("event", "Lost " + AT.minigames.describe(lost) + ".", "bad");
    }
    if (c.reward) gainSupplies("event", REWARDS[c.reward]());
    if (c.recruit) recruit("event", ev.from || "after the " + ev.title.toLowerCase());
    if (c.unlock) unlock(c.unlock, "event");
    if (c.morale) {
      alive().forEach(function (s) {
        changeMorale(s, c.morale);
      });
      addLog(
        "event",
        (c.morale < 0 ? "Morale dropped (" : "Morale rose (+") + c.morale + ").",
        c.morale < 0 ? "bad" : "good",
      );
    }
    if (c.hurtOne) {
      var victim = pickVictim();
      if (victim) hurt(victim, c.hurtOne, "event", "was hurt");
    }
  }

  // After an event (and any mini-game): the night raid for night events, or
  // the Morning report for morning events.
  function afterEvent() {
    if (state.eventTime === "morning") finishMorning();
    else finishNight();
  }

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

  // The mini-game's main button: Start begins the game; once it's over the
  // same button reads Continue and applies the result.
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
        r,
      );
    }
  });
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
    var how = auto ? " (auto-resolved)" : "";
    var cat =
      name === "Defense" ? "night" : name === "Search" ? "exploring" : "event";
    var from = state.currentEvent ? state.currentEvent.title + ": " : "";
    addLog(
      cat,
      from + name + " mini-game " + (won ? "won" : "lost") + how + ".",
      won ? "good" : "bad",
    );
    reward = reward || {};
    var gained = 0;
    Object.keys(reward).forEach(function (k) {
      state.resources[k] += reward[k];
      gained += reward[k];
    });
    if (gained) {
      state.suppliesGathered += gained;
      addLog(
        cat,
        "Brought back " + AT.minigames.describe(reward) + ".",
        "good",
      );
    }
    // A won mini-game can carry extra effects from the event choice
    // (e.g. covering a newcomer as they run in means they join).
    var choice = state.currentChoice;
    state.currentChoice = null;
    if (won && choice && choice.win) {
      var ev = state.currentEvent || {};
      if (choice.win.reward) gainSupplies(cat, REWARDS[choice.win.reward]());
      if (choice.win.recruit) {
        recruit(cat, ev.from || "after the " + (ev.title || "fight").toLowerCase());
      }
      if (choice.win.unlock) unlock(choice.win.unlock, cat);
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
      hurt(pickVictim(), 30, cat, "was injured");
    }
    afterEvent();
  }

  // The horde grows over the run. It starts at threatBase and reaches
  // threatBase + threatPeak on the last night, whatever the run length.
  function threatTonight() {
    return Math.round(D.threatBase + D.threatPeak * (state.day / state.length));
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
    var def = nightDefense();
    var shots = Math.min(state.resources.ammo, guards());
    state.resources.ammo -= shots;
    // Raid sounds play with the Dawn report, after the night event's own sounds.
    // One gunshot per bullet the guards fire (up to 4 you can hear).
    for (var shot = 0; shot < Math.min(shots, 4); shot++) {
      cue("gunshot", 1500 + shot * 350);
    }
    home().forEach(function (s) {
      if (s.task === "Guard") tire(s, 15);
    });
    if (def >= threat) {
      cue("horde", 1300);
      cue("zombieDying", 2700);
      addLog(
        "night",
        "The horde hit the walls and broke (defense " +
          def +
          " vs " +
          threat +
          ").",
        "good",
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
    );
    // Bigger breaches catch more people. Anyone away on a trip is safe.
    var hits = breach >= 15 ? 2 : 1;
    for (var i = 0; i < hits && home().length; i++) {
      var list = home();
      var v = list[Math.floor(rng() * list.length)];
      hurt(
        v,
        Math.min(50, 5 + breach * 2),
        "night",
        "was caught in the breach",
      );
    }
    var walls = facility("walls");
    if (breach >= 15 && walls.level > 1) {
      walls.level -= 1;
      cue("woodSplitting", 2800);
      addLog(
        "night",
        "The walls were damaged and fell back to " +
          currentTier(walls).name +
          ".",
        "bad",
      );
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
        entries: state.log.slice(eventMark),
        button: "See how it ended",
        next: function () {
          endRun(false);
        },
      });
      return;
    }
    if (state.day >= state.length) {
      addLog("base", "The group survived the last night.", "good");
      cue("rooster", 4000);
      renderAll();
      showReport({
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
    state.hordeRoll = randInt(-3, 3);
    traderDawn();
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
    // Some mornings bring an event before the day starts (decided now so the
    // button can say what comes next).
    var morning = rng() < MORNING_EVENT_CHANCE ? pickEvent("morning") : null;
    showReport({
      kicker: "Dawn · Day " + pad(state.day),
      title: "Dawn report",
      entries: state.log.slice(eventMark),
      button: morning ? "Continue" : "Start day " + state.day,
      next: function () {
        if (morning) openEvent(morning, "morning");
        else startDay();
      },
    });
  }

  // Runs after a morning event: shows what it led to, then starts the day.
  function finishMorning() {
    state.currentEvent = null;
    renderAll();
    var entries = state.log.slice(eventMark);
    if (!alive().length) {
      showReport({
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
      kicker: "Day " + pad(state.day) + " · Morning",
      title: "This morning",
      entries: entries,
      button: "Start day " + state.day,
      next: startDay,
    });
  }

  // The day begins: the player can plan again.
  function startDay() {
    state.phase = "day";
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
      found: state.recruited,
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
  // True if any pop-up is open (Esc only pauses when none is).
  function anyDialogOpen() {
    return document.querySelector("dialog[open]") !== null;
  }

  // Opens the pause menu, with the day and shelter name under "Paused".
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
  // The Pause button and the Esc key open the pause menu.
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
  // The door shuts behind the group as they settle in.
  AT.playSound("doorClose");
})();

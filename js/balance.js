(function balanceFile() {
  /*
=========================================================
FILE: balance.js
PROJECT: Another Tally - A zombie survival game
AUTHOR: Cygnus J. Wiebe
DATE: December 14th, 2026
COURSE: INFS 634 - McGill University
=========================================================
DESCRIPTION:
Every balance number in Another Tally lives in this one file: difficulty,
starting supplies, survivor upkeep, what each skill and trait does, facility
costs and effects, map locations, traders, the horde, events and mini-games.
game.js, minigames.js, new-game.js and how-to-play.html all read from
AT.BALANCE, so changing a number here changes it everywhere at once.

Story events (their costs and gains) stay in js/story.js next to their text.

How to tune:
  1. Open the game with ?debug on the end of the address (for example
     new-game.html?debug). The debug panel (press ` or click the DEBUG tag)
     lets you change any number below while you play. Changes apply at once
     and are kept until you reset them or turn debug off (?debug=off).
  2. When a change feels right, press "Copy balance.js" in the panel and
     paste over this file, or edit the number here by hand.
  3. "Download workbook" in the panel builds Another_Tally_Balance.xlsx from
     this file, with charts-ready tables and every playtest you've run in
     debug mode. Nothing in the workbook needs typing in.

Rules for this file (the debug panel reads its own source to keep these
comments when it writes a new copy, so please keep to them):
  - One setting per line where possible, with its note as a // comment on
    the same line, or on the lines just above it.
  - Numbers can be plain (12, 0.85, -3) or a simple fraction (1 / 6).
  - Don't move the header inside this function: the whole file is
    rebuilt from it.

Note: this file must load right after common.js (it adds to the AT object
common.js creates), and before any page script that uses it.
=========================================================
TABLE OF CONTENTS
Ctrl+F a tag such as "[B3]" to jump to that section.
=========================================================
[B1] Start of a run
[B2] Difficulty
[B3] Survivors: needs and upkeep
[B4] Tasks
[B5] Skills
[B6] Traits
[B7] Facilities
[B8] Scavenging and the map
[B9] Traders
[B10] The horde and night raids
[B11] Events, city events and the tally
[B12] Mini-games
[B13] Helpers (text templates, how-to-play numbers)
[B14] Debug mode and saved changes
=========================================================
*/
  "use strict";

  var BALANCE = {
    // #region [B1] Start of a run
    start: {
      // Supplies on day 1. Materials are higher than you might expect because nothing is built yet.
      // Shifted down a step after the Nov 2026 playtests (Easy was too easy):
      // Easy now starts like the old Normal, Normal like the old Hard, and Hard with less again.
      resources: {
        easy: { food: 10, water: 10, materials: 16, medicine: 2, ammo: 5 },
        normal: { food: 8, water: 8, materials: 13, medicine: 1, ammo: 3 },
        hard: { food: 6, water: 6, materials: 11, medicine: 1, ammo: 2 },
      },
      survivors: 3, // size of the starting group rolled on the New Game page
      // Starting survivors' stats: [min, max], rolled for each one.
      health: [60, 100],
      hunger: [20, 50],
      fatigue: [10, 50],
      morale: [50, 90],
      firstTraderStays: 2, // days the first trader (already there on day 1) stays
    },
    // #endregion [B1]

    // #region [B2] Difficulty
    // Shifted down a step after the Nov 2026 playtests: Easy is the old Normal,
    // Normal is the old Hard, and Hard goes a step past the old Hard. The
    // mini-games ([B12]) and autoWin were left as they were for each difficulty.
    // Old values, for going back: easy 0.95/9/18/10/0.1/10/1.0/[2,3],
    // normal 0.85/8/22/15/0.15/15/1.15/[3,4] (yield/threatBase/threatPeak/
    // starveDmg/scavRisk/moraleLoss/tradeMarkup/traderGap).
    difficulty: {
      easy: {
        yield: 0.85, // share of scavenged supplies you actually bring home
        threatBase: 8, // size of the horde on night 1
        threatPeak: 22, // how much the horde grows by the last night (x horde.lengthScale)
        starveDmg: 15, // health lost per dusk without enough water, or while starving
        scavRisk: 0.15, // chance per danger level that a scavenger gets hurt
        autoWin: 0.7, // chance an auto-resolved mini-game is won
        moraleLoss: 15, // morale lost by everyone when a survivor dies
        tradeMarkup: 1.15, // how much more value traders ask for than they give (1.15 = 15% extra)
        traderGap: [3, 4], // [min, max] days with no trader between visits
      },
      normal: {
        yield: 0.8, // share of scavenged supplies you actually bring home
        threatBase: 7, // size of the horde on night 1
        threatPeak: 23, // how much the horde grows by the last night (x horde.lengthScale)
        starveDmg: 20, // health lost per dusk without enough water, or while starving
        scavRisk: 0.2, // chance per danger level that a scavenger gets hurt
        autoWin: 0.55, // chance an auto-resolved mini-game is won
        moraleLoss: 20, // morale lost by everyone when a survivor dies
        tradeMarkup: 1.3, // how much more value traders ask for than they give (1.15 = 15% extra)
        traderGap: [4, 6], // [min, max] days with no trader between visits
      },
      hard: {
        yield: 0.75, // share of scavenged supplies you actually bring home
        threatBase: 8, // size of the horde on night 1
        threatPeak: 27, // how much the horde grows by the last night (x horde.lengthScale)
        starveDmg: 25, // health lost per dusk without enough water, or while starving
        scavRisk: 0.25, // chance per danger level that a scavenger gets hurt
        autoWin: 0.4, // chance an auto-resolved mini-game is won
        moraleLoss: 25, // morale lost by everyone when a survivor dies
        tradeMarkup: 1.45, // how much more value traders ask for than they give (1.15 = 15% extra)
        traderGap: [5, 7], // [min, max] days with no trader between visits
      },
    },
    // #endregion [B2]

    // #region [B3] Survivors: needs and upkeep
    survivors: {
      tired: 80, // fatigue at or above this: can't scavenge, guard or build
      wornOut: 60, // fatigue at or above this shows the "Worn out" warning
      injuredBelow: 60, // health under this: status is Injured (and morale wears faster)
      starvingAt: 80, // hunger at or above this: loses starveDmg health every dusk
      eats: 1, // food each survivor at the shelter eats at dusk
      drinks: 1, // water each survivor at the shelter drinks at dusk
      fed: 10, // hunger a full meal takes away
      unfed: 25, // hunger added when there's nothing at all to eat (short rations land in between)
      shortMorale: 5, // morale everyone loses on a night the food runs short
      // Wear and tear applied at dusk to everyone at the shelter.
      upkeep: {
        morale: 3, // morale lost each dusk (the days wear on)
        hungryAt: 60, // hunger at or above this costs hungryMorale more
        hungryMorale: 3, // extra morale lost while hungry
        hurtMorale: 2, // extra morale lost while injured
      },
      // Below this morale a survivor is shaken: they find `find` less when
      // scavenging and add `guard` less defense on Guard.
      shaken: { below: 30, find: 1, guard: 3 },
      joinMorale: 5, // morale everyone gains when a newcomer joins
      // Newcomers arrive worn down: [min, max] for each stat.
      newcomer: {
        health: [40, 80],
        hunger: [30, 60],
        fatigue: [30, 60],
        morale: [40, 70],
      },
    },
    // #endregion [B3]

    // #region [B4] Tasks
    tasks: {
      workFatigue: 10, // fatigue a day of Build, Guard, Cook or Heal adds
      tripFatigue: 20, // fatigue each day of a scavenging trip adds (before a Bike Rack)
      minTripFatigue: 5, // a trip day never costs less than this
      guardPower: 5, // night defense one guard adds (see Fighter and Night owl)
      minGuardPower: 1, // a guard who can fight never adds less than this (even when shaken)
      guardNightFatigue: 5, // extra fatigue each guard gains from the night watch
      heal: 10, // health one treatment on Heal restores (uses 1 medicine)
      medicinePerTreatment: 1, // medicine each treatment uses
      cookMorale: 4, // morale everyone at the shelter gets from a hot meal (anyone on Cook, if there's food for everyone)
      // Food spoils: each dusk this share of the food above `above` goes off (rounded down). A Root Cellar stops it.
      spoil: { above: 12, rate: 0.1 },
    },
    // #endregion [B4]

    // #region [B5] Skills
    // What each skill in common.js does. Players only see the descriptions there.
    // Skills not listed here (Entertainer, Calligraphy...) do nothing.
    skills: {
      Scavenger: { find: 2 }, // extra supplies on every scavenging trip
      Builder: { discount: 2 }, // materials off every upgrade while on Build
      Medic: { heal: 30, healNoMedicine: 10 }, // health one treatment restores, with and without medicine
      Fighter: { guard: 10 }, // night defense on Guard (instead of tasks.guardPower)
      Cook: { foodSave: 1 }, // the group eats this much less at dusk while they're on Cook
      Hunter: { food: 2 }, // extra food from every scavenging trip
      Mechanic: { salvage: 2 }, // materials salvaged each day on Build (plus the Workshop's salvage)
      Negotiator: { tradeDiscount: 0.25 }, // share knocked off what the trader asks
      Sharpshooter: { ammoMult: 2 }, // on Guard, ammo counts this many times toward defense
      Survivalist: { drinkEvery: 2 }, // only drinks water every this many days
    },
    // #endregion [B5]

    // #region [B6] Traits
    // What each trait in common.js does. Traits not listed here (Kind...) do nothing.
    // A skill's `guard` replaces tasks.guardPower; a trait's `guard` is added to it.
    traits: {
      "Night owl": { guard: 5 }, // extra night defense on Guard
      Optimist: { morningHeal: 5 }, // health recovered every morning
      Tough: { damage: 0.5 }, // share of damage taken (rounded up)
      Lucky: { rolls: 2 }, // rolls the haul this many times and keeps the best
      Loner: { find: 1 }, // extra supplies when they're the only one scavenging
      Extrovert: { find: 1 }, // extra supplies when someone else scavenges the same place
      "Quick healer": { restHeal: 10 }, // extra health when resting
      Hoarder: { materials: 1 }, // extra materials from every scavenging trip
      Motivational: { morale: 5 }, // morale the lowest-morale survivor gains each dusk
      Athletic: { fatigue: -5 }, // fatigue added to every task (per trip day, and the night watch)
      // Coward has no numbers: adds no defense on Guard, and is spared when someone gets hurt.
      "Big eater": { eats: 2 }, // food they eat at dusk (instead of survivors.eats)
      Forgetful: { chance: 1 / 6, lose: 2 }, // chance each dusk of misplacing supplies, and how many
      Clumsy: { find: -1 }, // fewer supplies from every scavenging trip
      Smoker: { chance: 1 / 6, horde: 3 }, // chance a coughing fit draws more of the horde, and how many
      Alcoholic: { chance: 1 / 6 }, // chance of staying out an extra day after a trip
      "Drug addict": { chance: 0.25, damage: [5, 10] }, // chance of a rough night, and the health it costs
      Argumentative: { chance: 0.25, morale: 10 }, // chance each dusk of a row, and the morale it costs
      Lazy: { fatigue: 5 }, // fatigue added to every task (per trip day, and the night watch)
      Splurger: { tradeMarkup: 1.15 }, // the trader asks this much more with a Splurger in the group
    },
    // #endregion [B6]

    // #region [B7] Facilities
    facilities: {
      // What the shelter has with nothing built. Upgrades add to these (see `gives`).
      base: {
        sleeps: 3, // beds for the group (newcomers need a free one)
        rest: 25, // fatigue a resting survivor recovers at dusk
        restMorale: 3, // morale a resting survivor gains at dusk
        restHeal: 5, // health a resting survivor recovers at dusk
        dailyMorale: 0, // morale everyone at the shelter gains each dusk
        food: 0, // food made every dusk (fractions build up over days)
        water: 0, // water made every dusk
        medicine: 0, // medicine made every dusk
        foodSave: 0, // the group eats this much less food at dusk
        discount: 0, // materials off every build
        fasterBy: 0, // days off every build
        salvage: 0, // extra materials a Mechanic on Build salvages
        scavFatigue: 0, // fatigue taken off every scavenging trip (per day of travel)
        ammoCraft: 0, // materials turned into ammo every dusk (1 for 1)
        keepFood: 0, // 1 or more: stored food doesn't spoil
        healBonus: 0, // extra health each treatment on Heal gives
        patients: 1, // people one survivor on Heal treats
        defense: 0, // night defense from walls
        guardBonus: 0, // extra defense per guard
        ammoCap: 10, // most ammo that counts toward night defense
        exactHorde: 0, // 1 or more: the Base tab shows tonight's exact horde
        sturdy: 0, // 1 or more: a breach can't damage the walls
      },
      // Room in the shelter: how many upgrades with that `space` fit.
      spaces: { roof: 2, yard: 3, basement: 2 },
      drySpellShare: 0.5, // rain-fed upgrades make this share of their water in a dry spell
      repairShare: 0.5, // a repair costs this share of the upgrade's cost (rounded up)
      repairDays: 1, // days a repair takes
      minCost: 1, // no upgrade ever costs less than this
      minDays: 1, // no upgrade ever takes less than this
      // Each upgrade: cost (materials), days (of work), gives (added to the base
      // above) and effect (the line on the card). In the effect, {name} is this
      // upgrade's `gives` value, {total.name} is base + gives, and {every.name}
      // is "every how many days" for fractions like 0.5 medicine.
      // Names, requirements and either/or pairs are in FACILITIES in game.js.
      upgrades: {
        // Beds
        cots: {
          cost: 3,
          days: 1,
          gives: { sleeps: 2, rest: 10 },
          effect: "Sleeps {sleeps} more. Rest recovers {rest} more fatigue.",
        },
        bunks: {
          cost: 4,
          days: 1,
          gives: { sleeps: 2 },
          effect: "Sleeps {sleeps} more.",
        },
        quiet: {
          cost: 5,
          days: 1,
          gives: { rest: 15, restMorale: 3 },
          effect:
            "Rest recovers {rest} more fatigue and {restMorale} more morale.",
        },
        common: {
          cost: 5,
          days: 1,
          gives: { dailyMorale: 2 },
          effect:
            "Everyone at the shelter gains {dailyMorale} morale each dusk.",
        },
        barracks: {
          cost: 6,
          days: 2,
          gives: { sleeps: 3 },
          effect: "Sleeps {sleeps} more.",
        },
        // Kitchen and garden
        campKitchen: {
          cost: 4,
          days: 1,
          gives: { food: 2 },
          effect: "+{food} food a day.",
        },
        vegBeds: {
          cost: 4,
          days: 1,
          gives: { food: 2 },
          effect: "+{food} food a day.",
        },
        greenhouse: {
          cost: 6,
          days: 2,
          gives: { food: 3 },
          effect: "+{food} food a day.",
        },
        smokehouse: {
          cost: 4,
          days: 1,
          gives: { food: 2 },
          effect: "+{food} food a day.",
        },
        rootCellar: {
          cost: 4,
          days: 1,
          gives: { foodSave: 1, keepFood: 1 },
          effect:
            "Food stops spoiling, and the group eats {foodSave} less at dusk.",
        },
        coop: {
          cost: 5,
          days: 1,
          gives: { food: 2, dailyMorale: 1 },
          effect:
            "+{food} food a day and {dailyMorale} morale for everyone each dusk.",
        },
        // Water supply
        barrels: {
          cost: 3,
          days: 1,
          gives: { water: 2 },
          effect: "+{water} water a day (less in a dry spell).",
        },
        catchment: {
          cost: 6,
          days: 2,
          gives: { water: 3 },
          effect: "+{water} water a day (less in a dry spell).",
        },
        well: {
          cost: 5,
          days: 2,
          gives: { water: 2 },
          effect: "+{water} water a day, even in a dry spell.",
        },
        filter: {
          cost: 3,
          days: 1,
          gives: { water: 1 },
          effect: "+{water} water a day, and no more bad water.",
        },
        cistern: {
          cost: 6,
          days: 2,
          gives: { water: 2 },
          effect: "+{water} water a day.",
        },
        // Workshop
        toolBench: {
          cost: 3,
          days: 1,
          gives: { discount: 1 },
          effect: "Builds cost {discount} less material.",
        },
        repairShop: {
          cost: 5,
          days: 1,
          gives: { discount: 1, salvage: 1 },
          effect:
            "Builds cost {discount} less again, and salvage goes further.",
        },
        bikeRack: {
          cost: 4,
          days: 1,
          gives: { scavFatigue: 5 },
          effect: "Scavenging trips cost {scavFatigue} less fatigue a day.",
        },
        fabShop: {
          cost: 8,
          days: 2,
          gives: { discount: 1, fasterBy: 1 },
          effect:
            "Builds cost {discount} less again and take {fasterBy} day less.",
        },
        armory: {
          cost: 6,
          days: 2,
          gives: { ammoCraft: 1 },
          effect:
            "Turns {ammoCraft} material into {ammoCraft} ammo every dusk.",
        },
        // Infirmary
        firstAid: {
          cost: 4,
          days: 1,
          gives: { restHeal: 5 },
          effect: "Resting survivors heal {restHeal} more health.",
        },
        sickBay: {
          cost: 6,
          days: 2,
          gives: { restHeal: 5, healBonus: 10 },
          effect:
            "Resting survivors heal {restHeal} more. Heal treats {healBonus} more.",
        },
        herbGarden: {
          cost: 4,
          days: 1,
          gives: { medicine: 0.5 },
          effect: "Makes 1 medicine every {every.medicine} days.",
        },
        fieldHospital: {
          cost: 8,
          days: 2,
          gives: { patients: 1, restHeal: 5 },
          effect:
            "Heal treats {total.patients} people. Resting heals {restHeal} more.",
        },
        apothecary: {
          cost: 6,
          days: 2,
          gives: { medicine: 0.5, healBonus: 5 },
          effect:
            "1 more medicine every {every.medicine} days. Heal treats {healBonus} more.",
        },
        // Walls and watch
        barricades: {
          cost: 4,
          days: 1,
          gives: { defense: 10 },
          effect: "+{defense} night defense.",
        },
        palisade: {
          cost: 6,
          days: 2,
          gives: { defense: 10 },
          effect: "+{defense} night defense.",
        },
        lookout: {
          cost: 3,
          days: 1,
          gives: { exactHorde: 1, guardBonus: 2 },
          effect:
            "Shows the exact horde size. Each guard adds {guardBonus} more.",
        },
        spikePit: {
          cost: 4,
          days: 1,
          gives: { defense: 6 },
          effect: "+{defense} night defense.",
        },
        fortified: {
          cost: 9,
          days: 2,
          gives: { defense: 10, sturdy: 1 },
          effect:
            "+{defense} night defense, and breaches can't damage the walls.",
        },
        gunNests: {
          cost: 7,
          days: 2,
          gives: { guardBonus: 4, ammoCap: 5 },
          effect:
            "Each guard adds {guardBonus} more. Up to {total.ammoCap} ammo counts.",
        },
      },
    },
    // #endregion [B7]

    // #region [B8] Scavenging and the map
    scavenging: {
      roll: [1, 4], // supplies a trip finds before anything else: [min, max]
      perDanger: 1, // extra supplies for each danger level above 1
      extraPerTripDay: 2, // extra supplies for each extra day of a long trip
      injuryPerDanger: 10, // health a scavenger loses when attacked, x the danger
      revisitLoss: 0.1, // each earlier visit to a place leaves this share less behind
      revisitFloor: 0.5, // ...but a haul never drops below this share of a fresh one
      // Each location: danger (1 to 3: more supplies, more risk), travel (days
      // a trip takes), size (added to every haul) and people (chance of meeting
      // someone who wants to join). Names, places on the map and loot are in
      // LOCATIONS in game.js.
      locations: {
        hospital: { danger: 2, travel: 1, size: 0, people: 0.15 },
        police: { danger: 3, travel: 1, size: 0, people: 0.1 },
        pharmacy: { danger: 2, travel: 1, size: -1, people: 0.1 },
        church: { danger: 1, travel: 1, size: -1, people: 0.3 },
        supermarket: { danger: 2, travel: 1, size: 0, people: 0.12 },
        hardware: { danger: 2, travel: 1, size: 0, people: 0.08 },
        sporting: { danger: 2, travel: 1, size: -1, people: 0.08 },
        waterworks: { danger: 2, travel: 2, size: 0, people: 0.1 },
        gas: { danger: 1, travel: 1, size: 0, people: 0.08 },
        farm: { danger: 1, travel: 2, size: 0, people: 0.25 },
        suburb: { danger: 1, travel: 1, size: 0, people: 0.2 },
        school: { danger: 1, travel: 1, size: 0, people: 0.2 },
        warehouse: { danger: 2, travel: 1, size: 1, people: 0.1 },
        military: { danger: 3, travel: 2, size: 0, people: 0.15 },
      },
      // Cutting through the Military checkpoint fence from the Map tab:
      // cheaper when a Builder or Mechanic is at the shelter.
      fenceCut: { cost: 8, skilledCost: 4 },
    },
    // #endregion [B8]

    // #region [B9] Traders
    trade: {
      // What each resource is worth when trading.
      value: { food: 2, water: 2, materials: 1, medicine: 4, ammo: 3 },
      wantBonus: 1.5, // traders pay this many times the value for what they want
      stockSpread: 1, // each trader's stock varies by up to this much either way
      // The trade bar's colour: under closeShare of what they need is deep red
      // (won't accept), under it is red (almost), from greatShare up is deep
      // green (a really good deal for them), green in between (accepts).
      closeShare: 0.8,
      greatShare: 1.25,
      // Each trader: stock (what they arrive with) and stays ([min, max] days).
      // Names and what they want are in TRADERS in game.js.
      traders: {
        marguerite: {
          stock: { food: 5, water: 5, materials: 6, medicine: 2, ammo: 0 },
          stays: [2, 3],
        },
        rook: {
          stock: { food: 0, water: 0, materials: 4, medicine: 1, ammo: 8 },
          stays: [2, 2],
        },
        ines: {
          stock: { food: 2, water: 4, materials: 0, medicine: 6, ammo: 0 },
          stays: [2, 3],
        },
        abe: {
          stock: { food: 9, water: 7, materials: 2, medicine: 0, ammo: 0 },
          stays: [2, 3],
        },
      },
    },
    // #endregion [B9]

    // #region [B10] The horde and night raids
    horde: {
      // How much bigger the last night's horde is on longer runs (threatPeak x this).
      lengthScale: { 15: 1, 30: 1.15, 45: 1.3 },
      crowdFrom: 3, // the horde grows for every survivor at the shelter beyond this many
      perSurvivor: 1, // ...by this much each
      roll: 3, // tonight's real horde is the estimate plus or minus up to this
      ammoPerGuard: 1, // ammo each guard who can fight fires in a night
      // A breach: damage = base + perPoint x (horde - defense), capped at max.
      breach: {
        base: 5,
        perPoint: 2,
        max: 50,
        twoHurtAt: 15, // a breach this big or bigger hurts 2 people instead of 1
        wallDamageAt: 15, // a breach this big or bigger damages the newest wall upgrade
      },
    },
    // #endregion [B10]

    // #region [B11] Events, city events and the tally
    events: {
      morningChance: 0.3, // chance (0 to 1) of a morning event before a day starts (never day 1)
      minigameLossDamage: 30, // health one survivor loses when an event's mini-game is lost
      // City events (story.js [S4b]). From day 2, each dawn has `chance` of
      // starting one while fewer than `maxActive` are going on. The same one
      // won't come back for `cooldown` days after it ends.
      city: { chance: 0.4, maxActive: 2, cooldown: 5 },
      // Supplies that event choices with `reward` bring in (story.js). A pair
      // [min, max] rolls between them. Lockpick crates use the Lockpick reward
      // in mini-games, and rain also adds what your water supply makes.
      rewards: {
        pantry: { food: [2, 4], water: [1, 2] },
        soldier: { ammo: [2, 4], medicine: [0, 1] },
        rats: { food: 2 },
        rain: { water: 2 },
        raiders: { ammo: 2 },
        cart: { materials: [3, 4] },
        scrap: { materials: [1, 2] },
        deer: { food: [3, 5] },
        tracks: { food: [1, 2] },
      },
    },
    // Morale everyone gets from the dawn tally. A clean mark steadies the
    // group; every fifth mark (the slash) more so. A crooked mark shakes them.
    tally: { clean: 2, fifth: 4, crooked: -3 },
    // #endregion [B11]

    // #region [B12] Mini-games
    // Numbers by difficulty are { easy, normal, hard }.
    minigames: {
      defense: {
        seconds: 30, // length of the round
        zombies: { easy: 15, normal: 25, hard: 50 }, // zombies to clear
        crossMs: { easy: 4750, normal: 3000, hard: 2400 }, // ms a zombie takes to reach the wall
        spawnMs: { easy: 800, normal: 700, hard: 500 }, // ms between zombies (varies a little)
        hitDamage: { easy: 25, normal: 35, hard: 45 }, // wall lost when a zombie reaches it
        missJamMs: { easy: 200, normal: 300, hard: 400 }, // ms the gun jams after a miss
        missDamage: { easy: 0, normal: 5, hard: 10 }, // wall lost on a miss
        laneKeys: false, // true: keys 1-4 shoot the closest zombie in a lane (playtesters preferred mouse only)
        shoutChance: 0.2, // chance a zombie shouts as it comes out
        shoutVolume: 0.35, // how loud those shouts are (1 = full)
        wallStart: 40, // wall strength with no walls built
        wallPerLevel: 30, // extra wall strength per wall level
        defensePerLevel: 10, // night defense from walls that counts as one wall level
        maxLevel: 3, // highest wall level
        wallMax: 100, // the most wall strength there can be
      },
      lockpick: {
        pins: { easy: 4, normal: 5, hard: 6 },
        seconds: { easy: 25, normal: 20, hard: 18 },
        firstReward: [2, 3], // a win gives this much of one supply...
        secondReward: [1, 2], // ...and this much of another
      },
      search: {
        seconds: 30,
        hidden: 5, // supplies hidden in the room
        need: { easy: 2, normal: 3, hard: 3 }, // finds needed to win
        searches: { easy: 10, normal: 8, hard: 7 }, // searches you get
        zombies: { easy: 1, normal: 2, hard: 3 }, // zombies hiding in the room
        biteDamage: { easy: 10, normal: 15, hard: 20 }, // health lost per bite
        biteSearchCost: 1, // extra searches lost fighting a zombie off
        perFind: [1, 2], // supplies each find is worth
        autoWin: [3, 4], // finds when auto-resolved and won
        autoLose: [0, 2], // finds when auto-resolved and lost
      },
      tally: {
        seconds: 8,
        tries: 3,
        zone: { easy: 0.22, normal: 0.16, hard: 0.11 }, // width of the target (share of the bar)
        fifthZone: 0.75, // every fifth mark's target is this share of the normal width
        period: { easy: 1500, normal: 1200, hard: 950 }, // ms for one sweep of the blade there and back
        fifthPeriod: 0.85, // every fifth mark's blade sweeps this share of the normal time
        // The blade starts slow and speeds up over the run: period is multiplied
        // by rampStart on the first dawn, sliding to rampEnd by the last.
        rampStart: 1.6,
        rampEnd: 0.9,
      },
    },
    // #endregion [B12]
  };

  // #region [B13] Helpers (text templates, how-to-play numbers)
  // Fills an effect template from BALANCE.facilities.upgrades with numbers:
  //   {rest}          this upgrade's gives.rest
  //   {total.ammoCap} the base value plus this upgrade's (10 + 5 = 15)
  //   {every.medicine} days per whole unit (0.5 a day = every 2 days)
  //   {base.rest}     the base value alone (used by the "without it" lines)
  function fillText(template, gives) {
    var base = BALANCE.facilities.base;
    gives = gives || {};
    return String(template || "").replace(
      /\{(?:(base|total|every)\.)?(\w+)\}/g,
      function (all, kind, key) {
        var own = gives[key] || 0;
        if (kind === "base") return num(base[key] || 0);
        if (kind === "total") return num((base[key] || 0) + own);
        if (kind === "every") return own ? num(1 / own) : "?";
        return num(own);
      },
    );
  }
  // Rounds a number for display (0.30000000000000004 becomes 0.3).
  function num(n) {
    return String(Math.round(n * 100) / 100);
  }
  // The effect line of an upgrade, by id.
  function effect(id) {
    var u = BALANCE.facilities.upgrades[id];
    return u ? fillText(u.effect, u.gives) : "";
  }
  // Picks the value for a difficulty from { easy, normal, hard }.
  function byDifficulty(table, difficulty) {
    return table[difficulty] !== undefined ? table[difficulty] : table.normal;
  }
  // A whole number between a [min, max] pair, using the run's rng.
  function roll(pair, rng) {
    if (!Array.isArray(pair)) return pair;
    return pair[0] + Math.floor(rng() * (pair[1] - pair[0] + 1));
  }
  // Reads a value by path, e.g. get("difficulty.normal.yield") or
  // get(["traits", "Night owl", "guard"]).
  function get(path) {
    var parts = Array.isArray(path) ? path : String(path).split(".");
    return parts.reduce(function (o, k) {
      return o == null ? undefined : o[k];
    }, BALANCE);
  }
  // Fills in numbers on a page (used by how-to-play.html):
  //   <span data-bal="tasks.heal">10</span>          a value
  //   <span data-bal="difficulty.easy.scavRisk" data-bal-as="pct">10%</span>
  //   <td data-bal-effect="cots">...</td>            an upgrade's effect line
  //   <td data-bal-cost="cots">...</td>              "3 materials, 1 day"
  // data-bal-as can also be: pctOver (1.15 shows 15%), days (2 shows
  // "2 days"), danger (2 shows Medium) and total (an upgrade's gives plus
  // the base: gunNests.gives.ammoCap shows 15).
  // The text already in the page stays if a path is wrong.
  function fillPage(root) {
    root = root || document;
    root.querySelectorAll("[data-bal]").forEach(function (el) {
      var v = get(el.getAttribute("data-bal"));
      if (typeof v !== "number") return;
      var as = el.getAttribute("data-bal-as");
      if (as === "pct") el.textContent = num(v * 100) + "%";
      else if (as === "pctOver") el.textContent = num((v - 1) * 100) + "%";
      else if (as === "days")
        el.textContent = num(v) + (v === 1 ? " day" : " days");
      else if (as === "danger")
        el.textContent = ["", "Low", "Medium", "High"][v] || num(v);
      else if (as === "total") {
        var key = el.getAttribute("data-bal").split(".").pop();
        el.textContent = num((BALANCE.facilities.base[key] || 0) + v);
      } else el.textContent = num(v);
    });
    root.querySelectorAll("[data-bal-effect]").forEach(function (el) {
      var text = effect(el.getAttribute("data-bal-effect"));
      if (text) el.textContent = text;
    });
    root.querySelectorAll("[data-bal-cost]").forEach(function (el) {
      var u = BALANCE.facilities.upgrades[el.getAttribute("data-bal-cost")];
      if (!u) return;
      el.textContent =
        u.cost +
        " material" +
        (u.cost === 1 ? "" : "s") +
        ", " +
        u.days +
        " day" +
        (u.days === 1 ? "" : "s");
    });
  }
  // #endregion [B13]

  // #region [B14] Debug mode and saved changes
  // ?debug on any page turns debug mode on for this browser tab (it carries on
  // from page to page); ?debug=off turns it off. While it's on, changes made
  // in the debug panel are saved in localStorage and put back on every page.
  var DEBUG_KEY = "anotherTally.debug";
  var CHANGES_KEY = "anotherTally.balanceChanges";
  function storage(kind) {
    try {
      return window[kind];
    } catch (e) {
      return null;
    }
  }
  var session = storage("sessionStorage");
  var local = storage("localStorage");
  var flag = /[?&]debug(?:=([^&#]*))?/.exec(window.location.search);
  if (flag && session) {
    if (flag[1] === "off" || flag[1] === "0") session.removeItem(DEBUG_KEY);
    else session.setItem(DEBUG_KEY, "1");
  }
  var debugOn = Boolean(session && session.getItem(DEBUG_KEY) === "1");

  // A copy of every value as this file has it, before any debug changes.
  var FILE_VALUES = JSON.parse(JSON.stringify(BALANCE));

  // Saved changes: a list of [path, value], e.g. [["tally", "clean"], 3].
  // Paths starting with "story" change js/story.js values (applied by debug.js).
  function savedChanges() {
    try {
      return JSON.parse((local && local.getItem(CHANGES_KEY)) || "[]");
    } catch (e) {
      return [];
    }
  }
  // Sets a value by path, but only where the path already exists.
  function setPath(rootObj, path, value) {
    var parent = rootObj;
    for (var i = 0; i < path.length - 1; i++) {
      parent = parent && parent[path[i]];
    }
    if (!parent || !(path[path.length - 1] in parent)) return false;
    parent[path[path.length - 1]] = value;
    return true;
  }
  if (debugOn) {
    savedChanges().forEach(function (c) {
      if (c[0][0] !== "story") setPath(BALANCE, c[0], c[1]);
    });
  }
  // #endregion [B14]

  var AT = (window.AT = window.AT || {});
  AT.BALANCE = BALANCE;
  AT.balance = {
    effect: effect,
    fillText: fillText,
    fillPage: fillPage,
    byDifficulty: byDifficulty,
    roll: roll,
    get: get,
    setPath: setPath,
    fileValues: FILE_VALUES,
    savedChanges: savedChanges,
    changesKey: CHANGES_KEY,
    debugKey: DEBUG_KEY,
    // This file's own text, so the debug panel can write a new copy of it
    // with your changes and every comment kept.
    source: "(" + balanceFile.toString() + ")();\n",
  };
  AT.debug = debugOn;
  // how-to-play.html (and any page with data-bal numbers) fills itself in.
  if (typeof document !== "undefined" && document.querySelector) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", function () {
        fillPage(document);
      });
    else fillPage(document);
  }
})();

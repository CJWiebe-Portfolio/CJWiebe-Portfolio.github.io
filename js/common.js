/*
=========================================================
FILE: common.js
PROJECT: Another Tally - A zombie survival game
AUTHOR: Cygnus J. Wiebe
DATE: December 14th, 2026
COURSE: INFS 634 - McGill University
=========================================================
DESCRIPTION:
This is the common JavaScript file for Another Tally, a zombie survival game. 
It contains shared code that is loaded in the <head> of every page. 
The settings (options page) are stored in localStorage, 
while the run is handed between pages through sessionStorage. 
The code includes functions for loading, saving, and resetting settings, 
as well as applying display settings to the HTML document. 
It also includes a seeded random number generator and utility functions 
for escaping HTML and managing survivor skills and traits.
=========================================================
*/

/* 
=============================================================== 
---------- Game Settings ----------
=============================================================== 
*/

(function () {
  "use strict";

  //Creates the variables for the localStorage and sessionStorage
  var SETTINGS_KEY = "anotherTally.settings";
  var SETUP_KEY = "anotherTally.setup";
  var RESULT_KEY = "anotherTally.result";

  //This is the default (settings) variable of the game, also used for resetting
  var DEFAULTS = {
    difficulty: "normal", // easy | normal | hard
    length: 15, // 15 | 30 | 45 days
    minigames: "play", // play | auto
    seed: "",
    textSize: "medium", // small | medium | large
    textSpeed: 50, // 0–100
    highContrast: false,
    reduceMotion: false,
    sound: true,
    volume: 70, // 0–100
  };

  // This function loads the game settings from localStorage or returns the default settings
  function load() {
    var saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    } catch (e) {
      // storage blocked
    }
    return Object.assign({}, DEFAULTS, saved);
  }

  // This function saves the game settings to localStorage and applies them
  function save(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      // storage blocked
    }
    apply(settings);
  }

  // This function resets the game settings to their defaults
  function reset() {
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch (e) {
      // storage blocked
    }
    apply(DEFAULTS);
    return Object.assign({}, DEFAULTS);
  }

  /* 
=============================================================== 
---------- Display Settings for Adaptive Features ----------
=============================================================== 
*/

  // The display settings become data-attributes on when they are on html
  // and then the style.css can react to them.
  function apply(s) {
    var root = document.documentElement;
    root.dataset.textSize = s.textSize;
    root.dataset.contrast = s.highContrast ? "high" : "normal";
    root.dataset.motion = s.reduceMotion ? "reduce" : "full";
    syncMusic(s);
    syncAmbience(s);
  }

  // These functions manage sessionStorage for handing off the game setup
  // and result between pages.
  function put(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // storage blocked
    }
  }
  function read(key, remove) {
    try {
      var raw = sessionStorage.getItem(key);
      if (remove) sessionStorage.removeItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /* 
=============================================================== 
---------- Game Seed Generator ----------
=============================================================== 
*/

  // This implements the seeded random number generator (Options > Seed).
  // When a seed is provided, it generates a reproducible sequence of random numbers.
  // When no seed is provided, it uses the default Math.random function.
  function makeRng(seed) {
    if (!seed) return Math.random;
    var a = 0;
    String(seed)
      .split("")
      .forEach(function (c) {
        a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0;
      });
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // This function escapes HTML special characters to prevent XSS attacks
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  /* 
=============================================================== 
---------- Game Attributes ----------
=============================================================== 
*/

  // Survivor skills and traits in a dictionary where names are attached to their effects
  // in the game. The new-game.js will randomly pick from these,
  // game.js applies them, and how-to-play.html also lists them.
  var SKILLS = {
    Scavenger: "Brings back 2 extra supplies when scavenging.",
    Builder: "Upgrades cost 2 fewer materials while they are on Build.",
    Medic: "On Heal, restores 30 health instead of 10.",
    Fighter: "Adds 10 night defense on Guard instead of 5.",
    Cook: "On Cook, the group eats 1 less food at dusk.",
    Hunter: "Also brings back 2 food when scavenging.",
    Mechanic: "On Build, salvages 2 materials each day.",
    Negotiator: "The trader accepts offers worth 25% less.",
    Sharpshooter: "On Guard, ammo counts double toward night defense.",
  };
  var TRAITS = {
    "Night owl": "Adds 5 extra night defense on Guard.",
    Optimist: "Recovers 5 health every morning.",
    Coward: "Never the one injured, but adds no defense on Guard.",
    Tough: "Takes half damage when injured.",
    Lucky: "Rolls twice when scavenging and keeps the better haul.",
    Loner: "Brings back 1 extra supply when scavenging alone.",
    "Big eater": "Eats 2 food at dusk instead of 1.",
    Clumsy: "Brings back 1 less supply when scavenging.",
    "Quick healer": "Recovers 10 health when resting.",
    Hoarder: "Also brings back 1 material when scavenging.",
  };

  /*
===============================================================
---------- Background Music ----------
===============================================================
*/

  // One looping track that carries across every page. Each page is a new
  // document, so the current position is saved in sessionStorage when the
  // page is left and picked up again on the next page.
  var MUSIC_SRC =
    "assets/audio/636147__emilybbarrios__zombie-eating-a-carcus.mp3";
  var MUSIC_TIME_KEY = "anotherTally.musicTime";
  // Pages opened from the pause menu (new tab) stay silent so the music doesn't double up.
  var musicAllowed =
    new URLSearchParams(location.search).get("from") !== "game";
  var music = null;

  if (musicAllowed) {
    music = new Audio(MUSIC_SRC);
    music.loop = true;
    music.preload = "auto";

    // Resume from where the last page left off.
    music.addEventListener(
      "loadedmetadata",
      function () {
        try {
          var t = Number(sessionStorage.getItem(MUSIC_TIME_KEY));
          if (t > 0 && t < music.duration) music.currentTime = t;
        } catch (e) {
          // storage blocked
        }
      },
      { once: true },
    );

    // Save the position when leaving the page.
    window.addEventListener("pagehide", function () {
      try {
        sessionStorage.setItem(MUSIC_TIME_KEY, String(music.currentTime));
      } catch (e) {
        // storage blocked
      }
    });
  }

  // Applies the Sound and Volume settings, and starts the music if it's allowed.
  function syncMusic(s) {
    if (!music) return;
    music.volume = Math.min(1, Math.max(0, Number(s.volume) / 100));
    if (!s.sound) {
      music.pause();
      return;
    }
    if (music.paused) music.play().catch(waitForInteraction);
  }

  // Browsers block sound until the player clicks or presses a key on the page.
  function waitForInteraction() {
    document.addEventListener("pointerdown", resumeAudio, { once: true });
    document.addEventListener("keydown", resumeAudio, { once: true });
  }
  function resumeAudio() {
    var s = load();
    syncMusic(s);
    syncAmbience(s);
  }

  /*
===============================================================
---------- Ambience ----------
===============================================================
*/

  // One looping background track at a time (morning, day, evening, night),
  // layered on top of the music. Changing it fades the old track out and the
  // new one in. game.js picks the track with AT.setAmbience("ambDay").
  // extras (optional) = { sounds: [names], every: [min, max] seconds }: one-off
  // sounds layered over the loop at random moments, like a distant groan.
  var AMBIENCE_FADE_MS = 1500;
  var amb = { name: null, el: null, extrasTimer: null };

  function setAmbience(name, extras) {
    if (amb.name === (name || null)) return;
    clearTimeout(amb.extrasTimer);
    if (amb.el) {
      var old = amb.el;
      fadeTo(old, 0, AMBIENCE_FADE_MS, function () {
        old.pause();
      });
    }
    amb.name = name || null;
    amb.el = null;
    if (!name) return;
    amb.el = new Audio(pickSrc(name));
    amb.el.loop = true;
    amb.el.volume = 0;
    syncAmbience(load());
    if (extras) scheduleExtra(extras);
  }

  // Applies the Sound and Volume settings to the ambience track.
  function syncAmbience(s) {
    if (!amb.el) return;
    if (!s.sound) {
      amb.el.pause();
      return;
    }
    fadeTo(amb.el, volumeFor(amb.name, s), AMBIENCE_FADE_MS);
    if (amb.el.paused) amb.el.play().catch(waitForInteraction);
  }

  // Plays one of the extras after a random wait, then queues the next one.
  function scheduleExtra(extras) {
    var min = extras.every[0],
      max = extras.every[1];
    amb.extrasTimer = setTimeout(
      function () {
        var list = extras.sounds;
        playSound(list[Math.floor(Math.random() * list.length)]);
        scheduleExtra(extras);
      },
      (min + Math.random() * (max - min)) * 1000,
    );
  }

  // Slides a sound's volume to target over ms milliseconds, then calls done.
  function fadeTo(a, target, ms, done) {
    clearInterval(a.fadeTimer);
    var start = a.volume,
      t0 = Date.now();
    a.fadeTimer = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / ms);
      a.volume = clamp(start + (target - start) * k);
      if (k === 1) {
        clearInterval(a.fadeTimer);
        if (done) done();
      }
    }, 50);
  }

  function clamp(v) {
    return Math.min(1, Math.max(0, v));
  }

  /*
===============================================================
---------- Game Logistics ----------
=============================================================== 
*/

  // Expose the public API for the game settings and attributes
  window.AT = {
    DEFAULTS: DEFAULTS,
    SKILLS: SKILLS,
    TRAITS: TRAITS,
    load: load,
    save: save,
    reset: reset,
    apply: apply,
    makeRng: makeRng,
    escapeHtml: escapeHtml,
    handoff: {
      setSetup: function (v) {
        put(SETUP_KEY, v);
      },
      takeSetup: function () {
        return read(SETUP_KEY, true);
      },
      setResult: function (v) {
        put(RESULT_KEY, v);
      },
      peekResult: function () {
        return read(RESULT_KEY, false);
      },
    },
  };

  apply(load());

  // Options changed in another tab (e.g. opened from the pause menu): apply here too.
  window.addEventListener("storage", function (e) {
    if (e.key === SETTINGS_KEY) apply(load());
  });

  // Pages opened from the pause menu run in a new tab: say so, so the player returns to the run.
  document.addEventListener("DOMContentLoaded", function () {
    if (new URLSearchParams(location.search).get("from") !== "game") return;
    var main = document.querySelector("main");
    if (!main) return;
    var note = document.createElement("p");
    note.className = "notice";
    note.textContent =
      "Opened from your paused game. Your run is still in the other tab; close this tab to return to it.";
    main.prepend(note);
  });

  // The Back and Done buttons will close the tab if it was opened from the game,
  // otherwise go back in history, otherwise follow the link (to the title screen).
  document.addEventListener("click", function (e) {
    var link = e.target.closest("[data-back]");
    if (!link) return;
    if (new URLSearchParams(location.search).get("from") === "game") {
      e.preventDefault();
      window.close();
      return;
    }
    var sameSite =
      document.referrer &&
      new URL(document.referrer).origin === location.origin;
    if (sameSite && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });

  /*
  ===============================================================
  ---------- Sound Effects ----------
  ===============================================================
  Every button plays the click. A button can play a different sound by
  naming it in a data-sound attribute, e.g. <button data-sound="gunshot">,
  and data-sound="none" makes it silent. Code can also play a sound with
  AT.playSound("horde"), or stack several at once with AT.playSounds().

  A name can list more than one file. One is picked at random each time,
  so sounds that repeat (gunshots, groans, footsteps) don't all sound the same.
  */

  var A = "assets/audio/";

  // Sound name → file, or a list of files to pick from. Add a line here for each new sound.
  var SOUNDS = {
    // ---- Menus and buttons ----
    click: A + "click.mp3",
    menu: A + "menu_select.mp3",
    turnPage: A + "paper(next-page).mp3",

    // ---- Weapons ----
    gunshot: A + "pistol_shot.mp3",
    cock: A + "gun_cocking.mp3",
    guardReady: [
      A + "gun_cocking.mp3",
      A + "weapon_cocking.mp3",
      A + "weapon_cocking2.mp3",
      A + "weapon_adjustment.mp3",
    ],
    gunJam: A + "weapon_bolt.mp3",
    reload: A + "weapon_reloading.mp3",
    swing: [
      A + "wooshing_weapon.mp3",
      A + "wooshing_weapon2.mp3",
      A + "wooshing_weapon3.mp3",
    ],

    // ---- Zombies ----
    zombie: A + "zombie_individual.mp3",
    horde: A + "zombie_horde.mp3",
    hordeClose: A + "zombie_horde(closeup).mp3",
    zombieGroan: [
      A + "zombie_male.mp3",
      A + "zombie_male(call).mp3",
      A + "zombie_individual.mp3",
    ],
    zombieShout: [
      A + "zombie_male(shout).mp3",
      A + "zombie_male(call).mp3",
      A + "zombie_male(screams).mp3",
      A + "zombie_female(screams).mp3",
      A + "zombie_individual.mp3",
    ],
    zombieScream: [
      A + "zombie_male(screams).mp3",
      A + "zombie_female(screams).mp3",
    ],
    zombieAttack: A + "213509__soykevin__zombie-attack.wav",
    zombieDying: A + "zombie_dying.mp3",

    // ---- Doors ----
    doorOpen: A + "door_opening.mp3",
    doorClose: A + "door_closing.mp3",
    knock: A + "door_knock.wav",
    knockSoft: A + "door_knocking(soft).mp3",
    knockHard: A + "door_knocking(intense).mp3",
    rustyDoor: A + "rusty_door.mp3",
    rustyHinges: A + "rusty_hindges.mp3",

    // ---- Searching ----
    searchBooks: A + "searching_books.mp3",
    searchDesk: A + "searching_desk.mp3",
    searchToolbox: A + "searching_toolbox.mp3",
    drawer: A + "opening_kitchen_drawer.mp3",
    cabinet: A + "rusty_cabinet.mp3",
    rummage: [
      A + "searching_books.mp3",
      A + "searching_desk.mp3",
      A + "searching_toolbox.mp3",
      A + "opening_kitchen_drawer.mp3",
      A + "rusty_cabinet.mp3",
    ],

    // ---- Building and materials ----
    buildingHammering: A + "building(hammering).mp3",
    woodCutting: A + "wood_cutting.mp3",
    woodSplitting: A + "wood_splitting.mp3",
    rustyMetal: A + "rusty_metalmp3.mp3",
    shovel: A + "shovel_digging.mp3",
    cardboardBox: A + "cardboard_box.mp3",
    rubbish: A + "rubbish_pile.mp3",

    // ---- Around the shelter ----
    lightSwitch: A + "light_switch.mp3",
    match: A + "lighting_a_match.mp3",
    stove: A + "turning_on_stove.mp3",
    fridge: A + "old_fridge.mp3",
    pourWater: A + "water_into_glass.mp3",
    openJar: A + "opening_jar.mp3",
    closeJar: A + "closing_jar.mp3",
    pillCap: A + "plastic_cap_opening.mp3",
    canOpen: A + "soda_can_opening.mp3",
    canJiggle: A + "soda_can_jiggle.mp3",
    canDrop: A + "soda_can_falling.mp3",
    glassBreak: A + "small_glass_shattering.mp3",

    // ---- Footsteps ----
    footsteps: A + "footprints_across_a_room.mp3",
    carefulWalking: A + "careful_walking.mp3",
    glassSteps: A + "footsteps_on_glass.mp3",

    // ---- Traders ----
    shopBell: A + "shop_door_bell(trader).mp3",
    helloWoman: A + "hello(women).mp3",

    // ---- Ambience (looped with AT.setAmbience, see the Ambience section) ----
    ambMorning: A + "morning(ambiance).mp3",
    rooster: A + "morning(rooster).mp3",
    ambDay: A + "day(ambiance).mp3",
    ambDayExtra: A + "day(occational-ambiance).mp3",
    ambEvening: [A + "evening(ambiance).mp3", A + "evening(ambiance2).mp3"],
    ambNight: A + "night(ombiance).mp3",
  };

  // How loud each sound plays compared to the Volume setting (1 = full volume).
  // Anything not listed plays at 1. Turn these up or down to balance the mix.
  var SOUND_VOLUME = {
    ambMorning: 0.5,
    ambDay: 0.5,
    ambEvening: 0.5,
    ambNight: 0.5,
    ambDayExtra: 0.6,
    rooster: 0.8,
    zombieGroan: 0.6,
    horde: 0.8,
    hordeClose: 0.7,
  };

  // The ambience tracks are long, so they only load when they are played.
  var NO_PRELOAD = ["ambMorning", "ambDay", "ambDayExtra", "ambEvening", "ambNight"];

  // Picks the file for a name (a random one if the name lists several).
  function pickSrc(name) {
    var src = SOUNDS[name];
    if (Array.isArray(src)) src = src[Math.floor(Math.random() * src.length)];
    return src;
  }

  // The Volume setting times the sound's own level from SOUND_VOLUME.
  function volumeFor(name, s) {
    var own = name in SOUND_VOLUME ? SOUND_VOLUME[name] : 1;
    return clamp((Number(s.volume) / 100) * own);
  }

  // Each file is loaded once and then copied for every play.
  var loadedSounds = {};
  function loadFile(src) {
    if (!loadedSounds[src]) {
      loadedSounds[src] = new Audio(src);
      loadedSounds[src].preload = "auto";
    }
    return loadedSounds[src];
  }

  // Loads sounds ahead of time so the first play isn't delayed.
  // With no list, it loads every sound except the long ambience tracks.
  function preloadSounds(names) {
    (
      names ||
      Object.keys(SOUNDS).filter(function (n) {
        return NO_PRELOAD.indexOf(n) === -1;
      })
    ).forEach(function (name) {
      [].concat(SOUNDS[name] || []).forEach(loadFile);
    });
  }

  // Plays a sound by name, using the Sound and Volume settings from the Options page.
  // opts (all optional):
  //   delay:  wait this many milliseconds first (to stagger stacked sounds)
  //   volume: extra level for this one play (1 = normal, 0.5 = half)
  //   loop:   keep repeating until AT.stopSound() is called (not with delay)
  //   gap:    skip it if the same sound started less than this many ms ago,
  //           so fast repeats (like zombies hitting the wall) don't pile up
  // Returns the playing copy so it can be stopped, or null.
  var lastPlayed = {};
  function playSound(name, opts) {
    opts = opts || {};
    if (opts.delay) {
      setTimeout(function () {
        playSound(name, { volume: opts.volume, gap: opts.gap });
      }, opts.delay);
      return null;
    }
    var s = load();
    if (!s.sound || !SOUNDS[name]) return null;
    var now = Date.now();
    if (opts.gap && now - (lastPlayed[name] || 0) < opts.gap) return null;
    lastPlayed[name] = now;
    // A copy lets the same sound overlap itself (e.g. two quick shots).
    var a = loadFile(pickSrc(name)).cloneNode();
    a.volume = clamp(
      volumeFor(name, s) * (opts.volume == null ? 1 : opts.volume),
    );
    a.loop = Boolean(opts.loop);
    a.play().catch(function () {});
    return a;
  }

  // Plays several sounds stacked on top of each other. Each item is a name,
  // or [name, delay in ms] to start that one a little later, e.g.
  // AT.playSounds(["doorOpen", ["carefulWalking", 300]]).
  function playSounds(list) {
    (list || []).forEach(function (item) {
      if (typeof item === "string") playSound(item);
      else playSound(item[0], { delay: item[1], volume: item[2] });
    });
  }

  // Fades out and stops a sound that playSound() returned.
  function stopSound(a, ms) {
    if (!a) return;
    fadeTo(a, 0, ms || 400, function () {
      a.pause();
    });
  }

  // The menu sounds are used on every page, so load them now.
  preloadSounds(["click", "menu", "turnPage"]);

  // Kept so older code that calls AT.playClick() still works.
  function playClick() {
    playSound("click");
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("button, .btn");
    if (!btn || btn.disabled) return;
    var name = btn.dataset.sound || "click";
    if (name !== "none") playSound(name);

    // Links load a new page, which cuts the sound off, so wait a moment first.
    // Skip this if another handler (like data-back) already took over the click,
    // or if the player is opening the link in a new tab.
    if (
      btn.tagName === "A" &&
      btn.href &&
      !e.defaultPrevented &&
      btn.target !== "_blank" &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.shiftKey
    ) {
      e.preventDefault();
      setTimeout(function () {
        location.href = btn.href;
      }, 150);
    }
  });

  window.AT.playClick = playClick;
  window.AT.playSound = playSound;
  window.AT.playSounds = playSounds;
  window.AT.stopSound = stopSound;
  window.AT.preloadSounds = preloadSounds;
  window.AT.setAmbience = setAmbience;
})();

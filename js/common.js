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
})();

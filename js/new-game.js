/*
=========================================================
FILE: new-game.js
PROJECT: Another Tally - A zombie survival game
AUTHOR: Cygnus J. Wiebe
DATE: December 14th, 2026
COURSE: INFS 634 - McGill University
=========================================================
DESCRIPTION:
This is the new game screen JavaScript file for Another Tally.
It contains the logic for setting up a new game and creating the starting
survivors. Each survivor starts random, as before; the player can then change
their portrait, name, voice, skill and trait, roll that one survivor again, or
roll the whole group.
=========================================================
TABLE OF CONTENTS
Ctrl+F a tag such as "[S3]" to jump to that section.
Ctrl+K Ctrl+8 folds every region; Ctrl+K Ctrl+9 unfolds them.
=========================================================
[S1] Survivor & Shelter Data
[S2] Setup
[S3] Pick Helper
[S4] Roll Survivors
[S5] Render Survivor List
[S6] Editing Survivors
[S7] Form Defaults & Reroll
[S8] Start Game
=========================================================
*/

/* 
=============================================================== 
---------- New Game Screen ----------
=============================================================== 
*/

/* 
---------- Initialization of New Game Screen ----------
*/

// This function picks settings, rolls 3 starting survivors, and hands the setup to game.html.
(function () {
  "use strict";

  // #region [S1] Survivor & Shelter Data
  // Survivor names come from common.js, so recruits found later in the game
  // (game.js) draw from the same list.
  var NAMES = AT.NAMES;

  // Define constants for skills and traits as defined in common.js.
  var SKILLS = Object.keys(AT.SKILLS);
  var TRAITS = Object.keys(AT.TRAITS);

  // Suggested shelter names. Each is a single building in town with a roof, a
  // yard and a basement (the three SPACES in game.js) that could be walled in.
  // None repeats a place on the scavenging map or a facility upgrade.
  var SHELTERS = [
    "The Old Library",
    "The Fire Hall",
    "The Courthouse",
    "The Town Hall",
    "The Parish Hall",
    "The Legion Hall",
    "The Community Centre",
    "The Hockey Arena",
    "The Curling Rink",
    "The Roadside Motel",
    "The Truck Stop Diner",
    "The Funeral Home",
    "The Radio Station",
    "The Post Office",
    "The Bus Depot",
    "The Train Station",
    "The Feed Mill",
    "The Lumber Yard",
    "The Body Shop",
    "The Bottling Plant",
    "The Old Brewery",
    "The Brick Walk-up",
    "The Nursing Home",
    "The County Museum",
  ];

  // Portrait numbers (assets/images/png/survivor-N.png), shared through common.js.
  var AVATARS = AT.AVATARS;
  // #endregion [S1] Survivor & Shelter Data

  // #region [S2] Setup
  // Load settings, create a random number generator, and set up the new game form.
  var settings = AT.load();
  var rng = AT.makeRng(settings.seed);
  var form = document.getElementById("new-game-form");
  var list = document.getElementById("survivor-list");
  var errorMsg = document.getElementById("survivor-error");
  var survivors = [];
  // #endregion [S2] Setup

  // #region [S3] Pick Helper
  // This function picks a random element from an array, optionally excluding elements in a "taken" array.
  function pick(arr, taken) {
    var pool = arr.filter(function (x) {
      return !taken || taken.indexOf(x) === -1;
    });
    return pool[Math.floor(rng() * pool.length)];
  }
  // #endregion [S3] Pick Helper

  // #region [S4] Roll Survivors
  // The voice (for grunts and cries in the game) that goes with a name from the
  // NAMES list in common.js: the list alternates male and female names.
  function voiceFor(name) {
    return NAMES.indexOf(name) % 2 === 1 ? "Female" : "Male";
  }
  // Rolls one random survivor whose name, skill and portrait nobody in
  // `others` has. rolledName is kept so a cleared name box falls back to it.
  function randomSurvivor(others) {
    var used = function (key) {
      return others.map(function (o) {
        return key === "name" ? o.rolledName : o[key];
      });
    };
    var name = pick(NAMES, used("name"));
    return {
      name: name,
      rolledName: name,
      voice: voiceFor(name),
      skill: pick(SKILLS, used("skill")), // no duplicate skills in the starting group
      trait: pick(TRAITS),
      avatar: pick(AVATARS, used("avatar")), // each starting survivor looks different
    };
  }
  // Rolls the whole starting group (its size is start.survivors in balance.js).
  function roll() {
    survivors = [];
    for (var i = 0; i < AT.BALANCE.start.survivors; i++)
      survivors.push(randomSurvivor(survivors));
    render();
  }
  // Rolls one survivor again, keeping the other two.
  function rollOne(i) {
    survivors[i] = randomSurvivor(
      survivors.filter(function (o, j) {
        return j !== i;
      }),
    );
    render();
  }
  // #endregion [S4] Roll Survivors

  // #region [S5] Render Survivor List
  // Skills and traits in A–Z order, so the lists don't hint at which ones are
  // useful.
  function az(list) {
    return list.slice().sort(function (a, b) {
      return a.localeCompare(b);
    });
  }
  var SKILLS_AZ = az(SKILLS);
  var TRAITS_AZ = az(TRAITS);

  // Something another survivor in the group already has (skill or portrait).
  function takenByOther(i, key, value) {
    return survivors.some(function (o, j) {
      return j !== i && o[key] === value;
    });
  }

  // One editable card per survivor: portrait picker, name, skill, trait and
  // voice, with a button to roll just this survivor again. Skills are one per
  // person; traits can repeat, the same as when they're rolled.
  function card(s, i) {
    var n = i + 1;
    var esc = AT.escapeHtml;
    return (
      '<li class="card survivor-card survivor-editor">' +
      '<fieldset class="editor-fields">' +
      '<legend class="visually-hidden">Survivor ' +
      n +
      "</legend>" +
      '<div class="editor-head">' +
      '<img class="avatar portrait" src="assets/images/png/survivor-' +
      s.avatar +
      '.png" alt="">' +
      '<div class="editor-name">' +
      '<label class="field-label" for="name-' +
      i +
      '">Name</label>' +
      '<input type="text" id="name-' +
      i +
      '" data-i="' +
      i +
      '" data-field="name" maxlength="20" autocomplete="off" value="' +
      esc(s.name) +
      '" placeholder="' +
      esc(s.rolledName) +
      '">' +
      "</div>" +
      '<button class="btn btn-sm roll-one" type="button" data-roll="' +
      i +
      '" data-sound="turnPage" aria-label="Roll survivor ' +
      n +
      ' again"><span aria-hidden="true">🎲</span></button>' +
      "</div>" +
      '<div class="portrait-options" role="radiogroup" aria-label="Portrait for survivor ' +
      n +
      '">' +
      AVATARS.map(function (a) {
        var taken = takenByOther(i, "avatar", a);
        return (
          '<label class="pic-option' +
          (taken ? " taken" : "") +
          '"><input class="visually-hidden" type="radio" name="avatar-' +
          i +
          '" data-i="' +
          i +
          '" data-field="avatar" value="' +
          a +
          '"' +
          (s.avatar === a ? " checked" : "") +
          (taken ? " disabled" : "") +
          '><img src="assets/images/png/survivor-' +
          a +
          '.png" alt="Portrait ' +
          a +
          (taken ? ", taken" : "") +
          '"></label>'
        );
      }).join("") +
      "</div>" +
      '<div class="editor-row">' +
      '<div><label class="field-label" for="skill-' +
      i +
      '">Skill</label>' +
      '<select id="skill-' +
      i +
      '" data-i="' +
      i +
      '" data-field="skill">' +
      SKILLS_AZ.map(function (k) {
        var taken = takenByOther(i, "skill", k);
        return (
          '<option value="' +
          esc(k) +
          '"' +
          (s.skill === k ? " selected" : "") +
          (taken ? " disabled" : "") +
          ">" +
          esc(k) +
          (taken ? " (taken)" : "") +
          "</option>"
        );
      }).join("") +
      "</select></div>" +
      '<div><label class="field-label" for="trait-' +
      i +
      '">Trait</label>' +
      '<select id="trait-' +
      i +
      '" data-i="' +
      i +
      '" data-field="trait">' +
      TRAITS_AZ.map(function (k) {
        return (
          '<option value="' +
          esc(k) +
          '"' +
          (s.trait === k ? " selected" : "") +
          ">" +
          esc(k) +
          "</option>"
        );
      }).join("") +
      "</select></div>" +
      '<div><label class="field-label" for="voice-' +
      i +
      '">Voice</label>' +
      '<select id="voice-' +
      i +
      '" data-i="' +
      i +
      '" data-field="voice">' +
      ["Male", "Female"]
        .map(function (v) {
          return (
            '<option value="' +
            v +
            '"' +
            (s.voice === v ? " selected" : "") +
            ">" +
            v +
            "</option>"
          );
        })
        .join("") +
      "</select></div>" +
      "</div>" +
      '<ul class="perk-list small muted">' +
      "<li><strong>" +
      esc(s.skill) +
      ":</strong> " +
      AT.SKILLS[s.skill] +
      "</li>" +
      "<li><strong>" +
      esc(s.trait) +
      ":</strong> " +
      AT.TRAITS[s.trait] +
      "</li>" +
      "</ul>" +
      "</fieldset>" +
      "</li>"
    );
  }

  // Draws every card again, keeping keyboard focus where it was.
  function render() {
    var focused = document.activeElement && document.activeElement.id;
    list.innerHTML = survivors.map(card).join("");
    if (focused && document.getElementById(focused))
      document.getElementById(focused).focus();
  }
  // #endregion [S5] Render Survivor List

  // #region [S6] Editing Survivors
  // Names keep to letters, numbers, spaces and a little punctuation, up to 20 characters.
  function cleanName(text) {
    return String(text || "")
      .replace(/[^\p{L}\p{N} '.-]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20);
  }

  // Typing a name updates it straight away (no redraw, so typing isn't interrupted).
  list.addEventListener("input", function (e) {
    var el = e.target;
    if (el.dataset.field !== "name") return;
    survivors[Number(el.dataset.i)].name = el.value;
    errorMsg.textContent = "";
  });

  // Picking a portrait, skill, trait or voice. Skills and portraits are one per
  // person, so the other cards are redrawn to show what's now taken.
  list.addEventListener("change", function (e) {
    var el = e.target;
    var s = survivors[Number(el.dataset.i)];
    if (!s) return;
    if (el.dataset.field === "name") {
      el.value = cleanName(el.value);
      s.name = el.value || s.rolledName;
      if (!el.value) el.value = s.rolledName;
      return;
    }
    if (el.dataset.field === "avatar") s.avatar = Number(el.value);
    else if (el.dataset.field === "skill") s.skill = el.value;
    else if (el.dataset.field === "trait") s.trait = el.value;
    else if (el.dataset.field === "voice") s.voice = el.value;
    else return;
    render();
  });

  // The dice on a card rolls just that survivor again.
  list.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-roll]");
    if (btn) rollOne(Number(btn.dataset.roll));
  });
  // #endregion [S6] Editing Survivors

  // #region [S7] Form Defaults & Reroll
  // Defaults come from the Options page.
  form.elements.shelter.placeholder = pick(SHELTERS);
  form.querySelector(
    '[name="difficulty"][value="' + settings.difficulty + '"]',
  ).checked = true;
  form.querySelector(
    '[name="length"][value="' + settings.length + '"]',
  ).checked = true;

  document.getElementById("reroll").addEventListener("click", roll);
  // #endregion [S7] Form Defaults & Reroll

  // #region [S8] Start Game
  // Start game: hands the setup to game.html through sessionStorage and goes there.
  // A blank shelter name uses the suggested one.
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    // Every name has to be different (a blank one uses the rolled name).
    var seen = {};
    for (var i = 0; i < survivors.length; i++) {
      var s = survivors[i];
      s.name = cleanName(s.name) || s.rolledName;
      var key = s.name.toLowerCase();
      if (seen[key]) {
        errorMsg.textContent =
          "Two survivors are both called " + s.name + ". Give one a different name.";
        render();
        document.getElementById("name-" + i).focus();
        return;
      }
      seen[key] = true;
    }
    var data = new FormData(form);
    AT.handoff.setSetup({
      shelter:
        String(data.get("shelter") || "").trim() ||
        form.elements.shelter.placeholder,
      difficulty: data.get("difficulty"),
      length: Number(data.get("length")),
      seed: settings.seed,
      survivors: survivors.map(function (s) {
        return {
          name: s.name,
          skill: s.skill,
          trait: s.trait,
          avatar: s.avatar,
          voice: s.voice,
        };
      }),
    });
    location.href = "game.html";
  });

  roll();
  // #endregion [S8] Start Game
})();

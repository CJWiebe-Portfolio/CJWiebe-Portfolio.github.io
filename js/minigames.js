/*
=========================================================
FILE: minigames.js
PROJECT: Another Tally - A zombie survival game
AUTHOR: Cygnus J. Wiebe
DATE: December 14th, 2026
COURSE: INFS 634 - McGill University
=========================================================
DESCRIPTION:
  This is the minigames screen JavaScript file for Another Tally. 
  There are three mini-games: Defense, Lockpick, and Search. Each has its own logic and UI.
  The minigames can be played in-game or auto-resolved for a quick outcome, and the results are returned in a consistent format.

  How game.js uses this file:
    AT.minigames.create(name, opts) builds a game inside opts.arena and returns
    a controller with start() and stop(). opts also carries the run's seeded
    rng, the difficulty, the walls level, ui callbacks for the timer and stats,
    and done(result), which is called with { won, summary, reward } when the
    game ends (Search adds bites and biteDamage).
    AT.minigames.autoResult(name, won, rng) rolls a result without playing.
    AT.minigames.describe(reward) turns { food: 2 } into "2 food".

  Sounds play on the "minigame" channel (see sfx below), so game.js can cut
  them off when the player leaves the mini-game.
=========================================================
TABLE OF CONTENTS
Ctrl+F a tag such as "[S3]" to jump to that section.
Ctrl+K Ctrl+8 folds every region; Ctrl+K Ctrl+9 unfolds them.
=========================================================
[S1] Shared Utilities
[S2] Defense Mini-game
[S3] Lockpick Mini-game
[S4] Search Mini-game
[S5] Auto-resolve Results
=========================================================
*/

// #region [S1] Shared Utilities
/* 
=============================================================== 
---------- Shared Utilities ----------
=============================================================== 
*/

(function () {
  "use strict";

  // resource labels used in the Search and Lockpick minigames
  var RES_IDS = ["food", "water", "materials", "medicine", "ammo"]; // resource IDs used in the Search and Lockpick minigames
  var RES_LABEL = {
    food: "Food",
    water: "Water",
    materials: "Materials",
    medicine: "Medicine",
    ammo: "Ammo",
  };

  // Utility functions for the minigames
  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }
  // A whole number from min to max (both included).
  function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }
  // Returns a shuffled copy of an array (Fisher-Yates), leaving the original alone.
  function shuffle(rng, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
  // Picks the value for the run's difficulty.
  function byDifficulty(difficulty, easy, normal, hard) {
    return difficulty === "easy" ? easy : difficulty === "hard" ? hard : normal;
  }
  // Adds n of a resource to a reward object, e.g. { food: 2 }.
  function addReward(reward, res, n) {
    reward[res] = (reward[res] || 0) + n;
  }

  // Plays a sound from common.js (see SOUNDS there for the names).
  // Mini-game sounds go on the "minigame" channel unless told otherwise, so
  // game.js can cut them all off when the player leaves the mini-game.
  // Any random choice about sounds uses Math.random, not the run's seeded
  // rng, so sounds never change how a seeded run plays out.
  function sfx(name, opts) {
    opts = opts || {};
    if (!opts.channel) opts.channel = "minigame";
    return window.AT && AT.playSound ? AT.playSound(name, opts) : null;
  }
  // Fades out and stops a sound that sfx() returned.
  function stopSfx(a, ms) {
    if (a && window.AT && AT.stopSound) AT.stopSound(a, ms);
  }

  // Countdown shared by all three games. onTick gets whole seconds left; onEnd fires at zero.
  function makeClock(seconds, ui, onEnd) {
    var endAt = 0,
      id = null,
      shown = -1;
    // Runs every 100 ms: updates the timer when the second changes, and ends the game at zero.
    function tick() {
      var left = Math.max(0, Math.ceil((endAt - performance.now()) / 1000));
      if (left !== shown) {
        shown = left;
        ui.timer(left);
      }
      if (left <= 0) {
        stop();
        onEnd();
      }
    }
    // Stops the countdown.
    function stop() {
      clearInterval(id);
      id = null;
    }
    ui.timer(seconds);
    // start() begins the countdown; stop() halts it early.
    return {
      start: function () {
        endAt = performance.now() + seconds * 1000;
        id = setInterval(tick, 100);
      },
      stop: stop,
    };
  }

  // This is a reusable function to show a banner at the top of the minigame arena with a success or failure message.
  function showBanner(arena, won, summary) {
    var b = document.createElement("div");
    b.className = "mg-banner " + (won ? "won" : "lost");
    b.setAttribute("role", "status");
    b.innerHTML =
      "<strong>" + (won ? "Success" : "Failed") + "</strong><span></span>";
    b.querySelector("span").textContent = summary;
    arena.appendChild(b);
  }
// #endregion [S1] Shared Utilities

  // #region [S2] Defense Mini-game
  /* 
=============================================================== 
---------- Defense minigame where players click zombies before they reach the wall ----------
=============================================================== 
*/

  // Creates the various elements of the Defense minigame, including the wall, lanes, and zombies.
  function Defense(o) {
    var LANES = 4;
    var total = byDifficulty(o.difficulty, 15, 25, 50);
    var crossMs = byDifficulty(o.difficulty, 4750, 3000, 2400);
    var spawnMs = byDifficulty(o.difficulty, 800, 700, 500);
    var hitDamage = byDifficulty(o.difficulty, 25, 35, 45);
    var wallMax = 100;
    var wall = Math.min(wallMax, 40 + (o.wallLevel || 0) * 30);
    var WALL_X = 6; // percent: where a zombie hits the wall
    // Missing a shot (clicking empty space, or a lane key with no zombie in that lane)
    // jams the gun for missJamMs and chips missDamage off the wall.
    var missJamMs = byDifficulty(o.difficulty, 200, 300, 400);
    var missDamage = byDifficulty(o.difficulty, 0, 5, 10);
    var jammedUntil = 0,
      jamTimer = null,
      misses = 0;
    // State variable for the zombies, including their position, speed, and lane.
    // The game loop updates these values and checks for collisions with the wall.
    var hordeLoop = null; // the horde growling under the whole game
    var zombies = [],
      spawned = 0,
      cleared = 0,
      killed = 0,
      running = false,
      raf = null,
      spawnTimer = null,
      last = 0;

    o.arena.className = "mg-canvas mg-defense";
    o.arena.innerHTML =
      '<div class="mg-wall-strip" aria-hidden="true"></div>' +
      Array.apply(null, Array(LANES))
        .map(function (_, i) {
          return (
            '<div class="mg-lane" style="top:' +
            (i * 100) / LANES +
            "%;height:" +
            100 / LANES +
            '%"><span class="mg-lane-key" aria-hidden="true">' +
            (i + 1) +
            "</span></div>"
          );
        })
        .join("") +
      '<p class="mg-hint">Click a zombie to take it down, or press <kbd>1</kbd>–<kbd>' +
      LANES +
      "</kbd> to shoot the closest one in that lane. Missing jams your gun for a moment.</p>";

    // This function updates the UI with the current number of zombies left and the wall's health percentage.
    function stats() {
      o.ui.statA("Zombies left", String(total - cleared).padStart(2, "0"));
      o.ui.statB("Wall", (wall / wallMax) * 100, String(Math.max(0, wall)));
    }
    stats();

    var clock = makeClock(30, o.ui, function () {
      finish(wall > 0);
    });

    // This function spawns a new zombie in a random lane and sets its speed based on the difficulty level.
    function spawn() {
      if (!running || spawned >= total) return;
      var lane = Math.floor(o.rng() * LANES);
      var el = document.createElement("button");
      el.type = "button";
      el.className = "mg-zombie";
      el.dataset.sound = "none"; // the gunshot is played in kill()
      el.tabIndex = -1; // moving targets: keyboard players use the lane keys instead
      el.setAttribute("aria-label", "Zombie in lane " + (lane + 1));
      el.textContent = "🧟";
      el.style.top = ((lane + 0.5) * 100) / LANES + "%";
      var z = {
        el: el,
        lane: lane,
        x: 100,
        speed: (100 - WALL_X) / (crossMs * (0.85 + o.rng() * 0.3)),
      };
      // Pressing on a zombie shoots it (pointerdown reacts faster than click).
      el.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        kill(z);
      });
      // Enter or Space also shoots, if a screen reader moves focus onto a zombie.
      el.addEventListener("click", function () {
        kill(z);
      });
      zombies.push(z);
      o.arena.appendChild(el);
      spawned += 1;
      // Some of them shout as they come out (not all, or it's a wall of noise).
      if (Math.random() < 0.35) sfx("zombieShout", { gap: 900, volume: 0.7 });
      if (spawned < total)
        spawnTimer = setTimeout(spawn, spawnMs * (0.6 + o.rng() * 0.8));
    }

    // Takes a zombie out of play (shot, or it reached the wall).
    function remove(z) {
      zombies.splice(zombies.indexOf(z), 1);
      cleared += 1;
    }

    // True while the gun is jammed after a miss.
    function jammed() {
      return performance.now() < jammedUntil;
    }

    // This function handles a missed shot: it jams the gun, damages the wall,
    // and marks the arena as jammed so the player can see it.
    function miss() {
      if (!running || jammed()) return; // a press during a jam does nothing and doesn't stack
      misses += 1;
      jammedUntil = performance.now() + missJamMs;
      // The shot misses, then the bolt is racked to clear the jam.
      sfx("gunshot");
      sfx("gunJam", { delay: 120 });
      wall -= missDamage;
      o.arena.classList.add("jammed"); // red border and greyed lane keys until the jam clears
      clearTimeout(jamTimer);
      jamTimer = setTimeout(function () {
        o.arena.classList.remove("jammed");
      }, missJamMs);
      stats();
      if (wall <= 0) finish(false);
    }

    // A click or tap in the arena that doesn't land on a zombie is a miss.
    // Zombies already going down count as hits, so a late tap isn't punished.
    function onArenaClick(e) {
      if (e.target.closest(".mg-zombie")) return;
      miss();
    }

    // This function handles the logic for killing a zombie, updating the game state, and removing the zombie from the UI.
    function kill(z) {
      if (!running || zombies.indexOf(z) === -1) return;
      if (jammed()) return; // can't shoot until the jam clears
      remove(z);
      killed += 1;
      sfx("gunshot");
      if (Math.random() < 0.4) sfx("zombieDying", { delay: 150, gap: 400 });
      z.el.classList.add("down");
      z.el.disabled = true;
      setTimeout(function () {
        z.el.remove();
      }, 250);
      stats();
      if (cleared >= total) finish(true);
    }

    // This function is the main game loop, updating the position of each zombie and checking for collisions with the wall.
    function frame(now) {
      if (!running) return;
      var dt = Math.min(64, now - last);
      last = now;
      zombies.slice().forEach(function (z) {
        z.x -= z.speed * dt;
        if (z.x <= WALL_X) {
          remove(z);
          z.el.remove();
          wall -= hitDamage;
          // Pounding on the wall, with a bite on top.
          sfx("knockHard", { gap: 700 });
          sfx("zombieAttack", { gap: 1200, volume: 0.8 });
          o.arena.classList.remove("hit");
          void o.arena.offsetWidth; // restart the shake animation
          o.arena.classList.add("hit");
        } else {
          z.el.style.left = z.x + "%";
        }
      });
      stats();
      if (wall <= 0) return finish(false);
      if (cleared >= total) return finish(true);
      raf = requestAnimationFrame(frame);
    }

    // This function handles keyboard input for the Defense minigame.
    function onKey(e) {
      var lane = Number(e.key) - 1;
      if (!(lane >= 0 && lane < LANES)) return;
      e.preventDefault();
      var front = zombies
        .filter(function (z) {
          return z.lane === lane;
        })
        .sort(function (a, b) {
          return a.x - b.x;
        })[0];
      if (front) kill(front);
      else miss(); // nothing in that lane
    }

    // This function stops the game, cancels timers and event listeners, and cleans up the game state.
    function stop() {
      running = false;
      clock.stop();
      clearTimeout(spawnTimer);
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      o.arena.removeEventListener("pointerdown", onArenaClick);
      stopSfx(hordeLoop, 800);
      hordeLoop = null;
      clearTimeout(jamTimer);
      o.arena.classList.remove("jammed");
    }

    // This function finishes the game, showing a banner with the result and calling the done callback with the outcome.
    function finish(won) {
      if (!running) return;
      stop();
      zombies.forEach(function (z) {
        z.el.disabled = true;
      });
      var summary = won
        ? "The wall held. You took down " +
          killed +
          " of " +
          total +
          " zombies." +
          (misses ? " Missed shots: " + misses + "." : "")
        : "The wall broke. Someone got hurt pushing them back." +
          (misses ? " Missed shots: " + misses + "." : "");
      if (won) sfx("reload");
      else {
        sfx("woodSplitting");
        sfx("zombieScream", { delay: 300 });
      }
      showBanner(o.arena, won, summary);
      o.done({ won: won, summary: summary, reward: {} });
    }

    // This function starts the Defense minigame, initializing the game state, event listeners, and starting the game loop.
    return {
      start: function () {
        running = true;
        last = performance.now();
        document.addEventListener("keydown", onKey);
        o.arena.addEventListener("pointerdown", onArenaClick);
        o.arena.querySelector(".mg-hint").classList.add("faded");
        sfx("cock");
        hordeLoop = sfx("hordeClose", { loop: true, volume: 0.5 });
        clock.start();
        spawn();
        raf = requestAnimationFrame(frame);
      },
      stop: stop,
    };
  }
  // #endregion [S2] Defense Mini-game

  // #region [S3] Lockpick Mini-game
  /* 
=============================================================== 
---------- Lockpick minigame where players set the pins in the right order before time runs out ----------
=============================================================== 
*/

  // This function creates the Lockpick minigame.
  function Lockpick(o) {
    var count = byDifficulty(o.difficulty, 4, 5, 6);
    var seconds = byDifficulty(o.difficulty, 25, 20, 18);
    var order = shuffle(
      o.rng,
      Array.apply(null, Array(count)).map(function (_, i) {
        return i;
      }),
    );
    var setCount = 0,
      slips = 0,
      running = false;

    o.arena.className = "mg-canvas mg-lockpick";
    o.arena.innerHTML =
      '<div class="mg-lock">' +
      '<div class="mg-pins" role="group" aria-label="Lock pins">' +
      order
        .map(function (_, i) {
          return (
            '<button type="button" class="mg-pin" data-sound="none" data-pin="' +
            i +
            '" disabled aria-label="Pin ' +
            (i + 1) +
            '"><span class="mg-pin-body" aria-hidden="true"></span><span class="mg-pin-num">' +
            (i + 1) +
            "</span></button>"
          );
        })
        .join("") +
      "</div>" +
      '<p class="mg-msg" aria-live="polite">Each pin clicks into place only in the right order. A wrong pin drops them all.</p>' +
      "</div>";

    var pins = Array.prototype.slice.call(o.arena.querySelectorAll(".mg-pin"));
    var msg = o.arena.querySelector(".mg-msg");

    // This function updates the UI with the current number of pins set and the percentage of the lock that has been unlocked.
    function stats() {
      o.ui.statA("Pins set", setCount + "/" + count);
      o.ui.statB(
        "Lock",
        (setCount / count) * 100,
        Math.round((setCount / count) * 100) + "%",
      );
    }
    stats();

    var clock = makeClock(seconds, o.ui, function () {
      finish(false);
    });

    // This function attempts to set a pin, checking if it is the correct one in the sequence.
    // If it is correct, it updates the game state; if not, it resets the pins and increments the slip count.
    function tryPin(i) {
      if (!running) return;
      var btn = pins[i];
      if (btn.classList.contains("set")) return;
      if (order[setCount] === i) {
        btn.classList.add("set");
        btn.setAttribute("aria-label", "Pin " + (i + 1) + ", set");
        setCount += 1;
        sfx("lightSwitch"); // a crisp click as the pin sets
        msg.textContent = "Click. Pin " + (i + 1) + " is set.";
        stats();
        if (setCount === count) finish(true);
      } else {
        slips += 1;
        sfx("rustyMetal"); // the pins rattle back down
        pins.forEach(function (p, n) {
          p.classList.remove("set");
          p.setAttribute("aria-label", "Pin " + (n + 1));
        });
        btn.classList.remove("wrong");
        void btn.offsetWidth;
        btn.classList.add("wrong");
        setCount = 0;
        msg.textContent = "Pin " + (i + 1) + " was wrong. The pins drop.";
        stats();
      }
    }

    o.arena.querySelector(".mg-pins").addEventListener("click", function (e) {
      var b = e.target.closest("[data-pin]");
      if (b) tryPin(Number(b.dataset.pin));
    });
    // Number keys 1 to 6 try that pin.
    function onKey(e) {
      var i = Number(e.key) - 1;
      if (i >= 0 && i < count) {
        e.preventDefault();
        tryPin(i);
      }
    }

    // This function stops the game, cancels timers and event listeners, and cleans up the game state.
    function stop() {
      running = false;
      clock.stop();
      document.removeEventListener("keydown", onKey);
      pins.forEach(function (p) {
        p.disabled = true;
      });
    }

    // This function finishes the game, showing a banner with the result and calling the done callback with the outcome.
    function finish(won) {
      if (!running) return;
      stop();
      var reward = {};
      if (won) {
        var kinds = shuffle(o.rng, ["materials", "ammo", "medicine", "food"]);
        addReward(reward, kinds[0], randInt(o.rng, 2, 3));
        addReward(reward, kinds[1], randInt(o.rng, 1, 2));
      }
      var summary = won
        ? "The lock gave way" +
          (slips
            ? " after " + slips + " slip" + (slips === 1 ? "" : "s")
            : "") +
          ". Inside: " +
          describe(reward) +
          "."
        : "Time ran out with " +
          setCount +
          " of " +
          count +
          " pins set. The noise drew attention.";
      if (won) {
        // The lid creaks open and you dig through the crate.
        sfx("rustyHinges", { delay: 200 });
        sfx("cardboardBox", { delay: 700 });
      } else {
        sfx("glassBreak");
        sfx("zombieShout", { delay: 400 });
      }
      showBanner(o.arena, won, summary);
      o.done({ won: won, summary: summary, reward: reward });
    }

    // The controller game.js uses: start() when the player presses Start,
    // stop() if they auto-resolve instead.
    return {
      start: function () {
        running = true;
        pins.forEach(function (p) {
          p.disabled = false;
        });
        document.addEventListener("keydown", onKey);
        pins[0].focus();
        clock.start();
      },
      stop: stop,
    };
  }
  // #endregion [S3] Lockpick Mini-game

  // #region [S4] Search Mini-game
  /* 
=============================================================== 
---------- Search minigame where players find hidden supplies ----------
=============================================================== 
*/

  // This function creates the Search minigame.
  function Search(o) {
    var COLS = 5,
      ROWS = 4;
    var hidden = 5;
    var need = byDifficulty(o.difficulty, 2, 3, 3);
    var searchesMax = byDifficulty(o.difficulty, 10, 8, 7);
    var searches = searchesMax;
    // Zombies hide in the room too. Opening one costs an extra search, and each
    // bite hurts a survivor after the mini-game (game.js applies the damage).
    var zombieCount = byDifficulty(o.difficulty, 1, 2, 3);
    var biteDamage = byDifficulty(o.difficulty, 10, 15, 20);
    var biteSearchCost = 1; // extra searches lost fighting a zombie off
    var order = shuffle(
      o.rng,
      Array.apply(null, Array(COLS * ROWS)).map(function (_, i) {
        return i;
      }),
    );
    var spots = order.slice(0, hidden);
    var zombieSpots = order.slice(hidden, hidden + zombieCount);
    var loot = {}; // tile index -> resource id
    spots.forEach(function (i) {
      loot[i] = pick(o.rng, RES_IDS);
    });
    var zombieAt = {}; // tile index -> true
    zombieSpots.forEach(function (i) {
      zombieAt[i] = true;
    });
    var found = [],
      bitten = [],
      running = false;
    // What finding each supply sounds like (stacked on the rummaging).
    var LOOT_SOUNDS = {
      food: "canJiggle",
      water: "canDrop",
      materials: "rubbish",
      medicine: "pillCap",
      ammo: "reload",
    };

    o.arena.className = "mg-canvas mg-search";
    o.arena.innerHTML =
      '<div class="mg-grid" role="group" aria-label="Places to search" style="grid-template-columns:repeat(' +
      COLS +
      ',1fr)">' +
      Array.apply(null, Array(COLS * ROWS))
        .map(function (_, i) {
          var r = Math.floor(i / COLS) + 1,
            c = (i % COLS) + 1;
          return (
            '<button type="button" class="mg-tile" data-sound="none" data-tile="' +
            i +
            '" disabled aria-label="Row ' +
            r +
            ", column " +
            c +
            ', not searched">?</button>'
          );
        })
        .join("") +
      "</div>" +
      '<p class="mg-msg" aria-live="polite">Empty spots show how many supplies are hidden next to them, and 🧟 warns of zombies close by. Find ' +
      need +
      " of " +
      hidden +
      " and watch out for " +
      zombieCount +
      " zombie" +
      (zombieCount === 1 ? "" : "s") +
      ".</p>";

    var tiles = Array.prototype.slice.call(
      o.arena.querySelectorAll(".mg-tile"),
    );
    var msg = o.arena.querySelector(".mg-msg");

    // This function updates the UI with the current number of supplies found and the number of searches left.
    function stats() {
      o.ui.statA("Found", found.length + "/" + hidden);
      o.ui.statB(
        "Searches left",
        (searches / searchesMax) * 100,
        String(searches).padStart(2, "0"),
      );
    }
    stats();

    var clock = makeClock(30, o.ui, function () {
      finish();
    });

    // This function counts how many hidden supplies are adjacent to a given tile index.
    function nearby(i) {
      var r = Math.floor(i / COLS),
        c = i % COLS,
        n = 0;
      for (var dr = -1; dr <= 1; dr++)
        for (var dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          var rr = r + dr,
            cc = c + dc;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
          if (loot[rr * COLS + cc] && found.indexOf(rr * COLS + cc) === -1) n++;
        }
      return n;
    }

    // This function counts how many zombies that haven't been found yet are next to a tile.
    function nearbyZombies(i) {
      var r = Math.floor(i / COLS),
        c = i % COLS,
        n = 0;
      for (var dr = -1; dr <= 1; dr++)
        for (var dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          var rr = r + dr,
            cc = c + dc;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
          var k = rr * COLS + cc;
          if (zombieAt[k] && bitten.indexOf(k) === -1) n++;
        }
      return n;
    }

    // Refreshes the clues on every opened empty tile (they change as things are found).
    function relabel() {
      tiles.forEach(function (t, n) {
        if (t.classList.contains("open") && !loot[n] && !zombieAt[n]) label(n);
      });
    }

    // This function handles the logic for searching a tile, revealing whether it contains loot or is empty, and updating the game state accordingly.
    function searchTile(i) {
      if (!running || searches <= 0) return;
      var t = tiles[i];
      if (t.classList.contains("open")) return;
      searches -= 1;
      t.classList.add("open");
      var where = t.getAttribute("aria-label").replace(", not searched", "");
      if (zombieAt[i]) {
        bitten.push(i);
        searches = Math.max(0, searches - biteSearchCost);
        t.classList.add("zombie");
        // A scream, the bite, and a swing to fight it off, all at once.
        sfx("zombieScream");
        sfx("zombieAttack", { delay: 200, volume: 0.8 });
        sfx("swing", { delay: 450 });
        t.innerHTML = '<span aria-hidden="true">🧟</span>';
        t.setAttribute("aria-label", where + ", a zombie");
        msg.textContent =
          "A zombie! You fought it off, but someone was bitten (-" +
          biteDamage +
          " health, -" +
          biteSearchCost +
          " search).";
        relabel();
      } else if (loot[i]) {
        found.push(i);
        t.classList.add("loot");
        rummage();
        sfx(LOOT_SOUNDS[loot[i]], { delay: 300 });
        t.innerHTML =
          '<img src="assets/icons/ingame/' +
          loot[i] +
          '.png" alt="" width="28" height="28">';
        t.setAttribute("aria-label", where + ", found " + RES_LABEL[loot[i]]);
        msg.textContent = "Found " + RES_LABEL[loot[i]].toLowerCase() + "!";
        // Numbers count supplies still hidden, so refresh the open empty tiles.
        relabel();
      } else {
        rummage();
        label(i);
        var n = nearby(i),
          nz = nearbyZombies(i);
        msg.textContent =
          (n === 0
            ? "Nothing here, and no supplies next to it."
            : "Nothing here, but " +
              n +
              " supply" +
              (n === 1 ? " is" : " are") +
              " hidden next to it.") +
          (nz
            ? " You can hear " + nz + " zombie" + (nz === 1 ? "" : "s") + " close by."
            : "");
      }
      stats();
      if (found.length === hidden || searches === 0) finish();
    }

    // Searching a new spot cuts off the last spot's rummaging instead of stacking it.
    function rummage() {
      sfx("rummage", { channel: "searching", replace: true, fade: 150 });
    }

    // This function updates the label and text content of a tile to show how many hidden supplies are adjacent to it.
    function label(i) {
      var t = tiles[i],
        n = nearby(i),
        nz = nearbyZombies(i);
      var where = t.getAttribute("aria-label").split(",").slice(0, 2).join(",");
      t.innerHTML =
        '<span class="mg-clue">' +
        (n ? String(n) : "·") +
        (nz ? ' <span class="mg-growl">🧟' + nz + "</span>" : "") +
        "</span>";
      t.dataset.near = n;
      t.setAttribute(
        "aria-label",
        where +
          ", empty, " +
          n +
          " hidden nearby" +
          (nz ? ", " + nz + " zombie" + (nz === 1 ? "" : "s") + " nearby" : ""),
      );
    }

    o.arena.querySelector(".mg-grid").addEventListener("click", function (e) {
      var b = e.target.closest("[data-tile]");
      if (b) searchTile(Number(b.dataset.tile));
    });

    // Stops the clock and locks every tile.
    function stop() {
      running = false;
      clock.stop();
      tiles.forEach(function (t) {
        t.disabled = true;
      });
    }

    // This function finishes the game, showing a banner with the result and calling the done callback with the outcome.
    function finish() {
      if (!running) return;
      stop();
      // Show what was missed.
      spots.forEach(function (i) {
        if (found.indexOf(i) === -1) {
          tiles[i].classList.add("missed");
          tiles[i].innerHTML =
            '<img src="assets/icons/ingame/' +
            loot[i] +
            '.png" alt="" width="28" height="28">';
        }
      });
      zombieSpots.forEach(function (i) {
        if (bitten.indexOf(i) === -1) {
          tiles[i].classList.add("zombie", "missed");
          tiles[i].innerHTML = '<span aria-hidden="true">🧟</span>';
        }
      });
      var won = found.length >= need;
      if (!won) sfx("zombieShout", { delay: 300 }); // the dead caught up
      var reward = {};
      found.forEach(function (i) {
        addReward(reward, loot[i], randInt(o.rng, 1, 2));
      });
      var summary =
        (found.length
          ? "You found " + describe(reward) + "."
          : "You found nothing.") +
        (won ? "" : " Not enough before the dead caught up.") +
        (bitten.length
          ? " Bitten " + bitten.length + " time" + (bitten.length === 1 ? "" : "s") + "."
          : "");
      showBanner(o.arena, won, summary);
      o.done({
        won: won,
        summary: summary,
        reward: reward,
        bites: bitten.length,
        biteDamage: biteDamage,
      });
    }

    // The controller game.js uses: start() when the player presses Start,
    // stop() if they auto-resolve instead.
    return {
      start: function () {
        running = true;
        tiles.forEach(function (t) {
          t.disabled = false;
        });
        tiles[0].focus();
        clock.start();
      },
      stop: stop,
    };
  }

  // This function describes the reward obtained from a minigame, returning a human-readable string.
  function describe(reward) {
    var parts = Object.keys(reward)
      .filter(function (k) {
        return reward[k] > 0;
      })
      .map(function (k) {
        return reward[k] + " " + RES_LABEL[k].toLowerCase();
      });
    if (!parts.length) return "nothing";
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  }

  var GAMES = { Defense: Defense, Lockpick: Lockpick, Search: Search };
  // #endregion [S4] Search Mini-game

  // #region [S5] Auto-resolve Results
  /* 
=============================================================== 
---------- Auto-result function for minigames ----------
=============================================================== 
*/
  function autoResult(name, won, rng) {
    var reward = {};
    if (name === "Lockpick" && won) {
      var kinds = shuffle(rng, ["materials", "ammo", "medicine", "food"]);
      addReward(reward, kinds[0], randInt(rng, 2, 3));
      addReward(reward, kinds[1], randInt(rng, 1, 2));
    }
    if (name === "Search") {
      var n = won ? randInt(rng, 3, 4) : randInt(rng, 0, 2);
      for (var i = 0; i < n; i++)
        addReward(reward, pick(rng, RES_IDS), randInt(rng, 1, 2));
    }
    return { won: won, reward: reward, summary: "" };
  }

  window.AT = window.AT || {};
  AT.minigames = {
    create: function (name, opts) {
      return GAMES[name](opts);
    },
    autoResult: autoResult,
    describe: describe,
  };
  // #endregion [S5] Auto-resolve Results
})();

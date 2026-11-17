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
=========================================================
*/

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
  function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }
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
  function byDifficulty(difficulty, easy, normal, hard) {
    return difficulty === "easy" ? easy : difficulty === "hard" ? hard : normal;
  }
  function addReward(reward, res, n) {
    reward[res] = (reward[res] || 0) + n;
  }

  // Countdown shared by all three games. onTick gets whole seconds left; onEnd fires at zero.
  function makeClock(seconds, ui, onEnd) {
    var endAt = 0,
      id = null,
      shown = -1;
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
    function stop() {
      clearInterval(id);
      id = null;
    }
    ui.timer(seconds);
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

  /* 
=============================================================== 
---------- Defense minigame where players click zombies before they reach the wall ----------
=============================================================== 
*/

  // Creates the various elements of the Defense minigame, including the wall, lanes, and zombies.
  function Defense(o) {
    var LANES = 4;
    var total = byDifficulty(o.difficulty, 15, 25, 50);
    var crossMs = byDifficulty(o.difficulty, 7500, 6000, 4800);
    var spawnMs = byDifficulty(o.difficulty, 1600, 1300, 1000); // This
    var hitDamage = byDifficulty(o.difficulty, 25, 35, 45);
    var wallMax = 100;
    var wall = Math.min(wallMax, 40 + (o.wallLevel || 0) * 30);
    var WALL_X = 6; // percent: where a zombie hits the wall
    // State variable for the zombies, including their position, speed, and lane.
    // The game loop updates these values and checks for collisions with the wall.
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
      "</kbd> to shoot the closest one in that lane.</p>";

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
      el.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        kill(z);
      });
      el.addEventListener("click", function () {
        kill(z);
      }); // Enter/Space if a screen reader moves focus here
      zombies.push(z);
      o.arena.appendChild(el);
      spawned += 1;
      if (spawned < total)
        spawnTimer = setTimeout(spawn, spawnMs * (0.6 + o.rng() * 0.8));
    }

    function remove(z) {
      zombies.splice(zombies.indexOf(z), 1);
      cleared += 1;
    }

    // This function handles the logic for killing a zombie, updating the game state, and removing the zombie from the UI.
    function kill(z) {
      if (!running || zombies.indexOf(z) === -1) return;
      remove(z);
      killed += 1;
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
    }

    // This function stops the game, cancels timers and event listeners, and cleans up the game state.
    function stop() {
      running = false;
      clock.stop();
      clearTimeout(spawnTimer);
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
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
          " zombies."
        : "The wall broke. Someone got hurt pushing them back.";
      showBanner(o.arena, won, summary);
      o.done({ won: won, summary: summary, reward: {} });
    }

    // This function starts the Defense minigame, initializing the game state, event listeners, and starting the game loop.
    return {
      start: function () {
        running = true;
        last = performance.now();
        document.addEventListener("keydown", onKey);
        o.arena.querySelector(".mg-hint").classList.add("faded");
        clock.start();
        spawn();
        raf = requestAnimationFrame(frame);
      },
      stop: stop,
    };
  }

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
            '<button type="button" class="mg-pin" data-pin="' +
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
        msg.textContent = "Click. Pin " + (i + 1) + " is set.";
        stats();
        if (setCount === count) finish(true);
      } else {
        slips += 1;
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
      showBanner(o.arena, won, summary);
      o.done({ won: won, summary: summary, reward: reward });
    }

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
    var spots = shuffle(
      o.rng,
      Array.apply(null, Array(COLS * ROWS)).map(function (_, i) {
        return i;
      }),
    ).slice(0, hidden);
    var loot = {}; // tile index -> resource id
    spots.forEach(function (i) {
      loot[i] = pick(o.rng, RES_IDS);
    });
    var found = [],
      running = false;

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
            '<button type="button" class="mg-tile" data-tile="' +
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
      '<p class="mg-msg" aria-live="polite">Empty spots show how many supplies are hidden next to them. Find ' +
      need +
      " of " +
      hidden +
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

    // This function handles the logic for searching a tile, revealing whether it contains loot or is empty, and updating the game state accordingly.
    function searchTile(i) {
      if (!running || searches <= 0) return;
      var t = tiles[i];
      if (t.classList.contains("open")) return;
      searches -= 1;
      t.classList.add("open");
      var where = t.getAttribute("aria-label").replace(", not searched", "");
      if (loot[i]) {
        found.push(i);
        t.classList.add("loot");
        t.innerHTML =
          '<img src="assets/icons/ingame/' +
          loot[i] +
          '.png" alt="" width="28" height="28">';
        t.setAttribute("aria-label", where + ", found " + RES_LABEL[loot[i]]);
        msg.textContent = "Found " + RES_LABEL[loot[i]].toLowerCase() + "!";
        // Numbers count supplies still hidden, so refresh the open empty tiles.
        tiles.forEach(function (o2, n) {
          if (o2.classList.contains("open") && !loot[n]) label(n);
        });
      } else {
        label(i);
        var n = nearby(i);
        msg.textContent =
          n === 0
            ? "Nothing here, and nothing next to it."
            : "Nothing here, but " +
              n +
              " supply" +
              (n === 1 ? " is" : " are") +
              " hidden next to it.";
      }
      stats();
      if (found.length === hidden || searches === 0) finish();
    }

    // This function updates the label and text content of a tile to show how many hidden supplies are adjacent to it.
    function label(i) {
      var t = tiles[i],
        n = nearby(i);
      var where = t.getAttribute("aria-label").split(",").slice(0, 2).join(",");
      t.textContent = n ? String(n) : "·";
      t.dataset.near = n;
      t.setAttribute("aria-label", where + ", empty, " + n + " hidden nearby");
    }

    o.arena.querySelector(".mg-grid").addEventListener("click", function (e) {
      var b = e.target.closest("[data-tile]");
      if (b) searchTile(Number(b.dataset.tile));
    });

    // This function handles keyboard input for the Search minigame, allowing players to search tiles using number keys.
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
      var won = found.length >= need;
      var reward = {};
      found.forEach(function (i) {
        addReward(reward, loot[i], randInt(o.rng, 1, 2));
      });
      var summary =
        (found.length
          ? "You found " + describe(reward) + "."
          : "You found nothing.") +
        (won ? "" : " Not enough before the dead caught up.");
      showBanner(o.arena, won, summary);
      o.done({ won: won, summary: summary, reward: reward });
    }

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
})();

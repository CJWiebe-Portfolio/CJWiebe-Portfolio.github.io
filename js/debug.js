/*
=========================================================
FILE: debug.js
PROJECT: Another Tally - A zombie survival game
AUTHOR: Cygnus J. Wiebe
DATE: December 14th, 2026
COURSE: INFS 634 - McGill University
=========================================================
DESCRIPTION:
Balance tools for testing. Nothing here runs for players: the panel only
appears with ?debug on (see the top of js/balance.js).

  - The panel (press ` or click the DEBUG tag) changes any number in
    balance.js, or any cost or gain in story.js, while you play. Changes
    apply at once and are saved until you reset them or turn debug off.
  - Every run played in debug mode is logged, night by night, so you never
    have to write playtests down.
  - Export writes a new balance.js with your changes (keeping every comment)
    and builds Another_Tally_Balance.xlsx from balance.js, story.js and the
    playtest log. The workbook is never typed into: build a new one instead.

Note: while a pop-up (a report, an event) is open, the browser blocks
clicks everywhere else, so change numbers between pop-ups.
=========================================================
TABLE OF CONTENTS
Ctrl+F a tag such as "[D3]" to jump to that section.
=========================================================
[D1] Reading balance.js (values, notes and line numbers)
[D2] Changes (what differs from the files)
[D3] Writing a new balance.js
[D4] Playtest log
[D5] Workbook sheets
[D6] Writing the .xlsx file
[D7] The panel
[D8] Run tools
[D9] Export tools
[D10] Start-up
=========================================================
*/

(function () {
  "use strict";
  var AT = window.AT;
  if (!AT || !AT.BALANCE) return;

  // #region [D1] Reading balance.js (values, notes and line numbers)
  // Reads the BALANCE object in balance.js's own text (AT.balance.source).
  // Returns every number with its path, where it sits in the text, its line
  // and its note (the // comment on its line, or the lines just above it).
  //   { numbers: [{ path, start, end, line, value }], notes: { "a.b": "..." } }
  function readSource(src) {
    var at = src.indexOf("var BALANCE = {");
    if (at === -1) return { numbers: [], notes: {} };
    var i = src.indexOf("{", at);
    var numbers = [];
    var notes = {};
    var line = 1;
    for (var n = 0; n < i; n++) if (src.charCodeAt(n) === 10) line++;

    // ---------- Tokens ----------
    // Each token: { type, text, start, end, line, nlBefore }. Comments are
    // kept as tokens so notes can be found next to keys and values.
    var tokens = [];
    var nl = 0;
    var p = i;
    while (p < src.length) {
      var c = src[p];
      if (c === "\n") {
        line++;
        nl++;
        p++;
        continue;
      }
      if (c === " " || c === "\t" || c === "\r") {
        p++;
        continue;
      }
      var start = p;
      var type;
      if (c === "/" && src[p + 1] === "/") {
        while (p < src.length && src[p] !== "\n") p++;
        type = "comment";
      } else if (c === "/" && src[p + 1] === "*") {
        var close = src.indexOf("*/", p + 2);
        p = close === -1 ? src.length : close + 2;
        type = "comment";
      } else if (c === '"' || c === "'") {
        p++;
        while (p < src.length && src[p] !== c) p += src[p] === "\\" ? 2 : 1;
        p++;
        type = "string";
      } else if (/[0-9.]/.test(c) || (c === "-" && /[0-9.]/.test(src[p + 1]))) {
        p++;
        while (p < src.length && /[0-9.eE]/.test(src[p])) p++;
        type = "number";
      } else if (/[A-Za-z_$]/.test(c)) {
        while (p < src.length && /[\w$]/.test(src[p])) p++;
        type = "word";
      } else {
        p++;
        type = "punct";
      }
      var tok = { type: type, text: src.slice(start, p), start: start, end: p, line: line, nlBefore: nl };
      // A block comment can span lines.
      if (type === "comment") line += (tok.text.match(/\n/g) || []).length;
      tokens.push(tok);
      nl = 0;
      // Stop at the end of the BALANCE object (the "};" after it).
      if (type === "punct" && c === ";") break;
    }

    // ---------- Parse ----------
    var k = 0;
    function peek() {
      return tokens[k];
    }
    // Comments right above the next token (no blank line between), as one note.
    function commentsAbove() {
      var lines = [];
      while (peek() && peek().type === "comment") {
        var t = tokens[k++];
        if (t.nlBefore > 1) lines = []; // a blank line starts a new note
        var text = cleanComment(t.text);
        if (text) lines.push(text);
      }
      return lines.join(" ");
    }
    // A // comment on the same line as the value just read.
    function commentAfter(valueLine) {
      var t = peek();
      if (t && t.type === "comment" && t.nlBefore === 0 && t.line === valueLine) {
        k++;
        return cleanComment(t.text);
      }
      return "";
    }
    function skipComma() {
      if (peek() && peek().text === ",") k++;
    }
    function value(path) {
      var t = tokens[k++];
      if (!t) return;
      if (t.text === "{") {
        while (peek()) {
          var above = commentsAbove();
          if (!peek() || peek().text === "}") {
            k++;
            return;
          }
          var keyTok = tokens[k++];
          var key = keyTok.type === "string" ? keyTok.text.slice(1, -1) : keyTok.text;
          k++; // the ":"
          var childPath = path.concat([key]);
          var lastBefore = k;
          value(childPath);
          var endLine = tokens[k - 1] ? tokens[k - 1].line : keyTok.line;
          skipComma();
          var after = commentAfter(endLine);
          var note = [above, after].filter(Boolean).join(" ");
          if (note) notes[childPath.join(".")] = note;
          if (lastBefore === k) break; // nothing read: stop rather than loop
        }
        return;
      }
      if (t.text === "[") {
        var index = 0;
        while (peek()) {
          commentsAbove();
          if (peek().text === "]") {
            k++;
            return;
          }
          value(path.concat([index++]));
          skipComma();
        }
        return;
      }
      if (t.type === "number") {
        var entry = { path: path, start: t.start, end: t.end, line: t.line, value: Number(t.text) };
        // A simple fraction, like 1 / 6.
        if (peek() && peek().text === "/" && tokens[k + 1] && tokens[k + 1].type === "number") {
          var bottom = tokens[k + 1];
          entry.value = entry.value / Number(bottom.text);
          entry.end = bottom.end;
          k += 2;
        }
        numbers.push(entry);
      }
      // Strings, true/false and null need nothing.
    }
    value([]);
    return { numbers: numbers, notes: notes };
  }
  // A comment without its // or /* */, and without #region lines.
  function cleanComment(text) {
    var t = text.replace(/^\/\/\s?/, "").replace(/^\/\*|\*\/$/g, "").trim();
    return /^#(end)?region/.test(t) ? "" : t;
  }
  var SOURCE = readSource(AT.balance.source || "");
  // The note for a path, or for the nearest path above it that has one.
  function noteFor(path) {
    for (var n = path.length; n > 0; n--) {
      var note = SOURCE.notes[path.slice(0, n).join(".")];
      if (note) return note;
    }
    return "";
  }
  // The line in balance.js for a path.
  function lineFor(path) {
    var key = path.join(".");
    var hit = SOURCE.numbers.find(function (e) {
      return e.path.join(".") === key;
    });
    return hit ? hit.line : null;
  }
  // #endregion [D1]

  // #region [D2] Changes (what differs from the files)
  // Story values (costs, gains, city event days...) live in story.js, so a
  // copy of them is kept before any saved change is put back.
  var STORY_KEYS = ["events", "cityEvents", "checkpoints"];
  var storyFile = AT.STORY ? JSON.parse(JSON.stringify(pickStory(AT.STORY))) : null;
  function pickStory(story) {
    var out = {};
    STORY_KEYS.forEach(function (key) {
      out[key] = story[key];
    });
    return out;
  }
  // Every number in an object, as [path, value]. Sounds and pictures are skipped.
  function numbersIn(obj, path, out) {
    out = out || [];
    if (typeof obj === "number") out.push([path, obj]);
    else if (obj && typeof obj === "object") {
      Object.keys(obj).forEach(function (key) {
        if (key === "sounds" || key === "art" || key === "extras") return;
        numbersIn(obj[key], path.concat([Array.isArray(obj) ? Number(key) : key]), out);
      });
    }
    return out;
  }
  function getIn(obj, path) {
    return path.reduce(function (o, key) {
      return o == null ? undefined : o[key];
    }, obj);
  }
  function same(a, b) {
    return Math.abs(a - b) < 1e-9;
  }
  // Every change: { path, file, now, where }. where is "balance" or "story".
  function changes() {
    var list = [];
    numbersIn(AT.balance.fileValues, []).forEach(function (pair) {
      var now = getIn(AT.BALANCE, pair[0]);
      if (typeof now === "number" && !same(now, pair[1]))
        list.push({ path: pair[0], file: pair[1], now: now, where: "balance" });
    });
    if (storyFile && AT.STORY) {
      numbersIn(storyFile, []).forEach(function (pair) {
        var now = getIn(AT.STORY, pair[0]);
        if (typeof now === "number" && !same(now, pair[1]))
          list.push({ path: ["story"].concat(pair[0]), file: pair[1], now: now, where: "story" });
      });
    }
    return list;
  }
  // Saves the changes so every page puts them back (see balance.js [B14]).
  function saveChanges() {
    var list = changes().map(function (c) {
      return [c.path, c.now];
    });
    try {
      localStorage.setItem(AT.balance.changesKey, JSON.stringify(list));
    } catch (e) {
      // Private browsing can refuse storage. The changes still apply until the page closes.
    }
  }
  // Puts saved story changes back (balance.js puts back its own).
  function applySavedStoryChanges() {
    if (!AT.STORY) return;
    AT.balance.savedChanges().forEach(function (c) {
      if (c[0][0] === "story") AT.balance.setPath(AT.STORY, c[0].slice(1), c[1]);
    });
  }
  // Sets one value (a balance path, or a story path starting with "story").
  function setValue(path, value) {
    if (path[0] === "story") AT.balance.setPath(AT.STORY, path.slice(1), value);
    else AT.balance.setPath(AT.BALANCE, path, value);
    saveChanges();
    afterChange();
  }
  function fileValue(path) {
    return path[0] === "story" ? getIn(storyFile, path.slice(1)) : getIn(AT.balance.fileValues, path);
  }
  function resetAll() {
    changes().forEach(function (c) {
      if (c.where === "story") AT.balance.setPath(AT.STORY, c.path.slice(1), c.file);
      else AT.balance.setPath(AT.BALANCE, c.path, c.file);
    });
    saveChanges();
    afterChange();
  }
  // A readable name for a path, e.g. "difficulty › normal › threatPeak", or
  // for story values the event's title and the choice's label.
  function label(path) {
    if (path[0] !== "story") return path.join(" › ");
    var parts = [];
    var obj = AT.STORY;
    for (var n = 1; n < path.length; n++) {
      obj = obj && obj[path[n]];
      if (obj && obj.title) parts.push(obj.title);
      else if (obj && obj.label) parts.push(obj.label);
      else if (obj && obj.id && !obj.title) parts.push(obj.id);
      else if (typeof path[n] !== "number" && path[n] !== "choices") parts.push(path[n]);
    }
    return "story.js › " + parts.join(" › ");
  }
  // Redraws the game (if a run is going) and the panel after a change.
  function afterChange() {
    var hooks = AT.debugHooks;
    if (hooks && hooks.renderAll) {
      try {
        hooks.renderAll();
      } catch (e) {
        console.error(e);
      }
    }
    updateBadge();
    if (panel && panel.open) refreshPanelValues();
  }
  // #endregion [D2]

  // #region [D3] Writing a new balance.js
  // The text of balance.js with every changed number written in, and every
  // comment kept. Numbers that weren't changed keep their exact text (1 / 6).
  function newBalanceFile() {
    var src = AT.balance.source;
    var edits = [];
    SOURCE.numbers.forEach(function (entry) {
      var now = getIn(AT.BALANCE, entry.path);
      if (typeof now === "number" && !same(now, entry.value))
        edits.push({ start: entry.start, end: entry.end, text: numText(now) });
    });
    edits.sort(function (a, b) {
      return b.start - a.start;
    });
    edits.forEach(function (e) {
      src = src.slice(0, e.start) + e.text + src.slice(e.end);
    });
    return src;
  }
  // A number as it should be written in the file (no 0.30000000000000004).
  function numText(n) {
    return String(Math.round(n * 1e6) / 1e6);
  }
  // The changes as text, ready to paste into a note or a commit message.
  function changesText() {
    var list = changes();
    if (!list.length) return "No changes: everything matches balance.js and story.js.";
    return list
      .map(function (c) {
        var where = c.where === "story" ? "story.js" : "balance.js line " + lineFor(c.path);
        return label(c.path) + ": " + numText(c.file) + " → " + numText(c.now) + " (" + where + ")";
      })
      .join("\n");
  }
  // #endregion [D3]

  // #region [D4] Playtest log
  // Every run played in debug mode is saved in localStorage: who was in the
  // group, which changes were on, every night (horde, defense, supplies,
  // health) and how it ended. The workbook's Playtests and Nights sheets
  // come from this. The newest 100 runs are kept.
  var RUNS_KEY = "anotherTally.playtests";
  function loadRuns() {
    try {
      return JSON.parse(localStorage.getItem(RUNS_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }
  function saveRuns(runs) {
    try {
      localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(-100)));
    } catch (e) {
      console.warn("Couldn't save the playtest log.", e);
    }
  }
  var runId = null;
  // Changes as short text, e.g. "difficulty.normal.threatPeak=25".
  function changeTags() {
    return changes().map(function (c) {
      return c.path.join(".") + "=" + numText(c.now);
    });
  }
  // Updates the current run's record (making it on the first call).
  function updateRun(fn) {
    var hooks = AT.debugHooks;
    if (!hooks) return;
    var runs = loadRuns();
    var run = runs.find(function (r) {
      return r.id === runId;
    });
    if (!run) {
      var st = hooks.state;
      runId = runId || String(Date.now());
      run = {
        id: runId,
        date: new Date().toISOString(),
        difficulty: st.difficulty,
        length: st.length,
        shelter: st.shelter,
        seed: hooks.setup && hooks.setup.seed ? hooks.setup.seed : "",
        group: st.survivors.map(function (s) {
          return s.name + " (" + s.skill + ", " + s.trait + ")";
        }),
        changesAtStart: changeTags(),
        changes: changeTags(),
        tunedMidRun: false,
        cheats: 0,
        notes: "",
        result: "unfinished",
        nights: [],
      };
      runs.push(run);
    }
    fn(run);
    saveRuns(runs);
  }
  AT.debugLog = {
    // Called by game.js after each night raid.
    night: function (snap) {
      updateRun(function (run) {
        run.nights = run.nights.filter(function (n) {
          return n.day !== snap.day;
        });
        run.nights.push(snap);
        run.changes = changeTags();
        if (run.changes.join() !== run.changesAtStart.join()) run.tunedMidRun = true;
        run.daysSurvived = snap.day;
      });
    },
    // Called by game.js when the run ends, with the result end.html gets.
    end: function (result) {
      updateRun(function (run) {
        run.result = result.won ? "won" : "lost";
        run.daysSurvived = result.daysSurvived;
        run.alive = result.alive;
        run.lost = result.lost;
        run.recruited = result.found;
        run.supplies = result.supplies;
        run.events = result.events;
        run.explored = result.explored;
        run.changes = changeTags();
      });
    },
  };
  // #endregion [D4]

  // #region [D5] Workbook sheets
  // Builds the workbook as a list of sheets. Each sheet is a list of rows;
  // each cell is a value, or { v: value, f: "formula", s: "style" }.
  // Styles: title, note, head, input (a number from balance.js), changed
  // (changed in ?debug), plan (a number to play with, not in the code),
  // calc (a formula), pct, pctInput, link (pulled from another sheet), bold, wrap.
  //
  // `d` holds everything the workbook is built from:
  //   balance, fileValues, notes(path), line(path), story, game (FACILITIES,
  //   LOCATIONS, TRADERS, DISTRICTS), skills, traits (descriptions from
  //   common.js), runs (the playtest log) and changes.
  function buildSheets(d) {
    var Bal = d.balance;
    var game = d.game || {}; // names from game.js (FACILITIES, LOCATIONS, TRADERS, DISTRICTS)
    var sheets = [];
    var DIFFS = ["easy", "normal", "hard"];
    var LENGTHS = [15, 30, 45];
    var COLS = ["B", "C", "D"];
    var RES = ["food", "water", "materials", "medicine", "ammo"];
    var changedPaths = {};
    (d.changes || []).forEach(function (c) {
      changedPaths[c.path.join(".")] = true;
    });
    // An input cell: blue, or orange when changed in ?debug.
    function input(path, pct) {
      var v = getIn(Bal, path);
      var changed = changedPaths[path.join(".")];
      return { v: v, s: changed ? "changed" : pct ? "pctInput" : "input" };
    }
    // Notes stay on one line (they run on into empty cells to the right).
    function note(path) {
      return { v: d.notes(path), s: "sub" };
    }
    function sheet(name, widths, freeze) {
      var sh = { name: name, rows: [], widths: widths || [], freeze: freeze || 0 };
      sheets.push(sh);
      return sh;
    }
    // Adds a row and returns its row number (1-based, as in Excel).
    function add(sh, cells) {
      sh.rows.push(cells || []);
      return sh.rows.length;
    }
    function title(sh, text, sub) {
      add(sh, [{ v: text, s: "title" }]);
      if (sub) add(sh, [{ v: sub, s: "sub" }]);
      add(sh, []);
    }
    function head(sh, names) {
      return add(
        sh,
        names.map(function (n) {
          return { v: n, s: "head" };
        }),
      );
    }
    // Rows for every number under a path: Setting | Value | Note. [min, max]
    // pairs get two rows. Returns { "a.b": rowNumber } for formulas.
    function flatRows(sh, path, skip) {
      var rows = {};
      numbersIn(getIn(Bal, path), path).forEach(function (pair) {
        var p = pair[0];
        if (skip && skip(p)) return;
        // "health (min)" for a [min, max] pair, "upkeep › morale" for a nested value.
        var rel = p.slice(path.length);
        var name = rel.map(function (x, n) {
          if (typeof x === "number") {
            var pair = getIn(Bal, p.slice(0, path.length + n)).length === 2;
            return pair ? (x === 0 ? "(min)" : "(max)") : "[" + x + "]";
          }
          return n === 0 ? x : "› " + x;
        }).join(" ");
        rows[p.join(".")] = add(sh, [name, input(p), note(p)]);
      });
      return rows;
    }
    var stamp = d.generatedAt || new Date().toISOString().slice(0, 16).replace("T", " ");

    // ---------- Read me ----------
    var readme = sheet("Read me", [26, 100]);
    title(readme, "Another Tally — Balance Workbook", "Built " + stamp + " from js/balance.js" + (d.story ? ", js/story.js" : "") + (d.runs && d.runs.length ? " and " + d.runs.length + " logged playtest" + (d.runs.length === 1 ? "" : "s") : "") + ".");
    [
      ["Don't type into this file", "It's rebuilt from the code. Change numbers in js/balance.js (or live in the game with ?debug), then build a new workbook from the debug panel (Export › Download workbook)."],
      ["Colours", "Blue: a number from balance.js. Orange: changed in the ?debug panel but not in balance.js yet (see Changes). Black: a formula. Green: pulled from another sheet. Yellow: a planner number to play with (not in the game)."],
      ["Playing with numbers", "You can type over a blue or yellow number here to see what happens on the Horde, Economy and Scavenging sheets. To keep it, put it in balance.js."],
      ["Difficulty", "Every difficulty setting and the starting supplies."],
      ["Horde", "Horde settings, the horde each night for every difficulty and run length, and breach damage."],
      ["Economy", "Food and water the group needs, and how long the starting stock lasts."],
      ["Scavenging", "Every map location: expected haul, haul per day and injury risk on each difficulty."],
      ["Survivors", "Upkeep, needs and task numbers."],
      ["Skills & traits", "What every skill and trait does, with its numbers."],
      ["Facilities", "Base values, room in the shelter and every upgrade's cost, days and effect."],
      ["Traders", "Trade values and every trader's stock."],
      ["Events", "Event settings, rewards" + (d.story ? ", and the costs and gains of every event, city event and checkpoint in story.js" : "") + "."],
      ["Mini-games", "Every mini-game number by difficulty."],
      ["Playtests", "One row per run played with ?debug on, with win rates at the top."],
      ["Nights", "Every night of every logged run: horde, defense, supplies and the group's health. Ready for a chart or pivot table."],
      ["Changes", "Numbers changed in ?debug that aren't in balance.js or story.js yet."],
    ].forEach(function (r) {
      add(readme, [{ v: r[0], s: "bold" }, { v: r[1], s: "wrap" }]);
    });
    if (d.changes && d.changes.length) {
      add(readme, []);
      add(readme, [{ v: "Heads up", s: "bold" }, { v: d.changes.length + " number" + (d.changes.length === 1 ? " was" : "s were") + " changed in ?debug when this was built. They show in orange and are listed on the Changes sheet.", s: "wrap" }]);
    }

    // ---------- Difficulty ----------
    var dif = sheet("Difficulty", [30, 11, 11, 11, 80], 4);
    title(dif, "Difficulty", "From balance.js [B1] and [B2].");
    head(dif, ["Setting", "Easy", "Normal", "Hard", "What it does"]);
    var D = {}; // setting -> row
    var difKeys = Object.keys(Bal.difficulty.normal);
    difKeys.forEach(function (key) {
      var v = Bal.difficulty.normal[key];
      if (Array.isArray(v)) {
        ["min", "max"].forEach(function (end, n) {
          D[key + "." + end] = add(dif, [key + " (" + end + ")"].concat(DIFFS.map(function (df) {
            return input(["difficulty", df, key, n]);
          })).concat([note(["difficulty", "normal", key])]));
        });
      } else {
        D[key] = add(dif, [key].concat(DIFFS.map(function (df) {
          return input(["difficulty", df, key], key === "yield" || key === "scavRisk" || key === "autoWin");
        })).concat([note(["difficulty", "normal", key])]));
      }
    });
    add(dif, []);
    head(dif, ["Starting supplies", "Easy", "Normal", "Hard", ""]);
    RES.forEach(function (r, n) {
      D["start." + r] = add(dif, [r].concat(DIFFS.map(function (df) {
        return input(["start", "resources", df, r]);
      })).concat([n === 0 ? note(["start", "resources"]) : ""]));
    });
    function difRef(key, n) {
      return "Difficulty!$" + COLS[n] + "$" + D[key];
    }

    // ---------- Horde ----------
    var hor = sheet("Horde", [32, 11, 11, 11, 11, 11, 11, 11, 11, 11, 3, 14, 12, 14]);
    title(hor, "The horde", "Settings from balance.js [B10]. The table shows the horde estimate each night (the real horde is this ± horde.roll).");
    head(hor, ["Setting", "Value", "Note"]);
    var H = {};
    LENGTHS.forEach(function (len) {
      H["scale" + len] = add(hor, ["Length scale, " + len + "-day run", input(["horde", "lengthScale", String(len)]), note(["horde", "lengthScale"])]);
    });
    ["crowdFrom", "perSurvivor", "roll", "ammoPerGuard"].forEach(function (key) {
      H[key] = add(hor, [key, input(["horde", key]), note(["horde", key])]);
    });
    ["base", "perPoint", "max", "twoHurtAt", "wallDamageAt"].forEach(function (key) {
      H[key] = add(hor, ["breach › " + key, input(["horde", "breach", key]), note(["horde", "breach", key])]);
    });
    H.group = add(hor, ["Survivors at the shelter (planner)", { v: Bal.start.survivors, s: "plan" }, { v: "Try a bigger group to see the extra horde it draws.", s: "sub" }]);
    add(hor, []);
    var curveHead = ["Night"];
    LENGTHS.forEach(function (len) {
      DIFFS.forEach(function (df) {
        curveHead.push(df.charAt(0).toUpperCase() + df.slice(1) + " " + len);
      });
    });
    var headRow = head(hor, curveHead.concat(["", "Breach size", "Damage", "People hurt"]));
    for (var night = 1; night <= 45; night++) {
      var r = headRow + night;
      var cells = [night];
      LENGTHS.forEach(function (len) {
        DIFFS.forEach(function (df, n) {
          cells.push({
            f: "IF($A" + r + ">" + len + ',"",ROUND(' + difRef("threatBase", n) + "+" + difRef("threatPeak", n) + "*$B$" + H["scale" + len] + "*($A" + r + "/" + len + ")+MAX(0,$B$" + H.group + "-$B$" + H.crowdFrom + ")*$B$" + H.perSurvivor + ",0))",
            s: "calc",
          });
        });
      });
      if (night <= 30) {
        cells.push("", night, { f: "MIN($B$" + H.max + ",$B$" + H.base + "+$B$" + H.perPoint + "*L" + r + ")", s: "calc" }, { f: "IF(L" + r + ">=$B$" + H.twoHurtAt + ",2,1)", s: "calc" });
      }
      add(hor, cells);
    }

    // ---------- Economy ----------
    var eco = sheet("Economy", [34, 11, 11, 11, 70]);
    title(eco, "Food and water", "How long the starting stock lasts with nothing coming in. Survivalists, Cooks, Big eaters and facilities change this in the game.");
    var E = {};
    E.group = add(eco, ["Group size (planner)", { v: Bal.start.survivors, s: "plan" }, "", "", { v: "Type a different group size to compare.", s: "sub" }]);
    E.eats = add(eco, ["Food each survivor eats a day", input(["survivors", "eats"]), "", "", note(["survivors", "eats"])]);
    E.drinks = add(eco, ["Water each survivor drinks a day", input(["survivors", "drinks"]), "", "", note(["survivors", "drinks"])]);
    E.spoilAbove = add(eco, ["Food spoils above", input(["tasks", "spoil", "above"]), "", "", note(["tasks", "spoil"])]);
    E.spoilRate = add(eco, ["Share that spoils each dusk", input(["tasks", "spoil", "rate"], true), "", "", ""]);
    add(eco, []);
    head(eco, ["", "Easy", "Normal", "Hard", ""]);
    var foodRow = add(eco, ["Starting food"].concat(DIFFS.map(function (df, n) {
      return { f: difRef("start.food", n), s: "link" };
    })));
    var waterRow = add(eco, ["Starting water"].concat(DIFFS.map(function (df, n) {
      return { f: difRef("start.water", n), s: "link" };
    })));
    var needF = add(eco, ["Food needed a day"].concat(DIFFS.map(function () {
      return { f: "$B$" + E.group + "*$B$" + E.eats, s: "calc" };
    })));
    var needW = add(eco, ["Water needed a day"].concat(DIFFS.map(function () {
      return { f: "$B$" + E.group + "*$B$" + E.drinks, s: "calc" };
    })));
    add(eco, ["Days the food lasts"].concat(COLS.map(function (c) {
      return { f: "IF(" + c + needF + "=0,\"\",ROUND(" + c + foodRow + "/" + c + needF + ",1))", s: "calc" };
    })));
    add(eco, ["Days the water lasts"].concat(COLS.map(function (c) {
      return { f: "IF(" + c + needW + "=0,\"\",ROUND(" + c + waterRow + "/" + c + needW + ",1))", s: "calc" };
    })));
    LENGTHS.forEach(function (len) {
      add(eco, ["Food + water needed for a " + len + "-day run"].concat(COLS.map(function (c) {
        return { f: "(" + c + needF + "+" + c + needW + ")*" + len, s: "calc" };
      })));
    });
    add(eco, []);
    head(eco, ["Facility income", "Food a day", "Water a day", "Medicine a day", "Upgrade"]);
    Object.keys(Bal.facilities.upgrades).forEach(function (id) {
      var g = Bal.facilities.upgrades[id].gives;
      if (!g.food && !g.water && !g.medicine) return;
      var give = function (res) {
        return g[res] === undefined ? "" : input(["facilities", "upgrades", id, "gives", res]);
      };
      add(eco, [upgradeName(id), give("food"), give("water"), give("medicine"), id]);
    });

    // ---------- Scavenging ----------
    var sca = sheet("Scavenging", [24, 12, 22, 8, 8, 7, 9, 10, 10, 10, 12, 10, 10, 10, 12], 0);
    title(sca, "Scavenging", "Settings from balance.js [B8]. Expected haul is before skills, traits, city events and repeat visits.");
    head(sca, ["Setting", "Value", "Note"]);
    var S = {};
    S.rollMin = add(sca, ["roll (min)", input(["scavenging", "roll", 0]), note(["scavenging", "roll"])]);
    S.rollMax = add(sca, ["roll (max)", input(["scavenging", "roll", 1]), ""]);
    ["perDanger", "extraPerTripDay", "injuryPerDanger"].forEach(function (key) {
      S[key] = add(sca, [key, input(["scavenging", key]), note(["scavenging", key])]);
    });
    ["revisitLoss", "revisitFloor"].forEach(function (key) {
      S[key] = add(sca, [key, input(["scavenging", key], true), note(["scavenging", key])]);
    });
    add(sca, ["fenceCut › cost", input(["scavenging", "fenceCut", "cost"]), note(["scavenging", "fenceCut"])]);
    add(sca, ["fenceCut › skilledCost", input(["scavenging", "fenceCut", "skilledCost"]), ""]);
    add(sca, []);
    var locHead = head(sca, ["Location", "District", "Loot", "Danger", "Travel", "Size", "People", "Haul (E)", "Haul (N)", "Haul (H)", "Haul/day (N)", "Hurt % (E)", "Hurt % (N)", "Hurt % (H)", "Hurt damage"]);
    var locs = game.LOCATIONS || Object.keys(Bal.scavenging.locations).map(function (id) {
      return { id: id };
    });
    locs.forEach(function (l, n) {
      var r = locHead + n + 1;
      var path = ["scavenging", "locations", l.id];
      var district = game.DISTRICTS && l.district && game.DISTRICTS[l.district] ? game.DISTRICTS[l.district].name : l.district || "";
      var cells = [l.name || l.id, district, (l.loot || []).join(", "), input(path.concat(["danger"])), input(path.concat(["travel"])), input(path.concat(["size"])), input(path.concat(["people"]), true)];
      DIFFS.forEach(function (df, k) {
        cells.push({ f: "ROUND((($B$" + S.rollMin + "+$B$" + S.rollMax + ")/2+$B$" + S.perDanger + "*(D" + r + "-1)+F" + r + "+$B$" + S.extraPerTripDay + "*(E" + r + "-1))*" + difRef("yield", k) + ",1)", s: "calc" });
      });
      cells.push({ f: "ROUND(I" + r + "/E" + r + ",1)", s: "calc" });
      DIFFS.forEach(function (df, k) {
        cells.push({ f: "MIN(1," + difRef("scavRisk", k) + "*D" + r + ")", s: "pct" });
      });
      cells.push({ f: "$B$" + S.injuryPerDanger + "*D" + r, s: "calc" });
      add(sca, cells);
    });

    // ---------- Survivors ----------
    var sur = sheet("Survivors", [36, 10, 90], 0);
    title(sur, "Survivors and tasks", "From balance.js [B1], [B3] and [B4].");
    head(sur, ["Setting", "Value", "Note"]);
    flatRows(sur, ["start"], function (p) {
      return p[1] === "resources";
    });
    flatRows(sur, ["survivors"]);
    flatRows(sur, ["tasks"]);

    // ---------- Skills & traits ----------
    var skt = sheet("Skills & traits", [18, 8, 18, 9, 60, 70], 4);
    title(skt, "Skills and traits", "From balance.js [B5] and [B6]. Players only see the descriptions (common.js).");
    head(skt, ["Name", "Type", "Setting", "Value", "Note", "What players see"]);
    [["skills", "Skill", d.skills], ["traits", "Trait", d.traits]].forEach(function (group) {
      var table = Bal[group[0]];
      var names = Object.keys(table);
      Object.keys(group[2] || {}).forEach(function (n) {
        if (names.indexOf(n) === -1) names.push(n);
      });
      names.forEach(function (name) {
        var desc = group[2] && group[2][name] ? group[2][name] : "";
        var nums = table[name] ? numbersIn(table[name], [group[0], name]) : [];
        if (!nums.length) {
          add(skt, [{ v: name, s: "bold" }, group[1], "", "", { v: table[name] ? d.notes([group[0], name]) || "No numbers (see note in balance.js)." : "Does nothing in the game.", s: "note" }, { v: desc, s: "note" }]);
          return;
        }
        nums.forEach(function (pair, n) {
          var rel = pair[0].slice(2).join(" › ");
          add(skt, [n === 0 ? { v: name, s: "bold" } : "", n === 0 ? group[1] : "", rel, input(pair[0]), n === 0 ? note([group[0], name]) : "", n === 0 ? { v: desc, s: "note" } : ""]);
        });
      });
    });

    // ---------- Facilities ----------
    var fac = sheet("Facilities", [20, 20, 14, 8, 8, 30, 52, 26, 18, 10, 6], 0);
    title(fac, "Facilities", "From balance.js [B7]. Names, needs and either/or pairs come from FACILITIES in game.js.");
    head(fac, ["Base value", "Value", "Note"]);
    numbersIn(Bal.facilities.base, ["facilities", "base"]).forEach(function (pair) {
      add(fac, [pair[0][2], input(pair[0]), note(pair[0])]);
    });
    add(fac, []);
    head(fac, ["Setting", "Value", "Note"]);
    Object.keys(Bal.facilities.spaces).forEach(function (k) {
      add(fac, ["Slots: " + k, input(["facilities", "spaces", k]), note(["facilities", "spaces"])]);
    });
    ["drySpellShare", "repairShare", "repairDays", "minCost", "minDays"].forEach(function (k) {
      add(fac, [k, input(["facilities", k], k.indexOf("Share") !== -1), note(["facilities", k])]);
    });
    add(fac, []);
    var upHead = head(fac, ["Facility", "Upgrade", "id", "Cost", "Days", "Gives", "Effect (on the card)", "Needs", "Either/or", "Space", "Rain"]);
    var upRows = [];
    var groups = game.FACILITIES || [{ name: "", upgrades: Object.keys(Bal.facilities.upgrades).map(function (id) {
      return { id: id };
    }) }];
    groups.forEach(function (f) {
      f.upgrades.forEach(function (u) {
        var b = Bal.facilities.upgrades[u.id] || {};
        var gives = Object.keys(b.gives || {}).map(function (k) {
          return k + " +" + b.gives[k];
        }).join(", ");
        var needs = (u.needs || []).join(" and ") + (u.needsAny ? (u.needs && u.needs.length ? "; " : "") + u.needsAny.join(" or ") : "");
        upRows.push(add(fac, [f.name || "", u.name || u.id, u.id, input(["facilities", "upgrades", u.id, "cost"]), input(["facilities", "upgrades", u.id, "days"]), gives, { v: fillEffect(Bal, u.id), s: "wrap" }, needs, (u.excludes || []).join(", "), u.space || "", u.rain ? "yes" : ""]));
      });
    });
    if (game.FACILITIES) {
      add(fac, []);
      var sumHead = head(fac, ["Facility", "Upgrades", "Total cost", "Total days"]);
      game.FACILITIES.forEach(function (f, n) {
        var r = sumHead + n + 1;
        var first = upHead + 1;
        var last = upHead + upRows.length;
        add(fac, [f.name, { f: "COUNTIF($A$" + first + ":$A$" + last + ",A" + r + ")", s: "calc" }, { f: "SUMIF($A$" + first + ":$A$" + last + ",A" + r + ",$D$" + first + ":$D$" + last + ")", s: "calc" }, { f: "SUMIF($A$" + first + ":$A$" + last + ",A" + r + ",$E$" + first + ":$E$" + last + ")", s: "calc" }]);
      });
    }

    // ---------- Traders ----------
    var tra = sheet("Traders", [20, 16, 18, 9, 9, 8, 8, 10, 10, 8, 12], 0);
    title(tra, "Traders", "From balance.js [B9]. Names and what they want come from TRADERS in game.js.");
    head(tra, ["Resource", "Value", "Wanted price", "", "Note"]);
    var T = {};
    T.want = add(tra, ["wantBonus", input(["trade", "wantBonus"]), "", "", note(["trade", "wantBonus"])]);
    add(tra, ["stockSpread", input(["trade", "stockSpread"]), "", "", note(["trade", "stockSpread"])]);
    RES.forEach(function (res) {
      T[res] = add(tra, [res, input(["trade", "value", res]), { f: "ROUND(B" + (tra.rows.length + 1) + "*$B$" + T.want + ",0)", s: "calc" }, "", note(["trade", "value"])]);
    });
    add(tra, []);
    var trHead = head(tra, ["Trader", "Title", "Wants", "Stays (min)", "Stays (max)"].concat(RES).concat(["Stock value"]));
    var traders = game.TRADERS || Object.keys(Bal.trade.traders).map(function (id) {
      return { id: id };
    });
    traders.forEach(function (t, n) {
      var r = trHead + n + 1;
      var p = ["trade", "traders", t.id];
      var cells = [t.name || t.id, t.title || "", (t.wants || []).join(", "), input(p.concat(["stays", 0])), input(p.concat(["stays", 1]))];
      RES.forEach(function (res) {
        cells.push(input(p.concat(["stock", res])));
      });
      cells.push({ f: RES.map(function (res, k) {
        return String.fromCharCode(70 + k) + r + "*$B$" + T[res];
      }).join("+"), s: "calc" });
      add(tra, cells);
    });

    // ---------- Events ----------
    var evs = sheet("Events", [30, 34, 26, 10, 16, 16, 16, 8, 8, 8, 8, 8, 8, 12, 16], 0);
    title(evs, "Events", "Settings and rewards from balance.js [B11]" + (d.story ? "; every event's own numbers are in js/story.js." : "."));
    head(evs, ["Setting", "Value", "Note"]);
    add(evs, ["morningChance", input(["events", "morningChance"], true), note(["events", "morningChance"])]);
    add(evs, ["minigameLossDamage", input(["events", "minigameLossDamage"]), note(["events", "minigameLossDamage"])]);
    ["chance", "maxActive", "cooldown"].forEach(function (k) {
      add(evs, ["city › " + k, input(["events", "city", k], k === "chance"), note(["events", "city"])]);
    });
    ["clean", "fifth", "crooked"].forEach(function (k) {
      add(evs, ["tally › " + k, input(["tally", k]), note(["tally"])]);
    });
    add(evs, []);
    var rwHead = head(evs, ["Reward (balance.js)", "Resource", "Min", "Max", "Average"]);
    Object.keys(Bal.events.rewards).forEach(function (name) {
      var rw = Bal.events.rewards[name];
      Object.keys(rw).forEach(function (res) {
        var v = rw[res];
        var p = ["events", "rewards", name, res];
        var r = evs.rows.length + 1;
        var lo = Array.isArray(v) ? input(p.concat([0])) : input(p);
        var hi = Array.isArray(v) ? input(p.concat([1])) : { f: "C" + r, s: "calc" };
        add(evs, [name, res, lo, hi, { f: "(C" + r + "+D" + r + ")/2", s: "calc" }]);
      });
    });
    if (rwHead) add(evs, [{ v: "crate uses the Lockpick reward (Mini-games); rain also adds what your water supply makes.", s: "sub" }]);
    if (d.story) {
      add(evs, []);
      add(evs, [{ v: "Events in story.js", s: "bold" }, { v: "To change these, edit js/story.js (or try them live in the ?debug panel).", s: "sub" }]);
      head(evs, ["Event", "Choice", "Kind / needs", "When", "Cost", "Lose", "Gain / reward", "Fatigue", "Injure", "Hurt one", "Heal one", "Tire all", "Morale", "Mini-game win", "Other"]);
      var choiceRow = function (ev, c, when) {
        return [ev.title, c.label, c.kind === "skill" ? "Skill: " + c.skill : c.kind === "minigame" ? "Mini-game: " + c.game : c.kind || "", when, amounts(c.cost), amounts(c.lose), [amounts(c.gain), c.reward ? "reward: " + c.reward : ""].filter(Boolean).join("; "), c.fatigue || "", c.injure || "", c.hurtOne || "", c.healOne || "", c.fatigueAll || "", c.morale || "", c.win ? Object.keys(c.win).map(function (k) {
          return k === "gain" ? amounts(c.win.gain) : k;
        }).join(", ") : "", [c.recruit ? "recruits" : "", c.unlock ? "unlocks " + c.unlock : "", c.flag ? "flag: " + c.flag : "", c.needsFlag ? "needs flag: " + c.needsFlag : ""].filter(Boolean).join(", ")];
      };
      (d.story.events || []).forEach(function (ev) {
        var when = [ev.time, ev.minDay ? "from day " + ev.minDay : "", ev.once ? "once" : "", ev.weight ? "weight " + ev.weight : ""].filter(Boolean).join(", ");
        (ev.choices || []).forEach(function (c) {
          add(evs, choiceRow(ev, c, when));
        });
      });
      (d.story.checkpoints || []).forEach(function (cp) {
        var when = "checkpoint, day " + Object.keys(cp.days || {}).map(function (len) {
          return cp.days[len] + " of " + len;
        }).join(" / ");
        (cp.choices || []).forEach(function (c) {
          add(evs, choiceRow(cp, c, when));
        });
      });
      add(evs, []);
      head(evs, ["City event", "Where", "Days (min)", "Days (max)", "Effect", "Extra supplies", "Boosts", "People", "Danger", "Yield", "From day"]);
      (d.story.cityEvents || []).forEach(function (c) {
        add(evs, [c.title, c.where, c.days ? c.days[0] : "", c.days ? c.days[1] : "", [c.closed ? "closed" : "", c.drought ? "dry spell" : ""].filter(Boolean).join(", "), amounts(c.extra), amounts(c.boost, "x"), c.people || "", c.danger || "", c.yield || "", c.minDay || ""]);
      });
    }

    // ---------- Mini-games ----------
    var mgs = sheet("Mini-games", [12, 18, 10, 10, 10, 14, 70], 4);
    title(mgs, "Mini-games", "From balance.js [B12].");
    head(mgs, ["Game", "Setting", "Easy", "Normal", "Hard", "All", "Note"]);
    Object.keys(Bal.minigames).forEach(function (game) {
      Object.keys(Bal.minigames[game]).forEach(function (key, n) {
        var v = Bal.minigames[game][key];
        var p = ["minigames", game, key];
        var first = n === 0 ? { v: game, s: "bold" } : "";
        if (v && typeof v === "object" && !Array.isArray(v)) {
          add(mgs, [first, key, input(p.concat(["easy"])), input(p.concat(["normal"])), input(p.concat(["hard"])), "", note(p)]);
        } else if (Array.isArray(v)) {
          add(mgs, [first, key + " (min–max)", "", "", "", v.join("–"), note(p)]);
        } else {
          add(mgs, [first, key, "", "", "", input(p), note(p)]);
        }
      });
    });

    // ---------- Playtests ----------
    var runs = d.runs || [];
    var pla = sheet("Playtests", [17, 10, 8, 10, 9, 7, 7, 9, 9, 8, 10, 10, 10, 9, 22, 40, 60, 40], 0);
    title(pla, "Playtests", runs.length ? "Every run played with ?debug on (newest last)." : "No runs logged yet. Play with ?debug on and every run is logged here automatically.");
    head(pla, ["Difficulty", "Length", "Runs", "Won", "Win rate", "Avg days"]);
    var sumStart = pla.rows.length + 1;
    var tableHead = sumStart + DIFFS.length * LENGTHS.length + 1;
    var firstRun = tableHead + 1;
    var lastRun = Math.max(firstRun, tableHead + runs.length);
    DIFFS.forEach(function (df) {
      LENGTHS.forEach(function (len) {
        var r = pla.rows.length + 1;
        var rangeD = "$B$" + firstRun + ":$B$" + lastRun;
        var rangeL = "$C$" + firstRun + ":$C$" + lastRun;
        add(pla, [df, len,
          { f: "COUNTIFS(" + rangeD + ",A" + r + "," + rangeL + ",B" + r + ")", s: "calc" },
          { f: "COUNTIFS(" + rangeD + ",A" + r + "," + rangeL + ",B" + r + ",$D$" + firstRun + ":$D$" + lastRun + ',"won")', s: "calc" },
          { f: "IF(C" + r + "=0,\"\",D" + r + "/C" + r + ")", s: "pct" },
          { f: "IFERROR(AVERAGEIFS($E$" + firstRun + ":$E$" + lastRun + "," + rangeD + ",A" + r + "," + rangeL + ",B" + r + "),\"\")", s: "calc" }]);
      });
    });
    add(pla, []);
    head(pla, ["Date", "Difficulty", "Length", "Result", "Days", "Alive", "Lost", "Recruited", "Supplies", "Events", "Breached nights", "Worst breach", "Lowest food", "Cheats", "Seed", "Group", "Debug changes", "Notes"]);
    runs.forEach(function (run) {
      var nights = run.nights || [];
      var breaches = nights.filter(function (x) {
        return !x.held;
      });
      add(pla, [String(run.date || "").slice(0, 16).replace("T", " "), run.difficulty, run.length, run.result, run.daysSurvived || 0, blank(run.alive), blank(run.lost), blank(run.recruited), blank(run.supplies), blank(run.events), breaches.length, breaches.reduce(function (m, x) {
        return Math.max(m, x.breach || 0);
      }, 0), nights.length ? Math.min.apply(null, nights.map(function (x) {
        return x.food;
      })) : "", run.cheats || 0, run.seed || "", { v: (run.group || []).join("; "), s: "wrap" }, { v: (run.changes || []).join("; ") + (run.tunedMidRun ? " (changed during the run)" : ""), s: "wrap" }, { v: run.notes || "", s: "wrap" }]);
    });

    // ---------- Nights ----------
    var nig = sheet("Nights", [17, 10, 7, 6, 7, 8, 7, 7, 7, 6, 7, 7, 7, 9, 9, 7, 6, 7, 7, 7, 7, 7], 1);
    var nightCols = ["Run date", "Difficulty", "Length", "Night", "Horde", "Defense", "Walls", "Guards", "Ammo def.", "Held", "Breach", "Food", "Water", "Materials", "Medicine", "Ammo", "Alive", "Health", "Morale", "Hunger", "Fatigue", "Upgrades"];
    head(nig, nightCols);
    runs.forEach(function (run) {
      (run.nights || []).forEach(function (x) {
        add(nig, [String(run.date || "").slice(0, 16).replace("T", " "), run.difficulty, run.length, x.day, x.horde, x.defense, x.walls, x.guards, x.ammoDefense, x.held ? "yes" : "no", x.breach, x.food, x.water, x.materials, x.medicine, x.ammo, x.alive, x.health, x.morale, x.hunger, x.fatigue, x.built]);
      });
    });

    // ---------- Changes ----------
    var chg = sheet("Changes", [70, 14, 14, 22], 4);
    title(chg, "Changes not in the files yet", (d.changes || []).length ? "Changed in the ?debug panel. Copy balance.js from the panel to keep the balance.js ones; story.js ones are edited by hand." : "None: every number matches balance.js and story.js.");
    head(chg, ["Setting", "In the file", "Now", "Where"]);
    (d.changes || []).forEach(function (c) {
      add(chg, [c.label, c.file, { v: c.now, s: "changed" }, c.where === "story" ? "story.js" : "balance.js line " + (d.line(c.path) || "?")]);
    });

    return sheets;

    // Helpers for the sheets above.
    // Unfinished runs have no totals yet: an empty cell rather than a 0.
    function blank(v) {
      return v === undefined || v === null ? "" : v;
    }
    function upgradeName(id) {
      var name = id;
      (game.FACILITIES || []).forEach(function (f) {
        f.upgrades.forEach(function (u) {
          if (u.id === id) name = u.name;
        });
      });
      return name;
    }
  }
  // An effect line from a balance object (the workbook can be built from any copy).
  function fillEffect(Bal, id) {
    var u = Bal.facilities.upgrades[id];
    if (!u) return "";
    var base = Bal.facilities.base;
    return String(u.effect || "").replace(/\{(?:(base|total|every)\.)?(\w+)\}/g, function (all, kind, key) {
      var own = (u.gives || {})[key] || 0;
      var v = kind === "base" ? base[key] || 0 : kind === "total" ? (base[key] || 0) + own : kind === "every" ? (own ? 1 / own : 0) : own;
      return String(Math.round(v * 100) / 100);
    });
  }
  // { food: 2, water: [1, 2] } as "2 food, 1–2 water".
  function amounts(obj, suffix) {
    if (!obj) return "";
    return Object.keys(obj).map(function (k) {
      var v = obj[k];
      return (Array.isArray(v) ? v.join("–") : v) + (suffix ? suffix : "") + " " + k;
    }).join(", ");
  }
  // #endregion [D5]

  // #region [D6] Writing the .xlsx file
  // An .xlsx file is a zip of XML files. This writes the few it needs: one
  // per sheet, plus styles and the parts that tie them together. Formulas are
  // worked out by Excel (or LibreOffice / Google Sheets) when the file opens.
  var STYLES = {
    // name: [numFmtId, fontId, fillId, wrap]
    normal: [0, 0, 0, false],
    head: [0, 1, 2, true],
    title: [0, 2, 0, false],
    input: [0, 3, 0, false],
    note: [0, 4, 0, true],
    sub: [0, 4, 0, false],
    calc: [0, 0, 0, false],
    pct: [9, 0, 0, false],
    changed: [0, 3, 4, false],
    plan: [0, 3, 3, false],
    link: [0, 5, 0, false],
    wrap: [0, 0, 0, true],
    bold: [0, 1, 0, false],
    pctInput: [9, 3, 0, false],
  };
  var STYLE_IDS = Object.keys(STYLES);
  function stylesXml() {
    var fonts = [
      '<font><sz val="11"/><name val="Calibri"/></font>',
      '<font><b/><sz val="11"/><name val="Calibri"/></font>',
      '<font><b/><sz val="15"/><name val="Calibri"/></font>',
      '<font><sz val="11"/><color rgb="FF0000FF"/><name val="Calibri"/></font>',
      '<font><i/><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font>',
      '<font><sz val="11"/><color rgb="FF008000"/><name val="Calibri"/></font>',
    ];
    var fills = [
      '<fill><patternFill patternType="none"/></fill>',
      '<fill><patternFill patternType="gray125"/></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFE7E6E6"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFCE4D6"/><bgColor indexed="64"/></patternFill></fill>',
    ];
    var xfs = STYLE_IDS.map(function (name) {
      var s = STYLES[name];
      return '<xf numFmtId="' + s[0] + '" fontId="' + s[1] + '" fillId="' + s[2] + '" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"' + (s[3] ? ' applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' : ' applyAlignment="1"><alignment vertical="top"/></xf>');
    });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +

      '<fonts count="' + fonts.length + '">' + fonts.join("") + "</fonts>" +
      '<fills count="' + fills.length + '">' + fills.join("") + "</fills>" +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + xfs.length + '">' + xfs.join("") + "</cellXfs>" +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>";
  }
  function xmlEscape(s) {
    return String(s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function colName(n) {
    var s = "";
    n += 1;
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }
  function sheetXml(sh) {
    var rows = sh.rows.map(function (cells, r) {
      var xs = cells.map(function (cell, c) {
        if (cell === "" || cell === null || cell === undefined) return "";
        var o = typeof cell === "object" ? cell : { v: cell };
        var ref = colName(c) + (r + 1);
        var style = o.s ? STYLE_IDS.indexOf(o.s) : 0;
        var sAttr = style > 0 ? ' s="' + style + '"' : "";
        if (o.f) return '<c r="' + ref + '"' + sAttr + "><f>" + xmlEscape(o.f) + "</f></c>";
        if (o.v === undefined || o.v === null || o.v === "") return style > 0 ? '<c r="' + ref + '"' + sAttr + "/>" : "";
        if (typeof o.v === "number" && isFinite(o.v)) return '<c r="' + ref + '"' + sAttr + "><v>" + o.v + "</v></c>";
        if (typeof o.v === "boolean") return '<c r="' + ref + '"' + sAttr + ' t="b"><v>' + (o.v ? 1 : 0) + "</v></c>";
        var text = String(o.v);
        var space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
        return '<c r="' + ref + '"' + sAttr + ' t="inlineStr"><is><t' + space + ">" + xmlEscape(text) + "</t></is></c>";
      });
      return '<row r="' + (r + 1) + '">' + xs.join("") + "</row>";
    });
    var cols = sh.widths.length
      ? "<cols>" + sh.widths.map(function (w, n) {
          return '<col min="' + (n + 1) + '" max="' + (n + 1) + '" width="' + w + '" customWidth="1"/>';
        }).join("") + "</cols>"
      : "";
    var pane = sh.freeze
      ? '<pane ySplit="' + sh.freeze + '" topLeftCell="A' + (sh.freeze + 1) + '" activePane="bottomLeft" state="frozen"/>'
      : "";
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetViews><sheetView workbookViewId="0">' + pane + "</sheetView></sheetViews>" +
      '<sheetFormatPr defaultRowHeight="15"/>' + cols +
      "<sheetData>" + rows.join("") + "</sheetData></worksheet>";
  }
  // The whole .xlsx file as bytes (a Uint8Array).
  function xlsxBytes(sheets) {
    var files = [];
    var ct = ['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>', '<Default Extension="xml" ContentType="application/xml"/>', '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>', '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'];
    var rels = [];
    var list = [];
    sheets.forEach(function (sh, n) {
      var id = n + 1;
      ct.push('<Override PartName="/xl/worksheets/sheet' + id + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
      rels.push('<Relationship Id="rId' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + id + '.xml"/>');
      list.push('<sheet name="' + xmlEscape(sh.name.slice(0, 31)) + '" sheetId="' + id + '" r:id="rId' + id + '"/>');
      files.push(["xl/worksheets/sheet" + id + ".xml", sheetXml(sh)]);
    });
    rels.push('<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>');
    var head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    files.unshift(
      ["[Content_Types].xml", head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' + ct.join("") + "</Types>"],
      ["_rels/.rels", head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml", head + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + list.join("") + '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'],
      ["xl/_rels/workbook.xml.rels", head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join("") + "</Relationships>"],
      ["xl/styles.xml", stylesXml()],
    );
    return zip(files);
  }
  // A plain zip (no compression), which is all an .xlsx needs.
  var CRC_TABLE = (function () {
    var t = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zip(files) {
    var enc = new TextEncoder();
    var now = new Date();
    var time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    var parts = [];
    var central = [];
    var offset = 0;
    function u16(n) {
      return [n & 255, (n >>> 8) & 255];
    }
    function u32(n) {
      return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    }
    files.forEach(function (f) {
      var name = enc.encode(f[0]);
      var data = enc.encode(f[1]);
      var crc = crc32(data);
      var common = [].concat(u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      var local = new Uint8Array([].concat(u32(0x04034b50), common));
      parts.push(local, name, data);
      central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), common, u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
      offset += local.length + name.length + data.length;
    });
    var centralSize = central.reduce(function (t, a) {
      return t + a.length;
    }, 0);
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralSize), u32(offset), u16(0)));
    var all = parts.concat(central, [end]);
    var out = new Uint8Array(all.reduce(function (t, a) {
      return t + a.length;
    }, 0));
    var at = 0;
    all.forEach(function (a) {
      out.set(a, at);
      at += a.length;
    });
    return out;
  }
  // Everything the workbook is built from, gathered from this page.
  function workbookData() {
    var list = changes();
    return {
      balance: AT.BALANCE,
      fileValues: AT.balance.fileValues,
      notes: noteFor,
      line: lineFor,
      story: AT.STORY ? pickStory(AT.STORY) : null,
      game: AT.debugHooks ? AT.debugHooks.data : null,
      skills: AT.SKILLS,
      traits: AT.TRAITS,
      runs: loadRuns(),
      changes: list.map(function (c) {
        return { path: c.path, file: c.file, now: c.now, where: c.where, label: label(c.path) };
      }),
    };
  }
  // #endregion [D6]

  // Tools other scripts (and tests) can use, even with debug off.
  AT.debugTools = {
    readSource: readSource,
    buildSheets: buildSheets,
    xlsxBytes: xlsxBytes,
    newBalanceFile: newBalanceFile,
    changes: changes,
    noteFor: noteFor,
    lineFor: lineFor,
  };
  if (!AT.debug || typeof document === "undefined") return;

  // Story changes go back in before game.js starts using story.js.
  applySavedStoryChanges();

  // #region [D7] The panel
  var panel = null; // { el, open, tab }
  var badge = null;
  var CSS =
    ".atdbg-badge{position:fixed;left:8px;bottom:8px;z-index:2147483000;font:600 12px/1 system-ui,sans-serif;background:#b3261e;color:#fff;border:0;border-radius:4px;padding:6px 8px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.4)}" +
    ".atdbg-badge:focus-visible{outline:2px solid #fff;outline-offset:2px}" +
    ".atdbg-panel{position:fixed;top:0;right:0;bottom:0;width:min(460px,100vw);z-index:2147483001;background:#16181b;color:#e6e6e6;font:13px/1.35 system-ui,sans-serif;display:flex;flex-direction:column;box-shadow:-4px 0 16px rgba(0,0,0,.5)}" +
    ".atdbg-panel[hidden]{display:none}" +
    ".atdbg-top{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #333}" +
    ".atdbg-top h2{font-size:14px;margin:0;flex:1;color:#fff}" +
    ".atdbg-tabs{display:flex;border-bottom:1px solid #333}" +
    ".atdbg-tabs button{flex:1;background:none;border:0;border-bottom:2px solid transparent;color:#bbb;padding:8px;cursor:pointer;font:inherit}" +
    ".atdbg-tabs button[aria-selected=true]{color:#fff;border-bottom-color:#e8a33d}" +
    ".atdbg-body{overflow:auto;flex:1;padding:8px 10px 40px}" +
    ".atdbg-panel button.atdbg-btn{background:#2b2f35;color:#eee;border:1px solid #444;border-radius:4px;padding:5px 9px;cursor:pointer;font:inherit;margin:2px 4px 2px 0}" +
    ".atdbg-panel button.atdbg-btn:hover{background:#363b42}" +
    ".atdbg-panel button.atdbg-x{background:none;border:0;color:#ccc;font-size:18px;cursor:pointer;padding:0 4px}" +
    ".atdbg-panel input[type=number]{width:64px;background:#0e0f11;color:#fff;border:1px solid #444;border-radius:3px;padding:2px 4px;font:12px ui-monospace,monospace}" +
    ".atdbg-panel input.atdbg-changed{border-color:#e8a33d;background:#2d2112}" +
    ".atdbg-panel input[type=search],.atdbg-panel textarea{width:100%;box-sizing:border-box;background:#0e0f11;color:#fff;border:1px solid #444;border-radius:3px;padding:5px;font:inherit}" +
    ".atdbg-panel details{border-top:1px solid #2a2d31;padding:2px 0}" +
    ".atdbg-panel summary{cursor:pointer;padding:5px 0;font-weight:600;color:#fff}" +
    ".atdbg-group{margin:4px 0 8px;padding-left:6px;border-left:2px solid #2e3238}" +
    ".atdbg-gname{color:#9ab;font-size:12px;margin:6px 0 2px}" +
    ".atdbg-row{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;padding:2px 0}" +
    ".atdbg-row .atdbg-name{flex:1 1 140px;min-width:120px;font:12px ui-monospace,monospace;color:#ddd}" +
    ".atdbg-row .atdbg-sub{font-size:11px;color:#999}" +
    ".atdbg-row .atdbg-was{font-size:11px;color:#e8a33d;cursor:pointer;text-decoration:underline dotted}" +
    ".atdbg-note{flex-basis:100%;font-size:11px;color:#8a8f96;margin:0 0 2px}" +
    ".atdbg-effect{font-size:11px;color:#b9d38a;margin:0 0 4px}" +
    ".atdbg-muted{color:#999;font-size:12px}" +
    ".atdbg-stat{display:grid;grid-template-columns:1fr auto;gap:2px 10px;margin:6px 0 10px}" +
    ".atdbg-panel pre{white-space:pre-wrap;background:#0e0f11;border:1px solid #333;padding:6px;font:11px ui-monospace,monospace;max-height:220px;overflow:auto}" +
    ".atdbg-panel h3{font-size:13px;margin:14px 0 6px;color:#fff}" +
    ".atdbg-hide{display:none!important}";

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "className") e.className = attrs[k];
      else if (k.indexOf("on") === 0) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  function button(text, onclick, title) {
    var b = el("button", { type: "button", className: "atdbg-btn", text: text, onclick: onclick });
    if (title) b.title = title;
    return b;
  }
  function updateBadge() {
    if (!badge) return;
    var n = changes().length;
    badge.textContent = "DEBUG" + (n ? " · " + n + " change" + (n === 1 ? "" : "s") : "");
  }
  function makeBadge() {
    document.head.appendChild(el("style", { text: CSS }));
    badge = el("button", {
      type: "button",
      className: "atdbg-badge",
      title: "Balance debug panel (press `). Turn debug off with ?debug=off.",
      onclick: togglePanel,
    });
    document.body.appendChild(badge);
    updateBadge();
  }
  function togglePanel() {
    if (!panel) buildPanel();
    panel.open = !panel.open;
    panel.el.hidden = !panel.open;
    if (panel.open) showTab(panel.tab);
  }
  function buildPanel() {
    var tabs = ["Tune", "Run", "Export"];
    var body = el("div", { className: "atdbg-body" });
    var tabBar = el("div", { className: "atdbg-tabs", role: "tablist" }, tabs.map(function (t) {
      return el("button", { type: "button", role: "tab", "data-tab": t, text: t, onclick: function () {
        showTab(t);
      } });
    }));
    var root = el("aside", { className: "atdbg-panel", "aria-label": "Balance debug panel", hidden: "" }, [
      el("div", { className: "atdbg-top" }, [
        el("h2", { text: "Balance debug" }),
        el("button", { type: "button", className: "atdbg-x", "aria-label": "Close", text: "×", onclick: togglePanel }),
      ]),
      tabBar,
      body,
    ]);
    document.body.appendChild(root);
    panel = { el: root, body: body, tabBar: tabBar, open: false, tab: "Tune", inputs: [] };
  }
  function showTab(name) {
    panel.tab = name;
    Array.prototype.forEach.call(panel.tabBar.children, function (b) {
      b.setAttribute("aria-selected", String(b.dataset.tab === name));
    });
    panel.body.innerHTML = "";
    panel.inputs = [];
    if (name === "Tune") tuneTab(panel.body);
    else if (name === "Run") runTab(panel.body);
    else exportTab(panel.body);
  }

  // ---------- Tune tab ----------
  // Every number in balance.js (and story.js), grouped the way the file is.
  // Small groups of numbers ({ easy, normal, hard }, [min, max], gives) sit
  // on one row.
  var filterText = "";
  var onlyChanged = false;
  function tuneTab(body) {
    var search = el("input", { type: "search", placeholder: "Filter (e.g. threat, Fighter, cots, police)", value: filterText });
    search.addEventListener("input", function () {
      filterText = search.value;
      applyFilter();
    });
    var only = el("input", { type: "checkbox" });
    only.checked = onlyChanged;
    only.addEventListener("change", function () {
      onlyChanged = only.checked;
      applyFilter();
    });
    body.appendChild(search);
    body.appendChild(el("label", { className: "atdbg-muted" }, [only, " Only show changed numbers"]));
    body.appendChild(el("p", { className: "atdbg-muted", text: "Changes apply at once. Orange = different from the file (click the old value to put it back)." }));
    Object.keys(AT.BALANCE).forEach(function (key) {
      var det = el("details", { "data-section": key }, [el("summary", { text: key })]);
      det.addEventListener("toggle", function () {
        if (det.open && !det.dataset.built) {
          det.dataset.built = "1";
          groupRows(det, AT.BALANCE[key], [key], key);
          applyFilter();
        }
      });
      body.appendChild(det);
    });
    if (AT.STORY) {
      var story = el("details", { "data-section": "story" }, [el("summary", { text: "story.js (events, city events, checkpoints)" })]);
      story.addEventListener("toggle", function () {
        if (story.open && !story.dataset.built) {
          story.dataset.built = "1";
          storyRows(story);
          applyFilter();
        }
      });
      body.appendChild(story);
    } else {
      body.appendChild(el("p", { className: "atdbg-muted", text: "Event costs and gains (story.js) can be changed from the game screen." }));
    }
    if (filterText || onlyChanged) openAllAndFilter();
  }
  // True for { easy, normal, hard }, [min, max], or another small set of numbers.
  function smallSet(v) {
    if (!v || typeof v !== "object") return false;
    var keys = Object.keys(v);
    return keys.length > 0 && keys.length <= 6 && keys.every(function (k) {
      return typeof v[k] === "number";
    });
  }
  // Rows for one object: its numbers and small sets first, then its bigger children as groups.
  function groupRows(parent, obj, path, name) {
    // A section (path of one) fills its own <details>; everything below it gets a group box.
    var box = path.length === 1 ? parent : el("div", { className: "atdbg-group", "data-search": path.join(" ").toLowerCase() });
    if (box !== parent) {
      box.appendChild(el("div", { className: "atdbg-gname", text: name }));
      parent.appendChild(box);
    }
    var upgrade = path[0] === "facilities" && path[1] === "upgrades" && path.length === 3;
    if (upgrade) box.appendChild(el("div", { className: "atdbg-effect", "data-effect": path[2], text: AT.balance.effect(path[2]) }));
    Object.keys(obj).forEach(function (key) {
      var v = obj[key];
      var p = path.concat([Array.isArray(obj) ? Number(key) : key]);
      if (typeof v === "number" || smallSet(v)) box.appendChild(numberRow(p, key, v));
    });
    Object.keys(obj).forEach(function (key) {
      var v = obj[key];
      if (v && typeof v === "object" && !smallSet(v)) groupRows(box, v, path.concat([key]), key);
    });
  }
  function storyRows(parent) {
    ["events", "checkpoints", "cityEvents"].forEach(function (list) {
      (AT.STORY[list] || []).forEach(function (ev, n) {
        var nums = numbersIn(ev, ["story", list, n]);
        if (!nums.length) return;
        var box = el("div", { className: "atdbg-group", "data-search": ("story " + list + " " + (ev.title || ev.id)).toLowerCase() });
        box.appendChild(el("div", { className: "atdbg-gname", text: (ev.title || ev.id) + (ev.time ? " (" + ev.time + ")" : list === "cityEvents" ? " (city)" : list === "checkpoints" ? " (checkpoint)" : "") }));
        nums.forEach(function (pair) {
          var p = pair[0];
          var rel = [];
          var obj = ev;
          p.slice(3).forEach(function (k) {
            obj = obj[k];
            rel.push(obj && obj.label ? "“" + obj.label + "”" : String(k));
          });
          box.appendChild(numberRow(p, rel.join(" › "), pair[1], true));
        });
        parent.appendChild(box);
      });
    });
  }
  // One row: a name, an input for each number, the file's value when changed, and the note.
  function numberRow(path, name, v, noNote) {
    var row = el("div", { className: "atdbg-row", "data-search": (path.join(" ") + " " + (noNote ? "" : noteFor(path))).toLowerCase() });
    row.appendChild(el("span", { className: "atdbg-name", text: name }));
    var cells = typeof v === "number" ? [[path, ""]] : Object.keys(v).map(function (k) {
      return [path.concat([Array.isArray(v) ? Number(k) : k]), Array.isArray(v) ? (Object.keys(v).length === 2 ? (k === "0" ? "min" : "max") : k) : k];
    });
    cells.forEach(function (c) {
      if (c[1]) row.appendChild(el("span", { className: "atdbg-sub", text: c[1] }));
      var input = el("input", { type: "number", step: "any", "aria-label": c[0].join(" ") });
      input.addEventListener("change", function () {
        if (input.value === "" || !isFinite(Number(input.value))) return refreshPanelValues();
        setValue(c[0], Number(input.value));
      });
      row.appendChild(input);
      var was = el("span", { className: "atdbg-was", title: "Value in the file. Click to put it back." });
      was.addEventListener("click", function () {
        setValue(c[0], fileValue(c[0]));
      });
      row.appendChild(was);
      panel.inputs.push({ path: c[0], input: input, was: was, row: row });
    });
    var note = noNote ? "" : SOURCE.notes[path.join(".")] || "";
    if (note) row.appendChild(el("div", { className: "atdbg-note", text: note }));
    setRowValues(row);
    return row;
  }
  function getValue(path) {
    return path[0] === "story" ? getIn(AT.STORY, path.slice(1)) : getIn(AT.BALANCE, path);
  }
  // Shows each input's value, and marks it (and its row) when it differs
  // from the file. row: just that row, or null for every row.
  function setRowValues(row) {
    var mine = panel.inputs.filter(function (i) {
      return !row || i.row === row;
    });
    mine.forEach(function (i) {
      i.row.dataset.changed = "";
    });
    mine.forEach(function (i) {
      var now = getValue(i.path);
      var file = fileValue(i.path);
      var changed = typeof file === "number" && !same(now, file);
      if (document.activeElement !== i.input) i.input.value = numText(now);
      i.input.classList.toggle("atdbg-changed", changed);
      i.was.textContent = changed ? "was " + numText(file) : "";
      if (changed) i.row.dataset.changed = "1";
    });
  }
  function refreshPanelValues() {
    if (panel.tab === "Tune") {
      setRowValues(null);
      panel.body.querySelectorAll("[data-effect]").forEach(function (e) {
        e.textContent = AT.balance.effect(e.dataset.effect);
      });
      if (onlyChanged) applyFilter();
    } else showTab(panel.tab);
  }
  function openAllAndFilter() {
    panel.body.querySelectorAll("details").forEach(function (det) {
      if (!det.open) det.open = true;
      else if (!det.dataset.built) det.dispatchEvent(new Event("toggle"));
    });
    applyFilter();
  }
  function applyFilter() {
    var words = filterText.toLowerCase().split(/\s+/).filter(Boolean);
    if ((words.length || onlyChanged) && panel.body.querySelector("details:not([open])")) {
      panel.body.querySelectorAll("details:not([open])").forEach(function (det) {
        det.open = true;
      });
      return; // opening builds the rows, which calls applyFilter again
    }
    panel.body.querySelectorAll(".atdbg-row").forEach(function (row) {
      var text = row.dataset.search;
      var group = row.closest(".atdbg-group");
      while (group) {
        text += " " + group.dataset.search;
        group = group.parentElement.closest(".atdbg-group");
      }
      var hit = words.every(function (w) {
        return text.indexOf(w) !== -1;
      });
      row.classList.toggle("atdbg-hide", !hit || (onlyChanged && row.dataset.changed !== "1"));
    });
    panel.body.querySelectorAll(".atdbg-group").forEach(function (g) {
      g.classList.toggle("atdbg-hide", !g.querySelector(".atdbg-row:not(.atdbg-hide)"));
    });
    // While filtering, sections with nothing left to show are hidden too.
    var filtering = words.length > 0 || onlyChanged;
    panel.body.querySelectorAll("details").forEach(function (det) {
      det.classList.toggle("atdbg-hide", filtering && !det.querySelector(".atdbg-row:not(.atdbg-hide)"));
    });
  }
  // #endregion [D7]

  // #region [D8] Run tools
  // What tonight looks like, and quick ways to set up a situation to test.
  // Each use is counted on the run's playtest record as a cheat.
  function cheat(fn) {
    var hooks = AT.debugHooks;
    fn(hooks.state, hooks);
    updateRun(function (run) {
      run.cheats = (run.cheats || 0) + 1;
    });
    hooks.renderAll();
    showTab("Run");
  }
  function runTab(body) {
    var hooks = AT.debugHooks;
    if (!hooks) {
      body.appendChild(el("p", { className: "atdbg-muted", text: "Start a run (New game) to see tonight's numbers and the run tools. The Tune and Export tabs work on any page." }));
      return;
    }
    var st = hooks.state;
    var threat = hooks.threatTonight();
    var stats = [
      ["Day", st.day + " of " + st.length + " (" + st.difficulty + ")"],
      ["Tonight's horde (estimate)", threat],
      ["Tonight's horde (real)", Math.max(1, threat + st.hordeRoll) + " (roll " + (st.hordeRoll >= 0 ? "+" : "") + st.hordeRoll + ")"],
      ["Night defense (if walls finish today)", hooks.nightDefense(true)],
    ];
    body.appendChild(el("div", { className: "atdbg-stat" }, [].concat.apply([], stats.map(function (s) {
      return [el("span", { text: s[0] }), el("strong", { text: String(s[1]) })];
    }))));
    body.appendChild(el("h3", { text: "Supplies" }));
    body.appendChild(el("div", {}, [
      button("+5 of each", function () {
        cheat(function (s) {
          Object.keys(s.resources).forEach(function (k) {
            s.resources[k] += 5;
          });
        });
      }),
      button("+20 materials", function () {
        cheat(function (s) {
          s.resources.materials += 20;
        });
      }),
      button("+10 ammo", function () {
        cheat(function (s) {
          s.resources.ammo += 10;
        });
      }),
      button("Empty food and water", function () {
        cheat(function (s) {
          s.resources.food = 0;
          s.resources.water = 0;
        });
      }),
    ]));
    body.appendChild(el("h3", { text: "Survivors" }));
    body.appendChild(el("div", {}, [
      button("Heal and rest everyone", function () {
        cheat(function (s, h) {
          s.survivors.forEach(function (p) {
            if (!p.alive) return;
            h.heal(p, 100);
            p.fatigue = 0;
            p.hunger = 0;
          });
        });
      }),
      button("Everyone tired (90)", function () {
        cheat(function (s) {
          s.survivors.forEach(function (p) {
            if (p.alive) p.fatigue = 90;
          });
        });
      }),
      button("Morale to 20", function () {
        cheat(function (s) {
          s.survivors.forEach(function (p) {
            if (p.alive) p.morale = 20;
          });
        });
      }),
    ]));
    body.appendChild(el("h3", { text: "Day" }));
    var day = el("input", { type: "number", min: "1", max: String(st.length), value: String(st.day), "aria-label": "Day" });
    body.appendChild(el("div", {}, [
      day,
      " ",
      button("Jump to this day", function () {
        var n = Math.max(1, Math.min(st.length, Math.round(Number(day.value) || st.day)));
        cheat(function (s) {
          while (s.tallies.length < n) s.tallies.push(true);
          s.tallies.length = n;
          s.day = n;
        });
      }, "Sets the day (and the tally marks) without playing the days between."),
      button("Re-roll tonight's horde", function () {
        cheat(function (s) {
          var r = AT.BALANCE.horde.roll;
          s.hordeRoll = Math.floor(Math.random() * (2 * r + 1)) - r;
        });
      }),
    ]));
    body.appendChild(el("h3", { text: "Notes for this playtest" }));
    var notes = el("textarea", { rows: "3", placeholder: "What did you notice? Saved with this run in the playtest log." });
    var current = loadRuns().find(function (r) {
      return r.id === runId;
    });
    notes.value = current ? current.notes || "" : "";
    notes.addEventListener("change", function () {
      updateRun(function (run) {
        run.notes = notes.value;
      });
    });
    body.appendChild(notes);
  }
  // #endregion [D8]

  // #region [D9] Export tools
  function exportTab(body) {
    var list = changes();
    body.appendChild(el("h3", { text: list.length ? list.length + " change" + (list.length === 1 ? "" : "s") + " not in the files yet" : "No changes" }));
    body.appendChild(el("pre", { text: changesText() }));
    body.appendChild(el("div", {}, [
      button("Copy balance.js", function () {
        copy(newBalanceFile(), "The new balance.js is copied. Paste it over js/balance.js.");
      }, "The whole file with your changes written in and every comment kept."),
      button("Download balance.js", function () {
        download("balance.js", newBalanceFile(), "text/javascript");
      }),
      button("Copy list", function () {
        copy(changesText(), "The list of changes is copied.");
      }),
      button("Reset all changes", function () {
        if (window.confirm("Put every number back to what balance.js and story.js say?")) resetAll();
      }),
    ]));
    if (list.some(function (c) {
      return c.where === "story";
    }))
      body.appendChild(el("p", { className: "atdbg-muted", text: "story.js changes aren't written into balance.js: change those in js/story.js by hand (the list shows each one)." }));
    var runs = loadRuns();
    body.appendChild(el("h3", { text: "Workbook" }));
    body.appendChild(el("p", { className: "atdbg-muted", text: "Builds Another_Tally_Balance.xlsx from balance.js (with any changes above), story.js and " + runs.length + " logged playtest" + (runs.length === 1 ? "" : "s") + ". Save it over the old one in the project folder." + (AT.debugHooks ? "" : " Open it from the game screen to include facility, map and trader names.") }));
    body.appendChild(el("div", {}, [
      button("Download workbook", function () {
        var bytes = xlsxBytes(buildSheets(workbookData()));
        download("Another_Tally_Balance.xlsx", bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      }),
      button("Clear playtest log", function () {
        if (window.confirm("Delete all " + runs.length + " logged playtests? This can't be undone.")) {
          saveRuns([]);
          runId = null;
          showTab("Export");
        }
      }),
    ]));
    body.appendChild(el("h3", { text: "Debug mode" }));
    body.appendChild(el("p", { className: "atdbg-muted", text: "Saved changes only apply while debug mode is on. Turning it off plays with the numbers in the files." }));
    body.appendChild(button("Turn debug off", function () {
      sessionStorage.removeItem(AT.balance.debugKey);
      window.location.search = "";
    }));
  }
  function copy(text, done) {
    function fallback() {
      var area = el("textarea", { style: "position:fixed;left:-9999px" });
      area.value = text;
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      area.remove();
      window.alert(ok ? done : "Couldn't copy. Use Download instead.");
    }
    if (navigator.clipboard && window.isSecureContext)
      navigator.clipboard.writeText(text).then(function () {
        window.alert(done);
      }, fallback);
    else fallback();
  }
  function download(name, data, type) {
    var url = URL.createObjectURL(new Blob([data], { type: type }));
    var a = el("a", { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }
  // #endregion [D9]

  // #region [D10] Start-up
  function start() {
    makeBadge();
    // On the game screen, start this run's playtest record straight away.
    if (AT.debugHooks) {
      runId = String(Date.now());
      updateRun(function () {});
    }
    document.addEventListener("keydown", function (e) {
      if (e.key !== "`" || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      togglePanel();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  // #endregion [D10]
})();

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
It contains the logic for setting up a new game 
and rolling starting survivors.
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

  // Define constants for survivor names.
  var NAMES = [
    "Liam",
    "Olivia",
    "Noah",
    "Emma",
    "Oliver",
    "Amelia",
    "Theodore",
    "Charlotte",
    "James",
    "Mia",
    "Henry",
    "Sophia",
    "Mateo",
    "Isabella",
    "Elijah",
    "Evelyn",
    "Lucas",
    "Ava",
    "William",
    "Sofia",
    "Benjamin",
    "Camila",
    "Levi",
    "Harper",
    "Ezra",
    "Luna",
    "Sebastian",
    "Eleanor",
    "Jack",
    "Violet",
    "Daniel",
    "Aurora",
    "Samuel",
    "Elizabeth",
    "Michael",
    "Eliana",
    "Grayson",
    "Hazel",
    "Ethan",
    "Chloe",
    "Asher",
    "Ellie",
    "John",
    "Nora",
    "Hudson",
    "Gianna",
    "Luca",
    "Lily",
    "Leo",
    "Emily",
    "Elias",
    "Aria",
    "Kai",
    "Scarlett",
    "Theo",
    "Willow",
    "Owen",
    "Penelope",
    "Alexander",
    "Zoe",
    "Dylan",
    "Ella",
    "Gabriel",
    "Avery",
    "Santiago",
    "Elena",
    "Mason",
    "Abigail",
    "Julian",
    "Mila",
    "David",
    "Lucy",
    "Joseph",
    "Isla",
    "Carter",
    "Ivy",
    "Matthew",
    "Layla",
    "Luke",
    "Delilah",
    "Aiden",
    "Riley",
    "Jackson",
    "Lainey",
    "Maverick",
    "Nova",
    "Miles",
    "Grace",
    "Wyatt",
    "Goldie",
    "Thomas",
    "Winter",
    "Isaac",
    "Arabella",
    "Josiah",
    "Anastasia",
    "Hugo",
    "Myla",
    "Arthur",
    "Leah",
  ];

  // Define constants for skills and traits as defined in common.js.
  var SKILLS = Object.keys(AT.SKILLS);
  var TRAITS = Object.keys(AT.TRAITS);

  // Define constants for shelters.
  var SHELTERS = [
    "Abandoned shopping mall storefront",
    "Department store",
    "Supermarket",
    "Abandoned electronics store",
    "Furniture warehouse",
    "Hardware store",
    "Multi-storey parking garage",
    "Corporate skyscraper",
    "Abandoned apartment complex",
    "Luxury penthouse",
    "Office tower",
    "Abandoned hotel",
    "Student residence",
    "Condemned condominium",
    "Old courthouse",
    "Abandoned bank",
    "Newspaper headquarters",
    "Underground subway station",
    "Abandoned train station",
    "Subway maintenance depot",
    "Bus terminal",
    "Underground pedestrian tunnel",
    "Multi-level parking structure",
    "Fire station",
    "Medical clinic",
    "Public library",
    "Museum",
    "Industrial factory",
    "Water treatment facility",
    "Rooftop greenhouse",
    "Abandoned nightclub",
    "Television broadcasting station",
    "Cathedral",
    "Abandoned theatre",
    "Museum storage basement",
    "Underground data centre",
    "Restaurant",
    "Abandoned city hall",
  ];

  // Define constants for avatars corresponding to survivor image file names.
  var AVATARS = [1, 2, 3, 4, 5, 6]; // assets/images/png/survivor-N.png

  // Load settings, create a random number generator, and set up the new game form.
  var settings = AT.load();
  var rng = AT.makeRng(settings.seed);
  var form = document.getElementById("new-game-form");
  var list = document.getElementById("survivor-list");
  var survivors = [];

  // This function picks a random element from an array, optionally excluding elements in a "taken" array.
  function pick(arr, taken) {
    var pool = arr.filter(function (x) {
      return !taken || taken.indexOf(x) === -1;
    });
    return pool[Math.floor(rng() * pool.length)];
  }

  // This function rolls 3 starting survivors with unique names, skills, and avatars.
  function roll() {
    var names = [],
      skills = [],
      avatars = [];
    survivors = [0, 1, 2].map(function () {
      var name = pick(NAMES, names);
      names.push(name);
      var skill = pick(SKILLS, skills);
      skills.push(skill); // no duplicate skills in the starting group
      var avatar = pick(AVATARS, avatars);
      avatars.push(avatar); // each starting survivor looks different
      return { name: name, skill: skill, trait: pick(TRAITS), avatar: avatar };
    });
    render();
  }

  // This function renders the list of rolled survivors in the HTML document.
  function render() {
    list.innerHTML = survivors
      .map(function (s) {
        return (
          '<li class="card survivor-card">' +
          '<img class="avatar portrait" src="assets/images/png/survivor-' +
          s.avatar +
          '.png" alt="">' +
          "<div><h3>" +
          AT.escapeHtml(s.name) +
          "</h3>" +
          '<div class="tags"><span class="chip">' +
          s.skill +
          '</span><span class="chip">' +
          s.trait +
          "</span></div>" +
          '<ul class="perk-list small muted">' +
          "<li><strong>" +
          s.skill +
          ":</strong> " +
          AT.SKILLS[s.skill] +
          "</li>" +
          "<li><strong>" +
          s.trait +
          ":</strong> " +
          AT.TRAITS[s.trait] +
          "</li>" +
          "</ul></div>" +
          "</li>"
        );
      })
      .join("");
  }

  // Defaults come from the Options page.
  form.elements.shelter.placeholder = pick(SHELTERS);
  form.querySelector(
    '[name="difficulty"][value="' + settings.difficulty + '"]',
  ).checked = true;
  form.querySelector(
    '[name="length"][value="' + settings.length + '"]',
  ).checked = true;

  document.getElementById("reroll").addEventListener("click", roll);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = new FormData(form);
    AT.handoff.setSetup({
      shelter:
        String(data.get("shelter") || "").trim() ||
        form.elements.shelter.placeholder,
      difficulty: data.get("difficulty"),
      length: Number(data.get("length")),
      seed: settings.seed,
      survivors: survivors,
    });
    location.href = "game.html";
  });

  roll();
})();

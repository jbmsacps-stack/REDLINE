import "../css/variables.css";
import "../css/reset.css";
import "../css/style.css";

import { exercises } from "./data.js";
import gsap from "gsap";

const app = document.querySelector("#app");

let activeMuscle = "All";
let activeEquipment = "All";
let searchTerm = "";

const muscleViews = {
  front: [
    "Chest",
    "Shoulders",
    "Biceps",
    "Triceps",
    "Abs",
    "Quads",
  ],
  back: [
    "Traps",
    "Lats",
    "Rear Delts",
    "Triceps",
    "Glutes",
    "Hamstrings",
    "Calves",
  ],
};

let muscleView = "front";

const equipment = [
  "All",
  "Barbell",
  "Dumbbell",
  "Cable",
  "Machine",
];

function exerciseCard(exercise) {
  return `
    <article
      class="exercise-card"
      data-id="${exercise.id}"
    >
      <div class="exercise-card-top">
        <span class="exercise-type">
          ${exercise.type}
        </span>

        <button
          class="equipment-button"
          aria-label="${exercise.equipment}"
          title="${exercise.equipment}"
        >
          ${equipmentIcon(exercise.equipment)}
        </button>
      </div>

      <div class="exercise-visual">
        <span class="visual-letter">
          ${exercise.name.charAt(0)}
        </span>
      </div>

      <div class="exercise-content">
        <div class="exercise-meta">
          <span>${exercise.muscle}</span>
          <span>•</span>
          <span>${exercise.difficulty}</span>
        </div>

        <h3 class="exercise-name">
          ${exercise.name}
        </h3>

        <span class="exercise-equipment">
          ${exercise.equipment}
        </span>
      </div>
    </article>
  `;
}

function equipmentIcon(type) {
  const icons = {
    Barbell: "━",
    Dumbbell: "◈",
    Cable: "╱",
    Machine: "▣",
    Bodyweight: "○",
  };

  return icons[type] || "•";
}

function muscleMap() {
  const selected = activeMuscle;

  return `
    <div class="muscle-filter">

      <div class="muscle-filter-header">
        <div>
          <span class="filter-heading">Muscle</span>

          <button
            class="all-muscles ${selected === "All" ? "active" : ""}"
            data-muscle="All"
          >
            All muscles
          </button>
        </div>

        <button
          class="muscle-collapse"
          id="muscle-collapse"
          aria-label="Collapse muscle selector"
        >
          ↑
        </button>
      </div>


      <div class="muscle-filter-body">

        <div class="muscle-view-toggle">
          <button
            class="${muscleView === "front" ? "active" : ""}"
            data-view="front"
          >
            Front
          </button>

          <button
            class="${muscleView === "back" ? "active" : ""}"
            data-view="back"
          >
            Back
          </button>
        </div>


        <div class="muscle-map">

          ${
            muscleView === "front"
              ? `
                <svg
                  class="body-svg"
                  viewBox="0 0 220 500"
                  aria-label="Front body muscle map"
                >

                  <!-- Head -->
                  <circle
                    class="body-part"
                    cx="110"
                    cy="35"
                    r="23"
                  />

                  <!-- Neck -->
                  <rect
                    class="body-part"
                    x="98"
                    y="55"
                    width="24"
                    height="25"
                    rx="8"
                  />

                  <!-- Shoulders -->
                  <path
                    class="muscle-part ${selected === "Shoulders" ? "selected" : ""}"
                    data-muscle="Shoulders"
                    d="M98 76
                       C80 73 60 82 49 98
                       L61 123
                       C75 113 87 108 98 106Z"
                  />

                  <path
                    class="muscle-part ${selected === "Shoulders" ? "selected" : ""}"
                    data-muscle="Shoulders"
                    d="M122 76
                       C140 73 160 82 171 98
                       L159 123
                       C145 113 133 108 122 106Z"
                  />

                  <!-- Chest -->
                  <path
                    class="muscle-part ${selected === "Chest" ? "selected" : ""}"
                    data-muscle="Chest"
                    d="M97 84
                       C83 84 70 91 66 104
                       C72 118 86 125 108 126
                       L108 92Z"
                  />

                  <path
                    class="muscle-part ${selected === "Chest" ? "selected" : ""}"
                    data-muscle="Chest"
                    d="M123 84
                       C137 84 150 91 154 104
                       C148 118 134 125 112 126
                       L112 92Z"
                  />

                  <!-- Biceps -->
                  <path
                    class="muscle-part ${selected === "Biceps" ? "selected" : ""}"
                    data-muscle="Biceps"
                    d="M50 100
                       C41 110 37 129 42 149
                       C45 159 54 162 61 153
                       L66 126Z"
                  />

                  <path
                    class="muscle-part ${selected === "Biceps" ? "selected" : ""}"
                    data-muscle="Biceps"
                    d="M170 100
                       C179 110 183 129 178 149
                       C175 159 166 162 159 153
                       L154 126Z"
                  />

                  <!-- Triceps -->
                  <path
                    class="muscle-part ${selected === "Triceps" ? "selected" : ""}"
                    data-muscle="Triceps"
                    d="M42 110
                       C34 123 32 143 37 159
                       C40 168 46 169 50 160
                       L53 143Z"
                  />

                  <path
                    class="muscle-part ${selected === "Triceps" ? "selected" : ""}"
                    data-muscle="Triceps"
                    d="M178 110
                       C186 123 188 143 183 159
                       C180 168 174 169 170 160
                       L167 143Z"
                  />

                  <!-- Abs -->
                  <rect
                    class="muscle-part ${selected === "Abs" ? "selected" : ""}"
                    data-muscle="Abs"
                    x="92"
                    y="128"
                    width="36"
                    height="83"
                    rx="12"
                  />

                  <!-- Quads -->
                  <path
                    class="muscle-part ${selected === "Quads" ? "selected" : ""}"
                    data-muscle="Quads"
                    d="M90 210
                       C80 224 76 260 79 302
                       C82 320 94 328 105 310
                       L108 213Z"
                  />

                  <path
                    class="muscle-part ${selected === "Quads" ? "selected" : ""}"
                    data-muscle="Quads"
                    d="M130 210
                       C140 224 144 260 141 302
                       C138 320 126 328 115 310
                       L112 213Z"
                  />

                  <!-- Lower legs -->
                  <path
                    class="body-part"
                    d="M80 320
                       L105 320
                       L101 425
                       L82 425Z"
                  />

                  <path
                    class="body-part"
                    d="M140 320
                       L115 320
                       L119 425
                       L138 425Z"
                  />

                </svg>
              `
              : `
                <svg
                  class="body-svg"
                  viewBox="0 0 220 500"
                  aria-label="Back body muscle map"
                >

                  <!-- Head -->
                  <circle
                    class="body-part"
                    cx="110"
                    cy="35"
                    r="23"
                  />

                  <!-- Neck -->
                  <rect
                    class="body-part"
                    x="98"
                    y="55"
                    width="24"
                    height="25"
                    rx="8"
                  />

                  <!-- Rear Delts -->
                  <path
                    class="muscle-part ${selected === "Rear Delts" ? "selected" : ""}"
                    data-muscle="Rear Delts"
                    d="M98 76
                       C80 74 62 84 52 99
                       L63 122
                       C78 113 88 108 98 106Z"
                  />

                  <path
                    class="muscle-part ${selected === "Rear Delts" ? "selected" : ""}"
                    data-muscle="Rear Delts"
                    d="M122 76
                       C140 74 158 84 168 99
                       L157 122
                       C142 113 132 108 122 106Z"
                  />

                  <!-- Traps -->
                  <path
                    class="muscle-part ${selected === "Traps" ? "selected" : ""}"
                    data-muscle="Traps"
                    d="M99 78
                       L110 69
                       L121 78
                       L133 102
                       L110 115
                       L87 102Z"
                  />

                  <!-- Lats -->
                  <path
                    class="muscle-part ${selected === "Lats" ? "selected" : ""}"
                    data-muscle="Lats"
                    d="M87 104
                       C74 114 70 139 79 170
                       C85 186 96 194 108 196
                       L108 117Z"
                  />

                  <path
                    class="muscle-part ${selected === "Lats" ? "selected" : ""}"
                    data-muscle="Lats"
                    d="M133 104
                       C146 114 150 139 141 170
                       C135 186 124 194 112 196
                       L112 117Z"
                  />

                  <!-- Triceps -->
                  <path
                    class="muscle-part ${selected === "Triceps" ? "selected" : ""}"
                    data-muscle="Triceps"
                    d="M45 109
                       C36 124 34 144 39 160
                       C42 168 48 168 52 159
                       L55 137Z"
                  />

                  <path
                    class="muscle-part ${selected === "Triceps" ? "selected" : ""}"
                    data-muscle="Triceps"
                    d="M175 109
                       C184 124 186 144 181 160
                       C178 168 172 168 168 159
                       L165 137Z"
                  />

                  <!-- Glutes -->
                  <path
                    class="muscle-part ${selected === "Glutes" ? "selected" : ""}"
                    data-muscle="Glutes"
                    d="M82 192
                       C76 211 80 238 94 250
                       C101 256 106 253 110 245
                       L110 198Z"
                  />

                  <path
                    class="muscle-part ${selected === "Glutes" ? "selected" : ""}"
                    data-muscle="Glutes"
                    d="M138 192
                       C144 211 140 238 126 250
                       C119 256 114 253 110 245
                       L110 198Z"
                  />

                  <!-- Hamstrings -->
                  <path
                    class="muscle-part ${selected === "Hamstrings" ? "selected" : ""}"
                    data-muscle="Hamstrings"
                    d="M87 250
                       C79 268 79 302 83 320
                       C87 327 97 327 103 318
                       L108 253Z"
                  />

                  <path
                    class="muscle-part ${selected === "Hamstrings" ? "selected" : ""}"
                    data-muscle="Hamstrings"
                    d="M133 250
                       C141 268 141 302 137 320
                       C133 327 123 327 117 318
                       L112 253Z"
                  />

                  <!-- Calves -->
                  <path
                    class="muscle-part ${selected === "Calves" ? "selected" : ""}"
                    data-muscle="Calves"
                    d="M83 321
                       C77 350 80 390 87 418
                       C93 429 102 425 103 414
                       L102 326Z"
                  />

                  <path
                    class="muscle-part ${selected === "Calves" ? "selected" : ""}"
                    data-muscle="Calves"
                    d="M137 321
                       C143 350 140 390 133 418
                       C127 429 118 425 117 414
                       L118 326Z"
                  />

                </svg>
              `
          }

        </div>

        <p class="muscle-map-hint">
          Tap a muscle to filter exercises
        </p>

      </div>
    </div>
  `;
}

function render() {
  const filteredExercises = exercises.filter((exercise) => {
    const matchesSearch =
      exercise.name.toLowerCase().includes(searchTerm) ||
      exercise.muscle.toLowerCase().includes(searchTerm) ||
      exercise.equipment.toLowerCase().includes(searchTerm) ||
      exercise.type.toLowerCase().includes(searchTerm);

    const matchesMuscle =
      activeMuscle === "All" ||
      exercise.muscle === activeMuscle;

    const matchesEquipment =
      activeEquipment === "All" ||
      exercise.equipment === activeEquipment;

    return (
      matchesSearch &&
      matchesMuscle &&
      matchesEquipment
    );
  });

  app.innerHTML = `
    <div class="app-shell">

      <header class="app-header">
        <a href="#" class="logo">
          RED<span>LINE</span>
        </a>

        <button
          class="profile-button"
          aria-label="Profile"
        >
          ●
        </button>
      </header>

      <main>

        <section class="library-heading">
          <p class="hero-label">Training Library</p>

          <h1 class="page-title">
            FIND YOUR
            <span>EXERCISE.</span>
          </h1>

          <p class="library-description">
            Browse your movements. Build your system.
          </p>
        </section>

        <section class="search-section">

          <label
            class="search-box"
            aria-label="Search exercises"
          >
            <span class="search-icon">⌕</span>

            <input
              id="exercise-search"
              type="search"
              placeholder="Search exercises, muscles..."
              value="${searchTerm}"
            />
          </label>

          ${muscleMap()}

          <div class="filter-group">

            <div class="filter-heading">
              <span>Equipment</span>
            </div>

            <div class="filter-row">
              ${equipment
                .map(
                  (item) => `
                    <button
                      class="filter-chip ${
                        activeEquipment === item
                          ? "active"
                          : ""
                      }"
                      data-equipment="${item}"
                    >
                      ${item}
                    </button>
                  `
                )
                .join("")}
            </div>

          </div>

        </section>

        <section class="library-results">

          <div class="results-heading">
            <span>
              ${filteredExercises.length} exercises
            </span>
          </div>

          <div class="exercise-grid">
            ${
              filteredExercises.length
                ? filteredExercises
                    .map(exerciseCard)
                    .join("")
                : `
                  <div class="empty-state">
                    <div class="empty-state-icon">×</div>
                    <h2>No exercises found</h2>
                    <p>
                      Try a different search or filter.
                    </p>
                  </div>
                `
            }
          </div>

        </section>

      </main>
    </div>

    <nav class="bottom-nav" aria-label="Main navigation">

      <button class="nav-item active" data-page="workouts">
        <span class="nav-icon">◈</span>
        <span class="nav-label">Workouts</span>
      </button>

      <button class="nav-item" data-page="routines">
        <span class="nav-icon">▣</span>
        <span class="nav-label">Routines</span>
      </button>

      <button class="nav-item" data-page="map">
        <span class="nav-icon">◎</span>
        <span class="nav-label">Muscle Map</span>
      </button>

      <button class="nav-item" data-page="profile">
        <span class="nav-icon">◉</span>
        <span class="nav-label">Profile</span>
      </button>

    </nav>
  `;

  attachEvents();
  animateCards();
}

function attachEvents() {
  const search = document.querySelector("#exercise-search");

  search?.addEventListener("input", (event) => {
    searchTerm = event.target.value
      .trim()
      .toLowerCase();

    render();
  });


  /* =========================
     ALL MUSCLES
  ========================= */

  document
    .querySelector("[data-muscle='All']")
    ?.addEventListener("click", () => {
      activeMuscle = "All";
      render();
    });


  /* =========================
     SVG MUSCLES
  ========================= */

  document
    .querySelectorAll(".muscle-part")
    .forEach((muscle) => {
      muscle.addEventListener("click", () => {
        activeMuscle = muscle.dataset.muscle;
        render();
      });
    });


  /* =========================
     FRONT / BACK
  ========================= */

  document
    .querySelectorAll("[data-view]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        muscleView = button.dataset.view;
        render();
      });
    });


  /* =========================
     EQUIPMENT
  ========================= */

  document
    .querySelectorAll("[data-equipment]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        activeEquipment = button.dataset.equipment;
        render();
      });
    });


  /* =========================
     EQUIPMENT ANIMATION
  ========================= */

  document
    .querySelectorAll(".equipment-button")
    .forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();

        gsap.timeline()
          .to(button, {
            rotation: 180,
            scale: 1.18,
            duration: 0.18,
            ease: "power2.out",
          })
          .to(button, {
            rotation: 360,
            scale: 1,
            duration: 0.35,
            ease: "back.out(2)",
          });
      });
    });


  /* =========================
     EXERCISE CARD
  ========================= */

  document
    .querySelectorAll(".exercise-card")
    .forEach((card) => {
      card.addEventListener("click", () => {
        console.log(
          "Selected exercise:",
          card.dataset.id
        );
      });
    });


  /* =========================
     MUSCLE COLLAPSE
  ========================= */

  const collapseButton =
    document.querySelector("#muscle-collapse");

  collapseButton?.addEventListener("click", () => {
    const body =
      document.querySelector(".muscle-filter-body");

    body?.classList.toggle("collapsed");

    collapseButton.textContent =
      body?.classList.contains("collapsed")
        ? "↓"
        : "↑";
  });
}

function animateCards() {
  const cards = document.querySelectorAll(
    ".exercise-card"
  );

  gsap.fromTo(
    cards,
    {
      opacity: 0,
      y: 24,
    },
    {
      opacity: 1,
      y: 0,
      duration: 0.5,
      stagger: 0.06,
      ease: "power3.out",
    }
  );
}

render();
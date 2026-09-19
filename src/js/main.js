import "../css/variables.css";
import "../css/reset.css";
import "../css/style.css";

import { exercises } from "./data.js";
import gsap from "gsap";

const app = document.querySelector("#app");


// =========================
// FILTER STATE
// =========================

let activeMuscle = "All";
let activeEquipment = "All";
let searchTerm = "";
let selectedExercise = null;


// =========================
// FILTER OPTIONS
// =========================

const muscles = [
  "All",
  "Chest",
  "Back",
  "Legs",
  "Hamstrings",
  "Shoulders",
  "Biceps",
  "Triceps",
];

const equipment = [
  "All",
  "Barbell",
  "Dumbbell",
  "Cable",
  "Machine",
];


// =========================
// EXERCISE CARD
// =========================

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
          type="button"
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


// =========================
// EQUIPMENT ICON
// =========================

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


// =========================
// RENDER
// =========================

function render() {

  const filteredExercises = exercises.filter(
    (exercise) => {

      const searchText = [
        exercise.name,
        exercise.muscle,
        exercise.equipment,
        exercise.type,
      ]
        .join(" ")
        .toLowerCase();


      const matchesSearch =
        searchText.includes(searchTerm);


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
    }
  );


  // =========================
  // PAGE
  // =========================

  app.innerHTML = `

    <div class="app-shell">

      <header class="app-header">

        <a
          href="#"
          class="logo"
          aria-label="REDLINE home"
        >
          RED<span>LINE</span>
        </a>


        <button
          class="profile-button"
          aria-label="Profile"
          type="button"
        >
          ●
        </button>

      </header>


      <main>

        <!-- =====================
             PAGE HEADER
        ====================== -->

        <section class="library-heading">

          <p class="hero-label">
            Training Library
          </p>


          <h1 class="page-title">

            FIND YOUR

            <span>
              EXERCISE.
            </span>

          </h1>


          <p class="library-description">
            Browse your movements. Build your system.
          </p>

        </section>


        <!-- =====================
             SEARCH + FILTERS
        ====================== -->

        <section class="search-section">


          <!-- SEARCH -->

          <label
            class="search-box"
            aria-label="Search exercises"
          >

            <span class="search-icon">
              ⌕
            </span>


            <input
              id="exercise-search"
              type="search"
              placeholder="Search exercises, muscles..."
              value="${searchTerm}"
              autocomplete="off"
            />

          </label>


          <!-- MUSCLE FILTER -->

          <div class="filter-group">

            <div class="filter-heading">
              <span>Muscle</span>
            </div>


            <div class="filter-row">

              ${muscles
      .map(
        (muscle) => `
                    <button
                      class="filter-chip ${activeMuscle === muscle
            ? "active"
            : ""
          }"
                      data-muscle="${muscle}"
                      type="button"
                    >
                      ${muscle}
                    </button>
                  `
      )
      .join("")}

            </div>

          </div>


          <!-- EQUIPMENT FILTER -->

          <div class="filter-group">

            <div class="filter-heading">
              <span>Equipment</span>
            </div>


            <div class="filter-row">

              ${equipment
      .map(
        (item) => `
                    <button
                      class="filter-chip ${activeEquipment === item
            ? "active"
            : ""
          }"
                      data-equipment="${item}"
                      type="button"
                    >
                      ${item}
                    </button>
                  `
      )
      .join("")}

            </div>

          </div>


        </section>


        <!-- =====================
             RESULTS
        ====================== -->

        <section class="library-results">


          <div class="results-heading">

            <span>
              ${filteredExercises.length}
              ${filteredExercises.length === 1
      ? "exercise"
      : "exercises"}
            </span>

          </div>


          <div class="exercise-grid">

            ${filteredExercises.length > 0
      ? filteredExercises
        .map(exerciseCard)
        .join("")

      : `
                  <div class="empty-state">

                    <div class="empty-state-icon">
                      ×
                    </div>

                    <h2>
                      No exercises found
                    </h2>

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


    <!-- =========================
         BOTTOM NAVIGATION
    ========================== -->

    <nav
      class="bottom-nav"
      aria-label="Main navigation"
    >

      <button
        class="nav-item active"
        data-page="workouts"
        type="button"
      >
        <span class="nav-icon">
          ◈
        </span>

        <span class="nav-label">
          Workouts
        </span>
      </button>


      <button
        class="nav-item"
        data-page="routines"
        type="button"
      >
        <span class="nav-icon">
          ▣
        </span>

        <span class="nav-label">
          Routines
        </span>
      </button>


      <button
        class="nav-item"
        data-page="map"
        type="button"
      >
        <span class="nav-icon">
          ◎
        </span>

        <span class="nav-label">
          Muscle Map
        </span>
      </button>


      <button
        class="nav-item"
        data-page="profile"
        type="button"
      >
        <span class="nav-icon">
          ◉
        </span>

        <span class="nav-label">
          Profile
        </span>
      </button>

    </nav>

  `;


  // Attach all events after DOM update
  attachEvents();


  // Animate the newly rendered cards
  animateCards();
}


// =========================
// EVENTS
// =========================


function openExerciseDetail(card, exercise) {

  if (document.querySelector(".detail-overlay")) {
    return;
  }

  const overlay =
    document.createElement("div");

  overlay.className = "detail-overlay";

  overlay.innerHTML = `
    <div class="detail-backdrop"></div>

    <section
      class="exercise-detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-title"
    >

      <div class="detail-handle"></div>

      <div class="detail-header">

        <button
          class="detail-close"
          type="button"
          aria-label="Close exercise"
        >
          ×
        </button>

      </div>

      <div class="detail-visual">

  <div class="detail-visual-grid"></div>

  <div class="detail-ring ring-one"></div>
  <div class="detail-ring ring-two"></div>

  <div class="detail-media-placeholder">

    <div class="media-placeholder-mark">
      +
    </div>

    <div class="media-placeholder-info">
      <span>REDLINE / MOVEMENT</span>
      <strong>VISUAL DEMO</strong>
    </div>

    <div class="media-placeholder-status">
      MEDIA ${String(exercise.id).padStart(2, "0")} / 01
    </div>

  </div>

  <span class="detail-visual-label">
    ${exercise.name.toUpperCase()}
  </span>

</div>

      <div class="detail-content">

        <div class="detail-eyebrow">
          ${exercise.type}
        </div>

        <h2
          id="detail-title"
          class="detail-title"
        >
          ${exercise.name}
        </h2>

        <div class="detail-meta">

          <span>${exercise.muscle}</span>
          <span>•</span>
          <span>${exercise.equipment}</span>
          <span>•</span>
          <span>${exercise.difficulty}</span>

        </div>

        <div class="detail-section">

          <div class="detail-section-title">
            TARGETED MUSCLES
          </div>

          <div class="muscle-tags">

            <span class="muscle-tag primary">
              ${exercise.muscle}
            </span>

            ${exercise.secondaryMuscles
      .map(
        (muscle) => `
                  <span class="muscle-tag">
                    ${muscle}
                  </span>
                `
      )
      .join("")}

          </div>

        </div>

        <div class="detail-section">

          <div class="detail-section-title">
            HOW TO PERFORM
          </div>

          <ol class="instruction-list">

            ${exercise.instructions
      .map(
        (instruction, index) => `
                  <li class="instruction-item">

                    <span class="instruction-number">
                      ${String(index + 1).padStart(2, "0")}
                    </span>

                    <span>
                      ${instruction}
                    </span>

                  </li>
                `
      )
      .join("")}

          </ol>

        </div>

        <button
          class="add-routine-button"
          type="button"
        >
          <span>
            ADD TO ROUTINE
          </span>

          <span class="add-routine-arrow">
            →
          </span>
        </button>

      </div>

    </section>
  `;

  document.body.appendChild(overlay);

  animateDetailOpen(card, overlay);
  attachDetailEvents(overlay);
}

function animateDetailOpen(card, overlay) {

  const backdrop =
    overlay.querySelector(".detail-backdrop");

  const detail =
    overlay.querySelector(".exercise-detail");

  const visual =
    overlay.querySelector(".detail-visual");

  const content =
    overlay.querySelector(".detail-content");

  const mediaPlaceholder =
    overlay.querySelector(".detail-media-placeholder");

  const detailRings =
    overlay.querySelectorAll(".detail-ring");

  gsap.set(overlay, {
    display: "block"
  });

  gsap.set(backdrop, {
    opacity: 0
  });

  gsap.set(detail, {
    y: "100%"
  });

  gsap.set(mediaPlaceholder, {
    scale: 0.88,
    opacity: 0,
    y: 10
  });

  gsap.set(visual, {
    scale: 0.96,
    opacity: 0
  });

  gsap.set(content, {
    opacity: 0,
    y: 20
  });

  gsap.set(detailRings, {
    scale: 0.6,
    opacity: 0
  });

  const timeline = gsap.timeline();

  timeline
    .to(card, {
      scale: 0.97,
      duration: 0.12,
      ease: "power2.out"
    })

    .to(
      backdrop,
      {
        opacity: 1,
        duration: 0.28,
        ease: "power2.out"
      },
      "<"
    )

    .to(
      detail,
      {
        y: 0,
        duration: 0.55,
        ease: "power4.out"
      },
      "-=0.12"
    )

    .to(
      visual,
      {
        opacity: 1,
        scale: 1,
        duration: 0.45,
        ease: "power3.out"
      },
      "-=0.2"
    )

    .to(
      mediaPlaceholder,
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.5,
        ease: "back.out(1.4)"
      },
      "-=0.28"
    )

    .to(
      detailRings,
      {
        opacity: 1,
        scale: 1,
        duration: 0.65,
        stagger: 0.08,
        ease: "power3.out"
      },
      "-=0.45"
    )

    .to(
      content,
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: "power3.out"
      },
      "-=0.2"
    );
}

function closeExerciseDetail() {

  const overlay =
    document.querySelector(".detail-overlay");

  if (!overlay) {
    return;
  }

  const backdrop =
    overlay.querySelector(".detail-backdrop");

  const detail =
    overlay.querySelector(".exercise-detail");

  gsap.timeline({
    onComplete: () => {
      overlay.remove();
      selectedExercise = null;
    }
  })
    .to(detail, {
      y: "100%",
      duration: 0.35,
      ease: "power3.in"
    })
    .to(
      backdrop,
      {
        opacity: 0,
        duration: 0.22
      },
      "-=0.2"
    );
}

function attachDetailEvents(overlay) {

  const closeButton =
    overlay.querySelector(".detail-close");

  const backdrop =
    overlay.querySelector(".detail-backdrop");

  const addButton =
    overlay.querySelector(".add-routine-button");

  closeButton.addEventListener(
    "click",
    closeExerciseDetail
  );

  backdrop.addEventListener(
    "click",
    closeExerciseDetail
  );

  addButton.addEventListener(
    "click",
    () => {

      const buttonText =
        addButton.querySelector("span");

      buttonText.textContent =
        "ADDED TO ROUTINE";

      addButton.classList.add("added");

      gsap.fromTo(
        addButton,
        {
          scale: 0.96
        },
        {
          scale: 1,
          duration: 0.35,
          ease: "back.out(2)"
        }
      );
    }
  );
}

function attachEvents() {

  // =======================
  // SEARCH
  // =======================

  const search =
    document.querySelector("#exercise-search");


  search?.addEventListener(
    "input",
    (event) => {

      searchTerm =
        event.target.value
          .trim()
          .toLowerCase();


      render();
    }
  );


  // =======================
  // MUSCLE FILTER
  // =======================

  document
    .querySelectorAll("[data-muscle]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          activeMuscle =
            button.dataset.muscle;

          render();
        }
      );

    });


  // =======================
  // EQUIPMENT FILTER
  // =======================

  document
    .querySelectorAll("[data-equipment]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          activeEquipment =
            button.dataset.equipment;

          render();
        }
      );

    });


  // =======================
  // EQUIPMENT ICON ANIMATION
  // =======================

  document
    .querySelectorAll(".equipment-button")
    .forEach((button) => {

      button.addEventListener(
        "click",
        (event) => {

          // Don't open the exercise card
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

        }
      );

    });


  // =======================
  // EXERCISE CARD
  // =======================

document
  .querySelectorAll(".exercise-card")
  .forEach((card) => {

    card.addEventListener("click", () => {

      const exerciseId =
        Number(card.dataset.id);

      const exercise =
        exercises.find(
          (item) => item.id === exerciseId
        );

      if (!exercise) {
        return;
      }

      selectedExercise = exercise;

      openExerciseDetail(exercise);
    });

  });

  // =======================
  // PROFILE
  // =======================

  const profileButton =
    document.querySelector(
      ".profile-button"
    );


  profileButton?.addEventListener(
    "click",
    () => {

      console.log(
        "Profile clicked"
      );

    }
  );


  // =======================
  // NAVIGATION
  // =======================

  document
    .querySelectorAll(".nav-item")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(".nav-item")
            .forEach((item) => {
              item.classList.remove(
                "active"
              );
            });


          button.classList.add(
            "active"
          );


          console.log(
            "Navigation:",
            button.dataset.page
          );

          // Other pages will be implemented
          // one by one.

        }
      );

    });

}


// =========================
// CARD ENTRANCE ANIMATION
// =========================

function animateCards() {

  const cards =
    document.querySelectorAll(
      ".exercise-card"
    );


  if (!cards.length) {
    return;
  }


  gsap.fromTo(
    cards,

    {
      opacity: 0,
      y: 24,
      scale: 0.98,
    },

    {
      opacity: 1,
      y: 0,
      scale: 1,

      duration: 0.5,

      stagger: 0.06,

      ease: "power3.out",
    }
  );

}


// =========================
// INITIAL RENDER
// =========================

render();
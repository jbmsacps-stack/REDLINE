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

let routines = [
  {
    id: 1,
    name: "Push Day",
    exercises: []
  },
  {
    id: 2,
    name: "Pull Day",
    exercises: []
  },
  {
    id: 3,
    name: "Leg Destroyer",
    exercises: []
  }
];

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

function exerciseMedia(exercise) {
  /*
    Future:
    - image
    - GIF
    - WebM
    - MP4

    For now we intentionally render a designed placeholder.
  */

  return `
    <div class="detail-media-placeholder">

      <div class="media-grid"></div>

      <div class="media-corner media-corner-top"></div>
      <div class="media-corner media-corner-bottom"></div>

      <div class="media-center">

        <div class="media-mark">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div class="media-title">
          VISUAL DEMO
        </div>

        <div class="media-subtitle">
          MOTION ASSET PENDING
        </div>

      </div>

      <div class="media-top-label">
        REDLINE / MOVEMENT
      </div>

      <div class="media-bottom-left">
        ${String(exercise.id).padStart(2, "0")}
      </div>

      <div class="media-bottom-right">
        ${exercise.equipment.toUpperCase()}
      </div>

    </div>
  `;
}


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

  ${exerciseMedia(exercise)}

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
    autoAlpha: 1
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

  addButton.addEventListener("click", () => {

    openRoutineSheet(
      selectedExercise,
      addButton
    );

  });
}

function openRoutineSheet(exercise, detailButton) {

  if (!exercise) {
    return;
  }

  if (document.querySelector(".routine-sheet-overlay")) {
    return;
  }

  const overlay =
    document.createElement("div");

  overlay.className =
    "routine-sheet-overlay";

  overlay.innerHTML = `

    <div class="routine-sheet-backdrop"></div>

    <section
      class="routine-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="routine-sheet-title"
    >

      <div class="routine-sheet-handle"></div>


      <header class="routine-sheet-header">

        <div>

          <span class="routine-sheet-eyebrow">
            ADD EXERCISE
          </span>

          <h2 id="routine-sheet-title">
            ${exercise.name}
          </h2>

        </div>

        <button
          class="routine-sheet-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </header>


      <div class="routine-sheet-content">

        <div class="routine-sheet-label">
          YOUR ROUTINES
        </div>


        <div class="routine-list">

          ${routines
      .map((routine) => {

        const alreadyAdded =
          routine.exercises.includes(
            exercise.id
          );

        return `
                <button
                  class="routine-option ${alreadyAdded
            ? "selected"
            : ""
          }"
                  type="button"
                  data-routine-id="${routine.id}"
                >

                  <span class="routine-option-indicator">
                    ${alreadyAdded ? "✓" : ""}
                  </span>

                  <span class="routine-option-info">

                    <strong>
                      ${routine.name}
                    </strong>

                    <small>
                      ${routine.exercises.length}
                      ${routine.exercises.length === 1
            ? "exercise"
            : "exercises"
          }
                    </small>

                  </span>

                  <span class="routine-option-arrow">
                    →
                  </span>

                </button>
              `;
      })
      .join("")}

        </div>


        <button
          class="create-routine-button"
          type="button"
        >

          <span class="create-routine-plus">
            +
          </span>

          <span>
            CREATE NEW ROUTINE
          </span>

        </button>

      </div>

    </section>
  `;

  document.body.appendChild(overlay);

  animateRoutineSheetOpen(overlay);

  attachRoutineSheetEvents(
    overlay,
    exercise,
    detailButton
  );
}

function animateRoutineSheetOpen(overlay) {

  const backdrop =
    overlay.querySelector(
      ".routine-sheet-backdrop"
    );

  const sheet =
    overlay.querySelector(
      ".routine-sheet"
    );

  const options =
    overlay.querySelectorAll(
      ".routine-option"
    );

  const createButton =
    overlay.querySelector(
      ".create-routine-button"
    );


  gsap.set(backdrop, {
    opacity: 0
  });

  gsap.set(sheet, {
    y: "100%"
  });

  gsap.set(options, {
    opacity: 0,
    y: 14
  });

  gsap.set(createButton, {
    opacity: 0,
    y: 12
  });


  gsap.timeline()

    .to(backdrop, {
      opacity: 1,
      duration: 0.22,
      ease: "power2.out"
    })

    .to(
      sheet,
      {
        y: 0,
        duration: 0.48,
        ease: "power4.out"
      },
      "-=0.08"
    )

    .to(
      options,
      {
        opacity: 1,
        y: 0,
        duration: 0.32,
        stagger: 0.055,
        ease: "power3.out"
      },
      "-=0.18"
    )

    .to(
      createButton,
      {
        opacity: 1,
        y: 0,
        duration: 0.28,
        ease: "power3.out"
      },
      "-=0.16"
    );
}

function attachRoutineSheetEvents(
  overlay,
  exercise,
  detailButton
) {

  const closeButton =
    overlay.querySelector(
      ".routine-sheet-close"
    );

  const backdrop =
    overlay.querySelector(
      ".routine-sheet-backdrop"
    );

  const createButton =
    overlay.querySelector(
      ".create-routine-button"
    );


  closeButton.addEventListener(
    "click",
    () => closeRoutineSheet(overlay)
  );


  backdrop.addEventListener(
    "click",
    () => closeRoutineSheet(overlay)
  );


  overlay
    .querySelectorAll(".routine-option")
    .forEach((option) => {

      option.addEventListener(
        "click",
        () => {

          const routineId =
            Number(
              option.dataset.routineId
            );

          const routine =
            routines.find(
              (item) =>
                item.id === routineId
            );

          if (!routine) {
            return;
          }


          const alreadyAdded =
            routine.exercises.includes(
              exercise.id
            );


          if (alreadyAdded) {

            routine.exercises =
              routine.exercises.filter(
                (id) =>
                  id !== exercise.id
              );

            option.classList.remove(
              "selected"
            );

            option.querySelector(
              ".routine-option-indicator"
            ).textContent = "";

            updateDetailButton(
              detailButton,
              false
            );

            return;
          }


          routine.exercises.push(
            exercise.id
          );


          option.classList.add(
            "selected"
          );

          option.querySelector(
            ".routine-option-indicator"
          ).textContent = "✓";


          updateDetailButton(
            detailButton,
            true
          );


          const check =
            option.querySelector(
              ".routine-option-indicator"
            );


          gsap.fromTo(
            check,

            {
              scale: 0,
              rotate: -30
            },

            {
              scale: 1,
              rotate: 0,
              duration: 0.4,
              ease: "back.out(2)"
            }
          );

        }
      );

    });


  createButton.addEventListener(
    "click",
    () => {

      openCreateRoutineModal(
        exercise,
        detailButton,
        overlay
      );

    }
  );
}

function openCreateRoutineModal(
  exercise,
  detailButton,
  parentSheet
) {

  if (
    document.querySelector(
      ".create-routine-overlay"
    )
  ) {
    return;
  }

  const overlay =
    document.createElement("div");

  overlay.className =
    "create-routine-overlay";

  overlay.innerHTML = `
    <div class="create-routine-backdrop"></div>

    <section
      class="create-routine-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-routine-title"
    >

      <div class="create-routine-modal-header">

        <div>

          <span class="create-routine-eyebrow">
            NEW ROUTINE
          </span>

          <h2 id="create-routine-title">
            Build your session.
          </h2>

        </div>

        <button
          class="create-routine-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <form class="create-routine-form">

        <label
          class="routine-input-label"
          for="routine-name"
        >
          ROUTINE NAME
        </label>

        <input
          id="routine-name"
          class="routine-name-input"
          type="text"
          maxlength="40"
          autocomplete="off"
          placeholder="e.g. Push Day"
        />

        <div class="routine-input-help">
          Give it a name you'll recognize instantly.
        </div>

        <button
          class="routine-create-submit"
          type="submit"
        >
          <span>CREATE ROUTINE</span>
          <span>→</span>
        </button>

      </form>

    </section>
  `;

  document.body.appendChild(overlay);

  animateCreateRoutineOpen(
    overlay
  );

  attachCreateRoutineEvents(
    overlay,
    exercise,
    detailButton,
    parentSheet
  );
}

function animateCreateRoutineOpen(
  overlay
) {

  const backdrop =
    overlay.querySelector(
      ".create-routine-backdrop"
    );

  const modal =
    overlay.querySelector(
      ".create-routine-modal"
    );

  const input =
    overlay.querySelector(
      ".routine-name-input"
    );

  gsap.set(
    backdrop,
    {
      opacity: 0
    }
  );

  gsap.set(
    modal,
    {
      opacity: 0,
      y: 24,
      scale: 0.97
    }
  );

  gsap.timeline({
    onComplete: () => {
      input.focus();
    }
  })

    .to(
      backdrop,
      {
        opacity: 1,
        duration: 0.22,
        ease: "power2.out"
      }
    )

    .to(
      modal,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.42,
        ease: "back.out(1.35)"
      },
      "-=0.1"
    );
}

function attachCreateRoutineEvents(
  overlay,
  exercise,
  detailButton,
  parentSheet
) {

  const closeButton =
    overlay.querySelector(
      ".create-routine-close"
    );

  const backdrop =
    overlay.querySelector(
      ".create-routine-backdrop"
    );

  const form =
    overlay.querySelector(
      ".create-routine-form"
    );

  const input =
    overlay.querySelector(
      ".routine-name-input"
    );


  closeButton.addEventListener(
    "click",
    () => {
      closeCreateRoutineModal(
        overlay
      );
    }
  );


  backdrop.addEventListener(
    "click",
    () => {
      closeCreateRoutineModal(
        overlay
      );
    }
  );


  form.addEventListener(
    "submit",
    (event) => {

      event.preventDefault();

      const name =
        input.value.trim();

      if (!name) {

        gsap.timeline()

          .to(input, {
            x: -6,
            duration: 0.06
          })

          .to(input, {
            x: 6,
            duration: 0.06
          })

          .to(input, {
            x: 0,
            duration: 0.08
          });

        input.focus();

        return;
      }


      const newRoutine = {

        id: Date.now(),

        name,

        exercises: [
          exercise.id
        ]

      };


      routines.push(
        newRoutine
      );


      updateDetailButton(
        detailButton,
        true
      );


      closeCreateRoutineModal(
        overlay,
        () => {

          closeRoutineSheet(
            parentSheet
          );

        }
      );

    }
  );
}

function closeCreateRoutineModal(
  overlay,
  onComplete
) {

  if (!overlay) {
    return;
  }

  const backdrop =
    overlay.querySelector(
      ".create-routine-backdrop"
    );

  const modal =
    overlay.querySelector(
      ".create-routine-modal"
    );


  gsap.timeline({
    onComplete: () => {

      overlay.remove();

      onComplete?.();

    }
  })

    .to(
      modal,
      {
        opacity: 0,
        y: 16,
        scale: 0.98,
        duration: 0.22,
        ease: "power2.in"
      }
    )

    .to(
      backdrop,
      {
        opacity: 0,
        duration: 0.16
      },
      "-=0.12"
    );
}

function updateDetailButton(
  button,
  added
) {

  if (!button) {
    return;
  }

  const text =
    button.querySelector(
      "span"
    );


  if (added) {

    text.textContent =
      "ADDED TO ROUTINE";

    button.classList.add(
      "added"
    );

  } else {

    text.textContent =
      "ADD TO ROUTINE";

    button.classList.remove(
      "added"
    );

  }


  gsap.fromTo(
    button,

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

function closeRoutineSheet(overlay) {

  if (!overlay) {
    return;
  }


  const backdrop =
    overlay.querySelector(
      ".routine-sheet-backdrop"
    );

  const sheet =
    overlay.querySelector(
      ".routine-sheet"
    );


  gsap.timeline({
    onComplete: () => {
      overlay.remove();
    }
  })

    .to(sheet, {
      y: "100%",
      duration: 0.32,
      ease: "power3.in"
    })

    .to(
      backdrop,
      {
        opacity: 0,
        duration: 0.2
      },
      "-=0.16"
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

        openExerciseDetail(card, exercise);
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
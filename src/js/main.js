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
let activeRoutine = null;

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

let workoutSessions = [];

function getLocalDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

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

    ${renderBottomNav("workouts")}

  `;


  // Attach all events after DOM update
  attachEvents();


  // Animate the newly rendered cards
  animateCards();
}

// =========================
// SHARED BOTTOM NAVIGATION
// =========================

function renderBottomNav(activePage = "workouts") {
  return `
    <nav
      class="bottom-nav"
      aria-label="Main navigation"
    >

      <button
        class="nav-item ${activePage === "workouts" ? "active" : ""}"
        data-page="workouts"
        type="button"
      >
        <span class="nav-icon">◈</span>
        <span class="nav-label">Workouts</span>
      </button>

      <button
        class="nav-item ${activePage === "routines" ? "active" : ""}"
        data-page="routines"
        type="button"
      >
        <span class="nav-icon">▣</span>
        <span class="nav-label">Routines</span>
      </button>

      <button
        class="nav-item ${activePage === "map" ? "active" : ""}"
        data-page="map"
        type="button"
      >
        <span class="nav-icon">◎</span>
        <span class="nav-label">Muscle Map</span>
      </button>

      <button
        class="nav-item ${activePage === "profile" ? "active" : ""}"
        data-page="profile"
        type="button"
      >
        <span class="nav-icon">◉</span>
        <span class="nav-label">Profile</span>
      </button>

    </nav>
  `;
}

function renderRoutines() {

  const app = document.querySelector("#app");

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

        <section class="routines-screen">

          <div class="routines-header">

            <div class="routines-title-block">

              <span class="section-kicker">
                TRAINING SYSTEM
              </span>

              <h1>
                MY ROUTINES
              </h1>

            </div>

            <button
              class="create-routine-page-button"
              type="button"
            >
              <span>+</span>
              CREATE
            </button>

          </div>


          <div class="routine-grid">

            ${routines.map((routine, index) => `

              <article
                class="routine-card"
                data-routine-id="${routine.id}"
              >

                <div class="routine-card-top">

                  <span class="routine-index">
                    ${String(index + 1).padStart(2, "0")}
                  </span>

                  <span class="routine-arrow">
                    ↗
                  </span>

                </div>


                <h2>
                  ${routine.name}
                </h2>


                <div class="routine-meta">

                  <span>
                    ${routine.exercises.length}
                    ${routine.exercises.length === 1
      ? "EXERCISE"
      : "EXERCISES"}
                  </span>

                  <span>•</span>

                  <span>
                    READY
                  </span>

                </div>

              </article>

            `).join("")}

          </div>

        </section>

      </main>

    </div>


    ${renderBottomNav("routines")}

  `;

  attachEvents();

  animateRoutineCards();
}

function renderRoutineDetail() {

  if (!activeRoutine) {
    return;
  }

  const app = document.querySelector("#app");

  const routineExercises =
    activeRoutine.exercises
      .map((routineExercise) => {

        const exercise =
          exercises.find(
            (item) =>
              item.id ===
              routineExercise.exerciseId
          );

        if (!exercise) {
          return null;
        }

        return {
          ...exercise,
          tracking: routineExercise
        };

      })
      .filter(Boolean);

  app.innerHTML = `
    <div class="app-shell">

      <header class="app-header">

        <button
          class="routine-back-button"
          type="button"
        >
          ←
        </button>

        <div class="routine-detail-header-actions">

  <span class="routine-detail-label">
    ROUTINE
  </span>

  <button
    class="routine-detail-menu"
    type="button"
    aria-label="Routine options"
  >
    ⋮
  </button>

</div>

      </header>


      <main>

        <section class="routine-detail-page">

          <span class="section-kicker">
            TRAINING SYSTEM
          </span>

          <h1 class="routine-detail-title">
            ${activeRoutine.name}
          </h1>

          <div class="routine-detail-meta">
            <span>
              ${routineExercises.length}
              ${routineExercises.length === 1
      ? "EXERCISE"
      : "EXERCISES"}
            </span>

            <span>•</span>

            <span>
              READY
            </span>
          </div>


          <section class="routine-exercise-list">

            ${routineExercises.length
      ? routineExercises.map(
        (exercise, index) => `
                      <article
  class="routine-exercise-item"
  data-exercise-id="${exercise.id}"
>

  <div class="routine-exercise-main">

    <span class="routine-exercise-number">
      ${String(index + 1).padStart(2, "0")}
    </span>

    <div class="routine-exercise-info">

  <h2>
    ${exercise.name}
  </h2>

  <span>
    ${exercise.muscle}
    •
    ${exercise.equipment}
  </span>

  ${exercise.tracking.notes
            ? `
        <div class="routine-exercise-note">
          <span class="routine-exercise-note-mark">NOTE:</span>

<span class="routine-exercise-note-text">
  ${exercise.tracking.notes}
</span>
        </div>
      `
            : ""
          }

</div>

    <button
      class="routine-exercise-menu"
      type="button"
      aria-label="Exercise options"
    >
      ⋮
    </button>

  </div>


  <div class="routine-exercise-controls">

    <button
      class="routine-value-button routine-weight-button"
      type="button"
      data-control="weight"
    >
      <span class="routine-value-icon">
        🏋
      </span>

      <span class="routine-value-text">
        ${exercise.tracking.weight > 0
            ? `${exercise.tracking.weight} kg`
            : "— kg"
          }
      </span>
    </button>


    <button
      class="routine-value-button routine-reps-button"
      type="button"
      data-control="reps"
    >
      <span class="routine-value-text">
        ${exercise.tracking.reps > 0
            ? `${exercise.tracking.reps} REPS`
            : "— REPS"
          }
      </span>
    </button>

  </div>

</article>

                    `
      ).join("")
      : `
                  <div class="routine-detail-empty">

                    <span>NO EXERCISES</span>

                    <p>
                      Add exercises from the workout library.
                    </p>

                  </div>
                `
    }

    <div class="routine-complete-section">
  <label class="routine-complete-control">
    <input
      type="checkbox"
      class="routine-complete-checkbox"
      ${workoutSessions.some(
      session =>
        session.routineId === activeRoutine.id &&
        session.date === getLocalDate()
    ) ? "checked" : ""}
    >

    <span class="routine-complete-box"></span>

    <span class="routine-complete-text">
      <strong>ROUTINE COMPLETED</strong>
      <small>Mark this session as finished</small>
    </span>
  </label>
</div>

          </section>

        </section>

      </main>

    </div>

    ${renderBottomNav("routines")}
  `;

  attachEvents();

  animateRoutineDetail();
}

function openRoutineExerciseMenu(
  routineExercise,
  exercise
) {

  if (
    document.querySelector(
      ".routine-action-overlay"
    )
  ) {
    return;
  }

  const overlay =
    document.createElement("div");

  overlay.className =
    "routine-action-overlay";

  overlay.innerHTML = `

    <div class="routine-action-backdrop"></div>

    <section
      class="routine-action-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="routine-action-title"
    >

      <div class="routine-action-handle"></div>


      <header class="routine-action-header">

        <div>

          <span class="routine-action-eyebrow">
            EXERCISE OPTIONS
          </span>

          <h2 id="routine-action-title">
            ${exercise.name}
          </h2>

        </div>

        <button
          class="routine-action-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </header>


      <div class="routine-action-list">

        <button
          class="routine-action-item"
          type="button"
          data-action="edit"
        >
          <span>
            EDIT TRACKING
          </span>

          <span>→</span>
        </button>


        <button
          class="routine-action-item"
          type="button"
          data-action="history"
        >
          <span>
            VIEW HISTORY
          </span>

          <span>→</span>
        </button>


        <button
          class="routine-action-item"
          type="button"
          data-action="move"
        >
          <span>
            MOVE EXERCISE
          </span>

          <span>→</span>
        </button>


        <button
          class="routine-action-item danger"
          type="button"
          data-action="remove"
        >
          <span>
            REMOVE FROM ROUTINE
          </span>

          <span>×</span>
        </button>

      </div>

    </section>

  `;

  document.body.appendChild(
    overlay
  );


  const backdrop =
    overlay.querySelector(
      ".routine-action-backdrop"
    );

  const sheet =
    overlay.querySelector(
      ".routine-action-sheet"
    );

  const closeButton =
    overlay.querySelector(
      ".routine-action-close"
    );

  function closeMenu(
    onComplete
  ) {

    gsap.timeline({
      onComplete: () => {

        overlay.remove();

        onComplete?.();

      }
    })

      .to(sheet, {
        y: "100%",
        duration: 0.28,
        ease: "power3.in"
      })

      .to(
        backdrop,
        {
          opacity: 0,
          duration: 0.18
        },
        "-=0.16"
      );

  }


  closeButton.addEventListener(
    "click",
    () => closeMenu()
  );

  backdrop.addEventListener(
    "click",
    () => closeMenu()
  );


  overlay
    .querySelectorAll(
      ".routine-action-item"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          const action =
            button.dataset.action;


          if (action === "history") {

            closeMenu(() => {

              openRoutineExerciseHistory(
                routineExercise,
                exercise
              );

            });

            return;

          }


          if (action === "remove") {

            closeMenu(() => {

              removeRoutineExercise(
                routineExercise,
                exercise
              );

            });

            return;

          }


          if (action === "edit") {

            closeMenu(() => {

              openRoutineTrackingEditor(
                routineExercise,
                exercise
              );

            });

            return;
          }


          if (action === "move") {

            closeMenu(() => {

              openMoveExerciseSheet(
                routineExercise,
                exercise
              );

            });

          }

        }
      );

    });


  gsap.set(
    backdrop,
    {
      opacity: 0
    }
  );

  gsap.set(
    sheet,
    {
      y: "100%"
    }
  );

  gsap.timeline()

    .to(
      backdrop,
      {
        opacity: 1,
        duration: 0.2,
        ease: "power2.out"
      }
    )

    .to(
      sheet,
      {
        y: 0,
        duration: 0.4,
        ease: "power4.out"
      },
      "-=0.08"
    );

}

function openRoutineTrackingEditor(
  routineExercise,
  exercise
) {

  if (
    document.querySelector(
      ".tracking-editor-overlay"
    )
  ) {
    return;
  }

  const overlay =
    document.createElement("div");

  overlay.className =
    "tracking-editor-overlay";

  overlay.innerHTML = `

    <div class="tracking-editor-backdrop"></div>

    <section
      class="tracking-editor"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tracking-editor-title"
    >

      <div class="tracking-editor-header">

        <div>

          <span class="tracking-editor-eyebrow">
            EDIT TRACKING
          </span>

          <h2 id="tracking-editor-title">
            ${exercise.name}
          </h2>

        </div>

        <button
          class="tracking-editor-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <div class="tracking-editor-content">

        <div class="tracking-field">

          <label
            for="tracking-sets"
          >
            SETS
          </label>

          <input
            id="tracking-sets"
            type="number"
            min="1"
            max="10"
            step="1"
            inputmode="numeric"
            value="${routineExercise.sets}"
          />

        </div>


        <div class="tracking-field">

          <label
            for="tracking-notes"
          >
            NOTES
          </label>

          <textarea
            id="tracking-notes"
            maxlength="300"
            placeholder="e.g. Controlled eccentric..."
          >${routineExercise.notes || ""}</textarea>

        </div>


        <div class="tracking-editor-actions">

          <button
            class="tracking-editor-cancel"
            type="button"
          >
            CANCEL
          </button>

          <button
            class="tracking-editor-save"
            type="button"
          >
            SAVE CHANGES
          </button>

        </div>

      </div>

    </section>

  `;

  document.body.appendChild(
    overlay
  );


  const backdrop =
    overlay.querySelector(
      ".tracking-editor-backdrop"
    );

  const modal =
    overlay.querySelector(
      ".tracking-editor"
    );

  const closeButton =
    overlay.querySelector(
      ".tracking-editor-close"
    );

  const cancelButton =
    overlay.querySelector(
      ".tracking-editor-cancel"
    );

  const saveButton =
    overlay.querySelector(
      ".tracking-editor-save"
    );

  const setsInput =
    overlay.querySelector(
      "#tracking-sets"
    );

  const notesInput =
    overlay.querySelector(
      "#tracking-notes"
    );


  function closeEditor(
    onComplete
  ) {

    gsap.timeline({
      onComplete: () => {

        overlay.remove();

        onComplete?.();

      }
    })

      .to(modal, {
        opacity: 0,
        y: 14,
        scale: 0.98,
        duration: 0.2,
        ease: "power2.in"
      })

      .to(
        backdrop,
        {
          opacity: 0,
          duration: 0.15
        },
        "-=0.1"
      );

  }


  closeButton.addEventListener(
    "click",
    () => closeEditor()
  );

  cancelButton.addEventListener(
    "click",
    () => closeEditor()
  );

  backdrop.addEventListener(
    "click",
    () => closeEditor()
  );


  saveButton.addEventListener(
    "click",
    () => {

      const sets =
        Number(
          setsInput.value
        );

      if (
        !Number.isInteger(sets) ||
        sets < 1 ||
        sets > 10
      ) {

        gsap.timeline()
          .to(setsInput, {
            x: -5,
            duration: 0.05
          })
          .to(setsInput, {
            x: 5,
            duration: 0.05
          })
          .to(setsInput, {
            x: 0,
            duration: 0.07
          });

        setsInput.focus();

        return;
      }


      routineExercise.sets =
        sets;

      routineExercise.notes =
        notesInput.value.trim();


      closeEditor(() => {

        renderRoutineDetail();

      });

    }
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
      y: 22,
      scale: 0.97
    }
  );


  gsap.timeline({
    onComplete: () => {
      setsInput.focus();
      setsInput.select();
    }
  })

    .to(
      backdrop,
      {
        opacity: 1,
        duration: 0.2,
        ease: "power2.out"
      }
    )

    .to(
      modal,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.32,
        ease: "back.out(1.25)"
      },
      "-=0.08"
    );

}

function removeRoutineExercise(
  routineExercise,
  exercise
) {

  if (!activeRoutine) {
    return;
  }

  activeRoutine.exercises =
    activeRoutine.exercises.filter(
      (entry) =>
        entry.exerciseId !==
        routineExercise.exerciseId
    );

  renderRoutineDetail();

}

function openRoutineExerciseHistory(
  routineExercise,
  exercise
) {

  if (
    document.querySelector(
      ".routine-history-overlay"
    )
  ) {
    return;
  }

  const history =
    routineExercise.history || [];

  const overlay =
    document.createElement("div");

  overlay.className =
    "routine-history-overlay";

  overlay.innerHTML = `

    <div class="routine-history-backdrop"></div>

    <section
      class="routine-history-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="routine-history-title"
    >

      <div class="routine-history-header">

        <div>

          <span class="routine-history-eyebrow">
            PERFORMANCE
          </span>

          <h2 id="routine-history-title">
            ${exercise.name}
          </h2>

        </div>

        <button
          class="routine-history-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <div class="routine-history-content">

        ${history.length
      ? history
        .slice()
        .reverse()
        .map(
          (session) => `
                    <article
                      class="routine-history-entry"
                    >

                      <div>
                        <strong>
                          ${session.date}
                        </strong>

                        <span>
                          ${session.weight} kg
                        </span>
                      </div>

                      <span>
                        ${session.reps.join(" • ")}
                        REPS
                      </span>

                    </article>
                  `
        )
        .join("")
      : `
                <div
                  class="routine-history-empty"
                >

                  <span>
                    NO WORKOUT HISTORY
                  </span>

                  <p>
                    Your previous sessions
                    will appear here after
                    you start logging workouts.
                  </p>

                </div>
              `
    }

      </div>

    </section>

  `;

  document.body.appendChild(
    overlay
  );


  const backdrop =
    overlay.querySelector(
      ".routine-history-backdrop"
    );

  const sheet =
    overlay.querySelector(
      ".routine-history-sheet"
    );

  const closeButton =
    overlay.querySelector(
      ".routine-history-close"
    );


  function closeHistory() {

    gsap.timeline({
      onComplete: () => {
        overlay.remove();
      }
    })

      .to(sheet, {
        y: "100%",
        duration: 0.28,
        ease: "power3.in"
      })

      .to(
        backdrop,
        {
          opacity: 0,
          duration: 0.18
        },
        "-=0.16"
      );

  }


  closeButton.addEventListener(
    "click",
    closeHistory
  );

  backdrop.addEventListener(
    "click",
    closeHistory
  );


  gsap.set(
    backdrop,
    {
      opacity: 0
    }
  );

  gsap.set(
    sheet,
    {
      y: "100%"
    }
  );

  gsap.timeline()

    .to(
      backdrop,
      {
        opacity: 1,
        duration: 0.2,
        ease: "power2.out"
      }
    )

    .to(
      sheet,
      {
        y: 0,
        duration: 0.4,
        ease: "power4.out"
      },
      "-=0.08"
    );

}

function openWeightEditor(
  routineExercise
) {

  if (
    document.querySelector(
      ".tracker-editor-overlay"
    )
  ) {
    return;
  }

  const overlay =
    document.createElement("div");

  overlay.className =
    "tracker-editor-overlay";

  overlay.innerHTML = `

    <div class="tracker-editor-backdrop"></div>

    <section
      class="tracker-editor"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tracker-editor-title"
    >

      <div class="tracker-editor-header">

        <div>

          <span class="tracker-editor-eyebrow">
            TRACKING
          </span>

          <h2 id="tracker-editor-title">
            WEIGHT
          </h2>

        </div>

        <button
          class="tracker-editor-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <div class="tracker-editor-content">

        <label
          class="tracker-editor-label"
          for="tracker-weight-input"
        >
          WEIGHT / KG
        </label>

        <input
          id="tracker-weight-input"
          class="tracker-editor-input"
          type="number"
          min="0"
          step="0.5"
          inputmode="decimal"
          value="${routineExercise.weight > 0
      ? routineExercise.weight
      : ""
    }"
          placeholder="0"
        />


        <div class="tracker-editor-actions">

          <button
            class="tracker-editor-cancel"
            type="button"
          >
            CANCEL
          </button>

          <button
            class="tracker-editor-save"
            type="button"
          >
            SAVE WEIGHT
          </button>

        </div>

      </div>

    </section>

  `;

  document.body.appendChild(
    overlay
  );

  const backdrop =
    overlay.querySelector(
      ".tracker-editor-backdrop"
    );

  const modal =
    overlay.querySelector(
      ".tracker-editor"
    );

  const input =
    overlay.querySelector(
      ".tracker-editor-input"
    );

  const closeButton =
    overlay.querySelector(
      ".tracker-editor-close"
    );

  const cancelButton =
    overlay.querySelector(
      ".tracker-editor-cancel"
    );

  const saveButton =
    overlay.querySelector(
      ".tracker-editor-save"
    );


  function closeEditor(
    onComplete
  ) {

    gsap.timeline({
      onComplete: () => {

        overlay.remove();

        onComplete?.();

      }
    })

      .to(modal, {
        opacity: 0,
        y: 14,
        scale: 0.98,
        duration: 0.18,
        ease: "power2.in"
      })

      .to(
        backdrop,
        {
          opacity: 0,
          duration: 0.14
        },
        "-=0.1"
      );

  }


  closeButton.addEventListener(
    "click",
    () => closeEditor()
  );

  cancelButton.addEventListener(
    "click",
    () => closeEditor()
  );

  backdrop.addEventListener(
    "click",
    () => closeEditor()
  );


  saveButton.addEventListener(
    "click",
    () => {

      const value =
        Number(
          input.value
        );

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {

        gsap.timeline()
          .to(input, {
            x: -5,
            duration: 0.05
          })
          .to(input, {
            x: 5,
            duration: 0.05
          })
          .to(input, {
            x: 0,
            duration: 0.07
          });

        input.focus();

        return;

      }


      routineExercise.weight =
        value;

      closeEditor(() => {
        renderRoutineDetail();
      });

    }
  );


  gsap.set(
    overlay,
    {
      opacity: 1
    }
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
      y: 22,
      scale: 0.97
    }
  );

  gsap.timeline({
    onComplete: () => {

      input.focus();

      input.select();

    }
  })

    .to(
      backdrop,
      {
        opacity: 1,
        duration: 0.2,
        ease: "power2.out"
      }
    )

    .to(
      modal,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.32,
        ease: "back.out(1.25)"
      },
      "-=0.08"
    );

}

function openRepsEditor(
  routineExercise
) {

  if (
    document.querySelector(
      ".tracker-editor-overlay"
    )
  ) {
    return;
  }

  const overlay =
    document.createElement("div");

  overlay.className =
    "tracker-editor-overlay";

  overlay.innerHTML = `

    <div class="tracker-editor-backdrop"></div>

    <section
      class="tracker-editor"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tracker-editor-title"
    >

      <div class="tracker-editor-header">

        <div>

          <span class="tracker-editor-eyebrow">
            TRACKING
          </span>

          <h2 id="tracker-editor-title">
            REPS
          </h2>

        </div>

        <button
          class="tracker-editor-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <div class="tracker-editor-content">

        <label
          class="tracker-editor-label"
          for="tracker-reps-input"
        >
          REPS
        </label>

        <input
          id="tracker-reps-input"
          class="tracker-editor-input"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          value="${routineExercise.reps > 0
      ? routineExercise.reps
      : ""
    }"
          placeholder="0"
        />


        <div class="tracker-editor-actions">

          <button
            class="tracker-editor-cancel"
            type="button"
          >
            CANCEL
          </button>

          <button
            class="tracker-editor-save"
            type="button"
          >
            SAVE REPS
          </button>

        </div>

      </div>

    </section>

  `;

  document.body.appendChild(
    overlay
  );


  const backdrop =
    overlay.querySelector(
      ".tracker-editor-backdrop"
    );

  const modal =
    overlay.querySelector(
      ".tracker-editor"
    );

  const input =
    overlay.querySelector(
      ".tracker-editor-input"
    );

  const closeButton =
    overlay.querySelector(
      ".tracker-editor-close"
    );

  const cancelButton =
    overlay.querySelector(
      ".tracker-editor-cancel"
    );

  const saveButton =
    overlay.querySelector(
      ".tracker-editor-save"
    );


  function closeEditor(
    onComplete
  ) {

    gsap.timeline({
      onComplete: () => {

        overlay.remove();

        onComplete?.();

      }
    })

      .to(modal, {
        opacity: 0,
        y: 14,
        scale: 0.98,
        duration: 0.18,
        ease: "power2.in"
      })

      .to(
        backdrop,
        {
          opacity: 0,
          duration: 0.14
        },
        "-=0.1"
      );

  }


  closeButton.addEventListener(
    "click",
    () => closeEditor()
  );

  cancelButton.addEventListener(
    "click",
    () => closeEditor()
  );

  backdrop.addEventListener(
    "click",
    () => closeEditor()
  );


  saveButton.addEventListener(
    "click",
    () => {

      const value =
        Number(
          input.value
        );

      if (
        !Number.isFinite(value) ||
        value < 0 ||
        !Number.isInteger(value)
      ) {

        gsap.timeline()
          .to(input, {
            x: -5,
            duration: 0.05
          })
          .to(input, {
            x: 5,
            duration: 0.05
          })
          .to(input, {
            x: 0,
            duration: 0.07
          });

        input.focus();

        return;
      }


      routineExercise.reps =
        value;

      closeEditor(() => {
        renderRoutineDetail();
      });

    }
  );


  gsap.set(
    overlay,
    {
      opacity: 1
    }
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
      y: 22,
      scale: 0.97
    }
  );


  gsap.timeline({
    onComplete: () => {

      input.focus();

      input.select();

    }
  })

    .to(
      backdrop,
      {
        opacity: 1,
        duration: 0.2,
        ease: "power2.out"
      }
    )

    .to(
      modal,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.32,
        ease: "back.out(1.25)"
      },
      "-=0.08"
    );

}

function animateRoutineDetail() {

  const page =
    document.querySelector(
      ".routine-detail-page"
    );

  const items =
    document.querySelectorAll(
      ".routine-exercise-item"
    );

  gsap.fromTo(
    page,
    {
      opacity: 0,
      y: 18
    },
    {
      opacity: 1,
      y: 0,
      duration: 0.45,
      ease: "power3.out"
    }
  );

  gsap.fromTo(
    items,
    {
      opacity: 0,
      x: 18
    },
    {
      opacity: 1,
      x: 0,
      duration: 0.35,
      stagger: 0.06,
      ease: "power3.out"
    }
  );
}

function animateRoutineCards() {
  const cards = document.querySelectorAll(".routine-card");

  if (!cards.length) return;

  gsap.fromTo(
    cards,
    {
      opacity: 0,
      y: 24,
      scale: 0.98
    },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.5,
      stagger: 0.07,
      ease: "power3.out"
    }
  );
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
          routine.exercises.some(
            (item) =>
              item.exerciseId === exercise.id
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
            routine.exercises.some(
              (item) =>
                item.exerciseId === exercise.id
            );


          if (alreadyAdded) {

            routine.exercises =
              routine.exercises.filter(
                (item) =>
                  item.exerciseId !== exercise.id
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


          routine.exercises.push({
            exerciseId: exercise.id,
            weight: 0,
            reps: 0,
            sets: 3,
            notes: ""
          });


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

        exercises: exercise
          ? [{
            exerciseId: exercise.id,
            weight: 0,
            reps: 0,
            sets: 3,
            notes: ""
          }]
          : []

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

          if (parentSheet) {
            closeRoutineSheet(parentSheet);
          }

          if (document.querySelector(".routines-screen")) {
            renderRoutines();
          }

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

function openMoveExerciseSheet(
  routineExercise,
  exercise
) {

  if (!activeRoutine || !routineExercise || !exercise) {
    return;
  }

  if (
    document.querySelector(
      ".move-exercise-overlay"
    )
  ) {
    return;
  }

  const currentIndex =
    activeRoutine.exercises.findIndex(
      (item) =>
        item.exerciseId ===
        routineExercise.exerciseId
    );

  if (currentIndex === -1) {
    return;
  }

  const canMoveUp =
    currentIndex > 0;

  const canMoveDown =
    currentIndex <
    activeRoutine.exercises.length - 1;

  const overlay =
    document.createElement("div");

  overlay.className =
    "move-exercise-overlay";

  overlay.innerHTML = `
    <div class="move-exercise-backdrop"></div>

    <section class="move-exercise-sheet">

      <div class="move-exercise-handle"></div>

      <div class="move-exercise-header">

        <div>
          <span class="move-exercise-eyebrow">
            REORDER EXERCISE
          </span>

          <h2>
            ${exercise.name}
          </h2>
        </div>

        <button
          class="move-exercise-close"
          type="button"
        >
          ×
        </button>

      </div>

      <div class="move-exercise-position">
        POSITION
        ${String(currentIndex + 1).padStart(2, "0")}
        / 
        ${String(activeRoutine.exercises.length).padStart(2, "0")}
      </div>

      <div class="move-exercise-actions">

        <button
          class="move-exercise-action"
          data-direction="up"
          type="button"
          ${canMoveUp ? "" : "disabled"}
        >
          <span>↑</span>
          <div>
            <strong>MOVE UP</strong>
            <small>Move toward the top</small>
          </div>
        </button>

        <button
          class="move-exercise-action"
          data-direction="down"
          type="button"
          ${canMoveDown ? "" : "disabled"}
        >
          <span>↓</span>
          <div>
            <strong>MOVE DOWN</strong>
            <small>Move toward the bottom</small>
          </div>
        </button>

      </div>

    </section>
  `;

  document.body.appendChild(overlay);

  const backdrop =
    overlay.querySelector(
      ".move-exercise-backdrop"
    );

  const sheet =
    overlay.querySelector(
      ".move-exercise-sheet"
    );

  const closeButton =
    overlay.querySelector(
      ".move-exercise-close"
    );

  const closeSheet = () => {

    gsap.timeline({
      onComplete: () => {
        overlay.remove();
      }
    })

      .to(sheet, {
        y: "100%",
        duration: 0.3,
        ease: "power3.in"
      })

      .to(
        backdrop,
        {
          opacity: 0,
          duration: 0.2
        },
        "-=0.18"
      );
  };

  closeButton.addEventListener(
    "click",
    closeSheet
  );

  backdrop.addEventListener(
    "click",
    closeSheet
  );

  overlay
    .querySelectorAll(
      ".move-exercise-action"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          const direction =
            button.dataset.direction;

          const newIndex =
            direction === "up"
              ? currentIndex - 1
              : currentIndex + 1;

          if (
            newIndex < 0 ||
            newIndex >=
            activeRoutine.exercises.length
          ) {
            return;
          }

          const items =
            activeRoutine.exercises;

          [
            items[currentIndex],
            items[newIndex]
          ] = [
              items[newIndex],
              items[currentIndex]
            ];

          gsap.timeline({
            onComplete: () => {
              overlay.remove();
              renderRoutineDetail();
            }
          })

            .to(sheet, {
              y: "100%",
              duration: 0.28,
              ease: "power3.in"
            })

            .to(
              backdrop,
              {
                opacity: 0,
                duration: 0.18
              },
              "-=0.16"
            );

        }
      );

    });

  gsap.set(sheet, {
    y: "100%"
  });

  gsap.set(backdrop, {
    opacity: 0
  });

  gsap.timeline()
    .to(
      backdrop,
      {
        opacity: 1,
        duration: 0.22
      }
    )
    .to(
      sheet,
      {
        y: 0,
        duration: 0.42,
        ease: "power4.out"
      },
      "-=0.1"
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
  // ROUTINE CARD
  // =======================

  document
    .querySelectorAll(".routine-card")
    .forEach((card) => {

      card.addEventListener(
        "click",
        () => {

          const routineId =
            Number(card.dataset.routineId);

          const routine =
            routines.find(
              (item) =>
                item.id === routineId
            );

          if (!routine) {
            return;
          }

          activeRoutine = routine;

          renderRoutineDetail();

        }
      );

    });

  const routineCompleteCheckbox = document.querySelector(
    ".routine-complete-checkbox"
  );

  routineCompleteCheckbox?.addEventListener("change", (event) => {
    const today = getLocalDate();

    if (event.target.checked) {
      const alreadyCompleted = workoutSessions.some(
        session =>
          session.routineId === activeRoutine.id &&
          session.date === today
      );

      if (!alreadyCompleted) {
        workoutSessions.push({
          id: Date.now(),
          routineId: activeRoutine.id,
          date: today,
          completedAt: new Date().toISOString(),
          exercises: activeRoutine.exercises.map((routineExercise) => ({
            exerciseId: routineExercise.exerciseId,
            weight: routineExercise.weight,
            reps: routineExercise.reps,
            sets: routineExercise.sets,
            notes: routineExercise.notes
          }))
        });
      }

      animateRoutineCompletion();
    } else {
      workoutSessions = workoutSessions.filter(
        session =>
          !(
            session.routineId === activeRoutine.id &&
            session.date === today
          )
      );
    }
  });

  // =======================
  // ROUTINE EXERCISE → DETAIL
  // =======================

  document
    .querySelectorAll(".routine-exercise-item")
    .forEach((item) => {

      item.addEventListener(
        "click",
        (event) => {

          // Ignore tracking controls
          if (
            event.target.closest(
              ".routine-value-button"
            ) ||
            event.target.closest(
              ".routine-exercise-menu"
            )
          ) {
            return;
          }

          const exerciseId =
            Number(
              item.dataset.exerciseId
            );

          const exercise =
            exercises.find(
              (entry) =>
                entry.id === exerciseId
            );

          if (!exercise) {
            return;
          }

          selectedExercise = exercise;

          openExerciseDetail(
            item,
            exercise
          );

        }
      );

    });

  // =======================
  // ROUTINE EXERCISE MENU
  // =======================

  document
    .querySelectorAll(".routine-exercise-menu")
    .forEach((button) => {

      button.addEventListener(
        "click",
        (event) => {

          event.stopPropagation();

          const item =
            button.closest(
              ".routine-exercise-item"
            );

          if (!item || !activeRoutine) {
            return;
          }

          const exerciseId =
            Number(
              item.dataset.exerciseId
            );

          const routineExercise =
            activeRoutine.exercises.find(
              (entry) =>
                entry.exerciseId ===
                exerciseId
            );

          const exercise =
            exercises.find(
              (entry) =>
                entry.id === exerciseId
            );

          if (!routineExercise || !exercise) {
            return;
          }

          openRoutineExerciseMenu(
            routineExercise,
            exercise
          );

        }
      );

    });

  // =======================
  // ROUTINE DETAIL — MENU
  // =======================

  const routineDetailMenu =
    document.querySelector(
      ".routine-detail-menu"
    );

  routineDetailMenu?.addEventListener(
    "click",
    () => {

      if (!activeRoutine) {
        return;
      }

      openRoutineMenu(activeRoutine);

    }
  );

  // =======================
  // ROUTINE WEIGHT CONTROL
  // =======================

  document
    .querySelectorAll(
      '.routine-value-button[data-control="weight"]'
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        (event) => {

          event.stopPropagation();

          const item =
            button.closest(
              ".routine-exercise-item"
            );

          if (!item) {
            return;
          }

          const exerciseId =
            Number(
              item.dataset.exerciseId
            );

          const routineExercise =
            activeRoutine?.exercises.find(
              (exercise) =>
                exercise.exerciseId ===
                exerciseId
            );

          if (!routineExercise) {
            return;
          }

          openWeightEditor(
            routineExercise
          );

        }
      );

    });

  // =======================
  // ROUTINE REPS CONTROL
  // =======================

  document
    .querySelectorAll(
      '.routine-value-button[data-control="reps"]'
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        (event) => {

          event.stopPropagation();

          const item =
            button.closest(
              ".routine-exercise-item"
            );

          if (!item) {
            return;
          }

          const exerciseId =
            Number(
              item.dataset.exerciseId
            );

          const routineExercise =
            activeRoutine?.exercises.find(
              (exercise) =>
                exercise.exerciseId ===
                exerciseId
            );

          if (!routineExercise) {
            return;
          }

          openRepsEditor(
            routineExercise
          );

        }
      );

    });

  // =======================
  // ROUTINE DETAIL — BACK
  // =======================

  const routineBackButton =
    document.querySelector(
      ".routine-back-button"
    );

  routineBackButton?.addEventListener(
    "click",
    () => {

      activeRoutine = null;

      renderRoutines();

    }
  );

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
  // CREATE ROUTINE — PAGE
  // =======================

  const createRoutinePageButton =
    document.querySelector(
      ".create-routine-page-button"
    );

  createRoutinePageButton?.addEventListener(
    "click",
    () => {

      openCreateRoutineModal(
        null,
        null,
        null
      );

    }
  );

  function openRoutineMenu(routine) {

    if (
      document.querySelector(
        ".routine-menu-overlay"
      )
    ) {
      return;
    }

    const overlay =
      document.createElement("div");

    overlay.className =
      "routine-menu-overlay";

    overlay.innerHTML = `
    <div class="routine-menu-backdrop"></div>

    <section class="routine-menu-sheet">

      <div class="routine-menu-handle"></div>

      <div class="routine-menu-header">

        <span class="routine-menu-eyebrow">
          ROUTINE OPTIONS
        </span>

        <h2>${routine.name}</h2>

      </div>

      <div class="routine-menu-actions">

        <button
          class="routine-menu-action"
          data-action="rename"
          type="button"
        >
          <span>✎</span>
          <strong>RENAME ROUTINE</strong>
        </button>

        <button
          class="routine-menu-action danger"
          data-action="delete"
          type="button"
        >
          <span>×</span>
          <strong>DELETE ROUTINE</strong>
        </button>

      </div>

    </section>
  `;

    document.body.appendChild(overlay);

    const backdrop =
      overlay.querySelector(
        ".routine-menu-backdrop"
      );

    const sheet =
      overlay.querySelector(
        ".routine-menu-sheet"
      );

    const closeMenu = () => {

      gsap.timeline({
        onComplete: () => {
          overlay.remove();
        }
      })
        .to(sheet, {
          y: "100%",
          duration: 0.28,
          ease: "power3.in"
        })
        .to(
          backdrop,
          {
            opacity: 0,
            duration: 0.18
          },
          "-=0.16"
        );
    };

    backdrop.addEventListener(
      "click",
      closeMenu
    );

    overlay
      .querySelectorAll(
        ".routine-menu-action"
      )
      .forEach((button) => {

        button.addEventListener(
          "click",
          () => {

            const action =
              button.dataset.action;

            closeMenu();

            if (action === "rename") {
              openRenameRoutineModal(routine);
            }

            if (action === "delete") {
              openDeleteRoutineModal(routine);
            }

          }
        );

      });

    gsap.set(sheet, {
      y: "100%"
    });

    gsap.set(backdrop, {
      opacity: 0
    });

    gsap.timeline()
      .to(backdrop, {
        opacity: 1,
        duration: 0.2
      })
      .to(
        sheet,
        {
          y: 0,
          duration: 0.4,
          ease: "power4.out"
        },
        "-=0.08"
      );
  }

  function openRenameRoutineModal(routine) {

    const overlay = document.createElement("div");

    overlay.className = "rename-routine-overlay";

    overlay.innerHTML = `
    <div class="rename-routine-backdrop"></div>

    <section class="rename-routine-modal">

      <span class="rename-routine-eyebrow">
        ROUTINE SETTINGS
      </span>

      <h2>Rename your routine.</h2>

      <input
        class="rename-routine-input"
        type="text"
        value="${routine.name}"
        maxlength="40"
        autocomplete="off"
      />

      <div class="rename-routine-actions">

        <button
          class="rename-routine-cancel"
          type="button"
        >
          CANCEL
        </button>

        <button
          class="rename-routine-save"
          type="button"
        >
          SAVE
        </button>

      </div>

    </section>
  `;

    document.body.appendChild(overlay);

    const backdrop =
      overlay.querySelector(
        ".rename-routine-backdrop"
      );

    const modal =
      overlay.querySelector(
        ".rename-routine-modal"
      );

    const input =
      overlay.querySelector(
        ".rename-routine-input"
      );

    const cancelButton =
      overlay.querySelector(
        ".rename-routine-cancel"
      );

    const saveButton =
      overlay.querySelector(
        ".rename-routine-save"
      );

    function closeModal() {

      gsap.timeline({
        onComplete: () => {
          overlay.remove();
        }
      })

        .to(modal, {
          opacity: 0,
          y: 18,
          duration: 0.2,
          ease: "power2.in"
        })

        .to(
          backdrop,
          {
            opacity: 0,
            duration: 0.15
          },
          "-=0.1"
        );
    }

    function saveRename() {

      const newName =
        input.value.trim();

      if (!newName) {
        input.focus();
        return;
      }

      routine.name = newName;

      closeModal();

      if (activeRoutine?.id === routine.id) {
        activeRoutine = routine;
        renderRoutineDetail();
      } else {
        renderRoutines();
      }
    }

    cancelButton.addEventListener(
      "click",
      closeModal
    );

    backdrop.addEventListener(
      "click",
      closeModal
    );

    saveButton.addEventListener(
      "click",
      saveRename
    );

    input.addEventListener(
      "keydown",
      (event) => {

        if (event.key === "Enter") {
          saveRename();
        }

        if (event.key === "Escape") {
          closeModal();
        }

      }
    );

    gsap.set(backdrop, {
      opacity: 0
    });

    gsap.set(modal, {
      opacity: 0,
      y: 20,
      scale: 0.97
    });

    gsap.timeline({
      onComplete: () => {
        input.focus();
        input.select();
      }
    })

      .to(backdrop, {
        opacity: 1,
        duration: 0.18,
        ease: "power2.out"
      })

      .to(
        modal,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.3,
          ease: "back.out(1.2)"
        },
        "-=0.08"
      );

  }

  function openDeleteRoutineModal(routine) {

    const overlay = document.createElement("div");

    overlay.className = "delete-routine-overlay";

    overlay.innerHTML = `
    <div class="delete-routine-backdrop"></div>

    <section
      class="delete-routine-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-routine-title"
    >

      <span class="delete-routine-eyebrow">
        PERMANENT ACTION
      </span>

      <h2 id="delete-routine-title">
        Delete this routine?
      </h2>

      <p>
        You're about to delete
        <strong>${routine.name}</strong>.
        This action cannot be undone.
      </p>

      <div class="delete-routine-actions">

        <button
          class="delete-routine-cancel"
          type="button"
        >
          CANCEL
        </button>

        <button
          class="delete-routine-confirm"
          type="button"
        >
          DELETE
        </button>

      </div>

    </section>
  `;

    document.body.appendChild(overlay);

    const backdrop =
      overlay.querySelector(
        ".delete-routine-backdrop"
      );

    const modal =
      overlay.querySelector(
        ".delete-routine-modal"
      );

    const cancelButton =
      overlay.querySelector(
        ".delete-routine-cancel"
      );

    const confirmButton =
      overlay.querySelector(
        ".delete-routine-confirm"
      );

    function closeModal() {

      gsap.timeline({
        onComplete: () => {
          overlay.remove();
        }
      })
        .to(modal, {
          opacity: 0,
          y: 18,
          scale: 0.97,
          duration: 0.2,
          ease: "power2.in"
        })
        .to(
          backdrop,
          {
            opacity: 0,
            duration: 0.15
          },
          "-=0.1"
        );
    }

    function deleteRoutine() {

      routines = routines.filter(
        (item) => item.id !== routine.id
      );

      if (
        activeRoutine &&
        activeRoutine.id === routine.id
      ) {
        activeRoutine = null;
      }

      closeModal();

      setTimeout(() => {
        renderRoutines();
      }, 220);
    }

    cancelButton.addEventListener(
      "click",
      closeModal
    );

    backdrop.addEventListener(
      "click",
      closeModal
    );

    confirmButton.addEventListener(
      "click",
      deleteRoutine
    );

    gsap.set(backdrop, {
      opacity: 0
    });

    gsap.set(modal, {
      opacity: 0,
      y: 20,
      scale: 0.97
    });

    gsap.timeline()
      .to(backdrop, {
        opacity: 1,
        duration: 0.18,
        ease: "power2.out"
      })
      .to(
        modal,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.3,
          ease: "back.out(1.15)"
        },
        "-=0.08"
      );

  }


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


          const page = button.dataset.page;

          console.log(
            "Navigation:",
            page
          );

          if (page === "workouts") {
            render();
            return;
          }

          if (page === "routines") {
            renderRoutines();
            return;
          }

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

function animateRoutineCompletion() {
  const control = document.querySelector(".routine-complete-control");

  if (!control || typeof gsap === "undefined") return;

  gsap.fromTo(
    control,
    {
      scale: 0.96
    },
    {
      scale: 1,
      duration: 0.45,
      ease: "back.out(1.7)"
    }
  );
}

// =========================
// INITIAL RENDER
// =========================

render();
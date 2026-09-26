import "../css/variables.css";
import "../css/reset.css";
import "../css/style.css";
import { Clerk } from "@clerk/clerk-js";
import { createClerkSupabaseClient } from "./supabase.js";

import { EXERCISES } from "./exerciseData.js";

const app = document.querySelector("#app");

import { exercises } from "./data.js";
import gsap from "gsap";


const publishableKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error(
    "Missing VITE_CLERK_PUBLISHABLE_KEY"
  );
}

const clerkDomain =
  atob(publishableKey.split("_")[2]).slice(0, -1);

await new Promise((resolve, reject) => {

  const script =
    document.createElement("script");

  script.src =
    `https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`;

  script.async = true;
  script.crossOrigin = "anonymous";

  script.onload = resolve;

  script.onerror = () =>
    reject(
      new Error(
        "Failed to load Clerk UI bundle"
      )
    );

  document.head.appendChild(script);
});

const clerk =
  new Clerk(publishableKey);

await clerk.load({
  ui: {
    ClerkUI:
      window.__internal_ClerkUICtor
  }
});

const supabase =
  createClerkSupabaseClient(clerk);

async function initializeApp() {

  if (!clerk.isSignedIn) {

    app.innerHTML = `
      <div id="clerk-sign-in"></div>
    `;

    clerk.mountSignIn(
      document.querySelector("#clerk-sign-in")
    );

    return;
  }

  loadRoutinesFromCache();
  loadWorkoutSessionsFromCache();

  render();

  Promise.allSettled([
    loadRoutinesFromSupabase(),
    loadWorkoutSessionsFromSupabase()
  ]).then(() => {
    render();
  });

  // Sync account settings in the background
  loadUserSettingsFromSupabase();
}

function applyMotionPreference() {

  if (typeof gsap === "undefined") {
    return;
  }

  gsap.globalTimeline.timeScale(
    reduceMotion ? 100 : 1
  );

  document.documentElement.dataset.reduceMotion =
    reduceMotion ? "true" : "false";
}


// =========================
// FILTER STATE
// =========================

let activeMuscle = "All";
let activeEquipment = "All";
let searchTerm = "";
let selectedExercise = null;
let activeRoutine = null;

let reduceMotion =
  localStorage.getItem("redline-reduce-motion") === "true";

let weightUnit =
  localStorage.getItem("redline-weight-unit") || "KG";

async function loadUserSettingsFromSupabase() {

  const userId = clerk.user?.id;

  if (!userId) {
    return;
  }

  const {
    data,
    error
  } = await supabase
    .from("user_settings")
    .select(`
      reduce_motion,
      weight_unit
    `)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {

    console.error(
      "Failed to load user settings:",
      error
    );

    return;
  }

  // First login / no settings row yet
  if (!data) {

    await syncUserSettingsToSupabase();

    return;
  }

  // Supabase is the source of truth
  reduceMotion =
    data.reduce_motion === true;

  weightUnit =
    data.weight_unit === "LB"
      ? "LB"
      : "KG";

  // Refresh local cache
  localStorage.setItem(
    "redline-reduce-motion",
    reduceMotion
  );

  localStorage.setItem(
    "redline-weight-unit",
    weightUnit
  );

  applyMotionPreference();

}


async function syncUserSettingsToSupabase() {

  const userId = clerk.user?.id;

  if (!userId) {
    return;
  }

  const {
    error
  } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: userId,
        reduce_motion: reduceMotion,
        weight_unit: weightUnit,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "user_id"
      }
    );

  if (error) {

    console.error(
      "Failed to save user settings:",
      error
    );

  }

}

const KG_TO_LB = 2.2046226218;

function formatWeight(kg) {

  if (
    !Number.isFinite(Number(kg)) ||
    Number(kg) <= 0
  ) {
    return `— ${weightUnit.toLowerCase()}`;
  }

  const value =
    weightUnit === "LB"
      ? Number(kg) * KG_TO_LB
      : Number(kg);

  return `${Number(value.toFixed(1))} ${weightUnit.toLowerCase()}`;
}

function weightToKg(value) {

  const numericValue =
    Number(value);

  if (
    !Number.isFinite(numericValue) ||
    numericValue < 0
  ) {
    return 0;
  }

  return weightUnit === "LB"
    ? numericValue / KG_TO_LB
    : numericValue;
}

function getUserCacheKey(type) {
  const userId = clerk.user?.id;

  return userId
    ? `redline-${type}-cache-${userId}`
    : `redline-${type}-cache`;
}

let routines = [
];

function saveRoutinesToCache() {
  try {
    localStorage.setItem(
      getUserCacheKey("routines"),
      JSON.stringify(routines)
    );
  } catch (error) {
    console.warn(
      "Failed to save routine cache:",
      error
    );
  }
}

function loadRoutinesFromCache() {

  try {

    const cached =
      localStorage.getItem(
        getUserCacheKey("routines")
      );

    if (!cached) {
      return;
    }

    const parsed =
      JSON.parse(cached);

    if (!Array.isArray(parsed)) {
      return;
    }

    routines = parsed;

    console.log(
      "REDLINE routines restored from cache:",
      routines
    );

  } catch (error) {

    console.warn(
      "Failed to restore routine cache:",
      error
    );

    localStorage.removeItem(
      getUserCacheKey("routines")
    );

  }

}

async function loadRoutinesFromSupabase() {

  const userId = clerk.user?.id;

  if (!userId) {
    console.warn("No Clerk user is signed in.");
    return;
  }

  const { data, error } = await supabase
    .from("routines")
    .select(`
      id,
      name,
      created_at,
      routine_exercises (
        id,
        exercise_id,
        order_index,
        sets,
        reps,
        weight,
        notes
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load routines:", error);
    return;
  }

  /*
   * First-time migration:
   * If this Clerk account has no routines yet,
   * save the routines currently in memory.
   */
  if (!data.length && routines.length) {

    for (const routine of routines) {

      const { data: createdRoutine, error: routineError } =
        await supabase
          .from("routines")
          .insert({
            user_id: userId,
            name: routine.name
          })
          .select()
          .single();

      if (routineError) {
        console.error(
          "Failed to create routine:",
          routineError
        );
        continue;
      }

      if (routine.exercises.length) {

        const exerciseRows =
          routine.exercises.map(
            (exercise, index) => ({
              routine_id: createdRoutine.id,
              exercise_id: exercise.exerciseId,
              order_index: index,
              sets: exercise.sets,
              reps: exercise.reps,
              weight: exercise.weight,
              notes: exercise.notes
            })
          );

        const { error: exerciseError } =
          await supabase
            .from("routine_exercises")
            .insert(exerciseRows);

        if (exerciseError) {
          console.error(
            "Failed to save routine exercises:",
            exerciseError
          );
        }
      }
    }

    /*
     * Load again so routines now contain
     * their real Supabase IDs.
     */
    return loadRoutinesFromSupabase();
  }

  const previousRoutines =
    JSON.stringify(routines);

  routines = data.map((routine) => ({
    id: routine.id,
    name: routine.name,

    exercises:
      (routine.routine_exercises || [])
        .sort(
          (a, b) =>
            a.order_index - b.order_index
        )
        .map((exercise) => ({
          exerciseId: exercise.exercise_id,
          weight: Number(exercise.weight),
          reps: exercise.reps,
          sets: exercise.sets,
          notes: exercise.notes || ""
        }))
  }));

  console.log(
    "REDLINE routines loaded:",
    routines
  );

  const nextRoutines =
    JSON.stringify(routines);

  if (nextRoutines !== previousRoutines) {
    saveRoutinesToCache();
  }
}

async function syncRoutineToSupabase(routine) {

  if (!routine?.id) {
    return;
  }

  const { error: routineError } =
    await supabase
      .from("routines")
      .update({
        name: routine.name
      })
      .eq("id", routine.id)
      .eq("user_id", clerk.user.id);

  if (routineError) {
    console.error(
      "Failed to update routine:",
      routineError
    );

    return;
  }


  const { error: deleteError } =
    await supabase
      .from("routine_exercises")
      .delete()
      .eq("routine_id", routine.id);

  if (deleteError) {
    console.error(
      "Failed to clear routine exercises:",
      deleteError
    );

    return;
  }


  if (!routine.exercises.length) {
    saveRoutinesToCache();
    return;
  }


  const exerciseRows =
    routine.exercises.map(
      (exercise, index) => ({
        routine_id: routine.id,
        exercise_id: exercise.exerciseId,
        order_index: index,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        notes: exercise.notes || ""
      })
    );


  const { error: exerciseError } =
    await supabase
      .from("routine_exercises")
      .insert(exerciseRows);


  if (exerciseError) {
    console.error(
      "Failed to save routine exercises:",
      exerciseError
    );

    return;
  }

  saveRoutinesToCache();


  console.log(
    "Routine synced:",
    routine.name
  );
}

let workoutSessions = [];
let sessionNoteDraft = "";
let profileReturnView = "workouts";

function loadWorkoutSessionsFromCache() {
  try {
    const cached = localStorage.getItem(
      getUserCacheKey("workout-sessions")
    );

    if (!cached) {
      return;
    }

    const parsed = JSON.parse(cached);

    if (!Array.isArray(parsed)) {
      return;
    }

    workoutSessions = parsed;

    console.log(
      "REDLINE workout sessions restored from cache:",
      workoutSessions
    );

  } catch (error) {

    console.warn(
      "Failed to restore workout session cache:",
      error
    );

    localStorage.removeItem(
      getUserCacheKey("workout-sessions")
    );

  }
}

function saveWorkoutSessionsToCache() {
  try {
    localStorage.setItem(
      getUserCacheKey("workout-sessions"),
      JSON.stringify(workoutSessions)
    );
  } catch (error) {
    console.warn(
      "Failed to save workout session cache:",
      error
    );
  }
}

async function loadWorkoutSessionsFromSupabase() {

  const userId = clerk.user?.id;

  if (!userId) {
    console.warn("No Clerk user is signed in.");
    return;
  }

  const { data, error } = await supabase
    .from("workout_sessions")
    .select(`
      id,
      routine_id,
      date,
      completed_at,
      note,
      workout_session_exercises (
        id,
        exercise_id,
        weight,
        reps,
        sets,
        notes
      )
    `)
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) {
    console.error(
      "Failed to load workout sessions:",
      error
    );
    return;
  }

  workoutSessions = data.map((session) => ({
    id: session.id,
    routineId: session.routine_id,
    date: session.date,
    completedAt: session.completed_at,
    note: session.note || "",

    exercises:
      (session.workout_session_exercises || [])
        .map((exercise) => ({
          exerciseId: exercise.exercise_id,
          weight: Number(exercise.weight),
          reps: exercise.reps,
          sets: exercise.sets,
          notes: exercise.notes || ""
        }))
  }));

  console.log(
    "REDLINE workout sessions loaded:",
    workoutSessions
  );

  localStorage.setItem(
    getUserCacheKey("workout-sessions"),
    JSON.stringify(workoutSessions)
  );
}

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

  const selectedMuscle =
    sessionStorage.getItem("redlineSelectedMuscle");

  if (selectedMuscle) {
    activeMuscle = selectedMuscle;
    activeEquipment = "All";
    searchTerm = "";

    sessionStorage.removeItem(
      "redlineSelectedMuscle"
    );
  }

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
          ${clerk.user?.imageUrl
      ? `<img
      src="${clerk.user.imageUrl}"
      alt=""
    >`
      : "●"
    }
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

// Anatomical region ID -> category used by exercises and workout filters.
// null means the library has no matching category yet; handoff falls back to All.
const MUSCLE_EXERCISE_CATEGORIES = Object.freeze({
  chest: "Chest",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: null,
  abs: null,
  obliques: null,
  serratus: null,
  quads: "Legs",
  adductors: null,
  calves: "Legs",
  traps: "Back",
  rearDelts: "Shoulders",
  lats: "Back",
  lowerBack: "Back",
  glutes: "Legs",
  hamstrings: "Hamstrings",
});

function getExerciseCategoryForMuscle(muscleId) {
  return Object.hasOwn(MUSCLE_EXERCISE_CATEGORIES, muscleId)
    ? MUSCLE_EXERCISE_CATEGORIES[muscleId]
    : null;
}

const EXERCISE_MUSCLE_CATEGORIES = new Set(
  Object.values(MUSCLE_EXERCISE_CATEGORIES).filter(Boolean)
);

const MUSCLE_MASKS = {
  front: {
    chest: {
      name: "Chest",
      mask: "/assets/muscle-map/front/masks/chest.png",
    },

    shoulders: {
      name: "Shoulders",
      mask: "/assets/muscle-map/front/masks/shoulders.png",
    },

    biceps: {
      name: "Biceps",
      mask: "/assets/muscle-map/front/masks/biceps.png",
    },

    triceps: {
      name: "Triceps",
      mask: "/assets/muscle-map/front/masks/triceps.png",
    },

    forearms: {
      name: "Forearms",
      mask: "/assets/muscle-map/front/masks/forearms.png",
    },

    abs: {
      name: "Abs",
      mask: "/assets/muscle-map/front/masks/abs.png",
    },

    obliques: {
      name: "Obliques",
      mask: "/assets/muscle-map/front/masks/obliques.png",
    },

    serratus: {
      name: "Serratus",
      mask: "/assets/muscle-map/front/masks/serratus.png",
    },

    quads: {
      name: "Quads",
      mask: "/assets/muscle-map/front/masks/quads.png",
    },

    adductors: {
      name: "Adductors",
      mask: "/assets/muscle-map/front/masks/adductors.png",
    },

    calves: {
      name: "Calves",
      mask: "/assets/muscle-map/front/masks/calves.png",
    },
  },

  back: {
    traps: {
      name: "Traps",
      mask: "/assets/muscle-map/back/masks/traps.png",
    },

    rearDelts: {
      name: "Rear Delts",
      mask: "/assets/muscle-map/back/masks/rear-delts.png",
    },

    lats: {
      name: "Lats",
      mask: "/assets/muscle-map/back/masks/lats.png",
    },

    triceps: {
      name: "Triceps",
      mask: "/assets/muscle-map/back/masks/triceps.png",
    },

    forearms: {
      name: "Forearms",
      mask: "/assets/muscle-map/back/masks/forearms.png",
    },

    lowerBack: {
      name: "Lower Back",
      mask: "/assets/muscle-map/back/masks/lower-back.png",
    },

    glutes: {
      name: "Glutes",
      mask: "/assets/muscle-map/back/masks/glutes.png",
    },

    hamstrings: {
      name: "Hamstrings",
      mask: "/assets/muscle-map/back/masks/hamstrings.png",
    },

    calves: {
      name: "Calves",
      mask: "/assets/muscle-map/back/masks/calves.png",
    },
  },
};


class MuscleMaskMap {

  constructor(model) {

    this.model = model;
    this.image = model.querySelector("img");
    this.canvas = model.querySelector(".muscle-map-canvas");

    this.ctx = this.canvas.getContext("2d", {
      willReadFrequently: true
    });

    this.maskCanvas = document.createElement("canvas");

    this.maskCtx = this.maskCanvas.getContext("2d", {
      willReadFrequently: true
    });

    this.side = "front";
    this.mode = "anatomy";
    this.layer = "surface";
    this.masks = {};
    this.selectedMuscle = null;
    this.ready = false;

    this.init();
  }

  async setSide(side) {

    if (this.side === side) return;

    this.side = side;
    this.selectedMuscle = null;
    this.masks = {};
    this.hideSelectionPanel();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.image.src =
      side === "front"
        ? "/assets/muscle-map/front/base.webp"
        : "/assets/muscle-map/back/base.png";
    this.image.alt = `${side === "front" ? "Front" : "Back"}-view anatomical muscle map`;

    await this.waitForImage();
    this.resize(false);
    await this.loadMasks();
    this.updateAccessibleMuscles();
    this.renderMode();
  }

  async init() {

    await this.waitForImage();
    this.resize();
    await this.loadMasks();
    this.ready = true;
    this.updateAccessibleMuscles();
    this.renderMode();

    this.canvas.addEventListener(
      "pointerup",
      (event) => this.handlePointer(event)
    );

  }


  waitForImage() {

    return new Promise((resolve) => {

      if (this.image.complete) {
        resolve();
        return;
      }

      this.image.addEventListener(
        "load",
        resolve,
        { once: true }
      );

    });
  }


  resize(reloadMasks = true) {

    const width = this.image.naturalWidth;
    const height = this.image.naturalHeight;

    if (!width || !height) return;

    const dimensionsChanged =
      this.canvas.width !== width ||
      this.canvas.height !== height;

    if (!dimensionsChanged) {
      this.renderMode();
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    this.maskCanvas.width = width;
    this.maskCanvas.height = height;

    if (this.ready && reloadMasks) {
      this.loadMasks().then(() => this.renderMode());
    }
  }


  async loadMasks() {
    const muscles = MUSCLE_MASKS[this.side];

    this.masks = {};
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.maskCanvas.width = width;
    this.maskCanvas.height = height;

    for (const [id, muscle] of Object.entries(muscles)) {
      const image = new Image();

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = muscle.mask;
      });

      this.maskCtx.clearRect(0, 0, width, height);
      this.maskCtx.drawImage(image, 0, 0, width, height);

      // Keep only a compact hit map in memory; use a tinted canvas for overlays.
      const imageData = this.maskCtx.getImageData(
        0,
        0,
        width,
        height
      );

      const hitMap = new Uint8Array(width * height);

      // Detect whether the mask uses white-on-dark or black-on-light.
      // This makes the loader work with either mask style.
      let brightPixels = 0;
      let darkPixels = 0;

      for (
        let i = 0;
        i < imageData.data.length;
        i += 4
      ) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];

        if (a === 0) continue;

        const brightness = (r + g + b) / 3;

        if (brightness > 220) {
          brightPixels++;
        }

        if (brightness < 35) {
          darkPixels++;
        }
      }

      const useBrightForeground =
        brightPixels <= darkPixels;

      for (
        let i = 0, pixel = 0;
        i < imageData.data.length;
        i += 4, pixel++
      ) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];

        const brightness = (r + g + b) / 3;

        const isMaskPixel =
          a > 0 &&
          (
            useBrightForeground
              ? brightness > 180
              : brightness < 100
          );

        if (isMaskPixel) {
          hitMap[pixel] = 1;

          imageData.data[i] = 225;
          imageData.data[i + 1] = 29;
          imageData.data[i + 2] = 46;
          imageData.data[i + 3] = 255;
        } else {
          imageData.data[i + 3] = 0;
        }
      }

      const tintedCanvas = document.createElement("canvas");
      tintedCanvas.width = width;
      tintedCanvas.height = height;
      tintedCanvas.getContext("2d").putImageData(imageData, 0, 0);

      this.masks[id] = {
        ...muscle,
        exerciseMuscle: getExerciseCategoryForMuscle(id),
        hitMap,
        tintedCanvas,
      };
    }
  }


  getPoint(event) {

    const rect =
      this.canvas.getBoundingClientRect();

    return {
      x: Math.floor(
        (event.clientX - rect.left) *
        (this.canvas.width / rect.width)
      ),

      y: Math.floor(
        (event.clientY - rect.top) *
        (this.canvas.height / rect.height)
      )
    };
  }


  isWhite(mask, x, y) {
    return mask.hitMap[y * this.canvas.width + x] === 1;
  }


  handlePointer(event) {

    const point = this.getPoint(event);

    for (const [id, muscle] of Object.entries(this.masks)) {

      if (
        this.isWhite(
          muscle,
          point.x,
          point.y
        )
      ) {

        this.select(id, muscle);

        return;
      }
    }

    this.clearSelection();
  }

  clearSelection() {
    this.selectedMuscle = null;
    this.hideSelectionPanel();
    this.updateAccessibleMuscles();
    this.renderMode();
  }

  updateAccessibleMuscles() {
    const options = document.querySelector(".muscle-map-region-options");
    if (!options) return;

    if (options.dataset.side === this.side && options.children.length) {
      options.querySelectorAll("[data-map-muscle]").forEach((button) => {
        button.setAttribute(
          "aria-pressed",
          this.selectedMuscle?.id === button.dataset.mapMuscle ? "true" : "false"
        );
      });
      return;
    }

    options.dataset.side = this.side;

    options.innerHTML = Object.entries(MUSCLE_MASKS[this.side])
      .map(([id, muscle]) => `
        <button
          type="button"
          data-map-muscle="${id}"
          aria-pressed="${this.selectedMuscle?.id === id}"
        >${muscle.name}</button>
      `)
      .join("");
  }

  hideSelectionPanel() {
    const panel = document.querySelector(
      ".muscle-selection-panel"
    );

    panel?.classList.remove("is-visible");
  }


  select(id, muscle) {

    this.selectedMuscle = {
      id,
      name: muscle.name,
      exerciseMuscle: getExerciseCategoryForMuscle(id),
      description: muscle.description
    };

    this.updateAccessibleMuscles();

    this.renderMode();

    showMusclePanel(
      this.selectedMuscle
    );
  }


  renderSelection() {
    if (!this.selectedMuscle) return;

    const muscle =
      this.masks[
      this.selectedMuscle.id
      ];

    if (!muscle) return;

    this.drawMask(muscle, 0.72);
  }

  renderActivity() {
    const activity = getMuscleActivity();

    for (const muscle of Object.values(this.masks)) {
      const muscleActivity = activity[muscle.exerciseMuscle];
      if (!muscleActivity) continue;

      this.drawMask(
        muscle,
        0.18 + muscleActivity.intensity * 0.58
      );
    }

    this.renderSelection();
    return activity;
  }

  renderSynergy() {
    if (!this.selectedMuscle) return {};

    const synergy = getMuscleSynergy(this.selectedMuscle.id);
    const maxCount = Math.max(
      ...Object.values(synergy).map((entry) => entry.sessions),
      0
    );

    if (!maxCount) {
      this.renderSelection();
      return synergy;
    }

    for (const muscle of Object.values(this.masks)) {
      const category = muscle.exerciseMuscle;
      if (!category || category === this.selectedMuscle.exerciseMuscle) continue;

      const related = synergy[category];
      if (!related) continue;

      this.drawMask(muscle, 0.2 + (related.sessions / maxCount) * 0.5);
    }

    this.renderSelection();
    return synergy;
  }

  drawMask(muscle, opacity) {
    if (!muscle?.tintedCanvas || opacity <= 0) return;

    this.ctx.save();
    this.ctx.globalAlpha = Math.min(opacity, 1);
    this.ctx.drawImage(muscle.tintedCanvas, 0, 0);
    this.ctx.restore();
  }

  setMode(mode) {
    if (!["anatomy", "activity", "synergy"].includes(mode)) return;

    this.mode = mode;
    this.selectedMuscle = null;
    this.hideSelectionPanel();
    this.updateAccessibleMuscles();
    this.renderMode();
  }

  setLayer(layer) {
    if (layer !== "surface" || this.layer === layer) return;
    this.layer = layer;
    this.renderMode();
  }

  renderMode() {
    if (!this.ctx || !this.ready) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const status = document.querySelector(".muscle-map-empty-state");
    const statusTitle = status?.querySelector("span");
    const statusText = status?.querySelector("p");

    if (this.mode === "activity") {
      const activity = this.renderActivity();
      const hasVisibleActivity = Object.values(this.masks).some(
        (muscle) => activity[muscle.exerciseMuscle]
      );

      if (!hasVisibleActivity) {
        if (statusTitle) statusTitle.textContent = "NO ACTIVITY IN THIS VIEW";
        if (statusText) statusText.textContent = "Logged workouts will appear here.";
      } else if (statusTitle) {
        statusTitle.textContent = "TRAINING ACTIVITY";
        if (statusText) statusText.textContent = "Brighter regions were trained in more sessions.";
      }
      return;
    }

    if (this.mode === "synergy") {
      if (!this.selectedMuscle) {
        if (statusTitle) statusTitle.textContent = "SELECT A MUSCLE";
        if (statusText) statusText.textContent = "Explore muscles trained in the same sessions.";
        return;
      }

      if (!this.selectedMuscle.exerciseMuscle) {
        if (statusTitle) statusTitle.textContent = "NO EXERCISE CATEGORY";
        if (statusText) statusText.textContent = "This region is not yet classified in the exercise library.";
        return;
      }

      const synergy = this.renderSynergy();
      if (!Object.keys(synergy).length) {
        if (statusTitle) statusTitle.textContent = "NO CO-TRAINING DATA";
        if (statusText) statusText.textContent = "Log sessions with this muscle to reveal training patterns.";
      } else {
        const hasVisibleRelatedRegion = Object.values(this.masks).some(
          (muscle) =>
            muscle.exerciseMuscle &&
            muscle.exerciseMuscle !== this.selectedMuscle.exerciseMuscle &&
            synergy[muscle.exerciseMuscle]
        );

        if (statusTitle) {
          statusTitle.textContent = hasVisibleRelatedRegion
            ? "TRAINED TOGETHER"
            : "RELATED MUSCLES ON OTHER VIEW";
        }
        if (statusText) {
          statusText.textContent = hasVisibleRelatedRegion
            ? "These regions often appear in the same workout sessions."
            : "Switch FRONT/BACK to see related regions.";
        }
      }
      return;
    }

    this.renderSelection();
    if (statusTitle) statusTitle.textContent = "SELECT A MUSCLE";
    if (statusText) statusText.textContent = "Explore exercises, anatomy and training data.";
  }
}

function getMuscleActivity() {
  const relevantCategories = new Set(
    Object.values(MUSCLE_EXERCISE_CATEGORIES).filter(Boolean)
  );
  const counts = {};

  for (const session of workoutSessions) {
    const trainedCategories = new Set();

    for (const sessionExercise of session.exercises || []) {
      const exercise = exercises.find(
        (entry) => String(entry.id) === String(sessionExercise.exerciseId)
      );
      if (exercise && relevantCategories.has(exercise.muscle)) {
        trainedCategories.add(exercise.muscle);
      }
    }

    for (const category of trainedCategories) {
      counts[category] = (counts[category] || 0) + 1;
    }
  }

  const maxCount = Math.max(...Object.values(counts), 0);
  return Object.fromEntries(
    Object.entries(counts).map(([category, sessions]) => [
      category,
      { sessions, intensity: maxCount ? sessions / maxCount : 0 },
    ])
  );
}

function getMuscleSynergy(selectedMuscleId) {
  const selectedCategory = getExerciseCategoryForMuscle(selectedMuscleId);
  if (!selectedCategory) return {};

  const counts = {};
  for (const session of workoutSessions) {
    const categories = new Set();

    for (const sessionExercise of session.exercises || []) {
      const exercise = exercises.find(
        (entry) => String(entry.id) === String(sessionExercise.exerciseId)
      );
      if (exercise && EXERCISE_MUSCLE_CATEGORIES.has(exercise.muscle)) {
        categories.add(exercise.muscle);
      }
    }

    if (!categories.has(selectedCategory)) continue;
    for (const category of categories) {
      if (category !== selectedCategory) {
        counts[category] = (counts[category] || 0) + 1;
      }
    }
  }

  return Object.fromEntries(
    Object.entries(counts).map(([category, sessions]) => [category, { sessions }])
  );
}

let activeMuscleMap = null;
window.addEventListener("resize", () => {
  if (activeMuscleMap?.model.isConnected) {
    activeMuscleMap.resize();
  } else {
    activeMuscleMap = null;
  }
});

document.addEventListener("pointerdown", (event) => {

  const panel = document.querySelector(
    ".muscle-selection-panel"
  );

  if (!panel) return;

  if (
    panel.classList.contains("is-visible") &&
    !panel.contains(event.target) &&
    !event.target.closest(".muscle-map-canvas")
  ) {

    panel.classList.remove("is-visible");

    const canvas =
      document.querySelector(".muscle-map-canvas");

    if (canvas) {

      const model =
        canvas.closest(".muscle-map-model");

      if (model?.muscleMapInstance) {
        model.muscleMapInstance.clearSelection();
      }
    }
  }

});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  const panel = document.querySelector(".muscle-selection-panel.is-visible");
  if (!panel) return;

  const model = document
    .querySelector(".muscle-map-canvas")
    ?.closest(".muscle-map-model");

  model?.muscleMapInstance?.clearSelection();
});

function showMusclePanel(muscle) {
  let panel = document.querySelector(".muscle-selection-panel");

  if (!panel) {
    panel = document.createElement("aside");
    panel.className = "muscle-selection-panel";

    document.body.appendChild(panel);
  }

  panel.innerHTML = `
    <button
      class="muscle-selection-card"
      type="button"
      data-muscle="${muscle.id}"
      aria-label="View ${muscle.name} exercises"
    >
      <div class="muscle-selection-copy">
        <span class="muscle-selection-kicker">
          SELECTED
        </span>

        <strong class="muscle-selection-name">
          ${muscle.name}
        </strong>

        <span class="muscle-selection-meta">
          ${muscle.exerciseMuscle || "ALL EXERCISES"}
        </span>
      </div>

      <span class="muscle-selection-arrow" aria-hidden="true">
        →
      </span>
    </button>
  `;

  panel.classList.add("is-visible");

  const card = panel.querySelector(
    ".muscle-selection-card"
  );

  card.addEventListener("click", () => {

    sessionStorage.setItem(
      "redlineSelectedMuscle",
      muscle.exerciseMuscle || "All"
    );

    panel.classList.remove("is-visible");

    const workoutNav =
      document.querySelector(
        '[data-page="workouts"]'
      );

    if (workoutNav) {
      workoutNav.click();
    }
  });
}

// =========================================================
// MUSCLE MAP
// =========================================================

function renderMuscleMap() {

  const app = document.querySelector("#app");

  app.innerHTML = `

    <div class="app-shell muscle-map-shell">

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
          ${clerk.user?.imageUrl
      ? `<img
                src="${clerk.user.imageUrl}"
                alt=""
              >`
      : "●"
    }
        </button>

      </header>


      <main>

        <section
          class="muscle-map-screen"
          aria-labelledby="muscle-map-title"
        >

          <div class="muscle-map-heading">

            <span class="section-kicker">
              EXPLORE YOUR BODY
            </span>

            <h1 id="muscle-map-title">
              MUSCLE MAP
            </h1>

            <p>
              TAP A MUSCLE TO EXPLORE
            </p>

          </div>


          <div
  class="muscle-map-view-toggle"
  role="group"
  aria-label="Anatomy view"
>
  <button
    class="muscle-view-front active"
    type="button"
    aria-pressed="true"
  >
    FRONT
  </button>

  <button
    class="muscle-view-back"
    type="button"
    aria-pressed="false"
  >
    BACK
  </button>
</div>


          <div class="muscle-map-stage">

  <div class="muscle-map-model">

  <img
    src="/assets/muscle-map/front/base.webp"
    alt="Front-view anatomical muscle map"
    draggable="false"
  >

  <canvas
  class="muscle-map-canvas"
  aria-label="Interactive muscle map"
></canvas>


</div>

</div>


          <div class="muscle-map-controls">

            <div
              class="muscle-map-mode-toggle"
              role="tablist"
              aria-label="Muscle map mode"
            >

              <button
                class="active"
                type="button"
                role="tab"
                aria-selected="true"
              >
                ANATOMY
              </button>

              <button
                type="button"
                role="tab"
                aria-selected="false"
              >
                ACTIVITY
              </button>

              <button
                type="button"
                role="tab"
                aria-selected="false"
              >
                SYNERGY
              </button>

            </div>


            <div
              class="muscle-map-layer-toggle"
              role="group"
              aria-label="Anatomy depth"
            >

              <button
                class="active"
                type="button"
                aria-pressed="true"
              >
                SURFACE
              </button>

              <button
                type="button"
                aria-pressed="false"
                aria-label="Deep layer unavailable because no deep anatomy assets are installed"
                title="Deep anatomy assets are not available yet"
                disabled
              >
                DEEP
              </button>

            </div>

          </div>


          <div class="muscle-map-empty-state" aria-live="polite">

            <span>
              SELECT A MUSCLE
            </span>

            <p>
              Explore exercises, anatomy and training data.
            </p>

          </div>

        </section>

      </main>

    </div>


    ${renderBottomNav("map")}

  `;

  attachEvents();

  const muscleModel =
    document.querySelector(
      ".muscle-map-model"
    );

  if (muscleModel) {
    const muscleMap =
      new MuscleMaskMap(muscleModel);

    muscleModel.muscleMapInstance =
      muscleMap;
    activeMuscleMap = muscleMap;

    document
      .querySelector(".muscle-map-region-options")
      ?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-map-muscle]");
        const muscle = button && muscleMap.masks[button.dataset.mapMuscle];
        if (muscle) muscleMap.select(button.dataset.mapMuscle, muscle);
      });

    const frontButton =
      document.querySelector(".muscle-view-front");

    const backButton =
      document.querySelector(".muscle-view-back");

    const muscleStage =
      document.querySelector(".muscle-map-model");


    let switchingSide = false;

    async function switchMuscleSide(side) {

      if (!muscleMap || muscleMap.side === side || switchingSide) {
        return;
      }

      switchingSide = true;

      const button =
        side === "front"
          ? frontButton
          : backButton;

      if (!reduceMotion) {
        gsap.to(button, {
          scale: 0.96,
          duration: 0.08,
          yoyo: true,
          repeat: 1,
          ease: "power2.out"
        });

        await gsap.to(muscleStage, {
          opacity: 0.72,
          rotateY: side === "back" ? -8 : 8,
          scale: 0.985,
          duration: 0.16,
          ease: "power2.in"
        });
      }

      // Update active state
      frontButton.classList.toggle(
        "active",
        side === "front"
      );

      backButton.classList.toggle(
        "active",
        side === "back"
      );

      frontButton.setAttribute(
        "aria-pressed",
        side === "front"
          ? "true"
          : "false"
      );

      backButton.setAttribute(
        "aria-pressed",
        side === "back"
          ? "true"
          : "false"
      );

      try {
        await muscleMap.setSide(side);

        if (!reduceMotion) {
          gsap.set(muscleStage, {
            opacity: 0,
            rotateY: side === "back" ? 8 : -8,
            scale: 0.985
          });

          gsap.to(muscleStage, {
            opacity: 1,
            rotateY: 0,
            scale: 1,
            duration: 0.28,
            ease: "power2.out"
          });
        }
      } finally {
        switchingSide = false;
      }
    }

    const modeButtons = document.querySelectorAll(
      ".muscle-map-mode-toggle button"
    );

    modeButtons.forEach((button) => {

      button.addEventListener("click", () => {

        modeButtons.forEach((btn) => {

          btn.classList.remove("active");

          btn.setAttribute(
            "aria-selected",
            "false"
          );

        });

        button.classList.add("active");

        button.setAttribute(
          "aria-selected",
          "true"
        );

        const mode =
          button.textContent
            .trim()
            .toLowerCase();

        muscleMap.setMode(mode);

      });

    });


    // =========================================================
    // MUSCLE MAP LAYER
    // =========================================================

    const layerButtons =
      document.querySelectorAll(
        ".muscle-map-layer-toggle button"
      );

    layerButtons.forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          layerButtons.forEach((btn) => {
            btn.classList.remove("active");
            btn.setAttribute(
              "aria-pressed",
              "false"
            );
          });

          button.classList.add("active");

          button.setAttribute(
            "aria-pressed",
            "true"
          );

          const layer = button.textContent.trim().toLowerCase();
          muscleMap.setLayer(layer);

        }
      );

    });


    frontButton?.addEventListener("click", () => {
      switchMuscleSide("front");
    });


    backButton?.addEventListener("click", () => {
      switchMuscleSide("back");
    });
  }

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
          ${clerk.user?.imageUrl
      ? `<img
      src="${clerk.user.imageUrl}"
      alt=""
    >`
      : "●"
    }
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
        ${formatWeight(exercise.tracking.weight)}
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
    <div class="routine-session-note">

  <button
    class="routine-session-note-button"
    type="button"
  >
    <span>＋</span>
    <span>ADD SESSION NOTE</span>
  </button>

  ${sessionNoteDraft
      ? `
        <span class="routine-session-note-preview">
          ${sessionNoteDraft}
        </span>
      `
      : ""
    }

</div>
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

function openProfile() {

  if (document.querySelector(".routine-detail-page")) {
    profileReturnView = "routine-detail";
  } else if (document.querySelector(".routines-screen")) {
    profileReturnView = "routines";
  } else {
    profileReturnView = "workouts";
  }

  renderProfile();
}


function getActivityLevel(count) {

  if (count >= 3) return 4;
  if (count === 2) return 3;
  if (count === 1) return 2;

  return 0;
}


function getActivityCalendar() {

  const activity = {};

  workoutSessions.forEach((session) => {
    activity[session.date] =
      (activity[session.date] || 0) + 1;
  });


  const days = [];

  const today = new Date();

  today.setHours(0, 0, 0, 0);


  const start = new Date(today);

  start.setDate(
    today.getDate() - 363
  );


  // Start on Sunday
  while (start.getDay() !== 0) {
    start.setDate(
      start.getDate() - 1
    );
  }


  const end = new Date(today);

  // End on Saturday
  while (end.getDay() !== 6) {
    end.setDate(
      end.getDate() + 1
    );
  }


  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor.setDate(
      cursor.getDate() + 1
    )
  ) {

    const year =
      cursor.getFullYear();

    const month =
      String(
        cursor.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        cursor.getDate()
      ).padStart(2, "0");


    const date =
      `${year}-${month}-${day}`;


    days.push({

      date,

      count:
        activity[date] || 0,

      level:
        getActivityLevel(
          activity[date] || 0
        )

    });

  }


  const weekCount =
    Math.ceil(
      days.length / 7
    );


  /*
     Build unique months only.
     This prevents SEP appearing twice
     when the calendar starts and ends
     inside the same month.
  */

  const monthStarts = [];

  const seenMonths = new Set();


  days.forEach((day, index) => {

    const month =
      day.date.slice(0, 7);

    if (!seenMonths.has(month)) {

      seenMonths.add(month);

      monthStarts.push({
        month,
        index
      });

    }

  });


  const monthLabels =
    monthStarts
      .slice(-12)
      .map((entry) => {

        const [year, monthNumber] =
          entry.month.split("-");

        const label =
          new Date(
            Number(year),
            Number(monthNumber) - 1,
            1
          )
            .toLocaleString(
              "en-US",
              {
                month: "short"
              }
            )
            .toUpperCase();

        const position =
          Math.floor(
            entry.index / 7
          );

        return {
          label,
          position
        };

      });


  return {
    days,
    weekCount,
    monthLabels
  };

}

function getWeeklySessionCounts() {

  const weeks = Array(8).fill(0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  workoutSessions.forEach((session) => {

    const sessionDate =
      new Date(`${session.date}T00:00:00`);

    const diff =
      Math.floor(
        (today - sessionDate) /
        (1000 * 60 * 60 * 24)
      );

    const week =
      Math.floor(diff / 7);

    if (week >= 0 && week < 8) {
      weeks[7 - week]++;
    }

  });

  return weeks;
}

function getTrainingMetrics() {

  const activeDays =
    new Set(
      workoutSessions.map(
        (session) => session.date
      )
    ).size;

  const totalExercises =
    workoutSessions.reduce(
      (total, session) =>
        total + session.exercises.length,
      0
    );

  let streak = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sessionDates =
    new Set(
      workoutSessions.map(
        (session) => session.date
      )
    );

  const cursor = new Date(today);

  while (true) {

    const year =
      cursor.getFullYear();

    const month =
      String(
        cursor.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        cursor.getDate()
      ).padStart(2, "0");

    const date =
      `${year}-${month}-${day}`;

    if (!sessionDates.has(date)) {
      break;
    }

    streak++;

    cursor.setDate(
      cursor.getDate() - 1
    );
  }

  return {
    activeDays,
    totalExercises,
    streak
  };
}

function getWeeklyVolume() {

  const weeks = Array(8).fill(0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  workoutSessions.forEach((session) => {

    const sessionDate =
      new Date(`${session.date}T00:00:00`);

    const diff =
      Math.floor(
        (today - sessionDate) /
        (1000 * 60 * 60 * 24)
      );

    const week =
      Math.floor(diff / 7);

    if (week >= 0 && week < 8) {

      const volume =
        session.exercises.reduce(
          (total, exercise) =>
            total +
            (
              Number(exercise.weight) *
              Number(exercise.reps) *
              Number(exercise.sets)
            ),
          0
        );

      const displayVolume =
        weightUnit === "LB"
          ? volume * KG_TO_LB
          : volume;

      weeks[7 - week] += displayVolume;
    }
  });

  return weeks;
}

function renderProfile() {

  const app =
    document.querySelector("#app");

  const completedSessions =
    workoutSessions.length;

  const totalExercises =
    workoutSessions.reduce(
      (total, session) =>
        total + session.exercises.length,
      0
    );

  const calendar =
    getActivityCalendar();

  const metrics =
    getTrainingMetrics();

  const weeklyVolume =
    getWeeklyVolume();

  const maxWeeklyVolume =
    Math.max(...weeklyVolume, 1);

  app.innerHTML = `

    <div class="app-shell">

      <header class="app-header">

        <button
          class="profile-back-button"
          type="button"
          aria-label="Back"
        >
          ←
        </button>

        <span class="profile-header-label">
  PROFILE
</span>

      </header>


      <main>

        <section class="profile-screen">

          <span class="section-kicker">
            REDLINE SYSTEM
          </span>


          <h1 class="profile-title">
            YOUR
            <span>TRAINING.</span>
          </h1>


          <div class="profile-stats">

            <article class="profile-stat">
              <strong>
                ${completedSessions}
              </strong>

              <span>
  ${completedSessions === 1
      ? "SESSION"
      : "SESSIONS"}
</span>
            </article>


            <article class="profile-stat">
              <strong>
                ${totalExercises}
              </strong>

              <span>
                EXERCISES
              </span>
            </article>

          </div>


          <section class="profile-section">

            <div class="profile-section-heading">
              TRAINING ACTIVITY
            </div>


<div class="profile-activity">

  <div class="profile-activity-header">

    <span>
      LAST 12 MONTHS
    </span>

    <span>
      ${completedSessions}
${completedSessions === 1
      ? "SESSION"
      : "SESSIONS"}
    </span>

  </div>


  <div class="profile-calendar-scroll">

    <div class="profile-calendar-layout">

      <div class="profile-calendar-weekday-rail">

        <span></span>
        <span>S</span>
        <span>M</span>
        <span>T</span>
        <span>W</span>
        <span>T</span>
        <span>F</span>
        <span>S</span>

      </div>


      <div class="profile-calendar-area">

        <div
          class="profile-calendar-months"
          style="--calendar-columns: ${calendar.weekCount};"
        >

          ${calendar.monthLabels
      .map(
        (month) => `
                <span
                  style="--month-position: ${month.position};"
                >
                  ${month.label}
                </span>
              `
      )
      .join("")
    }

        </div>


        <div
          class="profile-calendar"
          style="--calendar-columns: ${calendar.weekCount};"
        >

          ${calendar.days
      .map(
        (day) => `
                <button
                  class="profile-calendar-day level-${day.level}"
                  type="button"
                  data-date="${day.date}"
                  aria-label="${day.date}"
                ></button>
              `
      )
      .join("")
    }

        </div>

      </div>

    </div>

  </div>


  <div class="profile-calendar-legend">

    <span>LESS</span>

    <i class="level-0"></i>
    <i class="level-1"></i>
    <i class="level-2"></i>
    <i class="level-3"></i>
    <i class="level-4"></i>

    <span>MORE</span>

  </div>

</div>

          </section>


          <section class="profile-section">

  <div class="profile-section-heading">
    PERFORMANCE
  </div>


  <div class="profile-performance">

    <div class="profile-performance-header">

      <div>
        <span class="profile-performance-kicker">
          TRAINING FREQUENCY
        </span>

        <h2>
          LAST 8 WEEKS
        </h2>
      </div>

      <span class="profile-performance-total">
  ${completedSessions}
  ${completedSessions === 1
      ? "SESSION"
      : "SESSIONS"}
</span>

    </div>


    <div class="profile-frequency-chart">

      <div class="profile-frequency-y-axis">

        <span>3</span>
        <span>2</span>
        <span>1</span>
        <span>0</span>

      </div>


      <div class="profile-frequency-main">

        <div class="profile-frequency-bars">

          ${getWeeklySessionCounts()
      .map(
        (count, index) => `
                  <div
                    class="profile-frequency-column"
                    data-value="${count}"
                  >

                    <div class="profile-frequency-bar">
                      <span></span>
                    </div>

                    <small>
                      W${index + 1}
                    </small>

                  </div>
                `
      )
      .join("")
    }

        </div>

      </div>

    </div>

  </div>

</section>

        <section class="profile-section">

  <div class="profile-section-heading">
    TRAINING METRICS
  </div>

  <div class="profile-metrics-grid">

    <article class="profile-metric-card">

      <span>ACTIVE DAYS</span>

      <strong>
        ${metrics.activeDays}
      </strong>

      <small>
        TRAINING DAYS
      </small>

    </article>


    <article class="profile-metric-card">

      <span>EXERCISES</span>

      <strong>
        ${metrics.totalExercises}
      </strong>

      <small>
        LOGGED
      </small>

    </article>


    <article class="profile-metric-card">

      <span>CURRENT STREAK</span>

      <strong>
        ${metrics.streak}
      </strong>

      <small>
        DAYS
      </small>

    </article>

  </div>

</section>

<section class="profile-section">

  <div class="profile-section-heading">
    GRAPH SHEETS
  </div>

  <div class="profile-graph-sheet">

    <div class="profile-graph-header">

      <div>
        <span class="profile-graph-kicker">
          TRAINING LOAD
        </span>

        <h2>
          WEEKLY VOLUME
        </h2>
      </div>

      <span class="profile-graph-range">
        8 WEEKS
      </span>

    </div>

    <div class="profile-volume-chart">

      <div class="profile-volume-grid">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div class="profile-volume-bars">

        ${weeklyVolume
      .map(
        (volume, index) => `
              <div
                class="profile-volume-column"
                data-value="${volume}"
                style="
                  --volume-height:
                    ${(volume / maxWeeklyVolume) * 100}%;
                "
              >
                <div class="profile-volume-bar">
                  <span></span>
                </div>

                <small>
                  W${index + 1}
                </small>
              </div>
            `
      )
      .join("")}

      </div>

    </div>

  </div>

</section>

<section class="profile-section">

  <div class="profile-section-heading">
    ACCOUNT
  </div>

  <div class="profile-account-card">

    <div class="profile-account-info">

      <div class="profile-account-avatar">
        ${clerk.user?.imageUrl
      ? `<img
                src="${clerk.user.imageUrl}"
                alt=""
              >`
      : "●"
    }
      </div>

      <div class="profile-account-details">

        <strong>
          ${clerk.user?.fullName || "REDLINE USER"}
        </strong>

        <span>
          ${clerk.user?.primaryEmailAddress
      ?.emailAddress || "NO EMAIL"
    }
        </span>

      </div>

    </div>

    <button
      class="profile-signout-button"
      type="button"
    >
      <span>SIGN OUT</span>
      <span>→</span>
    </button>

  </div>

</section>

<section class="profile-section">

  <div class="profile-section-heading">
    APP SETTINGS
  </div>

  <button
    class="profile-setting-row"
    data-setting-toggle="reduce-motion"
    type="button"
    aria-pressed="${reduceMotion}"
  >

    <div class="profile-setting-info">

      <strong>
        REDUCE MOTION
      </strong>

      <span>
        ${reduceMotion
      ? "ENTRANCE & TRANSITION MOTION REDUCED"
      : "ENTRANCE & TRANSITION MOTION ENABLED"}
      </span>

    </div>

    <div
      class="profile-setting-toggle ${reduceMotion ? "active" : ""}"
      aria-hidden="true"
    >
      <span></span>
    </div>

  </button>

  <div class="profile-setting-row profile-setting-selector">

    <div class="profile-setting-info">

      <strong>
        WEIGHT UNIT
      </strong>

      <span>
        DISPLAY TRAINING WEIGHTS IN
        ${weightUnit}
      </span>

    </div>

    <div class="profile-unit-selector">

      <button
        class="${weightUnit === "KG" ? "active" : ""}"
        data-weight-unit="KG"
        type="button"
      >
        KG
      </button>

      <button
        class="${weightUnit === "LB" ? "active" : ""}"
        data-weight-unit="LB"
        type="button"
      >
        LB
      </button>

    </div>

  </div>

</section>

<section class="profile-section">

  <div class="profile-section-heading">
    DATA
  </div>

  <button
    class="profile-setting-row profile-danger-setting"
    data-setting-action="delete-history"
    type="button"
  >

    <div class="profile-setting-info">

      <strong>
        DELETE HISTORY
      </strong>

      <span>
        PERMANENTLY REMOVE ALL RECORDED WORKOUT HISTORY
      </span>

    </div>

    <span class="profile-setting-action">
      →
    </span>

  </button>

</section>

      </main>


      ${renderBottomNav("profile")}

    </div>

  `;


  const activityPanel =
    document.querySelector(
      ".profile-activity"
    );


  document
    .querySelectorAll(
      ".profile-calendar-day"
    )
    .forEach((day) => {

      day.addEventListener(
        "click",
        () => {

          const existingTooltip =
            activityPanel.querySelector(
              ".profile-day-tooltip"
            );

          existingTooltip?.remove();


          const date =
            day.dataset.date;


          const sessions =
            workoutSessions.filter(
              (session) =>
                session.date === date
            );


          const formattedDate =
            new Date(
              `${date}T00:00:00`
            ).toLocaleDateString(
              "en-US",
              {
                month: "short",
                day: "numeric",
                year: "numeric"
              }
            );


          const tooltip =
            document.createElement(
              "div"
            );

          tooltip.className =
            "profile-day-tooltip";


          tooltip.innerHTML = `

          <div class="profile-day-tooltip-date">
            ${formattedDate}
          </div>

          ${sessions.length
              ? `
                <div class="profile-day-tooltip-count">
                  ${sessions.length}
                  ${sessions.length === 1
                ? "SESSION"
                : "SESSIONS"}
                </div>

                <div class="profile-day-tooltip-sessions">

                  ${sessions
                .map((session) => {

                  const routine =
                    routines.find(
                      (item) =>
                        item.id ===
                        session.routineId
                    );

                  return `
                        <div class="profile-day-tooltip-session">

                          <strong>
                            ${routine?.name || "TRAINING"}
                          </strong>

                          <span>
                            ${session.exercises.length}
                            EXERCISES
                          </span>

                        </div>
                      `;

                })
                .join("")
              }

                </div>
              `
              : `
                <div class="profile-day-tooltip-empty">
                  NO TRAINING
                </div>
              `
            }

        `;


          activityPanel.appendChild(
            tooltip
          );


          const dayRect =
            day.getBoundingClientRect();

          const panelRect =
            activityPanel.getBoundingClientRect();


          const tooltipWidth = 190;


          const left =
            Math.max(
              10,
              Math.min(
                dayRect.left -
                panelRect.left +
                dayRect.width / 2 -
                tooltipWidth / 2,

                panelRect.width -
                tooltipWidth -
                10
              )
            );


          tooltip.style.left =
            `${left}px`;

          tooltip.style.top =
            `${dayRect.bottom -
            panelRect.top +
            10
            }px`;


          gsap.fromTo(

            tooltip,

            {
              opacity: 0,
              y: -5,
              scale: 0.96
            },

            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.2,
              ease: "power2.out"
            }

          );

        }
      );

    });

  document.addEventListener(
    "click",
    (event) => {

      const tooltip =
        document.querySelector(
          ".profile-day-tooltip"
        );

      if (!tooltip) {
        return;
      }

      if (
        tooltip.contains(event.target)
      ) {
        return;
      }

      if (
        event.target.closest(
          ".profile-calendar-day"
        )
      ) {
        return;
      }

      tooltip.remove();

    }
  );


  animateProfileGraphs();

  document
    .querySelectorAll(".profile-volume-column")
    .forEach((column) => {

      column.addEventListener(
        "click",
        () => {

          const existingTooltip =
            document.querySelector(
              ".profile-volume-tooltip"
            );

          existingTooltip?.remove();

          const volume =
            Number(column.dataset.value);

          const week =
            column.querySelector("small")
              ?.textContent || "";

          const tooltip =
            document.createElement("div");

          tooltip.className =
            "profile-volume-tooltip";

          tooltip.innerHTML = `
            <span>${week}</span>
            <strong>
              ${Number(volume.toFixed(1)).toLocaleString()}
            </strong>
            <small>
              ${weightUnit} VOLUME
            </small>
          `;

          column.appendChild(tooltip);

          gsap.fromTo(
            tooltip,
            {
              opacity: 0,
              y: 6,
              scale: 0.94
            },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.2,
              ease: "power2.out"
            }
          );

        }
      );

    });

  attachEvents();

}


function openSessionNoteEditor() {

  if (
    document.querySelector(
      ".session-note-editor-overlay"
    )
  ) {
    return;
  }

  const overlay =
    document.createElement("div");

  overlay.className =
    "session-note-editor-overlay";

  overlay.innerHTML = `

    <div class="session-note-editor-backdrop"></div>

    <section
      class="session-note-editor"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-note-editor-title"
    >

      <div class="session-note-editor-header">

        <div>

          <span class="session-note-editor-eyebrow">
            SESSION NOTE
          </span>

          <h2 id="session-note-editor-title">
            TODAY'S TRAINING
          </h2>

        </div>

        <button
          class="session-note-editor-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <div class="session-note-editor-content">

        <label
          class="session-note-editor-label"
          for="session-note-input"
        >
          NOTE
        </label>

        <textarea
          id="session-note-input"
          maxlength="500"
          placeholder="How did the session feel?"
        ></textarea>


        <div class="session-note-editor-actions">

          <button
            class="session-note-editor-cancel"
            type="button"
          >
            CANCEL
          </button>

          <button
            class="session-note-editor-save"
            type="button"
          >
            SAVE NOTE
          </button>

        </div>

      </div>

    </section>

  `;

  document.body.appendChild(overlay);


  const backdrop =
    overlay.querySelector(
      ".session-note-editor-backdrop"
    );

  const modal =
    overlay.querySelector(
      ".session-note-editor"
    );

  const input =
    overlay.querySelector(
      "#session-note-input"
    );

  const closeButton =
    overlay.querySelector(
      ".session-note-editor-close"
    );

  const cancelButton =
    overlay.querySelector(
      ".session-note-editor-cancel"
    );

  const saveButton =
    overlay.querySelector(
      ".session-note-editor-save"
    );


  input.value = sessionNoteDraft || "";


  function closeEditor(
    onComplete
  ) {

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
          y: 14,
          scale: 0.98,
          duration: 0.2,
          ease: "power2.in"
        }
      )

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

      sessionNoteDraft =
        input.value.trim();

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

      input.focus();

      input.setSelectionRange(
        input.value.length,
        input.value.length
      );

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
        ease: "back.out(1.2)"
      },
      "-=0.08"
    );

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

      syncRoutineToSupabase(activeRoutine);


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

  syncRoutineToSupabase(activeRoutine);

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
    workoutSessions
      .filter(
        (session) =>
          session.routineId === activeRoutine?.id
      )
      .flatMap(
        (session) =>
          session.exercises
            .filter(
              (entry) =>
                entry.exerciseId ===
                routineExercise.exerciseId
            )
            .map(
              (entry) => ({
                ...entry,
                date: session.date,
                sessionNote: session.note,
                completedAt:
                  session.completedAt
              })
            )
      );

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
      ${session.weight > 0
              ? formatWeight(session.weight)
              : "BODYWEIGHT"
            }
    </span>

  </div>

  <span>
    ${session.sets} SETS
    •
    ${session.reps} REPS
  </span>

  ${session.notes
              ? `
    <small class="routine-history-note">
      NOTE — ${session.notes}
    </small>
  `
              : ""
            }

${session.sessionNote
              ? `
    <small class="routine-history-note">
      SESSION NOTE — ${session.sessionNote}
    </small>
  `
              : ""
            }

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
  WEIGHT / ${weightUnit}
</label>

        <input
          id="tracker-weight-input"
          class="tracker-editor-input"
          type="number"
          min="0"
          step="0.5"
          inputmode="decimal"
          value="${routineExercise.weight > 0
      ? weightUnit === "LB"
        ? Number(
          (routineExercise.weight * KG_TO_LB)
            .toFixed(1)
        )
        : routineExercise.weight
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
        weightToKg(value);

      syncRoutineToSupabase(activeRoutine);

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

      syncRoutineToSupabase(activeRoutine);

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

function animateProfileGraphs() {

  const bars =
    document.querySelectorAll(
      ".profile-volume-bar span"
    );

  if (!bars.length) {
    return;
  }

  gsap.fromTo(
    bars,
    {
      scaleY: 0,
      opacity: 0
    },
    {
      scaleY: 1,
      opacity: 1,
      duration: 0.6,
      stagger: 0.08,
      ease: "power3.out",
      transformOrigin: "bottom"
    }
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

            syncRoutineToSupabase(routine);

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

          syncRoutineToSupabase(routine);


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
    async (event) => {

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


      const { data: createdRoutine, error } =
        await supabase
          .from("routines")
          .insert({
            user_id: clerk.user.id,
            name
          })
          .select()
          .single();


      if (error) {

        console.error(
          "Failed to create routine:",
          error
        );

        return;
      }

      const newRoutine = {

        id: createdRoutine.id,

        name: createdRoutine.name,

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

      saveRoutinesToCache();


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

function openDeleteHistoryModal() {

  if (
    document.querySelector(
      ".delete-history-overlay"
    )
  ) {
    return;
  }

  const overlay =
    document.createElement("div");

  overlay.className =
    "delete-history-overlay";

  overlay.innerHTML = `

    <div class="delete-history-backdrop"></div>

    <section
      class="delete-history-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-history-title"
    >

      <span class="delete-history-eyebrow">
        PERMANENT ACTION
      </span>

      <h2 id="delete-history-title">
        Delete your training history?
      </h2>

      <p>
        This will permanently remove all
        recorded workout sessions and
        training history from your account.
        Your routines will not be affected.
      </p>

      <div class="delete-history-actions">

        <button
          class="delete-history-cancel"
          type="button"
        >
          CANCEL
        </button>

        <button
          class="delete-history-confirm"
          type="button"
        >
          DELETE HISTORY
        </button>

      </div>

    </section>

  `;

  document.body.appendChild(overlay);

  const backdrop =
    overlay.querySelector(
      ".delete-history-backdrop"
    );

  const modal =
    overlay.querySelector(
      ".delete-history-modal"
    );

  const cancelButton =
    overlay.querySelector(
      ".delete-history-cancel"
    );

  const confirmButton =
    overlay.querySelector(
      ".delete-history-confirm"
    );

  function closeModal() {

    gsap.timeline({
      onComplete: () => {
        overlay.remove();
      }
    })

      .to(
        modal,
        {
          opacity: 0,
          y: 18,
          scale: 0.97,
          duration: 0.2,
          ease: "power2.in"
        }
      )

      .to(
        backdrop,
        {
          opacity: 0,
          duration: 0.15
        },
        "-=0.1"
      );

  }

  async function deleteHistory() {

    confirmButton.disabled = true;
    confirmButton.textContent = "DELETING...";

    const {
      error
    } = await supabase
      .from("workout_sessions")
      .delete()
      .eq(
        "user_id",
        clerk.user.id
      );

    if (error) {

      console.error(
        "Failed to delete workout history:",
        error
      );

      confirmButton.disabled = false;
      confirmButton.textContent =
        "DELETE HISTORY";

      return;

    }

    workoutSessions = [];

    saveWorkoutSessionsToCache();

    closeModal();

    setTimeout(() => {
      renderProfile();
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
    deleteHistory
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
      y: 20,
      scale: 0.97
    }
  );

  gsap.timeline()

    .to(
      backdrop,
      {
        opacity: 1,
        duration: 0.18,
        ease: "power2.out"
      }
    )

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

  routineCompleteCheckbox?.addEventListener(
    "change",
    async (event) => {

      const today = getLocalDate();

      // =========================
      // COMPLETE ROUTINE
      // =========================

      if (event.target.checked) {

        const alreadyCompleted =
          workoutSessions.some(
            (session) =>
              session.routineId === activeRoutine.id &&
              session.date === today
          );

        if (alreadyCompleted) {
          return;
        }

        // Create workout session
        const { data: createdSession, error: sessionError } =
          await supabase
            .from("workout_sessions")
            .insert({
              user_id: clerk.user.id,
              routine_id: activeRoutine.id,
              date: today,
              note: sessionNoteDraft
            })
            .select()
            .single();

        if (sessionError) {
          console.error(
            "Failed to save workout session:",
            sessionError
          );

          event.target.checked = false;
          return;
        }

        // Create session exercises
        const sessionExercises =
          activeRoutine.exercises.map(
            (routineExercise) => ({
              session_id: createdSession.id,
              exercise_id: routineExercise.exerciseId,
              weight: routineExercise.weight,
              reps: routineExercise.reps,
              sets: routineExercise.sets,
              notes: routineExercise.notes || ""
            })
          );

        if (sessionExercises.length) {

          const { error: exerciseError } =
            await supabase
              .from("workout_session_exercises")
              .insert(sessionExercises);

          if (exerciseError) {

            console.error(
              "Failed to save session exercises:",
              exerciseError
            );

            // Roll back the session if its exercises failed
            await supabase
              .from("workout_sessions")
              .delete()
              .eq("id", createdSession.id);

            event.target.checked = false;
            return;
          }
        }

        // Add the successfully saved session to local state
        workoutSessions.push({
          id: createdSession.id,
          routineId: activeRoutine.id,
          date: today,
          completedAt: createdSession.completed_at,
          note: sessionNoteDraft,
          exercises: activeRoutine.exercises.map(
            (routineExercise) => ({
              exerciseId: routineExercise.exerciseId,
              weight: routineExercise.weight,
              reps: routineExercise.reps,
              sets: routineExercise.sets,
              notes: routineExercise.notes || ""
            })
          )
        });

        saveWorkoutSessionsToCache();

        animateRoutineCompletion();

      }

      // =========================
      // UNCOMPLETE ROUTINE
      // =========================

      else {

        const { error } = await supabase
          .from("workout_sessions")
          .delete()
          .eq("user_id", clerk.user.id)
          .eq("routine_id", activeRoutine.id)
          .eq("date", today);

        if (error) {
          console.error(
            "Failed to remove workout session:",
            error
          );

          // Put checkbox back if deletion failed
          event.target.checked = true;
          return;
        }

        workoutSessions =
          workoutSessions.filter(
            (session) =>
              !(
                session.routineId === activeRoutine.id &&
                session.date === today
              )
          );

        saveWorkoutSessionsToCache();
      }
    }
  );

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
      openProfile();
    }
  );

  const profileBackButton =
    document.querySelector(
      ".profile-back-button"
    );

  profileBackButton?.addEventListener(
    "click",
    () => {

      if (profileReturnView === "routine-detail") {
        renderRoutineDetail();
        return;
      }

      if (profileReturnView === "routines") {
        renderRoutines();
        return;
      }

      render();
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

      syncRoutineToSupabase(routine);

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

          if (page !== "map") {

            activeMuscleMap = null;

            document
              .querySelector(".muscle-selection-panel")
              ?.remove();

          }

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

          if (page === "map") {
            renderMuscleMap();
            return;
          }

          if (page === "profile") {
            openProfile();
            return;
          }

        }
      );

    });

  const reduceMotionSetting =
    document.querySelector(
      '[data-setting-toggle="reduce-motion"]'
    );

  reduceMotionSetting?.addEventListener(
    "click",
    async () => {

      reduceMotion = !reduceMotion;

      localStorage.setItem(
        "redline-reduce-motion",
        reduceMotion
      );

      await syncUserSettingsToSupabase();

      applyMotionPreference();

      renderProfile();

    }
  );

  document
    .querySelectorAll("[data-weight-unit]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        async () => {

          const newUnit =
            button.dataset.weightUnit;

          if (newUnit === weightUnit) {
            return;
          }

          weightUnit = newUnit;

          localStorage.setItem(
            "redline-weight-unit",
            weightUnit
          );

          syncUserSettingsToSupabase();

          // Update active button
          document
            .querySelectorAll("[data-weight-unit]")
            .forEach((unitButton) => {
              unitButton.classList.toggle(
                "active",
                unitButton.dataset.weightUnit === weightUnit
              );
            });

          // Update description text
          const unitDescription =
            document.querySelector(
              ".profile-setting-selector .profile-setting-info span"
            );

          if (unitDescription) {
            unitDescription.textContent =
              `DISPLAY TRAINING WEIGHTS IN ${weightUnit}`;
          }

          // Animate the clicked button
          gsap.fromTo(
            button,
            {
              scale: 0.90
            },
            {
              scale: 1,
              duration: 1,
              ease: "back.out(2)"
            }
          );

        }
      );

    });

  const deleteHistorySetting =
    document.querySelector(
      '[data-setting-action="delete-history"]'
    );

  deleteHistorySetting?.addEventListener(
    "click",
    () => {
      openDeleteHistoryModal();
    }
  );

  const profileSignoutButton =
    document.querySelector(
      ".profile-signout-button"
    );

  profileSignoutButton?.addEventListener(
    "click",
    async () => {

      await clerk.signOut();

    }
  );

  const sessionNoteButton =
    document.querySelector(
      ".routine-session-note-button"
    );

  sessionNoteButton?.addEventListener(
    "click",
    () => {
      openSessionNoteEditor();
    }
  );

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


let lastSignedInState = clerk.isSignedIn;

clerk.addListener(() => {

  const currentSignedInState =
    clerk.isSignedIn;

  if (
    currentSignedInState !==
    lastSignedInState
  ) {
    lastSignedInState =
      currentSignedInState;

    initializeApp();
  }
});

applyMotionPreference();

await initializeApp();

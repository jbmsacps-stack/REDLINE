import "../css/variables.css";
import "../css/reset.css";
import "../css/style.css";
import { Clerk } from "@clerk/clerk-js";
import { createClerkSupabaseClient } from "./supabase.js";

const app = document.querySelector("#app");

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


let authMode = "sign-in";


const clerkAppearance = {
  theme: "simple",

  variables: {
    colorPrimary: "#e11d2e",
    colorBackground: "#111111",
    colorForeground: "#f5f5f5",
    colorInputBackground: "#0d0d0d",
    colorInputText: "#f5f5f5",
    colorTextSecondary: "#858585",
    colorBorder: "rgba(255,255,255,0.08)",
    borderRadius: "12px",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
  },

  options: {
    elevation: "flush",
    logoPlacement: "none",
    socialButtonsPlacement: "top",
    socialButtonsVariant: "blockButton",
    animations: true
  },

  elements: {
    formButtonPrimary:
      "redline-clerk-primary",

    formFieldInput:
      "redline-clerk-input",

    socialButtonsBlockButton:
      "redline-clerk-social",

    footerActionLink:
      "redline-clerk-link",

    headerTitle:
      "redline-clerk-header-title",

    headerSubtitle:
      "redline-clerk-header-subtitle"
  }
};


const clerk =
  new Clerk(publishableKey);


await clerk.load({
  ui: {
    ClerkUI:
      window.__internal_ClerkUICtor
  },

  appearance:
    clerkAppearance
});


const supabase =
  createClerkSupabaseClient(clerk);


function renderAuthPage(mode = "sign-in") {

  authMode = mode;

  app.innerHTML = `

    <main class="auth-page">

      <section class="auth-brand">

        <div class="auth-brand-top">

          <div class="auth-logo">
            RED<span>LINE</span>
          </div>

          <span class="auth-system-label">
            AUTHENTICATION SYSTEM
          </span>

        </div>


        <div class="auth-brand-copy">

          <p class="auth-kicker">
  THE TRAINING SYSTEM
</p>

<h1 class="auth-brand-title">
  TRAIN
  <span>WITH INTENT.</span>
</h1>

<p class="auth-brand-description">
  Plan your workouts, record every set, and understand your progress over time.
</p>

        </div>


        <div class="auth-brand-footer">

          <span>REDLINE / PERSONAL TRAINING</span>

<span class="auth-status">
  <i></i>
  SECURE
</span>

        </div>

      </section>


      <section class="auth-panel">

        <div class="auth-panel-inner">

          <div class="auth-mobile-brand">

            <div class="auth-logo">
              RED<span>LINE</span>
            </div>

            <span>
              AUTHENTICATION SYSTEM
            </span>

          </div>


          <div class="auth-heading">

            <span class="auth-kicker">
  ${mode === "sign-in"
      ? "WELCOME BACK"
      : "CREATE YOUR ACCOUNT"}
</span>

<h2>
  ${mode === "sign-in"
      ? "SIGN IN"
      : "GET STARTED"}
</h2>

<p>
  ${mode === "sign-in"
      ? "Sign in to continue to REDLINE."
      : "Create your account to start tracking your training."}
</p>

          </div>


          <div class="auth-tabs">

            <button
              type="button"
              class="${mode === "sign-in" ? "active" : ""}"
              data-auth-mode="sign-in"
            >
              SIGN IN
            </button>

            <button
              type="button"
              class="${mode === "sign-up" ? "active" : ""}"
              data-auth-mode="sign-up"
            >
              SIGN UP
            </button>

          </div>


          <div class="auth-clerk-card">

            <div
              id="clerk-auth"
              class="clerk-auth-container"
            ></div>

          </div>


          <p class="auth-security-note">
            Your account data is protected by Clerk.
          </p>

        </div>

      </section>

    </main>

  `;


  document
    .querySelectorAll("[data-auth-mode]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          const nextMode =
            button.dataset.authMode;

          if (nextMode === authMode) {
            return;
          }

          renderAuthPage(nextMode);

        }
      );

    });


  const clerkContainer =
    document.querySelector("#clerk-auth");


  if (authMode === "sign-up") {

    clerk.mountSignUp(
      clerkContainer,
      {
        appearance: clerkAppearance
      }
    );

  } else {

    clerk.mountSignIn(
      clerkContainer,
      {
        appearance: clerkAppearance
      }
    );

  }

}


async function initializeApp() {

  if (!clerk.isSignedIn) {

    renderAuthPage("sign-in");

    return;
  }

  loadRoutinesFromCache();
  loadWorkoutSessionsFromCache();

  render();

  Promise.allSettled([
    loadExercisesFromSupabase(),
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

let isAdminUser = false;
let adminAccessLoaded = false;

let adminExercises = [];
let adminEditingExerciseId = null;

let exercises = [];

let reduceMotion =
  localStorage.getItem("redline-reduce-motion") === "true";

let weightUnit =
  localStorage.getItem("redline-weight-unit") || "KG";

// =========================================================
// ADMIN ACCESS
// =========================================================

async function ensureAdminAccess() {

  if (!clerk.user?.id) {
    return false;
  }

  if (adminAccessLoaded) {
    return isAdminUser;
  }

  const {
    data,
    error
  } = await supabase
    .from("admin_users")
    .select("clerk_user_id")
    .eq(
      "clerk_user_id",
      clerk.user.id
    )
    .maybeSingle();

  if (error) {

    console.error(
      "Failed to verify admin access:",
      error
    );

    isAdminUser = false;

  } else {

    isAdminUser = Boolean(data);

  }

  adminAccessLoaded = true;

  return isAdminUser;
}

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

const MUSCLE_FILTERS = [
  "All",
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Forearms",
  "Abs",
  "Obliques",
  "Serratus",
  "Traps",
  "Rear Delts",
  "Lats",
  "Lower Back",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Adductors",
  "Calves",
  "Legs",
];

const EQUIPMENT_FILTERS = [
  "All",
  "Barbell",
  "Dumbbell",
  "Cable",
  "Machine",
  "Bodyweight",
  "Kettlebell",
  "Smith Machine",
  "EZ Bar",
  "Resistance Band",
  "Landmine",
  "Trap Bar",
  "Pull-Up Bar",
  "Dip Station",
  "Suspension Trainer",
  "Bench",
  "Plate",
  "Cardio Machine",
  "Other",
];


function getAvailableMuscleFilters() {

  const actualMuscles =
    exercises
      .map(
        (exercise) =>
          String(
            exercise.muscle || ""
          ).trim()
      )
      .filter(Boolean);

  return [
    ...MUSCLE_FILTERS,
    ...actualMuscles
      .filter(
        (muscle) =>
          !MUSCLE_FILTERS.includes(muscle)
      )
      .sort(
        (a, b) =>
          a.localeCompare(b)
      )
  ];

}


function getAvailableEquipmentFilters() {

  const actualEquipment =
    exercises
      .map(
        (exercise) =>
          String(
            exercise.equipment || ""
          ).trim()
      )
      .filter(Boolean);

  return [
    ...EQUIPMENT_FILTERS,
    ...actualEquipment
      .filter(
        (item) =>
          !EQUIPMENT_FILTERS.includes(item)
      )
      .sort(
        (a, b) =>
          a.localeCompare(b)
      )
  ];

}


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

  ${exercise.coverImageUrl
      ? `
        <img
          src="${exercise.coverImageUrl}"
          alt=""
          class="exercise-thumbnail"
          loading="lazy"
          decoding="async"
        >
      `
      : `
        <span class="visual-letter">
          ${exercise.name.charAt(0)}
        </span>
      `
    }

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
    Barbell: "barbell",
    Dumbbell: "dumbbell",
    Cable: "cable",
    Machine: "machine",
    Bodyweight: "bodyweight"
  };

  return icon(
    icons[type] || "dumbbell",
    18
  );
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

              ${getAvailableMuscleFilters()
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

              ${getAvailableEquipmentFilters()
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

function icon(name, size = 21) {

  const icons = {

    workouts: `
      <svg
        viewBox="0 0 24 24"
        width="${size}"
        height="${size}"
        aria-hidden="true"
        fill="none"
      >
        <path
          d="M6 9v6M4.5 10.5v3M8 7v10M18 9v6M19.5 10.5v3M16 7v10"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <path
          d="M8 12h8"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    `,


    routines: `
      <svg
        viewBox="0 0 24 24"
        width="${size}"
        height="${size}"
        aria-hidden="true"
        fill="none"
      >
        <rect
          x="5"
          y="4"
          width="14"
          height="17"
          rx="2"
          stroke="currentColor"
          stroke-width="1.8"
        />

        <path
          d="M9 8h6M9 12h6M9 16h3"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
    `,


    muscleMap: `
      <svg
        viewBox="0 0 24 24"
        width="${size}"
        height="${size}"
        aria-hidden="true"
        fill="none"
      >
        <circle
          cx="12"
          cy="5"
          r="2.2"
          stroke="currentColor"
          stroke-width="1.7"
        />

        <path
          d="
            M8.5 9
            C9.4 7.8 10.2 7.2 12 7.2
            C13.8 7.2 14.6 7.8 15.5 9

            M9.2 9.2
            L7.2 14.2
            L8.8 15.2
            L10.1 12.7

            M14.8 12.7
            L15.2 17.5
            M9.9 12.7
            L8.5 17.5

            M7.2 14.2
            L5.9 17

            M16.8 14.2
            L18.1 17
          "
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `,


    profile: `
      <svg
        viewBox="0 0 24 24"
        width="${size}"
        height="${size}"
        aria-hidden="true"
        fill="none"
      >
        <circle
          cx="12"
          cy="8"
          r="3"
          stroke="currentColor"
          stroke-width="1.8"
        />

        <path
          d="M5.5 20c.8-3.4 3.1-5 6.5-5s5.7 1.6 6.5 5"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
    `,


    barbell: `
      <svg
        viewBox="0 0 24 24"
        width="${size}"
        height="${size}"
        aria-hidden="true"
        fill="none"
      >
        <path
          d="M7 8v8M4.5 9.5v5M2.5 10.5v3M17 8v8M19.5 9.5v5M21.5 10.5v3M7 12h10"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
    `,


    dumbbell: `
      <svg
        viewBox="0 0 24 24"
        width="${size}"
        height="${size}"
        aria-hidden="true"
        fill="none"
      >
        <path
          d="M5 8v8M8 6v12M16 6v12M19 8v8M8 12h8"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
    `,


    cable: `
      <svg
        viewBox="0 0 24 24"
        width="${size}"
        height="${size}"
        aria-hidden="true"
        fill="none"
      >
        <path
          d="M6 4v12M6 16c0 2.2 1.8 4 4 4h4"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />

        <circle
          cx="6"
          cy="4"
          r="2"
          stroke="currentColor"
          stroke-width="1.7"
        />

        <path
          d="M14 20h4"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
    `,


    machine: `
      <svg
        viewBox="0 0 24 24"
        width="${size}"
        height="${size}"
        aria-hidden="true"
        fill="none"
      >
        <path
          d="M6 20V5h8l4 4v11"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
        />

        <path
          d="M10 5v4h8M10 13h5M10 17h5"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
    `,


    bodyweight: `
      <svg
        viewBox="0 0 24 24"
        width="${size}"
        height="${size}"
        aria-hidden="true"
        fill="none"
      >
        <circle
          cx="12"
          cy="4.5"
          r="2"
          stroke="currentColor"
          stroke-width="1.7"
        />

        <path
          d="
            M12 7
            v6
            M8.5 9.5
            L12 11
            L15.5 9.5
            M12 13
            L9 19
            M12 13
            L15 19
          "
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `

  };

  return icons[name] || "";
}

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

        <span class="nav-icon">
          ${icon("workouts")}
        </span>

        <span class="nav-label">
          Workouts
        </span>

      </button>


      <button
        class="nav-item ${activePage === "routines" ? "active" : ""}"
        data-page="routines"
        type="button"
      >

        <span class="nav-icon">
          ${icon("routines")}
        </span>

        <span class="nav-label">
          Routines
        </span>

      </button>


      <button
        class="nav-item ${activePage === "map" ? "active" : ""}"
        data-page="map"
        type="button"
      >

        <span class="nav-icon">
          ${icon("muscleMap")}
        </span>

        <span class="nav-label">
          Muscle Map
        </span>

      </button>


      <button
        class="nav-item ${activePage === "profile" ? "active" : ""}"
        data-page="profile"
        type="button"
      >

        <span class="nav-icon nav-avatar-icon">

          ${clerk.user?.imageUrl
      ? `
                <img
                  src="${clerk.user.imageUrl}"
                  alt=""
                >
              `
      : icon("profile")
    }

        </span>

        <span class="nav-label">
          Profile
        </span>

      </button>

    </nav>

  `;
}

const MUSCLE_PLATES = {
  front: {
    base: "/assets/muscle-map/front/front.webp",
    chest: "/assets/muscle-map/front/chest.webp",
    shoulders: "/assets/muscle-map/front/shoulder.webp",
    biceps: "/assets/muscle-map/front/biceps.webp",
    triceps: "/assets/muscle-map/front/triceps.webp",
    forearms: "/assets/muscle-map/front/forearms.webp",
    abs: "/assets/muscle-map/front/abs.webp",
    obliques: "/assets/muscle-map/front/obliques.webp",
    serratus: "/assets/muscle-map/front/serratus.webp",
    quads: "/assets/muscle-map/front/quads.webp",
    adductors: "/assets/muscle-map/front/adductors.webp",
    calves: "/assets/muscle-map/front/calves.webp",
  },

  back: {
    base: "/assets/muscle-map/back/back.webp",
    traps: "/assets/muscle-map/back/traps.webp",
    rearDelts: "/assets/muscle-map/back/rear_delts.webp",
    lats: "/assets/muscle-map/back/lats.webp",
    triceps: "/assets/muscle-map/back/triceps.webp",
    forearms: "/assets/muscle-map/back/forearms.webp",
    lowerBack: "/assets/muscle-map/back/lower_back.webp",
    glutes: "/assets/muscle-map/back/glutes.webp",
    hamstrings: "/assets/muscle-map/back/hamstrings.webp",
    calves: "/assets/muscle-map/back/calves.webp",
  }
};

const MUSCLE_HOTSPOTS = {

  front: {

    chest: {
      label: "Chest",
      priority: 10,
      zones: [
        { left: 34, top: 20, width: 15, height: 10 },
        { left: 51, top: 20, width: 15, height: 10 },
      ],
    },

    shoulders: {
      label: "Shoulders",
      priority: 15,
      zones: [
        { left: 23, top: 18, width: 12, height: 10 },
        { left: 65, top: 18, width: 12, height: 10 },
      ],
    },

    biceps: {
      label: "Biceps",
      priority: 20,
      zones: [
        { left: 28, top: 25, width: 11, height: 11 },
        { left: 61, top: 25, width: 11, height: 11 },
      ],
    },

    triceps: {
      label: "Triceps",
      priority: 19,
      zones: [
        { left: 24, top: 27, width: 10, height: 13 },
        { left: 66, top: 27, width: 10, height: 13 },
      ],
    },

    forearms: {
      label: "Forearms",
      priority: 18,
      zones: [
        { left: 19, top: 35, width: 10, height: 18 },
        { left: 71, top: 35, width: 10, height: 18 },
      ],
    },

    abs: {
      label: "Abs",
      priority: 40,
      zones: [
        { left: 43, top: 29, width: 14, height: 19 },
      ],
    },

    obliques: {
      label: "Obliques",
      priority: 35,
      zones: [
        { left: 34, top: 30, width: 9, height: 15 },
        { left: 57, top: 30, width: 9, height: 15 },
      ],
    },

    serratus: {
      label: "Serratus",
      priority: 45,
      zones: [
        { left: 34, top: 25, width: 9, height: 8 },
        { left: 57, top: 25, width: 9, height: 8 },
      ],
    },

    quads: {
      label: "Quads",
      priority: 10,
      zones: [
        { left: 33, top: 46, width: 16, height: 24 },
        { left: 51, top: 46, width: 16, height: 24 },
      ],
    },

    adductors: {
      label: "Adductors",
      priority: 45,
      zones: [
        { left: 43, top: 58, width: 7, height: 11 },
        { left: 50, top: 58, width: 7, height: 11 },
      ],
    },

    calves: {
      label: "Calves",
      priority: 20,
      zones: [
        { left: 34, top: 73, width: 11, height: 18 },
        { left: 55, top: 73, width: 11, height: 18 },
      ],
    },

  },


  back: {

    traps: {
      label: "Traps",
      priority: 40,
      zones: [
        { left: 39, top: 14, width: 22, height: 14 },
      ],
    },

    rearDelts: {
      label: "Rear Delts",
      priority: 35,
      zones: [
        { left: 27, top: 18, width: 12, height: 10 },
        { left: 61, top: 18, width: 12, height: 10 },
      ],
    },

    lats: {
      label: "Lats",
      priority: 25,
      zones: [
        { left: 33, top: 27, width: 12, height: 17 },
        { left: 55, top: 27, width: 12, height: 17 },
      ],
    },

    triceps: {
      label: "Triceps",
      priority: 20,
      zones: [
        { left: 24, top: 27, width: 10, height: 14 },
        { left: 66, top: 27, width: 10, height: 14 },
      ],
    },

    forearms: {
      label: "Forearms",
      priority: 18,
      zones: [
        { left: 19, top: 35, width: 10, height: 18 },
        { left: 71, top: 35, width: 10, height: 18 },
      ],
    },

    lowerBack: {
      label: "Lower Back",
      priority: 45,
      zones: [
        { left: 43, top: 37, width: 14, height: 10 },
      ],
    },

    glutes: {
      label: "Glutes",
      priority: 35,
      zones: [
        { left: 35, top: 47, width: 15, height: 15 },
        { left: 50, top: 47, width: 15, height: 15 },
      ],
    },

    hamstrings: {
      label: "Hamstrings",
      priority: 25,
      zones: [
        { left: 34, top: 60, width: 15, height: 18 },
        { left: 51, top: 60, width: 15, height: 18 },
      ],
    },

    calves: {
      label: "Calves",
      priority: 20,
      zones: [
        { left: 34, top: 77, width: 11, height: 13 },
        { left: 55, top: 77, width: 11, height: 13 },
      ],
    },

  },

};

// =========================================================
// MUSCLE TRAINING ANALYTICS
// Uses only explicitly logged user data.
// =========================================================

function getMuscleTrainingStats(muscleName) {

  const normalizedMuscle =
    String(muscleName || "")
      .trim()
      .toLowerCase();

  const matchingExercises =
    exercises.filter(
      (exercise) =>
        String(exercise.muscle || "")
          .trim()
          .toLowerCase() === normalizedMuscle
    );

  const matchingExerciseIds =
    new Set(
      matchingExercises.map(
        (exercise) => String(exercise.id)
      )
    );

  /*
   * Routines containing at least one exercise
   * whose PRIMARY muscle matches this region.
   */
  const matchingRoutines =
    routines.filter(
      (routine) =>
        Array.isArray(routine.exercises) &&
        routine.exercises.some(
          (entry) =>
            matchingExerciseIds.has(
              String(entry.exerciseId)
            )
        )
    );

  let totalSets = 0;
  let totalReps = 0;
  let totalVolumeKg = 0;

  const loggedExerciseIds = new Set();
  const matchingSessions = [];

  workoutSessions.forEach(
    (session) => {

      const matchingEntries =
        (session.exercises || []).filter(
          (entry) =>
            matchingExerciseIds.has(
              String(entry.exerciseId)
            )
        );

      if (!matchingEntries.length) {
        return;
      }

      matchingEntries.forEach(
        (entry) => {

          loggedExerciseIds.add(
            String(entry.exerciseId)
          );

          const sets =
            Number(entry.sets);

          const reps =
            Number(entry.reps);

          const weight =
            Number(entry.weight);

          if (Number.isFinite(sets)) {
            totalSets += sets;
          }

          if (Number.isFinite(reps)) {
            totalReps += reps;
          }

          /*
           * Volume is calculated ONLY when all
           * three logged values are numeric.
           */
          if (
            Number.isFinite(weight) &&
            Number.isFinite(reps) &&
            Number.isFinite(sets) &&
            weight > 0 &&
            reps > 0 &&
            sets > 0
          ) {
            totalVolumeKg +=
              weight *
              reps *
              sets;
          }

        }
      );

      matchingSessions.push({
        ...session,
        matchingEntries
      });

    }
  );

  matchingSessions.sort(
    (a, b) =>
      new Date(`${b.date}T00:00:00`) -
      new Date(`${a.date}T00:00:00`)
  );

  const lastSession =
    matchingSessions[0] || null;

  const recentTraining =
    matchingSessions
      .slice(0, 4)
      .flatMap(
        (session) =>
          session.matchingEntries.map(
            (entry) => {

              const exercise =
                exercises.find(
                  (item) =>
                    String(item.id) ===
                    String(entry.exerciseId)
                );

              return {
                date: session.date,
                exerciseName:
                  exercise?.name ||
                  "Unknown exercise",
                sets: entry.sets,
                reps: entry.reps,
                weight: Number(entry.weight),
                notes: entry.notes || ""
              };

            }
          )
      )
      .slice(0, 6);

  return {
    muscle: muscleName,

    availableExercises:
      matchingExercises.length,

    trainedExercises:
      loggedExerciseIds.size,

    routines:
      matchingRoutines.length,

    sessions:
      matchingSessions.length,

    sets:
      totalSets,

    reps:
      totalReps,

    volumeKg:
      totalVolumeKg,

    lastTrained:
      lastSession?.date || null,

    recentTraining
  };

}


function renderMuscleMap() {

  let side = "front";
  let selectedMuscle = null;

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
      ? `
                <img
                  src="${clerk.user.imageUrl}"
                  alt=""
                >
              `
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
              REDLINE SYSTEM
            </span>

            <h1 id="muscle-map-title">
              MUSCLE MAP
            </h1>

          </div>


          <div
  class="muscle-map-view-toggle"
  role="group"
  aria-label="Anatomy view"
>

  <button
    type="button"
    class="muscle-view-button active"
    data-side="front"
    aria-pressed="true"
  >
    FRONT
  </button>

  <button
    type="button"
    class="muscle-view-button"
    data-side="back"
    aria-pressed="false"
  >
    BACK
  </button>

</div>


          <div class="muscle-map-stage">

            <div class="muscle-map-model">

              <img
                class="muscle-map-base"
                src="${MUSCLE_PLATES.front.base}"
                alt="Front anatomical muscle display"
                draggable="false"
              >

              <img
                class="muscle-map-state"
                src=""
                alt=""
                aria-hidden="true"
                draggable="false"
              >


              <div
                class="muscle-map-hotspots"
                aria-label="Muscle regions"
              ></div>

            </div>

          </div>

          <button
  class="muscle-map-picker-button"
  type="button"
  aria-haspopup="dialog"
  aria-expanded="false"
>
  <span>SELECT MUSCLE</span>
  <span aria-hidden="true">+</span>
</button>

<div
  class="muscle-map-picker"
  aria-hidden="true"
>
  <div class="muscle-map-picker-backdrop"></div>

  <div
    class="muscle-map-picker-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="muscle-map-picker-title"
  >
    <div class="muscle-map-picker-handle"></div>

    <div class="muscle-map-picker-header">
      <div>
        <span class="muscle-map-picker-kicker">
          REDLINE SYSTEM
        </span>

        <h2 id="muscle-map-picker-title">
          SELECT MUSCLE
        </h2>
      </div>

      <button
        class="muscle-map-picker-close"
        type="button"
        aria-label="Close muscle selector"
      >
        ×
      </button>
    </div>

    <div
      class="muscle-map-picker-list"
      role="list"
    ></div>
  </div>
</div>


          <div
  class="muscle-map-selected"
  aria-live="polite"
  aria-hidden="true"
></div>

        </section>

      </main>


      ${renderBottomNav("map")}

    </div>

  `;


  const model =
    document.querySelector(
      ".muscle-map-model"
    );

  const baseImage =
    document.querySelector(
      ".muscle-map-base"
    );

  const stateImage =
    document.querySelector(
      ".muscle-map-state"
    );

  const hotspots =
    document.querySelector(
      ".muscle-map-hotspots"
    );

  const selectedPanel =
    document.querySelector(
      ".muscle-map-selected"
    );

  function formatMuscleDate(date) {

    if (!date) {
      return "NO LOGGED TRAINING";
    }

    const parsed =
      new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString(
      undefined,
      {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }
    ).toUpperCase();
  }


  function formatMuscleVolume(kg) {

    if (!Number.isFinite(kg) || kg <= 0) {
      return "—";
    }

    const value =
      weightUnit === "LB"
        ? kg * KG_TO_LB
        : kg;

    return `${Number(value.toFixed(1))} ${weightUnit.toLowerCase()}`;
  }


  function renderSelectedMusclePanel(
    muscleId
  ) {

    const muscle =
      MUSCLE_HOTSPOTS[side]?.[muscleId];

    if (!muscle) {
      return;
    }

    const stats =
      getMuscleTrainingStats(
        muscle.label
      );

    selectedPanel.innerHTML = `
    <div class="muscle-performance-header">

      <div>
        <span class="muscle-performance-kicker">
          SELECTED REGION
        </span>

        <h2 class="muscle-performance-name">
          ${muscle.label}
        </h2>

        <p class="muscle-performance-subtitle">
          ${stats.sessions
        ? "YOUR LOGGED TRAINING"
        : "NO LOGGED TRAINING YET"}
        </p>
      </div>

      <span class="muscle-performance-side">
        ${side === "front" ? "FRONT" : "BACK"}
      </span>

    </div>


    <div class="muscle-performance-stats">

      <div class="muscle-performance-stat">
        <span>SESSIONS</span>
        <strong>${stats.sessions}</strong>
      </div>

      <div class="muscle-performance-stat">
        <span>ROUTINES</span>
        <strong>${stats.routines}</strong>
      </div>

      <div class="muscle-performance-stat">
        <span>SETS</span>
        <strong>${stats.sets}</strong>
      </div>

      <div class="muscle-performance-stat">
        <span>REPS</span>
        <strong>${stats.reps}</strong>
      </div>

      <div class="muscle-performance-stat">
        <span>MOVEMENTS</span>
        <strong>${stats.trainedExercises}</strong>
      </div>

      <div class="muscle-performance-stat">
        <span>VOLUME</span>
        <strong>${formatMuscleVolume(stats.volumeKg)}</strong>
      </div>

    </div>


    <div class="muscle-performance-last">

      <span>
        LAST TRAINED
      </span>

      <strong>
        ${formatMuscleDate(stats.lastTrained)}
      </strong>

    </div>


    <div class="muscle-performance-history">

      <div class="muscle-performance-history-heading">
        RECENT TRAINING
      </div>

      ${stats.recentTraining.length
        ? `
            <div class="muscle-performance-history-list">

              ${stats.recentTraining
          .map(
            (entry) => `
                    <article
                      class="muscle-performance-history-item"
                    >

                      <div>
                        <strong>
                          ${entry.exerciseName}
                        </strong>

                        <span>
                          ${formatMuscleDate(entry.date)}
                        </span>
                      </div>

                      <div class="muscle-performance-history-values">

                        <span>
                          ${entry.sets || "—"} SETS
                        </span>

                        <span>
                          ${entry.reps || "—"} REPS
                        </span>

                        <span>
                          ${entry.weight > 0
                ? formatWeight(entry.weight)
                : "BODYWEIGHT"
              }
                        </span>

                      </div>

                    </article>
                  `
          )
          .join("")}

            </div>
          `
        : `
            <div class="muscle-performance-empty">
              COMPLETE A WORKOUT CONTAINING THIS
              MUSCLE TO BUILD YOUR TRAINING HISTORY.
            </div>
          `
      }

    </div>


    <button
      class="muscle-performance-action"
      type="button"
    >
      <span>VIEW EXERCISES</span>
      <span aria-hidden="true">→</span>
    </button>
  `;


    selectedPanel
      .querySelector(
        ".muscle-performance-action"
      )
      ?.addEventListener(
        "click",
        (event) => {

          event.stopPropagation();

          sessionStorage.setItem(
            "redlineSelectedMuscle",
            muscle.label
          );

          selectedPanel.classList.remove(
            "is-visible"
          );

          selectedPanel.setAttribute(
            "aria-hidden",
            "true"
          );

          document
            .querySelector(
              '[data-page="workouts"]'
            )
            ?.click();

        }
      );

  }

  const selectedAction =
    document.querySelector(
      ".muscle-map-selected-action"
    );


  function renderHotspots() {

    hotspots.innerHTML = Object.entries(
      MUSCLE_HOTSPOTS[side]
    )
      .flatMap(([id, muscle]) =>
        muscle.zones.map(
          (zone, zoneIndex) => `
          <button
            type="button"
            class="muscle-map-hotspot"
            data-muscle="${id}"
            data-zone="${zoneIndex}"
            aria-label="Select ${muscle.label}"
            style="
              left:${zone.left}%;
              top:${zone.top}%;
              width:${zone.width}%;
              height:${zone.height}%;
              z-index:${muscle.priority};
            "
          ></button>
        `
        )
      )
      .join("");

  }

  hotspots.addEventListener(
    "click",
    (event) => {

      event.stopPropagation();

      const button =
        event.target.closest(
          ".muscle-map-hotspot"
        );

      if (!button) {
        return;
      }

      selectMuscle(
        button.dataset.muscle
      );

    }
  );

  function renderMusclePicker() {

    const list =
      document.querySelector(
        ".muscle-map-picker-list"
      );

    if (!list) {
      return;
    }

    list.innerHTML =
      Object.entries(MUSCLE_HOTSPOTS[side])
        .map(
          ([id, muscle]) => `
          <button
            type="button"
            class="muscle-map-picker-item"
            data-picker-muscle="${id}"
          >
            <span>
              ${muscle.label}
            </span>

            <span aria-hidden="true">
              →
            </span>
          </button>
        `
        )
        .join("");

  }

  const pickerButton =
    document.querySelector(
      ".muscle-map-picker-button"
    );

  const picker =
    document.querySelector(
      ".muscle-map-picker"
    );

  const pickerBackdrop =
    document.querySelector(
      ".muscle-map-picker-backdrop"
    );

  const pickerClose =
    document.querySelector(
      ".muscle-map-picker-close"
    );

  function openMusclePicker() {

    renderMusclePicker();

    picker.classList.add("is-visible");

    picker.setAttribute(
      "aria-hidden",
      "false"
    );

    pickerButton.setAttribute(
      "aria-expanded",
      "true"
    );

  }

  function closeMusclePicker() {

    picker.classList.remove(
      "is-visible"
    );

    picker.setAttribute(
      "aria-hidden",
      "true"
    );

    pickerButton.setAttribute(
      "aria-expanded",
      "false"
    );

  }

  pickerButton?.addEventListener(
    "click",
    openMusclePicker
  );

  pickerClose?.addEventListener(
    "click",
    closeMusclePicker
  );

  pickerBackdrop?.addEventListener(
    "click",
    closeMusclePicker
  );

  document
    .querySelector(
      ".muscle-map-picker-list"
    )
    ?.addEventListener(
      "click",
      (event) => {

        const button =
          event.target.closest(
            "[data-picker-muscle]"
          );

        if (!button) {
          return;
        }

        closeMusclePicker();

        selectMuscle(
          button.dataset.pickerMuscle
        );

      }
    );


  function clearSelection() {

    selectedMuscle = null;

    stateImage.classList.remove(
      "is-visible"
    );

    stateImage.removeAttribute(
      "src"
    );

    selectedPanel.classList.remove(
      "is-visible"
    );

    selectedPanel.setAttribute(
      "aria-hidden",
      "true"
    );

    document
      .querySelectorAll(
        ".muscle-map-hotspot"
      )
      .forEach(
        (button) =>
          button.classList.remove(
            "active"
          )
      );

  }


  function selectMuscle(id) {

    const muscle =
      MUSCLE_HOTSPOTS[side]?.[id];

    const plate =
      MUSCLE_PLATES[side]?.[id];

    if (!muscle || !plate) {
      return;
    }

    selectedMuscle = id;

    document
      .querySelectorAll(".muscle-map-hotspot")
      .forEach((button) => {

        button.classList.toggle(
          "active",
          button.dataset.muscle === id
        );

      });

    renderSelectedMusclePanel(
      id
    );

    selectedPanel.classList.add(
      "is-visible"
    );

    selectedPanel.setAttribute(
      "aria-hidden",
      "false"
    );

    stateImage.classList.remove(
      "is-visible"
    );

    const nextImage =
      new Image();

    nextImage.onload = () => {

      if (selectedMuscle !== id) {
        return;
      }

      stateImage.src = plate;

      stateImage.classList.add(
        "is-visible"
      );

    };

    nextImage.src = plate;

  }

  selectedAction?.addEventListener(
    "click",
    (event) => {

      event.stopPropagation();

      if (!selectedMuscle) {
        return;
      }

      const muscle =
        MUSCLE_HOTSPOTS[side]?.[selectedMuscle];

      if (!muscle) {
        return;
      }

      /*
       * Store the exact muscle name used by
       * the exercise library.
       */
      sessionStorage.setItem(
        "redlineSelectedMuscle",
        muscle.label
      );

      /*
       * Close the selected panel.
       */
      selectedPanel.classList.remove(
        "is-visible"
      );

      selectedPanel.setAttribute(
        "aria-hidden",
        "true"
      );

      /*
       * Navigate through the existing app
       * navigation instead of forcing a page reload.
       */
      const workoutsNav =
        document.querySelector(
          '[data-page="workouts"]'
        );

      workoutsNav?.click();

    }
  );

  function switchSide(
    nextSide
  ) {

    if (
      nextSide === side
    ) {
      return;
    }

    side =
      nextSide;

    clearSelection();


    const nextBase =
      MUSCLE_PLATES[
        nextSide
      ].base;


    baseImage.onload =
      () => {

        model.classList.remove(
          "is-switching"
        );

      };


    baseImage.src =
      nextBase;


    baseImage.alt =
      nextSide === "front"
        ? "Front anatomical muscle display"
        : "Back anatomical muscle display";


    document
      .querySelectorAll(
        ".muscle-view-button"
      )
      .forEach(
        (button) => {

          const active =
            button.dataset.side ===
            nextSide;

          button.classList.toggle(
            "active",
            active
          );

          button.setAttribute(
            "aria-pressed",
            active
              ? "true"
              : "false"
          );

        }
      );


    renderHotspots();

  }


  renderHotspots();


  hotspots.addEventListener(
    "click",
    (event) => {

      const button =
        event.target.closest(
          ".muscle-map-hotspot"
        );

      if (!button) {
        return;
      }

      selectMuscle(
        button.dataset.muscle
      );

    }
  );


  document
    .querySelectorAll(
      ".muscle-view-button"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            switchSide(
              button.dataset.side
            );

          }
        );

      }
    );


  attachEvents();

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

async function openProfile() {

  if (document.querySelector(".routine-detail-page")) {

    profileReturnView =
      "routine-detail";

  } else if (
    document.querySelector(".routines-screen")
  ) {

    profileReturnView =
      "routines";

  } else {

    profileReturnView =
      "workouts";

  }

  await ensureAdminAccess();

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

${isAdminUser ? `
<section class="profile-section">

  <div class="profile-section-heading">
    ADMIN
  </div>

  <button
    class="profile-setting-row profile-admin-button"
    type="button"
  >

    <div class="profile-setting-info">

      <strong>
        EXERCISE LIBRARY
      </strong>

      <span>
        CREATE, EDIT AND MANAGE PUBLIC EXERCISES
      </span>

    </div>

    <span class="profile-setting-action">
      →
    </span>

  </button>

</section>
` : ""}

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
                        String(item.id) ===
                        routineId
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

function getYouTubeVideoId(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);

    const host =
      url.hostname
        .replace(/^www\./, "")
        .toLowerCase();

    let videoId = "";

    if (host === "youtu.be") {
      videoId =
        url.pathname
          .split("/")
          .filter(Boolean)[0] || "";
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com"
    ) {
      if (url.pathname === "/watch") {
        videoId =
          url.searchParams.get("v") || "";
      } else if (
        /^\/(embed|shorts|live)\//.test(
          url.pathname
        )
      ) {
        videoId =
          url.pathname
            .split("/")
            .filter(Boolean)[1] || "";
      }
    }

    return /^[A-Za-z0-9_-]{11}$/.test(videoId)
      ? videoId
      : "";

  } catch {
    return "";
  }
}


function getYouTubeEmbedUrl(value) {
  const videoId =
    getYouTubeVideoId(value);

  if (!videoId) {
    return "";
  }

  return (
    `https://www.youtube.com/embed/${videoId}` +
    `?rel=0&modestbranding=1`
  );
}

function exerciseMedia(exercise) {

  const youtubeEmbed =
    getYouTubeEmbedUrl(
      exercise.demoYoutubeUrl
    );


  let mediaMarkup = "";
  let hasMedia = false;


  if (youtubeEmbed) {

    hasMedia = true;

    mediaMarkup = `
      <iframe
        class="detail-demo-media detail-demo-iframe"
        src="${escapeHtml(youtubeEmbed)}"
        title="${escapeHtml(
      exercise.name
    )} demonstration"
        loading="lazy"
        allow="
          accelerometer;
          autoplay;
          clipboard-write;
          encrypted-media;
          gyroscope;
          picture-in-picture;
          web-share
        "
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      ></iframe>
    `;

  } else if (
    exercise.demoVideoUrl
  ) {

    hasMedia = true;

    mediaMarkup = `
      <video
        class="detail-demo-media detail-demo-video"
        controls
        playsinline
        preload="metadata"
      >
        <source
          src="${escapeHtml(
      exercise.demoVideoUrl
    )}"
        >
        Your browser does not support video playback.
      </video>
    `;

  } else if (
    exercise.demoGifUrl
  ) {

    hasMedia = true;

    mediaMarkup = `
      <img
        class="detail-demo-media detail-demo-image"
        src="${escapeHtml(
      exercise.demoGifUrl
    )}"
        alt="${escapeHtml(
      exercise.name
    )} demonstration"
        loading="lazy"
      >
    `;

  } else if (
    exercise.coverImageUrl
  ) {

    hasMedia = true;

    mediaMarkup = `
      <img
        class="detail-demo-media detail-demo-image"
        src="${escapeHtml(
      exercise.coverImageUrl
    )}"
        alt="${escapeHtml(
      exercise.name
    )}"
        loading="lazy"
      >
    `;

  } else {

    mediaMarkup = `
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
    `;
  }


  return `
    <div
      class="
        detail-media-placeholder
        ${hasMedia ? "has-media" : ""}
      "
    >

      ${mediaMarkup}

      <div class="media-grid"></div>

      <div
        class="media-corner media-corner-top"
      ></div>

      <div
        class="media-corner media-corner-bottom"
      ></div>

      <div class="media-top-label">
        REDLINE / MOVEMENT
      </div>

      <div class="media-bottom-left">
        ${String(exercise.id).padStart(2, "0")}
      </div>

      <div class="media-bottom-right">
        ${escapeHtml(
    String(
      exercise.equipment || ""
    ).toUpperCase()
  )}
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
            String(
              option.dataset.routineId
            );

          const routine =
            routines.find(
              (item) =>
                String(item.id) === routineId
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

// =========================================================
// ADMIN DASHBOARD
// =========================================================

const ADMIN_MUSCLES = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Forearms",
  "Abs",
  "Obliques",
  "Serratus",
  "Traps",
  "Rear Delts",
  "Lats",
  "Lower Back",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Adductors",
  "Calves",
  "Legs"
];

const ADMIN_EQUIPMENT = [
  "Barbell",
  "Dumbbell",
  "Cable",
  "Machine",
  "Bodyweight",
  "Kettlebell",
  "Smith Machine",
  "EZ Bar",
  "Resistance Band",
  "Landmine",
  "Trap Bar",
  "Pull-Up Bar",
  "Dip Station",
  "Suspension Trainer",
  "Bench",
  "Plate",
  "Cardio Machine",
  "Other"
];

const ADMIN_DIFFICULTIES = [
  "Beginner",
  "Intermediate",
  "Advanced"
];

const ADMIN_TYPES = [
  "Strength",
  "Cardio",
  "Mobility",
  "Stretching",
  "Bodyweight"
];


function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function splitAdminList(value) {

  return String(value || "")
    .split(",")
    .map(
      (item) => item.trim()
    )
    .filter(Boolean);

}


function splitAdminLines(value) {

  return String(value || "")
    .split("\n")
    .map(
      (item) => item.trim()
    )
    .filter(Boolean);

}


async function loadAdminExercises() {

  const {
    data,
    error
  } = await supabase
    .from("exercises")
    .select(`
      id,
      name,
      description,
      primary_muscle,
      secondary_muscles,
      equipment,
      difficulty,
      type,
      tags,
      instructions,
      cover_image_url,
demo_gif_url,
demo_video_url,
demo_youtube_url,
is_public,
      created_by,
      created_at,
      updated_at
    `)
    .order(
      "name",
      {
        ascending: true
      }
    );

  if (error) {

    console.error(
      "Failed to load admin exercises:",
      error
    );

    throw error;
  }

  adminExercises =
    data || [];

  return adminExercises;
}


async function uploadAdminAsset(
  file,
  bucket,
  prefix
) {

  if (!file) {
    return "";
  }

  const extension =
    file.name.includes(".")
      ? file.name
        .split(".")
        .pop()
        .toLowerCase()
      : "bin";

  const path =
    `${clerk.user.id}/${prefix}-${crypto.randomUUID()}.${extension}`;

  const {
    error
  } = await supabase
    .storage
    .from(bucket)
    .upload(
      path,
      file,
      {
        upsert: false,
        cacheControl: "3600",
        contentType:
          file.type || undefined
      }
    );

  if (error) {
    throw error;
  }

  const {
    data
  } = supabase
    .storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
}


async function saveAdminExercise(
  form
) {

  const formData =
    new FormData(form);


  const name =
    String(
      formData.get("name") || ""
    ).trim();


  const description =
    String(
      formData.get("description") || ""
    ).trim();


  const primaryMuscle =
    String(
      formData.get("primary_muscle") || ""
    ).trim();


  const secondaryMuscles =
    splitAdminList(
      formData.get("secondary_muscles")
    );


  const exerciseEquipment =
    String(
      formData.get("equipment") || ""
    );


  const difficulty =
    String(
      formData.get("difficulty") || ""
    );


  const type =
    String(
      formData.get("type") || ""
    );


  const tags =
    splitAdminList(
      formData.get("tags")
    );


  const instructions =
    splitAdminLines(
      formData.get("instructions")
    );


  const isPublic =
    formData.get("is_public") === "on";


  // =====================================================
  // COVER IMAGE
  // =====================================================

  const coverFile =
    formData.get("cover_image");


  const coverImageInput =
    String(
      formData.get("cover_image_url") || ""
    ).trim();


  if (coverImageInput) {

    try {

      new URL(
        coverImageInput
      );

    } catch {

      alert(
        "Please enter a valid cover image URL."
      );

      return;
    }
  }


  // =====================================================
  // DEMO MEDIA
  // =====================================================

  const demoFile =
    formData.get("demo_media");


  const demoYoutubeInput =
    String(
      formData.get("demo_youtube_url") || ""
    ).trim();


  const demoYoutubeId =
    getYouTubeVideoId(
      demoYoutubeInput
    );


  if (
    demoYoutubeInput &&
    !demoYoutubeId
  ) {

    alert(
      "Please enter a valid YouTube URL."
    );

    return;
  }


  const demoYoutubeUrl =
    demoYoutubeId
      ? `https://www.youtube.com/watch?v=${demoYoutubeId}`
      : "";


  // =====================================================
  // REQUIRED FIELDS
  // =====================================================

  if (
    !name ||
    !primaryMuscle ||
    !exerciseEquipment ||
    !difficulty ||
    !type
  ) {

    alert(
      "Name, primary muscle, equipment, difficulty and type are required."
    );

    return;
  }


  const submitButton =
    form.querySelector(
      ".admin-save-button"
    );


  if (submitButton) {

    submitButton.disabled = true;

    submitButton.textContent =
      "SAVING...";
  }


  try {

    let coverImageUrl =
      "";

    let demoGifUrl =
      "";

    let demoVideoUrl =
      "";


    // ===================================================
    // COVER IMAGE
    // ===================================================

    if (
      coverFile instanceof File &&
      coverFile.size > 0
    ) {

      const allowedCoverTypes =
        new Set([
          "image/png",
          "image/jpeg",
          "image/webp"
        ]);


      if (
        !allowedCoverTypes.has(
          coverFile.type
        )
      ) {

        alert(
          "Cover image must be PNG, JPG or WebP."
        );

        return;
      }


      coverImageUrl =
        await uploadAdminAsset(
          coverFile,
          "exercise-covers",
          "cover"
        );

    } else if (
      coverImageInput
    ) {

      // URL is used when no file is uploaded
      coverImageUrl =
        coverImageInput;
    }


    // ===================================================
    // DEMO MEDIA
    // ===================================================

    if (
      demoFile instanceof File &&
      demoFile.size > 0
    ) {

      const allowedDemoTypes =
        new Set([
          "image/gif",
          "video/mp4",
          "video/webm"
        ]);


      if (
        !allowedDemoTypes.has(
          demoFile.type
        )
      ) {

        alert(
          "Demo media must be GIF, MP4 or WebM."
        );

        return;
      }


      const uploadedDemoUrl =
        await uploadAdminAsset(
          demoFile,
          "exercise-demos",
          "demo"
        );


      if (
        demoFile.type ===
        "image/gif"
      ) {

        demoGifUrl =
          uploadedDemoUrl;

      } else {

        demoVideoUrl =
          uploadedDemoUrl;
      }
    }


    // ===================================================
    // PAYLOAD
    // ===================================================

    const payload = {

      name,

      description,

      primary_muscle:
        primaryMuscle,

      secondary_muscles:
        secondaryMuscles,

      equipment:
        exerciseEquipment,

      difficulty,

      type,

      tags,

      instructions,

      is_public:
        isPublic,

      updated_at:
        new Date().toISOString()

    };


    // ===================================================
    // UPDATE EXISTING EXERCISE
    // ===================================================

    if (
      adminEditingExerciseId
    ) {

      /*
       * Only change cover_image_url when
       * the admin supplied a new file or URL.
       *
       * Otherwise the existing cover is preserved.
       */
      if (coverImageUrl) {

        payload.cover_image_url =
          coverImageUrl;
      }


      // -----------------------------------------------
      // DEMO FILE
      // -----------------------------------------------

      if (
        demoFile instanceof File &&
        demoFile.size > 0
      ) {

        payload.demo_gif_url =
          demoGifUrl || null;

        payload.demo_video_url =
          demoVideoUrl || null;

        payload.demo_youtube_url =
          null;

      }

      // -----------------------------------------------
      // YOUTUBE
      // -----------------------------------------------

      else if (
        demoYoutubeUrl
      ) {

        payload.demo_gif_url =
          null;

        payload.demo_video_url =
          null;

        payload.demo_youtube_url =
          demoYoutubeUrl;
      }


      const {
        error
      } = await supabase
        .from("exercises")
        .update(payload)
        .eq(
          "id",
          adminEditingExerciseId
        );


      if (error) {
        throw error;
      }


    }

    // ===================================================
    // CREATE NEW EXERCISE
    // ===================================================

    else {

      payload.created_by =
        clerk.user.id;


      payload.cover_image_url =
        coverImageUrl || null;


      payload.demo_gif_url =
        demoGifUrl || null;


      payload.demo_video_url =
        demoVideoUrl || null;


      payload.demo_youtube_url =
        demoYoutubeUrl || null;


      const {
        error
      } = await supabase
        .from("exercises")
        .insert(
          payload
        );


      if (error) {
        throw error;
      }

    }


    // ===================================================
    // REFRESH
    // ===================================================

    adminEditingExerciseId =
      null;


    await loadAdminExercises();

    await loadExercisesFromSupabase();

    renderAdminDashboard();


  } catch (error) {

    console.error(
      "Failed to save exercise:",
      error
    );


    alert(
      error.message ||
      "Failed to save exercise."
    );


    if (submitButton) {

      submitButton.disabled =
        false;

      submitButton.textContent =
        "SAVE EXERCISE";
    }

  }

}


async function deleteAdminExercise(
  exerciseId
) {

  const exercise =
    adminExercises.find(
      (item) =>
        item.id === exerciseId
    );

  if (!exercise) {
    return;
  }


  const confirmed =
    window.confirm(
      `Delete "${exercise.name}"? This cannot be undone.`
    );

  if (!confirmed) {
    return;
  }


  try {

    const {
      error
    } = await supabase
      .from("exercises")
      .delete()
      .eq(
        "id",
        exerciseId
      );

    if (error) {
      throw error;
    }

    if (
      adminEditingExerciseId ===
      exerciseId
    ) {
      adminEditingExerciseId =
        null;
    }

    await loadAdminExercises();

    await loadExercisesFromSupabase();

    renderAdminDashboard();

  } catch (error) {

    console.error(
      "Failed to delete exercise:",
      error
    );

    alert(
      error.message ||
      "Failed to delete exercise."
    );

  }

}


async function renderAdminDashboard() {

  const allowed =
    await ensureAdminAccess();

  if (!allowed) {
    renderProfile();
    return;
  }


  const app =
    document.querySelector("#app");


  try {

    await loadAdminExercises();

  } catch (error) {

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
            ADMIN
          </span>

        </header>

        <main>

          <section class="admin-screen">

            <span class="section-kicker">
              REDLINE SYSTEM
            </span>

            <h1 class="admin-title">
              ADMIN
              <span>OFFLINE.</span>
            </h1>

            <p class="admin-error">
              Unable to load the exercise library.
              Check your Supabase RLS policies.
            </p>

          </section>

        </main>

      </div>
    `;

    attachEvents();

    return;
  }


  const editingExercise =
    adminExercises.find(
      (exercise) =>
        exercise.id ===
        adminEditingExerciseId
    ) || null;


  app.innerHTML = `

    <div class="app-shell">

      <header class="app-header">

        <button
          class="profile-back-button"
          type="button"
          aria-label="Back to profile"
        >
          ←
        </button>

        <span class="profile-header-label">
          ADMIN
        </span>

      </header>


      <main>

        <section class="admin-screen">

          <div class="admin-heading">

            <div>

              <span class="section-kicker">
                REDLINE SYSTEM
              </span>

              <h1 class="admin-title">
                EXERCISE
                <span>CONTROL.</span>
              </h1>

            </div>

            <div class="admin-count">
              ${adminExercises.length}
              ${adminExercises.length === 1
      ? "EXERCISE"
      : "EXERCISES"}
            </div>

          </div>


          <section class="admin-editor">

            <div class="admin-section-heading">

              <span>
                ${editingExercise
      ? "EDIT EXERCISE"
      : "NEW EXERCISE"}
              </span>

              <span>
                ${editingExercise
      ? "MODE / EDIT"
      : "MODE / CREATE"}
              </span>

            </div>


            <form
              class="admin-exercise-form"
            >

              <label>
                <span>NAME</span>
                <input
                  name="name"
                  type="text"
                  maxlength="120"
                  required
                  value="${escapeHtml(
        editingExercise?.name || ""
      )}"
                  placeholder="e.g. Incline Dumbbell Press"
                >
              </label>


              <label>
                <span>DESCRIPTION</span>
                <textarea
                  name="description"
                  rows="4"
                  maxlength="1000"
                  placeholder="Describe the movement..."
                >${escapeHtml(
        editingExercise?.description || ""
      )}</textarea>
              </label>


              <div class="admin-form-grid">

                <label>
                  <span>PRIMARY MUSCLE</span>

                  <select
                    name="primary_muscle"
                    required
                  >

                    <option value="">
                      SELECT
                    </option>

                    ${ADMIN_MUSCLES
      .map(
        (muscle) => `
                          <option
                            value="${escapeHtml(muscle)}"
                            ${editingExercise?.muscle === muscle
            ? "selected"
            : ""}
                          >
                            ${escapeHtml(muscle)}
                          </option>
                        `
      )
      .join("")}

                  </select>

                </label>


                <label>
                  <span>EQUIPMENT</span>

                  <select
                    name="equipment"
                    required
                  >

                    <option value="">
                      SELECT
                    </option>

                    ${ADMIN_EQUIPMENT
      .map(
        (item) => `
                          <option
                            value="${escapeHtml(item)}"
                            ${editingExercise?.equipment === item
            ? "selected"
            : ""}
                          >
                            ${escapeHtml(item)}
                          </option>
                        `
      )
      .join("")}

                  </select>

                </label>


                <label>
                  <span>DIFFICULTY</span>

                  <select
                    name="difficulty"
                    required
                  >

                    ${ADMIN_DIFFICULTIES
      .map(
        (item) => `
                          <option
                            value="${item}"
                            ${editingExercise?.difficulty === item
            ? "selected"
            : ""}
                          >
                            ${item}
                          </option>
                        `
      )
      .join("")}

                  </select>

                </label>


                <label>
                  <span>TYPE</span>

                  <select
                    name="type"
                    required
                  >

                    ${ADMIN_TYPES
      .map(
        (item) => `
                          <option
                            value="${item}"
                            ${editingExercise?.type === item
            ? "selected"
            : ""}
                          >
                            ${item}
                          </option>
                        `
      )
      .join("")}

                  </select>

                </label>

              </div>


              <label>
                <span>
                  SECONDARY MUSCLES
                  <small>comma separated</small>
                </span>

                <input
                  name="secondary_muscles"
                  type="text"
                  value="${escapeHtml(
        (
          editingExercise?.secondaryMuscles ||
          []
        ).join(", ")
      )}"
                  placeholder="Front Delts, Triceps"
                >
              </label>


              <label>
                <span>
                  TAGS
                  <small>comma separated</small>
                </span>

                <input
                  name="tags"
                  type="text"
                  value="${escapeHtml(
        (
          editingExercise?.tags ||
          []
        ).join(", ")
      )}"
                  placeholder="Push, Compound, Beginner"
                >
              </label>


              <label>
                <span>
                  INSTRUCTIONS
                  <small>one step per line</small>
                </span>

                <textarea
                  name="instructions"
                  rows="7"
                  placeholder="Set the bench to a slight incline.
Grab the dumbbells at shoulder height.
Press upward under control."
                >${escapeHtml(
        (
          editingExercise?.instructions ||
          []
        ).join("\n")
      )}</textarea>
              </label>


              <div class="admin-form-grid">

                <label>

  <span>
    COVER IMAGE
    <small>upload or use an image URL</small>
  </span>

  <input
    name="cover_image"
    type="file"
    accept="image/png,image/jpeg,image/webp"
  >

  <input
    name="cover_image_url"
    type="url"
    value="${escapeHtml(
      editingExercise?.cover_image_url || ""
    )}"
    placeholder="https://example.com/cover.webp"
  >

  ${editingExercise?.cover_image_url
    ? `
      <a
        class="admin-existing-file"
        href="${escapeHtml(
          editingExercise.cover_image_url
        )}"
        target="_blank"
        rel="noopener"
      >
        CURRENT COVER ↗
      </a>
    `
    : ""
  }

</label>


                <label>

  <span>
    DEMO MEDIA
    <small>GIF, MP4 or WebM</small>
  </span>

  <input
    name="demo_media"
    type="file"
    accept="image/gif,video/mp4,video/webm"
  >

  ${editingExercise?.demoGifUrl
      ? `
      <a
        class="admin-existing-file"
        href="${escapeHtml(
        editingExercise.demoGifUrl
      )}"
        target="_blank"
        rel="noopener"
      >
        CURRENT GIF ↗
      </a>
    `
      : ""
    }

  ${editingExercise?.demoVideoUrl
      ? `
      <a
        class="admin-existing-file"
        href="${escapeHtml(
        editingExercise.demoVideoUrl
      )}"
        target="_blank"
        rel="noopener"
      >
        CURRENT VIDEO ↗
      </a>
    `
      : ""
    }

</label>


<label>

  <span>
    YOUTUBE DEMO
    <small>optional</small>
  </span>

  <input
    name="demo_youtube_url"
    type="url"
    value="${escapeHtml(
      editingExercise?.demoYoutubeUrl || ""
    )}"
    placeholder="https://youtube.com/watch?v=..."
  >

  ${editingExercise?.demoYoutubeUrl
      ? `
      <a
        class="admin-existing-file"
        href="${escapeHtml(
        editingExercise.demoYoutubeUrl
      )}"
        target="_blank"
        rel="noopener"
      >
        CURRENT YOUTUBE ↗
      </a>
    `
      : ""
    }

</label>

              </div>


              <label
                class="admin-public-toggle"
              >

                <input
                  name="is_public"
                  type="checkbox"
                  ${editingExercise?.isPublic !== false
      ? "checked"
      : ""}
                >

                <span>

                  <strong>
                    PUBLIC LIBRARY
                  </strong>

                  <small>
                    SHOW THIS EXERCISE IN THE MAIN LIBRARY
                  </small>

                </span>

              </label>


              <div class="admin-form-actions">

                ${editingExercise
      ? `
                      <button
                        class="admin-cancel-button"
                        type="button"
                      >
                        CANCEL
                      </button>
                    `
      : ""
    }

                <button
                  class="admin-save-button"
                  type="submit"
                >
                  ${editingExercise
      ? "UPDATE EXERCISE"
      : "SAVE EXERCISE"}
                </button>

              </div>

            </form>

          </section>


          <section class="admin-library">

            <div class="admin-section-heading">

              <span>
                LIBRARY
              </span>

              <span>
                ${adminExercises.length}
                TOTAL
              </span>

            </div>


            <div class="admin-exercise-list">

              ${adminExercises.length
      ? adminExercises.map(
        (exercise) => `

                        <article
                          class="admin-exercise-card"
                        >

                          <div
                            class="admin-exercise-media"
                          >

                            ${exercise.cover_image_url
  ? `
    <img
      src="${escapeHtml(
        exercise.cover_image_url
      )}"
      alt=""
      loading="lazy"
    >
  `
            : `
                                  <span>
                                    ${escapeHtml(
              exercise.name
                .charAt(0)
            )}
                                  </span>
                                `
          }

                          </div>


                          <div
                            class="admin-exercise-info"
                          >

                            <div
                              class="admin-exercise-topline"
                            >

                              <span>
                                ${escapeHtml(
            exercise.type
          )}
                              </span>

                              <span
                                class="${exercise.isPublic
            ? "admin-status-public"
            : "admin-status-private"
          }"
                              >
                                ${exercise.isPublic
            ? "PUBLIC"
            : "HIDDEN"
          }
                              </span>

                            </div>


                            <h2>
                              ${escapeHtml(
            exercise.name
          )}
                            </h2>


                            <p>
                              ${escapeHtml(
            exercise.muscle
          )}
                              ·
                              ${escapeHtml(
            exercise.equipment
          )}
                              ·
                              ${escapeHtml(
            exercise.difficulty
          )}
                            </p>


                            <div
                              class="admin-exercise-actions"
                            >

                              <button
                                type="button"
                                data-admin-edit="${escapeHtml(
            exercise.id
          )}"
                              >
                                EDIT
                              </button>

                              <button
                                type="button"
                                data-admin-delete="${escapeHtml(
            exercise.id
          )}"
                              >
                                DELETE
                              </button>

                            </div>

                          </div>

                        </article>

                      `
      ).join("")
      : `
                    <div class="admin-empty">
                      NO EXERCISES YET.
                    </div>
                  `
    }

            </div>

          </section>

        </section>

      </main>

    </div>
  `;


  attachAdminEvents();
}


function attachAdminEvents() {

  const backButton =
    document.querySelector(
      ".profile-back-button"
    );

  backButton?.addEventListener(
    "click",
    async () => {

      adminEditingExerciseId =
        null;

      renderProfile();

    }
  );


  const form =
    document.querySelector(
      ".admin-exercise-form"
    );

  form?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      await saveAdminExercise(
        form
      );

    }
  );


  document
    .querySelector(
      ".admin-cancel-button"
    )
    ?.addEventListener(
      "click",
      () => {

        adminEditingExerciseId =
          null;

        renderAdminDashboard();

      }
    );


  document
    .querySelectorAll(
      "[data-admin-edit]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            adminEditingExerciseId =
              button.dataset.adminEdit;

            renderAdminDashboard();

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-admin-delete]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          async () => {

            await deleteAdminExercise(
              button.dataset.adminDelete
            );

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
    .querySelectorAll(".filter-chip[data-muscle]")
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
          String(card.dataset.id);

        const exercise =
          exercises.find(
            (item) =>
              String(item.id) ===
              exerciseId
          );

        if (!exercise) {
          return;
        }

        selectedExercise = exercise;

        openExerciseDetail(
          card,
          exercise
        );
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
            String(card.dataset.routineId);

          const routine =
            routines.find(
              (item) =>
                String(item.id) === routineId
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
            String(
              item.dataset.exerciseId
            );

          const exercise =
            exercises.find(
              (entry) =>
                String(entry.id) ===
                exerciseId
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
            String(
              item.dataset.exerciseId
            );

          const routineExercise =
            activeRoutine?.exercises.find(
              (exercise) =>
                String(exercise.exerciseId) ===
                exerciseId
            );

          const exercise =
            exercises.find(
              (entry) =>
                String(entry.id) ===
                exerciseId
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

  const profileAdminButton =
    document.querySelector(
      ".profile-admin-button"
    );

  profileAdminButton?.addEventListener(
    "click",
    () => {
      renderAdminDashboard();
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


// =========================================================
// EXERCISE LIBRARY — SUPABASE
// =========================================================

async function loadExercisesFromSupabase() {

  const {
    data,
    error
  } = await supabase

    .from("exercises")

    .select(`
      id,
      name,
      description,
      primary_muscle,
      secondary_muscles,
      equipment,
      difficulty,
      type,
      tags,
      instructions,
      cover_image_url,
demo_gif_url,
demo_video_url,
demo_youtube_url,
is_public,
      created_by,
      created_at,
      updated_at
    `)

    .eq(
      "is_public",
      true
    )

    .order(
      "name",
      {
        ascending: true
      }
    );


  if (error) {

    console.error(
      "Failed to load exercises from Supabase:",
      error
    );

    return;

  }


  const normalizedExercises =
    (data || []).map(
      (exercise) => ({

        id: exercise.id,

        name:
          exercise.name,

        description:
          exercise.description || "",

        muscle:
          exercise.primary_muscle,

        secondaryMuscles:
          exercise.secondary_muscles || [],

        equipment:
          exercise.equipment,

        difficulty:
          exercise.difficulty,

        type:
          exercise.type,

        tags:
          exercise.tags || [],

        instructions:
          exercise.instructions || [],

        coverImageUrl:
          exercise.cover_image_url || "",

        demoGifUrl:
          exercise.demo_gif_url || "",

        demoVideoUrl:
          exercise.demo_video_url || "",

        demoYoutubeUrl:
          exercise.demo_youtube_url || "",

        isPublic:
          exercise.is_public,

        createdBy:
          exercise.created_by,

        createdAt:
          exercise.created_at,

        updatedAt:
          exercise.updated_at

      })
    );


  exercises = normalizedExercises;

  console.log(
    "REDLINE exercises loaded:",
    exercises
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
    currentSignedInState ===
    lastSignedInState
  ) {
    return;
  }

  lastSignedInState =
    currentSignedInState;

  if (currentSignedInState) {
    initializeApp();
    return;
  }

  app.innerHTML = `
    <div id="clerk-sign-in"></div>
  `;

  clerk.mountSignIn(
    document.querySelector(
      "#clerk-sign-in"
    )
  );

});

applyMotionPreference();

await initializeApp();

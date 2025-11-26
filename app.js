// Simple LOGIN SYSTEM
const DEMO_USER = {
  email: "student@mealmap.app",
  password: "meal1234"
};

function isLoggedIn() {
  return localStorage.getItem("mm_logged_in") === "true";
}

function login(email, password) {
  if (email === DEMO_USER.email && password === DEMO_USER.password) {
    localStorage.setItem("mm_logged_in", "true");
    return true;
  }
  return false;
}

function logout() {
  localStorage.removeItem("mm_logged_in");
  location.reload();
}

function openLoginModal() {
  const overlay = document.getElementById("login-overlay");
  if (overlay) overlay.classList.remove("hidden");
}

function closeLoginModal() {
  const overlay = document.getElementById("login-overlay");
  if (overlay) overlay.classList.add("hidden");
}

function initLoginUI() {
  const icon = document.getElementById("login-icon");
  const closeBtn = document.getElementById("login-close-btn");
  const form = document.getElementById("login-form");
  const err = document.getElementById("login-error");

  // Click the padlock icon: if logged in, offer logout; if not, open login
  if (icon) {
    icon.addEventListener("click", () => {
      if (isLoggedIn()) {
        if (confirm("Log out of MealMap?")) {
          logout();
        }
      } else {
        openLoginModal();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeLoginModal);
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;

      if (login(email, password)) {
        err.textContent = "";
        closeLoginModal();
        location.reload(); // reload once logged in so the app boots cleanly
      } else {
        err.textContent = "Invalid email or password.";
      }
    });
  }
}

// On first load decide whether to show/hide the modal
window.addEventListener("DOMContentLoaded", () => {
  initLoginUI();

  if (!isLoggedIn()) {
    openLoginModal();
  } else {
    closeLoginModal(); // ensure it’s hidden for logged-in users
  }
});


// Simple global app state //

const appState = {
  recipes: [],
  recipesLoaded: false,
  selectedRecipeId: null,
  savedRecipeIds: [],
  cookingStepIndex: 0, // which step user is on in cooking mode
  planner: {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: []
  },
  mealPhotos: []
};


//  -- Data loading (recipes.json)  -- //

function loadRecipesIfNeeded() {
  // If we've already loaded recipes this session, reuse them
  if (appState.recipesLoaded && appState.recipes.length > 0) {
    return Promise.resolve(appState.recipes);
  }

  // Loading recipes from Spoonacular API (via api.js)
  return searchRecipesFromApi('', {}) // empty query = general recipes
    .then((apiRecipes) => {
      if (!apiRecipes || !Array.isArray(apiRecipes) || apiRecipes.length === 0) {
        throw new Error('No recipes returned from API');
      }

      // Normalise API results into the shape used everywhere in app.js
      const normalised = apiRecipes.map((r) => {
        // r comes from api.js: { id, title, image, vegetarian, description, ingredients, steps, calories }
        return {
          id: String(r.id),
          name: r.title || 'Recipe',
          time: 30,
          difficulty: 'Easy', // simple default label
          tags: r.vegetarian ? ['Vegetarian'] : [],

          // calories
          calories: typeof r.calories === 'number' ? r.calories : null,

          // basic placeholders – real values will be filled by getRecipeDetailsFromApi in recipe-detail
          ingredients: Array.isArray(r.ingredients) && r.ingredients.length
            ? r.ingredients.map((i) => i.name || '')
            : [],
          steps: Array.isArray(r.steps) && r.steps.length ? r.steps : []
        };
      });

      appState.recipes = normalised;
      appState.recipesLoaded = true;
      return appState.recipes;
    })
    .catch((error) => {
      console.error('Failed to load recipes from API, falling back to recipes.json:', error);

      // Fallback to old local JSON behaviour if API fails
      return fetch('data/recipes.json')
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to load recipes.json');
          }
          return response.json();
        })
        .then((data) => {
          appState.recipes = Array.isArray(data) ? data : [];
          appState.recipesLoaded = true;
          return appState.recipes;
        })
        .catch((fallbackError) => {
          console.error('Failed to load recipes from recipes.json:', fallbackError);
          appState.recipes = [];
          appState.recipesLoaded = false;

          const listEl = document.getElementById('recipe-list');
          if (listEl) {
            listEl.innerHTML = `
              <p>Unable to load recipes right now. Please check your connection or try again later.</p>
            `;
          }

          return [];
        });
    });
}


// ---------- Saved recipes (localStorage) ---------- //

function loadSavedRecipesFromStorage() {
  try {
    const raw = localStorage.getItem("savedRecipes");
    if (!raw) {
      appState.savedRecipeIds = [];
      return;
    }
    const parsed = JSON.parse(raw);
    appState.savedRecipeIds = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to read savedRecipes from localStorage", e);
    appState.savedRecipeIds = [];
  }
}

function saveSavedRecipesToStorage() {
  try {
    localStorage.setItem("savedRecipes", JSON.stringify(appState.savedRecipeIds));
  } catch (e) {
    console.error("Failed to write savedRecipes to localStorage", e);
  }
}

function isRecipeSaved(id) {
  return appState.savedRecipeIds.includes(id);
}

function toggleSavedRecipe(id) {
  if (isRecipeSaved(id)) {
    appState.savedRecipeIds = appState.savedRecipeIds.filter((savedId) => savedId !== id);
  } else {
    appState.savedRecipeIds.push(id);
  }
  saveSavedRecipesToStorage();
}


// ---------- Meal planner (localStorage) ---------- //

function loadPlannerFromStorage() {
  try {
    const raw = localStorage.getItem("plannerData");
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      appState.planner = {
        mon: parsed.mon || [],
        tue: parsed.tue || [],
        wed: parsed.wed || [],
        thu: parsed.thu || [],
        fri: parsed.fri || [],
        sat: parsed.sat || [],
        sun: parsed.sun || []
      };
    }
  } catch (e) {
    console.error("Failed to read plannerData from storage", e);
  }
}

function savePlannerToStorage() {
  try {
    localStorage.setItem("plannerData", JSON.stringify(appState.planner));
  } catch (e) {
    console.error("Failed to save plannerData", e);
  }
}

function addRecipeToPlanner(dayKey, recipeId) {
  if (!appState.planner[dayKey]) return;
  appState.planner[dayKey].push(recipeId);
  savePlannerToStorage();
}

function clearPlanner() {
  appState.planner = {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: []
  };
  savePlannerToStorage();
}

function removePlannerItem(dayKey, index) {
  const list = appState.planner[dayKey];
  if (!list) return;
  list.splice(index, 1);
  savePlannerToStorage();
}


// ---------- Gallery photos (localStorage) ---------- //

function loadMealPhotosFromStorage() {
  try {
    const raw = localStorage.getItem("mealPhotos");
    if (!raw) {
      appState.mealPhotos = [];
      return;
    }
    const parsed = JSON.parse(raw);
    appState.mealPhotos = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to read mealPhotos from storage", e);
    appState.mealPhotos = [];
  }
}

function saveMealPhotosToStorage() {
  try {
    localStorage.setItem("mealPhotos", JSON.stringify(appState.mealPhotos));
  } catch (e) {
    console.error("Failed to save mealPhotos", e);
  }
}

function addMealPhoto(dataUrl) {
  const photo = {
    id: Date.now().toString(),
    dataUrl,
    timestamp: Date.now()
  };
  appState.mealPhotos.push(photo);
  saveMealPhotosToStorage();
}

function removeMealPhoto(photoId) {
  appState.mealPhotos = appState.mealPhotos.filter((p) => p.id !== photoId);
  saveMealPhotosToStorage();
}


// ---------- Screens ---------- //

function renderHome(root) {
  root.innerHTML = `
    <section class="screen screen-home" aria-labelledby="home-heading">
      <h2 id="home-heading">Welcome to MealMap</h2>
      <p>
        Plan simple, healthy meals, save money, and avoid last-minute takeaways.
      </p>

      <div class="home-highlight">
        <h3>Quick start</h3>
        <ul>
          <li>Browse student-friendly recipes</li>
          <li>Plan meals across your week</li>
          <li>Save favourites and track your cooking</li>
        </ul>
      </div>

      <div class="home-actions">
        <button class="primary-btn" data-screen="browse">Browse Recipes</button>
        <button class="secondary-btn" data-screen="planner">Open Meal Planner</button>
      </div>
    </section>
  `;
}

function renderBrowse(root) {
  root.innerHTML = `
    <section class="screen screen-browse" aria-labelledby="browse-heading">
      <h2 id="browse-heading">Browse Recipes</h2>
      <p class="screen-intro">
        Find student-friendly meals and add them to your planner.
      </p>

      <!-- Search + Filter Controls -->
      <div class="browse-controls">
        <input
          type="text"
          id="search-input"
          placeholder="Search recipes"
        />

        <select id="filter-select">
          <option value="all">All recipes</option>
          <option value="vegetarian">Vegetarian</option>
          <option value="vegan">Vegan</option>
          <option value="quick">Quick</option>
          <option value="budget">Budget</option>
        </select>
      </div>

  
      <div id="recipe-list" aria-live="polite"></div>
    </section>
  `;

  const listEl = document.getElementById("recipe-list");
  const searchInput = document.getElementById("search-input");
  const filterSelect = document.getElementById("filter-select");

  if (!listEl) return;

  // Load recipes from recipes.json (or cached state)
  loadRecipesIfNeeded().then((recipes) => {
    if (!recipes || recipes.length === 0) {
      listEl.innerHTML = `
        <p>Unable to load recipes right now. Please check your connection or try again later.</p>
      `;
      return;
    }

    // Apply search + filter and then render cards
    function applyFiltersAndRender() {
      let filtered = recipes;

      const query = (searchInput?.value || "").toLowerCase().trim();
      const selectedFilter = filterSelect?.value || "all";

      // Text search
      if (query) {
        filtered = filtered.filter((recipe) => {
          const name = (recipe.name || "").toLowerCase();
          const difficulty = (recipe.difficulty || "").toLowerCase();
          const tagsText = Array.isArray(recipe.tags)
            ? recipe.tags.join(" ").toLowerCase()
            : "";

          return (
            name.includes(query) ||
            difficulty.includes(query) ||
            tagsText.includes(query)
          );
        });
      }

      // Tag filter (vegetarian, vegan, quick, budget)
      if (selectedFilter !== "all") {
        filtered = filtered.filter((recipe) => {
          if (!Array.isArray(recipe.tags)) return false;
          return recipe.tags
            .map((t) => t.toLowerCase())
            .includes(selectedFilter);
        });
      }

      if (!filtered.length) {
        listEl.innerHTML = `
          <p class="planner-empty">No recipes match your search or filters.</p>
        `;
        return;
      }

      // Render cards
      listEl.innerHTML = filtered
        .map((recipe) => {
          const tagsText = Array.isArray(recipe.tags)
            ? recipe.tags.join(", ")
            : "";

          return `
            <article class="recipe-card" data-recipe-id="${recipe.id}">
              <div class="recipe-card-body">
                <h3>${recipe.name}</h3>
                <p>${recipe.time} mins • ${recipe.difficulty}</p>
                ${tagsText ? `<p class="recipe-tags">${tagsText}</p>` : ""}
              </div>
            </article>
          `;
        })
        .join("");

    
      attachRecipeCardHandlers();
    }

    // Hook up search + filter events
    if (searchInput) {
      searchInput.addEventListener("input", applyFiltersAndRender);
    }
    if (filterSelect) {
      filterSelect.addEventListener("change", applyFiltersAndRender);
    }

    // Initial render
    applyFiltersAndRender();
  });
}


function renderPlanner(root) {
  const daysConfig = [
    { key: "mon", label: "Monday" },
    { key: "tue", label: "Tuesday" },
    { key: "wed", label: "Wednesday" },
    { key: "thu", label: "Thursday" },
    { key: "fri", label: "Friday" },
    { key: "sat", label: "Saturday" },
    { key: "sun", label: "Sunday" }
  ];

  root.innerHTML = `
    <section class="screen screen-planner" aria-labelledby="planner-heading">
      <h2 id="planner-heading">Meal Planner</h2>
      <p class="screen-intro">
        Your planned meals for the week. Add recipes from the recipe screen using "Add to planner".
      </p>

      <button class="secondary-btn" id="clear-planner-btn" style="margin-bottom: 0.75rem;">
        Clear planner
      </button>

      <div class="planner-grid" aria-label="Weekly meal planner" id="planner-grid">
       
      </div>

      <p class="screen-note">
        Each day can have multiple meals. You can remove individual meals or clear the whole week.
      </p>
    </section>
  `;

  const grid = document.getElementById("planner-grid");
  const clearBtn = document.getElementById("clear-planner-btn");

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const ok = confirm("Clear all planned meals for the week?");
      if (!ok) return;
      clearPlanner();
      renderPlanner(root);
    });
  }

  loadRecipesIfNeeded().then((recipes) => {
    loadPlannerFromStorage();

    const recipeById = {};
    recipes.forEach((r) => {
      recipeById[r.id] = r;
    });

    grid.innerHTML = daysConfig
      .map((day) => {
        const plannedIds = appState.planner[day.key] || [];
        let content = "";

        if (plannedIds.length === 0) {
          content = `<p class="planner-empty">No meal planned</p>`;
        } else {
          const items = plannedIds
            .map((id, index) => {
              const r = recipeById[id];
              if (!r) return "";
              return `
                <li class="planner-meal-item">
                  <span>${r.name}</span>
                  <button
                    class="planner-remove-btn"
                    data-day="${day.key}"
                    data-index="${index}"
                    aria-label="Remove ${r.name} from ${day.label}"
                  >
                    ×
                  </button>
                </li>
              `;
            })
            .join("");

          content = `
            <ul class="planner-meal-list">
              ${items}
            </ul>
          `;
        }

        return `
          <div
            class="planner-day-card"
            data-day="${day.key}"
            data-day-label="${day.label}"
            tabindex="0"
          >
            <h3>${day.label}</h3>
            ${content}
          </div>
        `;
      })
      .join("");

    // Remove button logic 
    const removeButtons = document.querySelectorAll(".planner-remove-btn");
    removeButtons.forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation(); // don't trigger the day popup
        const dayKey = btn.dataset.day;
        const indexStr = btn.dataset.index;
        if (!dayKey || indexStr === undefined) return;
        const index = parseInt(indexStr, 10);
        if (Number.isNaN(index)) return;

        const ok = confirm("Remove this meal from your planner?");
        if (!ok) return;

        removePlannerItem(dayKey, index);
        renderPlanner(root);
      });
    });

    // Day card click -> open summary popup
    const dayCards = document.querySelectorAll(".planner-day-card");
    dayCards.forEach((card) => {
      card.addEventListener("click", () => {
        const dayKey = card.dataset.day;
        const dayLabel = card.dataset.dayLabel;
        if (!dayKey) return;
        showPlannerDayPopup(dayKey, dayLabel, recipeById);
      });

      // Also open with Enter 
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const dayKey = card.dataset.day;
          const dayLabel = card.dataset.dayLabel;
          if (!dayKey) return;
          showPlannerDayPopup(dayKey, dayLabel, recipeById);
        }
      });
    });
  });
}


function showPlannerDayPopup(dayKey, dayLabel, recipeById) {
  const plannedIds = appState.planner[dayKey] || [];

  // Build list of meals + total calories
  let totalCalories = 0;
  let itemsHtml = "";

  plannedIds.forEach((id) => {
    const recipe = recipeById[id];
    if (!recipe) return;

    const cals =
      typeof recipe.calories === "number" ? recipe.calories : null;

    if (typeof cals === "number") {
      totalCalories += cals;
    }

    itemsHtml += `
      <li class="planner-popup-item">
        <span class="planner-popup-item-name">${recipe.name}</span>
        <span class="planner-popup-item-calories">
          ${cals !== null ? `${cals} kcal` : "?"}
        </span>
      </li>
    `;
  });

  const overlay = document.createElement("div");
  overlay.className = "planner-day-overlay";

  overlay.innerHTML = `
    <div class="planner-day-popup" role="dialog" aria-modal="true">
      <button
        class="planner-day-popup-close"
        aria-label="Close summary"
      >
        ×
      </button>

      <h3 class="planner-day-popup-heading">${dayLabel}</h3>

      ${
        plannedIds.length === 0
          ? `<p class="planner-empty">No meals planned.</p>`
          : `
        <ul class="planner-popup-list">
          ${itemsHtml}
        </ul>

        <p class="planner-popup-total">
          Total calories:
          <strong>${totalCalories > 0 ? totalCalories + " kcal" : "?"}</strong>
        </p>

        <p class="planner-popup-note">
          Calories are approximate and only shown where data is available.
        </p>
      `
      }
    </div>
  `;

  document.body.appendChild(overlay);

  const closeBtn = overlay.querySelector(".planner-day-popup-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => overlay.remove());
  }

  // Click outside the card closes it
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });
}


function renderSaved(root) {
  root.innerHTML = `
    <section class="screen screen-saved" aria-labelledby="saved-heading">
      <h2 id="saved-heading">My Saved Recipes</h2>
      <p class="screen-intro">
        Recipes you favourite will appear here so you can find them quickly.
      </p>

      <div id="saved-recipes-container">
        <p>Loading saved recipes...</p>
      </div>
    </section>
  `;

  const container = document.getElementById("saved-recipes-container");

  loadRecipesIfNeeded().then((recipes) => {
    loadSavedRecipesFromStorage();
    const savedIds = appState.savedRecipeIds;

    if (!savedIds || savedIds.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>You don't have any saved recipes yet.</p>
          <button class="primary-btn" data-screen="browse">Browse recipes to save</button>
        </div>
      `;
      attachInternalNavHandlers();
      return;
    }

    const savedRecipes = recipes.filter((r) => savedIds.includes(r.id));

    if (savedRecipes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Your saved list is empty or could not be loaded.</p>
          <button class="primary-btn" data-screen="browse">Browse recipes</button>
        </div>
      `;
      attachInternalNavHandlers();
      return;
    }

    container.innerHTML = `
      <div id="saved-recipes-list">
        ${savedRecipes
          .map((recipe) => {
            const tagsText = Array.isArray(recipe.tags) ? recipe.tags.join(", ") : "";
            return `
              <article class="recipe-card" data-recipe-id="${recipe.id}">
                <div class="recipe-card-body">
                  <h3>${recipe.name}</h3>
                  <p>${recipe.time} mins • ${recipe.difficulty}</p>
                  ${tagsText ? `<p class="recipe-tags">${tagsText}</p>` : ""}
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;

    attachRecipeCardHandlers();
  });
}

function renderGallery(root) {
  root.innerHTML = `
    <section class="screen screen-gallery" aria-labelledby="gallery-heading">
      <h2 id="gallery-heading">My Gallery</h2>
      <p class="screen-intro">
        Save photos of your finished meals. These stay on your device only.
      </p>

      <div class="gallery-actions">
        <button class="gallery-upload-btn" id="gallery-take-photo-btn">
          Take photo
        </button>
        <button class="gallery-upload-btn" id="gallery-upload-device-btn">
          Upload from device
        </button>
      </div>

      <!-- Hidden inputs: one forces camera, one opens file picker -->
      <input
        type="file"
        accept="image/*"
        capture="environment"
        id="photo-take-input"
        style="display: none;"
      />
      <input
        type="file"
        accept="image/*"
        id="photo-upload-input"
        style="display: none;"
      />

      <div class="gallery-grid" id="gallery-grid">
        
      </div>

      <p class="screen-note">
        Photos are stored locally in your browser using localStorage and are not uploaded anywhere.
      </p>
    </section>
  `;

  // Load any existing photos and render them
  loadMealPhotosFromStorage();
  renderGalleryGrid();

  const takePhotoBtn = document.getElementById("gallery-take-photo-btn");
  const uploadDeviceBtn = document.getElementById("gallery-upload-device-btn");
  const takeInput = document.getElementById("photo-take-input");
  const uploadInput = document.getElementById("photo-upload-input");

  // Shared handler for reading a selected file and saving it
  function handleFileInputChange(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const dataUrl = e.target.result;
      addMealPhoto(dataUrl);
      renderGalleryGrid();
    };
    reader.readAsDataURL(file);

    // Allow picking the same file again later if needed
    event.target.value = "";
  }

  if (takePhotoBtn && takeInput) {
    takePhotoBtn.addEventListener("click", () => {
      takeInput.click(); // opens camera on supported mobile browsers
    });
    takeInput.addEventListener("change", handleFileInputChange);
  }

  if (uploadDeviceBtn && uploadInput) {
    uploadDeviceBtn.addEventListener("click", () => {
      uploadInput.click(); //  opens gallery/file picker
    });
    uploadInput.addEventListener("change", handleFileInputChange);
  }
}


function renderGalleryGrid() {
  const grid = document.getElementById("gallery-grid");
  if (!grid) return;

  if (!appState.mealPhotos || appState.mealPhotos.length === 0) {
    grid.innerHTML = `<p class="planner-empty">No photos yet. Add one above!</p>`;
    return;
  }

  grid.innerHTML = appState.mealPhotos
    .map(
      (photo) => `
      <div class="gallery-item">
        <img
          src="${photo.dataUrl}"
          alt="Meal photo"
          class="gallery-photo"
        />
        <button
          class="gallery-delete-btn"
          data-photo-id="${photo.id}"
          aria-label="Delete meal photo"
        >
          ✕
        </button>
      </div>
    `
    )
    .join("");

  attachGalleryDeleteHandlers();
}

// Load full details (ingredients + steps) for a recipe if needed
function ensureRecipeDetailsLoaded(recipeId) {
  const idString = String(recipeId);

  let recipe = appState.recipes.find((r) => String(r.id) === idString);

  if (!recipe) {
    // If for some reason it's not in the list, just fetch from API and create it
    return getRecipeDetailsFromApi(idString).then((full) => {
      const detailedRecipe = {
        id: String(full.id),
        name: full.title || 'Recipe',
        time: 30,
        difficulty: 'Easy',
        tags: full.vegetarian ? ['Vegetarian'] : [],
        calories: typeof full.calories === 'number' ? full.calories : null,
        ingredients: Array.isArray(full.ingredients)
          ? full.ingredients.map((i) => i.name || `${i.amount || ''} ${i.unit || ''}`.trim())
          : [],
        steps: Array.isArray(full.steps) ? full.steps : []
      };

      appState.recipes.push(detailedRecipe);
      return detailedRecipe;
    });
  }

  const hasIngredients = Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0;
  const hasSteps = Array.isArray(recipe.steps) && recipe.steps.length > 0;

  if (hasIngredients && hasSteps) {
    // Already detailed
    return Promise.resolve(recipe);
  }

  // Need to fetch and merge details
  return getRecipeDetailsFromApi(idString).then((full) => {
    const updated = {
      ...recipe,
      name: full.title || recipe.name,
      calories:
        typeof full.calories === 'number'
          ? full.calories
          : recipe.calories ?? null,
      ingredients: Array.isArray(full.ingredients) && full.ingredients.length
        ? full.ingredients.map((i) => i.name || `${i.amount || ''} ${i.unit || ''}`.trim())
        : recipe.ingredients || [],
      steps: Array.isArray(full.steps) && full.steps.length
        ? full.steps
        : recipe.steps || []
    };

    const idx = appState.recipes.findIndex((r) => String(r.id) === idString);
    if (idx !== -1) {
      appState.recipes[idx] = updated;
    }

    return updated;
  });
}

function renderRecipeDetail(root) {
  if (!appState.selectedRecipeId) {
    root.innerHTML = `
      <section class="screen screen-recipe-detail">
        <p>No recipe selected.</p>
        <button class="secondary-btn" data-screen="browse">Back to recipes</button>
      </section>
    `;
    attachInternalNavHandlers();
    return;
  }

  const id = appState.selectedRecipeId;

  // Show loading state first
  root.innerHTML = `
    <section class="screen screen-recipe-detail">
      <p>Loading recipe details...</p>
      <button class="secondary-btn" data-screen="browse" style="margin-top: 0.75rem;">← Back to recipes</button>
    </section>
  `;
  attachInternalNavHandlers();

  // Fetch full details from API if needed
  ensureRecipeDetailsLoaded(id)
    .then((recipe) => {
      renderRecipeDetailContent(root, recipe);
    })
    .catch((error) => {
      console.error('Failed to load recipe details', error);
      root.innerHTML = `
        <section class="screen screen-recipe-detail">
          <p>Sorry, we couldn't load this recipe right now.</p>
          <button class="secondary-btn" data-screen="browse">Back to recipes</button>
        </section>
      `;
      attachInternalNavHandlers();
    });
}


function renderRecipeDetailContent(root, recipe) {
  if (!recipe) {
    root.innerHTML = `
      <section class="screen screen-recipe-detail">
        <p>Recipe not found.</p>
        <button class="secondary-btn" data-screen="browse">Back to recipes</button>
      </section>
    `;
    attachInternalNavHandlers();
    return;
  }

  const tagsText = Array.isArray(recipe.tags) ? recipe.tags.join(', ') : '';
  const saved = isRecipeSaved(recipe.id);

  root.innerHTML = `
    <section class="screen screen-recipe-detail" aria-labelledby="recipe-heading">
      <button class="secondary-btn" data-screen="browse" style="margin-bottom: 0.75rem;">← Back to recipes</button>

      <h2 id="recipe-heading">${recipe.name}</h2>
      <p class="screen-intro">
        ${recipe.time ?? '?'} mins • ${recipe.difficulty ?? 'Easy'}${tagsText ? ' • ' + tagsText : ''}
      </p>

      <div class="recipe-meta">
        <div class="meta-chip">
          <span>Calories</span>
          <strong>${recipe.calories ?? '?'}</strong>
        </div>
      </div>

      <div class="recipe-actions">
        <button class="primary-btn" id="start-cooking-btn">Start cooking</button>
        <button class="secondary-btn" id="save-recipe-btn">
          ${saved ? 'Unsave recipe' : 'Save recipe'}
        </button>

        <div class="planner-action-row">
          <select id="planner-day-select" class="select-input">
            <option value="">Choose day…</option>
            <option value="mon">Monday</option>
            <option value="tue">Tuesday</option>
            <option value="wed">Wednesday</option>
            <option value="thu">Thursday</option>
            <option value="fri">Friday</option>
            <option value="sat">Saturday</option>
            <option value="sun">Sunday</option>
          </select>
          <button class="secondary-btn" id="add-to-planner-btn">Add to planner</button>
        </div>
      </div>

      <section class="recipe-section">
        <h3>Ingredients</h3>
        <ul class="ingredients-list">
          ${
            Array.isArray(recipe.ingredients) && recipe.ingredients.length
              ? recipe.ingredients.map((item) => `<li>${item}</li>`).join('')
              : '<li>No ingredients available.</li>'
          }
        </ul>
      </section>

      <section class="recipe-section">
        <h3>Steps</h3>
        <ol class="steps-list">
          ${
            Array.isArray(recipe.steps) && recipe.steps.length
              ? recipe.steps.map((step) => `<li>${step}</li>`).join('')
              : '<li>No steps available.</li>'
          }
        </ol>
      </section>
    </section>
  `;

  attachInternalNavHandlers();

  const saveBtn = document.getElementById('save-recipe-btn');
  const cookBtn = document.getElementById('start-cooking-btn');
  const plannerBtn = document.getElementById('add-to-planner-btn');
  const daySelect = document.getElementById('planner-day-select');

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      toggleSavedRecipe(recipe.id);
      const nowSaved = isRecipeSaved(recipe.id);
      saveBtn.textContent = nowSaved ? 'Unsave recipe' : 'Save recipe';
    });
  }

  if (cookBtn) {
    cookBtn.addEventListener('click', () => {
      appState.cookingStepIndex = 0;
      renderScreen('cooking');
    });
  }

  if (plannerBtn && daySelect) {
    plannerBtn.addEventListener('click', () => {
      const dayKey = daySelect.value;
      if (!dayKey) {
        alert('Please choose a day first.');
        return;
      }
      addRecipeToPlanner(dayKey, recipe.id);
      alert(`Added to ${daySelect.options[daySelect.selectedIndex].text}`);
    });
  }
}



function renderCooking(root) {
  if (!appState.selectedRecipeId) {
    root.innerHTML = `
      <section class="screen screen-cooking">
        <p>No recipe selected for cooking.</p>
        <button class="secondary-btn" data-screen="browse">Back to recipes</button>
      </section>
    `;
    return;
  }

  const recipe = appState.recipes.find((r) => r.id === appState.selectedRecipeId);
  if (!recipe || !Array.isArray(recipe.steps) || recipe.steps.length === 0) {
    root.innerHTML = `
      <section class="screen screen-cooking">
        <p>This recipe has no steps defined.</p>
        <button class="secondary-btn" data-screen="recipe-detail">Back to recipe</button>
      </section>
    `;
    return;
  }

  const totalSteps = recipe.steps.length;
  let index = appState.cookingStepIndex;

  if (index < 0) index = 0;
  if (index > totalSteps - 1) index = totalSteps - 1;
  appState.cookingStepIndex = index;

  const stepNumber = index + 1;
  const isFirst = index === 0;
  const isLast = index === totalSteps - 1;

  root.innerHTML = `
    <section class="screen screen-cooking" aria-labelledby="cooking-heading">
      <button class="secondary-btn" data-screen="recipe-detail" style="margin-bottom: 0.75rem;">
        ← Back to recipe
      </button>

      <h2 id="cooking-heading">Cooking: ${recipe.name}</h2>

      <p class="screen-intro">
        Step ${stepNumber} of ${totalSteps}
      </p>

      <div class="cooking-step-box">
        <p class="cooking-step-text">
          ${recipe.steps[index]}
        </p>
      </div>

      <div class="cooking-step-controls">
        <button class="secondary-btn" id="prev-step-btn" ${isFirst ? "disabled" : ""}>
          Previous
        </button>
        <button class="primary-btn" id="next-step-btn" ${isLast ? "disabled" : ""}>
          ${isLast ? "Done" : "Next step"}
        </button>
      </div>
    </section>
  `;

  attachInternalNavHandlers();

  const prevBtn = document.getElementById("prev-step-btn");
  const nextBtn = document.getElementById("next-step-btn");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (!isFirst) {
        appState.cookingStepIndex -= 1;
        renderScreen("cooking");
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (!isLast) {
        appState.cookingStepIndex += 1;
        renderScreen("cooking");
      } else {
        appState.cookingStepIndex = 0;
        const rootEl = document.getElementById("app-root");
        if (rootEl) rootEl.innerHTML = "";
        setTimeout(() => {
          renderScreen("recipe-detail");
        }, 10);
      }
    });
  }
}


// ---------- Router & navigation ---------- //

function renderScreen(screenName) {
  const root = document.getElementById("app-root");
  if (!root) return;

  switch (screenName) {
    case "home":
      renderHome(root);
      break;
    case "browse":
      renderBrowse(root);
      break;
    case "planner":
      renderPlanner(root);
      break;
    case "saved":
      renderSaved(root);
      break;
    case "gallery":
      renderGallery(root);
      break;
    case "recipe-detail":
      renderRecipeDetail(root);
      break;
    case "cooking":
      renderCooking(root);
      break;
    default:
      renderHome(root);
      screenName = "home";
      break;
  }

  attachInternalNavHandlers();
  setActiveNav(screenName);
}

function setActiveNav(screenName) {
  const navButtons = document.querySelectorAll("#bottom-nav .nav-btn");
  navButtons.forEach((btn) => {
    if (btn.dataset.screen === screenName) {
      btn.classList.add("active");
      btn.setAttribute("aria-current", "page");
    } else {
      btn.classList.remove("active");
      btn.removeAttribute("aria-current");
    }
  });
}

function initNav() {
  const navButtons = document.querySelectorAll("#bottom-nav .nav-btn");

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const screen = btn.dataset.screen;
      renderScreen(screen);
    });
  });
}

function attachInternalNavHandlers() {
  const internalButtons = document.querySelectorAll("main [data-screen]");
  internalButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const screen = btn.dataset.screen;
      renderScreen(screen);
    });
  });
}

function attachRecipeCardHandlers() {
  const cards = document.querySelectorAll(".recipe-card[data-recipe-id]");

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.recipeId;
      appState.selectedRecipeId = id;
      renderScreen("recipe-detail");
    });
  });
}

function attachGalleryDeleteHandlers() {
  const buttons = document.querySelectorAll(".gallery-delete-btn[data-photo-id]");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.photoId;
      if (!id) return;
      if (confirm("Delete this photo from your gallery?")) {
        removeMealPhoto(id);
        renderGalleryGrid();
      }
    });
  });
}


// ---------- Service worker ---------- //

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("service-worker.js")
        .then(() => {
          console.log("Service Worker registered");
        })
        .catch((err) => {
          console.error("Service Worker registration failed:", err);
        });
    });
  }
}


// ---------- Initialise app ---------- //

(function init() {
  // Don’t start the app if the user isn’t logged in yet
  if (!isLoggedIn()) return;

  loadSavedRecipesFromStorage();
  loadPlannerFromStorage();
  loadMealPhotosFromStorage();
  initNav();
  renderScreen("home");
  registerServiceWorker();
})();


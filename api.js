// api.js
const API_KEY = 'a3e070c9382d404a8c8a72e15c143e8c';
const API_BASE = 'https://api.spoonacular.com';

async function searchRecipesFromApi(query, filters = {}) {
  // Build query params
  const params = new URLSearchParams({
    apiKey: API_KEY,
    query: query || '',          // text the user typed
    addRecipeInformation: 'true',
    number: 20                   // how many results
  });

  // Optional filters – adapt to your app
  if (filters.vegetarian) {
    params.append('diet', 'vegetarian');
  }
  if (filters.maxReadyTime) {
    params.append('maxReadyTime', filters.maxReadyTime);
  }

  const url = `${API_BASE}/recipes/complexSearch?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('API request failed: ' + response.status);
  }

  const data = await response.json();

  // Map the API response to your existing recipe shape
  const recipes = (data.results || []).map(r => ({
    id: r.id,
    title: r.title,
    image: r.image,
    // Spoonacular has a vegetarian flag and some diet info
    vegetarian: r.vegetarian || (r.diets || []).includes('vegetarian'),
    // Spoonacular may include summary/credits etc
    description: r.summary ? stripHtml(r.summary) : '',
    // We’ll fill ingredients/steps with another API call (see below)
    ingredients: [],
    steps: [],
    // simple nutrition example – adapt if you use full nutrition endpoint
    calories: r.nutrition?.nutrients?.find(n => n.name === 'Calories')?.amount || null
  }));

  return recipes;
}

// For a "recipe details" page
async function getRecipeDetailsFromApi(recipeId) {
  const params = new URLSearchParams({
    apiKey: API_KEY,
    includeNutrition: 'true'
  });

  const url = `${API_BASE}/recipes/${recipeId}/information?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('API request failed: ' + response.status);
  }

  const r = await response.json();

  return {
    id: r.id,
    title: r.title,
    image: r.image,
    vegetarian: r.vegetarian || (r.diets || []).includes('vegetarian'),
    description: r.summary ? stripHtml(r.summary) : '',
    ingredients: (r.extendedIngredients || []).map(i => ({
      name: i.original || i.name,
      amount: i.amount,
      unit: i.unit
    })),
    steps:
      r.analyzedInstructions?.[0]?.steps?.map(step => step.step) || [],
    calories:
      r.nutrition?.nutrients?.find(n => n.name === 'Calories')?.amount ||
      null
  };
}

// Helper to remove HTML tags from API summary text
function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}


const recipeForm = document.getElementById("recipe-form");
const recipeResult = document.getElementById("recipe-result");

function parseRecipeText(aiText, ingredients) {
  const lines = aiText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const recipeName = lines[0] || "Fridge Hero Special";
  const steps = lines
    .filter((line) => /^\d+[\).\s-]/.test(line))
    .map((line) => line.replace(/^\d+[\).\s-]*/, ""))
    .slice(0, 6);

  return {
    name: recipeName.replace(/^Recipe Name:\s*/i, ""),
    description:
      lines[1] && !/^\d+[\).\s-]/.test(lines[1])
        ? lines[1]
        : `A quick recipe made using ${ingredients.join(", ")}.`,
    steps:
      steps.length > 0
        ? steps
        : [
            `Prep and chop ${ingredients.join(", ")} into bite-size pieces.`,
            "Heat a pan with 1 tablespoon oil on medium flame.",
            "Cook the ingredients in stages until soft and flavorful.",
            "Season with salt, pepper, and herbs to taste.",
            "Serve hot and enjoy your homemade dish.",
          ],
  };
}

function buildFallbackRecipe(ingredients) {
  const [one, two, three] = ingredients;
  return {
    name: `${one} ${two} ${three} Skillet`,
    description: `Quick fallback recipe using ${one}, ${two}, and ${three}.`,
    steps: [
      `Wash and cut ${one}, ${two}, and ${three} into small pieces.`,
      `Heat 1 tablespoon oil in a pan and saute ${two} for 2 minutes.`,
      `Add ${one} and cook until slightly soft.`,
      `Mix in ${three}, then season with salt, pepper, and chili flakes.`,
      "Cook 3-4 more minutes, garnish, and serve hot.",
    ],
  };
}

async function generateRecipeWithGemini(ingredients) {
  if (window.location.protocol === "file:") {
    throw new Error("Please open the app from http://localhost:3000 (not file://).");
  }

  const response = await fetch("/api/recipe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ingredients }),
  });

  if (!response.ok) {
    let message = `Recipe API failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData?.error) {
        message = errorData.error;
      }
    } catch (parseError) {
      console.error("Could not parse API error response", parseError);
    }
    throw new Error(message);
  }

  const data = await response.json();
  const aiText =
    data?.recipeText ||
    "Fridge Hero Special\nA tasty dish.\n1. Prep ingredients.\n2. Cook.\n3. Season.\n4. Serve.";

  return parseRecipeText(aiText, ingredients);
}

function renderRecipe(recipe, ingredients) {
  recipeResult.innerHTML = `
    <h2>${recipe.name}</h2>
    <p>${recipe.description}</p>
    <p><strong>Ingredients:</strong> ${ingredients.join(", ")}</p>
    <ol>
      ${recipe.steps.map((step) => `<li>${step}</li>`).join("")}
    </ol>
  `;
}

recipeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(recipeForm);
  const ingredients = [
    formData.get("ingredient1"),
    formData.get("ingredient2"),
    formData.get("ingredient3"),
  ]
    .map((item) => item.trim())
    .filter(Boolean);

  if (ingredients.length !== 3) {
    recipeResult.innerHTML = "<p class='hint'>Please enter all 3 ingredients.</p>";
    return;
  }

  recipeResult.innerHTML = "<p class='hint'>Cooking magic... generating your AI recipe.</p>";

  try {
    const recipe = await generateRecipeWithGemini(ingredients);
    renderRecipe(recipe, ingredients);
  } catch (error) {
    const fallbackRecipe = buildFallbackRecipe(ingredients);
    renderRecipe(fallbackRecipe, ingredients);
    recipeResult.insertAdjacentHTML(
      "afterbegin",
      `<p class='hint'>AI was unavailable (${error.message}). Showing a local recipe instead.</p>`,
    );
    console.error(error);
  }
});

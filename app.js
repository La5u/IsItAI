const image = document.querySelector("#quiz-image");
const markers = document.querySelector("#markers");
const status = document.querySelector("#status");
const progress = document.querySelector("#progress");
const aiButton = document.querySelector("#ai-button");
const realButton = document.querySelector("#real-button");
const nextButton = document.querySelector("#next-button");
const settingsButton = document.querySelector("#settings-button");
const settingsPanel = document.querySelector("#settings");
const skipCorrectInput = document.querySelector("#skip-correct");
const hideSignsInput = document.querySelector("#hide-signs");
const changeModeButton = document.querySelector("#change-mode");
const modeSelect = document.querySelector("#mode-select");
const imageStage = document.querySelector("#image-stage");
const modeButtons = document.querySelectorAll("[data-mode]");

let items = [];
let current = 0;
let score = 0;
let answered = false;
let finished = false;
let lastGuessCorrect = false;
let allItems = [];
let mode = null;

const preferences = {
  skipCorrect: localStorage.getItem("skipCorrect") === "true",
  hideSigns: localStorage.getItem("hideSigns") === "true"
};

skipCorrectInput.checked = preferences.skipCorrect;
hideSignsInput.checked = preferences.hideSigns;

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function showImage() {
  const item = items[current];
  answered = false;
  document.body.classList.remove("correct", "wrong");
  markers.replaceChildren();
  nextButton.hidden = true;
  aiButton.hidden = false;
  realButton.hidden = false;
  status.textContent = "AI or real?";
  progress.textContent = `${current + 1} / ${items.length}`;
  image.src = item.image;
  image.alt = item.alt || "A scene containing people";
}

function toggleMarker(index) {
  const selected = markers.children[index];
  if (!selected) return;

  const shouldOpen = !selected.classList.contains("open");
  [...markers.children].forEach((marker) => marker.classList.remove("open"));
  if (shouldOpen) selected.classList.add("open");
}

function addMarkers(signs) {
  signs.forEach((sign, index) => {
    const marker = document.createElement("button");
    const number = document.createElement("span");
    const tooltip = document.createElement("span");

    marker.className = "marker";
    marker.type = "button";
    marker.style.left = `${sign.x}%`;
    marker.style.top = `${sign.y}%`;
    marker.setAttribute("aria-label", `Sign ${index + 1}: ${sign.text}`);
    if (sign.x < 25) marker.classList.add("left-edge");
    if (sign.x > 75) marker.classList.add("right-edge");
    if (sign.y < 30) marker.classList.add("top-edge");

    number.className = "marker-number";
    number.textContent = index + 1;
    number.setAttribute("aria-hidden", "true");
    tooltip.className = "tooltip";
    tooltip.textContent = sign.text;
    tooltip.setAttribute("role", "tooltip");

    marker.append(number, tooltip);
    marker.addEventListener("click", () => toggleMarker(index));
    markers.append(marker);
  });
}

function refreshMarkers() {
  markers.replaceChildren();
  if (!answered || finished || preferences.hideSigns || !items[current].ai) return;
  addMarkers(items[current].signs || []);
}

function guess(guessedAI) {
  if (answered || finished) return;

  answered = true;
  const item = items[current];
  const correct = guessedAI === item.ai;
  lastGuessCorrect = correct;
  if (correct) score++;

  document.body.classList.add(correct ? "correct" : "wrong");

  if (correct && preferences.skipCorrect) {
    window.setTimeout(next, 250);
    return;
  }

  aiButton.hidden = true;
  realButton.hidden = true;
  nextButton.hidden = false;
  nextButton.textContent = "Space to continue";

  status.textContent = item.ai
    ? `AI-generated — ${item.generator || "unknown generator"}`
    : "Real photograph";

  refreshMarkers();
}

function next() {
  if (!answered) return;
  if (finished) {
    location.reload();
    return;
  }

  current++;
  if (current < items.length) {
    showImage();
    return;
  }

  finished = true;
  document.body.classList.remove("correct", "wrong");
  markers.replaceChildren();
  status.textContent = `Score: ${score} / ${items.length}`;
  progress.textContent = "";
  nextButton.textContent = "Space to play again";
}

function chooseMode(selectedMode) {
  mode = selectedMode;
  items = shuffle(allItems.filter((item) => item.difficulty === mode));
  current = 0;
  score = 0;
  answered = false;
  finished = false;
  modeSelect.hidden = true;
  imageStage.hidden = false;
  showImage();
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => chooseMode(button.dataset.mode));
});

changeModeButton.addEventListener("click", () => {
  settingsPanel.hidden = true;
  imageStage.hidden = true;
  modeSelect.hidden = false;
});

aiButton.addEventListener("click", () => guess(true));
realButton.addEventListener("click", () => guess(false));
nextButton.addEventListener("click", next);

settingsButton.addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsButton.setAttribute("aria-expanded", String(!settingsPanel.hidden));
});

skipCorrectInput.addEventListener("change", () => {
  preferences.skipCorrect = skipCorrectInput.checked;
  localStorage.setItem("skipCorrect", preferences.skipCorrect);
  refreshMarkers();
});

hideSignsInput.addEventListener("change", () => {
  preferences.hideSigns = hideSignsInput.checked;
  localStorage.setItem("hideSigns", preferences.hideSigns);
  refreshMarkers();
});

document.addEventListener("click", (event) => {
  if (!settingsPanel.hidden && !settingsPanel.contains(event.target) && event.target !== settingsButton) {
    settingsPanel.hidden = true;
    settingsButton.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsPanel.hidden) {
    settingsPanel.hidden = true;
    settingsButton.setAttribute("aria-expanded", "false");
    settingsButton.focus();
    return;
  }
  if (event.target.matches("input, #settings-button")) return;
  if (!answered && event.key === "ArrowLeft") guess(true);
  if (!answered && event.key === "ArrowRight") guess(false);

  if (answered && /^[1-4]$/.test(event.key)) {
    event.preventDefault();
    toggleMarker(Number(event.key) - 1);
  }

  if (answered && event.key === " ") {
    event.preventDefault();
    next();
  }
});

fetch("data/images.json")
  .then((response) => {
    if (!response.ok) throw new Error("Could not load image data");
    return response.json();
  })
  .then((data) => {
    allItems = data;
    modeSelect.hidden = false;
    status.textContent = "Choose a mode";
  })
  .catch(() => {
    status.textContent = "Could not load the quiz. Run it through a local web server.";
  });

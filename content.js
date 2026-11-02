let alreadySent = false;
let submissionStarted = false;
let previousResultText = "";
let resultChanged = false;

// Detect a LeetCode submission action
document.addEventListener("click", (e) => {
  const target = e.target;
  const submitButton = target?.closest("button");

  if (
    submitButton &&
    submitButton.innerText.trim().toLowerCase().includes("submit")
  ) {
    submissionStarted = true;
    alreadySent = false;
    resultChanged = false;

    // Store the previous submission result
    const resultElement = document.querySelector(
      '[data-e2e-locator="submission-result"]'
    );

    previousResultText = resultElement?.innerText.trim() || "";
  }
});

// Find the current problem title
function getProblemTitle() {
  const titleElement = document.querySelector('[data-cy="question-title"]');

  if (titleElement?.innerText.trim()) {
    return titleElement.innerText.trim();
  }

  // Get the title from the page title
  const pageTitle = document.title.split(" - LeetCode")[0].trim();

  if (pageTitle) {
    return pageTitle;
  }

  // Use the problem slug if the title is unavailable
  const slug = window.location.pathname.split("/")[2];

  return slug ? slug.replace(/-/g, " ") : "Unknown Problem";
}

// Send the Accepted problem to the extension background
function trackAcceptedSubmission() {
  if (!submissionStarted || alreadySent) return;

  const resultElement = document.querySelector(
    '[data-e2e-locator="submission-result"]'
  );

  if (!resultElement) return;

  const resultText = resultElement.innerText.trim();

  // Wait until the submission result changes
  if (resultText !== previousResultText) {
    resultChanged = true;
  }

  // Ignore the previous submission result
  if (!resultChanged) return;

  // Track only Accepted submissions
  if (!resultText.includes("Accepted")) return;

  alreadySent = true;
  submissionStarted = false;

  const problemSlug = window.location.pathname.split("/")[2];
  if (!problemSlug) return;

  const url = `https://leetcode.com/problems/${problemSlug}/`;

  // Send the Accepted submission to the background script
  try {
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({
        type: "PROBLEM_SOLVED",
        title: getProblemTitle(),
        url
      });
    }
  } catch (error) {
    console.error("LeetRepeat: Failed to track submission.", error);
  }
}

// Watch for LeetCode's dynamically updated submission result
const observer = new MutationObserver(trackAcceptedSubmission);

if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

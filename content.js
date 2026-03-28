console.log("LeetRepeat content script loaded");

let alreadySent = false;
let submissionStarted = false;

// Detect Submit click
document.addEventListener("click", (e) => {
  const target = e.target;

  if (target && target.innerText && target.innerText.includes("Submit")) {
    console.log("Submission started...");
    submissionStarted = true;
    alreadySent = false;
  }
});

// Observe DOM changes AFTER submission
const observer = new MutationObserver(() => {
  if (!submissionStarted || alreadySent) return;

  const acceptedElement = document.querySelector(
    '[data-e2e-locator="submission-result"]'
  );

  if (acceptedElement && acceptedElement.innerText.includes("Accepted")) {
    alreadySent = true;
    submissionStarted = false;

    let title = "Unknown Problem";

    const titleElement =
      document.querySelector('[data-cy="question-title"]') ||
      document.querySelector('div[data-track-load="description_content"] h1') ||
      document.querySelector("h1");

    if (titleElement) {
      title = titleElement.innerText;
    }

    // fallback
    if (title === "Unknown Problem") {
      const slug = window.location.pathname.split("/")[2];
      title = slug.replace(/-/g, " ");
    }

    const problemSlug = window.location.pathname.split("/")[2];
    const url = `https://leetcode.com/problems/${problemSlug}/`;

    console.log("Accepted detected:", title);

    try {
        chrome.runtime.sendMessage({
          type: "PROBLEM_SOLVED",
          title,
          url
        });
      } catch (err) {
        console.warn("Extension context invalidated. Reload page.");
      }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
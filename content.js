let alreadySent = false;
let submissionStarted = false;

// Detect submit click
document.addEventListener("click", (e) => {
  const target = e.target;

  if (target && target.innerText && target.innerText.includes("Submit")) {
    submissionStarted = true;
    alreadySent = false;
  }
});

// Observe submission result
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
      document.querySelector("h1");

    if (titleElement) {
      title = titleElement.innerText;
    }

    if (title === "Unknown Problem") {
      const slug = window.location.pathname.split("/")[2];
      title = slug.replace(/-/g, " ");
    }

    const problemSlug = window.location.pathname.split("/")[2];
    const url = `https://leetcode.com/problems/${problemSlug}/`;

    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({
        type: "PROBLEM_SOLVED",
        title,
        url
      });
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
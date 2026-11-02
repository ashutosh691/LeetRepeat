const problemList = document.getElementById("problemList");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");

let problems = {};

// Get the number of full days since a problem was solved
function getDaysPassed(prob) {
  return Math.floor((Date.now() - prob.solvedAt) / (1000 * 60 * 60 * 24));
}

// Get the next revision that has not been completed
function getNextRevision(prob) {
  return prob.revisions.find((day) => !prob.completedRevisions.includes(day));
}

// Determine the current revision status
function getStatus(prob) {
  const nextRevision = getNextRevision(prob);

  if (nextRevision === undefined) return "completed";

  const daysPassed = getDaysPassed(prob);

  if (daysPassed === nextRevision) return "due";
  if (daysPassed > nextRevision) return "overdue";

  return "upcoming";
}

// Get a readable status label
function getStatusText(prob) {
  const nextRevision = getNextRevision(prob);

  if (nextRevision === undefined) return "ALL REVISIONS DONE";

  const daysPassed = getDaysPassed(prob);

  if (daysPassed === nextRevision) return "DUE TODAY";
  if (daysPassed > nextRevision) return `${daysPassed - nextRevision}D OVERDUE`;

  return `IN ${nextRevision - daysPassed} DAYS`;
}

// Save a revision and refresh the dashboard
function markAsRevised(problemId, prob, reviseBtn) {
  const nextRevision = getNextRevision(prob);

  if (nextRevision === undefined) return;

  // Prevent completing a revision before its scheduled date
  if (getStatus(prob) === "upcoming") return;

  // Prevent multiple clicks while saving
  reviseBtn.disabled = true;

  // Create a separate copy before updating the revision
  const updatedProblem = {
    ...prob,
    completedRevisions: [...prob.completedRevisions, nextRevision]
  };

  chrome.storage.local.set({ [problemId]: updatedProblem }, () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);

      // Allow the user to retry if saving fails
      reviseBtn.disabled = false;
      return;
    }

    // Update the local problem data after saving
    problems[problemId] = updatedProblem;

    // Clear the reminder for the completed revision
    chrome.alarms.clear(`${problemId}_${nextRevision}`);

    loadProblems();
  });
}

// Remove a problem from revision tracking
function removeProblem(problemId) {
  const shouldRemove = confirm("Remove this problem from LeetRepeat?");

  if (!shouldRemove) return;

  chrome.storage.local.remove(problemId, () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }

    // Clear all reminders associated with this problem
    chrome.alarms.getAll((alarms) => {
      alarms.forEach((alarm) => {
        if (alarm.name.startsWith(`${problemId}_`)) {
          chrome.alarms.clear(alarm.name);
        }
      });

      loadProblems();
    });
  });
}

// Create a dashboard card for a problem
function createCard(problemId, prob) {
  const card = document.createElement("article");
  card.className = "problem";

  const top = document.createElement("div");
  top.className = "problem-top";

  const details = document.createElement("div");

  const title = document.createElement("h3");
  title.className = "problem-title";
  title.textContent = prob.title || problemId;

  const meta = document.createElement("div");
  meta.className = "problem-meta";
  meta.textContent = `Solved ${new Date(prob.solvedAt).toLocaleDateString()}`;

  details.appendChild(title);
  details.appendChild(meta);

  const status = document.createElement("span");
  status.className = `status ${getStatus(prob)}`;
  status.textContent = getStatusText(prob);

  top.appendChild(details);
  top.appendChild(status);

  // Calculate progress using valid completed revisions
  const totalRevisions = prob.revisions.length;

  const completedRevisions = prob.revisions.filter((day) =>
    prob.completedRevisions.includes(day)
  ).length;

  const progress = totalRevisions === 0
    ? 100
    : Math.round((completedRevisions / totalRevisions) * 100);

  const progressTrack = document.createElement("div");
  progressTrack.className = "progress-track";

  const progressBar = document.createElement("div");
  progressBar.className = "progress-bar";
  progressBar.style.width = `${progress}%`;

  if (progress === 100) {
    progressBar.style.background = "#15803d";
  }

  progressTrack.appendChild(progressBar);

  const actions = document.createElement("div");
  actions.className = "problem-actions";

  const openBtn = document.createElement("button");
  openBtn.className = "action primary";
  openBtn.textContent = "Open problem";

  // Open the tracked LeetCode problem
  openBtn.addEventListener("click", () => {
    if (!prob.url) {
      console.error("Problem URL is missing:", problemId);
      return;
    }

    chrome.tabs.create({ url: prob.url }, () => {
      if (chrome.runtime.lastError) {
        console.error("Unable to open problem:", chrome.runtime.lastError);
      }
    });
  });

  const reviseBtn = document.createElement("button");
  reviseBtn.className = "action";
  reviseBtn.textContent = "Mark revised";

  // Allow revision completion only when due or overdue
  const revisionStatus = getStatus(prob);

  reviseBtn.disabled =
    revisionStatus === "upcoming" ||
    revisionStatus === "completed";

  // Prevent multiple clicks while saving a revision
  reviseBtn.addEventListener("click", () => {
    markAsRevised(problemId, prob, reviseBtn);
  });

  const removeBtn = document.createElement("button");
  removeBtn.className = "action";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => removeProblem(problemId));

  actions.appendChild(openBtn);
  actions.appendChild(reviseBtn);
  actions.appendChild(removeBtn);

  card.appendChild(top);
  card.appendChild(progressTrack);
  card.appendChild(actions);

  return card;
}

// Get a stable priority order for the dashboard
function getPriority(status) {
  const priorities = {
    overdue: 0,
    due: 1,
    upcoming: 2,
    completed: 3
  };

  return priorities[status] ?? 4;
}

// Render all problem groups
function renderProblems() {
  problemList.innerHTML = "";

  const searchTerm = searchInput.value.trim().toLowerCase();

  let entries = Object.entries(problems).filter(([problemId, prob]) => {
    const title = (prob.title || problemId).toLowerCase();

    return title.includes(searchTerm) ||
      problemId.toLowerCase().includes(searchTerm);
  });

  if (sortSelect.value === "title") {
    entries.sort((a, b) =>
      (a[1].title || a[0]).localeCompare(b[1].title || b[0])
    );
  } else if (sortSelect.value === "date") {
    entries.sort((a, b) => b[1].solvedAt - a[1].solvedAt);
  } else {
    entries.sort((a, b) => {
      const priorityDiff =
        getPriority(getStatus(a[1])) - getPriority(getStatus(b[1]));

      return priorityDiff ||
        (a[1].title || a[0]).localeCompare(b[1].title || b[0]);
    });
  }

  // Calculate summary counts for all tracked problems
  const counts = {
    due: 0,
    overdue: 0,
    upcoming: 0,
    completed: 0
  };

  Object.values(problems).forEach((prob) => {
    counts[getStatus(prob)]++;
  });

  document.getElementById("dueCount").textContent = counts.due;
  document.getElementById("overdueCount").textContent = counts.overdue;
  document.getElementById("completedCount").textContent = counts.completed;

  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const title = document.createElement("strong");
    title.textContent = Object.keys(problems).length === 0
      ? "No problems tracked yet"
      : "No matching problems";

    const message = document.createElement("p");
    message.textContent = Object.keys(problems).length === 0
      ? "Solve a LeetCode problem and submit an Accepted solution. LeetRepeat will add it here."
      : "Try another search term.";

    empty.appendChild(title);
    empty.appendChild(message);
    problemList.appendChild(empty);

    return;
  }

  const groups = [
    { key: "overdue", title: "Overdue" },
    { key: "due", title: "Due today" },
    { key: "upcoming", title: "Upcoming" },
    { key: "completed", title: "Completed" }
  ];

  groups.forEach((group) => {
    const groupEntries = entries.filter(
      ([, prob]) => getStatus(prob) === group.key
    );

    if (groupEntries.length === 0) return;

    const section = document.createElement("section");
    section.className = "section";

    const heading = document.createElement("div");
    heading.className = "section-heading";

    const label = document.createElement("span");
    label.textContent = group.title;

    const count = document.createElement("span");
    count.className = "section-count";
    count.textContent = groupEntries.length;

    heading.appendChild(label);
    heading.appendChild(count);
    section.appendChild(heading);

    groupEntries.forEach(([problemId, prob]) => {
      section.appendChild(createCard(problemId, prob));
    });

    problemList.appendChild(section);
  });
}

// Load saved problems from Chrome storage
function loadProblems() {
  problemList.innerHTML =
    '<div class="loading">Loading your revisions...</div>';

  chrome.storage.local.get(null, (data) => {
    if (chrome.runtime.lastError) {
      problemList.textContent = "Unable to load saved problems.";
      console.error(chrome.runtime.lastError);
      return;
    }

    // Ignore unrelated extension storage values
    problems = Object.fromEntries(
      Object.entries(data).filter(([, value]) => {
        return value &&
          Array.isArray(value.revisions) &&
          Array.isArray(value.completedRevisions) &&
          Number.isFinite(value.solvedAt);
      })
    );

    renderProblems();
  });
}

// Refresh problem data without displaying the loading state
function refreshProblems() {
  chrome.storage.local.get(null, (data) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }

    // Update the tracked problems
    problems = Object.fromEntries(
      Object.entries(data).filter(([, value]) => {
        return value &&
          Array.isArray(value.revisions) &&
          Array.isArray(value.completedRevisions) &&
          Number.isFinite(value.solvedAt);
      })
    );

    renderProblems();
  });
}

searchInput.addEventListener("input", renderProblems);
sortSelect.addEventListener("change", renderProblems);
document.getElementById("refreshBtn").addEventListener("click", loadProblems);

// Load problems when the popup opens
loadProblems();

// Refresh revision statuses periodically while the popup is open
setInterval(refreshProblems, 60 * 1000);

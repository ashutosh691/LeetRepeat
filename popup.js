const dueContainer = document.getElementById("due");
const overdueContainer = document.getElementById("overdue");
const upcomingContainer = document.getElementById("upcoming");

function getDaysPassed(prob) {
  return Math.floor((Date.now() - prob.solvedAt) / (1000 * 60 * 60 * 24));
}

function getStatus(prob) {
  const daysPassed = getDaysPassed(prob);

  for (let day of prob.revisions) {
    if (prob.completedRevisions.includes(day)) continue;

    if (daysPassed === day) return "due";
    if (daysPassed > day) return "overdue";
    if (daysPassed < day) return "upcoming";
  }

  return "completed";
}

function getStatusText(prob) {
  const daysPassed = getDaysPassed(prob);

  for (let day of prob.revisions) {
    if (prob.completedRevisions.includes(day)) continue;

    if (daysPassed === day) return "DUE TODAY";
    if (daysPassed > day) return "OVERDUE";
    if (daysPassed < day) return `IN ${day - daysPassed} DAYS`;
  }

  return "COMPLETED";
}

function markAsRevised(key, prob) {
  for (let day of prob.revisions) {
    if (!prob.completedRevisions.includes(day)) {
      prob.completedRevisions.push(day);
      break;
    }
  }

  chrome.storage.local.set({ [key]: prob }, () => {
    location.reload();
  });
}

function createCard(key, prob) {
  const div = document.createElement("div");
  div.className = "problem";

  const title = document.createElement("div");
  title.className = "title";
  title.innerText = prob.title;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerText = `Solved: ${new Date(prob.solvedAt).toLocaleDateString()}`;

  const statusType = getStatus(prob);

  const status = document.createElement("div");
  status.className = `status ${statusType}`;
  status.innerText = getStatusText(prob);

  const openBtn = document.createElement("button");
  openBtn.innerText = "Open Problem";
  openBtn.onclick = () => chrome.tabs.create({ url: prob.url });

  const reviseBtn = document.createElement("button");
  reviseBtn.innerText = "Mark as Revised";
  reviseBtn.onclick = () => markAsRevised(key, prob);

  div.appendChild(title);
  div.appendChild(meta);
  div.appendChild(status);
  div.appendChild(openBtn);
  div.appendChild(reviseBtn);

  return div;
}

chrome.storage.local.get(null, (data) => {
  const keys = Object.keys(data);

  if (keys.length === 0) {
    dueContainer.innerHTML = "<p>No problems yet</p>";
    return;
  }

  keys.forEach((key) => {
    const prob = data[key];
    const status = getStatus(prob);
    const card = createCard(key, prob);

    if (status === "due") {
      dueContainer.appendChild(card);
    } else if (status === "overdue") {
      overdueContainer.appendChild(card);
    } else if (status === "upcoming") {
      upcomingContainer.appendChild(card);
    }
  });
});
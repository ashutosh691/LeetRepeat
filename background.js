// Production mode
const TEST_MODE = false;

// Schedule alarms
function scheduleRevisions(problemId, daysArray) {
  daysArray.forEach((days) => {
    const alarmName = `${problemId}_${days}`;

    chrome.alarms.get(alarmName, (existing) => {
      if (existing) return;

      chrome.alarms.create(alarmName, {
        delayInMinutes: TEST_MODE ? 1 : days * 24 * 60
      });
    });
  });
}

// Receive solved problem
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== "PROBLEM_SOLVED") return;

  try {
    const problemId = msg.url.split("/")[4];

    chrome.storage.local.get([problemId], (res) => {
      if (chrome.runtime.lastError) return;

      const existing = res[problemId];
      let data;

      if (!existing) {
        data = {
          title: msg.title,
          url: msg.url,
          solvedAt: Date.now(),
          revisions: [7, 30, 90],
          completedRevisions: []
        };
      } else {
        const now = Date.now();
        const daysPassed = Math.floor(
          (now - existing.solvedAt) / (1000 * 60 * 60 * 24)
        );

        let completed = [...existing.completedRevisions];

        for (let day of existing.revisions) {
          if (!completed.includes(day) && daysPassed >= day) {
            completed.push(day);
            break;
          }
        }

        data = {
          ...existing,
          completedRevisions: completed
        };
      }

      chrome.storage.local.set({ [problemId]: data }, () => {
        if (chrome.runtime.lastError) return;

        const remaining = data.revisions.filter(
          (day) => !data.completedRevisions.includes(day)
        );

        scheduleRevisions(problemId, remaining);
      });
    });

  } catch (err) {
    console.error(err);
  }
});

// Alarm trigger
chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm || !alarm.name) return;

  const [problemId, days] = alarm.name.split("_");

  chrome.storage.local.get([problemId], (res) => {
    if (chrome.runtime.lastError) return;

    const prob = res[problemId];
    if (!prob) return;

    chrome.notifications.getAll((notifications) => {
      Object.keys(notifications).forEach((id) => {
        if (id.startsWith(problemId)) {
          chrome.notifications.clear(id);
        }
      });
    });

    const notificationId = `${alarm.name}_${Date.now()}`;

    chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icon128.png"),
      title: "LeetRepeat Reminder",
      message: `Reattempt "${prob.title}" (${days} days later)`,
      priority: 2
    });
  });
});

// Click notification
chrome.notifications.onClicked.addListener((notificationId) => {
  if (!notificationId) return;

  const parts = notificationId.split("_");
  const problemId = parts[0];

  chrome.storage.local.get([problemId], (res) => {
    if (chrome.runtime.lastError) return;

    const prob = res[problemId];
    if (prob && prob.url) {
      chrome.tabs.create({ url: prob.url });
    }
  });
});
// Revision intervals in days
const REVISION_DAYS = [7, 30, 90];

// Create reminders for the remaining revision intervals
function scheduleRevisions(problemId, prob) {
  if (!prob || !Array.isArray(prob.revisions)) return;

  const completedRevisions = prob.completedRevisions || [];
  const notifiedRevisions = prob.notifiedRevisions || [];

  prob.revisions.forEach((days) => {
    // Skip revisions that are already completed or notified
    if (completedRevisions.includes(days)) return;
    if (notifiedRevisions.includes(days)) return;

    const alarmName = `${problemId}_${days}`;

    // Calculate reminder time from the original solve date
    const revisionTime = prob.solvedAt + days * 24 * 60 * 60 * 1000;
    const remainingTime = revisionTime - Date.now();

    chrome.alarms.get(alarmName, (existing) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
      }

      // Do not recreate an existing alarm
      if (existing) return;

      chrome.alarms.create(alarmName, {
        delayInMinutes: Math.max(
          0.1,
          remainingTime / (1000 * 60)
        )
      });
    });
  });
}

// Extract a stable problem slug from the LeetCode URL
function getProblemId(url) {
  const match = url.match(/\/problems\/([^/]+)/);
  return match ? match[1] : null;
}

// Receive an Accepted submission from the content script
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== "PROBLEM_SOLVED" || !msg.url) return;

  const problemId = getProblemId(msg.url);
  if (!problemId) return;

  chrome.storage.local.get([problemId], (res) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }

    const existing = res[problemId];

    // Keep the original schedule when the problem is solved again
    if (existing) return;

    const data = {
      title: msg.title || problemId,
      url: msg.url,
      solvedAt: Date.now(),
      revisions: [...REVISION_DAYS],
      completedRevisions: [],
      notifiedRevisions: []
    };

    chrome.storage.local.set({ [problemId]: data }, () => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
      }

      scheduleRevisions(problemId, data);
    });
  });
});

// Show a notification when a revision alarm fires
chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm || !alarm.name) return;

  const separatorIndex = alarm.name.lastIndexOf("_");
  if (separatorIndex === -1) return;

  const problemId = alarm.name.slice(0, separatorIndex);
  const days = Number(alarm.name.slice(separatorIndex + 1));

  // Ignore alarms that are not LeetRepeat revision intervals
  if (!REVISION_DAYS.includes(days)) return;

  chrome.storage.local.get([problemId], (res) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }

    const prob = res[problemId];
    if (!prob) return;

    const completedRevisions = prob.completedRevisions || [];
    const notifiedRevisions = prob.notifiedRevisions || [];

    // Ignore completed or already-notified revisions
    if (completedRevisions.includes(days)) return;
    if (notifiedRevisions.includes(days)) return;

    // Record that this revision reminder has fired
    const updatedProblem = {
      ...prob,
      notifiedRevisions: [...notifiedRevisions, days]
    };

    chrome.storage.local.set(
      { [problemId]: updatedProblem },
      () => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
        }

        const notificationId = `${alarm.name}_${Date.now()}`;

        chrome.notifications.create(notificationId, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("icon128.png"),
          title: "LeetRepeat revision reminder",
          message: `Time to revisit "${prob.title}" (${days}-day revision).`,
          priority: 2
        }, () => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
          }
        });
      }
    );
  });
});

// Open the problem when its notification is clicked
chrome.notifications.onClicked.addListener((notificationId) => {
  if (!notificationId) return;

  // Remove the notification timestamp
  const timestampSeparator = notificationId.lastIndexOf("_");
  if (timestampSeparator === -1) return;

  const alarmName = notificationId.slice(0, timestampSeparator);

  // Extract the problem ID from the alarm name
  const alarmSeparator = alarmName.lastIndexOf("_");
  if (alarmSeparator === -1) return;

  const problemId = alarmName.slice(0, alarmSeparator);

  chrome.storage.local.get([problemId], (res) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }

    const prob = res[problemId];

    if (prob && prob.url) {
      chrome.tabs.create({ url: prob.url });
    }
  });
});

// Restore revision reminders when the service worker starts
function restoreRevisionAlarms() {
  chrome.storage.local.get(null, (problems) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }

    // Restore alarms for tracked problems
    Object.entries(problems).forEach(([problemId, prob]) => {
      if (
        !prob ||
        !Number.isFinite(prob.solvedAt) ||
        !Array.isArray(prob.revisions)
      ) {
        return;
      }

      // Support records created before notifiedRevisions was added
      if (!Array.isArray(prob.completedRevisions)) {
        prob.completedRevisions = [];
      }

      if (!Array.isArray(prob.notifiedRevisions)) {
        prob.notifiedRevisions = [];
      }

      scheduleRevisions(problemId, prob);
    });

    // Remove only orphaned LeetRepeat revision alarms
    chrome.alarms.getAll((alarms) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
      }

      alarms.forEach((alarm) => {
        const separatorIndex = alarm.name.lastIndexOf("_");
        if (separatorIndex === -1) return;

        const days = Number(
          alarm.name.slice(separatorIndex + 1)
        );

        // Ignore alarms belonging to other features
        if (!REVISION_DAYS.includes(days)) return;

        const problemId = alarm.name.slice(0, separatorIndex);

        // Clear alarm if its problem no longer exists
        if (!problems[problemId]) {
          chrome.alarms.clear(alarm.name);
        }
      });
    });
  });
}

// Restore reminders when the extension starts
restoreRevisionAlarms();

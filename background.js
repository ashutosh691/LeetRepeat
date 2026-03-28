console.log("LeetRepeat background running");

// Toggle for testing vs production
const TEST_MODE = false;

// Schedule alarms
function scheduleRevisions(problemId, daysArray) {
  daysArray.forEach((days) => {
    const alarmName = `${problemId}_${days}`;

    chrome.alarms.get(alarmName, (existing) => {
      if (existing) {
        console.log("Alarm already exists:", alarmName);
        return;
      }

      chrome.alarms.create(alarmName, {
        delayInMinutes: TEST_MODE ? 1 : days * 24 * 60
      });

      console.log("Scheduled:", alarmName);
    });
  });
}

// Receive solved problem
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== "PROBLEM_SOLVED") return;

  console.log("Message received:", msg);

  try {
    const problemId = msg.url.split("/")[4];
    console.log("Problem ID:", problemId);

    chrome.storage.local.get([problemId], (res) => {
      if (chrome.runtime.lastError) {
        console.error("Storage get error:", chrome.runtime.lastError);
        return;
      }

      const existing = res[problemId];
      let data;

      if (!existing) {
        // First time solve
        data = {
          title: msg.title,
          url: msg.url,
          solvedAt: Date.now(),
          revisions: [7, 30, 90],
          completedRevisions: []
        };

        console.log("First time solve:", problemId);

      } else {
        console.log("Re-solved problem:", problemId);

        const now = Date.now();
        const daysPassed = Math.floor(
          (now - existing.solvedAt) / (1000 * 60 * 60 * 24)
        );

        let completed = [...existing.completedRevisions];

        // Mark closest pending revision
        for (let day of existing.revisions) {
          if (!completed.includes(day) && daysPassed >= day) {
            completed.push(day);
            console.log("Marked revision completed:", day);
            break;
          }
        }

        data = {
          ...existing,
          completedRevisions: completed
          // solvedAt NOT changed → keeps original schedule
        };
      }

      chrome.storage.local.set({ [problemId]: data }, () => {
        if (chrome.runtime.lastError) {
          console.error("Storage set error:", chrome.runtime.lastError);
          return;
        }

        console.log("Saved:", data);

        // Schedule ONLY remaining revisions
        const remaining = data.revisions.filter(
          (day) => !data.completedRevisions.includes(day)
        );

        scheduleRevisions(problemId, remaining);
      });

    });

  } catch (err) {
    console.error("Error processing message:", err);
  }
});

// Alarm trigger
chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm || !alarm.name) return;

  console.log("Alarm triggered:", alarm.name);

  const [problemId, days] = alarm.name.split("_");

  chrome.storage.local.get([problemId], (res) => {
    if (chrome.runtime.lastError) {
      console.error("Storage error:", chrome.runtime.lastError);
      return;
    }

    const prob = res[problemId];
    if (!prob) {
      console.warn("Problem not found for alarm:", alarm.name);
      return;
    }

    // Clear old notifications for this problem
    chrome.notifications.getAll((notifications) => {
      Object.keys(notifications).forEach((id) => {
        if (id.startsWith(problemId)) {
          chrome.notifications.clear(id);
        }
      });
    });

    // Unique notification ID
    const notificationId = `${alarm.name}_${Date.now()}`;

    chrome.notifications.create(
      notificationId,
      {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icon.png"),
        title: "LeetRepeat Reminder",
        message: `Reattempt "${prob.title}" (${days} days later)`,
        priority: 2
      },
      (id) => {
        if (chrome.runtime.lastError) {
          console.error("Notification error:", chrome.runtime.lastError);
        } else {
          console.log("Notification shown:", id);
        }
      }
    );
  });
});

// Click notification → open problem
chrome.notifications.onClicked.addListener((notificationId) => {
  console.log("Notification clicked:", notificationId);

  if (!notificationId) return;

  const parts = notificationId.split("_");
  const problemId = parts[0];

  chrome.storage.local.get([problemId], (res) => {
    if (chrome.runtime.lastError) {
      console.error("Storage error:", chrome.runtime.lastError);
      return;
    }

    const prob = res[problemId];

    if (prob && prob.url) {
      chrome.tabs.create({ url: prob.url });
    } else {
      console.warn("Problem not found for notification:", problemId);
    }
  });
});

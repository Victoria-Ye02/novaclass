const pool = require("../config/db");

async function notifyUser(userId, { type, title, message = null, linkUrl = null }) {
  await pool.query(
    "INSERT INTO notifications (user_id, type, title, message, link_url) VALUES (?, ?, ?, ?, ?)",
    [userId, type, title, message, linkUrl]
  );
}

// Fans a notification out to several users at once (e.g. every member of a
// class) — excludeUserId keeps the actor who triggered the event (the
// teacher who posted the assignment, the host who started the meeting) from
// notifying themselves.
async function notifyUsers(userIds, { type, title, message = null, linkUrl = null, excludeUserId = null }) {
  const recipients = userIds.filter(id => id !== excludeUserId);
  for (const userId of recipients) {
    await notifyUser(userId, { type, title, message, linkUrl });
  }
}

module.exports = { notifyUser, notifyUsers };

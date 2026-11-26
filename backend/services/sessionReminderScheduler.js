const SessionRegistration = require("../models/SessionRegistration");
const Notification = require("../models/Notification");

async function runSessionReminderSweep(io, now = new Date()) {
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const registrations = await SessionRegistration.find({ status: "registered" })
    .populate({ path: "session", select: "title room startTime status", match: { status: "published", startTime: { $gt: now, $lte: horizon } } })
    .select("attendee session");
  let created = 0;
  for (const registration of registrations) {
    const session = registration.session;
    if (!session) continue;
    const key = `session-reminder:${session._id}`;
    if (await Notification.exists({ recipient: registration.attendee, key })) continue;
    try {
      const notification = await Notification.create({
        recipient: registration.attendee,
        type: "session_reminder",
        title: "Session starting soon",
        message: `${session.title} starts within 24 hours in ${session.room}.`,
        link: "/dashboard/agenda",
        key,
      });
      io?.to(`user:${registration.attendee}`).emit("new-notification", notification);
      created += 1;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  return created;
}

function startSessionReminderScheduler(io, intervalMs = 5 * 60 * 1000) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const created = await runSessionReminderSweep(io);
      if (created) console.log(`Session reminder scheduler created ${created} notification(s)`);
    } catch (error) {
      console.error("Session reminder scheduler failed:", error.message);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

module.exports = { runSessionReminderSweep, startSessionReminderScheduler };

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const isValidExpoTime = (value) => typeof value === "string" && TIME_PATTERN.test(value);

const isValidTimezone = (value) => {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const localParts = (value, timezone) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
};

const dateKeyUTC = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const validateExpoHours = ({ startTime = "09:00", endTime = "18:00", timezone = "Asia/Karachi" } = {}) => {
  if (!isValidExpoTime(startTime) || !isValidExpoTime(endTime)) {
    return { valid: false, message: "Expo opening and closing times must use HH:mm format" };
  }
  if (endTime <= startTime) {
    return { valid: false, message: "Expo closing time must be after its opening time" };
  }
  if (!isValidTimezone(timezone)) {
    return { valid: false, message: "Please provide a valid IANA timezone, such as Asia/Karachi" };
  }
  return { valid: true, startTime, endTime, timezone };
};

const validateSessionWithinExpoHours = (start, end, expo) => {
  const timezone = expo.timezone || "Asia/Karachi";
  const hours = validateExpoHours({ startTime: expo.startTime, endTime: expo.endTime, timezone });
  if (!hours.valid) return hours;

  let localStart;
  let localEnd;
  try {
    localStart = localParts(start, timezone);
    localEnd = localParts(end, timezone);
  } catch {
    return { valid: false, message: "Expo timezone is invalid" };
  }
  if (!localStart || !localEnd) return { valid: false, message: "Invalid session date format" };

  const firstExpoDay = dateKeyUTC(expo.startDate);
  const lastExpoDay = dateKeyUTC(expo.endDate);
  if (localStart.date < firstExpoDay || localStart.date > lastExpoDay || localEnd.date < firstExpoDay || localEnd.date > lastExpoDay) {
    return { valid: false, message: "Session must be scheduled within Expo dates in the Expo timezone" };
  }
  if (localStart.date !== localEnd.date) {
    return { valid: false, message: "A session must start and end on the same Expo-local date" };
  }
  if (localStart.time < hours.startTime || localEnd.time > hours.endTime) {
    return { valid: false, message: `Session must be within daily Expo hours (${hours.startTime}–${hours.endTime} ${timezone})` };
  }
  return { valid: true };
};

const getExpoLocalInstant = (dateValue, time, timezone = "Asia/Karachi") => {
  const dateKey = dateKeyUTC(dateValue);
  if (!dateKey || !isValidTimezone(timezone) || !isValidExpoTime(time)) return null;
  const targetLocalAsUtc = Date.parse(`${dateKey}T${time}:00.000Z`);
  let candidate = targetLocalAsUtc;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = localParts(new Date(candidate), timezone);
    if (!parts) return null;
    const actualLocalAsUtc = Date.parse(`${parts.date}T${parts.time}:00.000Z`);
    candidate += targetLocalAsUtc - actualLocalAsUtc;
  }
  return new Date(candidate);
};

const getExpoDeadlineInstant = (deadline, timezone = "Asia/Karachi") => {
  const startOfLastMinute = getExpoLocalInstant(deadline, "23:59", timezone);
  return startOfLastMinute ? new Date(startOfLastMinute.getTime() + 59999) : null;
};

const isExpoRegistrationDeadlinePassed = (deadline, timezone = "Asia/Karachi", now = new Date()) => {
  if (!deadline) return false;
  const deadlineInstant = getExpoDeadlineInstant(deadline, timezone);
  return !deadlineInstant || new Date(now).getTime() > deadlineInstant.getTime();
};

const isExpoRegistrationClosed = (expo, now = new Date()) => {
  if (!expo?.startDate) return true;
  const timezone = expo.timezone || "Asia/Karachi";
  const expoStart = getExpoLocalInstant(expo.startDate, "00:00", timezone);
  if (!expoStart) return true;
  const deadlineEnd = expo.registrationDeadline
    ? getExpoDeadlineInstant(expo.registrationDeadline, timezone)
    : null;
  const closesAt = deadlineEnd && deadlineEnd < expoStart ? deadlineEnd : expoStart;
  return new Date(now).getTime() >= closesAt.getTime();
};

const validateRegistrationDeadline = (deadline, startDate) => {
  if (deadline === undefined || deadline === null || deadline === "") {
    return { valid: true, date: null };
  }
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) {
    return { valid: false, message: "Invalid registration deadline" };
  }
  if (date > new Date(startDate)) {
    return { valid: false, message: "Registration deadline must be on or before the Expo start date" };
  }
  return { valid: true, date };
};

const formatExpoDateTime = (value, timezone = "Asia/Karachi") => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

module.exports = {
  TIME_PATTERN,
  isValidExpoTime,
  isValidTimezone,
  validateExpoHours,
  validateSessionWithinExpoHours,
  validateRegistrationDeadline,
  getExpoLocalInstant,
  getExpoDeadlineInstant,
  isExpoRegistrationDeadlinePassed,
  isExpoRegistrationClosed,
  formatExpoDateTime,
};

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateExpoHours,
  validateSessionWithinExpoHours,
  validateRegistrationDeadline,
  getExpoLocalInstant,
  getExpoDeadlineInstant,
  isExpoRegistrationDeadlinePassed,
  isExpoRegistrationClosed,
  formatExpoDateTime,
} = require("../utils/expoSchedule");

test("Expo daily hours accept valid local time and IANA timezone", () => {
  assert.deepEqual(validateExpoHours({ startTime: "09:00", endTime: "18:00", timezone: "Asia/Karachi" }), {
    valid: true, startTime: "09:00", endTime: "18:00", timezone: "Asia/Karachi",
  });
});

test("Expo daily hours reject malformed, reversed and invalid timezone values", () => {
  assert.equal(validateExpoHours({ startTime: "9am", endTime: "18:00", timezone: "Asia/Karachi" }).valid, false);
  assert.equal(validateExpoHours({ startTime: "18:00", endTime: "09:00", timezone: "Asia/Karachi" }).valid, false);
  assert.equal(validateExpoHours({ startTime: "09:00", endTime: "18:00", timezone: "Not/AZone" }).valid, false);
});

test("session times are checked against Expo-local dates and daily opening hours", () => {
  const expo = {
    startDate: new Date("2027-01-10T00:00:00.000Z"),
    endDate: new Date("2027-01-12T00:00:00.000Z"),
    startTime: "09:00",
    endTime: "18:00",
    timezone: "Asia/Karachi",
  };
  assert.equal(validateSessionWithinExpoHours("2027-01-10T04:00:00.000Z", "2027-01-10T12:00:00.000Z", expo).valid, true);
  assert.equal(validateSessionWithinExpoHours("2027-01-10T03:00:00.000Z", "2027-01-10T12:00:00.000Z", expo).valid, false);
  assert.equal(validateSessionWithinExpoHours("2027-01-10T12:00:00.000Z", "2027-01-10T14:00:00.000Z", expo).valid, false);
});

test("session date boundaries use the Expo timezone, including negative UTC offsets", () => {
  const expo = {
    startDate: new Date("2027-01-10T00:00:00.000Z"),
    endDate: new Date("2027-01-10T00:00:00.000Z"),
    startTime: "09:00",
    endTime: "18:00",
    timezone: "America/Los_Angeles",
  };
  assert.equal(validateSessionWithinExpoHours("2027-01-10T17:00:00.000Z", "2027-01-11T02:00:00.000Z", expo).valid, true);
});

test("notification date/time uses the Expo timezone", () => {
  assert.match(formatExpoDateTime("2027-01-10T04:00:00.000Z", "Asia/Karachi"), /10-Jan-2027/);
});


test("registration deadline must be a valid date on or before Expo start", () => {
  const startDate = new Date("2027-01-10T00:00:00.000Z");
  assert.equal(validateRegistrationDeadline("2027-01-09", startDate).valid, true);
  assert.equal(validateRegistrationDeadline("2027-01-10", startDate).valid, true);
  assert.equal(validateRegistrationDeadline("2027-01-11", startDate).valid, false);
  assert.equal(validateRegistrationDeadline("not-a-date", startDate).valid, false);
  assert.deepEqual(validateRegistrationDeadline(null, startDate), { valid: true, date: null });
});


test("registration deadline remains open through the end of the selected Expo-local day", () => {
  const deadline = new Date("2027-01-10T00:00:00.000Z");
  const endOfDay = getExpoDeadlineInstant(deadline, "Asia/Karachi");
  assert.equal(endOfDay.toISOString(), "2027-01-10T18:59:59.999Z");
  assert.equal(isExpoRegistrationDeadlinePassed(deadline, "Asia/Karachi", new Date("2027-01-10T18:59:00.000Z")), false);
  assert.equal(isExpoRegistrationDeadlinePassed(deadline, "Asia/Karachi", new Date("2027-01-10T19:00:00.000Z")), true);
});

test("registration deadline uses the selected timezone on negative UTC offsets", () => {
  const deadline = new Date("2027-01-10T00:00:00.000Z");
  const endOfDay = getExpoDeadlineInstant(deadline, "America/Los_Angeles");
  assert.equal(endOfDay.toISOString(), "2027-01-11T07:59:59.999Z");
});


test("registration closes at the Expo-local start of the event day when deadline is the same date", () => {
  const expo = {
    startDate: new Date("2027-01-10T00:00:00.000Z"),
    registrationDeadline: new Date("2027-01-10T00:00:00.000Z"),
    timezone: "Asia/Karachi",
  };
  const localStart = getExpoLocalInstant(expo.startDate, "00:00", expo.timezone);
  assert.equal(localStart.toISOString(), "2027-01-09T19:00:00.000Z");
  assert.equal(isExpoRegistrationClosed(expo, new Date("2027-01-09T18:59:59.999Z")), false);
  assert.equal(isExpoRegistrationClosed(expo, new Date("2027-01-09T19:00:00.000Z")), true);
});

test("an earlier registration deadline closes at the end of its Expo-local date", () => {
  const expo = {
    startDate: new Date("2027-01-12T00:00:00.000Z"),
    registrationDeadline: new Date("2027-01-10T00:00:00.000Z"),
    timezone: "Asia/Karachi",
  };
  assert.equal(isExpoRegistrationClosed(expo, new Date("2027-01-10T18:59:59.998Z")), false);
  assert.equal(isExpoRegistrationClosed(expo, new Date("2027-01-10T18:59:59.999Z")), true);
});

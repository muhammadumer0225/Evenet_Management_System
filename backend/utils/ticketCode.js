const crypto = require("crypto");

const createTicketCode = () => `ES-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
const isValidTicketCode = (value) => typeof value === "string" && /^ES-[A-F0-9]{10}$/.test(value.trim().toUpperCase());

module.exports = { createTicketCode, isValidTicketCode };

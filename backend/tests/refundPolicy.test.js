const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateDemoExpoRefund } = require("../utils/refundPolicy");

test("Premium demo-paid cancellation returns 70% after 30% deduction", () => {
  assert.equal(calculateDemoExpoRefund({ status: "registered", ticketTier: "premium", paymentStatus: "paid", ticketPrice: 2000 }), 1400);
});

test("VIP demo-paid cancellation returns 70% after 30% deduction", () => {
  assert.equal(calculateDemoExpoRefund({ status: "registered", ticketTier: "vip", paymentStatus: "paid", ticketPrice: 4000 }), 2800);
});

test("free, pending and already-cancelled registrations have no refund", () => {
  assert.equal(calculateDemoExpoRefund({ status: "registered", ticketTier: "standard", paymentStatus: "free", ticketPrice: 0 }), 0);
  assert.equal(calculateDemoExpoRefund({ status: "pending_payment", ticketTier: "premium", paymentStatus: "pending", ticketPrice: 2000 }), 0);
  assert.equal(calculateDemoExpoRefund({ status: "cancelled", ticketTier: "vip", paymentStatus: "paid", ticketPrice: 4000 }), 0);
});

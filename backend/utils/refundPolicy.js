function calculateDemoExpoRefund(registration) {
  if (!registration || registration.status !== "registered") return 0;
  if (!["premium", "vip"].includes(registration.ticketTier)) return 0;
  if (registration.paymentStatus !== "paid") return 0;

  const paidAmount = Number(registration.ticketPrice);
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) return 0;

  return Math.round(paidAmount * 0.7);
}

module.exports = { calculateDemoExpoRefund };

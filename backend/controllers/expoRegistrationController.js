
const mongoose = require("mongoose");
const Expo = require("../models/Expo");
const ExpoRegistration = require("../models/ExpoRegistration");
const { isExpoRegistrationClosed } = require("../utils/expoSchedule");
const Payment = require("../models/Payment");
const Session = require("../models/Session");
const SessionRegistration = require("../models/SessionRegistration");
const Notification = require("../models/Notification");
const { isValidTicketCode } = require("../utils/ticketCode");
const { calculateDemoExpoRefund } = require("../utils/refundPolicy");

// Register for Expo
const registerForExpo = async (req, res) => {
    try {
        const { expoId } = req.params;
        const attendeeId = req.user.id;
        const { ticketTier } = req.body;

        if (!["standard", "premium", "vip"].includes(ticketTier)) {
    return res.status(400).json({
        message: "Invalid ticket tier. Choose standard, premium, or vip."
    });
}

        if (!mongoose.Types.ObjectId.isValid(expoId)) {
            return res.status(400).json({
                message: "Invalid Expo ID"
            });
        }

        const expo = await Expo.findOne({
            _id: expoId,
            status: "published"
        });

        if (!expo) {
            return res.status(404).json({
                message: "Published Expo not found"
            });
        }

        const tierMultipliers = {
    standard: 0,
    premium: 2,
    vip: 4
};

const basePrice = Number(expo.ticketPrice ?? 0);

if (
    !Number.isInteger(basePrice) ||
    basePrice < 0
) {
    return res.status(400).json({
        message: "Invalid Expo ticket price"
    });
}

if (ticketTier !== "standard" && basePrice <= 0) {
    return res.status(400).json({
        message: "Paid ticket tiers are unavailable for this Expo"
    });
}

const ticketPrice = basePrice * tierMultipliers[ticketTier];

const isFreeTicket = ticketTier === "standard";

const registrationStatus = isFreeTicket
    ? "registered"
    : "pending_payment";

const paymentStatus = isFreeTicket
    ? "free"
    : "pending";

        if (isExpoRegistrationClosed(expo)) {
            return res.status(400).json({
                message: "Expo registration is closed for this Expo."
            });
        }

        const existingRegistration = await ExpoRegistration.findOne({
            expo: expoId,
            attendee: attendeeId
        });

        if (
    existingRegistration?.status === "registered" ||
    existingRegistration?.status === "pending_payment"
) {
            return res.status(409).json({
                message: "You are already registered for this Expo"
            });
        }

        const activeRegistrations = await ExpoRegistration.countDocuments({
            expo: expoId,
            status: { $in: ["registered", "pending_payment"] }
        });

        if (
            expo.capacity != null &&
            activeRegistrations >= expo.capacity
        ) {
            return res.status(409).json({
                message: "Expo registration capacity is full"
            });
        }

// Reactivate cancelled registration
if (existingRegistration) {
    const registration = await ExpoRegistration.findOneAndUpdate(
        { _id: existingRegistration._id },
        {
            ticketTier,
            ticketPrice,
            currency: "PKR",
            status: registrationStatus,
            paymentStatus,
            paymentGateway: null,
            paymentReference: null,
            paidAt: null,
            refund: {
                amount: 0,
                status: "not_applicable",
                reference: null,
                processedAt: null
            },
            registeredAt: new Date(),
            cancelledAt: null
        },
        { returnDocument: "after", runValidators: true }
    );

    if (isFreeTicket) {
        await Expo.updateOne({ _id: expoId }, { $inc: { registeredCount: 1 } });
    }

    return res.status(200).json({
        message: isFreeTicket
            ? "Expo registration reactivated successfully"
            : "Registration reactivated. Payment is required.",
        registration
    });
}

const registration = await ExpoRegistration.create({
    expo: expoId,
    attendee: attendeeId,
    ticketTier,
    ticketPrice,
    currency: "PKR",
    status: registrationStatus,
    paymentStatus
});

if (isFreeTicket) {
    await Expo.updateOne({ _id: expoId }, { $inc: { registeredCount: 1 } });
}

return res.status(201).json({
    message: isFreeTicket
        ? "Expo registration successful"
        : "Registration created. Payment is required.",
    registration
});

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "You are already registered for this Expo"
            });
        }

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};


// Get My Expo Registrations
const getMyExpoRegistrations = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter = {
            attendee: req.user.id
        };

        if (req.query.status) {
            if (!["registered", "cancelled"].includes(req.query.status)) {
                return res.status(400).json({
                    message: "Invalid registration status"
                });
            }

            filter.status = req.query.status;
        }

        const [registrations, total] = await Promise.all([
            ExpoRegistration.find(filter)
                .populate("expo", "title category startDate endDate location banner status ticketPrice currency")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),

            ExpoRegistration.countDocuments(filter)
        ]);

        return res.status(200).json({
            registrations,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};


// Attendees can verify only their own registration using the Mongo registration ID or ticket code.
const verifyMyRegistration = async (req, res) => {
    try {
        const { registrationId } = req.params;
        const isObjectId = mongoose.Types.ObjectId.isValid(registrationId);
        const lookup = isObjectId
            ? { _id: registrationId, attendee: req.user.id }
            : isValidTicketCode(registrationId)
                ? { ticketCode: registrationId.trim().toUpperCase(), attendee: req.user.id }
                : null;

        if (!lookup) return res.status(400).json({ success: false, message: "Enter a valid registration ID or ticket code" });

        const registration = await ExpoRegistration.findOne(lookup)
            .populate("expo", "title startDate endDate location status");
        if (!registration) {
            return res.status(404).json({ success: false, registered: false, message: "No registration was found for your account" });
        }

        const isActive = registration.status === "registered" &&
            ["free", "paid"].includes(registration.paymentStatus);

        return res.status(200).json({
            success: true,
            registered: isActive,
            registration: {
                id: registration._id,
                ticketCode: registration.ticketCode,
                ticketTier: registration.ticketTier,
                ticketPrice: registration.ticketPrice,
                currency: registration.currency,
                status: registration.status,
                paymentStatus: registration.paymentStatus,
                checkedInAt: registration.checkedInAt,
                expo: registration.expo
            },
            message: isActive ? "Your Expo registration is confirmed" : "This registration is not currently active"
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Unable to verify registration" });
    }
};

// Admin-only check-in. A registration can be checked in once, after payment is complete.
const checkInAttendee = async (req, res) => {
    try {
        const { registrationId, ticketCode, expoId } = req.body;
        if (!registrationId && !ticketCode) {
            return res.status(400).json({ success: false, message: "Registration ID or ticket code is required" });
        }

        // Prefer an explicit Registration ID. Some older clients/scanners sent
        // the scanned value in `ticketCode` regardless of its actual format, so
        // also accept a valid Mongo ObjectId in that field as a compatibility
        // fallback. Never treat an arbitrary string as a database identifier.
        const normalizedRegistrationId = typeof registrationId === "string" ? registrationId.trim() : "";
        const normalizedTicketCode = typeof ticketCode === "string" ? ticketCode.trim() : "";
        let lookup;

        if (normalizedRegistrationId && mongoose.Types.ObjectId.isValid(normalizedRegistrationId)) {
            lookup = { _id: normalizedRegistrationId };
        } else if (normalizedTicketCode && isValidTicketCode(normalizedTicketCode)) {
            lookup = { ticketCode: normalizedTicketCode.toUpperCase() };
        } else if (!normalizedRegistrationId && normalizedTicketCode && mongoose.Types.ObjectId.isValid(normalizedTicketCode)) {
            lookup = { _id: normalizedTicketCode };
        } else if (normalizedRegistrationId) {
            return res.status(400).json({ success: false, message: "Invalid registration ID" });
        } else {
            return res.status(400).json({ success: false, message: "Invalid ticket code" });
        }
        if (expoId) {
            if (!mongoose.Types.ObjectId.isValid(expoId)) {
                return res.status(400).json({ success: false, message: "Invalid Expo ID" });
            }
            lookup.expo = expoId;
        }

        const current = await ExpoRegistration.findOne(lookup).populate("expo", "title").populate("attendee", "name email");
        if (!current) return res.status(404).json({ success: false, message: "Registration not found for this Expo" });
        if (current.status !== "registered" || !["free", "paid"].includes(current.paymentStatus)) {
            return res.status(409).json({ success: false, message: "Registration is not active or payment is incomplete" });
        }
        if (current.checkedInAt) {
            return res.status(409).json({ success: false, message: "This ticket has already been checked in", checkedInAt: current.checkedInAt });
        }

        const registration = await ExpoRegistration.findOneAndUpdate(
            { _id: current._id, status: "registered", paymentStatus: { $in: ["free", "paid"] }, checkedInAt: null },
            { $set: { checkedInAt: new Date(), checkedInBy: req.user.id } },
            { returnDocument: "after", runValidators: true }
        ).populate("expo", "title").populate("attendee", "name email");

        if (!registration) return res.status(409).json({ success: false, message: "This ticket has already been checked in" });
        return res.status(200).json({ success: true, message: "Attendee checked in successfully", registration });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Unable to check in attendee" });
    }
};

// Cancel Expo Registration. Paid Premium/VIP demo tickets receive the agreed 70% refund.
const cancelExpoRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid Registration ID" });
        }

        const existing = await ExpoRegistration.findOne({ _id: id, attendee: req.user.id });
        if (!existing) return res.status(404).json({ message: "Registration not found" });
        if (!["registered", "pending_payment"].includes(existing.status)) {
            return res.status(409).json({ message: "Only an active or pending registration can be cancelled" });
        }
        if (existing.checkedInAt) {
            return res.status(409).json({ message: "A checked-in ticket cannot be cancelled" });
        }

        const wasRegistered = existing.status === "registered";
        const refundAmount = calculateDemoExpoRefund(existing);
        const refund = refundAmount > 0
            ? { amount: refundAmount, status: "processed", reference: null, processedAt: new Date() }
            : { amount: 0, status: "not_applicable", reference: null, processedAt: null };

        const registration = await ExpoRegistration.findOneAndUpdate(
            { _id: id, attendee: req.user.id, status: existing.status },
            {
                $set: {
                    status: "cancelled",
                    cancelledAt: new Date(),
                    refund,
                    ...(refundAmount > 0 ? { paymentStatus: "refunded" } : {})
                }
            },
            { returnDocument: "after", runValidators: true }
        );

        if (!registration) {
            return res.status(409).json({ message: "Registration has already been cancelled" });
        }

        if (wasRegistered) {
            await Expo.updateOne(
                { _id: registration.expo, registeredCount: { $gt: 0 } },
                { $inc: { registeredCount: -1 } }
            );
        }

        const expoSessions = wasRegistered
            ? await Session.find({ expo: registration.expo }).distinct("_id")
            : [];
        if (expoSessions.length) {
            await SessionRegistration.updateMany(
                { session: { $in: expoSessions }, attendee: req.user.id, status: "registered" },
                { $set: { status: "cancelled", cancelledAt: new Date() } }
            );
            await Notification.deleteMany({
                recipient: req.user.id,
                key: { $in: expoSessions.map((sessionId) => `session-reminder:${sessionId}`) }
            });
        }

        if (refundAmount > 0) {
            await Payment.updateMany(
                { registration: registration._id, attendee: req.user.id, status: "paid" },
                {
                    $set: {
                        status: "refunded",
                        "metadata.refundAmount": refundAmount,
                        "metadata.refundDeductionPercent": 30,
                        "metadata.refundedAt": refund.processedAt
                    }
                }
            );
        }

        return res.status(200).json({
            success: true,
            message: refundAmount > 0
                ? `Registration cancelled. PKR ${refundAmount} demo refund (70%) recorded after the 30% deduction.`
                : wasRegistered ? "Expo registration cancelled successfully" : "Pending registration cancelled successfully",
            registration,
            refund
        });
    } catch (error) {
        return res.status(500).json({ message: "Unable to cancel Expo registration" });
    }
};

module.exports = {
    registerForExpo,
    getMyExpoRegistrations,
    verifyMyRegistration,
    checkInAttendee,
    cancelExpoRegistration
};


const crypto = require("crypto");

const Payment = require("../models/Payment");
const ExpoRegistration = require("../models/ExpoRegistration");
const Expo = require("../models/Expo");

const completeDemoPayment = async ({ registrationId, attendeeId }) => {
    const registration = await ExpoRegistration.findOne({
        _id: registrationId,
        attendee: attendeeId
    });

    if (!registration) {
        const error = new Error("Registration not found");
        error.statusCode = 404;
        throw error;
    }

    if (registration.ticketTier === "standard") {
        const error = new Error("Standard tickets are already free");
        error.statusCode = 400;
        throw error;
    }

    if (
        registration.status !== "pending_payment" ||
        !["pending", "failed"].includes(registration.paymentStatus)
    ) {
        const error = new Error("Registration is not awaiting payment");
        error.statusCode = 400;
        throw error;
    }

    const amount = Number(registration.ticketPrice);

    if (!Number.isInteger(amount) || amount <= 0) {
        const error = new Error("Invalid registration amount");
        error.statusCode = 400;
        throw error;
    }

    const existingPayment = await Payment.findOne({
        registration: registration._id,
        status: "paid"
    });

    if (existingPayment) {
        const error = new Error("This registration is already paid");
        error.statusCode = 409;
        throw error;
    }

    const transactionReference =
        `ESDEMO${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const payment = await Payment.create({
        registration: registration._id,
        attendee: attendeeId,
        gateway: "demo",
        amount,
        currency: registration.currency,
        status: "paid",
        transactionReference,
        paidAt: new Date(),
        providerResponseMessage: "Demo payment successful"
    });

    try {
        const updatedRegistration = await ExpoRegistration.findOneAndUpdate(
            {
                _id: registration._id,
                attendee: attendeeId,
                status: "pending_payment",
                paymentStatus: { $in: ["pending", "failed"] }
            },
            {
                $set: {
                    status: "registered",
                    paymentStatus: "paid",
                    paymentGateway: "demo",
                    paymentReference: transactionReference,
                    paidAt: payment.paidAt
                }
            },
            { returnDocument: "after", runValidators: true }
        );

        if (!updatedRegistration) {
            payment.status = "cancelled";
            payment.failureReason =
                "Registration was no longer awaiting payment";
            await payment.save();

            const error = new Error(
                "Registration payment could not be completed"
            );
            error.statusCode = 409;
            throw error;
        }

        await Expo.updateOne(
            { _id: updatedRegistration.expo },
            { $inc: { registeredCount: 1 } }
        );

        return { payment, registration: updatedRegistration };
    } catch (error) {
        if (payment.status === "paid") {
            payment.status = "cancelled";
            payment.failureReason = "Could not update registration";
            await payment.save();
        }

        throw error;
    }
};


module.exports = {
    completeDemoPayment
};

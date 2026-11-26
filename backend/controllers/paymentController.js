
const { completeDemoPayment } = require("../services/paymentService");

const completeDemoPaymentController = async (req, res) => {
    try {
        const { registrationId } = req.params;

        const result = await completeDemoPayment({
            registrationId,
            attendeeId: req.user.id
        });

        return res.status(200).json({
            success: true,
            message: "Demo payment completed successfully",
            payment: {
                id: result.payment._id,
                amount: result.payment.amount,
                currency: result.payment.currency,
                status: result.payment.status,
                transactionReference: result.payment.transactionReference
            },
            registration: {
                id: result.registration._id,
                status: result.registration.status,
                paymentStatus: result.registration.paymentStatus
            }
        });
    } catch (error) {
        console.error("Demo payment error:", error.message);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Unable to complete demo payment"
        });
    }
};

module.exports = {
    completeDemoPaymentController
};

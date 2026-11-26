
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        registration: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ExpoRegistration",
            required: true,
            index: true
        },

        attendee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

gateway: {
    type: String,
    enum: ["jazzcash", "easypaisa", "demo"],
    required: true
},

        amount: {
            type: Number,
            required: true,
            min: 1
        },

        currency: {
            type: String,
            enum: ["PKR"],
            default: "PKR",
            required: true
        },

        status: {
            type: String,
            enum: [
                "initiated",
                "pending",
                "paid",
                "failed",
                "cancelled",
                "refunded"
            ],
            default: "initiated",
            required: true
        },

        transactionReference: {
            type: String,
            unique: true,
            sparse: true,
            trim: true
        },

        providerTransactionId: {
            type: String,
            default: null,
            trim: true
        },

        providerResponseCode: {
            type: String,
            default: null
        },

        providerResponseMessage: {
            type: String,
            default: null
        },

        paymentUrl: {
            type: String,
            default: null
        },

        initiatedAt: {
            type: Date,
            default: Date.now
        },

        paidAt: {
            type: Date,
            default: null
        },

        failureReason: {
            type: String,
            default: null
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

paymentSchema.index({ registration: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);

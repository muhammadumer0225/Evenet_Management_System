
const mongoose = require("mongoose");
const { createTicketCode } = require("../utils/ticketCode");

const expoRegistrationSchema = new mongoose.Schema(
    {
        expo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Expo",
            required: true
        },

        attendee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        ticketCode: {
            type: String,
            required: true,
            unique: true,
            default: createTicketCode,
            trim: true,
            uppercase: true
        },

        checkedInAt: {
            type: Date,
            default: null
        },

        checkedInBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        ticketTier: {
    type: String,
    enum: ["standard", "premium", "vip"],
    default: "standard",
    required: true
},

ticketPrice: {
    type: Number,
    required: true,
    min: 0,
    default: 0
},

currency: {
    type: String,
    enum: ["PKR"],
    default: "PKR",
    required: true
},


paymentStatus: {
    type: String,
    enum: ["free", "pending", "paid", "failed", "refunded"],
    required: true,
    default: "free"
},

paymentGateway: {
    type: String,
    enum: ["jazzcash", "easypaisa", "demo"],
    default: null
},

paymentReference: {
    type: String,
    default: null,
    trim: true
},

paidAt: {
    type: Date,
    default: null
},

refund: {
    amount: {
        type: Number,
        default: 0,
        min: 0
    },
    status: {
        type: String,
        enum: ["not_applicable", "pending", "processed", "failed"],
        default: "not_applicable"
    },
    reference: {
        type: String,
        default: null,
        trim: true
    },
    processedAt: {
        type: Date,
        default: null
    }
},

        status: {
            type: String,
            enum: ["pending_payment", "registered", "cancelled"],
            default: "registered"
        },

        registeredAt: {
            type: Date,
            default: Date.now
        },

        cancelledAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Prevent duplicate registration records
expoRegistrationSchema.index(
    { expo: 1, attendee: 1 },
    { unique: true }
);

// Helpful indexes
expoRegistrationSchema.index({ expo: 1, status: 1 });
expoRegistrationSchema.index({ expo: 1, checkedInAt: 1 });
expoRegistrationSchema.index({ attendee: 1, createdAt: -1 });

module.exports = mongoose.model(
    "ExpoRegistration",
    expoRegistrationSchema
);

const mongoose = require("mongoose");


const boothPositionSchema = new mongoose.Schema(
  {
    x: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    y: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    width: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    height: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    rotation: {
      type: Number,
      min: 0,
      max: 360,
      default: 0,
    },
  },
  { _id: false }
);


const showcaseStaffSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },
    role: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
  },
  { _id: false }
);

const boothShowcaseSchema = new mongoose.Schema(
  {
    tagline: {
      type: String,
      trim: true,
      default: "",
    },
    offer: {
      type: String,
      trim: true,
      default: "",
    },
    hours: {
      type: String,
      trim: true,
      default: "09:00 – 18:00",
    },
    products: {
      type: [String],
      default: [],
    },
    staff: {
      type: [showcaseStaffSchema],
      default: [],
    },
  },
  { _id: false }
);



const boothSchema  = new mongoose.Schema(
  {
    expo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expo",
      required: true,
    },

    boothNumber: {
      type: String,
      required: true,
      trim: true,
    },

    zone: {
      type: String,
      trim: true,
      default: "Main Hall",
      maxlength: 80,
    },

    size: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },


position: {
  type: boothPositionSchema,
  default: undefined,
},


    status: {
      type: String,
      enum: ["available", "reserved", "occupied", "blocked"],
      default: "available",
    },

    exhibitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },


    showcase: {
      type: boothShowcaseSchema,
      default: () => ({}),
    },

  },
  {
    timestamps: true,
  },
);

// Prevent duplicate booth numbers within the same Expo
boothSchema.index(
  { expo: 1, boothNumber: 1 },
  { unique: true }
);

const Booth = mongoose.model("Booth", boothSchema);

module.exports = Booth;

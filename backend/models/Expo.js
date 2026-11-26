
const mongoose = require("mongoose");

const coordinatesSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    venue: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
      default: "",
    },
    coordinates: {
      type: coordinatesSchema,
      default: undefined,
    },
  },
  { _id: false }
);

const floorPlanSchema = new mongoose.Schema(
  {
    width: {
      type: Number,
      min: 1,
    },
    height: {
      type: Number,
      min: 1,
    },
    backgroundImage: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const expoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    theme: {
      type: String,
      trim: true,
      default: "",
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return !this.startDate || value >= this.startDate;
        },
        message: "End date cannot be before start date",
      },
    },
    startTime: {
      type: String,
      trim: true,
      match: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
      default: "09:00",
    },
    endTime: {
      type: String,
      trim: true,
      match: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
      default: "18:00",
    },
    timezone: {
      type: String,
      trim: true,
      default: "Asia/Karachi",
      validate: {
        validator: (value) => {
          try {
            new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
            return true;
          } catch {
            return false;
          }
        },
        message: "Timezone must be a valid IANA timezone",
      },
    },

    location: {
      type: locationSchema,
      required: true,
    },

    banner: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "draft",
        "published",
        "ongoing",
        "completed",
        "cancelled",
      ],
      default: "draft",
    },

    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    capacity: {
      type: Number,
      min: 1,
      default: null,
    },

    registeredCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    ticketPrice: {
  type: Number,
  
  default: 0,
  min: 0,
},
currency: {
  type: String,
  enum: ['PKR'],
  default: 'PKR',
  
},

    registrationDeadline: {
      type: Date,
      default: null,
    },

    floorPlan: {
      type: floorPlanSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

// Automatically generate slug from Expo title
expoSchema.pre("validate", function () {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    this.invalidate("endTime", "Expo closing time must be after its opening time");
  }
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
});

// Database indexes
expoSchema.index({
  title: "text",
  description: "text",
  category: "text",
  theme: "text",
});

expoSchema.index({
  status: 1,
  startDate: 1,
});

expoSchema.index({
  "location.city": 1,
});

const Expo = mongoose.model("Expo", expoSchema);

module.exports = Expo;

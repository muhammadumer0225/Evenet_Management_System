const mongoose = require("mongoose");
const dns = require("node:dns");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI is missing. Configure it in backend/.env.");
    }

    // Node may inherit a local DNS forwarder that refuses SRV lookups on some
    // Windows setups. Configure a resolver before Mongoose resolves mongodb+srv.
    // Override this list in .env for networks that provide their own DNS resolver.
    if (mongoUri.startsWith("mongodb+srv://")) {
      const configuredServers = process.env.MONGODB_DNS_SERVERS || "8.8.8.8,8.8.4.4";
      const dnsServers = configuredServers
        .split(",")
        .map((server) => server.trim())
        .filter(Boolean);

      if (dnsServers.length > 0) {
        dns.setServers(dnsServers);
      }
    }

    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;

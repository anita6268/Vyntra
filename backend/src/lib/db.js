import mongoose from "mongoose";
import { ENV } from "./env.js";

export const connectDB = async () => {
  try {
    const { MONGO_URI } = ENV;
    if (!MONGO_URI) throw new Error("MONGO_URI is not set");

    const conn = await mongoose.connect(ENV.MONGO_URI);
    if (process.env.NODE_ENV !== "production") {
      console.info(`MONGODB CONNECTED: ${conn.connection.host}`);
    }
  } catch (error) {
    console.error("Error connection to MONGODB:", error?.message || "Unknown error");
    process.exit(1); // 1 status code means fail, 0 means success
  }
};

import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to ' + process.env.MONGO_URI);
  } catch (error) {
    console.log('Failed to connected to the mongoDB ' + error)
  }
}
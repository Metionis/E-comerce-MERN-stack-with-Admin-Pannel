import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    require: [true, "Name is required"]
  },
  email: {
    type: String,
    require: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    require: [true, "Password is required"],
    minlength: [6, "Password must be atleast 6 characters long"]
  }
})
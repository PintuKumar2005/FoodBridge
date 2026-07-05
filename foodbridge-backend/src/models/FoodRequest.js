import mongoose from "mongoose";

const foodRequestSchema = new mongoose.Schema(
  {
    foodId: { type: mongoose.Schema.Types.ObjectId, ref: "Donation", required: true, index: true },
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    foodName: { type: String, required: true },
    foodType: { type: String, required: true },
    donorOrg: { type: String, required: true },
    receiverName: { type: String, required: true },
    receiverOrg: { type: String, required: true },
    receiverType: { type: String, required: true },
    message: { type: String, trim: true, maxlength: 300, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected", "collected"], default: "pending", index: true },
  },
  { timestamps: true }
);

foodRequestSchema.index({ foodId: 1, receiverId: 1 }, { unique: true });

export default mongoose.model("FoodRequest", foodRequestSchema);

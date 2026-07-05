import mongoose from "mongoose";

const donationSchema = new mongoose.Schema(
  {
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    donorName: { type: String, required: true, trim: true },
    organizationName: { type: String, required: true, trim: true },
    foodName: { type: String, required: true, trim: true },
    foodType: { type: String, enum: ["Veg", "Non-Veg", "Both"], required: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, enum: ["Meals", "Plates", "Boxes", "Packs", "Kg"], default: "Meals" },
    location: { type: String, required: true, trim: true },
    pickupTime: { type: Date, required: true },
    expiryTime: { type: Date, required: true },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    image: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ["available", "requested", "assigned", "collected"], default: "available", index: true },
    assignedReceiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedReceiverName: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Donation", donationSchema);

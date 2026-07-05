import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "./models/User.js";
import Donation from "./models/Donation.js";
import FoodRequest from "./models/FoodRequest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const otps = new Map();
const OTP_CODE = "123456";

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN
      ? process.env.FRONTEND_ORIGIN.split(",")
      : ["http://localhost:5173", "http://127.0.0.1:5173"],
  })
);
app.use(express.json({ limit: "12mb" }));

app.get("/", (req, res) => {
  res.send("Server Running...");
});

app.get("/api/health", async (req, res) => {
  const [donors, receivers] = await Promise.all([
    User.countDocuments({ type: "donor" }),
    User.countDocuments({ type: "receiver" }),
  ]);

  res.json({
    ok: true,
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    donors,
    receivers,
  });
});

app.post("/api/donors", async (req, res) => {
  const payload = req.body;
  const validationError = requireFields(payload, [
    "businessName",
    "businessType",
    "ownerName",
    "phone",
    "email",
    "address",
    "city",
    "state",
    "pincode",
  ]);

  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const phone = normalizePhone(payload.phone);
  if (!/^\d{10}$/.test(phone)) {
    res.status(400).json({ message: "Enter a valid 10-digit mobile number" });
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(String(payload.email))) {
    res.status(400).json({ message: "Enter a valid email address" });
    return;
  }
  if (!/^\d{6}$/.test(String(payload.pincode))) {
    res.status(400).json({ message: "Enter a valid 6-digit pincode" });
    return;
  }
  if (!payload.documents?.identityProof) {
    res.status(400).json({ message: "Identity proof is required" });
    return;
  }
  const existing = await User.findOne({ type: "donor", phone });

  if (existing) {
    res.status(409).json({ message: "A donor with this phone number already exists" });
    return;
  }

  const user = await User.create({
    type: "donor",
    email: payload.email,
    phone,
    name: payload.ownerName,
    organizationName: payload.businessName,
    organizationType: payload.businessType,
    address: payload.address,
    city: payload.city,
    state: payload.state,
    pincode: payload.pincode,
    details: {
      fssaiLicenseNumber: payload.fssaiLicenseNumber,
      businessRegistrationNumber: payload.businessRegistrationNumber,
      foodType: payload.foodType,
      averageDailySurplus: payload.averageDailySurplus,
      pickupAvailability: payload.pickupAvailability,
      latitude: payload.latitude,
      longitude: payload.longitude,
    },
    documents: payload.documents,
  });

  res.status(201).json({ message: "Donor registered successfully", user: publicUser(user) });
});

app.post("/api/receivers", async (req, res) => {
  const payload = req.body;
  const validationError = requireFields(payload, [
    "organizationName",
    "organizationType",
    "contactName",
    "phone",
    "email",
    "address",
    "city",
    "state",
    "pincode",
  ]);

  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const phone = normalizePhone(payload.phone);
  const existing = await User.findOne({ type: "receiver", phone });

  if (existing) {
    res.status(409).json({ message: "A receiver with this phone number already exists" });
    return;
  }

  const user = await User.create({
    type: "receiver",
    email: payload.email,
    phone,
    name: payload.contactName,
    organizationName: payload.organizationName,
    organizationType: payload.organizationType,
    address: payload.address,
    city: payload.city,
    state: payload.state,
    pincode: payload.pincode,
    details: {
      registrationNumber: payload.registrationNumber,
      numberOfResidents: payload.numberOfResidents,
      foodPreference: payload.foodPreference,
      canArrangePickup: payload.canArrangePickup,
    },
  });

  res.status(201).json({ message: "Receiver registered successfully", user: publicUser(user) });
});

app.post("/api/auth/send-otp", async (req, res) => {
  const role = req.body.role === "receiver" ? "receiver" : "donor";
  const phone = normalizePhone(req.body.phone);

  if (!phone) {
    res.status(400).json({ message: "Phone number is required" });
    return;
  }

  const user = await User.findOne({ type: role, phone });

  if (!user) {
    res.status(404).json({ message: `No ${role} found for this phone number` });
    return;
  }

  otps.set(`${role}:${phone}`, OTP_CODE);
  res.json({ message: "OTP sent successfully. Demo OTP is 123456.", otp: OTP_CODE });
});

app.post("/api/auth/direct-login", async (req, res) => {
  const role = req.body.role === "receiver" ? "receiver" : "donor";
  const phone = normalizePhone(req.body.phone);

  if (!/^\d{10}$/.test(phone)) {
    res.status(400).json({ message: "Enter a valid registered 10-digit mobile number" });
    return;
  }

  const user = await User.findOne({ type: role, phone });
  if (!user) {
    res.status(404).json({ message: `No registered ${role} found for this phone number` });
    return;
  }

  res.json({ message: "Login successful", user: publicUser(user) });
});

app.post("/api/auth/verify-otp", async (req, res) => {
  const role = req.body.role === "receiver" ? "receiver" : "donor";
  const phone = normalizePhone(req.body.phone);
  const otpKey = `${role}:${phone}`;

  if (otps.get(otpKey) !== String(req.body.otp ?? "")) {
    res.status(401).json({ message: "Invalid OTP" });
    return;
  }

  const user = await User.findOne({ type: role, phone });

  if (!user) {
    res.status(404).json({ message: `No ${role} found for this phone number` });
    return;
  }

  otps.delete(otpKey);
  res.json({ message: "Login successful", user: publicUser(user) });
});

app.post("/api/donations", async (req, res) => {
  const payload = req.body;
  const validationError = requireFields(payload, ["donorId", "foodName", "foodType", "quantity", "location", "pickupTime", "expiryTime"]);
  if (validationError) return res.status(400).json({ message: validationError });

  const donor = await User.findOne({ _id: payload.donorId, type: "donor" });
  if (!donor) return res.status(404).json({ message: "Donor account not found" });
  if (Number(payload.quantity) < 1) return res.status(400).json({ message: "Quantity must be at least 1" });
  if (new Date(payload.expiryTime) <= new Date()) return res.status(400).json({ message: "Expiry time must be in the future" });

  const donation = await Donation.create({
    donorId: donor._id,
    donorName: donor.name,
    organizationName: donor.organizationName,
    foodName: payload.foodName,
    foodType: payload.foodType,
    quantity: Number(payload.quantity),
    unit: payload.unit,
    location: payload.location,
    pickupTime: payload.pickupTime,
    expiryTime: payload.expiryTime,
    description: payload.description,
    image: payload.image,
  });
  res.status(201).json({ message: "Food donation published", donation: publicDonation(donation) });
});

app.get("/api/donations", async (req, res) => {
  const filter = {};
  if (req.query.donorId) filter.donorId = req.query.donorId;
  if (req.query.status === "available") filter.status = { $in: ["available", "requested"] };
  const donations = await Donation.find(filter).sort({ createdAt: -1 });
  res.json({ donations: donations.map(publicDonation) });
});

app.delete("/api/donations/:id", async (req, res) => {
  const donation = await Donation.findById(req.params.id);
  if (!donation) return res.status(404).json({ message: "Donation not found" });
  if (String(donation.donorId) !== String(req.body.donorId)) {
    return res.status(403).json({ message: "Only the owner can delete this donation" });
  }
  if (["assigned", "collected"].includes(donation.status)) {
    return res.status(409).json({ message: "Assigned or collected donations cannot be deleted" });
  }
  await FoodRequest.deleteMany({ foodId: donation._id });
  await donation.deleteOne();
  res.json({ message: "Donation deleted" });
});

app.post("/api/food-requests", async (req, res) => {
  const { foodId, receiverId, message } = req.body;
  const donation = await Donation.findById(foodId);
  const receiver = await User.findOne({ _id: receiverId, type: "receiver" });
  if (!donation) return res.status(404).json({ message: "Donation not found" });
  if (!receiver) return res.status(404).json({ message: "Receiver account not found" });
  if (!["available", "requested"].includes(donation.status)) return res.status(409).json({ message: "This food is no longer available" });

  const request = await FoodRequest.create({
    foodId: donation._id,
    donorId: donation.donorId,
    receiverId: receiver._id,
    foodName: donation.foodName,
    foodType: donation.foodType,
    donorOrg: donation.organizationName,
    receiverName: receiver.name,
    receiverOrg: receiver.organizationName,
    receiverType: receiver.organizationType,
    message,
  });
  donation.status = "requested";
  await donation.save();
  res.status(201).json({ message: "Food request sent", request: publicRequest(request) });
});

app.get("/api/food-requests", async (req, res) => {
  const filter = {};
  if (req.query.donorId) filter.donorId = req.query.donorId;
  if (req.query.receiverId) filter.receiverId = req.query.receiverId;
  const requests = await FoodRequest.find(filter).sort({ createdAt: -1 });
  res.json({ requests: requests.map(publicRequest) });
});

app.patch("/api/food-requests/:id", async (req, res) => {
  const request = await FoodRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: "Request not found" });
  const { action, userId } = req.body;

  if (["approve", "reject"].includes(action) && String(request.donorId) !== String(userId)) {
    return res.status(403).json({ message: "Only this donation's donor can update the request" });
  }
  if (action === "collected" && String(request.receiverId) !== String(userId)) {
    return res.status(403).json({ message: "Only this receiver can confirm collection" });
  }

  const donation = await Donation.findById(request.foodId);
  if (action === "approve") {
    if (request.status !== "pending") return res.status(409).json({ message: "Request has already been handled" });
    request.status = "approved";
    await FoodRequest.updateMany({ foodId: request.foodId, _id: { $ne: request._id }, status: "pending" }, { status: "rejected" });
    if (donation) {
      donation.status = "assigned";
      donation.assignedReceiverId = request.receiverId;
      donation.assignedReceiverName = request.receiverOrg;
      await donation.save();
    }
  } else if (action === "reject") {
    request.status = "rejected";
    await request.save();
    const pendingCount = await FoodRequest.countDocuments({ foodId: request.foodId, status: "pending" });
    if (donation && pendingCount === 0) { donation.status = "available"; await donation.save(); }
  } else if (action === "collected") {
    if (request.status !== "approved") return res.status(409).json({ message: "Only approved requests can be collected" });
    request.status = "collected";
    if (donation) { donation.status = "collected"; await donation.save(); }
  } else {
    return res.status(400).json({ message: "Invalid request action" });
  }
  if (request.isModified()) await request.save();
  res.json({ message: "Request updated", request: publicRequest(request) });
});

app.get("/api/profile", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.json({ profile: null });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: "Profile not found" });

  res.json({ profile: publicUser(user) });
});

app.get("/api/notifications", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.json({ notifications: [] });

  const user = await User.findById(userId);
  if (!user) return res.json({ notifications: [] });

  const filter = user.type === "donor" ? { donorId: user._id } : { receiverId: user._id };
  const requests = await FoodRequest.find(filter).sort({ updatedAt: -1, createdAt: -1 }).limit(20);

  res.json({
    notifications: requests.map((request) => ({
      id: String(request._id),
      title: request.status === "pending" ? "Food request pending" : `Food request ${request.status}`,
      subject: request.status === "pending" ? "Food request pending" : `Food request ${request.status}`,
      message: user.type === "donor"
        ? `${request.receiverOrg} requested ${request.foodName}.`
        : `${request.foodName} from ${request.donorOrg} is ${request.status}.`,
      detail: user.type === "donor"
        ? `${request.receiverOrg} requested ${request.foodName}.`
        : `${request.foodName} from ${request.donorOrg} is ${request.status}.`,
      type: request.status,
      read: request.status !== "pending",
      createdAt: request.updatedAt || request.createdAt,
    })),
  });
});

app.get("/api/messages", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.json({ messages: [] });

  const user = await User.findById(userId);
  if (!user) return res.json({ messages: [] });

  res.json({ messages: [] });
});

app.get("/api/analytics", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.json({ mealsReceived: 0, successRate: 0, activeDonations: 0 });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.json({ mealsReceived: 0, successRate: 0, activeDonations: 0 });
  }

  if (user.type === "receiver") {
    const requests = await FoodRequest.find({ receiverId: user._id });
    const completed = requests.filter((request) => request.status === "collected").length;
    const successful = requests.filter((request) => ["approved", "collected"].includes(request.status)).length;
    return res.json({
      mealsReceived: completed,
      successRate: requests.length ? Math.round((successful / requests.length) * 100) : 0,
      activeDonations: requests.filter((request) => request.status === "approved").length,
    });
  }

  const [donations, requests] = await Promise.all([
    Donation.find({ donorId: user._id }),
    FoodRequest.find({ donorId: user._id }),
  ]);

  res.json({
    totalDonations: donations.length,
    activeDonations: donations.filter((donation) => donation.status !== "collected").length,
    completedDonations: donations.filter((donation) => donation.status === "collected").length,
    pendingRequests: requests.filter((request) => request.status === "pending").length,
  });
});

app.use((error, req, res, next) => {
  if (error?.code === 11000) {
    const isRequest = Boolean(error?.keyPattern?.foodId);
    res.status(409).json({ message: isRequest ? "You have already requested this food" : "A user with this phone number already exists" });
    return;
  }

  res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
});

function normalizePhone(phone = "") {
  return String(phone).replace(/\D/g, "").slice(-10);
}

function requireFields(payload, fields) {
  const missing = fields.filter((field) => !String(payload[field] ?? "").trim());

  if (missing.length > 0) {
    return `Missing required field: ${missing.join(", ")}`;
  }

  return null;
}

function publicUser(user) {
  return {
    id: user.id,
    type: user.type,
    email: user.email,
    name: user.name,
    organizationName: user.organizationName,
    organizationType: user.organizationType,
    phone: user.phone,
    address: user.address,
    city: user.city,
    state: user.state,
    pincode: user.pincode,
    details: user.details,
    documents: user.documents,
    createdAt: user.createdAt,
  };
}

function publicDonation(donation) {
  return {
    id: donation.id, donorId: String(donation.donorId), donorName: donation.donorName,
    organizationName: donation.organizationName, foodName: donation.foodName, foodType: donation.foodType,
    quantity: donation.quantity, unit: donation.unit, location: donation.location,
    pickupTime: donation.pickupTime, expiryTime: donation.expiryTime, description: donation.description,
    image: donation.image, status: donation.status, assignedReceiverName: donation.assignedReceiverName,
    createdAt: donation.createdAt,
  };
}

function publicRequest(request) {
  return {
    id: request.id, foodId: String(request.foodId), donorId: String(request.donorId), receiverId: String(request.receiverId),
    foodName: request.foodName, foodType: request.foodType, donorOrg: request.donorOrg,
    receiverName: request.receiverName, receiverOrg: request.receiverOrg, receiverType: request.receiverType,
    message: request.message, status: request.status, requestedAt: request.createdAt,
  };
}

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

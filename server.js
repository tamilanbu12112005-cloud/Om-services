require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const { OAuth2Client } = require("google-auth-library");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 3001;

const client = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

// Endpoint to provide public config to frontend
const bcrypt = require("bcryptjs");
const sendOtpEmail = require("./utils/sendOtpEmail");

app.get("/api/config", (req, res) => {
  res.json({ status: "ok" });
});

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());

// Content Security Policy (CSP) to fix console errors
app.use((req, res, next) => {
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://om-services-z0no.onrender.com",
    "https://om-services.onrender.com",
    /\.vercel\.app$/,
  ];

  const origin = req.headers.origin;
  if (
    allowedOrigins.some(
      (ao) =>
        (typeof ao === "string" && ao === origin) ||
        (ao instanceof RegExp && ao.test(origin)),
    )
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, proxy-connection, Connection, User-Agent, Accept, Origin, Accept-Encoding, Accept-Language",
  );

  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:; " +
      "worker-src 'self' blob:; " +
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net data:; " +
      "img-src 'self' data: blob: https://i.imgur.com; " +
      "connect-src 'self' https://cdn.jsdelivr.net https://om-services-z0no.onrender.com https://om-services.onrender.com;",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  next();
});
// Request Logger - MUST BE FIRST
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Priority 1: Serve from /public folder (CSS, JS, assets)
app.use(express.static(path.join(__dirname, "public")));


// ===== MONGODB CONNECTION =====
console.log("🔌 Connecting to MongoDB...");
console.log(
  "📍 URI:",
  process.env.MONGODB_URI ? "Found in .env" : "❌ MISSING IN .env",
);

// Set global mongoose buffer timeout to 30s (prevents buffering timeout errors)
mongoose.set("bufferTimeoutMS", 30000);

const mongoConnectOptions = {
  serverSelectionTimeoutMS: 30000, // Wait up to 30s to find a server
  socketTimeoutMS: 60000, // 60s for socket operations
  connectTimeoutMS: 30000, // 30s to establish initial connection
  heartbeatFrequencyMS: 10000, // Check connection every 10s
  maxPoolSize: 10, // Max 10 concurrent connections
  retryWrites: true,
  retryReads: true,
};

async function connectMongoDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, mongoConnectOptions);
    console.log("✅ MongoDB Connected Successfully!");
    console.log("📊 Database:", mongoose.connection.name);

    try {
      // Wait for the connection to be fully established and the DB object to be available
      if (mongoose.connection.db) {
        const collections = await mongoose.connection.db
          .listCollections({ name: "users" })
          .toArray();
        if (collections.length > 0) {
          const usersCollection = mongoose.connection.db.collection("users");
          const indexes = await usersCollection.indexes();
          
          if (indexes.some((idx) => idx.name === "username_1")) {
            await usersCollection.dropIndex("username_1");
            console.log("🗑️ Dropped legacy unique username index");
          }
          if (indexes.some((idx) => idx.name === "clerkId_1")) {
            await usersCollection.dropIndex("clerkId_1");
            console.log("🗑️ Dropped legacy unique clerkId index");
          }
        }
      } else {
        console.log(
          "⚠️ MongoDB connection db object not ready for index check",
        );
      }
    } catch (e) {
      console.log("⚠️ Index cleanup info:", e.message);
    }
  } catch (err) {
    console.error("❌ MongoDB Connection FAILED:", err.message);
    console.error("💡 Retrying in 10 seconds...");
    setTimeout(connectMongoDB, 10000); // Auto-retry after 10s
  }
}

connectMongoDB();

// Monitor MongoDB connection status
mongoose.connection.on("connected", () => {
  console.log("🟢 Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("🔴 Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("🟡 Mongoose disconnected — attempting reconnect in 5s...");
  // Log more details if available
  if (mongoose.connection && mongoose.connection.readyState !== undefined) {
    console.log("🟡 Mongoose readyState:", mongoose.connection.readyState);
  }
  setTimeout(connectMongoDB, 5000); // Auto-reconnect after 5s
});

// ===== SCHEMAS =====
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, sparse: true },
    phone: String,
    address: String,
    password: { type: String }, // Hashed password
    location: String,
    age: Number,
    profileImage: String,
    isProfileComplete: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "users" },
);

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  userData: { type: Object }, 
  createdAt: { type: Date, default: Date.now, expires: 300 } 
});
const Otp = mongoose.model("Otp", otpSchema);

const reviewSchema = new mongoose.Schema({
  email: { type: String, lowercase: true, trim: true },
  name: String,
  rating: Number,
  comment: String,
  serviceType: String,
  image: String,
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Booking = require("./models/Booking");
const Review = mongoose.model("Review", reviewSchema);
const Partner = require("./models/Partner");

// ===== MULTER CONFIGURATION =====
const multer = require("multer");
const fs = require("fs");

// Create uploads directory if it doesn't exist (handle read-only environments like Vercel)
const uploadDir = path.join(__dirname, "uploads");
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.warn("⚠️ Could not create uploads directory (expected on Vercel/Serverless)");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Memory storage for profile images to avoid disk issues on cloud platforms (Vercel/Render)
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Serve uploads folder statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===== ADMIN ROUTES =====
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  console.log(`🔐 Admin login attempt: ${username}`);

  // Check credentials from .env only (no hardcoded passwords)
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    console.log("✅ Admin login successful");
    res.json({ success: true, message: "Welcome Om Service Admin!" });
  } else {
    console.log("❌ Admin login failed");
    res
      .status(401)
      .json({ success: false, message: "Invalid Admin Credentials" });
  }
});

const excelExport = require("./utils/excelExport");
const pdfGenerator = require("./utils/pdfGenerator");

app.post("/api/admin/upload", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    console.log("📸 Admin Image Upload:", req.file.filename);
    const imageUrl = "/uploads/" + req.file.filename;
    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.get("/api/admin/analytics", async (req, res) => {
  try {
    console.log("📊 Fetching analytics...");
    const totalBookings = await Booking.countDocuments();
    const usersCount = await User.countDocuments();
    const reviewsCount = await Review.countDocuments();

    const stats = await Booking.aggregate([
      { $group: { _id: "$serviceType", count: { $sum: 1 } } },
    ]);

    console.log(
      `✅ Analytics: ${totalBookings} bookings, ${usersCount} users, ${reviewsCount} reviews`,
    );

    res.json({
      totalBookings,
      usersCount,
      reviewsCount,
      serviceStats: stats,
    });
  } catch (err) {
    console.error("❌ Analytics error:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ===== EXPORT ROUTES =====
app.get("/api/admin/export/excel", excelExport.exportToExcel);
app.get("/api/admin/export/pdf-all", pdfGenerator.generateAllBookingsPDF);
app.get("/api/admin/export/pdf/:id", pdfGenerator.generateBookingPDF);

// ===== BOOKING ROUTES =====
app.get("/api/bookings", async (req, res) => {
  try {
    console.log("📋 Fetching all bookings...");
    const bookings = await Booking.find().sort({ createdAt: -1 });
    console.log(`✅ Found ${bookings.length} bookings`);
    res.json(bookings);
  } catch (err) {
    console.error("❌ Fetch bookings error:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

app.get("/api/user-bookings/:email", async (req, res) => {
  try {
    console.log(`📋 Fetching bookings for: ${req.params.email}`);
    const bookings = await Booking.find({ email: req.params.email }).sort({
      createdAt: -1,
    });
    console.log(`✅ Found ${bookings.length} bookings for user`);
    res.json(bookings);
  } catch (err) {
    console.error("❌ User bookings error:", err);
    res.status(500).json({ error: "Failed to fetch user bookings" });
  }
});

// Email Service
const sendBookingEmail = require("./utils/sendEmail");
const sendPartnerEmail = require("./utils/sendPartnerEmail");

app.post("/api/bookings", async (req, res) => {
  try {
    console.log("📝 Creating new booking...");
    console.log("📦 Booking data:", req.body);

    // Validate required fields
    if (!req.body.name || !req.body.serviceType) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        success: false,
        error: "Name and Service Type are required",
      });
    }

    const newBooking = new Booking(req.body);
    const savedBooking = await newBooking.save();

    console.log("✅ Booking saved successfully!");
    console.log("🆔 Booking ID:", savedBooking._id);

    // Send confirmation email (non-blocking)
    console.log("📧 Attempting to send confirmation email...");
    // Pass savedBooking as bookingDetails
    sendBookingEmail(savedBooking.email, savedBooking)
      .then(() => console.log("✅ Email workflow complete"))
      .catch((err) => console.error("⚠️ Email handling error:", err));

    res.json({
      success: true,
      booking: savedBooking,
      message: "Booking created successfully",
    });
  } catch (err) {
    console.error("❌ CREATE BOOKING ERROR:", err);
    console.error("Stack:", err.stack);
    res.status(500).json({
      success: false,
      error: "Failed to create booking",
      details: err.message,
    });
  }
});

app.put("/api/bookings/:id", async (req, res) => {
  try {
    console.log(`✏️ Updating booking: ${req.params.id}`);
    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );

    if (!updatedBooking) {
      console.log("❌ Booking not found");
      return res.status(404).json({ error: "Booking not found" });
    }

    console.log("✅ Booking updated successfully");
    res.json({ success: true, booking: updatedBooking });
  } catch (err) {
    console.error("❌ Update error:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete("/api/bookings/:id", async (req, res) => {
  try {
    console.log(`🗑️ Deleting booking: ${req.params.id}`);
    const deleted = await Booking.findByIdAndDelete(req.params.id);

    if (!deleted) {
      console.log("❌ Booking not found");
      return res.status(404).json({ error: "Booking not found" });
    }

    console.log("✅ Booking deleted successfully");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ===== REVIEW ROUTES =====
app.get("/api/reviews", async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    console.error("❌ Reviews fetch error:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// DEBUG: See all reviews in DB (only available in development)
if (process.env.NODE_ENV !== 'production') {
  app.get("/api/debug-reviews", async (req, res) => {
    const reviews = await Review.find({}).select("email name rating serviceType createdAt").lean();
    res.json({ total: reviews.length, reviews });
  });
}

app.get("/api/user-reviews/:email", async (req, res) => {
  try {
    console.log(`📋 Fetching reviews for: ${req.params.email}`);
    // Use regex for case-insensitive search to catch any existing non-lowercased entries
    const reviews = await Review.find({ 
      email: { $regex: new RegExp("^" + req.params.email + "$", "i") } 
    }).sort({
      createdAt: -1,
    });
    res.json(reviews);
  } catch (err) {
    console.error("❌ User reviews fetch error:", err);
    res.status(500).json({ error: "Failed to fetch user reviews" });
  }
});

app.post("/api/reviews", async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.email) data.email = data.email.toLowerCase();
    const review = new Review(data);
    await review.save();
    console.log("✅ Review saved");
    res.json({ success: true, review });
  } catch (err) {
    console.error("❌ Review save error:", err);
    res.status(500).json({ error: "Failed to post review" });
  }
});

app.put("/api/reviews/:id", async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.email) data.email = data.email.toLowerCase();
    
    console.log(`✏️ Updating review: ${req.params.id}`);
    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true },
    );

    if (!updatedReview) {
      console.log("❌ Review not found");
      return res.status(404).json({ error: "Review not found" });
    }

    console.log("✅ Review updated successfully");
    res.json({ success: true, review: updatedReview });
  } catch (err) {
    console.error("❌ Review update error:", err);
    res.status(500).json({ error: "Failed to update review" });
  }
});

app.delete("/api/reviews/:id", async (req, res) => {
  try {
    console.log(`🗑️ Deleting review: ${req.params.id}`);
    const deleted = await Review.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Review not found" });
    res.json({ success: true, message: "Review deleted" });
  } catch (err) {
    console.error("❌ Review delete error:", err);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// ===== CUSTOM AUTH ROUTES =====

// 1. Send OTP & Prepare Registration
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { email, phone, name, address, password } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required." });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists." });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save/Update to Otp Collection
    await Otp.findOneAndUpdate(
      { email: email.toLowerCase() },
      { 
        otp, 
        userData: { email: email.toLowerCase(), phone, name, address, password: hashedPassword },
        createdAt: Date.now()
      },
      { upsert: true, new: true }
    );

    // Send the email
    await sendOtpEmail(email, otp);

    res.json({ success: true, message: "OTP sent to email." });
  } catch(err) {
    console.error("❌ Send OTP Error:", err);
    res.status(500).json({ error: "Failed to send OTP." });
  }
});

// 2. Verify OTP & Complete Registration
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    const otpRecord = await Otp.findOne({ email: email.toLowerCase() });
    if (!otpRecord) {
      return res.status(400).json({ error: "OTP expired or not found. Please resend." });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP." });
    }

    // Valid OTP - Create user
    const userData = otpRecord.userData;
    const newUser = new User({
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      address: userData.address,
      password: userData.password, // already hashed
      isProfileComplete: true
    });

    await newUser.save();
    
    // Clean up OTP
    await Otp.deleteOne({ email: email.toLowerCase() });

    console.log("✅ User registered successfully:", newUser.email);
    res.json({ success: true, message: "Registration successful", user: newUser });
  } catch (err) {
    console.error("❌ Verify OTP Error:", err);
    res.status(500).json({ error: "Failed to verify OTP." });
  }
});

// 3. Simple Login returning User details
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password." });
    }
    
    // Check password
    if (!user.password) {
      return res.status(400).json({ error: "Please use forgot password or contact admin to reset your password. (Account was linked to external provider)" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    console.log("✅ User logged in:", user.email);
    // Exclude password hash from response
    const safeUser = user.toObject();
    delete safeUser.password;
    res.json({ success: true, message: "Login successful", user: safeUser });
  } catch(err) {
    console.error("❌ Login Error:", err);
    res.status(500).json({ error: "Failed to login." });
  }
});

// 4. Forgot Password - Send OTP
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: "User not found with this email." });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to OTP collection
    await Otp.findOneAndUpdate(
      { email: email.toLowerCase() },
      { otp, createdAt: Date.now() },
      { upsert: true, new: true }
    );

    // Send the email
    await sendOtpEmail(email, otp);

    res.json({ success: true, message: "Reset OTP sent to your email." });
  } catch (err) {
    console.error("❌ Forgot Password Error:", err);
    res.status(500).json({ error: "Failed to send reset OTP." });
  }
});

// 5. Reset Password with OTP
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Email, OTP, and new password are required." });
    }

    const otpRecord = await Otp.findOne({ email: email.toLowerCase() });
    if (!otpRecord || otpRecord.otp !== otp) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { password: hashedPassword },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: "User not found." });

    // Clean up OTP
    await Otp.deleteOne({ email: email.toLowerCase() });

    console.log("✅ Password reset successfully for:", email);
    res.json({ success: true, message: "Password updated successfully. You can now sign in." });
  } catch (err) {
    console.error("❌ Reset Password Error:", err);
    res.status(500).json({ error: "Failed to reset password." });
  }
});

// ===== USER ROUTES =====
// Legacy route kept for backward compatibility - now unused
// app.get("/api/user/:userId", ...) - use /api/user-by-email/:email instead

// Helper to escape regex special characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

app.get("/api/user-by-email/:email", async (req, res) => {
  try {
    const normalizedEmail = req.params.email.toLowerCase();
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i") },
    });
    console.log(`[EMAIL] ${normalizedEmail} - ${user ? "Found" : "Not Found"}`);
    if (user) {
      const safeUser = user.toObject();
      delete safeUser.password;
      res.json(safeUser);
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    console.error("❌ Email fetch error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

app.post(
  "/api/user/update",
  uploadMemory.single("profileImage"),
  async (req, res) => {
    try {
      console.log("🔄 Profile Update Request");

      // When using multer, text fields are in req.body
      const { email, ...bodyData } = req.body;

      if (!email) {
        console.log("❌ Missing Email");
        return res
          .status(400)
          .json({ error: "Email is required" });
      }

      const normalizedEmail = email.toLowerCase();

      // Prepare update object
      const updateData = { ...bodyData };
      updateData.updatedAt = Date.now();
      updateData.isProfileComplete = true;

      // Add file as Base64 if image uploaded (Stops using disk, stores in MongoDB)
      if (req.file) {
          console.log("📸 Processing new profile image (Memory -> Base64)");
          const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
          updateData.profileImage = base64Image;
          console.log("✅ Image converted to Base64 (Stored in MongoDB)");
      }

      console.log(`[UPDATE] Email=${normalizedEmail}`);

      const user = await User.findOneAndUpdate(
        { email: { $regex: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i") } },
        { $set: { email: normalizedEmail, ...updateData } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      // Remove password hash from response
      const safeUser = user.toObject();
      delete safeUser.password;

      console.log("✅ Profile saved to MongoDB:", user._id);
      res.json({ success: true, user: safeUser });
    } catch (err) {
      console.error("❌ Profile update error:", err);
      res.status(500).json({ error: "Database update failed" });
    }
  },
);

// ===== JOIN / PARTNER ROUTES =====
app.post("/api/join", uploadMemory.array("images", 5), async (req, res) => {
  try {
    console.log("🤝 New Partner Request:", req.body.category, req.body.name);

    // Handle file uploads (Convert from Memory Buffer to Base64 for permanent MongoDB storage)
    const imagePaths = req.files
      ? req.files.map((file) => {
          return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        })
      : [];

    // Handle potentially duplicate fields (like 'details') which might come as an array
    let details = req.body.details;
    if (Array.isArray(details)) {
      // Filter out empty strings and join distinct values
      details = details.filter((d) => d && d.trim().length > 0).join("\n");
    }

    const partnerData = {
      ...req.body,
      details: details || "",
      images: imagePaths,
    };

    const newPartner = new Partner(partnerData);
    await newPartner.save();

    console.log("✅ Partner request saved to MongoDB:", newPartner._id);

    // Send welcome email
    if (req.body.email) {
      console.log("📧 Sending welcome email to", req.body.email);
      sendPartnerEmail(req.body.email, {
        name: req.body.name,
        category: req.body.category,
      }).catch((e) => console.error("Email failed", e));
    }

    res.json({ success: true, message: "Request submitted successfully!" });
  } catch (err) {
    console.error("❌ Join request error:", err);
    res.status(500).json({ success: false, error: "Submission failed" });
  }
});

// Get all partner applications (admin)
const sendApprovalEmail = require("./utils/sendApprovalEmail");
const sendPartnerCodeEmail = require("./utils/sendPartnerCodeEmail");

app.get("/api/partners", async (req, res) => {
  try {
    console.log("📋 Fetching all partner applications...");
    const partners = await Partner.find().sort({ createdAt: -1 });
    console.log(`✅ Found ${partners.length} partner applications`);
    res.json(partners);
  } catch (err) {
    console.error("❌ Partners fetch error:", err);
    res.status(500).json({ error: "Failed to fetch partners" });
  }
});

// Get approved partners for public pages
app.get("/api/partners/approved", async (req, res) => {
  try {
    const { category } = req.query;
    let query = { status: "Approved" };
    if (category) {
      query.category = new RegExp("^" + category + "$", "i"); // Case-insensitive exact match
    }
    const partners = await Partner.find(query).sort({ updatedAt: -1 });
    res.json(partners);
  } catch (err) {
    console.error("❌ Approved partners fetch error:", err);
    res.status(500).json({ error: "Failed to fetch approved partners" });
  }
});

// Delete a partner application
app.delete("/api/partners/:id", async (req, res) => {
  try {
    const deleted = await Partner.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    console.log("✅ Partner deleted:", req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Partner delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// Approve a partner
app.put("/api/partners/:id/approve", async (req, res) => {
  try {
    const { adminNote } = req.body;
    const partner = await Partner.findByIdAndUpdate(
      req.params.id,
      { status: "Approved", adminNote: adminNote || "", updatedAt: Date.now() },
      { new: true, strict: false },
    );
    if (!partner) return res.status(404).json({ error: "Not found" });

    // Send approval email
    if (partner.email) {
      sendApprovalEmail(partner.email, partner, true, adminNote || "").catch(
        (e) => console.error("Approval email failed:", e),
      );
    }

    // Send the HTML code snippet to the Admin directly
    sendPartnerCodeEmail(partner).catch((e) =>
      console.error("Admin Code snippet email failed:", e),
    );

    console.log("✅ Partner approved:", partner.name);
    res.json({ success: true, partner });
  } catch (err) {
    console.error("❌ Partner approve error:", err);
    res.status(500).json({ error: "Approve failed" });
  }
});

// Reject a partner
app.put("/api/partners/:id/reject", async (req, res) => {
  try {
    const { adminNote } = req.body;
    const partner = await Partner.findByIdAndUpdate(
      req.params.id,
      { status: "Rejected", adminNote: adminNote || "", updatedAt: Date.now() },
      { new: true, strict: false },
    );
    if (!partner) return res.status(404).json({ error: "Not found" });

    // Send rejection email
    if (partner.email) {
      sendApprovalEmail(partner.email, partner, false, adminNote || "").catch(
        (e) => console.error("Rejection email failed:", e),
      );
    }

    console.log("✅ Partner rejected:", partner.name);
    res.json({ success: true, partner });
  } catch (err) {
    console.error("❌ Partner reject error:", err);
    res.status(500).json({ error: "Reject failed" });
  }
});

// ===== SERVICE SCHEMA & ROUTES =====
const serviceSchema = new mongoose.Schema({
  category: { type: String, required: true, unique: true },
  images: [String], // Slideshow images
  discount: String, // Banner discount text
  description: String, // Banner tagline
  packages: [
    {
      // Service packages (cards shown on page)
      name: String,
      badge: String, // e.g. "Professional", "Best Value"
      image: String, // Package card image URL
      description: String, // Short description shown on card
      price: String, // e.g. "Starts at ₹10,000"
      features: [String], // Bullet list in detail modal
    },
  ],
  updatedAt: { type: Date, default: Date.now },
});

const Service = mongoose.model("Service", serviceSchema);

// Get All Services or Specific Category
app.get("/api/services", async (req, res) => {
  try {
    const { category } = req.query;
    let query = {};
    if (category) query.category = category;

    const services = await Service.find(query);
    res.json(services);
  } catch (err) {
    console.error("❌ Service fetch error:", err);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

// Update Service (Create if not exists)
app.post("/api/services", async (req, res) => {
  try {
    const { category, images, discount, description, packages } = req.body;
    console.log(`🛠️ Updating service: ${category}`);

    const updatedService = await Service.findOneAndUpdate(
      { category },
      {
        $set: {
          images,
          discount,
          description,
          packages,
          updatedAt: Date.now(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    console.log("✅ Service updated successfully");
    res.json({ success: true, service: updatedService });
  } catch (err) {
    console.error("❌ Service update error:", err);
    res.status(500).json({ error: "Failed to update service" });
  }
});

// Remove a specific image from a service gallery
app.delete("/api/services/:category/image", async (req, res) => {
  try {
    const { category } = req.params;
    const { imageUrl } = req.body;
    console.log(`🗑️ Removing image from ${category}: ${imageUrl}`);

    const service = await Service.findOne({ category });
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    service.images = service.images.filter((img) => img !== imageUrl);
    service.updatedAt = Date.now();
    await service.save();

    console.log("✅ Image removed successfully");
    res.json({ success: true, service });
  } catch (err) {
    console.error("❌ Image remove error:", err);
    res.status(500).json({ error: "Failed to remove image" });
  }
});

// Replace a specific image in a service gallery (upload new + update DB position)
app.post(
  "/api/services/:category/image/update",
  upload.single("image"),
  async (req, res) => {
    try {
      const { category } = req.params;
      const { oldImageUrl } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const newImageUrl = "/uploads/" + req.file.filename;
      console.log(
        `🔄 Replacing image in ${category}: ${oldImageUrl} → ${newImageUrl}`,
      );

      const service = await Service.findOne({ category });
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      const idx = service.images.indexOf(oldImageUrl);
      if (idx !== -1) {
        service.images[idx] = newImageUrl;
      } else {
        service.images.push(newImageUrl);
      }
      service.updatedAt = Date.now();
      service.markModified("images");
      await service.save();

      console.log("✅ Image replaced successfully");
      res.json({ success: true, newImageUrl, service });
    } catch (err) {
      console.error("❌ Image replace error:", err);
      res.status(500).json({ error: "Failed to replace image" });
    }
  },
);

// Add a new image to a service gallery
app.post(
  "/api/services/:category/image/add",
  upload.single("image"),
  async (req, res) => {
    try {
      const { category } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const newImageUrl = "/uploads/" + req.file.filename;
      console.log(`➕ Adding image to ${category}: ${newImageUrl}`);

      const service = await Service.findOneAndUpdate(
        { category },
        { $push: { images: newImageUrl }, $set: { updatedAt: Date.now() } },
        { new: true, upsert: true },
      );

      console.log("✅ Image added successfully");
      res.json({ success: true, newImageUrl, service });
    } catch (err) {
      console.error("❌ Image add error:", err);
      res.status(500).json({ error: "Failed to add image" });
    }
  },
);

// ===== PAGE CONTENT SCHEMA & ROUTES =====
const pageContentSchema = new mongoose.Schema({
  pageId: { type: String, required: true, unique: true }, // e.g. 'home', 'about', 'contact'
  pageName: String,
  heroImage: String,
  heroTitle: String,
  heroSubtitle: String,
  sections: [
    {
      sectionId: String,
      title: String,
      subtitle: String,
      text: String,
      images: [String],
      videos: [String],
      items: [mongoose.Schema.Types.Mixed],
    },
  ],
  contactInfo: {
    phone1: String,
    phone2: String,
    email1: String,
    email2: String,
    address: String,
    mapUrl: String,
  },
  dynamicMap: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now },
});

const PageContent = mongoose.model("PageContent", pageContentSchema);

// Get all page contents
app.get("/api/page-content", async (req, res) => {
  try {
    const pages = await PageContent.find();
    res.json(pages);
  } catch (err) {
    console.error("❌ Page content fetch error:", err);
    res.status(500).json({ error: "Failed to fetch page content" });
  }
});

// Get single page content by ID
app.get("/api/page-content/:pageId", async (req, res) => {
  try {
    const page = await PageContent.findOne({ pageId: req.params.pageId });
    res.json(page || {});
  } catch (err) {
    console.error("❌ Page content fetch error:", err);
    res.status(500).json({ error: "Failed to fetch page content" });
  }
});

// Update page content (upsert)
app.post("/api/page-content/:pageId", async (req, res) => {
  try {
    const { pageId } = req.params;
    const updateData = { ...req.body, updatedAt: Date.now() };
    console.log(`📄 Updating page content: ${pageId}`);

    const page = await PageContent.findOneAndUpdate(
      { pageId },
      { $set: updateData },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    console.log("✅ Page content updated");
    res.json({ success: true, page });
  } catch (err) {
    console.error("❌ Page content update error:", err);
    res.status(500).json({ error: "Failed to update page content" });
  }
});

// Upload image for page content
app.post(
  "/api/page-content/:pageId/upload",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const imageUrl = "/uploads/" + req.file.filename;
      const { pageId } = req.params;
      const { sectionId, field } = req.body;

      console.log(`📸 Page image upload: ${pageId}/${sectionId || field}`);

      let updateQuery = {};
      if (sectionId) {
        // Add to a section's images array
        const page = await PageContent.findOne({ pageId });
        if (page) {
          const section = page.sections.find((s) => s.sectionId === sectionId);
          if (section) {
            section.images.push(imageUrl);
            page.updatedAt = Date.now();
            await page.save();
            return res.json({ success: true, imageUrl, page });
          }
        }
        // Upsert with new section
        updateQuery = {
          $push: { sections: { sectionId, images: [imageUrl] } },
          $set: { updatedAt: Date.now() },
        };
      } else if (field === "heroImage") {
        updateQuery = { $set: { heroImage: imageUrl, updatedAt: Date.now() } };
      } else {
        return res.json({ success: true, imageUrl });
      }

      const updated = await PageContent.findOneAndUpdate(
        { pageId },
        updateQuery,
        { new: true, upsert: true },
      );
      res.json({ success: true, imageUrl, page: updated });
    } catch (err) {
      console.error("❌ Page image upload error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

// Remove image from page section
app.delete("/api/page-content/:pageId/image", async (req, res) => {
  try {
    const { pageId } = req.params;
    const { imageUrl, sectionId, field } = req.body;
    console.log(`🗑️ Removing page image: ${pageId}/${imageUrl}`);

    const page = await PageContent.findOne({ pageId });
    if (!page) return res.status(404).json({ error: "Page not found" });

    if (field === "heroImage") {
      page.heroImage = "";
    } else if (sectionId) {
      const section = page.sections.find((s) => s.sectionId === sectionId);
      if (section)
        section.images = section.images.filter((img) => img !== imageUrl);
    }
    page.updatedAt = Date.now();
    await page.save();

    res.json({ success: true, page });
  } catch (err) {
    console.error("❌ Page image remove error:", err);
    res.status(500).json({ error: "Failed to remove image" });
  }
});

// ===== PAGE ROUTES =====
// Serve root assets like Images, logo, etc. (Explicitly check extensions)
app.get("/:file", (req, res, next) => {
  const fileName = req.params.file;
  const ext = fileName.split(".").pop().toLowerCase();
  const allowedExtensions = ["png", "jpg", "jpeg", "gif", "ico", "svg"];

  if (allowedExtensions.includes(ext)) {
    const filePath = path.join(__dirname, fileName);
    if (require("fs").existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }
  next();
});

// Serve all .html files from the root directory
app.get("/:page.html", (req, res) => {
  const filePath = path.join(__dirname, req.params.page + ".html");
  if (require("fs").existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send("Page not found");
  }
});


// Also serve plain names as .html (e.g. /about -> about.html)
const commonPages = ["signin", "about", "contact", "user-dashboard", "reviews", "go", "join", "offers", "review"];
commonPages.forEach(p => {
  app.get(`/${p}`, (req, res) => res.sendFile(path.join(__dirname, `${p}.html`)));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});



// ===== START SERVER =====
if (process.env.VERCEL) {
  // Vercel serverless environments require exporting the app instead of listening
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log("\n" + "=".repeat(50));
    console.log("🚀 OM SERVICE - SERVER STARTED");
    console.log("=".repeat(50));
    console.log(`📍 Port: ${PORT}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`🔗 Admin: http://localhost:${PORT}/admin.html`);
    console.log(`🔗 Test: http://localhost:${PORT}/test-bookings.html`);
    console.log("=".repeat(50) + "\n");
  });
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down server...");
  await mongoose.connection.close();
  console.log("✅ MongoDB connection closed");
  process.exit(0);
});

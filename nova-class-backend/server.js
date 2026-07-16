const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- Victoria's routes ---
app.use("/api/auth",       require("./routes/victoria/auth.routes"));
app.use("/api/ai",         require("./routes/victoria/ai.routes"));
app.use("/api/classroom",  require("./routes/victoria/classroom.routes"));
app.use("/api/kmate",      require("./routes/victoria/kmate.routes"));
app.use("/api/progress",   require("./routes/victoria/progress.routes"));
app.use("/api/multimodal", require("./routes/victoria/multimodal.routes"));

// --- Thine's routes (add as they land in routes/thine/) ---
// app.use("/api/...", require("./routes/thine/xxx.routes"));

app.get("/", (req, res) => res.json({ status: "✅ Nova Class API running", port: process.env.PORT || 5001 }));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

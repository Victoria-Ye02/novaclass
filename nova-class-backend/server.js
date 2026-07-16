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

app.use("/api/auth",       require("./routes/auth.routes"));
app.use("/api/ai",         require("./routes/ai.routes"));
app.use("/api/classroom",  require("./routes/classroom.routes"));
app.use("/api/kmate",      require("./routes/kmate.routes"));
app.use("/api/progress",   require("./routes/progress.routes"));
app.use("/api/multimodal", require("./routes/multimodal.routes"));

app.get("/", (req, res) => res.json({ status: "✅ Nova Class API running", port: process.env.PORT || 5001 }));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

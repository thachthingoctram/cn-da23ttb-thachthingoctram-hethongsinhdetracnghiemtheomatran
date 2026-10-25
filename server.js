require("dotenv").config();
const express = require("express");
const path = require("path");
const dashboardRoutes = require("./routes/dashboard");
const questionsRoutes = require("./routes/questions");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/questions", questionsRoutes);
app.get("/api/health", (req, res) =>
    res.json({ success: true, message: "ExamGen API đang hoạt động" }),
);
app.get("*", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "index.html")),
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
    console.log(`ExamGen đang chạy tại http://localhost:${PORT}`),
);

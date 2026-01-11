const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const redis = require("redis");
const dotenv = require("dotenv");
const { createServer } = require("http");
const { Server } = require("socket.io");

const metricsRoutes = require("./routes/metrics");
const analyticsSocket = require("./websockets/analytics-socket");
const { timeStamp } = require("console");

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

app.use("/api/metrics", metricsRoutes);

app.use("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

analyticsSocket(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Analytics API running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
});

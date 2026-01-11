const redis = require("redis");

const REDIS_KEYS = {
  ordersPerMinute: "metrics:orders_per_minute",
  revenuePerMinute: "metrics:revenue_per_minute",
  topProducts: "metrics:top_products",
  ordersByStatus: "metrics:orders_by_status",
  paymentMethods: "metrics:payment_methods",
  ordersByLocation: "metrics:orders_by_location",
  totalOrders: "metrics:total_orders",
  totalRevenue: "metrics:total_revenue",
};

function analyticsSocket(io) {
  const redisClient = redis.createClient({ url: "redis://localhost:6379" });
  redisClient.connect();

  io.on("connection", (socket) => {
    console.log(`📱 Client connected: ${socket.id}`);

    sendAllMetrics(socket, redisClient);

    const updateInterval = setInterval(async () => {
      try {
        await sendAllMetrics(socket, redisClient);
      } catch (error) {
        console.error("Error sending metrics:", error);
      }
    }, 2000);

    socket.on("disconnect", () => {
      console.log(`📱 Client disconnected: ${socket.id}`);
      clearInterval(updateInterval);
    });

    // Handle specific metric requests
    socket.on("request:overview", async () => {
      const overview = await getOverviewData(redisClient);
      socket.emit("metrics:overview", overview);
    });

    socket.on("request:products", async () => {
      const products = await getTopProducts(redisClient);
      socket.emit("metrics:products", products);
    });
  });
}

async function sendAllMetrics(socket, redisClient) {
  try {
    const [overview, products, locations, payments, statuses] =
      await Promise.all([
        getOverviewData(redisClient),
        getTopProducts(redisClient),
        getLocationData(redisClient),
        getPaymentData(redisClient),
        getStatusData(redisClient),
      ]);

    socket.emit("metrics:all", {
      overview,
      products,
      locations,
      payments,
      statuses,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    socket.emit("metrics:error", { error: error.message });
  }
}

async function getOverviewData(redisClient) {
  const totalOrders = (await redisClient.get(REDIS_KEYS.totalOrders)) || 0;
  const totalRevenue = parseFloat(
    (await redisClient.get(REDIS_KEYS.totalRevenue)) || 0
  ).toFixed(2);

  return {
    totals: { orders: parseInt(totalOrders), revenue: totalRevenue },
    recentActivity: {
      ordersLastMinute: await getOrdersLastNMinutes(redisClient, 1),
      ordersLast5Minutes: await getOrdersLastNMinutes(redisClient, 5),
      revenueLastMinute: await getRevenueLastNMinutes(redisClient, 1),
    },
  };
}

async function getTopProducts(redisClient) {
  const topProducts = await redisClient.zRangeWithScores(
    REDIS_KEYS.topProducts,
    -10,
    -1,
    { REV: true }
  );

  return topProducts.map((item) => ({
    name: item.value,
    orders: item.score,
  }));
}

async function getLocationData(redisClient) {
  const locationKeys = await redisClient.keys(
    `${REDIS_KEYS.ordersByLocation}:*`
  );
  const locations = [];

  for (const key of locationKeys) {
    const location = key.split(":")[2];
    const count = await redisClient.get(key);
    locations.push({ location, orders: parseInt(count) || 0 });
  }

  return locations.sort((a, b) => b.orders - a.orders);
}

async function getPaymentData(redisClient) {
  const paymentKeys = await redisClient.keys(`${REDIS_KEYS.paymentMethods}:*`);
  const payments = [];

  for (const key of paymentKeys) {
    const method = key.split(":")[2];
    const count = await redisClient.get(key);
    payments.push({ method, orders: parseInt(count) || 0 });
  }

  return payments.sort((a, b) => b.orders - a.orders);
}

async function getStatusData(redisClient) {
  const statusKeys = await redisClient.keys(`${REDIS_KEYS.ordersByStatus}:*`);
  const statuses = [];

  for (const key of statusKeys) {
    const status = key.split(":")[2];
    const count = await redisClient.get(key);
    statuses.push({ status, orders: parseInt(count) || 0 });
  }

  return statuses;
}

async function getOrdersLastNMinutes(redisClient, minutes) {
  const currentMinute = Math.floor(Date.now() / 60000);
  let total = 0;

  for (let i = 0; i < minutes; i++) {
    const key = `${REDIS_KEYS.ordersPerMinute}:${currentMinute - i}`;
    const count = await redisClient.get(key);
    total += parseInt(count) || 0;
  }

  return total;
}

async function getRevenueLastNMinutes(redisClient, minutes) {
  const currentMinute = Math.floor(Date.now() / 60000);
  let total = 0;

  for (let i = 0; i < minutes; i++) {
    const key = `${REDIS_KEYS.revenuePerMinute}:${currentMinute - i}`;
    const revenue = await redisClient.get(key);
    total += parseFloat(revenue) || 0;
  }

  return total.toFixed(2);
}

module.exports = analyticsSocket;

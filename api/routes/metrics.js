const express = require("express");
const redis = require("redis");
const router = express.Router();

const redisClient = redis.createClient({ url: "redis://localhost:6379" });
redisClient.connect();

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

router.get("/overview", async (req, res) => {
  try {
    const overview = {
      totals: {
        orders: (await redisClient.get(REDIS_KEYS.totalOrders)) || 0,
        revenue: parseFloat(
          (await redisClient.get(REDIS_KEYS.totalRevenue)) || 0
        ).toFixed(2),
      },
      recentActivity: {
        ordersLastMinute: await getOrdersLastNMinutes(1),
        ordersLast5Minutes: await getOrdersLastNMinutes(5),
        revenueLastMinute: await getRevenueLastNMinutes(5),
      },
      timestamp: new Date().toISOString(),
    };
    res.json(overview);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch overview" });
  }
});

router.get("/products", async (req, res) => {
  try {
    const topProducts = await redisClient.zRangeWithScores(
      REDIS_KEYS.topProducts,
      -10,
      -1,
      { REV: true }
    );

    const products = [];

    for (const item of topProducts) {
      products.push({
        name: item.value,
        orders: item.score,
      });
    }
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch Products" });
  }
});

async function getOrdersLastNMinutes(minutes) {
  const currentMinute = Math.floor(Date.now() / 60000);
  let total = 0;

  for (let i = 0; i < minutes; i++) {
    const key = `${REDIS_KEYS.ordersPerMinute}:${currentMinute - i}`;
    const count = await redisClient.get(key);
    total += parseInt(count) || 0;
  }

  return total;
}

async function getRevenueLastNMinutes(minutes) {
  const currentMinute = Math.floor(Date.now() / 60000);
  let total = 0;

  for (let i = 0; i < minutes; i++) {
    const key = `${REDIS_KEYS.revenuePerMinute}:${currentMinute - i}`;
    const revenue = await redisClient.get(key);
    total += parseFloat(revenue) || 0;
  }

  return total.toFixed(2);
}

router.get("/locations", async (req, res) => {
  try {
    const locationKeys = await redisClient.keys(
      `${REDIS_KEYS.ordersByLocation}:*`
    );
    const locations = [];

    for (const key of locationKeys) {
      const location = key.split(":")[2];
      const count = await redisClient.get(key);
      locations.push({
        location,
        orders: parseInt(count) || 0,
      });
    }

    res.json(locations.sort((a, b) => b.orders - a.orders));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

router.get("/payments", async (req, res) => {
  try {
    const paymentKeys = await redisClient.keys(
      `${REDIS_KEYS.paymentMethods}:*`
    );
    const payments = [];

    for (const key of paymentKeys) {
      const method = key.split(":")[2];
      const count = await redisClient.get(key);
      payments.push({
        method,
        orders: parseInt(count) || 0,
      });
    }

    res.json(payments.sort((a, b) => b.orders - a.orders));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

router.get("/status", async (req, res) => {
  try {
    const statusKeys = await redisClient.keys(`${REDIS_KEYS.ordersByStatus}:*`);
    const statuses = [];

    for (const key of statusKeys) {
      const status = key.split(":")[2];
      const count = await redisClient.get(key);
      statuses.push({
        status,
        orders: parseInt(count) || 0,
      });
    }

    res.json(statuses);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

module.exports = router;

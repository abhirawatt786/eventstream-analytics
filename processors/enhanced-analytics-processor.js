const { Kafka } = require("kafkajs");
const redis = require("redis");
const DatabaseService = require("./database-service");
const dotenv = require("dotenv");

dotenv.config();

const kafka = new Kafka({
  clientId: "analytics-processor",
  brokers: ["localhost:9094"],
});

const consumer = kafka.consumer({ groupId: "analytics-group" });
const redisClient = redis.createClient({ url: "redis://localhost:6379" });
const dbService = new DatabaseService();

const TOPIC_NAME = "orders";
const EXPIRE_TIME = 3000;

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

async function processOrderEvent(orderData) {
  try {
    const order = JSON.parse(orderData);
    const {
      pricing: { final_amount },
      product: { name: productName, category },
      order_details: { status, payment_method, shipping_location },
      metadata: { timestamp },
    } = order;

    await Promise.all([
      updateOrdersPerMinute(),
      updateRevenuePerMinute(final_amount),
      updateTopProducts(productName),
      updateOrdersByStatus(status),
      updatePaymentMethods(payment_method),
      updateOrdersByLocation(shipping_location),
      updateTotals(final_amount),
    ]);

    await dbService.storeOrder(order);

    console.log(`✅ Processed order: ${productName} - $${final_amount}`);

    const orderCount = await redisClient.get(REDIS_KEYS.totalOrders);
    if (orderCount && parseInt(orderCount) % 100 === 0) {
      await dbService.updateHourlyAnalytics();
    }
  } catch (error) {
    console.error("Error processing order:", error.message);
  }
}

// Keep all your existing Redis functions
async function updateOrdersPerMinute() {
  const currentMinute = Math.floor(Date.now() / 60000);
  const key = `${REDIS_KEYS.ordersPerMinute}:${currentMinute}`;
  await redisClient.incr(key);
  await redisClient.expire(key, EXPIRE_TIME);
}

async function updateRevenuePerMinute(amount) {
  const currentMinute = Math.floor(Date.now() / 60000);
  const key = `${REDIS_KEYS.revenuePerMinute}:${currentMinute}`;
  await redisClient.incrByFloat(key, parseFloat(amount));
  await redisClient.expire(key, EXPIRE_TIME);
}

async function updateTopProducts(productName) {
  await redisClient.zIncrBy(REDIS_KEYS.topProducts, 1, productName);
  const count = await redisClient.zCard(REDIS_KEYS.topProducts);
  if (count > 20) {
    await redisClient.zRemRangeByRank(REDIS_KEYS.topProducts, 0, -21);
  }
}

async function updateOrdersByStatus(status) {
  const key = `${REDIS_KEYS.ordersByStatus}:${status}`;
  await redisClient.incr(key);
  await redisClient.expire(key, 3600);
}

async function updatePaymentMethods(paymentMethod) {
  const key = `${REDIS_KEYS.paymentMethods}:${paymentMethod}`;
  await redisClient.incr(key);
  await redisClient.expire(key, 3600);
}

async function updateOrdersByLocation(location) {
  const key = `${REDIS_KEYS.ordersByLocation}:${location}`;
  await redisClient.incr(key);
  await redisClient.expire(key, 3600);
}

async function updateTotals(amount) {
  await redisClient.incr(REDIS_KEYS.totalOrders);
  await redisClient.incrByFloat(REDIS_KEYS.totalRevenue, amount);
}

async function startEnhancedAnalyticsProcessor() {
  try {
    await redisClient.connect();
    await consumer.connect();

    await consumer.subscribe({ topic: TOPIC_NAME });
    console.log("🔥 Enhanced Analytics Processor started!");
    console.log("📊 Processing orders with Redis + PostgreSQL...\n");

    // Start hourly analytics job
    setInterval(async () => {
      await dbService.updateHourlyAnalytics();
    }, 60 * 60 * 1000); // Every hour

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        await processOrderEvent(message.value.toString());
      },
    });
  } catch (err) {
    console.error("Failed to start processor", err.message);
  }
}

if (require.main === module) {
  //dbService.testConnection();
  startEnhancedAnalyticsProcessor();
}

module.exports = { startEnhancedAnalyticsProcessor, dbService };

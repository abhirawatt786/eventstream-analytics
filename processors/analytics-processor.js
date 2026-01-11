const { Kafka } = require("kafkajs");
const redis = require("redis");
const dotenv = require("dotenv");

dotenv.config();

const kafka = new Kafka({
  clientId: "analytics-processor",
  brokers: ["localhost:9094"],
});

const consumer = kafka.consumer({ groupId: "analytics-group" });
const redisClient = redis.createClient({ url: "redis://localhost:6379" });

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

    await updateOrdersPerMinute();
    await updateRevenuePerMinute(final_amount);
    await updateTopProducts(productName);
    await updateOrdersByStatus(status);
    await updatePaymentMethods(payment_method);
    await updateOrdersByLocation(shipping_location);
    await updateTotals(final_amount);
    console.log(`✅ Processed order: ${productName} - $${final_amount}`);
  } catch (error) {
    console.error("Error processing order:", error.message);
  }
}

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

async function getOrdersLastNMinutes(minutes = 5) {
  const currentMinute = Math.floor(Date.now() / 60000);
  const keys = [];

  for (let i = 0; i < minutes; i++) {
    keys.push(`${REDIS_KEYS.ordersPerMinute}:${currentMinute - i}`);
  }

  const values = await redisClient.mGet(keys);
  return values.reduce((sum, val) => sum + (parseInt(val) || 0), 0);
}

async function startAnalyticsProcessor() {
  try {
    await redisClient.connect();
    await consumer.connect();

    await consumer.subscribe({ topic: TOPIC_NAME });
    console.log("🔥 Analytics Processor started!");
    console.log("📊 Processing orders in real-time...\n");

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
  startAnalyticsProcessor();
}

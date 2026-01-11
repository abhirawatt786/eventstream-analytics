const { Pool } = require("pg");
const redis = require("redis");
require("dotenv").config();

class DatabaseService {
  constructor() {
    require("dotenv").config();

    console.log("🔍 Checking environment variables...");
    console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
    console.log("Current working directory:", process.cwd());

    const sanitizedUrl = process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ":***@")
      : "Not provided";
    console.log(`🔗 Attempting to connect to: ${sanitizedUrl}`);

    let connectionString = process.env.DATABASE_URL;
    console.log(connectionString);

    let sslConfig = false;

    if (connectionString) {
      if (
        connectionString.includes("neon.tech") ||
        connectionString.includes("sslmode=require")
      ) {
        sslConfig = {
          rejectUnauthorized: false,
        };
        console.log("🔒 SSL enabled for cloud database");
      } else if (
        connectionString.includes("localhost") ||
        connectionString.includes("127.0.0.1")
      ) {
        sslConfig = false;
        console.log("🔓 SSL disabled for localhost");
      }
    }

    this.pool = new Pool({
      connectionString: connectionString,
      ssl: sslConfig,

      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
    });

    this.pool.on("error", (err) => {
      console.error("❌ PostgreSQL pool error:", err);
    });

    this.redisClient = redis.createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });

    this.redisClient.on("error", (err) => {
      console.error("❌ Redis error:", err);
    });

    this.redisClient.connect().catch(console.error);
  }

  async storeOrder(orderData) {
    let client;
    try {
      client = await this.pool.connect();
      await client.query("BEGIN");

      const orderQuery = `
        INSERT INTO orders (id, user_id, product_id, amount, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING
      `;
      await client.query(orderQuery, [
        orderData.order_id,
        orderData.user_id,
        orderData.product.id,
        orderData.pricing.final_amount,
        orderData.order_details.status,
        new Date(orderData.metadata.timestamp),
      ]);

      const paymentQuery = `
        INSERT INTO payments (id, order_id, method, amount, status, processed_at)
        VALUES (gen_random_uuid(), $1, $2, $3, 'completed', $4)
      `;
      await client.query(paymentQuery, [
        orderData.order_id,
        orderData.order_details.payment_method,
        orderData.pricing.final_amount,
        new Date(orderData.metadata.timestamp),
      ]);

      await client.query("COMMIT");
      console.log(`💾 Stored order ${orderData.order_id} in PostgreSQL`);
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Rollback error:", rollbackError.message);
        }
      }
      console.error("Database error:", error.message);
      throw error; // Re-throw for proper error handling
    } finally {
      if (client) client.release();
    }
  }

  async updateHourlyAnalytics() {
    let client;
    try {
      client = await this.pool.connect();
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0);

      const aggregateQuery = `
        INSERT INTO analytics_hourly (hour_timestamp, total_revenue, total_orders, active_users)
        SELECT 
          $1,
          COALESCE(SUM(amount), 0),
          COUNT(*),
          COUNT(DISTINCT user_id)
        FROM orders 
        WHERE created_at >= $1 AND created_at < $1 + INTERVAL '1 hour'
        ON CONFLICT (hour_timestamp) DO UPDATE SET
          total_revenue = EXCLUDED.total_revenue,
          total_orders = EXCLUDED.total_orders,
          active_users = EXCLUDED.active_users
      `;

      await client.query(aggregateQuery, [currentHour]);
      console.log(
        `📊 Updated hourly analytics for ${currentHour.toISOString()}`
      );
    } catch (error) {
      console.error("Analytics aggregation error:", error.message);
    } finally {
      if (client) client.release();
    }
  }

  async testConnection() {
    let client;
    try {
      console.log("🔄 Testing database connection...");
      client = await this.pool.connect();
      const res = await client.query(
        "SELECT NOW() as current_time, version() as pg_version"
      );
      console.log("✅ Database connected successfully!");
      console.log(`   Time: ${res.rows[0].current_time}`);
      console.log(
        `   Version: ${res.rows[0].pg_version.split(" ")[0]} ${
          res.rows[0].pg_version.split(" ")[1]
        }`
      );
      return true;
    } catch (err) {
      console.error("❌ Database connection failed:", err.message);

      // Provide helpful error messages
      if (err.message.includes("SSL")) {
        console.log("💡 SSL Configuration issue detected");
        console.log("   - For Neon: SSL is required");
        console.log("   - For localhost: SSL should be disabled");
      } else if (
        err.message.includes("SCRAM") ||
        err.message.includes("authentication")
      ) {
        console.log("💡 Authentication issue detected");
        console.log("   - Check your username and password");
        console.log("   - Verify DATABASE_URL is correct");
      } else if (
        err.message.includes("ENOTFOUND") ||
        err.message.includes("ECONNREFUSED")
      ) {
        console.log("💡 Connection issue detected");
        console.log("   - Check if the database server is running");
        console.log("   - Verify the hostname and port");
      }

      return false;
    } finally {
      if (client) client.release();
    }
  }

  async getHistoricalData(hours = 24) {
    let client;
    try {
      client = await this.pool.connect();
      const query = `
        SELECT 
          hour_timestamp,
          total_revenue,
          total_orders,
          active_users
        FROM analytics_hourly 
        WHERE hour_timestamp >= NOW() - INTERVAL '${hours} hours'
        ORDER BY hour_timestamp DESC
      `;

      const result = await client.query(query);
      return result.rows;
    } catch (error) {
      console.error("Historical data error:", error.message);
      return [];
    } finally {
      if (client) client.release();
    }
  }

  async getEnhancedMetrics() {
    let client;
    try {
      client = await this.pool.connect();
      const dailyQuery = `
        SELECT 
          COUNT(*) as orders_today,
          SUM(amount) as revenue_today,
          COUNT(DISTINCT user_id) as unique_customers,
          AVG(amount) as avg_order_value
        FROM orders 
        WHERE DATE(created_at) = CURRENT_DATE
      `;

      const productsQuery = `
        SELECT 
          product_id,
          COUNT(*) as order_count,
          SUM(amount) as total_revenue
        FROM orders 
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY product_id
        ORDER BY order_count DESC
        LIMIT 10
      `;

      const [dailyResult, productsResult] = await Promise.all([
        client.query(dailyQuery),
        client.query(productsQuery),
      ]);

      return {
        daily: dailyResult.rows[0],
        topProducts: productsResult.rows,
      };
    } catch (error) {
      console.error("Enhanced metrics error:", error.message);
      return { daily: {}, topProducts: [] };
    } finally {
      if (client) client.release();
    }
  }

  // Graceful shutdown
  async close() {
    try {
      await this.pool.end();
      await this.redisClient.quit();
      console.log("🔌 Database connections closed gracefully");
    } catch (error) {
      console.error("Error closing connections:", error.message);
    }
  }
}

module.exports = DatabaseService;

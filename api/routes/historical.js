// api/routes/historical.js
const express = require("express");
const DatabaseService = require("../../processors/database-service");
const router = express.Router();

const dbService = new DatabaseService();

// Historical hourly data for charts
router.get("/hourly/:hours?", async (req, res) => {
  try {
    const hours = parseInt(req.params.hours) || 24;
    const data = await dbService.getHistoricalData(hours);

    res.json({
      data: data.map((row) => ({
        timestamp: row.hour_timestamp,
        orders: parseInt(row.total_orders),
        revenue: parseFloat(row.total_revenue),
        activeUsers: parseInt(row.active_users),
      })),
      period: `${hours} hours`,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch historical data" });
  }
});

// Enhanced dashboard metrics
router.get("/enhanced-metrics", async (req, res) => {
  try {
    const metrics = await dbService.getEnhancedMetrics();
    res.json({
      daily: {
        ordersToday: parseInt(metrics.daily.orders_today) || 0,
        revenueToday: parseFloat(metrics.daily.revenue_today) || 0,
        uniqueCustomers: parseInt(metrics.daily.unique_customers) || 0,
        avgOrderValue: parseFloat(metrics.daily.avg_order_value) || 0,
      },
      topProducts: metrics.topProducts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch enhanced metrics" });
  }
});

// Weekly trends
router.get("/trends/weekly", async (req, res) => {
  try {
    const data = await dbService.getHistoricalData(24 * 7); // 7 days

    // Group by day
    const dailyData = {};
    data.forEach((row) => {
      const date = new Date(row.hour_timestamp).toDateString();
      if (!dailyData[date]) {
        dailyData[date] = { orders: 0, revenue: 0, activeUsers: 0 };
      }
      dailyData[date].orders += parseInt(row.total_orders);
      dailyData[date].revenue += parseFloat(row.total_revenue);
      dailyData[date].activeUsers += parseInt(row.active_users);
    });

    const trends = Object.entries(dailyData).map(([date, data]) => ({
      date,
      ...data,
    }));

    res.json({ trends, period: "7 days" });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch weekly trends" });
  }
});

// Performance comparison
router.get("/performance/:period", async (req, res) => {
  try {
    const period = req.params.period; // 'today', 'week', 'month'

    let hours;
    switch (period) {
      case "today":
        hours = 24;
        break;
      case "week":
        hours = 24 * 7;
        break;
      case "month":
        hours = 24 * 30;
        break;
      default:
        hours = 24;
    }

    const data = await dbService.getHistoricalData(hours);

    const totalOrders = data.reduce(
      (sum, row) => sum + parseInt(row.total_orders),
      0
    );
    const totalRevenue = data.reduce(
      (sum, row) => sum + parseFloat(row.total_revenue),
      0
    );
    const peakHour = data.reduce(
      (max, row) =>
        parseInt(row.total_orders) > parseInt(max.total_orders) ? row : max,
      data[0] || {}
    );

    res.json({
      period,
      summary: {
        totalOrders,
        totalRevenue: totalRevenue.toFixed(2),
        averageOrdersPerHour: Math.round(totalOrders / hours),
        peakHour: {
          timestamp: peakHour.hour_timestamp,
          orders: parseInt(peakHour.total_orders),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch performance data" });
  }
});

module.exports = router;

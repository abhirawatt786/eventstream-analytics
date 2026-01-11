"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Package,
  MapPin,
  CreditCard,
  Activity,
  Users,
} from "lucide-react";
import io from "socket.io-client";

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    overview: { totals: { orders: 0, revenue: 0 }, recentActivity: {} },
    products: [],
    locations: [],
    payments: [],
    statuses: [],
  });

  const [isConnected, setIsConnected] = useState(false);
  const [orderHistory, setOrderHistory] = useState([]);

  useEffect(() => {
    const socket = io("http://localhost:3001");

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("metrics:all", (data) => {
      const now = new Date();
      const timeLabel = now.toLocaleTimeString();

      setMetrics(data);
      setOrderHistory((prev) => {
        const newHistory = [
          ...prev,
          {
            time: timeLabel,
            orders: data.overview.recentActivity.ordersLastMinute || 0,
            revenue: Number.parseFloat(
              data.overview.recentActivity.revenueLastMinute || 0
            ),
          },
        ];
        return newHistory.slice(-20);
      });
    });

    return () => socket.close();
  }, []);

  const StatusIndicator = () => (
    <div
      className={`flex items-center gap-2 text-sm ${
        isConnected ? "text-green-500" : "text-red-500"
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full ${
          isConnected ? "bg-green-500" : "bg-red-500"
        }`}
      />
      {isConnected ? "Live" : "Disconnected"}
    </div>
  );

  // eslint-disable-next-line no-unused-vars
  const MetricCard = ({ title, value, icon: Icon, change }) => (
    <div className="bg-white p-6 rounded-1xl shadow hover:shadow-lg transition border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <Icon className="text-grey-500 w-6 h-6" />
        {change && (
          <div className="text-green-500 text-sm flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> +{change}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-gray-500 text-sm">{title}</p>
    </div>
  );

  const COLORS = [
    "#60a5fa",
    "#facc15",
    "#34d399",
    "#f87171",
    "#c084fc",
    "#38bdf8",
  ];

  return (
    <div className="bg-[#f9fafb] min-h-screen text-gray-800 font-sans">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-extrabold font-inter text-grey-600">
              Analytics Dashboard
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Real-time metrics and insights
            </p>
          </div>
          <StatusIndicator />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <MetricCard
            title="Total Orders"
            value={metrics.overview.totals.orders.toLocaleString()}
            icon={ShoppingCart}
          />
          <MetricCard
            title="Total Revenue"
            value={`$${Number.parseFloat(
              metrics.overview.totals.revenue
            ).toLocaleString()}`}
            icon={DollarSign}
          />
          <MetricCard
            title="Orders/Minute"
            value={metrics.overview.recentActivity.ordersLastMinute || 0}
            icon={Activity}
          />
          <MetricCard
            title="Revenue/Minute"
            value={`$${metrics.overview.recentActivity.revenueLastMinute || 0}`}
            icon={TrendingUp}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <div className="bg-white p-6 rounded-1xl shadow border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-grey-300">
              <Activity className="w-5 h-5" /> Live Order Flow
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={orderHistory}>
                <CartesianGrid stroke="#e5e7eb" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart */}
          <div className="bg-white p-6 rounded-1xl shadow border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-grey-300">
              <Package className="w-5 h-5" /> Top Products
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.products.slice(0, 8)}>
                <CartesianGrid stroke="#e5e7eb" />
                <XAxis type="number" stroke="#64748b" fontSize={12} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="#64748b"
                  fontSize={12}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                  }}
                />
                <Bar dataKey="orders" fill="#60a5fa" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="orders"
                    position="right"
                    fill="#374151"
                    fontSize={12}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <div className="bg-white p-6 rounded-1xl shadow border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-600">
              <CreditCard className="w-5 h-5" /> Payment Methods
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={metrics.payments}
                  cx="50%"
                  cy="40%"
                  outerRadius={100}
                  innerRadius={40}
                  fill="#8884d8"
                  dataKey="orders"
                  paddingAngle={3}
                  label={false}
                >
                  {metrics.payments.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name, props) => [
                    `${value} orders (${(
                      (value /
                        metrics.payments.reduce(
                          (sum, p) => sum + p.orders,
                          0
                        )) *
                      100
                    ).toFixed(1)}%)`,
                    props.payload.method,
                  ]}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                />
                <Legend
                  formatter={(value, entry) => (
                    <span style={{ color: entry.color, fontWeight: "bold" }}>
                      {entry.payload.method} ({entry.payload.orders})
                    </span>
                  )}
                  wrapperStyle={{
                    paddingTop: "30px",
                    fontSize: "14px",
                  }}
                  layout="horizontal"
                  align="center"
                  verticalAlign="bottom"
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {metrics.payments.map((payment, index) => (
                <div
                  key={payment.method}
                  className="flex items-center gap-2 text-sm"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="font-medium">{payment.method}</span>
                  <span className="text-gray-600">({payment.orders})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-1xl shadow border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-grey-300">
              <MapPin className="w-5 h-5" /> Orders by Location
            </h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {metrics.locations.slice(0, 10).map((loc, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center px-4 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="text-sm text-gray-700">
                      {loc.location}
                    </span>
                  </div>
                  <span className="font-bold text-gray-800">{loc.orders}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-1xl shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-grey-300">
            <Users className="w-5 h-5" /> Order Status Distribution
          </h2>
          <div className="flex flex-wrap gap-4">
            {metrics.statuses.map((status, i) => (
              <div
                key={i}
                className="px-4 py-2 rounded-full text-sm bg-gray-100 flex items-center gap-2 shadow hover:shadow-md"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="capitalize text-gray-700">
                  {status.status}
                </span>
                <span className="font-semibold text-gray-900">
                  {status.orders}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

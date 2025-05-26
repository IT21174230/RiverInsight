// floodui.js
import React, { useState, useEffect } from "react";
import "../floodui.css";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Cloud,
  Droplets,
  ThermometerSun,
  Timer,
  TrendingUp,
  BarChart3,
  Shield,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

export default function FloodDashboard() {
  const [dashboardData, setDashboardData] = useState({
    month: "",
    monthName: "",
    monthlyRiskLevel: "",
    riskBreakdown: {},
    chartData: [],
    alerts: [],
    monthlyStatistics: {},
    mainFacts: {
      temperature: "",
      waterLevel: "",
      rainfall: "",
      humidity: "",
    },
    xaiFeatureImportance: {},
    totalDaysInMonth: 0,
  });
  const [selectedDate, setSelectedDate] = useState("2025-03-15");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const fetchPrediction = (date) => {
    setLoading(true);
    fetch(`http://localhost:5000/predict/flooding?date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        setDashboardData({
          month: data.month,
          monthName: data.month_name,
          monthlyRiskLevel: data.monthly_risk_level || data.flood_warning,
          riskBreakdown: data.risk_breakdown || {},
          chartData: data.chart_data,
          alerts: data.alerts || [],
          monthlyStatistics: data.monthly_statistics || {},
          mainFacts: {
            temperature: data.predicted_temperature
              ? `${data.predicted_temperature} °C`
              : "N/A",
            waterLevel: `${(data.monthly_statistics?.average_water_area || data.predicted_water_area_km2 || 0)} km²`,
            rainfall: `${data.rainfall_mm || 0} mm`,
            humidity: data.predicted_humidity
              ? `${data.predicted_humidity} %`
              : "N/A",
          },
          xaiFeatureImportance: data.XAI_Feature_Importance || {},
          totalDaysInMonth: data.total_days_in_month || 30,
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching prediction:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPrediction(selectedDate);
  }, [selectedDate]);

  const outerBg = darkMode
    ? "bg-gray-900 text-white"
    : "bg-gray-100 text-gray-900";
  const cardBg = darkMode ? "bg-gray-800" : "bg-white";
  const headerCardBg = darkMode ? "bg-gray-700" : "bg-gray-50";

  const getRiskIcon = (risk) => {
    if (risk === "Low Risk") {
      return <CheckCircle className="h-10 w-10 text-green-500" />;
    } else if (risk === "Moderate Risk") {
      return <AlertTriangle className="h-10 w-10 text-orange-500" />;
    } else if (risk === "High Risk") {
      return <AlertCircle className="h-10 w-10 text-red-500" />;
    } else {
      return <AlertCircle className="h-10 w-10 text-gray-500" />;
    }
  };

  const getRiskColor = (risk) => {
    if (risk === "Low Risk") return "text-green-500";
    if (risk === "Moderate Risk") return "text-orange-500";
    if (risk === "High Risk") return "text-red-500";
    return "text-gray-500";
  };

  // Prepare pie chart data for risk breakdown
  const pieData = dashboardData.riskBreakdown ? [
    { name: "Low Risk Days", value: dashboardData.riskBreakdown.low_risk_days || 0, color: "#10b981" },
    { name: "Moderate Risk Days", value: dashboardData.riskBreakdown.moderate_risk_days || 0, color: "#f59e0b" },
    { name: "High Risk Days", value: dashboardData.riskBreakdown.high_risk_days || 0, color: "#ef4444" },
  ].filter(item => item.value > 0) : [];

  const {
    monthName,
    monthlyRiskLevel,
    riskBreakdown,
    chartData,
    alerts,
    monthlyStatistics,
    mainFacts,
    xaiFeatureImportance,
    totalDaysInMonth,
  } = dashboardData;

  return (
    <div className={`${outerBg} min-h-screen p-6 flex justify-center relative`}>
      {/* <button
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-4 right-4 px-4 py-2 rounded-full border transition-colors"
      >
        {darkMode ? "Light Mode" : "Dark Mode"}
      </button> */}

      <div className={`${cardBg} w-full max-w-7xl rounded-3xl p-8 shadow-lg`}>
        <h1 className="mb-6 text-3xl font-semibold text-gray-500">
          Monthly Flood Risk Assessment - Deduru Oya
        </h1>

        <div className="mb-6 flex items-center gap-4">
          <label htmlFor="date" className="font-medium">
            Select Any Date (Month will be analyzed):
          </label>
          <input
            type="date"
            id="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-md"
          />
          <button
            onClick={() => fetchPrediction(selectedDate)}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Get Monthly Risk"}
          </button>
        </div>

        {/* Monthly Overview Cards */}
        <div className="mb-8 grid pt-5 grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 rounded-xl bg-blue-600 p-4 text-white">
            <Calendar className="h-5 w-5" />
            <div>
              <div className="text-sm opacity-90">Analysis Period</div>
              <div className="font-semibold">{monthName}</div>
            </div>
          </div>
          <div className={`rounded-xl ${headerCardBg} p-4`}>
            <div className="text-sm text-gray-500 mb-1">Monthly Risk Level</div>
            <div className={`font-semibold ${getRiskColor(monthlyRiskLevel)}`}>
              {monthlyRiskLevel}
            </div>
          </div>
          <div className={`rounded-xl ${headerCardBg} p-4`}>
            <div className="text-sm text-gray-500 mb-1">High Risk Days</div>
            <div className="font-semibold text-red-500">
              {riskBreakdown.high_risk_days || 0} / {totalDaysInMonth}
            </div>
          </div>
          <div className={`rounded-xl ${headerCardBg} p-4`}>
            <div className="text-sm text-gray-500 mb-1">Average Water Area</div>
            <div className="font-semibold">
              {monthlyStatistics.average_water_area || 0} km²
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6">
          
          {/* Daily Water Level Chart */}
          <div className={`${cardBg} shadow-md rounded-xl lg:col-span-2`}>
            <h2 className="mb-4 pl-6 pt-4 text-lg font-medium text-blue-600">
              Daily Water Level Forecast - {monthName}
            </h2>
            <div className="h-[300px] pr-6 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`${value.toFixed(2)} km²`, 'Water Area']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#2563eb"
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Risk Breakdown & Alerts */}
          <div className="flex flex-col gap-6">
            
            {/* Monthly Risk Overview */}
            <div className={`${cardBg} p-6 rounded-xl shadow-md`}>
              <h3 className="mb-4 text-lg font-medium text-blue-600 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Monthly Risk Overview
              </h3>
              <div className="text-center mb-4">
                {getRiskIcon(monthlyRiskLevel)}
                <p className={`mt-2 text-lg font-semibold ${getRiskColor(monthlyRiskLevel)}`}>
                  {monthlyRiskLevel}
                </p>
              </div>
              
              {/* Risk Statistics */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>High Risk Days:</span>
                  <span className="font-semibold text-red-500">
                    {riskBreakdown.high_risk_days || 0} ({riskBreakdown.high_risk_percentage || 0}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Moderate Risk Days:</span>
                  <span className="font-semibold text-orange-500">
                    {riskBreakdown.moderate_risk_days || 0} ({riskBreakdown.moderate_risk_percentage || 0}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Low Risk Days:</span>
                  <span className="font-semibold text-green-500">
                    {riskBreakdown.low_risk_days || 0} ({((riskBreakdown.low_risk_days || 0) / totalDaysInMonth * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="font-medium">Total Days:</span>
                  <span className="font-semibold text-blue-600">
                    {totalDaysInMonth}
                  </span>
                </div>
              </div>
            </div>

            {/* Monthly Alerts */}
            <div className={`${cardBg} p-6 rounded-xl shadow-md`}>
              <h3 className="mb-4 text-lg font-medium text-blue-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Monthly Alerts & Recommendations
              </h3>
              <div className="space-y-3 max-h-40 overflow-y-auto">
                {alerts && alerts.length > 0 ? (
                  alerts.map((msg, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20"
                    >
                      <Timer className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-700 dark:text-gray-300">{msg}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No specific alerts for this month.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Information Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          
          {/* Monthly Weather & Statistics */}
          <div className={`${cardBg} p-6 shadow-md rounded-xl`}>
            <h3 className="mb-4 text-lg font-medium text-blue-600 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Monthly Weather & Water Statistics
            </h3>
            
            {/* Weather Facts */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                {
                  icon: <ThermometerSun className="h-5 w-5 text-yellow-500" />,
                  label: "Avg Temperature",
                  value: mainFacts.temperature,
                },
                {
                  icon: <Cloud className="h-5 w-5 text-gray-500" />,
                  label: "Avg Rainfall",
                  value: mainFacts.rainfall,
                },
                {
                  icon: <Droplets className="h-5 w-5 text-green-500" />,
                  label: "Avg Humidity",
                  value: mainFacts.humidity,
                },
                {
                  icon: <Droplets className="h-5 w-5 text-blue-500" />,
                  label: "Avg Water Level",
                  value: mainFacts.waterLevel,
                },
              ].map((fact, idx) => (
                <div key={idx} className="rounded-lg border p-3 flex items-center gap-3">
                  {fact.icon}
                  <div>
                    <p className="text-xs text-gray-600">{fact.label}</p>
                    <p className="text-sm font-medium">{fact.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Water Level Statistics */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Water Level Statistics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Maximum:</span>
                  <span className="font-semibold">{monthlyStatistics.max_water_area || 0} km²</span>
                </div>
                <div className="flex justify-between">
                  <span>Minimum:</span>
                  <span className="font-semibold">{monthlyStatistics.min_water_area || 0} km²</span>
                </div>
                <div className="flex justify-between">
                  <span>Standard Deviation:</span>
                  <span className="font-semibold">{monthlyStatistics.std_water_area || 0} km²</span>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Distribution Pie Chart */}
          <div className={`${cardBg} p-6 shadow-md rounded-xl`}>
            <h3 className="mb-4 text-lg font-medium text-blue-600 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Risk Distribution for {monthName}
            </h3>
            
            {pieData.length > 0 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} days`, 'Count']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-500">
                <p>No risk data available</p>
              </div>
            )}
            
            {/* Summary Text */}
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm">
                <strong>Summary:</strong> Out of {totalDaysInMonth} days in {monthName}, 
                {riskBreakdown.high_risk_days > 0 && (
                  <span className="text-red-600"> {riskBreakdown.high_risk_days} days are high risk</span>
                )}
                {riskBreakdown.moderate_risk_days > 0 && (
                  <span className="text-orange-600">
                    {riskBreakdown.high_risk_days > 0 ? ', ' : ' '}
                    {riskBreakdown.moderate_risk_days} days are moderate risk
                  </span>
                )}
                {riskBreakdown.low_risk_days > 0 && (
                  <span className="text-green-600">
                    {(riskBreakdown.high_risk_days > 0 || riskBreakdown.moderate_risk_days > 0) ? ', and ' : ' '}
                    {riskBreakdown.low_risk_days} days are low risk
                  </span>
                )}.
              </p>
            </div>
          </div>
        </div>

        {/* XAI Feature Importance */}
        {Object.keys(xaiFeatureImportance).length > 0 && (
          <div className="mt-8 p-6 rounded-xl shadow-md border bg-white dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-blue-600 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              XAI Feature Importance Analysis
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Top factors influencing flood prediction for this month:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(xaiFeatureImportance)
                .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                .map(([feature, importance], index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        importance >= 0 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {importance >= 0 ? '+' : ''}{importance.toFixed(4)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          importance >= 0 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{
                          width: `${Math.min(Math.abs(importance) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {importance >= 0 ? 'Increases' : 'Decreases'} flood risk
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Footer Information */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> This monthly risk assessment analyzes all {totalDaysInMonth} days 
            in {monthName} to provide comprehensive flood risk insights for Deduru Oya, Sri Lanka. 
            Risk levels are calculated based on predicted daily water area values and historical thresholds.
          </p>
        </div>
      </div>
    </div>
  );
}
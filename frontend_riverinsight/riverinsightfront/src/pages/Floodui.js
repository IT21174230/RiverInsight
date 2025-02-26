import { useState, useEffect } from "react";
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle, 
  Calendar, 
  Cloud, 
  Droplets, 
  ThermometerSun, 
  Timer 
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import "../index.css";

export default function FloodDashboard() {
  const [dashboardData, setDashboardData] = useState({
    date: "",
    predictedWaterArea: "",
    floodWarning: "",
    chartData: [],
    riskLevel: "",
    alerts: [],
    mainFacts: {
      temperature: "",
      waterLevel: "",
      rainfall: "",
      humidity: "",
      windSpeed: ""
    },
  });
  const [selectedDate, setSelectedDate] = useState("2025-03-15");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const fetchPrediction = (date) => {
    setLoading(true);
    fetch(`http://localhost:8000/predict?date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        setDashboardData({
          date: data.date,
          predictedWaterArea: `${data.predicted_water_area_km2} km²`,
          floodWarning: data.flood_warning,
          chartData: data.chart_data,
          riskLevel: data.risk_level || data.flood_warning,
          alerts: data.alerts || [],
          mainFacts: {
            temperature: data.predicted_temperature
              ? `${data.predicted_temperature} °C`
              : "N/A",
            waterLevel: `${data.current_water_area_km2} km²`,
            rainfall: `${data.rainfall_mm} mm`,
            humidity: data.predicted_humidity
              ? `${data.predicted_humidity} %`
              : "N/A",
            windSpeed: data.predicted_wind_speed
              ? `${data.predicted_wind_speed} km/h`
              : "N/A"
          },
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

  const outerBg = darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900";
  const cardBg = darkMode ? "bg-gray-800" : "bg-white";
  const headerCardBg = darkMode ? "bg-gray-700" : "bg-gray-50";

  // Helper function: returns a different icon based on the risk level
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

  const { date, predictedWaterArea, floodWarning, chartData, riskLevel, alerts, mainFacts } = dashboardData;

  return (
    <div className={`${outerBg} min-h-screen p-6 flex justify-center relative`}>
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-4 right-4 px-4 py-2 rounded-full border transition-colors"
      >
        {darkMode ? "Light Mode" : "Dark Mode"}
      </button>

      <div className={`${cardBg} w-full max-w-6xl rounded-3xl p-8 shadow-lg`}>
        <h1 className="mb-6 text-2xl font-semibold text-gray-500">Flood Prediction</h1>
        
        <div className="mb-6 flex items-center gap-4">
          <label htmlFor="date" className="font-medium">Select Date:</label>
          <input
            type="date"
            id="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-2 py-1 border rounded-md"
          />
          <button 
            onClick={() => fetchPrediction(selectedDate)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Get Prediction
          </button>
        </div>

        <div className="mb-8 grid pt-5 grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 rounded-xl bg-blue-600 p-4 text-white">
            <Calendar className="h-4 w-4" />
            <span>{date}</span>
          </div>
          <div className={`rounded-xl ${headerCardBg} p-4 flex justify-between`}>
            <span className="font-medium">Predicted Water Area</span>
            <span className="text-gray-400">{predictedWaterArea}</span>
          </div>
          <div className={`rounded-xl ${headerCardBg} p-4 flex justify-between`}>
            <span className="font-medium">Flood Warning</span>
            <span className="text-red-500">{floodWarning}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-10">
          <div className={`${cardBg} shadow-md rounded-xl`}>
            <h2 className="mb-4 pl-6 text-lg font-medium text-blue-600">
              Flood Details (Jan to {date})
            </h2>
            <div className="h-[325px] pr-6">
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
                  <Area type="monotone" dataKey="value" stroke="#2563eb" fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex gap-4">
              {/* Risk Level Box with dynamic icon */}
              <div className={`${cardBg} p-4 rounded-md shadow-md w-32 h-32 flex flex-col items-center justify-center`}>
                <h3 className="mb-1 text-lg font-medium text-blue-600">Risk Level</h3>
                {getRiskIcon(riskLevel)}
                <p className="mt-1 text-sm font-medium">{riskLevel}</p>
              </div>
              <div className="bg-blue-600 rounded-md p-4 shadow-md flex-1 h-32 flex flex-col">
                <h3 className="mb-1 text-lg font-medium text-white">Alerts</h3>
                <div className="space-y-1 overflow-y-auto">
                  {alerts && alerts.length > 0 ? (
                    alerts.map((msg, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded-lg bg-white p-2 text-black">
                        <Timer className="h-5 w-5 text-blue-600" />
                        <p className="text-sm">{msg}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-white">No alerts available.</p>
                  )}
                </div>
              </div>
            </div>

            <div className={`${cardBg} p-6 shadow-md rounded-xl`}>
              <h3 className="mb-4 text-lg font-medium text-blue-600">Main Facts for Flood</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    icon: <ThermometerSun className="h-6 w-6 text-yellow-500" />,
                    label: "Temperature",
                    value: mainFacts.temperature
                  },
                  {
                    icon: <Droplets className="h-6 w-6 text-blue-500" />,
                    label: "Water Level",
                    value: mainFacts.waterLevel
                  },
                  {
                    icon: <Cloud className="h-6 w-6 text-gray-500" />,
                    label: "Rainfall",
                    value: mainFacts.rainfall
                  },
                  {
                    icon: <Droplets className="h-6 w-6 text-green-500" />,
                    label: "Humidity",
                    value: mainFacts.humidity
                  },
                  
                ].map((fact, idx) => (
                  <div key={idx} className="rounded-xl border p-4 flex items-center gap-3">
                    {fact.icon}
                    <div>
                      <p className="text-sm text-gray-600">{fact.label}</p>
                      <p className="text-lg font-medium">{fact.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div> {/* End Main Content */}
      </div>
    </div>
  );
}
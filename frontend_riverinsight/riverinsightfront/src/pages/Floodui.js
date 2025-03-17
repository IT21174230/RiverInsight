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
import "../styles/FloodUi.css";

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
    explainableFactor: "",
    floodEffect: {}
  });
  const [selectedDate, setSelectedDate] = useState("2025-03-17");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPrediction = async (date) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:5000/predict?date=${date}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        mode: 'cors'
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log("Received data from Flask backend:", data);

      if (data.error) {
        throw new Error(data.error);
      }

      setDashboardData({
        date: data.date || "",
        predictedWaterArea: data.predicted_water_area_km2 ? `${data.predicted_water_area_km2} km²` : "N/A",
        floodWarning: data.flood_warning || "No warning",
        chartData: data.chart_data || [],
        riskLevel: data.risk_level || data.flood_warning || "Unknown",
        alerts: data.alerts || [],
        mainFacts: {
          temperature: data.predicted_temperature ? `${data.predicted_temperature} °C` : "N/A",
          waterLevel: data.current_water_area_km2 ? `${data.current_water_area_km2} km²` : "N/A",
          rainfall: data.rainfall_mm ? `${data.rainfall_mm} mm` : "N/A",
          humidity: data.predicted_humidity ? `${data.predicted_humidity} %` : "N/A",
          windSpeed: data.predicted_wind_speed ? `${data.predicted_wind_speed} km/h` : "N/A"
        },
        explainableFactor: data.explainable_factor?.explanation || "",
        floodEffect: data.flood_effect || {}
      });
    } catch (err) {
      console.error("Error fetching prediction from Flask:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction(selectedDate);
  }, [selectedDate]);

  const getRiskIcon = (risk) => {
    if (risk === "Low Risk") return <CheckCircle className="icon-risk success" />;
    else if (risk === "Moderate Risk") return <AlertTriangle className="icon-risk warning" />;
    else if (risk === "High Risk") return <AlertCircle className="icon-risk danger" />;
    return <AlertCircle className="icon-risk default" />;
  };

  const { date, predictedWaterArea, floodWarning, chartData, riskLevel, alerts, mainFacts, explainableFactor, floodEffect } = dashboardData;

  return (
    <div className="flood-page"> {/* Ensure top-level wrapper */}
      <div className="flood-container">
        <h1 className="flood-title">Flood Prediction</h1>
        
        <div className="date-control">
          <label htmlFor="date">Select Date:</label>
          <input
            type="date"
            id="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min="2025-01-01"
          />
          <button onClick={() => fetchPrediction(selectedDate)} disabled={loading}>
            {loading ? "Loading..." : "Get Prediction"}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle className="icon" />
            <p>{error}</p>
          </div>
        )}

        <div className="summary-grid">
          <div className="summary-box date">
            <Calendar className="icon" />
            <span>{date || "N/A"}</span>
          </div>
          <div className="summary-box">
            <span>Predicted Water Area</span>
            <span>{predictedWaterArea}</span>
          </div>
          <div className="summary-box">
            <span>Flood Warning</span>
            <span className="warning">{floodWarning}</span>
          </div>
        </div>

        <div className="main-grid">
          <div className="left-column">
            <div className="chart-section">
              <h2>Flood Details (Jan to {date || "N/A"})</h2>
              <div className="chart-wrapper">
                <ResponsiveContainer>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1a6b4b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1a6b4b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Area type="monotone" dataKey="value" stroke="#1a6b4b" fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="effects-section">
              <h3>Flood Effects on Land Cover & Land Usage</h3>
              <p><strong>Land Cover Effect:</strong> {floodEffect?.land_cover_effect || "N/A"}</p>
              <p><strong>Land Usage Effect:</strong> {floodEffect?.land_usage_effect || "N/A"}</p>
              <p>{floodEffect?.effect_explanation || ""}</p>
            </div>
          </div>

          <div className="right-column">
            <div className="risk-alert-row">
              <div className="risk-section">
                <h3>Risk Level</h3>
                {getRiskIcon(riskLevel)}
                <p>{riskLevel}</p>
              </div>
              <div className="alerts-section">
                <h3>Alerts</h3>
                <div className="alerts-list">
                  {alerts?.length > 0 ? (
                    alerts.map((msg, idx) => (
                      <div key={idx} className="alert-item">
                        <Timer className="icon" />
                        <p>{msg}</p>
                      </div>
                    ))
                  ) : (
                    <p className="no-alerts">No alerts available.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="facts-section">
              <h3>Main Facts for Flood</h3>
              <div className="facts-grid">
                {[
                  { icon: <ThermometerSun className="icon" />, label: "Temperature", value: mainFacts.temperature },
                  { icon: <Droplets className="fact-icon water-level" />, label: "Water Level", value: mainFacts.waterLevel },
                  { icon: <Cloud className="fact-icon rainfall" />, label: "Rainfall", value: mainFacts.rainfall },
                  { icon: <Droplets className="fact-icon humidity" />, label: "Humidity", value: mainFacts.humidity },
                ].map((fact, idx) => (
                  <div key={idx} className="fact-item">
                    {fact.icon}
                    <div>
                      <p className="fact-label">{fact.label}</p>
                      <p className="fact-value">{fact.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="explanation-section">
              <h3>Flood Risk Explanation</h3>
              <p>{explainableFactor}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
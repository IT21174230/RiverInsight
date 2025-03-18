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
import "../styles/FloodUi.css";  // Changed from index.css to FloodUi.css

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
    floodEffect: {}  // NEW: flood effects on land cover and land usage
  });
  const [selectedDate, setSelectedDate] = useState("2025-03-15");
  const [loading, setLoading] = useState(false);

  const fetchPrediction = (date) => {
    setLoading(true);
    // Changed port to 5000 and added error handling
    fetch(`http://localhost:5000/predict_flooding?date=${date}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      mode: 'cors'
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("Received data from Flask backend:", data); // Debug log
        if (data.error) {
          throw new Error(data.error);
        }
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
          explainableFactor: data.explainable_factor.explanation || "",
          floodEffect: data.flood_effect  // NEW: set flood effect data
        });
      })
      .catch((err) => {
        console.error("Error fetching prediction from Flask:", err);
        alert(`Failed to get prediction: ${err.message}`);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPrediction(selectedDate);
  }, [selectedDate]);

  const getRiskIcon = (risk) => {
    if (risk === "Low Risk") {
      return <CheckCircle className="icon-risk success" />;
    } else if (risk === "Moderate Risk") {
      return <AlertTriangle className="icon-risk warning" />;
    } else if (risk === "High Risk") {
      return <AlertCircle className="icon-risk danger" />;
    } else {
      return <AlertCircle className="icon-risk default" />;
    }
  };

  const { date, predictedWaterArea, floodWarning, chartData, riskLevel, alerts, mainFacts, explainableFactor, floodEffect } = dashboardData;

  return (
    <div className="flood-page">
      <div className="flood-container">
        <h1 className="flood-title">Flood Prediction</h1>
        
        <div className="date-control">
          <label htmlFor="date">Select Date:</label>
          <input
            type="date"
            id="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button onClick={() => fetchPrediction(selectedDate)}>
            Get Prediction
          </button>
        </div>

        <div className="summary-grid">
          <div className="summary-box date">
            <Calendar className="icon" />
            <span>{date}</span>
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
          {/* Left Column */}
          <div className="left-column">
            <div className="chart-section">
              <h2>Flood Details (Jan to {date})</h2>
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

          {/* Right Column */}
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
                  {
                    icon: <ThermometerSun className="icon" />,
                    label: "Temperature",
                    value: mainFacts.temperature
                  },
                  {
                    icon: <Droplets className="fact-icon water-level" />,
                    label: "Water Level",
                    value: mainFacts.waterLevel
                  },
                  {
                    icon: <Cloud className="fact-icon rainfall" />,
                    label: "Rainfall",
                    value: mainFacts.rainfall
                  },
                  {
                    icon: <Droplets className="fact-icon humidity" />,
                    label: "Humidity",
                    value: mainFacts.humidity
                  },
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
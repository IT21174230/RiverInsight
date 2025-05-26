import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, ImageOverlay, Circle, Tooltip } from "react-leaflet";
import axios from "axios";
import "./simulation_tool.css";  // make sure this is the updated CSS file with _2 classes
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconRetinaUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: redIcon.options.iconUrl,
  iconRetinaUrl: redIcon.options.iconRetinaUrl,
  shadowUrl: redIcon.options.shadowUrl,
  iconSize: redIcon.options.iconSize,
  iconAnchor: redIcon.options.iconAnchor,
  popupAnchor: redIcon.options.popupAnchor,
  shadowSize: redIcon.options.shadowSize,
});

const center = [7.60904, 79.80332];

const overlayBounds = [
  [7.62606, 79.78592],
  [7.59595, 79.86712],
];

const defaultOverlayPoints = [
  { lat: 7.6053056294716415, lng: 79.80250077227974 },
  { lat: 7.6053056294716415, lng: 79.80169228852404 },
  { lat: 7.603890782899153, lng: 79.81334792933548 },
  { lat: 7.602947551850828, lng: 79.81334792933548 },
  { lat: 7.605575124056878, lng: 79.81927681021067 },
  { lat: 7.60604673958104, lng: 79.82035478855161 },
];

const SimulationTool = () => {
  const [step, setStep] = useState(1);
  const [year, setYear] = useState(2025);
  const [maxQuarter, setMaxQuarter] = useState(1);
  const [quarterInputs, setQuarterInputs] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [csvData, setCsvData] = useState(null);
  const [heatmaps, setHeatmaps] = useState([]);
  const [imageUrl, setImageUrl] = useState("/skeleton_final_1988(1).png");
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const inputs = [];
    for (let q = 1; q <= maxQuarter; q++) {
      inputs.push({ rainfall: "", temp: "" });
    }
    setQuarterInputs(inputs);
  }, [maxQuarter]);

  const adjustCoordinates = (coordinates) => {
    return coordinates.map(([lat, lng]) => {
      const latOffset = (Math.random() - 0.5) * 0.001;
      const lngOffset = (Math.random() - 0.5) * 0.001;
      return [lat + latOffset, lng + lngOffset];
    });
  };

  useEffect(() => {
    if (predictions.length > 0) {
      const adjusted = predictions.map((pred) =>
        adjustCoordinates(pred.centerline_coordinates)
      );
      setPredictions((prev) =>
        prev.map((p, i) => ({ ...p, centerline_coordinates: adjusted[i] }))
      );
      setTimelineIndex(0);
    }
  }, [predictions.length]);

  const handleStep1Submit = (e) => {
    e.preventDefault();
    setError("");
    if (year < 2025) {
      setError("Year must be 2025 or later.");
      return;
    }
    if (maxQuarter < 1 || maxQuarter > 4) {
      setError("Quarter must be between 1 and 4.");
      return;
    }
    if (year > 2025) {
      setShowCsvUpload(true);
      setStep(0);
    } else {
      setShowCsvUpload(false);
      setStep(2);
    }
  };

  const handleQuarterInputChange = (idx, field, value) => {
    const updated = [...quarterInputs];
    updated[idx][field] = value;
    setQuarterInputs(updated);
    if (field === "temp" && value !== "" && parseFloat(value) > 100) {
      setError(`Temperature for Quarter ${idx + 1} cannot exceed 100°C. Please re-enter.`);
    } else {
      setError("");
    }
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    for (let i = 0; i < quarterInputs.length; i++) {
      const { rainfall, temp } = quarterInputs[i];
      if (
        rainfall === "" ||
        temp === "" ||
        isNaN(parseFloat(rainfall)) ||
        isNaN(parseFloat(temp))
      ) {
        setError(`Please enter valid rainfall and temperature for Quarter ${i + 1}`);
        return;
      }
    }
    setLoading(true);
    setError("");
    try {
      const inputBatch = quarterInputs.map((input, idx) => ({
        year,
        quarter: idx + 1,
        rainfall: parseFloat(input.rainfall) / 1000,
        temp: parseFloat(input.temp) + 273.15,
      }));
      const response = await axios.post(
        "http://127.0.0.1:5000/predict_simulation_tool_batch_with_heatmap",
        { inputs: inputBatch }
      );
      setPredictions(response.data.predictions || []);
      setHeatmaps(
        (response.data.predictions || []).map((p) => p.heatmap_url)
      );
      setStep(3);
      setTimelineIndex(0);
    } catch {
      setError("Failed to fetch data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.trim().split("\n");
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      if (
        !header.includes("year") ||
        !header.includes("quarter") ||
        !header.includes("rainfall") ||
        !header.includes("temp")
      ) {
        setError("CSV must have columns: year, quarter, rainfall, temp");
        return;
      }
      const data = lines.slice(1).map((line) => {
        const values = line.split(",");
        const obj = {};
        header.forEach((col, idx) => {
          obj[col] = values[idx];
        });
        return obj;
      });
      setCsvData(data);
      setError("");
    };
    reader.readAsText(file);
  };

  const handleCsvSubmit = async () => {
    if (!csvData || csvData.length === 0) {
      setError("Please upload valid CSV data");
      return;
    }
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      if (
        !row.year ||
        !row.quarter ||
        isNaN(parseInt(row.year)) ||
        isNaN(parseInt(row.quarter)) ||
        !row.rainfall ||
        !row.temp ||
        isNaN(parseFloat(row.rainfall)) ||
        isNaN(parseFloat(row.temp))
      ) {
        setError(`Invalid data in CSV row ${i + 2}`);
        return;
      }
    }
    setLoading(true);
    setError("");
    try {
      const inputBatch = csvData.map((row) => ({
        year: parseInt(row.year),
        quarter: parseInt(row.quarter),
        rainfall: parseFloat(row.rainfall),
        temp: parseFloat(row.temp),
      }));

      const response = await axios.post(
        "http://127.0.0.1:5000/predict_simulation_tool_batch_with_heatmap",
        { inputs: inputBatch }
      );

      setPredictions(response.data.predictions || []);
      setHeatmaps(
        (response.data.predictions || []).map((p) => p.heatmap_url)
      );
      setStep(3);
      setTimelineIndex(0);
      setShowCsvUpload(false);
    } catch {
      setError("Failed to fetch data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateTimelineData = () =>
    predictions.map((pred) => ({
      year: pred.year,
      quarter: pred.quarter,
      label: `${pred.year} Q${pred.quarter}`,
    }));

  const handleTimelineChange = (e) => {
    setTimelineIndex(Number(e.target.value));
  };

  const latLngDistanceMeters = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const renderControlPointMaps = () => {
    if (!predictions.length) return null;
    const currentPrediction = predictions[timelineIndex];
    if (!currentPrediction) return null;

    const clampForecastPosition = (idx, forecastPos, selectedPos) => {
      const maxDistance = 0.002;
      const latDiff = forecastPos[0] - selectedPos.lat;
      const lngDiff = forecastPos[1] - selectedPos.lng;
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

      if (distance > maxDistance) {
        const scale = maxDistance / distance;
        return [
          selectedPos.lat + latDiff * scale,
          selectedPos.lng + lngDiff * scale,
        ];
      } else if (distance < 0.0001) {
        return [
          forecastPos[0] + (Math.random() - 0.5) * 0.0001,
          forecastPos[1] + (Math.random() - 0.5) * 0.0001,
        ];
      }
      return forecastPos;
    };

    return (
      <div className="map-grid_2">
        {defaultOverlayPoints.map((point, idx) => {
          const predCoordRaw = currentPrediction.centerline_coordinates[idx];
          let position =
            Array.isArray(predCoordRaw) && predCoordRaw.length === 2
              ? predCoordRaw
              : [0, 0];

          if (idx === 4 || idx === 5) {
            position = clampForecastPosition(idx, position, point);
          }

          const distanceMeters = latLngDistanceMeters(
            point.lat,
            point.lng,
            position[0],
            position[1]
          );

          const radius = Math.max(distanceMeters, 50);

          return (
            <div key={idx} className="map-box_2" style={{ position: "relative" }}>
              <h4>Control Point {idx + 1}</h4>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 12,
                  marginBottom: 8,
                  fontSize: 14,
                  fontWeight: "600",
                  color: "#333",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div
                    style={{
                      width: 16,
                      height: 25,
                      backgroundImage:
                        'url("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png")',
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                  Select Control Point
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div
                    style={{
                      width: 16,
                      height: 25,
                      backgroundImage:
                        'url("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png")',
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                  Forecasting Point
                </div>
              </div>

              <MapContainer
                center={position}
                zoom={14}
                style={{ width: "100%", height: "300px" }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="© OpenStreetMap contributors"
                />
                <ImageOverlay url={imageUrl} bounds={overlayBounds} opacity={0.8} />

                <Marker position={[point.lat, point.lng]} icon={redIcon}>
                  <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent={false}>
                    <div>
                      <strong>Original Control Point {idx + 1}</strong>
                      <br />
                      Lat: {point.lat.toFixed(6)}
                      <br />
                      Lng: {point.lng.toFixed(6)}
                    </div>
                  </Tooltip>
                  <Popup>Original Control Point {idx + 1}</Popup>
                </Marker>

                <Marker
                  position={position}
                  icon={
                    new L.Icon({
                      iconUrl:
                        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
                      iconRetinaUrl:
                        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
                      shadowUrl: markerShadow,
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [1, -34],
                      shadowSize: [41, 41],
                    })
                  }
                >
                  <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent={false}>
                    <div>
                      <strong>Predicted Control Point {idx + 1}</strong>
                      <br />
                      Lat: {position[0].toFixed(6)}
                      <br />
                      Lng: {position[1].toFixed(6)}
                    </div>
                  </Tooltip>
                  <Popup>Predicted Control Point {idx + 1}</Popup>
                </Marker>

                <Circle
                  center={position}
                  radius={radius}
                  pathOptions={{
                    fillColor: "green",
                    color: "green",
                    fillOpacity: 0.2,
                    weight: 1,
                  }}
                />
              </MapContainer>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="simulation-container_2">
      <h2 className="title-main_2">Simulation Tool</h2>

      <h3 className="section-title_2">
        Forecasting Begins: Quarter 1, 2025 — Unlocking Future Insights
      </h3>

      {(step === 1 || step === 0) && (
        <>
          <form
            onSubmit={handleStep1Submit}
            className="custom-form_2"
            style={{ maxWidth: 600, margin: "20px auto" }}
          >
            <div
              style={{
                display: "flex",
                gap: 40,
                backgroundColor: "#e6f2e9",
                padding: "30px 40px",
                borderRadius: 16,
                boxShadow: "0 10px 24px rgba(26, 107, 75, 0.15)",
                justifyContent: "flex-start",
                alignItems: "center",
              }}
            >
              <div style={{ flex: 1, minWidth: 250 }}>
                <label
                  htmlFor="year"
                  style={{
                    display: "block",
                    fontWeight: 700,
                    color: "#1a6b4b",
                    marginBottom: 12,
                    fontSize: "1.2rem",
                    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                    textAlign: "center",
                  }}
                >
                  Year
                </label>
                <input
                  type="number"
                  id="year"
                  min={2025}
                  max={2050}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  required
                  style={{
                    width: "100%",
                    height: 48,
                    padding: "12px 18px",
                    borderRadius: 12,
                    border: "2px solid #1a6b4b",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                    transition: "border-color 0.3s ease",
                    textAlign: "center",
                    boxSizing: "border-box",
                    margin: "0 auto",
                    display: "block",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#388e3c")}
                  onBlur={(e) => (e.target.style.borderColor = "#1a6b4b")}
                />
              </div>

              <div
                style={{
                  flex: 1,
                  minWidth: 150,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <label
                  htmlFor="maxQuarter"
                  style={{
                    display: "block",
                    fontWeight: 700,
                    color: "#1a6b4b",
                    marginBottom: 12,
                    fontSize: "1.2rem",
                    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                    textAlign: "center",
                  }}
                >
                  Quarter
                </label>
                <select
                  id="maxQuarter"
                  value={maxQuarter}
                  onChange={(e) => setMaxQuarter(Number(e.target.value))}
                  required
                  className="styled-select_2"
                  style={{
                    width: "100%",
                    height: 48,
                    padding: "12px 40px 12px 18px",
                    borderRadius: 12,
                    border: "2px solid #1a6b4b",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                    backgroundColor: "white",
                    cursor: "pointer",
                    transition: "border-color 0.3s ease",
                    textAlign: "left",
                    boxSizing: "border-box",
                    appearance: "none",
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='%231a6b4b' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 14px center",
                    backgroundSize: "16px 16px",
                    margin: "0 auto",
                    display: "block",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#388e3c")}
                  onBlur={(e) => (e.target.style.borderColor = "#1a6b4b")}
                >
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={q}>
                      Quarter 0{q}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary_2"
              disabled={loading}
              style={{
                marginTop: 40,
                width: "100%",
                padding: "16px 0",
                fontWeight: 700,
                boxShadow: "0 10px 22px rgba(26, 107, 75, 0.7)",
                transition: "background-color 0.3s ease, box-shadow 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#388e3c";
                e.target.style.boxShadow = "0 12px 28px rgba(56, 142, 60, 0.9)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#1a6b4b";
                e.target.style.boxShadow = "0 10px 22px rgba(26, 107, 75, 0.7)";
              }}
            >
              {loading ? "Loading..." : "Next"}
            </button>

            {error && (
              <p
                style={{
                  color: "red",
                  marginTop: 20,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                {error}
              </p>
            )}
          </form>

          {showCsvUpload && (
            <div
              style={{
                maxWidth: 600,
                margin: "30px auto",
                padding: 20,
                backgroundColor: "#f8f8f8",
                borderRadius: 12,
                boxShadow: "0 6px 16px rgba(0,0,0,0.1)",
                textAlign: "center",
              }}
            >
              <h3 className="section-title_2" style={{ marginBottom: 15, color: "#1a6b4b" }}>
                For years beyond 2025, please upload a CSV file with columns:
                <br />
                <code>year,quarter,rainfall,temp</code>
              </h3>
              <input type="file" accept=".csv" onChange={handleCsvUpload} />
              <br />
              <button
                onClick={handleCsvSubmit}
                disabled={loading || !csvData}
                className="btn-primary_2"
                style={{
                  marginTop: 20,
                  fontWeight: 700,
                  borderRadius: 10,
                  cursor: loading || !csvData ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#388e3c";
                  e.target.style.boxShadow = "0 12px 28px rgba(56, 142, 60, 0.9)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "#1a6b4b";
                  e.target.style.boxShadow = "0 10px 22px rgba(26, 107, 75, 0.7)";
                }}
              >
                {loading ? "Uploading..." : "Submit CSV"}
              </button>
              {error && (
                <p
                  style={{
                    color: "red",
                    marginTop: 15,
                    fontWeight: 600,
                    textAlign: "center",
                  }}
                >
                  {error}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <form onSubmit={handleStep2Submit} className="custom-form_2" style={{ maxWidth: 600, margin: "20px auto" }}>
          {quarterInputs.map((input, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: 20,
                marginBottom: 15,
                alignItems: "center",
                width: "100%",
              }}
            >
              <div
                style={{
                  minWidth: 90,
                  fontWeight: 600,
                  color: "#1a6b4b",
                }}
              >
                {year} Q{idx + 1}
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <input
                  type="number"
                  placeholder="Rainfall (mm)"
                  value={input.rainfall}
                  onChange={(e) => handleQuarterInputChange(idx, "rainfall", e.target.value)}
                  required
                  step="0.01"
                  min="0"
                />
                <span style={{ fontSize: "0.92em", color: "#388e3c", marginTop: 2 }}>
                  Expected range: approximately 20 to 1000 millimeters
                </span>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <input
                  type="number"
                  placeholder="Temperature (°C)"
                  value={input.temp}
                  onChange={(e) => handleQuarterInputChange(idx, "temp", e.target.value)}
                  required
                  step="0.1"
                />
                <span style={{ fontSize: "0.92em", color: "#388e3c", marginTop: 2 }}>
                  Expected range: approximately 17 to 32 °C
                </span>
              </div>
            </div>
          ))}

          <button
            type="submit"
            className="btn-primary_2"
            disabled={loading}
            style={{
              width: "40%",
              marginTop: 20,
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#388e3c";
              e.target.style.boxShadow = "0 12px 28px rgba(56, 142, 60, 0.9)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#1a6b4b";
              e.target.style.boxShadow = "0 10px 22px rgba(26, 107, 75, 0.7)";
            }}
          >
            Run Simulation
          </button>
          {error && (
            <p style={{ color: "red", marginTop: 10, textAlign: "center" }}>{error}</p>
          )}
        </form>
      )}

      {step === 3 && (
        <>
          <div style={{ width: "100%", maxWidth: 850, margin: "40px auto -2px" }}>
            <div style={{ position: "relative", height: 60 }}>
              <input
                type="range"
                min={0}
                max={predictions.length - 1}
                value={timelineIndex}
                onChange={handleTimelineChange}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="timeline-slider_2"
              />
              {showTooltip && (
                <div
                  style={{
                    position: "absolute",
                    top: -35,
                    left: `calc(${(timelineIndex / (predictions.length - 1)) * 100}% - 40px)`,
                    width: 80,
                    padding: "4px 8px",
                    backgroundColor: "#1a6b4b",
                    color: "white",
                    fontWeight: "700",
                    fontSize: 14,
                    borderRadius: 6,
                    textAlign: "center",
                    pointerEvents: "none",
                    userSelect: "none",
                    transition: "left 0.3s ease",
                  }}
                >
                  {generateTimelineData()[timelineIndex]?.label}
                </div>
              )}
            </div>

            <div className="timeline-labels_2">
              {generateTimelineData().map((item, index) => (
                <span
                  key={index}
                  className="timeline-label_2"
                  style={{
                    color: index === timelineIndex ? "#1a6b4b" : "#999",
                    transform: index === timelineIndex ? "scale(1.2)" : "scale(1)",
                    transition: "all 0.3s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 20,
              maxWidth: 1200,
              margin: "0 auto",
              alignItems: "flex-start",
            }}
          >
            <div style={{ flex: 3.5 }}>{renderControlPointMaps()}</div>

            {heatmaps.length > 0 && (
              <div
                style={{
                  flex: 1.5,
                  textAlign: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  borderRadius: 10,
                  padding: 10,
                  backgroundColor: "#fff",
                  marginTop: 33,
                }}
              >
                <h3 className="section-title_2">Feature Importance Heatmap</h3>
                <img
                  src={heatmaps[timelineIndex]}
                  alt="Feature importance heatmap"
                  style={{ maxWidth: "100%", borderRadius: 10 }}
                />
                <div style={{ marginTop: 20, fontSize: "0.95rem", textAlign: "left" }}>
                  <p>
                    <b>
                      <center>
                        This heatmap shows which input features
                        (year, quarter, rainfall, and temperature) contributed the most to predicting
                        each of the 6 target control point movements.
                      </center>
                    </b>
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setStep(1)}
            className="btn-primary_2"
            style={{
              marginTop: 20,
              padding: "12px 30px",
              borderRadius: 10,
              fontSize: "1.2rem",
              border: "none",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#388e3c";
              e.target.style.boxShadow = "0 12px 28px rgba(56, 142, 60, 0.9)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#1a6b4b";
              e.target.style.boxShadow = "0 10px 22px rgba(26, 107, 75, 0.7)";
            }}
          >
            Modify Inputs
          </button>
        </>
      )}
    </div>
  );
};

export default SimulationTool;

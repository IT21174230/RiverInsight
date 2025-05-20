import React, { useState, useEffect } from "react";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import "./simulation_tool.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, ImageOverlay, useMap, Rectangle } from "react-leaflet";
import { Tooltip as ReactTooltip } from "react-tooltip"; // Renamed import

// Fix for default marker icons not showing in Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Define a custom red marker icon
const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41], // Size of the icon
  iconAnchor: [12, 41], // Point of the icon which will correspond to marker's location
  popupAnchor: [1, -34], // Point from which the popup should open relative to the iconAnchor
  shadowSize: [41, 41], // Size of the shadow
});

// Set the default icon for Leaflet markers (optional, if you want all markers to be red)
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const center = [7.60904, 79.80332];
const overlayBounds = [
  [7.62606, 79.78592], // Southwest corner
  [7.59595, 79.86712], // Northeast corner
];

const defaultOverlayPoints = [
  { lat: 7.6053056294716415, lng: 79.80250077227974 },
  { lat: 7.6053056294716415, lng: 79.80169228852404 },
  { lat: 7.603890782899153, lng: 79.81334792933548 },
  { lat: 7.602947551850828, lng: 79.81334792933548 },
  { lat: 7.605575124056878, lng: 79.81927681021067 },
  { lat: 7.60604673958104, lng: 79.82035478855161 },
];

// Component to display ground resolution
const GroundResolutionLabel = () => {
  const map = useMap();
  const [groundResolution, setGroundResolution] = useState("");

  // Function to calculate ground resolution
  const calculateGroundResolution = (zoom, lat) => {
    const earthCircumference = 40075017; // Earth's circumference in meters
    const resolution = (earthCircumference * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom + 8);
    return resolution.toFixed(2); // Round to 2 decimal places
  };

  // Update ground resolution when the map view changes
  useEffect(() => {
    const updateResolution = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const resolution = calculateGroundResolution(zoom, center.lat);
      setGroundResolution(`${resolution} meters/pixel`);
    };

    map.on("zoomend", updateResolution);
    map.on("moveend", updateResolution);

    // Initial calculation
    updateResolution();

    // Cleanup event listeners
    return () => {
      map.off("zoomend", updateResolution);
      map.off("moveend", updateResolution);
    };
  }, [map]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: "10px",
        left: "10px",
        zIndex: 1000,
        backgroundColor: "white",
        padding: "4px 8px", // Reduced padding
        border: "1px solid #ccc",
        borderRadius: "4px", // Smaller border radius
        boxShadow: "0 0 5px rgba(0, 0, 0, 0.3)",
        fontSize: "12px", // Smaller font size
        fontWeight: "normal", // Normal font weight
        fontFamily: "Arial, sans-serif", // Use a clean font
      }}
    >
      <strong>Resolution:</strong> {groundResolution}
    </div>
  );
};

const SimulationTool = () => {
  const [date, setDate] = useState("");
  const [rainfall, setRainfall] = useState("");
  const [temperature, setTemperature] = useState("");
  const [simulationData, setSimulationData] = useState({
    predictions: [],
    featureImportance: null,
    featureImportancePerTarget: null,
    heatmapUrl: null, // Add heatmap URL to state
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timelineIndex, setTimelineIndex] = useState(0);  // Index for timeline slider
  const [overlayPoints, setOverlayPoints] = useState(defaultOverlayPoints);
  const [imageUrl, setImageUrl] = useState("");
  const [showAllPointsMap, setShowAllPointsMap] = useState(false); // State to control the popup
  const [adjustedCoordinates, setAdjustedCoordinates] = useState([]); // Adjusted coordinates for predictions
  const [boundaryBox, setBoundaryBox] = useState(null); // State for the boundary box

  // Function to calculate the boundary box from adjusted coordinates
  const calculateBoundaryBox = (coordinates) => {
    if (coordinates.length === 0) return null;

    const lats = coordinates.map(([lat]) => lat);
    const lngs = coordinates.map(([, lng]) => lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return [
      [minLat, minLng], // Southwest corner
      [maxLat, maxLng], // Northeast corner
    ];
  };

  // Update boundary box when adjusted coordinates change
  useEffect(() => {
    if (adjustedCoordinates.length > 0 && adjustedCoordinates[timelineIndex]) {
      const box = calculateBoundaryBox(adjustedCoordinates[timelineIndex]);
      setBoundaryBox(box);
    } else {
      setBoundaryBox(null); // Reset boundary box if no coordinates are available
    }
  }, [adjustedCoordinates, timelineIndex]);

  // Function to adjust coordinates dynamically
  const adjustCoordinates = (coordinates, index) => {
    return coordinates.map(([lat, lng]) => {
      const latOffset = (Math.random() - 0.5) * 0.001; // Random offset for latitude
      const lngOffset = (Math.random() - 0.5) * 0.001; // Random offset for longitude
      return [lat + latOffset, lng + lngOffset];
    });
  };

  // Update adjusted coordinates when predictions change
  useEffect(() => {
    if (simulationData.predictions.length > 0) {
      const adjusted = simulationData.predictions.map((prediction, index) =>
        adjustCoordinates(prediction.centerline_coordinates, index)
      );
      setAdjustedCoordinates(adjusted);
    }
  }, [simulationData.predictions]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post("http://127.0.0.1:5000/predict_simulation_tool", {
        date,
        rainfall: parseFloat(rainfall),
        temp: parseFloat(temperature),
      });

      setSimulationData({
        predictions: response.data.predictions,
        featureImportance: response.data.feature_importance,
        featureImportancePerTarget: response.data.feature_importance_per_target,
        heatmapUrl: response.data.heatmap_url, // Use the heatmap URL from the backend
      });
    } catch (err) {
      setError("Failed to fetch data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (simulationData.predictions.length > 0) {
      const updatedPoints = defaultOverlayPoints.map((point, index) => {
        let data;
        if (index < 2) data = `Total Shift: ${simulationData.predictions.bend_1} m`;
        else if (index < 4) data = `Total Shift: ${simulationData.predictions.bend_2} m`;
        else data = `Total Shift: ${simulationData.predictions.bend_3} m`;
        return { ...point, data };
      });
      setOverlayPoints(updatedPoints);
    }
  }, [simulationData.predictions]);

  useEffect(() => {
    setImageUrl("/skeleton_final_1988(1).png"); // Ensure the image is in the public directory
  }, []);

  const generateChartData = (targetData) => {
    return {
      labels: ["Quarter", "Rainfall", "Temperature", "Year"],
      datasets: [
        {
          label: "Feature Importance",
          data: [
            targetData.quarter,
            targetData.rainfall,
            targetData.temperature,
            targetData.year,
          ],
          backgroundColor: [
            "#388E3C", "#4CAF50", "#1B5E20", "#66BB6A"
          ],
          borderColor: [
            "#388E3C", "#4CAF50", "#1B5E20", "#66BB6A"
          ],
          borderWidth: 1,
        },
      ],
    };
  };

  const generateTimelineData = () => {
    const timelineData = [];
    simulationData.predictions.forEach((prediction) => {
      const year = prediction.year;
      const quarter = prediction.quarter;
      timelineData.push({
        year: year,
        quarter: quarter,
        label: `${year} Q${quarter}`,
      });
    });
    return timelineData;
  };

  const handleTimelineChange = (event) => {
    const index = event.target.value;
    setTimelineIndex(index);
    const prediction = simulationData.predictions[index];
    setDate(prediction.date);
  };

  return (
    <div className="simulation-container">
      <h2>Simulation Tool</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="input-container">
          <div>
            <label htmlFor="date">Date:</label>
            <input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="rainfall">Rainfall (M):</label>
            <input type="number" id="rainfall" value={rainfall} onChange={(e) => setRainfall(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="temperature">Temperature (°C):</label>
            <input type="number" id="temperature" value={temperature} onChange={(e) => setTemperature(e.target.value)} required />
          </div>
        </div>

        {/* Run Simulation Button with Tooltip */}
        <button
          type="submit"
          disabled={loading}
          data-tooltip-id="run-simulation-tooltip"
          data-tooltip-content="Click to run the simulation. This will predict the river bend shifts based on the provided data."
        >
          {loading ? "Processing..." : "Run Simulation"}
        </button>
        <ReactTooltip id="run-simulation-tooltip" /> {/* Tooltip for the Run Simulation button */}
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Button to show the map with all control points */}
      <button
        onClick={() => setShowAllPointsMap(true)}
        className="show-all-points-button"
        data-tooltip-id="show-map-tooltip"
        data-tooltip-content="Click to view the map with all control points. This will display the original and predicted control points on the map."
      >
        Show Map with All Control Points
      </button>
      <ReactTooltip id="show-map-tooltip" /> {/* Tooltip for the Show Map button */}

      <div className="timeline-section">
        <input
          type="range"
          min="0"
          max={simulationData.predictions.length - 1}
          value={timelineIndex}
          onChange={handleTimelineChange}
          className="timeline-slider"
        />
        <div className="timeline-labels">
          {generateTimelineData().map((item, index) => (
            <span key={index} className="timeline-label">{item.label}</span>
          ))}
        </div>
      </div>
      {/* Popup/Modal for the map with all control points */}
      {showAllPointsMap && (
        <div className="popup-overlay">
          <div className="popup-content">
            <h3>Map with All Control Points</h3>
            <MapContainer center={center} zoom={14} style={{ width: "100%", height: "600px" }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <ImageOverlay
                url={imageUrl}
                bounds={overlayBounds}
                opacity={0.8}
              />
              {/* Original Coordinates (Red Markers) */}
              {overlayPoints.map((point, index) => (
                <Marker
                  key={`original-${index}`}
                  position={[point.lat, point.lng]}
                  icon={redIcon}
                  data-tooltip-id={`original-marker-tooltip-${index}`}
                  data-tooltip-content={`Original Control Point ${index + 1}: ${point.data}`}
                >
                  <Popup>{point.data}</Popup>
                </Marker>
              ))}
              {/* Adjusted Coordinates (Green Markers) */}
              {adjustedCoordinates.length > 0 &&
                adjustedCoordinates[timelineIndex].map(([lat, lng], index) => (
                  <Marker
                    key={`adjusted-${index}`}
                    position={[lat, lng]}
                    icon={new L.Icon({
                      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
                      iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
                      shadowUrl: markerShadow,
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [1, -34],
                      shadowSize: [41, 41],
                    })}
                    data-tooltip-id={`adjusted-marker-tooltip-${index}`}
                    data-tooltip-content={`Predicted Control Point ${index + 1}`}
                  >
                    <Popup>Predicted Control Point {index + 1}</Popup>
                  </Marker>
                ))}
              {/* Boundary Box */}
              {boundaryBox && (
                <Rectangle
                  bounds={boundaryBox}
                  pathOptions={{ color: "red", weight: 2, fillOpacity: 0.1 }}
                  data-tooltip-id="boundary-box-tooltip"
                  data-tooltip-content="Boundary Box: This area represents the predicted affected region."
                />
              )}
              <GroundResolutionLabel /> {/* Display ground resolution */}
            </MapContainer>
            <button onClick={() => setShowAllPointsMap(false)} className="close-popup-button">
              Close
            </button>
          </div>
        </div>
      )}

      <div className="simulation-sections">
        <div className="predictions-section">
          {simulationData.predictions && (
            <div>
              <div className="map-grid">
                {overlayPoints.map((point, index) => (
                  <div key={index} className="map-box">
                    <h4>Control Point {index + 1}</h4>
                    <MapContainer center={[point.lat, point.lng]} zoom={14} style={{ width: "100%", height: "300px" }}>
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      />
                      <ImageOverlay
                        url={imageUrl}
                        bounds={overlayBounds}
                        opacity={0.8}
                      />
                      {/* Original Coordinates (Red Markers) */}
                      <Marker
                        position={[point.lat, point.lng]}
                        icon={redIcon}
                        data-tooltip-id={`original-marker-tooltip-${index}`}
                        data-tooltip-content={`Original Control Point ${index + 1}: ${point.data}`}
                      >
                        <Popup>{point.data}</Popup>
                      </Marker>
                      {/* Adjusted Coordinates (Green Markers) */}
                      {adjustedCoordinates.length > 0 && (
                        <Marker
                          position={adjustedCoordinates[timelineIndex][index]}
                          icon={new L.Icon({
                            iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
                            iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
                            shadowUrl: markerShadow,
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41],
                          })}
                          data-tooltip-id={`adjusted-marker-tooltip-${index}`}
                          data-tooltip-content={`Predicted Control Point ${index + 1}`}
                        >
                          <Popup>Predicted Control Point {index + 1}</Popup>
                        </Marker>
                      )}
                      {/* Boundary Box */}
                      {boundaryBox && (
                        <Rectangle
                          bounds={boundaryBox}
                          pathOptions={{ color: "red", weight: 2, fillOpacity: 0.1 }}
                          data-tooltip-id="boundary-box-tooltip"
                          data-tooltip-content="Boundary Box: This area represents the predicted affected region."
                        />
                      )}
                      <GroundResolutionLabel /> {/* Display ground resolution */}
                    </MapContainer>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Heatmap Section */}
        {simulationData.heatmapUrl && (
          <div className="heatmap-section">
            <h3>Feature Importance Heatmap</h3>
            <img
              src={simulationData.heatmapUrl}
              alt="Feature Importance Heatmap"
              style={{ width: "100%", maxWidth: "800px" }}
              data-tooltip-id="heatmap-tooltip"
              data-tooltip-content="This heatmap shows the importance of features like Year, Quarter, Rainfall, and Temperature in the model. Darker colors indicate higher importance."
            />
            <ReactTooltip id="heatmap-tooltip" /> {/* Tooltip for the Heatmap */}
            <p className="heatmap-description">
              <strong>This heatmap shows the importance of features like Year, Quarter, Rainfall, and Temperature in the model. Darker colors indicate higher importance, helping you understand which features influence the predictions the most.</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimulationTool;
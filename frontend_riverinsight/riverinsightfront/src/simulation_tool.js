// import React, { useState, useEffect } from "react";
// import axios from "axios";
// import { Bar } from "react-chartjs-2";
// import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
// import "./simulation_tool.css";
// import L from "leaflet";
// import "leaflet/dist/leaflet.css";
// import { MapContainer, TileLayer, Marker, Popup, ImageOverlay, useMap, Rectangle } from "react-leaflet";
// import { Tooltip as ReactTooltip } from "react-tooltip"; // Renamed import

// // Fix for default marker icons not showing in Leaflet
// import markerIcon from 'leaflet/dist/images/marker-icon.png';
// import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// // Define a custom red marker icon
// const redIcon = new L.Icon({
//   iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
//   iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
//   shadowUrl: markerShadow,
//   iconSize: [25, 41], // Size of the icon
//   iconAnchor: [12, 41], // Point of the icon which will correspond to marker's location
//   popupAnchor: [1, -34], // Point from which the popup should open relative to the iconAnchor
//   shadowSize: [41, 41], // Size of the shadow
// });

// // Set the default icon for Leaflet markers (optional, if you want all markers to be red)
// delete L.Icon.Default.prototype._getIconUrl;
// L.Icon.Default.mergeOptions({
//   iconUrl: redIcon.options.iconUrl,
//   iconRetinaUrl: redIcon.options.iconRetinaUrl,
//   shadowUrl: redIcon.options.shadowUrl,
//   iconSize: redIcon.options.iconSize,
//   iconAnchor: redIcon.options.iconAnchor,
//   popupAnchor: redIcon.options.popupAnchor,
//   shadowSize: redIcon.options.shadowSize,
// });

// ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// const center = [7.60904, 79.80332];
// const overlayBounds = [
//   [7.62606, 79.78592], // Southwest corner
//   [7.59595, 79.86712], // Northeast corner
// ];

// const defaultOverlayPoints = [
//   { lat: 7.6053056294716415, lng: 79.80250077227974 },
//   { lat: 7.6053056294716415, lng: 79.80169228852404 },
//   { lat: 7.603890782899153, lng: 79.81334792933548 },
//   { lat: 7.602947551850828, lng: 79.81334792933548 },
//   { lat: 7.605575124056878, lng: 79.81927681021067 },
//   { lat: 7.60604673958104, lng: 79.82035478855161 },
// ];

// // Component to display ground resolution
// const GroundResolutionLabel = () => {
//   const map = useMap();
//   const [groundResolution, setGroundResolution] = useState("");

//   // Function to calculate ground resolution
//   const calculateGroundResolution = (zoom, lat) => {
//     const earthCircumference = 40075017; // Earth's circumference in meters
//     const resolution = (earthCircumference * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom + 8);
//     return resolution.toFixed(2); // Round to 2 decimal places
//   };

//   // Update ground resolution when the map view changes
//   useEffect(() => {
//     const updateResolution = () => {
//       const center = map.getCenter();
//       const zoom = map.getZoom();
//       const resolution = calculateGroundResolution(zoom, center.lat);
//       setGroundResolution(`${resolution} meters/pixel`);
//     };

//     map.on("zoomend", updateResolution);
//     map.on("moveend", updateResolution);

//     // Initial calculation
//     updateResolution();

//     // Cleanup event listeners
//     return () => {
//       map.off("zoomend", updateResolution);
//       map.off("moveend", updateResolution);
//     };
//   }, [map]);

//   return (
//     <div
//       style={{
//         position: "absolute",
//         bottom: "10px",
//         left: "10px",
//         zIndex: 1000,
//         backgroundColor: "white",
//         padding: "4px 8px", // Reduced padding
//         border: "1px solid #ccc",
//         borderRadius: "4px", // Smaller border radius
//         boxShadow: "0 0 5px rgba(0, 0, 0, 0.3)",
//         fontSize: "12px", // Smaller font size
//         fontWeight: "normal", // Normal font weight
//         fontFamily: "Arial, sans-serif", // Use a clean font
//       }}
//     >
//       <strong>Resolution:</strong> {groundResolution}
//     </div>
//   );
// };

// const SimulationTool = () => {
//   const [year, setYear] = useState(2025);    // default year
//   const [quarter, setQuarter] = useState(1); // default quarter;
//   const [rainfall, setRainfall] = useState("");
//   const [temperature, setTemperature] = useState("");
//   const [simulationData, setSimulationData] = useState({
//     predictions: [],
//     featureImportance: null,
//     featureImportancePerTarget: null,
//     heatmapUrl: null, // Add heatmap URL to state
//   });
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [timelineIndex, setTimelineIndex] = useState(0);  // Index for timeline slider
//   const [overlayPoints, setOverlayPoints] = useState(defaultOverlayPoints);
//   const [imageUrl, setImageUrl] = useState("");
//   const [showAllPointsMap, setShowAllPointsMap] = useState(false); // State to control the popup
//   const [adjustedCoordinates, setAdjustedCoordinates] = useState([]); // Adjusted coordinates for predictions
//   const [boundaryBox, setBoundaryBox] = useState(null); // State for the boundary box

//   // Function to calculate the boundary box from adjusted coordinates
//   const calculateBoundaryBox = (coordinates) => {
//     if (coordinates.length === 0) return null;

//     const lats = coordinates.map(([lat]) => lat);
//     const lngs = coordinates.map(([, lng]) => lng);

//     const minLat = Math.min(...lats);
//     const maxLat = Math.max(...lats);
//     const minLng = Math.min(...lngs);
//     const maxLng = Math.max(...lngs);

//     return [
//       [minLat, minLng], // Southwest corner
//       [maxLat, maxLng], // Northeast corner
//     ];
//   };

//   // Update boundary box when adjusted coordinates change
//   useEffect(() => {
//     if (adjustedCoordinates.length > 0 && adjustedCoordinates[timelineIndex]) {
//       const box = calculateBoundaryBox(adjustedCoordinates[timelineIndex]);
//       setBoundaryBox(box);
//     } else {
//       setBoundaryBox(null); // Reset boundary box if no coordinates are available
//     }
//   }, [adjustedCoordinates, timelineIndex]);

//   // Function to adjust coordinates dynamically
//   const adjustCoordinates = (coordinates, index) => {
//     return coordinates.map(([lat, lng]) => {
//       const latOffset = (Math.random() - 0.5) * 0.001; // Random offset for latitude
//       const lngOffset = (Math.random() - 0.5) * 0.001; // Random offset for longitude
//       return [lat + latOffset, lng + lngOffset];
//     });
//   };

//   // Update adjusted coordinates when predictions change
//   useEffect(() => {
//     if (simulationData.predictions.length > 0) {
//       const adjusted = simulationData.predictions.map((prediction, index) =>
//         adjustCoordinates(prediction.centerline_coordinates, index)
//       );
//       setAdjustedCoordinates(adjusted);
//     }
//   }, [simulationData.predictions]);

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     setError("");

//     try {
//       const response = await axios.post("http://127.0.0.1:5000/predict_simulation_tool", {
//         year: year,
//         quarter: quarter,
//         rainfall: parseFloat(rainfall),
//         temp: parseFloat(temperature),
//       });

//       setSimulationData({
//         predictions: response.data.predictions,
//         featureImportance: response.data.feature_importance,
//         featureImportancePerTarget: response.data.feature_importance_per_target,
//         heatmapUrl: response.data.heatmap_url, // Use the heatmap URL from the backend
//       });
//     } catch (err) {
//       setError("Failed to fetch data. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (simulationData.predictions.length > 0) {
//       const updatedPoints = defaultOverlayPoints.map((point, index) => {
//         let data;
//         if (index < 2) data = `Total Shift: ${simulationData.predictions.bend_1} m`;
//         else if (index < 4) data = `Total Shift: ${simulationData.predictions.bend_2} m`;
//         else data = `Total Shift: ${simulationData.predictions.bend_3} m`;
//         return { ...point, data };
//       });
//       setOverlayPoints(updatedPoints);
//     }
//   }, [simulationData.predictions]);

//   useEffect(() => {
//     setImageUrl("/skeleton_final_1988(1).png"); // Ensure the image is in the public directory
//   }, []);

//   const generateChartData = (targetData) => {
//     return {
//       labels: ["Quarter", "Rainfall", "Temperature", "Year"],
//       datasets: [
//         {
//           label: "Feature Importance",
//           data: [
//             targetData.quarter,
//             targetData.rainfall,
//             targetData.temperature,
//             targetData.year,
//           ],
//           backgroundColor: [
//             "#388E3C", "#4CAF50", "#1B5E20", "#66BB6A"
//           ],
//           borderColor: [
//             "#388E3C", "#4CAF50", "#1B5E20", "#66BB6A"
//           ],
//           borderWidth: 1,
//         },
//       ],
//     };
//   };

//   const generateTimelineData = () => {
//     const timelineData = [];
//     simulationData.predictions.forEach((prediction) => {
//       const year = prediction.year;
//       const quarter = prediction.quarter;
//       timelineData.push({
//         year: year,
//         quarter: quarter,
//         label: `${year} Q${quarter}`,
//       });
//     });
//     return timelineData;
//   };

//   const handleTimelineChange = (event) => {
//     const index = event.target.value;
//     setTimelineIndex(index);
//     const prediction = simulationData.predictions[index];
//     setYear(prediction.year);
//     setQuarter(prediction.quarter);
//   };

//   return (
//     <div className="simulation-container">
//       <h2>Simulation Tool</h2>
      
//       <form onSubmit={handleSubmit}>
//         <div className="input-container">
//           <div>
//             <label htmlFor="year">Year:</label>
//             <input type="number" id="year" min="2025" max="2050" value={year} onChange={(e) => setYear(Number(e.target.value))}required/>
//           </div>
//           {/* <div className="input-group">
//             <label htmlFor="quarter">Quarter:</label>
//             <select
//                 id="quarter"
//                 value={quarter}
//                 onChange={(e) => setQuarter(Number(e.target.value))}
//                 required>
//               <option value={1}>Quarter 01</option>
//               <option value={2}>Quarter 02</option>
//               <option value={3}>Quarter 03</option>
//               <option value={4}>Quarter 04</option>
//           </select>
//           </div> */}
//           <div style={{ display: "flex", flexDirection: "column", width: "250px" }}>
//            <label
//             htmlFor="quarter"
//             style={{
//               minWidth: "90px",  // reserve space on left to align with other labels
//               fontWeight: "600",
//               color: "#1a6b4b",
//               fontSize: "1rem",
//               marginRight: "10px", // space between label and select
//               textAlign: "left",
//             }}
//           >
//             Quarter:
//           </label>
//           <select
//             id="quarter"
//             value={quarter}
//             onChange={(e) => setQuarter(Number(e.target.value))}
//             required
//             className="styled-select"
//             style={{ height: "44px", width: "100%" }} // match input height and full width
//           >
//             <option value={1}>Q1</option>
//             <option value={2}>Q2</option>
//             <option value={3}>Q3</option>
//             <option value={4}>Q4</option>
//           </select>
//         </div>
//           <div>
//             <label htmlFor="rainfall">Rainfall (M):</label>
//             <input type="number" id="rainfall" value={rainfall} onChange={(e) => setRainfall(e.target.value)} required />
//           </div>
//           <div>
//             <label htmlFor="temperature">Temperature (°C):</label>
//             <input type="number" id="temperature" value={temperature} onChange={(e) => setTemperature(e.target.value)} required />
//           </div>
//         </div>

//         {/* Run Simulation Button with Tooltip */}
//         <button
//           type="submit"
//           disabled={loading}
//         >
//           {loading ? "Processing..." : "Run Simulation"}
//         </button>
//       </form>
//       {error && <p style={{ color: "red" }}>{error}</p>}

//       {/* Button to show the map with all control points */}
//       <button
//         onClick={() => setShowAllPointsMap(true)}
//         className="show-all-points-button"
//         data-tooltip-id="show-map-tooltip"
//         data-tooltip-content="Click to view the map with all control points. This will display the original and predicted control points on the map."
//       >
//         Show Map with All Control Points
//       </button>
//       <ReactTooltip id="show-map-tooltip" /> {/* Tooltip for the Show Map button */}

//       <div className="timeline-section">
//         <input
//           type="range"
//           min="0"
//           max={simulationData.predictions.length - 1}
//           value={timelineIndex}
//           onChange={handleTimelineChange}
//           className="timeline-slider"
//         />
//         <div className="timeline-labels">
//           {generateTimelineData().map((item, index) => (
//             <span key={index} className="timeline-label">{item.label}</span>
//           ))}
//         </div>
//       </div>
//       {/* Popup/Modal for the map with all control points */}
//       {showAllPointsMap && (
//         <div className="popup-overlay">
//           <div className="popup-content">
//             <h3>Map with All Control Points</h3>
//             <MapContainer center={center} zoom={14} style={{ width: "100%", height: "600px" }}>
//               <TileLayer
//                 url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//                 attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//               />
//               <ImageOverlay
//                 url={imageUrl}
//                 bounds={overlayBounds}
//                 opacity={0.8}
//               />
//               {/* Original Coordinates (Red Markers) */}
//               {overlayPoints.map((point, index) => (
//                 <Marker
//                   key={`original-${index}`}
//                   position={[point.lat, point.lng]}
//                   icon={redIcon}
//                   data-tooltip-id={`original-marker-tooltip-${index}`}
//                   data-tooltip-content={`Original Control Point ${index + 1}: ${point.data}`}
//                 >
//                   <Popup>{point.data}</Popup>
//                 </Marker>
//               ))}
//               {/* Adjusted Coordinates (Green Markers) */}
//               {adjustedCoordinates.length > 0 &&
//                 adjustedCoordinates[timelineIndex].map(([lat, lng], index) => (
//                   <Marker
//                     key={`adjusted-${index}`}
//                     position={[lat, lng]}
//                     icon={new L.Icon({
//                       iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
//                       iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
//                       shadowUrl: markerShadow,
//                       iconSize: [25, 41],
//                       iconAnchor: [12, 41],
//                       popupAnchor: [1, -34],
//                       shadowSize: [41, 41],
//                     })}
//                     data-tooltip-id={`adjusted-marker-tooltip-${index}`}
//                     data-tooltip-content={`Predicted Control Point ${index + 1}`}
//                   >
//                     <Popup>Predicted Control Point {index + 1}</Popup>
//                   </Marker>
//                 ))}
//               {/* Boundary Box */}
//               {boundaryBox && (
//                 <Rectangle
//                   bounds={boundaryBox}
//                   pathOptions={{ color: "red", weight: 2, fillOpacity: 0.1 }}
//                   data-tooltip-id="boundary-box-tooltip"
//                   data-tooltip-content="Boundary Box: This area represents the predicted affected region."
//                 />
//               )}
//               <GroundResolutionLabel /> {/* Display ground resolution */}
//             </MapContainer>
//             <button onClick={() => setShowAllPointsMap(false)} className="close-popup-button">
//               Close
//             </button>
//           </div>
//         </div>
//       )}

//       <div className="simulation-sections">
//         <div className="predictions-section">
//           {simulationData.predictions && (
//             <div>
//               <div className="map-grid">
//                 {overlayPoints.map((point, index) => (
//                   <div key={index} className="map-box">
//                     <h4>Control Point {index + 1}</h4>
//                     <MapContainer center={[point.lat, point.lng]} zoom={14} style={{ width: "100%", height: "300px" }}>
//                       <TileLayer
//                         url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//                         attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//                       />
//                       <ImageOverlay
//                         url={imageUrl}
//                         bounds={overlayBounds}
//                         opacity={0.8}
//                       />
//                       {/* Original Coordinates (Red Markers) */}
//                       <Marker
//                         position={[point.lat, point.lng]}
//                         icon={redIcon}
//                         data-tooltip-id={`original-marker-tooltip-${index}`}
//                         data-tooltip-content={`Original Control Point ${index + 1}: ${point.data}`}
//                       >
//                         <Popup>{point.data}</Popup>
//                       </Marker>
//                       {/* Adjusted Coordinates (Green Markers) */}
//                       {adjustedCoordinates.length > 0 && (
//                         <Marker
//                           position={adjustedCoordinates[timelineIndex][index]}
//                           icon={new L.Icon({
//                             iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
//                             iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
//                             shadowUrl: markerShadow,
//                             iconSize: [25, 41],
//                             iconAnchor: [12, 41],
//                             popupAnchor: [1, -34],
//                             shadowSize: [41, 41],
//                           })}
//                           data-tooltip-id={`adjusted-marker-tooltip-${index}`}
//                           data-tooltip-content={`Predicted Control Point ${index + 1}`}
//                         >
//                           <Popup>Predicted Control Point {index + 1}</Popup>
//                         </Marker>
//                       )}
//                       {/* Boundary Box */}
//                       {boundaryBox && (
//                         <Rectangle
//                           bounds={boundaryBox}
//                           pathOptions={{ color: "red", weight: 2, fillOpacity: 0.1 }}
//                           data-tooltip-id="boundary-box-tooltip"
//                           data-tooltip-content="Boundary Box: This area represents the predicted affected region."
//                         />
//                       )}
//                       <GroundResolutionLabel /> {/* Display ground resolution */}
//                     </MapContainer>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}
//         </div>
//         {/* Heatmap Section */}
//         {simulationData.heatmapUrl && (
//           <div className="heatmap-section">
//             <h3>Feature Importance Heatmap</h3>
//             <img
//               src={simulationData.heatmapUrl}
//               alt="Feature Importance Heatmap"
//               style={{ width: "100%", maxWidth: "800px" }}
//               data-tooltip-id="heatmap-tooltip"
//               data-tooltip-content="This heatmap shows the importance of features like Year, Quarter, Rainfall, and Temperature in the model. Darker colors indicate higher importance."
//             />
//             <ReactTooltip id="heatmap-tooltip" /> {/* Tooltip for the Heatmap */}
//             <p className="heatmap-description">
//               <strong>This heatmap shows the importance of features like Year, Quarter, Rainfall, and Temperature in the model. Darker colors indicate higher importance, helping you understand which features influence the predictions the most.</strong>
//             </p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default SimulationTool;


import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, ImageOverlay, Circle } from "react-leaflet";
import axios from "axios";
import "./simulation_tool.css";
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
  const [step, setStep] = useState(1); // 1=year/quarter select, 0=csv upload, 2=manual input, 3=show results
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
        prev.map((p, i) => ({ ...p, centerline_coordinates: adjusted[i] })))
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
      setStep(0); // Go to CSV upload step
    } else {
      setShowCsvUpload(false);
      setStep(2); // Go to input step for year 2025
    }
  };

  const handleQuarterInputChange = (idx, field, value) => {
    const updated = [...quarterInputs];
    updated[idx][field] = value;
    setQuarterInputs(updated);

    // Inline validation for temperature
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
      rainfall: parseFloat(input.rainfall) / 1000,  // Convert mm to m here
      temp: parseFloat(input.temp) + 273.15,        // Convert °C to K here
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

//   const renderControlPointMaps = () => {
//   if (!predictions.length) return null;
//   const currentPrediction = predictions[timelineIndex];
//   if (!currentPrediction) return null;

//   // Clamp forecast points 5 and 6 near selected points, but allow movement inside radius
//   const clampForecastPosition = (idx, forecastPos, selectedPos) => {
//   const maxDistance = 0.002; // increased radius (~200m)

//   const latDiff = forecastPos[0] - selectedPos.lat;
//   const lngDiff = forecastPos[1] - selectedPos.lng;

//   const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

//   if (distance > maxDistance) {
//     const scale = maxDistance / distance;
//     return [
//       selectedPos.lat + latDiff * scale,
//       selectedPos.lng + lngDiff * scale,
//     ];
//   } else if (distance < 0.0001) {
//     // add a tiny random jitter to avoid zero movement
//     return [
//       forecastPos[0] + (Math.random() - 0.5) * 0.0001,
//       forecastPos[1] + (Math.random() - 0.5) * 0.0001,
//     ];
//   }
//   return forecastPos;
// };


//   return (
//     <div className="map-grid">
//       {defaultOverlayPoints.map((point, idx) => {
//         const predCoordRaw = currentPrediction.centerline_coordinates[idx];
//         let position =
//           Array.isArray(predCoordRaw) && predCoordRaw.length === 2
//             ? predCoordRaw
//             : [0, 0];

//         // Clamp forecast points 5 and 6 near selected control points
//         if (idx === 4 || idx === 5) {
//           position = clampForecastPosition(idx, position, point);
//         }

//         return (
//           <div key={idx} className="map-box" style={{ position: "relative" }}>
//             <h4>Control Point {idx + 1}</h4>

//             {/* Legend */}
//             <div
//               style={{
//                 display: "flex",
//                 justifyContent: "center",
//                 gap: 12,
//                 marginBottom: 8,
//                 fontSize: 14,
//                 fontWeight: "600",
//                 color: "#333",
//               }}
//             >
//               <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
//                 <div
//                   style={{
//                     width: 16,
//                     height: 25,
//                     backgroundImage:
//                       'url("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png")',
//                     backgroundSize: "contain",
//                     backgroundRepeat: "no-repeat",
//                   }}
//                 />
//                 Select Control Point
//               </div>
//               <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
//                 <div
//                   style={{
//                     width: 16,
//                     height: 25,
//                     backgroundImage:
//                       'url("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png")',
//                     backgroundSize: "contain",
//                     backgroundRepeat: "no-repeat",
//                   }}
//                 />
//                 Forecasting Point
//               </div>
//             </div>

//             <MapContainer
//               center={position}
//               zoom={14}
//               style={{ width: "100%", height: "300px" }}
//             >
//               <TileLayer
//                 url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//                 attribution="© OpenStreetMap contributors"
//               />
//               <ImageOverlay url={imageUrl} bounds={overlayBounds} opacity={0.8} />

//               {/* Selected control point marker */}
//               <Marker position={[point.lat, point.lng]} icon={redIcon}>
//                 <Popup>Original Control Point {idx + 1}</Popup>
//               </Marker>

//               {/* Forecasted control point marker */}
//               <Marker
//                 position={position}
//                 icon={
//                   new L.Icon({
//                     iconUrl:
//                       "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
//                     iconRetinaUrl:
//                       "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
//                     shadowUrl: markerShadow,
//                     iconSize: [25, 41],
//                     iconAnchor: [12, 41],
//                     popupAnchor: [1, -34],
//                     shadowSize: [41, 41],
//                   })
//                 }
//               >
//                 <Popup>Predicted Control Point {idx + 1}</Popup>
//               </Marker>

//               {/* Buffer zone circle around forecast point */}
//               <Circle
//                 center={position}
//                 radius={100} // radius in meters, adjust if you want larger/smaller buffer
//                 pathOptions={{
//                   fillColor: "green",
//                   color: "green",
//                   fillOpacity: 0.2,
//                   weight: 1,
//                 }}
//               />
//             </MapContainer>
//           </div>
//         );
//       })}
//     </div>
//   );
// };

const latLngDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth radius in meters
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

  return R * c; // Distance in meters
};

const renderControlPointMaps = () => {
  if (!predictions.length) return null;
  const currentPrediction = predictions[timelineIndex];
  if (!currentPrediction) return null;

  const clampForecastPosition = (idx, forecastPos, selectedPos) => {
    const maxDistance = 0.002; // ~200m radius

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
      // tiny jitter so point moves a bit
      return [
        forecastPos[0] + (Math.random() - 0.5) * 0.0001,
        forecastPos[1] + (Math.random() - 0.5) * 0.0001,
      ];
    }
    return forecastPos;
  };

  return (
    <div className="map-grid">
      {defaultOverlayPoints.map((point, idx) => {
        const predCoordRaw = currentPrediction.centerline_coordinates[idx];
        let position =
          Array.isArray(predCoordRaw) && predCoordRaw.length === 2
            ? predCoordRaw
            : [0, 0];

        if (idx === 4 || idx === 5) {
          position = clampForecastPosition(idx, position, point);
        }

        // Calculate adaptive radius in meters for buffer circle
        const distanceMeters = latLngDistanceMeters(
          point.lat,
          point.lng,
          position[0],
          position[1]
        );

        const radius = Math.max(distanceMeters, 50); // minimum 50 meters radius

        return (
          <div key={idx} className="map-box" style={{ position: "relative" }}>
            <h4>Control Point {idx + 1}</h4>

            {/* Legend */}
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
    <div className="simulation-container">
      <h2>Simulation Tool</h2>

      <h3>Forecasting Begins: Quarter 1, 2025 — Unlocking Future Insights</h3>
      {/* Step 1 or CSV Upload */}
      {(step === 1 || step === 0) && (
        <>
          <form onSubmit={handleStep1Submit} style={{ maxWidth: 600, margin: "20px auto" }}>
            {/* Year and quarter selectors */}
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
                    fontFamily:
                      "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
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
                    fontFamily:
                      "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
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
                    fontFamily:
                      "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
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
                  className="styled-select"
                  style={{
                    width: "100%",
                    height: 48,
                    padding: "12px 40px 12px 18px",
                    borderRadius: 12,
                    border: "2px solid #1a6b4b",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    fontFamily:
                      "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
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
              disabled={loading}
              style={{
                marginTop: 40,
                width: "100%",
                padding: "16px 0",
                fontSize: "1.4rem",
                fontWeight: 700,
                backgroundColor: "#1a6b4b",
                color: "white",
                border: "none",
                borderRadius: 16,
                cursor: "pointer",
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
              <h3 style={{ color: "#1a6b4b", marginBottom: 15 }}>
                For years beyond 2025, please upload a CSV file with columns:
                <br />
                <code>year,quarter,rainfall,temp</code>
              </h3>
              <input type="file" accept=".csv" onChange={handleCsvUpload} />
              <br />
              <button
                onClick={handleCsvSubmit}
                disabled={loading || !csvData}
                style={{
                  marginTop: 20,
                  padding: "12px 30px",
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  backgroundColor: "#1a6b4b",
                  color: "white",
                  border: "none",
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
        <form onSubmit={handleStep2Submit} style={{ maxWidth: 600, margin: "20px auto" }}>
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
                style={{
                  height: 44,
                  flex: 1,
                  padding: 12,
                  fontSize: "1rem",
                  borderRadius: 8,
                  border: "2px solid #ccc",
                }}
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
                style={{
                  height: 44,
                  flex: 1,
                  padding: 12,
                  fontSize: "1rem",
                  borderRadius: 8,
                  border: "2px solid #ccc",
                }}
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
            disabled={loading}
            style={{
              backgroundColor: "#1a6b4b",
              color: "white",
              fontSize: "1.2rem",
              padding: "14px 30px",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
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
          {/* Timeline slider and labels */}
          <div style={{ marginTop: 30, marginBottom: 20 }}>
            <input
              type="range"
              min={0}
              max={predictions.length - 1}
              value={timelineIndex}
              onChange={handleTimelineChange}
              style={{ width: 850 }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: 850,
                marginTop: 5,
                marginLeft: 2
              }}
            >
              {generateTimelineData().map((item, index) => (
                <span
                  key={index}
                  style={{
                    fontSize: 14,
                    color: index === timelineIndex ? "#1a6b4b" : "#666",
                  }}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          {/* Side by side layout for maps and heatmap */}
          <div
            style={{
              display: "flex",
              gap: 20,
              maxWidth: 1200,
              margin: "0 auto",
              alignItems: "flex-start",
            }}
          >
            {/* Maps container (takes more space) */}
            <div style={{ flex: 3.5 }}>{renderControlPointMaps()}</div>

            {/* Heatmap container */}
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
                <h3>Feature Importance Heatmap</h3>
                <img
                  src={heatmaps[timelineIndex]}
                  alt="Feature importance heatmap"
                  style={{ maxWidth: "100%", borderRadius: 10 }}
                />
              {/* 🆕 Explanation Below */}
              <div style={{ marginTop: 20, fontSize: "0.95rem", textAlign: "left" }}>
                <p>
                  <b><center>This heatmap shows which input features
                  (year, quarter, rainfall, and temperature) contributed the most to predicting
                  each of the 6 target control point movements.</center></b>
                </p>
              </div>
            </div>
          )}
          </div>

          {/* Go back to Step 1 button */}
          <button
            onClick={() => setStep(1)}
            style={{
              marginTop: 20,
              backgroundColor: "#1a6b4b",
              color: "white",
              padding: "12px 30px",
              borderRadius: 10,
              cursor: "pointer",
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
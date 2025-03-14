import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import React, { useEffect, useState } from "react";
import "./RiverbankErosion.css";

// Fix for default marker icons not showing in Leaflet
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIconShadow from "leaflet/dist/images/marker-shadow.png";

const RiverbankErosion = () => {
  const [year, setYear] = useState(2025);
  const [quarter, setQuarter] = useState(1);
  const [baselinePredictions, setBaselinePredictions] = useState(null);
  const [userPredictions, setUserPredictions] = useState(null);
  const [erosionValues, setErosionValues] = useState(null);
  const [error, setError] = useState("");
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [clickedCoordinates, setClickedCoordinates] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [showHeatmapInputs, setShowHeatmapInputs] = useState(false);
  const [points, setPoints] = useState("1,2,3,4,5");
  const [timesteps, setTimesteps] = useState(5);
  const [tableData, setTableData] = useState([]);
  const [openTableModal, setOpenTableModal] = useState(false); // State to control table modal visibility

  // Coordinates for each point (latitude, longitude)
  const pointCoordinates = [
    { id: "Point_1", lat: 7.6062, lng: 79.80165 },
    { id: "Point_2", lat: 7.60504, lng: 79.80187 },
    { id: "Point_3", lat: 7.60401, lng: 79.80248 },
    { id: "Point_4", lat: 7.6032, lng: 79.80329 },
    { id: "Point_5", lat: 7.60273, lng: 79.80431 },
    { id: "Point_6", lat: 7.60223, lng: 79.80548 },
    { id: "Point_7", lat: 7.60194, lng: 79.8068 },
    { id: "Point_8", lat: 7.60195, lng: 79.8082 },
    { id: "Point_9", lat: 7.60253, lng: 79.80936 },
    { id: "Point_10", lat: 7.60308, lng: 79.81046 },
    { id: "Point_11", lat: 7.6035, lng: 79.8116 },
    { id: "Point_12", lat: 7.6035, lng: 79.81324 },
    { id: "Point_13", lat: 7.60299, lng: 79.81464 },
    { id: "Point_14", lat: 7.60215, lng: 79.81584 },
    { id: "Point_15", lat: 7.60098, lng: 79.81692 },
    { id: "Point_16", lat: 7.59991, lng: 79.8182 },
    { id: "Point_17", lat: 7.59964, lng: 79.82 },
    { id: "Point_18", lat: 7.60004, lng: 79.82129 },
    { id: "Point_19", lat: 7.60091, lng: 79.82241 },
    { id: "Point_20", lat: 7.60241, lng: 79.82277 },
    { id: "Point_21", lat: 7.60384, lng: 79.82191 },
    { id: "Point_22", lat: 7.60495, lng: 79.82064 },
    { id: "Point_23", lat: 7.60628, lng: 79.81995 },
    { id: "Point_24", lat: 7.60786, lng: 79.81949 },
    { id: "Point_25", lat: 7.60933, lng: 79.81968 },
  ];

  // Define custom icons
  const defaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x, // For high-resolution displays
    shadowUrl: markerIconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  const greenIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
    iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: markerIconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  const yellowIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png",
    iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
    shadowUrl: markerIconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  const redIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: markerIconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  // Initialize the map
  useEffect(() => {
    const mapInstance = L.map("map").setView([7.60367, 79.80292], 13); // Centered on Deduru Oya

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(mapInstance);

    // Add a legend
    const legend = L.control({ position: "topright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "legend");
      div.innerHTML = `
        <h4>Erosion Rate</h4>
        <div><span style="background: green; width: 20px; height: 20px; display: inline-block;"></span> Low (0–1 m/year)</div>
        <div><span style="background: yellow; width: 20px; height: 20px; display: inline-block;"></span> Moderate (1–5 m/year)</div>
        <div><span style="background: red; width: 20px; height: 20px; display: inline-block;"></span> Severe (>5 m/year)</div>
      `;
      return div;
    };
    legend.addTo(mapInstance);

    // Add click event listener to the map
    mapInstance.on("click", (e) => {
      const { lat, lng } = e.latlng;
      setClickedCoordinates({ lat, lng });
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`Latitude: ${lat.toFixed(5)}, Longitude: ${lng.toFixed(5)}`)
        .openOn(mapInstance);
    });

    setMap(mapInstance);

    // Cleanup on unmount
    return () => {
      mapInstance.remove();
    };
  }, []);

  // Fetch baseline predictions (2025 Q1) on component mount
  useEffect(() => {
    const fetchBaselinePredictions = async () => {
      try {
        const response = await axios.post("http://127.0.0.1:5000/predict_erosion", {
          year: 2025,
          quarter: 1,
        });

        if (response.status === 200) {
          const predictionData = response.data.predictions[0];
          const predictionsArray = Object.entries(predictionData).map(
            ([point, value]) => ({ point, value: value * 0.625 }) // Scale width values
          );
          setBaselinePredictions(predictionsArray);

          // Set user predictions to baseline predictions by default
          setUserPredictions(predictionsArray);

          // Calculate erosion values (Input Year Width - 2025 Width)
          const erosionArray = predictionsArray.map((userPred) => {
            return {
              point: userPred.point,
              value: userPred.value,
            };
          });
          setErosionValues(erosionArray);

          // Fetch heatmap for default points (1,2,3,4,5) and timesteps (5)
          const heatmapResponse = await axios.post("http://127.0.0.1:5000/predict_erosion/heatmap", {
            year: 2025,
            quarter: 1,
            points: [1, 2, 3, 4, 5],
            timesteps: 5,
          });

          if (heatmapResponse.data && heatmapResponse.data.heatmap) {
            setHeatmap(heatmapResponse.data.heatmap);
          }

          // Fetch historical data for the table
          const historyResponse = await axios.post("http://127.0.0.1:5000/predict_erosion/history", {
            startYear: 2025,
            startQuarter: 1,
            endYear: 2025,
            endQuarter: 1,
          });

          if (historyResponse.status === 200) {
            setTableData(historyResponse.data.history);
          }
        }
      } catch (err) {
        setError("Failed to fetch baseline predictions.");
      }
    };

    fetchBaselinePredictions();
  }, []);

  // Add or update markers when erosion values change
  useEffect(() => {
    if (!map || !erosionValues || !userPredictions) return;

    // Remove existing markers
    markers.forEach((marker) => marker.removeFrom(map));
    const newMarkers = [];

    pointCoordinates.forEach((point) => {
      const erosionValue = erosionValues.find((e) => e.point === point.id);
      const userPrediction = userPredictions.find((p) => p.point === point.id);

      // Calculate erosion rate
      const yearsDifference = year - 2025; // Years from 2025 to user input year
      const erosionRate = erosionValue ? (erosionValue.value / yearsDifference).toFixed(2) : 0;

      // Assign icon based on erosion rate
      let icon;
      if (erosionRate <= 1) {
        icon = greenIcon;
      } else if (erosionRate > 1 && erosionRate <= 5) {
        icon = yellowIcon;
      } else {
        icon = redIcon;
      }

      // Use the custom icon for the marker
      const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);

      // Modern UI for popup
      if (erosionValue && userPrediction) {
        const popupContent = `
          <div class="popup-container">
            <h3>${point.id.replace(/_/g, " ")}</h3>
            <div class="popup-row">
              <span class="popup-label">Erosion:</span>
              <span class="popup-value">${erosionValue.value.toFixed(2)}</span>
            </div>
            <div class="popup-row">
              <span class="popup-label">Erosion Rate:</span>
              <span class="popup-value">${erosionRate} m/year</span>
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);
      } else {
        marker.bindPopup(`<b>${point.id.replace(/_/g, " ")}</b><br>No data`);
      }
      newMarkers.push(marker);
    });

    setMarkers(newMarkers);
  }, [erosionValues, userPredictions, map, year]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setUserPredictions(null);
    setErosionValues(null);
    setHeatmap(null);
    setTableData([]); // Reset table data on new submission

    try {
      // Send POST request to the backend for user input
      const response = await axios.post("http://127.0.0.1:5000/predict_erosion", {
        year: parseInt(year),
        quarter: parseInt(quarter),
      });

      if (response.status === 200) {
        const predictionData = response.data.predictions[0];
        const predictionsArray = Object.entries(predictionData).map(
          ([point, value]) => ({ point, value: value * 0.625 }) // Scale width values
        );
        setUserPredictions(predictionsArray);

        // Calculate erosion values (Input Year Width - 2025 Width)
        if (baselinePredictions) {
          const erosionArray = predictionsArray.map((userPred) => {
            const baselinePred = baselinePredictions.find(
              (basePred) => basePred.point === userPred.point
            );
            return {
              point: userPred.point,
              value: baselinePred ? userPred.value - baselinePred.value : 0,
            };
          });
          setErosionValues(erosionArray);
        }

        // Generate heatmap for default points (1,2,3,4,5) and timesteps (5)
        const heatmapResponse = await axios.post("http://127.0.0.1:5000/predict_erosion/heatmap", {
          year: parseInt(year),
          quarter: parseInt(quarter),
          points: [1, 2, 3, 4, 5],
          timesteps: 5,
        });

        if (heatmapResponse.data && heatmapResponse.data.heatmap) {
          setHeatmap(heatmapResponse.data.heatmap);
        }

        // Fetch historical data for the table
        const historyResponse = await axios.post("http://127.0.0.1:5000/predict_erosion/history", {
          startYear: 2025,
          startQuarter: 1,
          endYear: parseInt(year),
          endQuarter: parseInt(quarter),
        });

        if (historyResponse.status === 200) {
          setTableData(historyResponse.data.history);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || "An error occurred while fetching predictions.");
    }
  };

  // Transform table data for display
  const transformTableData = (data) => {
    const transformedData = {};
    data.forEach((item) => {
      if (!transformedData[item.year]) {
        transformedData[item.year] = {};
      }
      transformedData[item.year][item.point] = item.value.toFixed(2);
    });
    return transformedData;
  };

  const tableRows = transformTableData(tableData);

  return (
    <div className="riverbank-erosion">
      <h2 className="title">Riverbank Erosion Prediction</h2>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="year" className="input-label">Year:</label>
            <input
              type="number"
              id="year"
              className="input-field"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min="2025"
              max="2100"
              step="1"
              onKeyDown={(e) => e.preventDefault()} // Prevent manual typing
            />
          </div>
          <div className="form-group">
            <label htmlFor="quarter" className="input-label" >Quarter:</label>
            <input
              type="number"
              id="quarter"
              className="input-field"
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              min="1"
              max="4"
              step="1"
              onKeyDown={(e) => e.preventDefault()} // Prevent manual typing
            />
          </div>
        </div>
        <button type="submit" className="submit-button">
          Predict
        </button>
        {/* Show Tabular Data button below Predict button */}
        <Button
          className="submit-button"
          variant="contained"
          onClick={() => setOpenTableModal(true)}
          
        >
        Show Tabular Data
      </Button>
      </form>

      {error && <p className="error-message">{error}</p>}


      {/* Split screen for map and heatmap */}
      <div className="split-screen-container">
        <div id="map" className="map-container"></div>
        {heatmap && (
          <div className="heatmap-container">
            <div style={{ marginBottom: '20px', fontFamily: 'Arial, sans-serif', color: '#333' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: '#2c3e50' }}>
                XAI Insights
              </h3>
              <p style={{ fontSize: '14px', color: '#7f8c8d', margin: 0 }}>
                Visualize feature contributions across timesteps. Adjust inputs to explore model behavior.
              </p>
            </div>
            <img src={`data:image/png;base64,${heatmap}`} alt="Heatmap" />
          </div>
        )}
      </div>

    
      {/* Table in a modal */}
      <Dialog
        open={openTableModal}
        onClose={() => setOpenTableModal(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Tabular Data</DialogTitle>
        <DialogContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Year</TableCell>
                  {pointCoordinates.map((point) => (
                    <TableCell key={point.id}>{point.id.replace(/_/g, " ")}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(tableRows).map(([year, points]) => (
                  <TableRow key={year}>
                    <TableCell>{year}</TableCell>
                    {pointCoordinates.map((point) => (
                      <TableCell key={point.id}>{points[point.id] || "-"}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTableModal(false)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Optional heatmap inputs */}
      {showHeatmapInputs && (
        <div className="heatmap-inputs">
          <label>
            Points (comma-separated):
            <input
              type="text"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="e.g., 1,2,3,4,5"
            />
          </label>
          <label>
            Timesteps:
            <input
              type="number"
              value={timesteps}
              onChange={(e) => setTimesteps(e.target.value)}
              placeholder="Default: 5"
            />
          </label>
          <button className="submit-button-2"
            onClick={async () => {
              try {
                const heatmapResponse = await axios.post("http://127.0.0.1:5000/predict_erosion/heatmap", {
                  year: parseInt(year),
                  quarter: parseInt(quarter),
                  points: points.split(",").map(Number),
                  timesteps: parseInt(timesteps),
                });

                if (heatmapResponse.data && heatmapResponse.data.heatmap) {
                  setHeatmap(heatmapResponse.data.heatmap);
                }
              } catch (err) {
                setError("Failed to generate heatmap.");
              }
            }}
          >
            Update Heatmap
          </button>
        </div>
      )}

      <button
        className="submit-button-2"
        onClick={() => setShowHeatmapInputs(!showHeatmapInputs)}
      >
        {showHeatmapInputs ? "Hide Heatmap Inputs" : "Show Heatmap Inputs"}
      </button>
    </div>
  );
};

export default RiverbankErosion;
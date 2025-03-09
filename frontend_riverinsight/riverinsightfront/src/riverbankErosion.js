import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css"; // Import Leaflet CSS
import React, { useEffect, useState } from "react";
import "./RiverbankErosion.css"; // Add CSS for styling

// Fix for default marker icons not showing in Leaflet
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png"; // For high-resolution displays
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIconShadow from "leaflet/dist/images/marker-shadow.png";

const RiverbankErosion = () => {
  const [year, setYear] = useState(2025); // Default year set to 2025
  const [quarter, setQuarter] = useState(1); // Default quarter set to 1
  const [baselinePredictions, setBaselinePredictions] = useState(null); // Baseline predictions for 2025 Q1
  const [userPredictions, setUserPredictions] = useState(null); // Predictions for user input
  const [erosionValues, setErosionValues] = useState(null); // Erosion values (differences)
  const [error, setError] = useState("");
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [clickedCoordinates, setClickedCoordinates] = useState(null); // State to store clicked coordinates

  // Coordinates for each point (latitude, longitude)
  const pointCoordinates = [
    { id: "Point_1", lat: 7.60620, lng: 79.80165 },
    { id: "Point_2", lat: 7.60504, lng: 79.80187 },
    { id: "Point_3", lat: 7.60401, lng: 79.80248 },
    { id: "Point_4", lat: 7.60320, lng: 79.80329 },
    { id: "Point_5", lat: 7.60273, lng: 79.80431 },
    { id: "Point_6", lat: 7.60223, lng: 79.80548 },
    { id: "Point_7", lat: 7.60194, lng: 79.80680 },
    { id: "Point_8", lat: 7.60195, lng: 79.80820 },
    { id: "Point_9", lat: 7.60253, lng: 79.80936 },
    { id: "Point_10", lat: 7.60308, lng: 79.81046 },//marked
    { id: "Point_11", lat: 7.60350, lng: 79.81160 },
    { id: "Point_12", lat: 7.60350, lng:  79.81324 },
    { id: "Point_13", lat: 7.60299, lng: 79.81464 },
    { id: "Point_14", lat: 7.60215, lng:  79.81584 },
    { id: "Point_15", lat: 7.60098, lng: 79.81692 },
    { id: "Point_16", lat: 7.59991, lng: 79.81820  },
    { id: "Point_17", lat: 7.59964, lng: 79.82000 },
    { id: "Point_18", lat: 7.60004, lng: 79.82129 },
    { id: "Point_19", lat: 7.60091, lng: 79.82241 },
    { id: "Point_20", lat: 7.60241, lng: 79.82277 },
    { id: "Point_21", lat: 7.60384, lng: 79.82191 },
    { id: "Point_22", lat: 7.60495, lng: 79.82064 },
    { id: "Point_23", lat: 7.60628, lng: 79.81995 },
    { id: "Point_24", lat: 7.60786, lng: 79.81949 },
    { id: "Point_25", lat: 7.60933, lng: 79.81968    }
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
            <h3>${point.id}</h3>
            <div class="popup-row">
              <span class="popup-label">Width:</span>
              <span class="popup-value">${userPrediction.value.toFixed(2)}</span>
            </div>
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
        marker.bindPopup(`<b>${point.id}</b><br>No data`);
      }
      newMarkers.push(marker);
    });

    setMarkers(newMarkers);
  }, [erosionValues, userPredictions, map, year]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setUserPredictions(null);
    setErosionValues(null);

    try {
      // Send POST request to the backend for user input
      const response = await axios.post("http://127.0.0.1:5000/predict_erosion", {
        year: parseInt(year),
        quarter: parseInt(quarter),
      });

      // Handle response
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
              value: baselinePred ? userPred.value - baselinePred.value : 0, // Input Year Width - 2025 Width
            };
          });
          setErosionValues(erosionArray);
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "An error occurred while fetching predictions."
      );
    }
  };

  return (
    <div className="riverbank-erosion">
      <h2>Riverbank Erosion Prediction</h2>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="year">Year:</label>
            <input
              type="number"
              id="year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min="2025"
              max="2100"
              step="1"
              onKeyDown={(e) => e.preventDefault()} // Prevent manual typing
            />
          </div>
          <div className="form-group">
            <label htmlFor="quarter">Quarter:</label>
            <input
              type="number"
              id="quarter"
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
      </form>

      {error && <p className="error-message">{error}</p>}

      <div id="map" className="map-container"></div>

      {clickedCoordinates && (
        <div className="coordinates-display">
          <h3>Clicked Coordinates</h3>
          <p>Latitude: {clickedCoordinates.lat.toFixed(5)}</p>
          <p>Longitude: {clickedCoordinates.lng.toFixed(5)}</p>
        </div>
      )}
    </div>
  );
};

export default RiverbankErosion;
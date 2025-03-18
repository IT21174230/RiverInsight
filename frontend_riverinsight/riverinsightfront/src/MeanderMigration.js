import React, { useState, useEffect } from "react";
import { GoogleMap, GroundOverlay, useJsApiLoader, InfoWindow, Marker } from "@react-google-maps/api";
import { FaArrowRight, FaArrowLeft } from "react-icons/fa";
import "./MapWithOverlay.css";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const mapContainerStyle = {
  width: "100%",
  height: "500px",
};

const center = { lat: 7.60904, lng: 79.80332 };

const overlayBounds = {
  north: 7.62606,
  south: 7.59595,
  east: 79.86712,
  west: 79.78592,
};

const defaultOverlayPoints = [
  { lat: 7.6053056294716415, lng: 79.80250077227974 },
  { lat: 7.6053056294716415, lng: 79.80169228852404 },
  { lat: 7.603890782899153, lng: 79.81334792933548 },
  { lat: 7.602947551850828, lng: 79.81334792933548 },
  { lat: 7.605575124056878, lng: 79.81927681021067 },
  { lat: 7.60604673958104, lng: 79.82035478855161 },
];

const MapWithOverlay = ({ latestData, earliestData }) => {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });

  const [imageUrl, setImageUrl] = useState("");
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [overlayPoints, setOverlayPoints] = useState(defaultOverlayPoints);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setImageUrl(window.location.origin + "/skeleton_final_1988(1).png");
  }, []);

  useEffect(() => {
    if (!latestData || !earliestData) return;

    const yearsElapsed = latestData.year - earliestData.year || 1; // Prevent division by zero

    // Compute migration rates
    const migrationRates = {
      c1_rate: yearsElapsed !== 0 ? ((latestData.c1_dist - earliestData.c1_dist) / yearsElapsed).toFixed(4) : "N/A",
      c2_rate: yearsElapsed !== 0 ? ((latestData.c2_dist - earliestData.c2_dist) / yearsElapsed).toFixed(4) : "N/A",
      bend_1_rate: yearsElapsed !== 0 ? ((latestData.bend_1 - earliestData.bend_1) / yearsElapsed).toFixed(4) : "N/A",
      c3_rate: yearsElapsed !== 0 ? ((latestData.c3_dist - earliestData.c3_dist) / yearsElapsed).toFixed(4) : "N/A",
      c4_rate: yearsElapsed !== 0 ? ((latestData.c4_dist - earliestData.c4_dist) / yearsElapsed).toFixed(4) : "N/A",
      bend_2_rate: yearsElapsed !== 0 ? ((latestData.bend_2 - earliestData.bend_2) / yearsElapsed).toFixed(4) : "N/A",
      c7_rate: yearsElapsed !== 0 ? ((latestData.c7_dist - earliestData.c7_dist) / yearsElapsed).toFixed(4) : "N/A",
      c8_rate: yearsElapsed !== 0 ? ((latestData.c8_dist - earliestData.c8_dist) / yearsElapsed).toFixed(4) : "N/A",
      bend_3_rate: yearsElapsed !== 0 ? ((latestData.bend_3 - earliestData.bend_3) / yearsElapsed).toFixed(4) : "N/A",
    };
    

    // Update overlay points with data
    const updatedPoints = defaultOverlayPoints.map((point, index) => {
      let migrationInfo = `Control Point Shift: ${migrationRates[`c${index + 1}_rate`] || "N/A"} m/year`;

      // Assign corresponding bend migration rates
      if (index < 2) migrationInfo += `\n\nBend 1 Rate: ${migrationRates.bend_1_rate} m/year`;
      else if (index < 4) migrationInfo += `\n\nBend 2 Rate: ${migrationRates.bend_2_rate} m/year`;
      else migrationInfo += `\nBend 3 Rate: ${migrationRates.bend_3_rate} m/year`;

      return { ...point, data: migrationInfo };
    });

    setOverlayPoints(updatedPoints);
  }, [latestData, earliestData]);

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 2) % overlayPoints.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 2 + overlayPoints.length) % overlayPoints.length);
  };

  if (!isLoaded) return <div className="loading">Loading...</div>;

  return (
    <div className="map-container">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={17}
        center={overlayPoints[currentIndex] || center}
        mapTypeId="satellite"
        options={{
          scaleControl: true,
          maxZoom: 20,
          minZoom: 15,
          disableDefaultUI: false,
          streetViewControl: false,
          mapTypeControl: true,
        }}
      >
        {imageUrl && <GroundOverlay bounds={overlayBounds} url={imageUrl} opacity={0.8} />}

        {[overlayPoints[currentIndex], overlayPoints[currentIndex + 1]].map((point, index) =>
          point ? (
            <Marker
              key={`${point.lat}-${point.lng}`}
              position={{ lat: point.lat, lng: point.lng }}
              title="Click for information"
              onClick={() =>
                setSelectedPoint(
                  selectedPoint?.lat === point.lat && selectedPoint?.lng === point.lng ? null : point
                )
              }
            />
          ) : null
        )}

        {selectedPoint && (
          <InfoWindow position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }} onCloseClick={() => setSelectedPoint(null)}>
            <div className="info-window">
              <strong>Point Data</strong>
              <p>{selectedPoint.data}</p>
              <p>Latitude: {selectedPoint.lat}, Longitude: {selectedPoint.lng}</p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      <div className="navigation-buttons">
        <button data-tooltip-id="nav-prev" className="prev-button" onClick={handlePrev}>
          <FaArrowLeft />
        </button>
        <button data-tooltip-id="nav-next" className="next-button" onClick={handleNext}>
          <FaArrowRight />
        </button>
        <Tooltip id="nav-prev" content="Navigate to the previous site" />
        <Tooltip id="nav-next" content="Navigate to the next site" />
      </div>
    </div>
  );
};

export default MapWithOverlay;

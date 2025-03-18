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

const MapWithOverlay = ({ latestData }) => {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });
  
  const [imageUrl, setImageUrl] = useState("");
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [overlayPoints, setOverlayPoints] = useState(defaultOverlayPoints);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setImageUrl(window.location.origin + "/skeleton_final_1988(1).png");
  }, []);

  useEffect(() => {
    if (latestData) {
      const updatedPoints = defaultOverlayPoints.map((point, index) => {
        let data;
        if (index < 2) data = `Total Shift: ${latestData.bend_1} m`;
        else if (index < 4) data = `Total Shift: ${latestData.bend_2} m`;
        else data = `Total Shift: ${latestData.bend_3} m`;
        return { ...point, data };
      });
      setOverlayPoints(updatedPoints);
    }
  }, [latestData]);

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
        center={overlayPoints[currentIndex] || center} // Fallback to center
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

        {[overlayPoints[currentIndex], overlayPoints[currentIndex + 1]].map((point, index) => (
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
        ))}


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
        <button data-tooltip-id="nav-prev"  className="prev-button" onClick={handlePrev}>
          <FaArrowLeft />
        </button>
        <button  data-tooltip-id="nav-next"  className="next-button" onClick={handleNext}>
          <FaArrowRight />
        </button>
        <Tooltip id="nav-prev" content="Navigate to the previous site" />
        <Tooltip id="nav-next" content="navigate to the next site" />
      </div>
    </div>
  );
};

export default MapWithOverlay;

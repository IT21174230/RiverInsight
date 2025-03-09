import React, { useState, useEffect } from "react";
import { GoogleMap, GroundOverlay, useJsApiLoader, InfoWindow, Marker } from "@react-google-maps/api";
import "./MapWithOverlay.css"; // Import the CSS file

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const mapContainerStyle = {
  width: "100%",
  height: "500px",
};

// Centered on the river location
const center = { lat: 7.60904, lng: 79.80332 };

// Define map overlay bounds
const overlayBounds = {
  north: 7.62606,
  south: 7.59595,
  east: 79.86712,
  west: 79.78592,
};

// Define overlay points with approximate lat/lng values and dummy data
const overlayPoints = [
  { lat: 7.6105, lng: 79.8055, data: "Dummy data 1" },
  { lat: 7.6100, lng: 79.8050, data: "Dummy data 2" },
  { lat: 7.6115, lng: 79.8065, data: "Dummy data 3" },
  { lat: 7.6120, lng: 79.8070, data: "Dummy data 4" },
  { lat: 7.6130, lng: 79.8080, data: "Dummy data 5" },
  { lat: 7.6135, lng: 79.8085, data: "Dummy data 6" },
  { lat: 7.6110, lng: 79.8060, data: "Dummy data 7" },
  { lat: 7.6112, lng: 79.8062, data: "Dummy data 8" },
];

const MapWithOverlay = () => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [imageUrl, setImageUrl] = useState("");
  const [selectedPoint, setSelectedPoint] = useState(null); // Stores clicked marker data
  const [manualClose, setManualClose] = useState(false); // Tracks if user closed InfoWindow

  useEffect(() => {
    setImageUrl(window.location.origin + "/skeleton_final_1988(1).png");
  }, []);

  if (!isLoaded) return <div className="loading">Loading...</div>;

  return (
    <div className="map-container">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={17} //  Increased zoom for better ground resolution
        center={center}
        mapTypeId="satellite" //  Better ground detail (options: 'hybrid', 'terrain', 'roadmap')
        options={{
          scaleControl: true, //  Adds scale bar showing meters/km
          maxZoom: 20, //  Allows higher zoom for clarity
          minZoom: 15,
          disableDefaultUI: false, // Show map controls
          streetViewControl: false,
          mapTypeControl: true, // Allow switching map types
        }}
      >
        {/* Ground Overlay for better clarity */}
        {imageUrl && (
          <GroundOverlay bounds={overlayBounds} url={imageUrl} opacity={0.8} />
        )}

        {/* Markers that trigger InfoWindow on hover */}
        {overlayPoints.map((point, index) => (
          <Marker
            key={index}
            position={{ lat: point.lat, lng: point.lng }}
            onMouseOver={() => {
              if (!manualClose) setSelectedPoint(point); // Only open if not manually closed
            }}
          />
        ))}

        {/* InfoWindow stays open until user closes it */}
        {selectedPoint && (
          <InfoWindow
            position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
            onCloseClick={() => {
              setSelectedPoint(null);
              setManualClose(true); // Prevent reopening on hover
            }}
          >
            <div className="info-window">
              <strong>Point Data</strong>
              <p>{selectedPoint.data}</p>
              <p>Latitude: {selectedPoint.lat}, Longitude: {selectedPoint.lng}</p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export default MapWithOverlay;

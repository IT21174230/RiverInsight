import React, { useState, useEffect } from "react";
import { GoogleMap, GroundOverlay, useJsApiLoader, InfoWindow, Marker } from "@react-google-maps/api";
import "./MapWithOverlay.css"; // Import the CSS file

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
  const [hoverData, setHoverData] = useState(null);

  useEffect(() => {
    setImageUrl(window.location.origin + "/skeleton_final_1988(1).png");
  }, []);

  if (!isLoaded) return <div className="loading">Loading...</div>;

  return (
    <div className="map-container">
      <GoogleMap mapContainerStyle={mapContainerStyle} zoom={15} center={center}>
        {imageUrl && (
          <GroundOverlay className="overlay-image" bounds={overlayBounds} url={imageUrl} opacity={0.7} />
        )}

        {/* Small transparent markers to detect hover */}
        {overlayPoints.map((point, index) => (
          <Marker
            key={index}
            position={{ lat: point.lat, lng: point.lng }}
            icon={{
              url: "https://maps.gstatic.com/mapfiles/transparent.png", // Invisible icon, but interactive
              scaledSize: new window.google.maps.Size(20, 20),
            }}
            onMouseOver={() => setHoverData(point)}
            onMouseOut={() => setHoverData(null)}
          />
        ))}

        {/* InfoWindow appears on hover */}
        {hoverData && (
          <InfoWindow position={{ lat: hoverData.lat, lng: hoverData.lng }}>
            <div className="info-window">
              <strong>Point Data</strong>
              <p>{hoverData.data}</p>
              <p>Latitude: {hoverData.lat}, Longitude: {hoverData.lng}</p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export default MapWithOverlay;

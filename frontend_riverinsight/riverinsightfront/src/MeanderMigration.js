import React, { useState, useEffect } from "react";
import {
  GoogleMap,
  GroundOverlay,
  useJsApiLoader,
  InfoWindow,
  Marker,
} from "@react-google-maps/api";
import "./MapWithOverlay.css";

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

// Default overlay points
const overlayPoints = [
  { lat: 7.6053056294716415, lng: 79.80250077227974, data: "Loading..." },
  { lat: 7.6053056294716415, lng: 79.80169228852404, data: "Loading..." },
  { lat: 7.603890782899153, lng: 79.81334792933548, data: "Loading..." },
  { lat: 7.602947551850828, lng: 79.81334792933548, data: "Loading..." },
  { lat: 7.600926342461559, lng: 79.8217022614778, data: "Loading..." },
  { lat: 7.6003199796447785, lng: 79.82271286617242, data: "Loading..." },
  { lat: 7.605575124056878, lng: 79.81927681021067, data: "Loading..." },
  { lat: 7.60604673958104, lng: 79.82035478855161, data: "Loading..." },
];

const MapWithOverlay = ({ year, quarter }) => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [imageUrl, setImageUrl] = useState("");
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [manualClose, setManualClose] = useState(false);
  const [apiPoints, setApiPoints] = useState([]); // Stores API-fetched points

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:5000/meander_migration/params/get_point_values/?year=${year}&quart=${quarter}`);
        const data = await response.json();

        // Convert response into marker objects
        const formattedApiPoints = data.map(([lat, lng]) => ({
          lat,
          lng,
          data: "New API Point",
        }));

        setApiPoints(formattedApiPoints);
      } catch (error) {
        console.error("Error fetching API data:", error);
      }
    };

    fetchData();
    setImageUrl(window.location.origin + "/skeleton_final_1988(1).png");
  }, []);

  if (!isLoaded) return <div className="loading">Loading...</div>;

  return (
    <div className="map-container">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={17}
        center={center}
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

        {/* Original Markers */}
        {overlayPoints.map((point, index) => (
          <Marker
            key={`overlay-${index}`}
            position={{ lat: point.lat, lng: point.lng }}
            onMouseOver={() => {
              if (!manualClose) setSelectedPoint(point);
            }}
          />
        ))}

        {/* API Markers (Green) */}
        {apiPoints.map((point, index) => (
          <Marker
            key={`api-${index}`}
            position={{ lat: point.lat, lng: point.lng }}
            icon={{
              url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png", // Green marker
            }}
            onMouseOver={() => setSelectedPoint(point)}
          />
        ))}

        {/* InfoWindow for selected point */}
        {selectedPoint && (
          <InfoWindow
            position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
            onCloseClick={() => {
              setSelectedPoint(null);
              setManualClose(true);
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

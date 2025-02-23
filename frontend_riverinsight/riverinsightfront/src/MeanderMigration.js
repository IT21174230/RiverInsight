import React, { useState, useEffect } from "react";
import { GoogleMap, GroundOverlay, useJsApiLoader } from "@react-google-maps/api";

const GOOGLE_MAPS_API_KEY=process.env.REACT_APP_GOOGLE_MAPS_API_KEY

const mapContainerStyle = { 
  width: "100%",
  height: "500px",
};
const center = { lat: 7.60904, lng: 79.80332 };

const MapWithOverlay = () => {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });
  const [imageUrl, setImageUrl] = useState("");
  const [clickedPoint, setClickedPoint] = useState(null);

  useEffect(() => {
    setImageUrl(window.location.origin + "/skeleton_final_1988(1).png");
  }, []);

  const handleMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setClickedPoint({ lat, lng });
  };

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={15}
        center={center}
        onClick={handleMapClick}
      >
        {imageUrl && (
          <GroundOverlay
            bounds={{
              north: 7.62606,
              south: 7.59595,
              east: 79.86712,
              west: 79.78592,
            }}
            url={imageUrl}
            opacity={0.7}
          />
        )}
      </GoogleMap>
      {clickedPoint && (
        <div className="mt-4 p-2 border border-gray-300">
          <strong>Clicked Coordinates:</strong>
          <p>Latitude: {clickedPoint.lat}, Longitude: {clickedPoint.lng}</p>
        </div>
      )}
    </div>
  );
};

export default MapWithOverlay;





import React, { useState, useEffect } from "react";
import { GoogleMap, GroundOverlay } from "@react-google-maps/api";

const mapContainerStyle = {
  width: "100%",
  height: "500px",
};

const center = { lat: 7.60904, lng: 79.80332 };

const MapWithOverlay = () => {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    setImageUrl(window.location.origin + "/skeleton_final_1988(1).png");
  }, []);

  return (
    <GoogleMap mapContainerStyle={mapContainerStyle} zoom={17} center={center}>
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
  );
};

export default MapWithOverlay;

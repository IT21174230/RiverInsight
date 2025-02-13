import React from "react";
import { GoogleMap, GroundOverlay } from "@react-google-maps/api";

const mapContainerStyle = {
  width: "100%",
  height: "500px",
};

const center = {
  lat: 7.60904,
  lng: 79.80332,
};

const bounds = {
  north: 7.61985,
  south: 7.59824,
  east: 79.82455,
  west: 79.78210,
};

const imageUrl = "/skeleton.png";

const MapWithOverlay = () => {
  return (
    <GoogleMap mapContainerStyle={mapContainerStyle} zoom={16} center={center}>
      <GroundOverlay bounds={bounds} url={imageUrl} opacity={0.6} />
    </GoogleMap>
  );
};

export default MapWithOverlay;

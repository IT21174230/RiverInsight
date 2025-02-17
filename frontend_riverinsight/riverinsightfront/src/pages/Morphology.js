import React from "react";
import MapWithOverlay from '../MeanderMigration';
// import { LoadScript } from "@react-google-maps/api";
import { useLoadScript } from "@react-google-maps/api";

const GOOGLE_MAPS_API_KEY = "placeholder_api_key";

function MorphologicalPredictions() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div>
      <h1>Morphological Predictions</h1>
      <MapWithOverlay />
    </div>
  );
}

export default MorphologicalPredictions;


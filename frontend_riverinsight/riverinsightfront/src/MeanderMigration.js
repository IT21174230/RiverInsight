// import React from "react";
// import { GoogleMap, GroundOverlay } from "@react-google-maps/api";

// const mapContainerStyle = {
//   width: "100%",
//   height: "500px",
// };

// const center = {
//   lat: 7.60904,
//   lng: 79.80332,
// };

// // const bounds = {
// //   north: 7.61985,
// //   south: 7.59824,
// //   east: 79.82455,
// //   west: 79.78210,
// // };

// // const imageUrl = "/skeleton.png";
// const imageUrl = window.location.origin + "/skeleton.png";


// const MapWithOverlay = () => {
//   return (
//     <GoogleMap mapContainerStyle={mapContainerStyle} zoom={16} center={center}>
//       <GroundOverlay bounds={bounds} url={imageUrl} opacity={0.8} />
//     </GoogleMap>
//   );
// };

// export default MapWithOverlay;


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
    setImageUrl(window.location.origin + "/skeleton.png");
  }, []);

  return (
    <GoogleMap mapContainerStyle={mapContainerStyle} zoom={17} center={center}>
      {imageUrl && (
        <GroundOverlay
          bounds={{
            north: 7.63,
            south: 7.58,
            east: 79.84,
            west: 79.77,
          }}
          url={imageUrl}
          opacity={0.7}
        />
      )}
    </GoogleMap>
  );
};

export default MapWithOverlay;


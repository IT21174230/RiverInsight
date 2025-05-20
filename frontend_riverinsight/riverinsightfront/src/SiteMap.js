

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Control points per site
const controlPoints = {
  "Site 1": [
    [7.6053056294716415, 79.80250077227974],
    [7.6053056294716415, 79.80169228852404]
  ],
  "Site 2": [
    [7.603890782899153, 79.81334792933548],
    [7.602947551850828, 79.81334792933548]
  ],
  "Site 3": [
    [7.605575124056878, 79.81927681021067],
    [7.60604673958104, 79.82035478855161]
  ]
};

const SiteMap = ({ siteName, siteLat, siteLon, userLat, userLon, year, quarter, distance }) => {
  const controls = controlPoints[siteName] || [];

  return (
    <div style={{ marginTop: '24px' }}>
      <h2 style={{ color: '#1a6b4b' }}>{siteName} Map View</h2>
      <MapContainer
        center={[siteLat, siteLon]}
        zoom={15}
        style={{ height: '400px', width: '90vw', borderRadius: '12px' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Circle around the site - 5 km */}
        <Circle
          center={[siteLat, siteLon]}
          radius={800} // meters
          pathOptions={{ color: '#1a6b4b', fillColor: '#1a6b4b', fillOpacity: 0.1 }}
        />

        {/* Site Marker */}
        <Marker position={[siteLat, siteLon]}>
          <Popup>
            <strong>{siteName}</strong><br />
            Lat: {siteLat}<br />
            Lon: {siteLon}<br />
            Distance: {distance.toFixed(2)} km
          </Popup>
        </Marker>

        {/* User Marker */}
        <Marker position={[userLat, userLon]}>
          <Popup>
            Your Location<br />
            Lat: {userLat}<br />
            Lon: {userLon}
          </Popup>
        </Marker>

        {/* Control Point Markers */}
        {controls.map((coord, idx) => (
          <Marker key={idx} position={coord}>
            <Popup>
              Control Point {idx + 1}<br />
              Lat: {coord[0]}<br />
              Lon: {coord[1]}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default SiteMap;

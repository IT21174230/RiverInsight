import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const SiteMap = ({ siteName, siteLat, siteLon, userLat, userLon, year, quarter, distance }) => {
  return (
    <div style={{ marginTop: '24px' }}>
      <h2 style={{ color: '#1a6b4b' }}>{siteName} Map View</h2>
      <MapContainer
        center={[siteLat, siteLon]}
        zoom={15}
        style={{ height: '400px', width: '90vw', borderRadius: '12px' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[siteLat, siteLon]}>
          <Popup>
            <strong>{siteName}</strong><br />
            Lat: {siteLat}<br />
            Lon: {siteLon}<br />
            Distance: {distance.toFixed(2)} km<br />
          </Popup>
        </Marker>
        <Marker position={[userLat, userLon]}>
          <Popup>
            Your Location<br />
            Lat: {userLat}<br />
            Lon: {userLon}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};

export default SiteMap;

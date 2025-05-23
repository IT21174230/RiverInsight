// components/MapSelectorOverlay.js
import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './MapSelectorOverlay.css';
import L from 'leaflet';

const siteLocations = [
  { name: 'Site 1', lat: 7.605306, lon: 79.802097 },
  { name: 'Site 2', lat: 7.603419, lon: 79.813348 },
  { name: 'Site 3', lat: 7.605811, lon: 79.819816 }
];

const centerLat = (siteLocations.reduce((sum, s) => sum + s.lat, 0) / siteLocations.length).toFixed(6);
const centerLon = (siteLocations.reduce((sum, s) => sum + s.lon, 0) / siteLocations.length).toFixed(6);

const userIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconAnchor: [12, 41],
});

const ClickHandler = ({ onClick }) => {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    }
  });
  return null;
};

const MapSelectorOverlay = ({ onSelect, onClose }) => {
  const [selected, setSelected] = useState(null);

  const handleMapClick = (latlng) => {
    setSelected(latlng);
    setTimeout(() => {
      onSelect(latlng.lat, latlng.lng);
      onClose();
    }, 500);
  };

  return (
    <div className="map-overlay">
      <div className="map-modal">
        <div className="map-header">
          <span className="map-title">Select Location</span>
          <span className="close-button" onClick={onClose}>×</span>
        </div>
        <p className="map-instructions">
          ⚠️ Meander migration predictions are only available within 1 km of a site.
        </p>
        <MapContainer center={[parseFloat(centerLat), parseFloat(centerLon)]} zoom={16} style={{ height: '300px', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickHandler onClick={handleMapClick} />
          {selected && <Marker position={selected} icon={userIcon}><Popup>Selected Point</Popup></Marker>}
          {siteLocations.map((site, idx) => (
            <Marker key={idx} position={[site.lat, site.lon]}>
              <Popup>{site.name}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapSelectorOverlay;

import React, { useState } from 'react';
import SiteMap from './SiteMap';
import SiteDataTab from './SiteDataTab.js';
import MapSelectorOverlay from './MapSelectorOverlay.js';
import './MorphologicalPredictions.css';
import axios from 'axios';

const siteLocations = [
  { name: 'Site 1', lat: 7.605306, lon: 79.802097 },
  { name: 'Site 2', lat: 7.603419, lon: 79.813348 },
  { name: 'Site 3', lat: 7.605811, lon: 79.819816 }
];

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const MeanderPredInterface = () => {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [year, setYear] = useState('2025');
  const [quarter, setQuarter] = useState(1);
  const [nearestSite, setNearestSite] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [predictionData, setPredictionData] = useState([]);
  const [showTable, setShowTable] = useState(false);
  const [showMapSelector, setShowMapSelector] = useState(false);

  const handlePredict = async () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      setMessage('Please enter valid coordinates.');
      setNearestSite(null);
      return;
    }

    setLoading(true);
    setMessage('');
    setNearestSite(null);
    setPredictionData([]);

    setTimeout(async () => {
      let minDist = Infinity;
      let closestSite = null;

      for (let site of siteLocations) {
        const dist = haversineDistance(lat, lon, site.lat, site.lon);
        if (dist < minDist) {
          minDist = dist;
          closestSite = { ...site, distance: dist };
        }
      }

      if (minDist <= 1) {
        try {
          const response = await axios.get(
            "http://127.0.0.1:5000/meander_migration/params/",
            {
            params: { year, quart: quarter },
            withCredentials: true,
            }
          );
          setPredictionData(response.data);
          setNearestSite(closestSite);
          setMessage(`${closestSite.name} is the nearest site (~${minDist.toFixed(4)} km away).`);
        } catch (error) {
          setMessage('Error fetching prediction data.');
          console.error("Error fetching data:", error.response?.data || error.message)
        }
      } else {
        setMessage('No site data available for given location.');
      }

      setLoading(false);
    }, 800);
  };

const getLatestRow = () => {
    if (predictionData.length === 0) return null;
    return predictionData[predictionData.length - 1];
};

const handleMapSelect = (lat, lon) => {
  setLatitude(lat.toFixed(6));
  setLongitude(lon.toFixed(6));
};

const now = new Date();
const curYear = now.getFullYear();
const month = now.getMonth();
const curQuart = Math.floor(month / 3) + 1;


const renderPredictionInfo = () => {
  if (predictionData.length === 0 || !nearestSite) return null;

  const selectedYearInt = parseInt(year);
  const selectedQuarterInt = parseInt(quarter);

  if (selectedYearInt < curYear) {
    return (
      <div style={{ marginTop: '16px', color: '#1a6b4b' }}>
        <h3>Deviation of {nearestSite.name} In Relation to {curYear} Data</h3>
        <p>Predictions are generated from 2025 onwards. See tabular view for historical data.</p>
      </div>
    );
  }

  const currentRow = predictionData.find(
    row => row.year === parseInt(year) && parseInt(row.quarter) === parseInt(quarter)
  );

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const currentQuarter = Math.floor(month / 3) + 1;
  const baselineRow = predictionData.find(
    row => row.year === currentYear && parseInt(row.quarter) === currentQuarter
  );

  if (!currentRow || !baselineRow) return (
    <p style={{ color: '#1a6b4b', marginTop: '16px' }}>
      Not Apllicable!
    </p>
  );

  const computeDiff = (field) => Math.abs(currentRow[field] - baselineRow[field]).toFixed(4);

  let fields = {};
  if (nearestSite.name === 'Site 1') {
    fields = {
      'Bend 1 Deviation (m)': computeDiff('bend_1'),
      'Control Point 1 Shift (m)': computeDiff('c1_dist'),
      'Control Point 2 Shift (m)': computeDiff('c2_dist')
    };
  } else if (nearestSite.name === 'Site 2') {
    fields = {
      'Bend 2 Deviation (m)': computeDiff('bend_2'),
      'Control Point 3 Shift (m)': computeDiff('c3_dist'),
      'Control Point 4 Shift (m)': computeDiff('c4_dist')
    };
  } else if (nearestSite.name === 'Site 3') {
    fields = {
      'Bend 3 Deviation (m)': computeDiff('bend_3'),
      'Control Point 5 Shift (m)': computeDiff('c7_dist'),
      'Control Point 6 Shift (m)': computeDiff('c8_dist')
    };
  }

  return (
    <div style={{ marginTop: '16px', color: '#1a6b4b' }}>
      <h3>Prediction for {nearestSite.name}</h3>
      <p>Compared against baseline: {currentYear} Quarter {currentQuarter}</p>
      <ul>
        {Object.entries(fields).map(([label, value]) => (
          <li key={label}><strong>{label}:</strong> {value}</li>
        ))}
      </ul>
    </div>
  );
};

  return (
    <div className="container">
      <h1 className="title">Meander Migration Predictor</h1>
      <div className="input-container">
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <label className="input-label">
            Latitude:
            <input
              className="input-field"
              type="number"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="e.g. 7.60"
            />
          </label>
          <label className="input-label">
            Longitude:
            <input
              className="input-field"
              type="number"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="e.g. 79.81"
            />
          </label>
        </div>

        <div className="map-link-container">
          <span
            className="map-link"
            onClick={() => setShowMapSelector(true)}
          >
            🗺️ Select location from map
          </span>
        </div>

        <label className="input-label">
          Year:
          <select className="input-field" value={year} onChange={(e) => setYear(e.target.value)}>
            {Array.from({ length: 2060 - 1988 + 1 }, (_, i) => 1988 + i).map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </label>

        <label className="input-label">
          Quarter:
          <select className="input-field" value={quarter} onChange={(e) => setQuarter(parseInt(e.target.value))}>
            <option value="1">Q1</option>
            <option value="2">Q2</option>
            <option value="3">Q3</option>
            <option value="4">Q4</option>
          </select>
        </label>
      </div>

      <button className="fetch-button" onClick={handlePredict}>Predict</button>

      {showMapSelector && (
        <MapSelectorOverlay
          onSelect={handleMapSelect}
          onClose={() => setShowMapSelector(false)}
        />
      )}

      {loading && (
        <div style={{ marginTop: '16px', color: '#1a6b4b' }}>
          <span className="spinner" /> Finding the nearest site...
        </div>
      )}

      {!loading && message && <p style={{ marginTop: '16px', color: '#1a6b4b' }}>{message}</p>}

      {!loading && nearestSite && (
      <>
        <div className="content-wrapper">
  <div className="map-container">
    <SiteMap
      siteName={nearestSite.name}
      siteLat={nearestSite.lat}
      siteLon={nearestSite.lon}
      userLat={parseFloat(latitude)}
      userLon={parseFloat(longitude)}
      year={year}
      quarter={quarter}
      distance={nearestSite.distance}
    />
    </div>
          <div className="prediction-container">
            {renderPredictionInfo()}
            <button
              className="fetch-button"
              style={{ marginTop: '16px' }}
              onClick={() => setShowTable(prev => !prev)}
            >
              {showTable ? 'Hide' : 'Show'} Tabular Data
            </button>
          </div>
        </div>

        {showTable && (
          <div style={{ width: '90%', marginTop: '20px' }}>
            <SiteDataTab selectedSite={nearestSite.name} year={year} quarter={quarter} />
          </div>
        )}

      </>
    )}

    </div>
  );
};

export default MeanderPredInterface;

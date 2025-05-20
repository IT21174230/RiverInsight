import React, { useState } from 'react';
import SiteMap from './SiteMap';
import SiteDataTab from './SiteDataTab.js';
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

      if (minDist <= 5) {
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
          setMessage(`${closestSite.name} is the nearest site (~${minDist.toFixed(2)} km away).`);
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

  const renderPredictionInfo = () => {
    const latest = getLatestRow();
    if (!latest || !nearestSite) return null;

    let fields = {};
    if (nearestSite.name === 'Site 1') {
      fields = {
        bend_1: latest.bend_1,
        c1_dist: latest.c1_dist,
        c2_dist: latest.c2_dist
      };
    } else if (nearestSite.name === 'Site 2') {
      fields = {
        bend_2: latest.bend_2,
        c3_dist: latest.c3_dist,
        c4_dist: latest.c4_dist
      };
    } else if (nearestSite.name === 'Site 3') {
      fields = {
        bend_3: latest.bend_3,
        c7_dist: latest.c7_dist,
        c8_dist: latest.c8_dist
      };
    }

    return (
      <div style={{ marginTop: '16px', color: '#1a6b4b' }}>
        <h3>Prediction for {nearestSite.name}</h3>
        <ul>
          {Object.entries(fields).map(([key, value]) => (
            <li key={key}><strong>{key}:</strong> {value}</li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="container">
      <h1 className="title">Meander Migration Predictor</h1>
      <div className="input-container">
        <label className="input-label">
          Latitude:
          <input className="input-field" type="number" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="e.g. 7.60" />
        </label>
        <label className="input-label">
          Longitude:
          <input className="input-field" type="number" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="e.g. 79.81" />
        </label>
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

      {loading && (
        <div style={{ marginTop: '16px', color: '#1a6b4b' }}>
          <span className="spinner" /> Finding the nearest site...
        </div>
      )}

      {!loading && message && <p style={{ marginTop: '16px', color: '#1a6b4b' }}>{message}</p>}

      {!loading && nearestSite && (
      <>
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
        {renderPredictionInfo()}

        <button
          className="fetch-button"
          style={{ marginTop: '16px' }}
          onClick={() => setShowTable(prev => !prev)}
          >
          {showTable ? 'Hide' : 'Show'} Tabular Data
        </button>

          {showTable && (
            <SiteDataTab
              selectedSite={nearestSite.name}
              year={year}
              quarter={quarter}
            />
          )}
      </>
    )}

    </div>
  );
};

export default MeanderPredInterface;

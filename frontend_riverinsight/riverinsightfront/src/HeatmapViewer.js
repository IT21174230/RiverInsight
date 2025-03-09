import axios from 'axios';
import React, { useState } from 'react';
import './HeatmapViewer.css';

const HeatmapViewer = () => {
  const [year, setYear] = useState('');
  const [quarter, setQuarter] = useState('');
  const [points, setPoints] = useState('');
  const [timesteps, setTimesteps] = useState(5);
  const [heatmap, setHeatmap] = useState(null);
  const [error, setError] = useState('');

  const handleGenerateHeatmap = async () => {
    try {
      setError('');
      setHeatmap(null); // Reset heatmap on new request

      // Validate inputs
      if (!year || !quarter || !points) {
        setError('Please fill in all fields.');
        return;
      }

      const pointsArray = points.split(',').map(Number);
      if (pointsArray.some(isNaN)) {
        setError('Points must be a comma-separated list of numbers.');
        return;
      }

      if (quarter < 1 || quarter > 4) {
        setError('Quarter must be between 1 and 4.');
        return;
      }

      if (timesteps < 1) {
        setError('Timesteps must be at least 1.');
        return;
      }

      // Debug: Log the request payload
      console.log('Request Payload:', {
        year: Number(year),
        quarter: Number(quarter),
        points: pointsArray,
        timesteps: Number(timesteps),
      });

      // Make the API request
      const response = await axios.post('http://localhost:5000/predict_erosion/heatmap', {
        year: Number(year),
        quarter: Number(quarter),
        points: pointsArray,
        timesteps: Number(timesteps),
      });

      // Debug: Log the response
      console.log('Response:', response.data);

      if (response.data && response.data.heatmap) {
        setHeatmap(response.data.heatmap);
      } else {
        setError('Heatmap not found in the response.');
      }
    } catch (err) {
      console.error('Error:', err.response || err.message); // Debug error details
      if (err.response && err.response.data && err.response.data.error) {
        setError(`Backend Error: ${err.response.data.error}`);
      } else {
        setError('Failed to generate heatmap. Please check your input and try again.');
      }
    }
  };

  return (
    <div className="heatmap-viewer">
      <h2>Heatmap Viewer</h2>
      <p>Generate and view heatmaps of erosion predictions for specified riverbank points.</p>

      {/* Input Form */}
      <div className="input-form">
        <label>
          Start Year:
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g., 2025"
          />
        </label>
        <label>
          Start Quarter:
          <input
            type="number"
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            placeholder="1-4"
          />
        </label>
        <label>
          Points (comma-separated):
          <input
            type="text"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="e.g., 1,5,10"
          />
        </label>
        <label>
          Timesteps:
          <input
            type="number"
            value={timesteps}
            onChange={(e) => setTimesteps(e.target.value)}
            placeholder="Default: 5"
          />
        </label>
        <button onClick={handleGenerateHeatmap}>Generate Heatmap</button>
      </div>

      {/* Heatmap Display */}
      {error && <p className="error">{error}</p>}
      {heatmap && (
        <div className="heatmap-container">
          <h3>Generated Heatmap:</h3>
          <img src={`data:image/png;base64,${heatmap}`} alt="Heatmap" />
        </div>
      )}
    </div>
  );
};

export default HeatmapViewer;
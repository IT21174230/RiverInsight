import React, { useState } from 'react';
import './HydrologicalPredictions.css';
import Papa from 'papaparse';
import axios from 'axios'; 


const REQUIRED_FIELDS = [
  "Latitude", "Longitude", "Year", "Quarter",
  "Total Percipitation", "2m Dewpoint Temperature",
  "Leaf Area Index (lv)", "Leaf Area Index (hv)",
  "Volumetric Soil Water Layer 1", "Surface Runoff"
];

const REFERENCE_DISTANCES = {
  c1_dist: 144.9163818359375,
  c2_dist: 73.75137329101562,
  c3_dist: 993.3526000976562,
  c4_dist: 992.0204467773438,
  c7_dist: 2007.3299560546875,
  c8_dist: 2205.82958984375
};


const HydrologicalPredictions = ({ onClose }) => {
  const [message, setMessage] = useState('');
  const [isValid, setIsValid] = useState(null);
  const [csvValid, setCsvValid] = useState(false);
  const [csvData, setCsvData] = useState([]);
  const [predictionResults, setPredictionResults] = useState(null);
  const [explainImage, setExplainImage] = useState(null);
  const [showModal, setShowModal] = useState(false);


  const handleHydroPredict = async () => {
    if (!csvValid || csvData.length === 0) return;

    const params = new URLSearchParams();

    for (let row of csvData) {
      params.append('year', row['Year']);
      params.append('quart', row['Quarter']);
      params.append('temp', row['2m Dewpoint Temperature']);
      params.append('rain', row['Total Percipitation']);
      params.append('run', row['Surface Runoff']);
      params.append('soil', row['Volumetric Soil Water Layer 1']);
      params.append('lv', row['Leaf Area Index (lv)']);
      params.append('hv', row['Leaf Area Index (hv)']);
    }

    try {
      const response = await axios.get(`http://127.0.0.1:5000/meander_migration/params/short_term/?${params.toString()}`);
      console.log("Hydrological prediction result:", response.data);
      setPredictionResults(response.data);
    } catch (error) {
      console.error("Prediction failed:", error.message);
    }
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        const data = results.data;
        const headers = results.meta.fields;

        // Check for required fields
        const missingFields = REQUIRED_FIELDS.filter(f => !headers.includes(f));
        if (missingFields.length > 0) {
          setIsValid(false);
          setMessage(`Missing required fields: ${missingFields.join(', ')}`);
          setCsvValid(false);
          return;
        }

        const latitudes = new Set(data.map(row => row.Latitude).filter(Boolean));
        const longitudes = new Set(data.map(row => row.Longitude).filter(Boolean));

        if (latitudes.size !== 1 || longitudes.size !== 1) {
          setIsValid(false);
          setMessage('CSV must contain only one unique Latitude and Longitude.');
          setCsvValid(false);
          return;
        }

        // Value range validation with 5% tolerance
        const RANGE_LIMITS = {
          "Total Percipitation": [0.000213 - 0.0006, 0.011971 + 0.0006],
          "2m Dewpoint Temperature": [298.8223 - 0.1366, 301.555007 + 0.1366],
          "Volumetric Soil Water Layer 1": [0.1550039 - 0.0125, 0.406392 + 0.0125],
          "Surface Runoff": [7.301569e-7 - 0.0001, 0.002199 + 0.0001],
          "Leaf Area Index (hv)": [2.391235 - 0.0345, 3.081462 + 0.0345],
          "Leaf Area Index (lv)": [2.993286 - 0.0022, 3.037598 + 0.0022],
        };

        let hasWarning = false;
        let hasError = false;

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const year = parseInt(row["Year"]);
          const quarter = parseInt(row["Quarter"]);

          // Validate year and quarter - block if invalid
          if (isNaN(year) || year < 1900 || year > 2100) {
            setIsValid(false);
            setMessage(`❌ Invalid year in row ${i + 1}. Please check your data.`);
            setCsvValid(false);
            hasError = true;
            break;
          }

          if (![1, 2, 3, 4].includes(quarter)) {
            setIsValid(false);
            setMessage(`❌ Invalid quarter in row ${i + 1}. Must be 1, 2, 3, or 4.`);
            setCsvValid(false);
            hasError = true;
            break;
          }

          // Warn if other values outside tolerated range
          for (const field in RANGE_LIMITS) {
            const value = parseFloat(row[field]);
            const [min, max] = RANGE_LIMITS[field];
            if (isNaN(value) || value < min || value > max) {
              hasWarning = true;
              console.warn(`⚠️ Value out of expected range for '${field}' in row ${i + 1}: ${value}`);
            }
          }
        }

        if (!hasError) {
          setIsValid(true);
          setMessage(hasWarning
            ? '⚠️ CSV accepted, but some values are outside expected ranges. Please double-check.'
            : '✅ CSV is valid and accepted.'
          );
          setCsvData(data);
          setCsvValid(true);
        }
      },
      error: function(err) {
        setIsValid(false);
        setMessage('Error parsing CSV: ' + err.message);
        setCsvValid(false);
      }
    });
  };

  return (
    <div className="hydro-container">
      <div className="hydro-header">
        <h2>Hydrological Predictions</h2>
        <button className="hydro-close" onClick={onClose}>✖</button>
      </div>

      <p>This feature predicts meander migration using the following hydrological features:</p>

      <div className="hydro-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Unit</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Total precipitation</td><td>m</td><td>Accumulated liquid and frozen water (rain and snow).</td></tr>
            <tr><td>2m temperature</td><td>K</td><td>Air temperature 2m above the surface.</td></tr>
            <tr><td>Volumetric soil water layer 1</td><td>m³/m³</td><td>Water in soil layer 1 (0–7cm depth).</td></tr>
            <tr><td>Surface runoff</td><td>m</td><td>Total accumulated water in soil.</td></tr>
            <tr><td>Leaf area index, high vegetation</td><td>m2 m-2</td><td>Evergreen trees, deciduous trees, mixed forest/woodland.</td></tr>
            <tr><td>Leaf area index, low vegetation</td><td>m2 m-2</td><td>Crops, mixed farming, grass types.</td></tr>
          </tbody>
        </table>
      </div>

      <div className="hydro-upload">
        <p>📄 Download template to prepare your CSV:
          <a
            href="/template/Template.xlsx"
            className="hydro-link"
            download
          >
            Hydrological Data Template
          </a>
        </p>

        <input type="file" accept=".csv" onChange={handleCSVUpload} />
        {message && <p className={`hydro-message ${isValid ? 'valid' : 'invalid'}`}>{message}</p>}
        {csvValid && (
          <button
            className="predict-button"
            onClick={handleHydroPredict}
            style={{ marginTop: '20px' }}
          >
            Predict using Hydrological Data
          </button>
        )}
        {predictionResults && (
          <div className="hydro-results">
            <h3>Prediction Results</h3>
            <div className='table-container'>
              <table className="styled-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Quarter</th>
                    <th>Rainfall (m)</th>
                    <th>Runoff (m)</th>
                    <th>Soil Water (m³/m³)</th>
                    <th>Temperature (K)</th>
                    <th>Leaf Area Index (lv) (m²/m²)</th>
                    <th>Leaf Area Index (hv) (m²/m²)</th>
                    <th>Control Point 1 (m ±0.625)</th>
                    <th>Control Point 2 (m ±0.625)</th>
                    <th>Control Point 3 (m ±0.625)</th>
                    <th>Control Point 4 (m ±0.625)</th>
                    <th>Control Point 7 (m ±0.625)</th>
                    <th>Control Point 8 (m ±0.625)</th>
                  </tr>
                </thead>
                <tbody>
                    {predictionResults.predictions.map((p, idx) => {
                        const year = predictionResults.year[idx];
                        const quart = predictionResults.quart[idx];

                        const handleRightClick = async (event) => {
                        event.preventDefault(); // Prevent default context menu

                        try {
                            const response = await axios.get(`http://127.0.0.1:5000/meander_migration/params/short_term/explain`, {
                            params: { year, quart, idx },
                            responseType: 'blob' // important to handle image data
                            });

                            const imageUrl = URL.createObjectURL(response.data);
                            setExplainImage(imageUrl);
                            setShowModal(true);
                        } catch (error) {
                            console.error("Explain request failed:", error.message);
                        }
                        };


                        return (
                        <tr key={idx} onContextMenu={handleRightClick}>
                            <td>{year}</td>
                            <td>{quart}</td>
                            <td>{predictionResults.rainfall[idx]}</td>
                            <td>{predictionResults.runoff[idx]}</td>
                            <td>{predictionResults.soil[idx]}</td>
                            <td>{predictionResults.temperature[idx]}</td>
                            <td>{predictionResults.lv[idx]}</td>
                            <td>{predictionResults.hv[idx]}</td>
                        
                            <td>{(p.c1_dist - REFERENCE_DISTANCES.c1_dist).toFixed(2)} ±0.625</td>
                            <td>{(p.c2_dist - REFERENCE_DISTANCES.c2_dist).toFixed(2)} ±0.625</td>
                            <td>{(p.c3_dist - REFERENCE_DISTANCES.c3_dist).toFixed(2)} ±0.625</td>
                            <td>{(p.c4_dist - REFERENCE_DISTANCES.c4_dist).toFixed(2)} ±0.625</td>
                            <td>{(p.c7_dist - REFERENCE_DISTANCES.c7_dist).toFixed(2)} ±0.625</td>
                            <td>{(p.c8_dist - REFERENCE_DISTANCES.c8_dist).toFixed(2)} ±0.625</td>

                        </tr>
                        );
                    })}
                    </tbody>


              </table>
              {showModal && explainImage && (
                <div className="modal" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <span className="close" onClick={() => setShowModal(false)}>✖</span>
                    <h3>Feature importance for current prediction</h3>
                    <img src={explainImage} alt="Feature importance" className="inference-image" />
                    </div>
                </div>
                )}


            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default HydrologicalPredictions;

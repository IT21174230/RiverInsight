import React, { useState } from "react";
import MapWithOverlay from "../MeanderMigration";
import axios from "axios";
import "./MorphologicalPredictions.css"; // Import the CSS file

function MorphologicalPredictions() {
  const [year, setYear] = useState(2025);
  const [quarter, setQuarter] = useState(2);
  const [tableData, setTableData] = useState([]);
  const [showTable, setShowTable] = useState(false);

  const fetchTableData = async () => {
    try {
      const response = await axios.get(
        "http://127.0.0.1:5000/meander_migration/params/",
        {
          params: {
            year,
            quart: quarter,
          },
          withCredentials: true,
        }
      );
      setTableData(response.data);
      setShowTable(true);
    } catch (error) {
      console.error("Error fetching data:", error.response?.data || error.message);
    }
  };

  return (
    <div className="container">
      <h1 className="title">Morphological Predictions</h1>
      <MapWithOverlay />

      {/* Input Fields */}
      <div className="input-container">
        <label className="input-label">
          Year:
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="input-field"
            min="1900"
            max="2100"
          />
        </label>

        <label className="input-label">
          Quarter:
          <select
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className="input-field"
          >
            <option value="1">Q1</option>
            <option value="2">Q2</option>
            <option value="3">Q3</option>
            <option value="4">Q4</option>
          </select>
        </label>
      </div>

      {/* Fetch Data Button */}
      <button onClick={fetchTableData} className="fetch-button">
        Show Tabular Data
      </button>

      {/* Table Display */}
      {showTable && (
        <div className="table-container show">
          <table className="styled-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Quarter</th>
                <th>c1_dist</th>
                <th>c2_dist</th>
                <th>c3_dist</th>
                <th>c4_dist</th>
                <th>c7_dist</th>
                <th>c8_dist</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, index) => (
                <tr key={index}>
                  <td>{row.year}</td>
                  <td>{row.quarter}</td>
                  <td>{row.c1_dist}</td>
                  <td>{row.c2_dist}</td>
                  <td>{row.c3_dist}</td>
                  <td>{row.c4_dist}</td>
                  <td>{row.c7_dist}</td>
                  <td>{row.c8_dist}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MorphologicalPredictions;

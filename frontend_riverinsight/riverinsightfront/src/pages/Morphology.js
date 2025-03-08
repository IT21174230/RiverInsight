import React, { useState, useEffect } from "react";
import MapWithOverlay from "../MeanderMigration";
import axios from "axios";
import "./MorphologicalPredictions.css"; // Import the CSS file

function MorphologicalPredictions() {
  const [year, setYear] = useState(2025);
  const [quarter, setQuarter] = useState(2);
  const [tableData, setTableData] = useState([]);
  const [showTable, setShowTable] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    // Close context menu on clicking outside
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const fetchTableData = async () => {
    try {
      const response = await axios.get(
        "http://127.0.0.1:5000/meander_migration/params/",
        {
          params: { year, quart: quarter },
          withCredentials: true,
        }
      );
      setTableData(response.data);
      setShowTable(true);
    } catch (error) {
      console.error("Error fetching data:", error.response?.data || error.message);
    }
  };

  const handleRightClick = (event, row, index) => {
    event.preventDefault();
    setSelectedRow({ ...row, index }); // Store index for API call
    setContextMenu({
      x: event.pageX,
      y: event.pageY,
    });
  };

  const fetchInferenceImage = async () => {
    if (!selectedRow) return;

    const imageUrl = `http://127.0.0.1:5000/meander_migration/params/explain_migration/?year=${year}&quart=${quarter}&idx=${selectedRow.index}`;
    
    setImageSrc(imageUrl);
    setShowImageModal(true);
    setContextMenu(null);
  };

  return (
    <div className="container">
      <h1 className="title">Morphological Predictions</h1>
      <div className="input-container">
        <label className="input-label">
          Year:
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="input-field"
            min="1900"
            max="2100"
          />
        </label>
        <label className="input-label">
          Quarter:
          <select
            value={quarter}
            onChange={(e) => setQuarter(Number(e.target.value))}
            className="input-field"
          >
            <option value="1">Q1</option>
            <option value="2">Q2</option>
            <option value="3">Q3</option>
            <option value="4">Q4</option>
          </select>
        </label>
      </div>

      <button onClick={fetchTableData} className="fetch-button">
        Show Tabular Data
      </button>

      <div className="content-wrapper">
        <div className="map-container">
          <MapWithOverlay />
        </div>

        {showTable && (
          <div className="table-container">
            <div className="table-wrapper">
              <table className="styled-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Quarter</th>
                    <th>Control Point 1</th>
                    <th>Control Point 2</th>
                    <th>Control Point 3</th>
                    <th>Control Point 4</th>
                    <th>Control Point 7</th>
                    <th>Control Point 8</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, index) => (
                    <tr key={index} onContextMenu={(e) => handleRightClick(e, row, index)}>
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
            <div className="placeholder-text">
              <p>Please right-click on desired row to explain the inference</p>
              <p>A heatmap is given, visualizing the effects of previous four time steps on
                the inference. The inferences are generated using a Temporal Convolutional Model (TCN)</p>
            </div>
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
        >
          <button onClick={fetchInferenceImage} className="context-menu-option">
            Show Inference Explanation
          </button>
        </div>
      )}

      {showImageModal && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={() => setShowImageModal(false)}>
              &times;
            </span>
            <img src={imageSrc} alt="Inference Explanation" className="inference-image" />
          </div>
        </div>
      )}
    </div>
  );
}

export default MorphologicalPredictions;

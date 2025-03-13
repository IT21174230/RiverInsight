import React, { useState, useEffect } from "react";
import MapWithOverlay from "./MeanderMigration";
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
  const [showPastDataMessage, setShowPastDataMessage] = useState(false);
  const [shiftedData, setShiftedData] = useState([]);
  const [isShifted, setIsShifted] = useState(false);

  useEffect(() => {
    // Close context menu on clicking outside
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    if (tableData.length > 1) {
      const newData = tableData.map((row, index, array) => {
        if (index === 0) return row;
        const prevRow = array[index - 1];
        return {
          ...row,
          c1_dist: Math.abs(row.c1_dist - prevRow.c1_dist).toFixed(4),
          c2_dist: Math.abs(row.c2_dist - prevRow.c2_dist).toFixed(4),
          bend_1: Math.abs(row.bend_1 - prevRow.bend_1).toFixed(4),
          c3_dist: Math.abs(row.c3_dist - prevRow.c3_dist).toFixed(4),
          c4_dist: Math.abs(row.c4_dist - prevRow.c4_dist).toFixed(4),
          bend_2: Math.abs(row.bend_2 - prevRow.bend_2).toFixed(4),
          c7_dist: Math.abs(row.c7_dist - prevRow.c7_dist).toFixed(4),
          c8_dist: Math.abs(row.c8_dist - prevRow.c8_dist).toFixed(4),
          bend_3: Math.abs(row.bend_3 - prevRow.bend_3).toFixed(4),
        };
      });
      setShiftedData(newData);
    }
  }, [tableData]);

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
    setSelectedRow({ ...row, index });
    setContextMenu({
      x: event.pageX,
      y: event.pageY,
    });
  };

  const fetchInferenceImage = async () => {
    setContextMenu(null);
    if (year <= 2024) {
      setShowPastDataMessage(true);
      setShowImageModal(false);
    } else {
      setShowPastDataMessage(false);
      if (!selectedRow) return;
      const imageUrl = `http://127.0.0.1:5000/meander_migration/params/explain_migration/?year=${year}&quart=${quarter}&idx=${selectedRow.index}`;
      setImageSrc(imageUrl);
      setShowImageModal(true);
    }
  };

  return (
    <div className="container">
      <h1 className="title">Meander Migration Prediction</h1>
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
          <MapWithOverlay year={year} quarter={quarter} />
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
                    <th>Bend 1 Deviation</th>
                    <th>Control Point 3</th>
                    <th>Control Point 4</th>
                    <th>Bend 2 Deviation</th>
                    <th>Control Point 7</th>
                    <th>Control Point 8</th>
                    <th>Bend 3 Deviation</th>
                  </tr>
                </thead>
                <tbody>
                  {(isShifted ? shiftedData : tableData).map((row, index) => (
                    <tr key={index} onContextMenu={(e) => handleRightClick(e, row, index)}>
                      <td>{row.year}</td>
                      <td>{row.quarter}</td>
                      <td>{row.c1_dist}</td>
                      <td>{row.c2_dist}</td>
                      <td>{row.bend_1}</td>
                      <td>{row.c3_dist}</td>
                      <td>{row.c4_dist}</td>
                      <td>{row.bend_2}</td>
                      <td>{row.c7_dist}</td>
                      <td>{row.c8_dist}</td>
                      <td>{row.bend_3}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setIsShifted(!isShifted)} className="fetch-button">
              {isShifted ? "Show Total Shift" : "Show Shift by Year"}
            </button>
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

      {showPastDataMessage && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={() => setShowPastDataMessage(false)}>
              &times;
            </span>
            <p className="past-data-message">
              All data for selected year ({year}) contains past values collected using LANDSAT 8 and LANDSAT 5 satellite images.
              These past values were used to train the predictive model and are not predictions.
            </p>
          </div>
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

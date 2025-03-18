import React, { useState, useEffect } from "react";
import MapWithOverlay from "./MeanderMigration";
import axios from "axios";
import "./MorphologicalPredictions.css";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import { Tooltip } from "react-tooltip"; 
import "react-tooltip/dist/react-tooltip.css";



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
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
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

  const saveTableAsPDF = () => {
    const doc = new jsPDF();
    const themeColor = "#1a6b4b";
  
    // Title
    doc.setFontSize(18);
    doc.setTextColor(themeColor);
    doc.text("Meander Migration Prediction", 10, 10);

    // Subtitle
    doc.setFontSize(10);
    doc.setTextColor(0); // Reset color to black for the subtitle
    doc.text("All measurements are given in meters.", 10, 15);
    
    const tableHeaders = [
      "Year", "Quarter", "Control Point 1", "Control Point 2", "Bend 1 Deviation", 
      "Control Point 3", "Control Point 4", "Bend 2 Deviation", "Control Point 7", 
      "Control Point 8", "Bend 3 Deviation"
    ];
  
    const tableRows = (isShifted ? shiftedData : tableData).map(row => [
      row.year, row.quarter, row.c1_dist, row.c2_dist, row.bend_1,
      row.c3_dist, row.c4_dist, row.bend_2, row.c7_dist, row.c8_dist, row.bend_3
    ]);
  
    autoTable(doc, {
      head: [tableHeaders],
      body: tableRows,
      startY: 20,
      theme: 'striped', 
      headStyles: {
        fillColor: themeColor, // Header background color
        textColor: 'white', // Header text color
        fontSize: 12, // Font size for headers
        fontStyle: 'bold', // Bold header text
      },
      bodyStyles: {
        fontSize: 10, // Font size for table rows
        lineColor: themeColor, // Line color for table borders
        lineWidth: 0.1, // Line width for borders
      },
      alternateRowStyles: {
        fillColor: '#f2f2f2', // Light gray for alternating rows
      },
      columnStyles: {
        0: { halign: 'center' }, // Center align Year column
        1: { halign: 'center' }, // Center align Quarter column
      }
    });
  
    doc.save("meander_migration_table.pdf");
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
      <button data-tooltip-id="fetch-data" onClick={fetchTableData} className="fetch-button">
       Predict and Show Tabular Data
      </button>
      <Tooltip id="fetch-data" content="Display tabular data for the selected year and quarter" />
      {showTable && (
        <>
        <button data-tooltip-id="hide-data" onClick={() => setShowTable(false)} className="hide-button">
          Hide Tabular Data
        </button>
        <Tooltip id="hide-data" content="Hide tabular data" />
        </>
      )}
      
      <div className="content-wrapper">
        <div className="map-container">
          <MapWithOverlay latestData={tableData.length > 0 ? tableData[tableData.length - 1] : null} />
        </div>
        {showTable && (
          <div  className="table-container">
            <div className="table-wrapper">
              <table className="styled-table">
                <thead>
                  <tr>
                    <th data-tooltip-id="row-click">Year</th>
                    <th>Quarter</th>
                    <th data-tooltip-id="control-point-1">Control Point 1</th>
                    <th>Control Point 2</th>
                    <th data-tooltip-id="bend-1-deviation">Bend 1 Deviation</th>
                    <th>Control Point 3</th>
                    <th>Control Point 4</th>
                    <th>Bend 2 Deviation</th>
                    <th>Control Point 7</th>
                    <th>Control Point 8</th>
                    <th>Bend 3 Deviation</th>
                  </tr>
                </thead>
                <Tooltip id="control-point-1" content="The shift of centerline in relation to Control Point along with direction." />
                <Tooltip id="bend-1-deviation" content="Magnitude of deviation of bend." />
                <Tooltip id="row-click" content="Right click on any row to know how prediction is made." />
                <tbody>
                  {(isShifted ? shiftedData : tableData).map((row, index) => (
                    <tr key={index} onContextMenu={(e) => handleRightClick(e, row, index)}>
                      <td>{row.year}</td>
                      <td>{row.quarter}</td>
                      <td>
                        {row.c1_dist} m {isShifted ? "" : `(${row.c1_dist < 0 ? "away" : "towards"})`}
                      </td>
                      <td>
                        {row.c2_dist} m {isShifted ? "" : `(${row.c2_dist < 0 ? "away" : "towards"})`}
                      </td>
                      <td>{row.bend_1} m</td>
                      <td>
                        {row.c3_dist} m {isShifted ? "" : `(${row.c3_dist < 0 ? "away" : "towards"})`}
                      </td>
                      <td>
                        {row.c4_dist} m {isShifted ? "" : `(${row.c4_dist < 0 ? "away" : "towards"})`}
                      </td>
                      <td>{row.bend_2} m</td>
                      <td>
                        {row.c7_dist} m {isShifted ? "" : `(${row.c7_dist < 0 ? "away" : "towards"})`}
                      </td>
                      <td>
                        {row.c8_dist} m {isShifted ? "" : `(${row.c8_dist < 0 ? "away" : "towards"})`}
                      </td>
                      <td>{row.bend_3} m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button data-tooltip-id='toggle-shift' onClick={() => setIsShifted(!isShifted)} className="fetch-button">
              {isShifted ? "Show Total Shift (since 1988)" : "Show Shift by Year"}
            </button>
            <Tooltip id="toggle-shift" content="Toggle between total shift since 1988 and yearly shift" />
              <div className="button-container">
                <button data-tooltip-id="info" onClick={() => setShowInfoModal(true)} className="info-button">
                  ¡
                </button>
                <Tooltip id="info" content="Learn more about how these values are calculated" />
                <button data-tooltip-id="save-pdf" onClick={saveTableAsPDF} className="save-pdf-button">
                  Save PDF
                </button>
                <Tooltip id="save-pdf" content="Download table as a PDF" />
              </div>
          </div>
        )}
      </div>

      {showInfoModal && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={() => setShowInfoModal(false)}>
              &times;
            </span>
            <div className="explanation">
                  <p>This application predicts the shift of centerline between in relation to predefined constant points <strong>(control points)</strong>.
                  Three selected meanders (bends) are recognized as sites and two control points are defined for the each bend. </p>
                  <p>The tabular view is as follows</p>
                  <ul>
                    <li><strong>Control Points:</strong> The shift of centerline in relation to the control points since
                    1988 and year-wise. The direction of the centerline shift is given as either towards or away from the control points.</li>
                    <li><strong>Bend Deviation</strong> Magnitude of the deviation in meters.</li>
                  </ul>
                  <p>The process of how the distances are caculated in relation to the control points are illustrated below. [['image']]</p>
                </div>
          </div>
        </div>
      )}


      {contextMenu && (
        <div
          className="context-menu"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
        >
          <button data-tooltip-id='explain-inf' onClick={fetchInferenceImage} className="context-menu-option">
            Show Inference Explanation
          </button>
          <Tooltip id="explain-inf" content="Show how this prediction is made." />
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
            <span className="close" onClick={() => setShowImageModal(false)}>&times;</span>
            <div className="modal-body">
              <div className="map-explanation-container">
                <img src={imageSrc} alt="Inference Explanation" className="inference-image" />
                <div className="explanation">
                  <h3>Saliency Map</h3>
                  <p>This saliency map shows which past inputs had the most influence on the model’s prediction at timestep 3.</p>
                  <ul>
                    <li><strong>Rows:</strong> Past timesteps (1 to 4).</li>
                    <li><strong>Columns:</strong> Different input features. (Distance to centerline from Control Points)</li>
                    <li><strong>Color intensity:</strong> Brighter colors (yellow/white) indicate higher importance, while darker colors (red/black) indicate lower influence.</li>
                  </ul>
                  <p>This visualization shows which timesteps and features had most influence on TCN (Temporal Convolutional Model)'s predictions. </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default MorphologicalPredictions;

import React, { useState } from "react";
import MapWithOverlay from '../MeanderMigration';
import axios from 'axios';

function MorphologicalPredictions() {
  const [tableData, setTableData] = useState([]);
  const [showTable, setShowTable] = useState(false);

  const fetchTableData = async () => {
    try {
      const response = await axios.get(
        "http://127.0.0.1:5000/meander_migration/params",
        {
          params: {
            year: 2025,
            quart: 2,
          },
          withCredentials: true, // Optional, remove if not needed
        }
      );
      setTableData(response.data);
      setShowTable(true);
    } catch (error) {
      console.error("Error fetching data:", error.response?.data || error.message);
    }
  };

  return (
    <div>
      <h1>Morphological Predictions</h1>
      <MapWithOverlay />
      <button onClick={fetchTableData} className="bg-blue-500 text-white px-4 py-2 rounded-lg mt-4">
        Show Tabular Data
      </button>
      {showTable && (
        <table className="mt-4 border border-gray-300 w-full">
          <thead className="bg-gray-100">
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
              <tr key={index} className="border-b">
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
      )}
    </div>
  );
}

export default MorphologicalPredictions;

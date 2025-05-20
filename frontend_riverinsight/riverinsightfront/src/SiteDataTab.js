import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import './SiteData.css'

const SiteDataTab = ({ selectedSite, year, quarter }) => {

  const [data, setData] = useState([]);
  const [showTable, setShowTable] = useState(false);
  const tableRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          "http://127.0.0.1:5000/meander_migration/params/",
          {
            params: { year, quart: quarter },
            withCredentials: true,
          }
        );
        setData(response.data);
      } catch (error) {
        console.error("Error fetching site data:", error.response?.data || error.message);
      }
    };

    fetchData();
  }, [year, quarter]);

  const handleShowTable = () => {
    setShowTable(true);
    setTimeout(() => {
      if (tableRef.current) {
        tableRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const getRelevantColumns = () => {
    switch (selectedSite) {
      case 'Site 1':
        return [
          { key: 'bend_1', label: 'Meander1' },
          { key: 'c1_dist', label: 'Control Point 1' },
          { key: 'c2_dist', label: 'Control Point 2' },
        ];
      case 'Site 2':
        return [
          { key: 'year', label: 'Year' },
          { key: 'quarter', label: 'Quarter' },
          { key: 'bend_2', label: 'Meander 2' },
          { key: 'c3_dist', label: 'Control Point 3' },
          { key: 'c4_dist', label: 'Control Point 4' },
        ];
      case 'Site 3':
        return [
          { key: 'bend_3', label: 'Meander 3' },
          { key: 'c7_dist', label: 'Control Point 7' },
          { key: 'c8_dist', label: 'Control Point 8' },
        ];
      default:
        return [];
    }
  };

  const columns = getRelevantColumns();

  return (
  <div ref={tableRef} className="mt-4">
    <table className="styled-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr key={idx}>
            {columns.map((col) => (
              <td key={col.key}>{row[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

};


export default SiteDataTab;


// import React from 'react';

// const SiteDataTab = ({ selectedSite, year, quarter }) => {
//   return (
//     <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px' }}>
//       <h4>Data Table for {selectedSite} - {year} Q{quarter}</h4>
//       <p>This is a placeholder for the actual data table.</p>
//     </div>
//   );
// };

// export default SiteDataTab;

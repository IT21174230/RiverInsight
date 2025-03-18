import React from "react";
import { FaWater, FaCompass } from "react-icons/fa";
import { useNavigate } from "react-router-dom"; // Import useNavigate

function Navigation({ onMorphologicalClick }) {
  const navigate = useNavigate(); // Initialize navigate function

  return (
    <section className="nav-section">
      <h3>Explore Our Features</h3>
      <div className="nav-menu">
        <div className="nav-item" onClick={onMorphologicalClick} style={{ cursor: "pointer" }}>
          <FaWater className="icon" />
          <h4>Morphological Predictions</h4>
          <p>A dashboard predicting meander migration, riverbank erosion, and flood probability.</p>
        </div>
        <div className="nav-item">
          <FaCompass className="icon" />
          <h4>River Meandering Simulation Tool</h4>
          <p>Simulate river behavior to predict and plan for changes.</p>
        </div>
        <div className="nav-item">
          <FaWater
            className="icon"
            onClick={() => navigate("/floodui")} // Use navigate here
            style={{ cursor: "pointer" }}
          />
          <h4>Flood Prediction Tool</h4>
          <p>Predict flood warnings to plan for changes.</p>
        </div>
      </div>
    </section>
  );
}

export default Navigation;
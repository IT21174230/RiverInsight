import React from "react";
import { useNavigate } from "react-router-dom";
import { FaWater, FaCompass } from "react-icons/fa";

function Navigation() {
  const navigate = useNavigate(); // Ensure this is inside a Router context

  return (
    <section className="nav-section">
      <h3>Explore Our Features</h3>
      <div className="nav-menu">
        <div className="nav-item" onClick={() => navigate("/morphological-predictions")} style={{ cursor: "pointer" }}>
          <FaWater className="icon" />
          <h4>Morphological Predictions</h4>
          <p>A dashboard predicting meander migration, riverbank erosion, and flood probability.</p>
        </div>
        <div className="nav-item">
          <FaCompass className="icon" />
          <h4>River Meandering Simulation Tool</h4>
          <p>Simulate river behavior to predict and plan for changes.</p>
        </div>
        <div className="nav-item" onClick={() => navigate("/floodui")} style={{ cursor: "pointer" }}>
          <FaCompass className="icon" />
          <h4>Flood prediction</h4>
          <p>Simulate river behavior to predict and plan for changes.</p>
        </div>
      </div>
    </section>
  );
}

export default Navigation;

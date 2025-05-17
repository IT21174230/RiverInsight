import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import "./App.css";
import MorphologicalPredictions from "./Morphology";
import Navigation from "./Navigation";
import RiverbankErosion from "./riverbankErosion";
import FloodDashboard from "./pages/Floodui";

const App = () => {
  const [selectedOption, setSelectedOption] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const analysisRef = useRef(null);

  const handleMorphologicalClick = () => {
    setShowDropdown((prev) => !prev);
    if (!showDropdown) {
      setSelectedOption(""); // Reset dropdown selection when opening
    }
  };

  // Focus on the dropdown when it appears
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      dropdownRef.current.focus();
    }
  }, [showDropdown]);

  // Scroll to the analysis section when an option is selected
  useEffect(() => {
    if (selectedOption && analysisRef.current) {
      analysisRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedOption]);

  return (
    <Router>
      <div className="app">
        <header className="banner">
          <div className="banner-content">
            <img src="/RiverInsightRMBG.png" alt="RiverInsight Logo" className="logo" />
            <h1 className="banner-title">RiverInsight: Build Secure Infrastructure for Deduru Oya</h1>
          </div>
        </header>

        <main className="main-content">
          <section className="intro-section">
            <h2>Welcome to RiverInsight</h2>
            <p>Explore our tools to analyze erosion, flooding, and meandering threats.</p>
          </section>

          <Navigation onMorphologicalClick={handleMorphologicalClick} />

          {showDropdown && (
            <div className="dropdown-container">
              <label htmlFor="analysis-select">Select Analysis Type:</label>
              <select
                id="analysis-select"
                ref={dropdownRef}
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="dropdown-select"
              >
                <option value="">-- Select an option --</option>
                <option value="meander-migration">Meander Migration</option>
                <option value="erosion">Erosion</option>
                <option value="flooding">Flooding</option>
              </select>
            </div>
          )}
        </main>

        {showDropdown && (
          <div className="analysis-content full-width" ref={analysisRef}>
            {selectedOption === "meander-migration" && <MorphologicalPredictions />}
            {selectedOption === "erosion" && <RiverbankErosion />}
            {selectedOption === "flooding" && <FloodDashboard />}
          </div>
        )}

        <footer className="footer">
          <p>
            Contact us: <a href="mailto:riverinsight.team@gmail.com">riverinsight.team@gmail.com</a>
          </p>
        </footer>
      </div>
    </Router>
  );
};

export default App;

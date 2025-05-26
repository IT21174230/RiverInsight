import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import "./App.css";
import MorphologicalPredictions from "./Morphology";
import MeanderPredInterface from "./MeanderMig";
import Navigation from "./Navigation";
import RiverbankErosion from "./riverbankErosion";
import FloodDashboard from "./pages/Floodui";
import SimulationTool from "./simulation_tool";

const App = () => {
  const [selectedOption, setSelectedOption] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSimulationTool, setShowSimulationTool] = useState(false);
  const dropdownRef = useRef(null);
  const analysisRef = useRef(null);

  const handleMorphologicalClick = () => {
    setShowDropdown((prev) => !prev);
    setShowSimulationTool(false); // Hide simulation tool when Morphology section opens
    if (!showDropdown) {
      setSelectedOption("");
    }
  };

  const handleSimulationClick = () => {
    setShowSimulationTool((prev) => !prev);
    setShowDropdown(false); // Hide dropdown when Simulation Tool is toggled
  };

  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      dropdownRef.current.focus();
    }
  }, [showDropdown]);

  useEffect(() => {
    if ((selectedOption || showSimulationTool) && analysisRef.current) {
      analysisRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedOption, showSimulationTool]);

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

          <Navigation
            onMorphologicalClick={handleMorphologicalClick}
            onSimulationClick={handleSimulationClick}
          />

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


        {(showDropdown || showSimulationTool) && (
          <div className="analysis-content full-width" ref={analysisRef}>
            {selectedOption === "meander-migration" && <MeanderPredInterface />}

            {selectedOption === "erosion" && <RiverbankErosion />}

            {selectedOption === "flooding" && <FloodDashboard />}
            {showSimulationTool && <SimulationTool />}
          </div>
        )}

        <Routes>
          <Route path="/simulation-tool" element={<SimulationTool />} />
        </Routes>

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
import React, { useState } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import './App.css';
 
import FloodDashboard from "./pages/Floodui";
 
import MorphologicalPredictions from "./Morphology";
import Navigation from './Navigation';
import RiverbankErosion from "./riverbankErosion";
 

const App = () => {
  const [selectedOption, setSelectedOption] = useState("");

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

          <Navigation />

 
        <Routes>
            <Route path="/morphological-predictions" element={<MorphologicalPredictions />} />
            <Route path="/floodui" element={<FloodDashboard />} />
        </Routes>
 
          <div className="dropdown-container">
            <label htmlFor="analysis-select">Select Analysis Type:</label>
            <select
              id="analysis-select"
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
          </main>
          <div className="analysis-content expanded-width">
            {selectedOption === "meander-migration" && <MorphologicalPredictions />}
            {selectedOption === "erosion" && <RiverbankErosion />}
            {selectedOption === "flooding" && <p><FloodDashboard/></p>}
          </div>
 
        
 

 

        <footer className="footer">
          <p>Contact us: <a href="mailto:riverinsight.team@gmail.com">riverinsight.team@gmail.com</a></p>
        </footer>
      </div>
    </Router>
  );
};

export default App;

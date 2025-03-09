import React from 'react';
import { FaCloudRain, FaCompass, FaMountain, FaWater } from 'react-icons/fa';
import { Link, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import HeatmapViewer from './HeatmapViewer'; // Import the HeatmapViewer component
import RiverbankErosion from './riverbankErosion';

const App = () => {
  return (
    <Router>
      <div className="app">
        {/* Banner Section */}
        <header className="banner">
          <div className="banner-content">
            <img
              src="/RiverInsightRMBG.png" // Replace with your actual logo path
              alt="RiverInsight Logo"
              className="logo"
            />
            <h1 className="banner-title">
              RiverInsight: Build Secure Infrastructure for Deduru Oya
            </h1>
          </div>
        </header>

        {/* Define Routes */}
        <Routes>
          {/* Main page with navigation menu */}
          <Route
            path="/"
            element={
              <main className="main-content">
                {/* Introduction Section */}
                <section className="intro-section">
                  <h2>Welcome to RiverInsight</h2>
                  <p>
                    Explore our tools and resources designed to help you tackle the unique challenges of
                    rivers like Deduru Oya, including erosion, flooding, and meandering threats.
                  </p>
                </section>

                {/* Navigation Menu */}
                <section className="nav-section">
                  <h3>Explore Our Features</h3>
                  <div className="nav-menu">
                    <div className="nav-item">
                      <FaWater className="icon" />
                      <h4>Meandering Threats</h4>
                      <p>Understand and mitigate risks associated with river meandering.</p>
                    </div>
                    <div className="nav-item">
                      <FaCompass className="icon" />
                      <h4>River Meandering Simulation Tool</h4>
                      <p>Simulate river behavior to predict and plan for changes.</p>
                    </div>
                    <div className="nav-item">
                      <FaCloudRain className="icon" />
                      <h4>Flooding</h4>
                      <p>Access tools to manage and predict flood risks effectively.</p>
                    </div>
                    {/* Navigation to Riverbank Erosion page */}
                    <div className="nav-item">
                      <Link to="/erosion-prediction">
                        <FaMountain className="icon" />
                        <h4>Riverbank Erosion Threats</h4>
                        <p>Identify and address erosion threats along riverbanks.</p>
                      </Link>
                    </div>
                    {/* Navigation to Heatmap Viewer page */}
                    <div className="nav-item">
                      <Link to="/heatmap-viewer">
                        <FaWater className="icon" />
                        <h4>Heatmap Viewer</h4>
                        <p>View heatmaps of erosion predictions for riverbank points.</p>
                      </Link>
                    </div>
                  </div>
                </section>
              </main>
            }
          />

          {/* Erosion Prediction Page */}
          <Route
            path="/erosion-prediction"
            element={
              <main className="erosion-prediction-page">
                <RiverbankErosion />
                {/* Add HeatmapViewer below the map */}
                <div className="heatmap-section">
                  <h2>Erosion Predictions Heatmap</h2>
                  <HeatmapViewer />
                </div>
              </main>
            }
          />

          {/* Heatmap Viewer Page */}
          <Route
            path="/heatmap-viewer"
            element={
              <main className="heatmap-viewer-page">
                <HeatmapViewer />
              </main>
            }
          />
        </Routes>

        {/* Footer Section */}
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
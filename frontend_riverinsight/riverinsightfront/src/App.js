import React from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MorphologicalPredictions from "./pages/Morphology"; 
import Navigation from './Navigation';
import './App.css';

const App = () => {
  return (
    <Router> {/* Router should wrap the entire app */}
      <div className="app">
        <header className="banner">
          <div className="banner-content">
            <img
              src="/RiverInsightRMBG.png"
              alt="RiverInsight Logo"
              className="logo"
            />
            <h1 className="banner-title">
              RiverInsight: Build Secure Infrastructure for Deduru Oya
            </h1>
          </div>
        </header>

        <main className="main-content">
          <section className="intro-section">
            <h2>Welcome to RiverInsight</h2>
            <p>Explore our tools to analyze erosion, flooding, and meandering threats.</p>
          </section>
        

        <Navigation /> {/* Now inside Router */}

        <Routes>
          <Route path="/morphological-predictions" element={<MorphologicalPredictions />} />
        </Routes>
        </main>

        <footer className="footer">
          <p>Contact us: <a href="mailto:riverinsight.team@gmail.com">riverinsight.team@gmail.com</a></p>
        </footer>
      </div>
    </Router>
  );
};

export default App;

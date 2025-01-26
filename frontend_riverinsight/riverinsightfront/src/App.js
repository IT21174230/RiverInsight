import React from 'react';
import { FaCloudRain, FaCompass, FaMountain, FaWater } from 'react-icons/fa';
import './App.css';

const App = () => {
  return (
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

      {/* Main Content */}
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
            <div className="nav-item">
              <FaMountain className="icon" />
              <h4>Riverbank Erosion Threats</h4>
              <p>Identify and address erosion threats along riverbanks.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Section */}
      <footer className="footer">
        <p>
          Contact us: <a href="mailto:riverinsight.team@gmail.com">riverinsight.team@gmail.com</a>
        </p>
      </footer>
    </div>
  );
};

export default App;
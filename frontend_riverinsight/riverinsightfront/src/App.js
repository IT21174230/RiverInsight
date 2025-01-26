import React from 'react';
import './App.css';

const App = () => {
  return (
    <div className="app">
      {/* Banner Section */}
      <header className="banner">
        <h1>
          <img
            src="/RiverInsightRMBG.png" // Replace with your actual logo path
            alt="RiverInsight Logo"
            className="logo"
          />
          RiverInsight: Build Secure Infrastructure for Deduru Oya
        </h1>
      </header>

      {/* About Us Button */}
      <div className="about-us-button-container">
        <button className="about-us-button">About Us</button>
      </div>

      {/* Main Body Section */}
      <main className="main-content">
        <p>
          RiverInsight helps you design and build secure infrastructure while addressing the unique
          challenges of rivers like Deduru Oya. Explore our tools and resources to tackle erosion,
          flooding, and meandering threats effectively.
        </p>

        {/* Navigation Menu */}
        <nav>
          <ul className="nav-menu">
            <li>Meandering Threats</li>
            <li>Erosion Threats</li>
            <li>Flooding</li>
          </ul>
        </nav>
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

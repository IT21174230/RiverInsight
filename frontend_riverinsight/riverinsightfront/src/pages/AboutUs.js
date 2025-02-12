import React from 'react';
import './App.css';

const AboutUs = () => {
  return (
    <div className="about-us-page">
      <h2>About RiverInsight</h2>
      <p>
        RiverInsight is a tool designed to help you build secure and resilient infrastructure along
        riverbanks. By addressing issues like erosion, flooding, and meandering threats, this
        software empowers engineers and environmentalists to make data-driven decisions.
      </p>
      <p>
        Explore our <a href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer">GitHub Repository</a> for more details, including source code and contributing guidelines.
      </p>
      <p>Thank you for using RiverInsight!</p>
    </div>
  );
};

export default AboutUs;

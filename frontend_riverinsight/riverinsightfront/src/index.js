import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import FloodDashboard from './pages/Floodui';
import Home from './App'; // Create a Home component for your landing page

function App() {
  return (
    
     

     
      <Routes>
        <Route path="/floodui" element={<FloodDashboard />} />
        <Route path="/" element={<Home />} />
      </Routes>
    
  );
}

export default App;
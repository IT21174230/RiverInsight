// RiverbankErosion.jsx  ────────────────────────────────────────────
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import axios from "axios";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import "./RiverbankErosion.css";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIconShadow from "leaflet/dist/images/marker-shadow.png";

/* -------------------------------- CONFIG ------------------------------- */
const API_BASE = "http://127.0.0.1:5000";
const WEATHER_API = "https://climate-api.open-meteo.com/v1/climate"; // Open‑Meteo long‑term CMIP6
const WEATHER_LAT = 7.60589; // central coordinate – adjust if needed
const WEATHER_LON = 79.81261;

/* ---------------------------------------------------------------------- */
const RiverbankErosion = () => {
  /* ─────────────── user inputs ─────────────── */
  const [year, setYear] = useState(2025);
  const [quarter, setQuarter] = useState(1);

  // auto‑populated from Open‑Meteo once year/quarter change
  const [rainfall, setRainfall] = useState(null);      // mm   (mean of the quarter)
  const [temperature, setTemperature] = useState(null); // K    (mean of the quarter)
  const [loadingWeather, setLoadingWeather] = useState(false);

  /* ─────────────── UI state ─────────────── */
  const [baselinePredictions, setBaselinePredictions] = useState(null);
  const [userPredictions, setUserPredictions] = useState(null);
  const [erosionValues, setErosionValues] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [error, setError] = useState("");
  const [openTableModal, setOpenTableModal] = useState(false);
  const [tableData, setTableData] = useState([]);

  /* map */
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);

  /* heat‑map controls */
  const [points, setPoints] = useState("1,2,3,4,5");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  /* ─────────────── coordinates for 25 points (unchanged) ─────────────── */
  const pointCoordinates = [
    { id: "Point_1", lat: 7.6062, lng: 79.80165 },
    { id: "Point_2", lat: 7.60504, lng: 79.80187 },
    { id: "Point_3", lat: 7.60401, lng: 79.80248 },
    { id: "Point_4", lat: 7.6032, lng: 79.80329 },
    { id: "Point_5", lat: 7.60273, lng: 79.80431 },
    { id: "Point_6", lat: 7.60223, lng: 79.80548 },
    { id: "Point_7", lat: 7.60194, lng: 79.8068 },
    { id: "Point_8", lat: 7.60195, lng: 79.8082 },
    { id: "Point_9", lat: 7.60253, lng: 79.80936 },
    { id: "Point_10", lat: 7.60308, lng: 79.81046 },
    { id: "Point_11", lat: 7.6035, lng: 79.8116 },
    { id: "Point_12", lat: 7.6035, lng: 79.81324 },
    { id: "Point_13", lat: 7.60299, lng: 79.81464 },
    { id: "Point_14", lat: 7.60215, lng: 79.81584 },
    { id: "Point_15", lat: 7.60098, lng: 79.81692 },
    { id: "Point_16", lat: 7.59991, lng: 79.8182 },
    { id: "Point_17", lat: 7.59964, lng: 79.82 },
    { id: "Point_18", lat: 7.60004, lng: 79.82129 },
    { id: "Point_19", lat: 7.60091, lng: 79.82241 },
    { id: "Point_20", lat: 7.60241, lng: 79.82277 },
    { id: "Point_21", lat: 7.60384, lng: 79.82191 },
    { id: "Point_22", lat: 7.60495, lng: 79.82064 },
    { id: "Point_23", lat: 7.60628, lng: 79.81995 },
    { id: "Point_24", lat: 7.60786, lng: 79.81949 },
    { id: "Point_25", lat: 7.60933, lng: 79.81968 },
  ];

  /* ─────────────── leaflet icons ─────────────── */
  const makeIcon = (url) =>
    L.icon({
      iconUrl: url,
      iconRetinaUrl: url,
      shadowUrl: markerIconShadow,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });
  const defaultIcon = makeIcon(markerIcon);
  const greenIcon = makeIcon(
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png"
  );
  const yellowIcon = makeIcon(
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png"
  );
  const redIcon = makeIcon(
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png"
  );

  /* ─────────────── 1. init map ─────────────── */
  useEffect(() => {
    const m = L.map("map").setView([7.60589, 79.81261], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(m);

    const legend = L.control({ position: "topright" });
    legend.onAdd = () => {
      const d = L.DomUtil.create("div", "legend");
      d.innerHTML = `
        <h4>Erosion Rate</h4>
        <div><span style="background:green;width:20px;height:20px;display:inline-block"></span> Low (0–1 m/yr)</div>
        <div><span style="background:yellow;width:20px;height:20px;display:inline-block"></span> Moderate (1–5 m/yr)</div>
        <div><span style="background:red;width:20px;height:20px;display:inline-block"></span> Severe (>5 m/yr)</div>`;
      return d;
    };
    legend.addTo(m);

    setMap(m);
    return () => m.remove();
  }, []);

  /* ─────────────── helper – current year/quarter ─────────────── */
  const getCurrentYQ = () => {
    const now = new Date();
    return { year: now.getFullYear(), quarter: Math.ceil((now.getMonth() + 1) / 3) };
  };

  /* ─────────────── 2. fetch quarter‑mean weather whenever year/quarter change ─────────────── */
  useEffect(() => {
    const quarterMonths = { 1: ["01", "03"], 2: ["04", "06"], 3: ["07", "09"], 4: ["10", "12"] };
    const [startM, endM] = quarterMonths[quarter];

    const fetchWeather = async () => {
      setLoadingWeather(true);
      try {
        const params = {
          latitude: WEATHER_LAT,
          longitude: WEATHER_LON,
          start_date: `${year}-${startM}-01`,
          end_date: `${year}-${endM}-28`, // 28 avoids Feb length issues
          models: "MPI_ESM1_2_XR",
          daily: ["temperature_2m_mean", "precipitation_sum"],
          temperature_unit: "celsius",
          precipitation_unit: "mm",
          timezone: "auto",
        };
        const { data } = await axios.get(WEATHER_API, { params });
        if (!data.daily) throw new Error("No daily weather data returned");
        const temps = data.daily.temperature_2m_mean;
        const rains = data.daily.precipitation_sum;
        const meanTempC = temps.reduce((a, b) => a + b, 0) / temps.length;
        const meanRain = rains.reduce((a, b) => a + b, 0) / rains.length;
        setTemperature(Number((meanTempC + 273.15).toFixed(2))); // to Kelvin for model
        setRainfall(Number(meanRain.toFixed(2)));
      } catch (err) {
        setError("Failed to fetch weather data – proceed with manual values if needed.");
      }
      setLoadingWeather(false);
    };

    fetchWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, quarter]);

  /* ─────────────── 3. baseline predictions (current Y/Q) ─────────────── */
  useEffect(() => {
    const { year: curY, quarter: curQ } = getCurrentYQ();
    // use mean temp/rain of *current* period to create a fair baseline; fallback to defaults
    const baselineCall = async () => {
      try {
        const { data } = await axios.post(`${API_BASE}/predict_erosion`, {
          year: curY,
          quarter: curQ,
          rainfall: rainfall ?? 0.35,
          temperature: temperature ?? 301.8,
        });
        const arr = Object.entries(data.predictions).map(([p, v]) => ({ point: p, value: v * 0.625 }));
        setBaselinePredictions(arr);
        setUserPredictions(arr);
        setErosionValues(arr.map((x) => ({ point: x.point, value: 0 })));
      } catch {
        setError("Failed to load baseline predictions.");
      }
    };
    if (rainfall !== null && temperature !== null) baselineCall();
  }, [rainfall, temperature]);

  /* ─────────────── 4. draw baseline markers ─────────────── */
  useEffect(() => {
    if (!map || !baselinePredictions) return;
    markers.forEach((mk) => mk.remove());
    const news = pointCoordinates.map((pt) => {
      const v = baselinePredictions.find((p) => p.point === pt.id)?.value;
      return L.marker([pt.lat, pt.lng], { icon: defaultIcon })
        .addTo(map)
        .bindPopup(`${pt.id}<br>${v?.toFixed(2) ?? "N/A"} m`);
    });
    setMarkers(news);
  }, [map, baselinePredictions]);

  /* ─────────────── 5. submit ─────────────── */
    const handleSubmit = async (e) => {
    e.preventDefault();
    setHeatmap(null);
    setError("");
    if (rainfall === null || temperature === null) {
      setError("Weather data not ready. Please wait…");
      return;
    }
    try {
      const { data: pred } = await axios.post(`${API_BASE}/predict_erosion`, {
        year: +year,
        quarter: +quarter,
        rainfall: +rainfall,
        temperature: +temperature,
      });
      const preds = Object.entries(pred.predictions).map(([p, v]) => ({ point: p, value: v * 0.625 }));
      setUserPredictions(preds);

      // Get current year and quarter predictions for baseline
      const { year: curY, quarter: curQ } = getCurrentYQ();

      // calculate erosion rate correctly
      const yearDiff = (+year - curY) + (quarter - curQ) / 4; // Adjust for quarters
      const eros = preds.map((u) => {
        const base = baselinePredictions?.find((b) => b.point === u.point)?.value || 0;
        const erosionRate = yearDiff > 0 ? (u.value - base) * 0.325 / yearDiff : 0;
        return { point: u.point, value: erosionRate };
      });

      setErosionValues(eros);

      // heatmap
      const { data: hm } = await axios.post(`${API_BASE}/predict_erosion/heatmap`, {
        year: +year,
        quarter: +quarter,
        points: points.split(",").map(Number),
        rainfall: +rainfall,
        temperature: +temperature,
      });
      setHeatmap(hm.heatmap_png_base64);

      // history table
    axios
      .post(`${API_BASE}/predict_erosion/history`, {
        startYear: curY,
        startQuarter: curQ,
        endYear: +year,
        endQuarter: +quarter,
      })
      .then((res) => setTableData(res.data.history || []))
      .catch(() => {});
  } catch (err) {
    setError(err.response?.data?.error || "Prediction failed.");
  }
};


  /* ─────────────── 6. recolour markers with erosion ─────────────── */
  useEffect(() => {
    if (!map || !erosionValues) return;
    markers.forEach((mk) => mk.remove());
    const news = pointCoordinates.map((pt) => {
      const e = erosionValues.find((x) => x.point === pt.id)?.value ?? 0;
      let icon = greenIcon;
      if (e > 1 && e <= 5) icon = yellowIcon;
      if (e > 5) icon = redIcon;
      const mk = L.marker([pt.lat, pt.lng], { icon }).addTo(map);
      mk.bindPopup(`<b>${pt.id}</b><br>Erosion ≈ ${e.toFixed(2)} m`);
      return mk;
    });
    setMarkers(news);
  }, [erosionValues, map]);

  /* ─────────────── 7. table helpers ─────────────── */
  const transformTable = (arr) => {
    const out = {};
    arr.forEach((row) => {
      if (!out[row.year]) out[row.year] = {};
      out[row.year][row.point] = row.value.toFixed(2);
    });
    return out;
  };
  const tableRows = transformTable(tableData);

  const downloadTableAsPDF = () => {
    const el = document.querySelector(".scrollable-dialog-content table");
    if (!el) return;
    html2canvas(el).then((canvas) => {
      const img = canvas.toDataURL("image/png");
      const doc = new jsPDF("landscape");
      doc.text("Future River Width Values", 14, 22);
      doc.addImage(img, "PNG", 10, 30, 280, (canvas.height * 280) / canvas.width);
      doc.save("Future_River_Width_Values.pdf");
    });
  };

  /* ─────────────── 8. checkbox helpers ─────────────── */
  const handleCheckboxChange = (n) => {
    const curr = points.split(",").filter(Boolean).map(Number);
    const next = curr.includes(n) ? curr.filter((x) => x !== n) : [...curr, n];
    setPoints(next.sort((a, b) => a - b).join(","));
  };

  /* ─────────────── JSX ─────────────── */
  return (
    <div className="riverbank-erosion">
      <h2 className="title">Riverbank Erosion Prediction</h2>

      {/* form */}
      <form onSubmit={handleSubmit} className="form">
        <div className="form-row">
          {[
            ["Year", year, setYear, 2025, 2100, 1],
            ["Quarter", quarter, setQuarter, 1, 4, 1],
          ].map(([lbl, val, setter, min, max, step]) => (
            <div className="form-group" key={lbl}>
              <label>{lbl}:</label>
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={val}
                onChange={(e) => setter(Number(e.target.value))}
                onKeyDown={(e) => e.preventDefault()}
              />
            </div>
          ))}
        </div>

        {/* auto weather display */}
        <div className="form-row">
          {loadingWeather ? (
            <div className="weather-loading"><CircularProgress size={20} />&nbsp;Fetching quarter‑mean weather…</div>
          ) : (
            <>
              <div className="form-group">
                <label>Mean Rainfall (mm):</label>
                <input type="number" value={rainfall ?? ""} disabled />
              </div>
              <div className="form-group">
                <label>Mean Temperature (K):</label>
                <input type="number" value={temperature ?? ""} disabled />
              </div>
            </>
          )}
        </div>

        <button type="submit" className="submit-button" disabled={loadingWeather || rainfall === null}>
          Predict
        </button>
        <Button variant="contained" className="submit-button-2" onClick={() => setOpenTableModal(true)}>
          View Future River Widths
        </Button>
      </form>

      {error && <p className="error-message">{error}</p>}

      {/* map + heat‑map */}
      <div className="split-screen-container">
        <div id="map" className="map-container"></div>

        {heatmap && (
          <div className="heatmap-container">
            <img src={`data:image/png;base64,${heatmap}`} alt="Heatmap" style={{ width: "100%", marginBottom: 20 }} />
            <div className="heatmap-inputs">
              {/* point dropdown */}
              <div className="dropdown-button-container">
                <div
                  className={`dropdown-checklist ${isDropdownOpen ? "active" : ""}`}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <button className="dropdown-toggle">Select Points (1‑25) ▼</button>
                  <div className="dropdown-content">
                    <div className="checklist-container">
                      {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
                        <div key={n} className="checklist-item">
                          <input
                            type="checkbox"
                            id={`num-${n}`}
                            checked={points.split(",").includes(String(n))}
                            onChange={() => handleCheckboxChange(n)}
                          />
                          <label htmlFor={`num-${n}`}>{n}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="selected-numbers"><strong>Selected:</strong> {points || "None"}</div>
              </div>

              {/* update btn */}
              <button
                className="submit-button-3"
                onClick={async () => {
                  try {
                    const { data } = await axios.post(`${API_BASE}/predict_erosion/heatmap`, {
                      year: +year,
                      quarter: +quarter,
                      points: points.split(",").map(Number),
                      rainfall: +rainfall,
                      temperature: +temperature,
                    });
                    setHeatmap(data.heatmap_png_base64);
                  } catch {
                    setError("Failed to generate heatmap.");
                  }
                }}
              >
                Update Heatmap
              </button>
            </div>
          </div>
        )}
      </div>

      {/* modal table */}
      <Dialog open={openTableModal} onClose={() => setOpenTableModal(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Future River Width Values</DialogTitle>
        <DialogContent className="scrollable-dialog-content">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Year</TableCell>
                  {pointCoordinates.map((p) => (
                    <TableCell key={p.id}>{p.id.replace(/_/g, " ")}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(tableRows).map(([yr, pts]) => (
                  <TableRow key={yr}>
                    <TableCell>{yr}</TableCell>
                    {pointCoordinates.map((p) => (
                      <TableCell key={p.id}>{pts[p.id] || "-"}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTableModal(false)}>Close</Button>
          <Button onClick={downloadTableAsPDF}>Download as PDF</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default RiverbankErosion;

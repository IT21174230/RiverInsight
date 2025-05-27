// RiverbankErosion.jsx
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
    Tooltip,
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
const WEATHER_API =
    "https://climate-api.open-meteo.com/v1/climate"; // Open-Meteo CMIP-6
const WEATHER_LAT = 7.60589;
const WEATHER_LON = 79.81261;

/* ---------------------------------------------------------------------- */
const erosion = () => {
    /* ─────────────── user inputs ─────────────── */
    const [year, setYear] = useState(2025);
    const [quarter, setQuarter] = useState(1);
    const [userLat, setUserLat] = useState("");
    const [userLng, setUserLng] = useState("");

    /* Open-Meteo quarter means */
    const [rainfall, setRainfall] = useState(null);
    const [temperature, setTemperature] = useState(null);
    const [loadingWeather, setLoadingWeather] = useState(false);

    const [timesteps, setTimesteps] = useState(5); // default 5 timesteps

    /* state */
    const [baselinePredictions, setBaselinePredictions] = useState(null);
    const [erosionValues, setErosionValues] = useState(null);
    const [heatmap, setHeatmap] = useState(null);
    const [error, setError] = useState("");
    const [openTableModal, setOpenTableModal] = useState(false);
    const [tableData, setTableData] = useState([]);
    const [closestPoints, setClosestPoints] = useState([]);

    /* leaflet */
    const [map, setMap] = useState(null);
    const [markerLayer, setMarkerLayer] = useState(null);

    /* heat-map controls */
    const [points, setPoints] = useState("1,2,3,4,5");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    /* reference points (ordered along the river) */
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

    /* icons */
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

    /* distance helpers */
    const deg2rad = (deg) => deg * (Math.PI / 180);
    const calcDist = (la1, lo1, la2, lo2) => {
        const R = 6371;
        const dLa = deg2rad(la2 - la1);
        const dLo = deg2rad(lo2 - lo1);
        const a =
            Math.sin(dLa / 2) ** 2 +
            Math.cos(deg2rad(la1)) * Math.cos(deg2rad(la2)) * Math.sin(dLo / 2) ** 2;
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    /* best contiguous 6-point window */
    const bestWindowSix = (lat, lng) => {
        if (!lat || !lng) return pointCoordinates.slice(0, 6);

        const dists = pointCoordinates.map((p) =>
            calcDist(lat, lng, p.lat, p.lng)
        );

        let bestStart = 0,
            bestSum = Infinity;
        for (let i = 0; i <= pointCoordinates.length - 6; i++) {
            const sum = dists.slice(i, i + 6).reduce((a, b) => a + b, 0);
            if (sum < bestSum) {
                bestSum = sum;
                bestStart = i;
            }
        }
        return pointCoordinates.slice(bestStart, bestStart + 6);
    };

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

        const layer = L.layerGroup().addTo(m);
        setMarkerLayer(layer);
        setMap(m);

        return () => m.remove();
    }, []);

    /* ─────────────── click / drag to select coordinates ─────────────── */
    useEffect(() => {
        if (!map) return;

        let userMarker = null;

        const onClick = (e) => {
            const { lat, lng } = e.latlng;
            setUserLat(lat.toFixed(5));
            setUserLng(lng.toFixed(5));

            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.marker([lat, lng], {
                icon: defaultIcon,
                draggable: true,
            })
                .addTo(map)
                .bindPopup(
                    `Selected<br>Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`
                )
                .openPopup();

            userMarker.on("dragend", (ev) => {
                const pos = ev.target.getLatLng();
                setUserLat(pos.lat.toFixed(5));
                setUserLng(pos.lng.toFixed(5));
                ev.target
                    .setPopupContent(
                        `Selected<br>Lat ${pos.lat.toFixed(5)}, Lng ${pos.lng.toFixed(5)}`
                    )
                    .openPopup();
            });
        };

        map.on("click", onClick);
        return () => map.off("click", onClick);
    }, [map]);

    /* recompute best 6 every time user location changes */
    useEffect(() => {
        setClosestPoints(bestWindowSix(userLat, userLng));
    }, [userLat, userLng]);

    /* current year/quarter helper */
    const getCurrentYQ = () => {
        const now = new Date();
        return { year: now.getFullYear(), quarter: Math.ceil((now.getMonth() + 1) / 3) };
    };

    /* 2. fetch quarter-mean weather */
    useEffect(() => {
        const q = { 1: ["01", "03"], 2: ["04", "06"], 3: ["07", "09"], 4: ["10", "12"] }[
            quarter
        ];
        const [sM, eM] = q;

        const fetchWeather = async () => {
            setLoadingWeather(true);
            try {
                const { data } = await axios.get(WEATHER_API, {
                    params: {
                        latitude: WEATHER_LAT,
                        longitude: WEATHER_LON,
                        start_date: `${year}-${sM}-01`,
                        end_date: `${year}-${eM}-28`,
                        models: "MPI_ESM1_2_XR",
                        daily: ["temperature_2m_mean", "precipitation_sum"],
                        temperature_unit: "celsius",
                        precipitation_unit: "mm",
                        timezone: "auto",
                    },
                });
                const temps = data.daily.temperature_2m_mean;
                const rains = data.daily.precipitation_sum;
                setTemperature(
                    Number((temps.reduce((a, b) => a + b, 0) / temps.length + 273.15).toFixed(2))
                );
                setRainfall(
                    Number((rains.reduce((a, b) => a + b, 0) / rains.length).toFixed(2))
                );
            } catch {
                setError("Failed to fetch weather data.");
            }
            setLoadingWeather(false);
        };
        fetchWeather();
    }, [year, quarter]);

    /* 3. baseline predictions */
    useEffect(() => {
        const { year: curY, quarter: curQ } = getCurrentYQ();
        if (rainfall === null || temperature === null) return;

        (async () => {
            try {
                const { data } = await axios.post(`${API_BASE}/predict_erosion`, {
                    year: curY,
                    quarter: curQ,
                    rainfall: +rainfall / 1000,
                    temperature: +temperature,
                });
                const arr = Object.entries(data.predictions).map(([p, v]) => ({
                    point: p,
                    value: v * 0.625,
                }));
                setBaselinePredictions(arr);
                setErosionValues(
                    arr.map((x) => ({ point: x.point, value: 0 }))
                );
            } catch {
                setError("Failed to load baseline predictions.");
            }
        })();
    }, [rainfall, temperature]);

    /* draw reference markers (baseline or recoloured) */
    const drawMarkers = (vals, colourFn) => {
        if (!markerLayer || !vals) return;

        // show either the 6 closest points or the default first 6
        const show =
            userLat && userLng ? closestPoints : pointCoordinates.slice(0, 6);

        markerLayer.clearLayers();

        show.forEach((pt) => {
            const v = vals.find((x) => x.point === pt.id)?.value ?? 0;
            const vAbs = Math.abs(v);

            const icon = colourFn ? colourFn(vAbs) : defaultIcon;

            L.marker([pt.lat, pt.lng], { icon })
                .addTo(markerLayer)
                .bindPopup(
                    colourFn
                        ? `<b>${pt.id}</b><br>Erosion ≈ ${vAbs.toFixed(2)} m/yr`
                        : `${pt.id}<br>${vAbs.toFixed(2)} m`
                );
        });
    };


    /* baseline draw */
    useEffect(() => {
        drawMarkers(
            baselinePredictions,
            null // default colour
        );
    }, [markerLayer, baselinePredictions, closestPoints]);


    useEffect(() => {
        const updateHeatmap = async () => {
            if (!erosionValues || closestPoints.length === 0) return;
            try {
                const selectedPoints = closestPoints.map((p) => parseInt(p.id.split("_")[1]));
                const { data } = await axios.post(`${API_BASE}/predict_erosion/heatmap`, {
                    year: +year,
                    quarter: +quarter,
                    points: selectedPoints,
                    rainfall: +rainfall,
                    temperature: +temperature,
                });
                setHeatmap(data.heatmap_png_base64);
            } catch {
                setError("Failed to update heatmap.");
            }
        };

        updateHeatmap();
    }, [closestPoints, erosionValues, year, quarter, rainfall, temperature]);


    /* 5. Predict submit */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setHeatmap(null);
        setError("");

        if (rainfall === null || temperature === null) {
            setError("Weather data not ready.");
            return;
        }

        try {
            const { data } = await axios.post(`${API_BASE}/predict_erosion`, {
                year: +year,
                quarter: +quarter,
                rainfall: +rainfall / 1000,
                temperature: +temperature,
            });

            const preds = Object.entries(data.predictions).map(([pt, v]) => ({
                point: pt,
                value: v * 0.625,
            }));

            const { year: curY, quarter: curQ } = getCurrentYQ();
            const yearDiff = +year - curY + (quarter - curQ) / 4;

            let eros = preds.map((u) => {
                const base = baselinePredictions.find((b) => b.point === u.point)?.value || 0;
                const raw = yearDiff > 0 ? ((u.value - base) / yearDiff) : 0;

                return {
                    point: u.point,
                    value: raw,
                };
            });


            setErosionValues(eros);


            axios
                .post(`${API_BASE}/predict_erosion/history`, {
                    startYear: curY,
                    startQuarter: curQ,
                    endYear: +year,
                    endQuarter: +quarter,
                    rainfall: +rainfall / 1000,
                temperature: +temperature,
                })
                .then((r) => setTableData(r.data.history || []))
                .catch(() => { });
        } catch (err) {
            setError(err.response?.data?.error || "Prediction failed.");
        }
    };

    /* recolour markers when erosionValues changes */
    useEffect(() => {
        drawMarkers(erosionValues, (v) =>
            v > 5 ? redIcon : v > 1 ? yellowIcon : greenIcon
        );
    }, [erosionValues, closestPoints]);

    /* table helpers */
    const pivotTable = (arr) => {
        const out = {};
        arr.forEach((r) => {
            if (!out[r.year]) out[r.year] = {};
            out[r.year][r.point] = r.value.toFixed(2);
        });
        return out;
    };
    const tableRows = pivotTable(tableData);

    const downloadPDF = () => {
        const el = document.querySelector(".scrollable-dialog-content table");
        if (!el) return;

        html2canvas(el).then((canvas) => {
            const img = canvas.toDataURL("image/png");
            const doc = new jsPDF("landscape");
            const pageWidth = doc.internal.pageSize.getWidth();

            // Title - Centered
            const title = "Riverbank Erosion Forecast Report";
            doc.setFontSize(18);
            doc.setTextColor(40, 40, 40);
            const titleWidth = doc.getTextWidth(title);
            doc.text(title, (pageWidth - titleWidth) / 2, 20);

            // Subtitle - Centered
            const subtitle = "Predicted Future River Widths and Reference Point Coordinates";
            doc.setFontSize(12);
            doc.setTextColor(100);
            const subtitleWidth = doc.getTextWidth(subtitle);
            doc.text(subtitle, (pageWidth - subtitleWidth) / 2, 28);

            // Table image
            const imgWidth = 270;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            doc.addImage(img, "PNG", 14, 34, imgWidth, imgHeight);

            // Divider
            const sectionStart = 34 + imgHeight + 10;
            doc.setDrawColor(180);
            doc.line(14, sectionStart, pageWidth - 14, sectionStart);

            // Coordinates heading
            doc.setFontSize(14);
            doc.setTextColor(33, 33, 33);
            doc.text("Reference Point Coordinates (Displayed 6 Points)", 14, sectionStart + 10);

            // Coordinates list
            doc.setFontSize(10);
            doc.setTextColor(80, 80, 80);
            let offsetY = sectionStart + 18;
            closestPoints.forEach((pt, idx) => {
                doc.text(
                    `${idx + 1}. ${pt.id.replace("_", " ")}  →  Latitude: ${pt.lat.toFixed(
                        5
                    )}, Longitude: ${pt.lng.toFixed(5)}`,
                    18,
                    offsetY + idx * 6
                );
            });

            // Footer note
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("Note: Erosion values are model predictions based on climate data.", 14, 205);

            // Save
            doc.save("Riverbank_Erosion_Report.pdf");
        });
    };




    /* point checkbox */
    const handleCheckboxChange = (n) => {
        const curr = points.split(",").filter(Boolean).map(Number);
        setPoints(
            (curr.includes(n) ? curr.filter((x) => x !== n) : [...curr, n])
                .sort((a, b) => a - b)
                .join(",")
        );
    };

    /* ─────────────── JSX ─────────────── */
    return (
        <div className="riverbank-erosion">
            <h2 className="title">Riverbank Erosion Prediction</h2>

            <form onSubmit={handleSubmit} className="form">
                <div className="form-row">
                    {[
                        ["Year", year, setYear, 2025, 2100, 1],
                        ["Quarter", quarter, setQuarter, 1, 4, 1],
                        ["Latitude", userLat, setUserLat, -90, 90, 0.00001],
                        ["Longitude", userLng, setUserLng, -180, 180, 0.00001],
                    ].map(([lbl, val, setter, min, max, step]) => (
                        <div className="form-group" key={lbl}>
                            <label>{lbl}:</label>
                            <input
                                type="number"
                                min={min}
                                max={max}
                                step={step}
                                value={val}
                                onChange={(e) => setter(e.target.value)}
                                placeholder={
                                    lbl === "Latitude"
                                        ? "e.g. 7.60589"
                                        : lbl === "Longitude"
                                            ? "e.g. 79.81261"
                                            : ""
                                }
                            />
                        </div>
                    ))}
                </div>

                <div className="form-row">
                    {loadingWeather ? (
                        <Tooltip title="Fetching CMIP-6 quarter-mean climate values…" arrow>
                            <div className="weather-loading">
                                <CircularProgress size={20} />
                                &nbsp;Fetching quarter-mean weather…
                            </div>
                        </Tooltip>
                    ) : (
                        <>
                            <div className="form-group">
                                <Tooltip title="Average daily rainfall for the chosen quarter" arrow>
                                    <label>Mean Rainfall (mm):</label>
                                </Tooltip>
                                <input type="number" value={rainfall ?? ""} disabled />
                            </div>
                            <div className="form-group">
                                <Tooltip title="Average daily temperature for the chosen quarter (Kelvin)" arrow>
                                    <label>Mean Temperature (K):</label>
                                </Tooltip>
                                <input type="number" value={temperature ?? ""} disabled />
                            </div>
                        </>
                    )}
                </div>

                <Tooltip title="Run erosion prediction using current inputs" arrow>
                    <button
                        type="submit"
                        className="submit-button"
                        disabled={loadingWeather || rainfall === null}
                    >
                        Predict
                    </button>
                </Tooltip>

                <Tooltip title="Open a table of future river widths for the selected points" arrow>
                    <Button
                        variant="contained"
                        className="submit-button-2"
                        onClick={() => setOpenTableModal(true)}
                    >
                        View Future River Widths
                    </Button>
                </Tooltip>
            </form>

            {error && <p className="error-message">{error}</p>}

            <div className="split-screen-container">
                <div id="map" className="map-container" />

                {/* ─────────────── XAI HEAT-MAP ─────────────── */}
                <div className="">
                    {heatmap && (
                        <div className="xai-module">
                            {/* Header with gradient and icon */}
                            <div className="xai-header">
                                <div className="xai-title-container">
                                    <svg className="xai-icon" viewBox="0 0 24 24">
                                        <path fill="currentColor" d="M12,2L4,5V11.09C4,16.14 7.41,20.85 12,22C16.59,20.85 20,16.14 20,11.09V5L12,2M12.75,13.47L12.75,7H11.25V13.47L9.75,12L8.75,13.07L11.06,15.38L12,16.32L12.94,15.38L15.25,13.07L14.25,12L12.75,13.47Z" />
                                    </svg>
                                    <Tooltip
                                        arrow
                                        title="Explainable-AI view: colour intensity shows how much each quarter drives the current erosion estimate"
                                    >
                                        <h3 className="xai-title">
                                            <span className="xai-title-text">XAI Influence Analysis</span>
                                        </h3>
                                    </Tooltip>
                                </div>


                                {/* Description with animated underline */}
                                <div className="xai-description-container">
                                    <p className="xai-description">
                                        This panel breaks down the model's forecast by showing the{" "}
                                        <strong className="xai-highlight">relative influence of the most recent five timesteps</strong>{" "}
                                        on your selected&nbsp;river points. Use it to see <em className="xai-emphasis">which</em>{" "}
                                        quarters the model considered most important when estimating the
                                        annual erosion rate.
                                    </p>
                                    <div className="xai-underline"></div>
                                </div>
                            </div>

                            {/* Heatmap with modern frame and interactive elements */}
                            <Tooltip
                                arrow
                                title="Hover to see the influence value for each quarter–point pair"
                            >

                                <div className="">
                                    <img
                                        src={`data:image/png;base64,${heatmap}`}
                                        alt="XAI quarter-influence heat-map"
                                        className="xai-heatmap-image"
                                    />

                                </div>

                            </Tooltip>


                        </div>
                    )}
                </div>
            </div>


            <Dialog
                open={openTableModal}
                onClose={() => setOpenTableModal(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle>Future River Width Values (m)</DialogTitle>
                <DialogContent className="scrollable-dialog-content">
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Year</TableCell>
                                    {closestPoints.map((p) => (
                                        <TableCell key={p.id}>
                                            {p.id.replace(/_/g, " ")} (m)
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Object.entries(tableRows).map(([yr, pts]) => (
                                    <TableRow key={yr}>
                                        <TableCell>{yr}</TableCell>
                                        {closestPoints.map((p) => (
                                            <TableCell key={p.id}>
                                                {pts[p.id]
                                                    ? parseFloat(pts[p.id]).toFixed(2)
                                                    : "-"}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions>
                    <Button className="mui-download-btn" onClick={() => setOpenTableModal(false)}>Close</Button>
                    <Tooltip title="Export the table and selected point coordinates to PDF" arrow>
                        <Button className="mui-download-btn" onClick={downloadPDF}>Download as PDF</Button>
                    </Tooltip>
                </DialogActions>
            </Dialog>

        </div>
    );
};

export default erosion;
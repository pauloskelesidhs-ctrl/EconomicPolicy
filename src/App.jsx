import React, { useMemo, useState } from "react";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function App() {
  const [model, setModel] = useState("IS-LM");
  const [policyType, setPolicyType] = useState("Fiscal");
  const [govSpending, setGovSpending] = useState(120);
  const [taxes, setTaxes] = useState(30);
  const [moneySupply, setMoneySupply] = useState(100);
  const [interestRate, setInterestRate] = useState(4);
  const [inflation, setInflation] = useState(4);
  const [shockType, setShockType] = useState("None");
  const [shockStrength, setShockStrength] = useState(0);
  const [mpSlope, setMpSlope] = useState(0.05);
  const [naturalRate, setNaturalRate] = useState(2);
  const [outputGap, setOutputGap] = useState(0);
  const [shockQuery, setShockQuery] = useState("");
  const [shockResult, setShockResult] = useState("");

  const clearShockResult = () => setShockResult("");

  // ── SVG geometry ──────────────────────────────────────────────────────────
  const width = 820;
  const height = 500;
  const margin = { top: 30, right: 30, bottom: 50, left: 68 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const yRanges = { "AD-AS": [0, 200], "IS-LM": [-10, 20], "IS-MP": [-2, 14] };
  const [yMin, yMax] = yRanges[model] ?? [-10, 20];

  const sx = (x) => margin.left + (x / 200) * innerWidth;
  const sy = (y) => height - margin.bottom - ((y - yMin) / (yMax - yMin)) * innerHeight;

  // ── Curve builders ────────────────────────────────────────────────────────
  function buildAdAs(p) {
    const adShift =
      (p.govSpending - 120) * 0.7 - (p.taxes - 30) * 0.6 +
      (p.moneySupply - 100) * 0.5 - (p.interestRate - 4) * 4 +
      (p.shockType === "Demand" ? p.shockStrength * 8 : 0);
    const srasShift =
      (p.shockType === "Supply" ? p.shockStrength * 12 : 0) + p.inflation * 1.3;
    const AD = (y) => 170 - 0.7 * y + adShift;
    const SRAS = (y) => 30 + 0.6 * y + srasShift;
    const eqY = (170 + adShift - 30 - srasShift) / 1.3;
    return {
      AD, SRAS, potentialOutput: 110,
      eq: { x: clamp(eqY, 0, 200), y: clamp(AD(eqY), 0, 200) },
    };
  }

  function buildIsLm(p) {
    const isShift = (p.govSpending - 120) * 0.05 - (p.taxes - 30) * 0.04;
    const lmShift = (p.moneySupply - 100) * 0.05 - (p.interestRate - 4) * 0.6;
    const IS = (y) => 18 - 0.07 * y + isShift;
    const LM = (y) => -2 + 0.09 * y - lmShift;
    const eqY = (20 + isShift + lmShift) / 0.16;
    return {
      IS, LM, fe: 110,
      eq: { x: clamp(eqY, 0, 200), y: clamp(IS(eqY), -10, 20) },
    };
  }

  function buildIsMp(p) {
    const isShift = (p.govSpending - 120) * 0.05 - (p.taxes - 30) * 0.04;
    const feOut = 110 + p.outputGap * 2;
    const IS = (y) => 12 - 0.06 * y + isShift;
    const MP = (y) => p.naturalRate + p.mpSlope * (y - feOut);
    const eqY = (12 + isShift - p.naturalRate + p.mpSlope * feOut) / (0.06 + p.mpSlope);
    return {
      IS, MP, feOut, nr: p.naturalRate,
      eq: { x: clamp(eqY, 0, 200), y: clamp(IS(eqY), -2, 14) },
    };
  }

  const cp = { govSpending, taxes, moneySupply, interestRate, inflation, shockType, shockStrength, mpSlope, naturalRate, outputGap };
  const adAs = useMemo(() => buildAdAs(cp), [govSpending, taxes, moneySupply, interestRate, inflation, shockType, shockStrength]);
  const isLm = useMemo(() => buildIsLm(cp), [govSpending, taxes, moneySupply, interestRate]);
  const isMp = useMemo(() => buildIsMp(cp), [govSpending, taxes, mpSlope, naturalRate, outputGap]);

  const makePath = (fn) => {
    let d = "";
    for (let x = 0; x <= 200; x += 2) {
      const px = sx(x), py = sy(fn(x));
      d += x === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
    }
    return d;
  };

  // ── Presets ───────────────────────────────────────────────────────────────
  const applyPreset = (fn) => { clearShockResult(); fn(); };

  const PRESETS = {
    "positive demand shock":   () => applyPreset(() => { setModel("AD-AS"); setShockType("Demand");  setShockStrength(6);  setInflation(4); setShockResult("Positive demand shock: AD shifts right → higher output & prices."); }),
    "negative demand shock":   () => applyPreset(() => { setModel("AD-AS"); setShockType("Demand");  setShockStrength(-6); setInflation(2); setShockResult("Negative demand shock: AD shifts left → lower output & prices."); }),
    "positive supply shock":   () => applyPreset(() => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(-6); setInflation(1); setShockResult("Positive supply shock: SRAS shifts right → higher output, lower prices."); }),
    "negative supply shock":   () => applyPreset(() => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(6);  setInflation(6); setShockResult("Negative supply shock: SRAS shifts left → lower output, higher prices."); }),
    "stagflation":             () => applyPreset(() => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(8);  setInflation(8); setShockResult("Stagflation: severe negative supply shock → output ↓, prices ↑."); }),
    "expansionary fiscal":     () => applyPreset(() => { setModel("IS-LM"); setPolicyType("Fiscal");   setGovSpending(150); setTaxes(20);   setShockResult("Expansionary fiscal: IS shifts right → higher income & interest rate."); }),
    "contractionary fiscal":   () => applyPreset(() => { setModel("IS-LM"); setPolicyType("Fiscal");   setGovSpending(95);  setTaxes(45);   setShockResult("Contractionary fiscal: IS shifts left → lower income & interest rate."); }),
    "expansionary monetary":   () => applyPreset(() => { setModel("IS-LM"); setPolicyType("Monetary"); setMoneySupply(130); setInterestRate(2); setShockResult("Expansionary monetary: LM shifts right → higher income, lower rate."); }),
    "contractionary monetary": () => applyPreset(() => { setModel("IS-LM"); setPolicyType("Monetary"); setMoneySupply(80);  setInterestRate(7); setShockResult("Contractionary monetary: LM shifts left → lower income, higher rate."); }),
  };

  const applySearch = () => {
    const q = shockQuery.toLowerCase().trim().replace(/\s+/g, " ");
    const p = PRESETS[q];
    if (p) p(); else alert("Try: " + Object.keys(PRESETS).join(", "));
  };

  const applyExpFiscal   = () => applyPreset(() => { setPolicyType("Fiscal");   if (model !== "IS-MP") setModel("IS-LM"); setGovSpending(150); setTaxes(20); });
  const applyConFiscal   = () => applyPreset(() => { setPolicyType("Fiscal");   if (model !== "IS-MP") setModel("IS-LM"); setGovSpending(95);  setTaxes(45); });
  const applyExpMon      = () => applyPreset(() => { setPolicyType("Monetary"); setModel("IS-LM"); setMoneySupply(130); setInterestRate(2); });
  const applyConMon      = () => applyPreset(() => { setPolicyType("Monetary"); setModel("IS-LM"); setMoneySupply(80);  setInterestRate(7); });

  const resetAll = () => {
    setModel("IS-LM"); setPolicyType("Fiscal");
    setGovSpending(120); setTaxes(30);
    setMoneySupply(100); setInterestRate(4);
    setInflation(4); setShockType("None"); setShockStrength(0);
    setShockQuery(""); setShockResult("");
    setNaturalRate(2); setMpSlope(0.05); setOutputGap(0);
  };

  // ── Equilibrium ───────────────────────────────────────────────────────────
  const curEq = model === "AD-AS" ? adAs.eq : model === "IS-MP" ? isMp.eq : isLm.eq;
  const ceX = sx(curEq.x), ceY = sy(curEq.y);

  // ── Interpretation ────────────────────────────────────────────────────────
  const interpretation = useMemo(() => {
    if (shockResult) return shockResult;
    if (model === "AD-AS") {
      let t = "";
      if (shockType === "Supply") t += shockStrength >= 6 ? "Negative supply shock: SRAS shifts left. " : shockStrength > 0 ? "Mild negative supply shock. " : shockStrength <= -6 ? "Positive supply shock: SRAS shifts right. " : shockStrength < 0 ? "Mild positive supply shock. " : "";
      else if (shockType === "Demand") t += shockStrength >= 6 ? "Positive demand shock: AD shifts right. " : shockStrength > 0 ? "Mild positive demand shock. " : shockStrength <= -6 ? "Negative demand shock: AD shifts left. " : shockStrength < 0 ? "Mild negative demand shock. " : "";
      t += adAs.eq.x > adAs.potentialOutput + 2 ? "Output above potential — inflationary gap." : adAs.eq.x < adAs.potentialOutput - 2 ? "Output below potential — recessionary gap." : "Economy near long-run equilibrium.";
      return t;
    }
    if (model === "IS-MP") {
      let t = govSpending > 120 || taxes < 30 ? "Expansionary fiscal: IS shifts right. " : govSpending < 120 || taxes > 30 ? "Contractionary fiscal: IS shifts left. " : "Fiscal policy neutral. ";
      const g = isMp.eq.x - isMp.feOut;
      t += g > 2 ? "Output above CB target — MP tightens." : g < -2 ? "Output below CB target — MP eases." : "Economy at CB target.";
      return t;
    }
    let t = "";
    if (policyType === "Fiscal") t += govSpending > 120 || taxes < 30 ? "Expansionary fiscal: IS shifts right. " : govSpending < 120 || taxes > 30 ? "Contractionary fiscal: IS shifts left. " : "Fiscal policy neutral. ";
    if (policyType === "Monetary") t += moneySupply > 100 || interestRate < 4 ? "Expansionary monetary: LM shifts right. " : moneySupply < 100 || interestRate > 4 ? "Contractionary monetary: LM shifts left. " : "Monetary policy neutral. ";
    t += isLm.eq.x > isLm.fe + 2 ? "Output above full-employment." : isLm.eq.x < isLm.fe - 2 ? "Output below full-employment." : "Output near full-employment.";
    return t;
  }, [shockResult, model, policyType, govSpending, taxes, moneySupply, interestRate, shockType, shockStrength, adAs, isLm, isMp]);

  const axisLabels = {
    "AD-AS": { x: "Real Output (Y)", y: "Price Level (P)" },
    "IS-LM": { x: "Income / Output (Y)", y: "Interest Rate (i)" },
    "IS-MP": { x: "Output (Y)", y: "Real Interest Rate (r)" },
  };
  const { x: xLabel, y: yLabel } = axisLabels[model];

  return (
    <div className="page">
      <header className="topbar">
        <h1>EconomicPolicy</h1>
      </header>

      <main className="layout">
        <aside className="sidebar">
          <div className="card">
            <h2>Policy Controls</h2>

            {/* Shock search */}
            <div className="panel-section">
              <label className="field">
                <span>Shock / Scenario Search</span>
                <input
                  type="text"
                  value={shockQuery}
                  onChange={(e) => setShockQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applySearch()}
                  placeholder="e.g. stagflation, expansionary fiscal…"
                />
              </label>
              <div className="button-row">
                <button onClick={applySearch}>Apply</button>
              </div>
            </div>

            {/* Model */}
            <label className="field">
              <span>Model</span>
              <select value={model} onChange={(e) => { clearShockResult(); setModel(e.target.value); if (e.target.value === "IS-MP") setPolicyType("Monetary"); }}>
                <option>IS-LM</option>
                <option>IS-MP</option>
                <option>AD-AS</option>
              </select>
            </label>

            {/* Policy tabs */}
            {model !== "AD-AS" && (
              <div className="policy-switch">
                <button className={policyType === "Fiscal" ? "tab active" : "tab"} onClick={() => { clearShockResult(); setPolicyType("Fiscal"); }}>Fiscal</button>
                <button className={policyType === "Monetary" ? "tab active" : "tab"} onClick={() => { clearShockResult(); setPolicyType("Monetary"); if (model !== "IS-MP") setModel("IS-LM"); }}>Monetary</button>
              </div>
            )}

            {/* Fiscal controls */}
            {policyType === "Fiscal" && (
              <div className="panel-section">
                <label className="field">
                  <span>Government spending: {govSpending}</span>
                  <input type="range" min="80" max="180" value={govSpending} onChange={(e) => { clearShockResult(); setGovSpending(+e.target.value); }} />
                </label>
                <label className="field">
                  <span>Taxes: {taxes}%</span>
                  <input type="range" min="0" max="100" value={taxes} onChange={(e) => { clearShockResult(); setTaxes(+e.target.value); }} />
                </label>
                <div className="button-row">
                  <button onClick={applyExpFiscal}>Expansionary</button>
                  <button onClick={applyConFiscal}>Contractionary</button>
                </div>
              </div>
            )}

            {/* Monetary IS-LM */}
            {model === "IS-LM" && policyType === "Monetary" && (
              <div className="panel-section">
                <label className="field">
                  <span>Money supply: {moneySupply}</span>
                  <input type="range" min="60" max="160" value={moneySupply} onChange={(e) => { clearShockResult(); setMoneySupply(+e.target.value); }} />
                </label>
                <label className="field">
                  <span>Interest rate: {interestRate}%</span>
                  <input type="range" min="-10" max="20" value={interestRate} onChange={(e) => { clearShockResult(); setInterestRate(+e.target.value); }} />
                </label>
                <div className="button-row">
                  <button onClick={applyExpMon}>Expansionary</button>
                  <button onClick={applyConMon}>Contractionary</button>
                </div>
              </div>
            )}

            {/* IS-MP controls */}
            {model === "IS-MP" && policyType === "Monetary" && (
              <div className="panel-section">
                <label className="field">
                  <span>Natural rate r* = {naturalRate.toFixed(1)}%</span>
                  <input type="range" min="0" max="8" step="0.1" value={naturalRate} onChange={(e) => { clearShockResult(); setNaturalRate(+e.target.value); }} />
                </label>
                <label className="field">
                  <span>MP slope λ = {mpSlope.toFixed(2)}</span>
                  <input type="range" min="0.01" max="0.2" step="0.01" value={mpSlope} onChange={(e) => { clearShockResult(); setMpSlope(+e.target.value); }} />
                </label>
                <label className="field">
                  <span>CB target shift: {outputGap > 0 ? "+" : ""}{outputGap}</span>
                  <input type="range" min="-20" max="20" value={outputGap} onChange={(e) => { clearShockResult(); setOutputGap(+e.target.value); }} />
                </label>
                <div className="info-hint">r = r* + λ·(Y − Y*)</div>
              </div>
            )}

            {/* AD-AS controls */}
            {model === "AD-AS" && (
              <div className="panel-section">
                <label className="field">
                  <span>Inflation: {inflation}%</span>
                  <input type="range" min="-10" max="50" value={inflation} onChange={(e) => { clearShockResult(); setInflation(+e.target.value); }} />
                </label>
                <label className="field">
                  <span>Money supply: {moneySupply}</span>
                  <input type="range" min="60" max="160" value={moneySupply} onChange={(e) => { clearShockResult(); setMoneySupply(+e.target.value); }} />
                </label>
                <label className="field">
                  <span>Interest rate: {interestRate}%</span>
                  <input type="range" min="-10" max="20" value={interestRate} onChange={(e) => { clearShockResult(); setInterestRate(+e.target.value); }} />
                </label>
                <label className="field">
                  <span>Shock type</span>
                  <select value={shockType} onChange={(e) => { clearShockResult(); setShockType(e.target.value); }}>
                    <option>None</option>
                    <option>Demand</option>
                    <option>Supply</option>
                  </select>
                </label>
                <label className="field">
                  <span>{shockType !== "None" ? `${shockType} shock: ${shockStrength}` : `Shock intensity: ${shockStrength}`}</span>
                  <input type="range" min="-10" max="10" value={shockStrength} onChange={(e) => { clearShockResult(); setShockStrength(+e.target.value); }} />
                </label>
              </div>
            )}

            <div className="button-row">
              <button className="reset-btn" onClick={resetAll}>Reset</button>
            </div>

            <div className="info-box">
              <strong>Interpretation</strong>
              <p>{interpretation}</p>
              {model === "AD-AS" && <p><strong>Eq. output:</strong> {adAs.eq.x.toFixed(1)}<br /><strong>Price level:</strong> {adAs.eq.y.toFixed(1)}</p>}
              {model === "IS-LM" && <p><strong>Eq. income:</strong> {isLm.eq.x.toFixed(1)}<br /><strong>Interest rate:</strong> {isLm.eq.y.toFixed(1)}%</p>}
              {model === "IS-MP" && <p><strong>Eq. output:</strong> {isMp.eq.x.toFixed(1)}<br /><strong>Real rate:</strong> {isMp.eq.y.toFixed(2)}%</p>}
            </div>
          </div>
        </aside>

        <section className="graph-section">
          <div className="card graph-card">
            <h2>{model} Graph</h2>

            <svg viewBox={`0 0 ${width} ${height}`} className="graph-svg">
              {/* Axes */}
              <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="#111827" strokeWidth="2" />
              <line x1={margin.left} y1={height - margin.bottom} x2={margin.left} y2={margin.top} stroke="#111827" strokeWidth="2" />
              <text x={width / 2 - 55} y={height - 10} fontSize="14">{xLabel}</text>
              <text x="12" y="22" fontSize="14">{yLabel}</text>

              {/* AD-AS */}
              {model === "AD-AS" && <>
                <path d={makePath(adAs.AD)}   fill="none" stroke="#2563eb" strokeWidth="3" />
                <text x={sx(155)} y={sy(adAs.AD(155)) - 8}   fill="#2563eb" fontSize="13" fontWeight="700">AD</text>
                <path d={makePath(adAs.SRAS)} fill="none" stroke="#dc2626" strokeWidth="3" />
                <text x={sx(138)} y={sy(adAs.SRAS(138)) - 8} fill="#dc2626" fontSize="13" fontWeight="700">SRAS</text>
                <line x1={sx(adAs.potentialOutput)} y1={margin.top} x2={sx(adAs.potentialOutput)} y2={height - margin.bottom} stroke="#16a34a" strokeWidth="3" strokeDasharray="8 6" />
                <text x={sx(adAs.potentialOutput) + 5} y={margin.top + 16} fill="#16a34a" fontSize="13">LRAS</text>
              </>}

              {/* IS-LM */}
              {model === "IS-LM" && <>
                <path d={makePath(isLm.IS)} fill="none" stroke="#2563eb" strokeWidth="3" />
                <text x={sx(155)} y={sy(isLm.IS(155)) - 8} fill="#2563eb" fontSize="13" fontWeight="700">IS</text>
                <path d={makePath(isLm.LM)} fill="none" stroke="#dc2626" strokeWidth="3" />
                <text x={sx(140)} y={sy(isLm.LM(140)) - 8} fill="#dc2626" fontSize="13" fontWeight="700">LM</text>
                <line x1={sx(isLm.fe)} y1={margin.top} x2={sx(isLm.fe)} y2={height - margin.bottom} stroke="#16a34a" strokeWidth="3" strokeDasharray="8 6" />
                <text x={sx(isLm.fe) + 5} y={margin.top + 16} fill="#16a34a" fontSize="13">FE</text>
              </>}

              {/* IS-MP */}
              {model === "IS-MP" && <>
                <path d={makePath(isMp.IS)} fill="none" stroke="#2563eb" strokeWidth="3" />
                <text x={sx(150)} y={sy(isMp.IS(150)) - 8} fill="#2563eb" fontSize="13" fontWeight="700">IS</text>
                <path d={makePath(isMp.MP)} fill="none" stroke="#dc2626" strokeWidth="3" />
                <text x={sx(155)} y={sy(isMp.MP(155)) - 8} fill="#dc2626" fontSize="13" fontWeight="700">MP</text>
                <line x1={margin.left} y1={sy(isMp.nr)} x2={width - margin.right} y2={sy(isMp.nr)} stroke="#9333ea" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.6" />
                <text x={margin.left + 4} y={sy(isMp.nr) - 5} fill="#9333ea" fontSize="11">r*</text>
                <line x1={sx(isMp.feOut)} y1={margin.top} x2={sx(isMp.feOut)} y2={height - margin.bottom} stroke="#16a34a" strokeWidth="3" strokeDasharray="8 6" />
                <text x={sx(isMp.feOut) + 5} y={margin.top + 16} fill="#16a34a" fontSize="13">Y*</text>
              </>}

              {/* Equilibrium crosshairs */}
              <line x1={ceX} y1={ceY} x2={ceX} y2={height - margin.bottom} stroke="#111827" strokeDasharray="6 4" strokeWidth="1.5" />
              <line x1={margin.left} y1={ceY} x2={ceX} y2={ceY} stroke="#111827" strokeDasharray="6 4" strokeWidth="1.5" />
              <circle cx={ceX} cy={ceY} r="6" fill="#111827" />
              <text x={ceX + 9} y={ceY - 10} fontSize="13" fill="#111827" fontWeight="700">E</text>
              <text x={ceX - 10} y={height - margin.bottom + 18} fontSize="12" fill="#111827">{curEq.x.toFixed(0)}</text>
              <text x={margin.left - 40} y={ceY + 5} fontSize="12" fill="#111827">{curEq.y.toFixed(1)}</text>
            </svg>
          </div>
        </section>
      </main>
    </div>
  );
}




import React, { useMemo, useState, useCallback } from "react";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function App() {
  // ── current state ─────────────────────────────────────────────────────────
  const [model, setModel] = useState("IS-LM");
  const [policyType, setPolicyType] = useState("Fiscal");

  const [govSpending, setGovSpending] = useState(120);
  const [taxes, setTaxes] = useState(30);
  const [moneySupply, setMoneySupply] = useState(100);
  const [interestRate, setInterestRate] = useState(4);
  const [inflation, setInflation] = useState(4);
  const [shockType, setShockType] = useState("None");
  const [shockStrength, setShockStrength] = useState(0);

  // IS-MP
  const [mpSlope, setMpSlope] = useState(0.05);
  const [naturalRate, setNaturalRate] = useState(2);
  const [outputGap, setOutputGap] = useState(0);

  const [shockQuery, setShockQuery] = useState("");
  const [shockResult, setShockResult] = useState("");

  // ── ghost / previous curve state ──────────────────────────────────────────
  const [ghost, setGhost] = useState(null);

  const captureGhost = (currentModel) => {
    setGhost({
      model: currentModel,
      govSpending, taxes, moneySupply, interestRate, inflation,
      shockType, shockStrength, mpSlope, naturalRate, outputGap,
    });
  };

  const clearShockResult = () => setShockResult("");

  // ── SVG geometry ──────────────────────────────────────────────────────────
  const width = 820;
  const height = 540;
  const margin = { top: 30, right: 30, bottom: 55, left: 70 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const xMin = 0; const xMax = 200;

  const yRanges = { "AD-AS": [0, 200], "IS-LM": [-10, 20], "IS-MP": [-2, 14] };
  const [currentYMin, currentYMax] = yRanges[model] ?? [-10, 20];

  const scaleX = (x) => margin.left + ((x - xMin) / (xMax - xMin)) * innerWidth;
  const scaleY = (y) =>
    height - margin.bottom - ((y - currentYMin) / (currentYMax - currentYMin)) * innerHeight;

  // ── curve builders (pure, take a params object) ───────────────────────────
  function buildAdAs(p) {
    const fiscalADShift = (p.govSpending - 120) * 0.7 - (p.taxes - 30) * 0.6;
    const monetaryADShift = (p.moneySupply - 100) * 0.5 - (p.interestRate - 4) * 4;
    const demandShockShift = p.shockType === "Demand" ? p.shockStrength * 8 : 0;
    const supplyShockShift = p.shockType === "Supply" ? p.shockStrength * 12 : 0;
    const totalADShift = fiscalADShift + monetaryADShift + demandShockShift;
    const totalSRASShift = supplyShockShift + p.inflation * 1.3;
    const AD = (y) => 170 - 0.7 * y + totalADShift;
    const SRAS = (y) => 30 + 0.6 * y + totalSRASShift;
    const eqY = (170 + totalADShift - 30 - totalSRASShift) / (0.7 + 0.6);
    const eqP = AD(eqY);
    return { AD, SRAS, potentialOutput: 110, eq: { x: clamp(eqY, 0, 200), y: clamp(eqP, 0, 200) } };
  }

  function buildIsLm(p) {
    const fiscalISShift = (p.govSpending - 120) * 0.05 - (p.taxes - 30) * 0.04;
    const monetaryLMShift = (p.moneySupply - 100) * 0.05 - (p.interestRate - 4) * 0.6;
    const IS = (y) => 18 - 0.07 * y + fiscalISShift;
    const LM = (y) => -2 + 0.09 * y - monetaryLMShift;
    const eqY = (18 + 2 + fiscalISShift + monetaryLMShift) / (0.07 + 0.09);
    const eqI = IS(eqY);
    return { IS, LM, fullEmploymentOutput: 110, eq: { x: clamp(eqY, 0, 200), y: clamp(eqI, -10, 20) } };
  }

  function buildIsMp(p) {
    const fiscalISShift = (p.govSpending - 120) * 0.05 - (p.taxes - 30) * 0.04;
    const feOutput = 110 + p.outputGap * 2;
    const IS = (y) => 12 - 0.06 * y + fiscalISShift;
    const MP = (y) => p.naturalRate + p.mpSlope * (y - feOutput);
    const denom = 0.06 + p.mpSlope;
    const eqY = (12 + fiscalISShift - p.naturalRate + p.mpSlope * feOutput) / denom;
    const eqR = IS(eqY);
    return { IS, MP, feOutput, naturalRate: p.naturalRate, eq: { x: clamp(eqY, 0, 200), y: clamp(eqR, -2, 14) } };
  }

  // ── current curves ────────────────────────────────────────────────────────
  const currentParams = { govSpending, taxes, moneySupply, interestRate, inflation, shockType, shockStrength, mpSlope, naturalRate, outputGap };

  const adAs = useMemo(() => buildAdAs(currentParams),
    [govSpending, taxes, moneySupply, interestRate, inflation, shockType, shockStrength]);
  const isLm = useMemo(() => buildIsLm(currentParams),
    [govSpending, taxes, moneySupply, interestRate]);
  const isMp = useMemo(() => buildIsMp(currentParams),
    [govSpending, taxes, mpSlope, naturalRate, outputGap]);

  // ── ghost curves ──────────────────────────────────────────────────────────
  const ghostAdAs = useMemo(() => ghost && ghost.model === "AD-AS" ? buildAdAs(ghost) : null, [ghost]);
  const ghostIsLm = useMemo(() => ghost && ghost.model === "IS-LM" ? buildIsLm(ghost) : null, [ghost]);
  const ghostIsMp = useMemo(() => ghost && ghost.model === "IS-MP" ? buildIsMp(ghost) : null, [ghost]);

  // ── path builder ──────────────────────────────────────────────────────────
  const makePath = (fn) => {
    let d = "";
    for (let x = 0; x <= 200; x += 2) {
      const px = scaleX(x);
      const py = scaleY(fn(x));
      d += x === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
    }
    return d;
  };

  // ── preset actions ────────────────────────────────────────────────────────
  const applyPreset = (currentModel, fn) => {
    captureGhost(currentModel);
    clearShockResult();
    fn();
  };

  const SHOCK_PRESETS = {
    "positive demand shock":    () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Demand");  setShockStrength(6);  setInflation(4); setShockResult("Positive demand shock: AD shifts right → higher output & prices."); }),
    "negative demand shock":    () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Demand");  setShockStrength(-6); setInflation(2); setShockResult("Negative demand shock: AD shifts left → lower output & prices."); }),
    "positive supply shock":    () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(-6); setInflation(1); setShockResult("Positive supply shock: SRAS shifts right → higher output, lower prices."); }),
    "negative supply shock":    () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(6);  setInflation(6); setShockResult("Negative supply shock: SRAS shifts left → lower output, higher prices."); }),
    "stagflation":              () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(8);  setInflation(8); setShockResult("Stagflation: severe negative supply shock → output ↓, prices ↑."); }),
    "expansionary fiscal":      () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Fiscal");    setGovSpending(150); setTaxes(20);   setShockResult("Expansionary fiscal: IS shifts right → higher income & interest rate."); }),
    "contractionary fiscal":    () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Fiscal");    setGovSpending(95);  setTaxes(45);   setShockResult("Contractionary fiscal: IS shifts left → lower income & interest rate."); }),
    "expansionary monetary":    () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Monetary");  setMoneySupply(130); setInterestRate(2); setShockResult("Expansionary monetary: LM shifts right → higher income, lower rate."); }),
    "contractionary monetary":  () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Monetary");  setMoneySupply(80);  setInterestRate(7); setShockResult("Contractionary monetary: LM shifts left → lower income, higher rate."); }),
  };

  const applyShockSearch = () => {
    const q = shockQuery.toLowerCase().trim().replace(/\s+/g, " ");
    const preset = SHOCK_PRESETS[q];
    if (preset) preset();
    else alert(`Unknown scenario. Try:\n${Object.keys(SHOCK_PRESETS).join(", ")}`);
  };

  const applyExpansionaryFiscal    = () => applyPreset(model, () => { setPolicyType("Fiscal");   if (model !== "IS-MP") setModel("IS-LM"); setGovSpending(150); setTaxes(20); });
  const applyContractionaryFiscal  = () => applyPreset(model, () => { setPolicyType("Fiscal");   if (model !== "IS-MP") setModel("IS-LM"); setGovSpending(95);  setTaxes(45); });
  const applyExpansionaryMonetary  = () => applyPreset(model, () => { setPolicyType("Monetary"); setModel("IS-LM"); setMoneySupply(130); setInterestRate(2); });
  const applyContractionaryMonetary= () => applyPreset(model, () => { setPolicyType("Monetary"); setModel("IS-LM"); setMoneySupply(80);  setInterestRate(7); });

  const resetAll = () => {
    setModel("IS-LM"); setPolicyType("Fiscal");
    setGovSpending(120); setTaxes(30);
    setMoneySupply(100); setInterestRate(4);
    setInflation(4); setShockType("None"); setShockStrength(0);
    setShockQuery(""); setShockResult("");
    setNaturalRate(2); setMpSlope(0.05); setOutputGap(0);
    setGhost(null);
  };

  // ── equilibrium coords ────────────────────────────────────────────────────
  const currentEq =
    model === "AD-AS" ? adAs.eq
    : model === "IS-MP" ? isMp.eq
    : isLm.eq;

  const currentEqX = scaleX(currentEq.x);
  const currentEqY = scaleY(currentEq.y);

  const ghostEq =
    model === "AD-AS" && ghostAdAs ? ghostAdAs.eq
    : model === "IS-MP" && ghostIsMp ? ghostIsMp.eq
    : model === "IS-LM" && ghostIsLm ? ghostIsLm.eq
    : null;

  const ghostEqX = ghostEq ? scaleX(ghostEq.x) : null;
  const ghostEqY = ghostEq ? scaleY(ghostEq.y) : null;
  const hasGhost = ghostEq !== null;

  // ── interpretation ────────────────────────────────────────────────────────
  const interpretation = useMemo(() => {
    if (shockResult) return shockResult;
    if (model === "AD-AS") {
      let t = "";
      if (shockType === "Supply") t += shockStrength >= 6 ? "Negative supply shock: SRAS shifts left. " : shockStrength > 0 ? "Mild negative supply shock. " : shockStrength <= -6 ? "Positive supply shock: SRAS shifts right. " : shockStrength < 0 ? "Mild positive supply shock. " : "";
      else if (shockType === "Demand") t += shockStrength >= 6 ? "Positive demand shock: AD shifts right. " : shockStrength > 0 ? "Mild positive demand shock. " : shockStrength <= -6 ? "Negative demand shock: AD shifts left. " : shockStrength < 0 ? "Mild negative demand shock. " : "";
      if (govSpending > 120 || taxes < 30 || moneySupply > 100 || interestRate < 4) t += "Demand conditions are expansionary. ";
      else if (govSpending < 120 || taxes > 30 || moneySupply < 100 || interestRate > 4) t += "Demand conditions are contractionary. ";
      if (shockType === "Supply" && shockStrength > 5 && adAs.eq.x < adAs.potentialOutput - 2) t += "Stagflation-like conditions present. ";
      t += adAs.eq.x > adAs.potentialOutput + 2 ? "Output above potential — inflationary gap." : adAs.eq.x < adAs.potentialOutput - 2 ? "Output below potential — recessionary gap." : "Economy near long-run equilibrium.";
      return t;
    }
    if (model === "IS-MP") {
      let t = govSpending > 120 || taxes < 30 ? "Expansionary fiscal: IS shifts right. " : govSpending < 120 || taxes > 30 ? "Contractionary fiscal: IS shifts left. " : "Fiscal policy neutral. ";
      const gap = isMp.eq.x - isMp.feOutput;
      t += gap > 2 ? "Output above CB target — MP rule tightens." : gap < -2 ? "Output below CB target — MP rule eases." : "Economy at CB target output.";
      return t;
    }
    let t = "";
    if (policyType === "Fiscal") t += govSpending > 120 || taxes < 30 ? "Expansionary fiscal: IS shifts right. " : govSpending < 120 || taxes > 30 ? "Contractionary fiscal: IS shifts left. " : "Fiscal policy neutral. ";
    if (policyType === "Monetary") t += moneySupply > 100 || interestRate < 4 ? "Expansionary monetary: LM shifts right. " : moneySupply < 100 || interestRate > 4 ? "Contractionary monetary: LM shifts left. " : "Monetary policy neutral. ";
    t += isLm.eq.x > isLm.fullEmploymentOutput + 2 ? "Output above full-employment level." : isLm.eq.x < isLm.fullEmploymentOutput - 2 ? "Output below full-employment level." : "Output near full-employment level.";
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
        {/* ── SIDEBAR ── */}
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
                  onKeyDown={(e) => e.key === "Enter" && applyShockSearch()}
                  placeholder="e.g. stagflation, expansionary fiscal…"
                />
              </label>
              <div className="button-row">
                <button onClick={applyShockSearch}>Apply</button>
              </div>
            </div>

            {/* Model selector */}
            <label className="field">
              <span>Model</span>
              <select value={model} onChange={(e) => { clearShockResult(); setGhost(null); setModel(e.target.value); if (e.target.value === "IS-MP") setPolicyType("Monetary"); }}>
                <option>IS-LM</option>
                <option>IS-MP</option>
                <option>AD-AS</option>
              </select>
            </label>

            {/* Policy tabs */}
            {model !== "AD-AS" && (
              <div className="policy-switch">
                <button className={policyType === "Fiscal" ? "tab active" : "tab"} onClick={() => { clearShockResult(); setPolicyType("Fiscal"); }}>Fiscal</button>
                <button
                  className={policyType === "Monetary" ? "tab active" : "tab"}
                  onClick={() => { clearShockResult(); setPolicyType("Monetary"); if (model !== "IS-MP") setModel("IS-LM"); }}
                >Monetary</button>
              </div>
            )}

            {/* Fiscal controls — only when Fiscal tab is active */}
            {policyType === "Fiscal" && <div className="panel-section">
              <label className="field">
                <span>Government spending: {govSpending}</span>
                <input type="range" min="80" max="180" value={govSpending}
                  onChange={(e) => { captureGhost(model); clearShockResult(); setGovSpending(Number(e.target.value)); }} />
              </label>
              <label className="field">
                <span>Taxes: {taxes}%</span>
                <input type="range" min="0" max="100" value={taxes}
                  onChange={(e) => { captureGhost(model); clearShockResult(); setTaxes(Number(e.target.value)); }} />
              </label>
              <div className="button-row">
                <button onClick={applyExpansionaryFiscal}>Expansionary</button>
                <button onClick={applyContractionaryFiscal}>Contractionary</button>
              </div>
            </div>}

            {/* Monetary — IS-LM only when Monetary tab active */}
            {model === "IS-LM" && policyType === "Monetary" && (
              <div className="panel-section">
                <label className="field">
                  <span>Money supply: {moneySupply}</span>
                  <input type="range" min="60" max="160" value={moneySupply}
                    onChange={(e) => { captureGhost(model); clearShockResult(); setMoneySupply(Number(e.target.value)); }} />
                </label>
                <label className="field">
                  <span>Interest rate: {interestRate}%</span>
                  <input type="range" min="-10" max="20" value={interestRate}
                    onChange={(e) => { captureGhost(model); clearShockResult(); setInterestRate(Number(e.target.value)); }} />
                </label>
                <div className="button-row">
                  <button onClick={applyExpansionaryMonetary}>Expansionary</button>
                  <button onClick={applyContractionaryMonetary}>Contractionary</button>
                </div>
              </div>
            )}

            {/* IS-MP specific — only when Monetary tab is active */}
            {model === "IS-MP" && policyType === "Monetary" && (
              <div className="panel-section">
                <label className="field">
                  <span>Natural rate r* = {naturalRate.toFixed(1)}%</span>
                  <input type="range" min="0" max="8" step="0.1" value={naturalRate}
                    onChange={(e) => { captureGhost(model); clearShockResult(); setNaturalRate(Number(e.target.value)); }} />
                </label>
                <label className="field">
                  <span>MP rule slope λ = {mpSlope.toFixed(2)}</span>
                  <input type="range" min="0.01" max="0.2" step="0.01" value={mpSlope}
                    onChange={(e) => { captureGhost(model); clearShockResult(); setMpSlope(Number(e.target.value)); }} />
                </label>
                <label className="field">
                  <span>CB output target shift: {outputGap > 0 ? "+" : ""}{outputGap}</span>
                  <input type="range" min="-20" max="20" value={outputGap}
                    onChange={(e) => { captureGhost(model); clearShockResult(); setOutputGap(Number(e.target.value)); }} />
                </label>
                <div className="info-hint">r = r* + λ·(Y − Y*)</div>
              </div>
            )}

            {/* AD-AS specific */}
            {model === "AD-AS" && (
              <div className="panel-section">
                <label className="field">
                  <span>Inflation: {inflation}%</span>
                  <input type="range" min="-10" max="50" value={inflation}
                    onChange={(e) => { captureGhost(model); clearShockResult(); setInflation(Number(e.target.value)); }} />
                </label>
                <label className="field">
                  <span>Money supply: {moneySupply}</span>
                  <input type="range" min="60" max="160" value={moneySupply}
                    onChange={(e) => { captureGhost(model); clearShockResult(); setMoneySupply(Number(e.target.value)); }} />
                </label>
                <label className="field">
                  <span>Interest rate: {interestRate}%</span>
                  <input type="range" min="-10" max="20" value={interestRate}
                    onChange={(e) => { captureGhost(model); clearShockResult(); setInterestRate(Number(e.target.value)); }} />
                </label>
                <label className="field">
                  <span>Shock type</span>
                  <select value={shockType} onChange={(e) => { captureGhost(model); clearShockResult(); setShockType(e.target.value); }}>
                    <option>None</option>
                    <option>Demand</option>
                    <option>Supply</option>
                  </select>
                </label>
                <label className="field">
                  <span>{shockType !== "None" ? `${shockType} shock: ${shockStrength}` : `Shock intensity: ${shockStrength}`}</span>
                  <input type="range" min="-10" max="10" value={shockStrength}
                    onChange={(e) => { captureGhost(model); clearShockResult(); setShockStrength(Number(e.target.value)); }} />
                </label>
              </div>
            )}

            <div className="button-row">
              <button className="reset-btn" onClick={resetAll}>Reset</button>
              {hasGhost && <button className="clear-ghost-btn" onClick={() => setGhost(null)}>Clear E₁</button>}
            </div>

            <div className="info-box">
              <strong>Interpretation</strong>
              <p>{interpretation}</p>
              {model === "AD-AS" && <p><strong>Eq. output:</strong> {adAs.eq.x.toFixed(1)}<br /><strong>Price level:</strong> {adAs.eq.y.toFixed(1)}</p>}
              {model === "IS-LM" && <p><strong>Eq. income:</strong> {isLm.eq.x.toFixed(1)}<br /><strong>Interest rate:</strong> {isLm.eq.y.toFixed(1)}%</p>}
              {model === "IS-MP" && <p><strong>Eq. output:</strong> {isMp.eq.x.toFixed(1)}<br /><strong>Real rate:</strong> {isMp.eq.y.toFixed(2)}%<br /><strong>CB target Y*:</strong> {isMp.feOutput.toFixed(1)}</p>}
            </div>
          </div>
        </aside>

        {/* ── GRAPH ── */}
        <section className="graph-section">
          <div className="card graph-card">
            <h2>{model} Graph</h2>

            <svg viewBox={`0 0 ${width} ${height}`} className="graph-svg">
              <defs>
                <marker id="arrowhead" markerWidth="9" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 9 3.5, 0 7" fill="#111827" />
                </marker>
              </defs>

              {/* Axes */}
              <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="#111827" strokeWidth="2" />
              <line x1={margin.left} y1={height - margin.bottom} x2={margin.left} y2={margin.top} stroke="#111827" strokeWidth="2" />
              <text x={width / 2 - 55} y={height - 12} fontSize="15">{xLabel}</text>
              <text x="14" y="24" fontSize="15">{yLabel}</text>

              {/* ── AD-AS curves ── */}
              {model === "AD-AS" && (
                <>
                  {/* Ghost curves — same color, dashed, behind new curves */}
                  {ghostAdAs && (
                    <>
                      <path d={makePath(ghostAdAs.AD)}   fill="none" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="8 5" opacity="0.45" />
                      <text x={scaleX(155)} y={scaleY(ghostAdAs.AD(155)) + 16}   fill="#2563eb" fontSize="13" opacity="0.6">AD₁</text>
                      <path d={makePath(ghostAdAs.SRAS)} fill="none" stroke="#dc2626" strokeWidth="2.5" strokeDasharray="8 5" opacity="0.45" />
                      <text x={scaleX(140)} y={scaleY(ghostAdAs.SRAS(140)) + 16} fill="#dc2626" fontSize="13" opacity="0.6">SRAS₁</text>
                    </>
                  )}
                  {/* Current curves */}
                  <path d={makePath(adAs.AD)}   fill="none" stroke="#2563eb" strokeWidth="3" />
                  <text x={scaleX(155)} y={scaleY(adAs.AD(155)) - 8}   fill="#2563eb" fontSize="14" fontWeight="700">AD{hasGhost ? "₂" : ""}</text>
                  <path d={makePath(adAs.SRAS)} fill="none" stroke="#dc2626" strokeWidth="3" />
                  <text x={scaleX(140)} y={scaleY(adAs.SRAS(140)) - 8} fill="#dc2626" fontSize="14" fontWeight="700">SRAS{hasGhost ? "₂" : ""}</text>
                  {/* LRAS */}
                  <line x1={scaleX(adAs.potentialOutput)} y1={margin.top} x2={scaleX(adAs.potentialOutput)} y2={height - margin.bottom} stroke="#16a34a" strokeWidth="3" strokeDasharray="8 6" />
                  <text x={scaleX(adAs.potentialOutput) + 6} y={margin.top + 18} fill="#16a34a" fontSize="14">LRAS</text>
                </>
              )}

              {/* ── IS-LM curves ── */}
              {model === "IS-LM" && (
                <>
                  {ghostIsLm && (
                    <>
                      <path d={makePath(ghostIsLm.IS)} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="8 5" opacity="0.45" />
                      <text x={scaleX(155)} y={scaleY(ghostIsLm.IS(155)) + 16} fill="#2563eb" fontSize="13" opacity="0.6">IS₁</text>
                      <path d={makePath(ghostIsLm.LM)} fill="none" stroke="#dc2626" strokeWidth="2.5" strokeDasharray="8 5" opacity="0.45" />
                      <text x={scaleX(140)} y={scaleY(ghostIsLm.LM(140)) + 16} fill="#dc2626" fontSize="13" opacity="0.6">LM₁</text>
                    </>
                  )}
                  <path d={makePath(isLm.IS)} fill="none" stroke="#2563eb" strokeWidth="3" />
                  <text x={scaleX(155)} y={scaleY(isLm.IS(155)) - 8} fill="#2563eb" fontSize="14" fontWeight="700">IS{hasGhost ? "₂" : ""}</text>
                  <path d={makePath(isLm.LM)} fill="none" stroke="#dc2626" strokeWidth="3" />
                  <text x={scaleX(140)} y={scaleY(isLm.LM(140)) - 8} fill="#dc2626" fontSize="14" fontWeight="700">LM{hasGhost ? "₂" : ""}</text>
                  <line x1={scaleX(isLm.fullEmploymentOutput)} y1={margin.top} x2={scaleX(isLm.fullEmploymentOutput)} y2={height - margin.bottom} stroke="#16a34a" strokeWidth="3" strokeDasharray="8 6" />
                  <text x={scaleX(isLm.fullEmploymentOutput) + 6} y={margin.top + 18} fill="#16a34a" fontSize="14">FE</text>
                </>
              )}

              {/* ── IS-MP curves ── */}
              {model === "IS-MP" && (
                <>
                  {ghostIsMp && (
                    <>
                      <path d={makePath(ghostIsMp.IS)} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="8 5" opacity="0.45" />
                      <text x={scaleX(150)} y={scaleY(ghostIsMp.IS(150)) + 16} fill="#2563eb" fontSize="13" opacity="0.6">IS₁</text>
                      <path d={makePath(ghostIsMp.MP)} fill="none" stroke="#dc2626" strokeWidth="2.5" strokeDasharray="8 5" opacity="0.45" />
                      <text x={scaleX(155)} y={scaleY(ghostIsMp.MP(155)) + 16} fill="#dc2626" fontSize="13" opacity="0.6">MP₁</text>
                    </>
                  )}
                  <path d={makePath(isMp.IS)} fill="none" stroke="#2563eb" strokeWidth="3" />
                  <text x={scaleX(150)} y={scaleY(isMp.IS(150)) - 8} fill="#2563eb" fontSize="14" fontWeight="700">IS{hasGhost ? "₂" : ""}</text>
                  <path d={makePath(isMp.MP)} fill="none" stroke="#dc2626" strokeWidth="3" />
                  <text x={scaleX(155)} y={scaleY(isMp.MP(155)) - 8} fill="#dc2626" fontSize="14" fontWeight="700">MP{hasGhost ? "₂" : ""}</text>
                  <line x1={margin.left} y1={scaleY(isMp.naturalRate)} x2={width - margin.right} y2={scaleY(isMp.naturalRate)} stroke="#9333ea" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.6" />
                  <text x={margin.left + 4} y={scaleY(isMp.naturalRate) - 5} fill="#9333ea" fontSize="12">r*</text>
                  <line x1={scaleX(isMp.feOutput)} y1={margin.top} x2={scaleX(isMp.feOutput)} y2={height - margin.bottom} stroke="#16a34a" strokeWidth="3" strokeDasharray="8 6" />
                  <text x={scaleX(isMp.feOutput) + 6} y={margin.top + 18} fill="#16a34a" fontSize="14">Y*</text>
                </>
              )}

              {/* ── E₁ crosshairs + dot (both go all the way to both axes) ── */}
              {hasGhost && (
                <>
                  {/* vertical: E₁ down to x-axis */}
                  <line x1={ghostEqX} y1={ghostEqY} x2={ghostEqX} y2={height - margin.bottom} stroke="#111827" strokeDasharray="6 4" strokeWidth="1.5" />
                  {/* horizontal: E₁ left to y-axis */}
                  <line x1={margin.left} y1={ghostEqY} x2={ghostEqX} y2={ghostEqY} stroke="#111827" strokeDasharray="6 4" strokeWidth="1.5" />
                  {/* dot */}
                  <circle cx={ghostEqX} cy={ghostEqY} r="6" fill="#111827" />
                  {/* label */}
                  <text x={ghostEqX - 20} y={ghostEqY - 10} fontSize="13" fill="#111827" fontWeight="700">E₁</text>
                  {/* axis tick values */}
                  <text x={ghostEqX - 10} y={height - margin.bottom + 20} fontSize="12" fill="#111827">{ghostEq.x.toFixed(0)}</text>
                  <text x={margin.left - 42} y={ghostEqY + 5} fontSize="12" fill="#111827">{ghostEq.y.toFixed(1)}</text>
                </>
              )}

              {/* ── Arrow E₁ → E₂ ── */}
              {hasGhost && (() => {
                const dx = currentEqX - ghostEqX;
                const dy = currentEqY - ghostEqY;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const ux = dx / len; const uy = dy / len;
                const gap = 10;
                return (
                  <line
                    x1={ghostEqX + ux * gap} y1={ghostEqY + uy * gap}
                    x2={currentEqX - ux * gap} y2={currentEqY - uy * gap}
                    stroke="#111827" strokeWidth="2" strokeDasharray="5 3"
                    markerEnd="url(#arrowhead)"
                  />
                );
              })()}

              {/* ── E₂ (or E) crosshairs + dot ── */}
              {/* vertical: down to x-axis */}
              <line x1={currentEqX} y1={currentEqY} x2={currentEqX} y2={height - margin.bottom} stroke="#111827" strokeDasharray="6 4" strokeWidth="1.5" />
              {/* horizontal: left to y-axis */}
              <line x1={margin.left} y1={currentEqY} x2={currentEqX} y2={currentEqY} stroke="#111827" strokeDasharray="6 4" strokeWidth="1.5" />
              {/* dot */}
              <circle cx={currentEqX} cy={currentEqY} r="6" fill="#111827" />
              {/* label */}
              <text x={currentEqX + 9} y={currentEqY - 10} fontSize="14" fill="#111827" fontWeight="700">{hasGhost ? "E₂" : "E"}</text>
              {/* axis tick values */}
              <text x={currentEqX - 10} y={height - margin.bottom + 20} fontSize="13" fill="#111827">{currentEq.x.toFixed(0)}</text>
              <text x={margin.left - 42} y={currentEqY + 5} fontSize="13" fill="#111827">{currentEq.y.toFixed(1)}</text>
            </svg>
          </div>
        </section>
      </main>
    </div>
  );
}



import React, { useMemo, useState, useRef } from "react";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function App() {
  const [model, setModel] = useState("IS-LM");
  const [policyType, setPolicyType] = useState("Fiscal");
  const [govSpending, setGovSpending] = useState(2000);
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
  const [ghost, setGhost] = useState(null);
  const dragging = useRef(false);

  const snap = (m) => ({
    model: m, govSpending, taxes, moneySupply, interestRate,
    inflation, shockType, shockStrength, mpSlope, naturalRate, outputGap,
  });

  const onDown = (m) => {
    if (!dragging.current) { dragging.current = true; setGhost(snap(m)); }
  };
  const onUp = () => { dragging.current = false; };
  const clear = () => setShockResult("");

  // ── SVG geometry ──────────────────────────────────────────────────────────
  const W = 820, H = 520;
  const mg = { top: 30, right: 30, bottom: 70, left: 68 };
  const iW = W - mg.left - mg.right;
  const iH = H - mg.top - mg.bottom;
  const yRanges = { "AD-AS": [0, 200], "IS-LM": [-10, 20], "IS-MP": [-2, 14] };
  const [yMin, yMax] = yRanges[model] ?? [-10, 20];
  const sx = (x) => mg.left + (x / 200) * iW;
  const sy = (y) => H - mg.bottom - ((y - yMin) / (yMax - yMin)) * iH;

  // ── Model builders ────────────────────────────────────────────────────────
  function buildAdAs(p) {
    const adShift = (p.govSpending - 2000) * 0.0156 - (p.taxes - 30) * 0.6
      + (p.moneySupply - 100) * 0.5 - (p.interestRate - 4) * 4
      + (p.shockType === "Demand" ? p.shockStrength * 8 : 0);
    const srasShift = (p.shockType === "Supply" ? p.shockStrength * 12 : 0) + p.inflation * 1.3;
    const AD   = (y) => 170 - 0.7 * y + adShift;
    const SRAS = (y) => 30  + 0.6 * y + srasShift;
    const eqY  = (170 + adShift - 30 - srasShift) / 1.3;
    return { AD, SRAS, po: 110, eq: { x: clamp(eqY, 0, 200), y: clamp(AD(eqY), 0, 200) } };
  }

  function buildIsLm(p) {
    const isShift = (p.govSpending - 2000) * 0.00111 - (p.taxes - 30) * 0.04;
    const lmShift = (p.moneySupply - 100) * 0.05 - (p.interestRate - 4) * 0.6;
    const IS  = (y) => 18 - 0.07 * y + isShift;
    const LM  = (y) => -2 + 0.09 * y - lmShift;
    const eqY = (20 + isShift + lmShift) / 0.16;
    return { IS, LM, fe: 110, eq: { x: clamp(eqY, 0, 200), y: clamp(IS(eqY), -10, 20) } };
  }

  function buildIsMp(p) {
    const isShift = (p.govSpending - 2000) * 0.00111 - (p.taxes - 30) * 0.04;
    const feOut   = 110 + p.outputGap * 2;
    const IS  = (y) => 12 - 0.06 * y + isShift;
    const MP  = (y) => p.naturalRate + p.mpSlope * (y - feOut);
    const eqY = (12 + isShift - p.naturalRate + p.mpSlope * feOut) / (0.06 + p.mpSlope);
    return { IS, MP, feOut, nr: p.naturalRate, eq: { x: clamp(eqY, 0, 200), y: clamp(IS(eqY), -2, 14) } };
  }

  const cp    = { govSpending, taxes, moneySupply, interestRate, inflation, shockType, shockStrength, mpSlope, naturalRate, outputGap };
  const adAs  = useMemo(() => buildAdAs(cp), [govSpending, taxes, moneySupply, interestRate, inflation, shockType, shockStrength]);
  const isLm  = useMemo(() => buildIsLm(cp), [govSpending, taxes, moneySupply, interestRate]);
  const isMp  = useMemo(() => buildIsMp(cp), [govSpending, taxes, mpSlope, naturalRate, outputGap]);

  // Ghost equilibrium only — no ghost curves drawn
  const ghostEqOnly = useMemo(() => {
    if (!ghost) return null;
    if (ghost.model === "AD-AS") return buildAdAs(ghost).eq;
    if (ghost.model === "IS-LM") return buildIsLm(ghost).eq;
    if (ghost.model === "IS-MP") return buildIsMp(ghost).eq;
    return null;
  }, [ghost]);

  const makePath = (fn) => {
    let d = "";
    for (let x = 0; x <= 200; x += 2) {
      const px = sx(x), py = sy(fn(x));
      d += x === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
    }
    return d;
  };

  // ── Presets ───────────────────────────────────────────────────────────────
  const applyPreset = (m, fn) => {
    dragging.current = false;
    setGhost(snap(m));
    clear();
    fn();
  };

  const PRESETS = {
    "positive demand shock":   () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Demand");  setShockStrength(6);  setInflation(4); setShockResult("Positive demand shock: AD shifts right → higher output & prices."); }),
    "negative demand shock":   () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Demand");  setShockStrength(-6); setInflation(2); setShockResult("Negative demand shock: AD shifts left → lower output & prices."); }),
    "positive supply shock":   () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(-6); setInflation(1); setShockResult("Positive supply shock: SRAS shifts right → higher output, lower prices."); }),
    "negative supply shock":   () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(6);  setInflation(6); setShockResult("Negative supply shock: SRAS shifts left → lower output, higher prices."); }),
    "stagflation":             () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(8);  setInflation(8); setShockResult("Stagflation: severe negative supply shock → output ↓, prices ↑."); }),
    "expansionary fiscal":     () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Fiscal");   setGovSpending(3500); setTaxes(20);   setShockResult("Expansionary fiscal: IS shifts right → higher income & interest rate."); }),
    "contractionary fiscal":   () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Fiscal");   setGovSpending(1000);  setTaxes(45);   setShockResult("Contractionary fiscal: IS shifts left → lower income & interest rate."); }),
    "expansionary monetary":   () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Monetary"); setMoneySupply(130); setInterestRate(2); setShockResult("Expansionary monetary: LM shifts right → higher income, lower rate."); }),
    "contractionary monetary": () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Monetary"); setMoneySupply(80);  setInterestRate(7); setShockResult("Contractionary monetary: LM shifts left → lower income, higher rate."); }),
  };

  const applySearch = () => {
    const q = shockQuery.toLowerCase().trim().replace(/\s+/g, " ");
    const p = PRESETS[q];
    if (p) p(); else alert("Try: " + Object.keys(PRESETS).join(", "));
  };

  const applyExpFiscal   = () => applyPreset(model, () => { setPolicyType("Fiscal");   if (model !== "IS-MP") setModel("IS-LM"); setGovSpending(3500); setTaxes(20); });
  const applyConFiscal   = () => applyPreset(model, () => { setPolicyType("Fiscal");   if (model !== "IS-MP") setModel("IS-LM"); setGovSpending(1000);  setTaxes(45); });
  const applyExpMon      = () => applyPreset(model, () => { setPolicyType("Monetary"); setModel("IS-LM"); setMoneySupply(130); setInterestRate(2); });
  const applyConMon      = () => applyPreset(model, () => { setPolicyType("Monetary"); setModel("IS-LM"); setMoneySupply(80);  setInterestRate(7); });

  const resetAll = () => {
    setModel("IS-LM"); setPolicyType("Fiscal");
    setGovSpending(2000); setTaxes(30); setMoneySupply(100); setInterestRate(4);
    setInflation(4); setShockType("None"); setShockStrength(0);
    setShockQuery(""); setShockResult("");
    setNaturalRate(2); setMpSlope(0.05); setOutputGap(0);
    setGhost(null); dragging.current = false;
  };

  // ── Equilibria ────────────────────────────────────────────────────────────
  const curEq = model === "AD-AS" ? adAs.eq : model === "IS-MP" ? isMp.eq : isLm.eq;
  const cx = sx(curEq.x), cy = sy(curEq.y);

  const ghostEq = ghostEqOnly && model === (ghost ? ghost.model : null) ? ghostEqOnly : null;
  const gx = ghostEq ? sx(ghostEq.x) : null;
  const gy = ghostEq ? sy(ghostEq.y) : null;
  const hasGhost = ghostEq !== null
    && (Math.abs(curEq.x - ghostEq.x) > 0.5 || Math.abs(curEq.y - ghostEq.y) > 0.05);

  // ── Interpretation ────────────────────────────────────────────────────────
  const interpretation = useMemo(() => {
    if (shockResult) return shockResult;
    if (model === "AD-AS") {
      let t = "";
      if (shockType === "Supply") t += shockStrength >= 6 ? "Negative supply shock: SRAS shifts left. " : shockStrength > 0 ? "Mild negative supply shock. " : shockStrength <= -6 ? "Positive supply shock: SRAS shifts right. " : shockStrength < 0 ? "Mild positive supply shock. " : "";
      else if (shockType === "Demand") t += shockStrength >= 6 ? "Positive demand shock: AD shifts right. " : shockStrength > 0 ? "Mild positive demand shock. " : shockStrength <= -6 ? "Negative demand shock: AD shifts left. " : shockStrength < 0 ? "Mild negative demand shock. " : "";
      t += adAs.eq.x > adAs.po + 2 ? "Output above potential — inflationary gap." : adAs.eq.x < adAs.po - 2 ? "Output below potential — recessionary gap." : "Economy near long-run equilibrium.";
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

  const xBot    = H - mg.bottom;
  const xArrowY = xBot + 22;
  const yArrowX = mg.left - 22;

  return (
    <div className="page">
      <header className="topbar"><h1>EconomicPolicy</h1></header>

      <main className="layout">
        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          <div className="card">
            <h2>Policy Controls</h2>

            <div className="panel-section">
              <label className="field">
                <span>Shock / Scenario Search</span>
                <input type="text" value={shockQuery}
                  onChange={(e) => setShockQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applySearch()}
                  placeholder="e.g. stagflation, expansionary fiscal…" />
              </label>
              <div className="button-row">
                <button onClick={applySearch}>Apply</button>
              </div>
            </div>

            <label className="field">
              <span>Model</span>
              <select value={model} onChange={(e) => {
                clear(); setGhost(null); dragging.current = false;
                setModel(e.target.value);
                if (e.target.value === "IS-MP") setPolicyType("Monetary");
              }}>
                <option>IS-LM</option>
                <option>IS-MP</option>
                <option>AD-AS</option>
              </select>
            </label>

            {/* Policy tabs — all models */}
            <div className="policy-switch">
              <button className={policyType === "Fiscal" ? "tab active" : "tab"} onClick={() => { clear(); setPolicyType("Fiscal"); }}>Fiscal</button>
              <button className={policyType === "Monetary" ? "tab active" : "tab"} onClick={() => { clear(); setPolicyType("Monetary"); if (model === "IS-LM" || model === "AD-AS") {} if (model !== "IS-MP" && model !== "AD-AS") setModel("IS-LM"); }}>Monetary</button>
            </div>

            {policyType === "Fiscal" && (
              <div className="panel-section">
                <label className="field">
                  <span>General Government Spending (billion): {govSpending.toLocaleString()}</span>
                  <input type="range" min="100" max="5000" step="50" value={govSpending}
                    onPointerDown={() => onDown(model)} onPointerUp={onUp}
                    onChange={(e) => { clear(); setGovSpending(+e.target.value); }} />
                </label>
                <label className="field">
                  <span>Taxes: {taxes}%</span>
                  <input type="range" min="0" max="100" value={taxes}
                    onPointerDown={() => onDown(model)} onPointerUp={onUp}
                    onChange={(e) => { clear(); setTaxes(+e.target.value); }} />
                </label>
                <div className="button-row">
                  <button onClick={applyExpFiscal}>Expansionary</button>
                  <button onClick={applyConFiscal}>Contractionary</button>
                </div>
              </div>
            )}

            {/* Monetary — IS-LM */}
            {model === "IS-LM" && policyType === "Monetary" && (
              <div className="panel-section">
                <label className="field">
                  <span>Money supply: {moneySupply}</span>
                  <input type="range" min="60" max="160" value={moneySupply}
                    onPointerDown={() => onDown(model)} onPointerUp={onUp}
                    onChange={(e) => { clear(); setMoneySupply(+e.target.value); }} />
                </label>
                <label className="field">
                  <span>Interest rate: {interestRate}%</span>
                  <input type="range" min="-10" max="20" value={interestRate}
                    onPointerDown={() => onDown(model)} onPointerUp={onUp}
                    onChange={(e) => { clear(); setInterestRate(+e.target.value); }} />
                </label>
                <div className="button-row">
                  <button onClick={applyExpMon}>Expansionary</button>
                  <button onClick={applyConMon}>Contractionary</button>
                </div>
              </div>
            )}

            {/* Monetary — IS-MP */}
            {model === "IS-MP" && policyType === "Monetary" && (
              <div className="panel-section">
                <label className="field">
                  <span>Natural rate r* = {naturalRate.toFixed(1)}%</span>
                  <input type="range" min="0" max="8" step="0.1" value={naturalRate}
                    onPointerDown={() => onDown(model)} onPointerUp={onUp}
                    onChange={(e) => { clear(); setNaturalRate(+e.target.value); }} />
                </label>
                <label className="field">
                  <span>MP slope λ = {mpSlope.toFixed(2)}</span>
                  <input type="range" min="0.01" max="0.2" step="0.01" value={mpSlope}
                    onPointerDown={() => onDown(model)} onPointerUp={onUp}
                    onChange={(e) => { clear(); setMpSlope(+e.target.value); }} />
                </label>
                <label className="field">
                  <span>CB target shift: {outputGap > 0 ? "+" : ""}{outputGap}</span>
                  <input type="range" min="-20" max="20" value={outputGap}
                    onPointerDown={() => onDown(model)} onPointerUp={onUp}
                    onChange={(e) => { clear(); setOutputGap(+e.target.value); }} />
                </label>
                <div className="info-hint">r = r* + λ·(Y − Y*)</div>
              </div>
            )}

            {/* Monetary — AD-AS */}
            {model === "AD-AS" && policyType === "Monetary" && (
              <div className="panel-section">
                <label className="field">
                  <span>Money supply: {moneySupply}</span>
                  <input type="range" min="60" max="160" value={moneySupply}
                    onPointerDown={() => onDown(model)} onPointerUp={onUp}
                    onChange={(e) => { clear(); setMoneySupply(+e.target.value); }} />
                </label>
                <label className="field">
                  <span>Interest rate: {interestRate}%</span>
                  <input type="range" min="-10" max="20" value={interestRate}
                    onPointerDown={() => onDown(model)} onPointerUp={onUp}
                    onChange={(e) => { clear(); setInterestRate(+e.target.value); }} />
                </label>
                <div className="button-row">
                  <button onClick={() => applyPreset(model, () => { setMoneySupply(130); setInterestRate(2); setShockResult("Expansionary monetary: AD shifts right → higher output & prices."); })}>Expansionary</button>
                  <button onClick={() => applyPreset(model, () => { setMoneySupply(80);  setInterestRate(7); setShockResult("Contractionary monetary: AD shifts left → lower output & prices."); })}>Contractionary</button>
                </div>
              </div>
            )}

            {/* AD-AS shock controls — always shown in AD-AS */}
            {model === "AD-AS" && (
              <div className="panel-section">
                <label className="field">
                  <span>Inflation: {inflation}%</span>
                  <input type="range" min="-10" max="50" value={inflation}
                    onPointerDown={() => onDown(model)} onPointerUp={onUp}
                    onChange={(e) => { clear(); setInflation(+e.target.value); }} />
                </label>
                <label className="field">
                  <span>Shock type</span>
                  <select value={shockType} onChange={(e) => { onDown(model); clear(); setShockType(e.target.value); }}>
                    <option>None</option><option>Demand</option><option>Supply</option>
                  </select>
                </label>
                <label className="field">
                  <span>{shockType !== "None" ? `${shockType} shock: ${shockStrength}` : `Shock intensity: ${shockStrength}`}</span>
                  <input type="range" min="-10" max="10" value={shockStrength}
                    onPointerDown={() => onDown(model)} onPointerUp={onUp}
                    onChange={(e) => { clear(); setShockStrength(+e.target.value); }} />
                </label>
              </div>
            )}

            <div className="button-row">
              <button className="reset-btn" onClick={resetAll}>Reset</button>
              {hasGhost && <button className="clear-btn" onClick={() => { setGhost(null); dragging.current = false; }}>Clear</button>}
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

        {/* ── GRAPH ── */}
        <section className="graph-section">
          <div className="card graph-card">
            <h2>{model} Graph</h2>
            <svg viewBox={`0 0 ${W} ${H}`} className="graph-svg">
              <defs>
                <marker id="arrBlue" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0,8 3,0 6" fill="#60a5fa" />
                </marker>
              </defs>

              {/* Grid */}
              {[25,50,75,100,125,150,175].map(x => (
                <line key={"gx"+x} x1={sx(x)} y1={mg.top} x2={sx(x)} y2={H-mg.bottom} stroke="#27272a" strokeWidth="1" />
              ))}
              {[0.25,0.5,0.75].map(t => {
                const yv = yMin + (yMax - yMin) * t;
                return <line key={"gy"+t} x1={mg.left} y1={sy(yv)} x2={W-mg.right} y2={sy(yv)} stroke="#27272a" strokeWidth="1" />;
              })}

              {/* Axes */}
              <line x1={mg.left} y1={H-mg.bottom} x2={W-mg.right} y2={H-mg.bottom} stroke="#52525b" strokeWidth="2" />
              <line x1={mg.left} y1={H-mg.bottom} x2={mg.left}     y2={mg.top}      stroke="#52525b" strokeWidth="2" />
              <text x={W/2-55} y={H-8}  fontSize="13" fill="#a1a1aa">{xLabel}</text>
              <text x="10"      y="22"   fontSize="13" fill="#a1a1aa">{yLabel}</text>

              {/* ── Curves (no ghost curves drawn at all) ── */}
              {model === "AD-AS" && <>
                <path d={makePath(adAs.AD)}   fill="none" stroke="#818cf8" strokeWidth="2.5" />
                <text x={sx(155)} y={sy(adAs.AD(155))-8}   fill="#818cf8" fontSize="13" fontWeight="700">AD</text>
                <path d={makePath(adAs.SRAS)} fill="none" stroke="#f87171" strokeWidth="2.5" />
                <text x={sx(138)} y={sy(adAs.SRAS(138))-8} fill="#f87171" fontSize="13" fontWeight="700">SRAS</text>
                <line x1={sx(adAs.po)} y1={mg.top} x2={sx(adAs.po)} y2={H-mg.bottom} stroke="#34d399" strokeWidth="2" strokeDasharray="8 6" />
                <text x={sx(adAs.po)+5} y={mg.top+16} fill="#34d399" fontSize="12">LRAS</text>
              </>}
              {model === "IS-LM" && <>
                <path d={makePath(isLm.IS)} fill="none" stroke="#818cf8" strokeWidth="2.5" />
                <text x={sx(155)} y={sy(isLm.IS(155))-8} fill="#818cf8" fontSize="13" fontWeight="700">IS</text>
                <path d={makePath(isLm.LM)} fill="none" stroke="#f87171" strokeWidth="2.5" />
                <text x={sx(140)} y={sy(isLm.LM(140))-8} fill="#f87171" fontSize="13" fontWeight="700">LM</text>
                <line x1={sx(isLm.fe)} y1={mg.top} x2={sx(isLm.fe)} y2={H-mg.bottom} stroke="#34d399" strokeWidth="2" strokeDasharray="8 6" />
                <text x={sx(isLm.fe)+5} y={mg.top+16} fill="#34d399" fontSize="12">FE</text>
              </>}
              {model === "IS-MP" && <>
                <path d={makePath(isMp.IS)} fill="none" stroke="#818cf8" strokeWidth="2.5" />
                <text x={sx(150)} y={sy(isMp.IS(150))-8} fill="#818cf8" fontSize="13" fontWeight="700">IS</text>
                <path d={makePath(isMp.MP)} fill="none" stroke="#f87171" strokeWidth="2.5" />
                <text x={sx(155)} y={sy(isMp.MP(155))-8} fill="#f87171" fontSize="13" fontWeight="700">MP</text>
                <line x1={mg.left} y1={sy(isMp.nr)} x2={W-mg.right} y2={sy(isMp.nr)} stroke="#c084fc" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.7" />
                <text x={mg.left+4} y={sy(isMp.nr)-5} fill="#c084fc" fontSize="11">r*</text>
                <line x1={sx(isMp.feOut)} y1={mg.top} x2={sx(isMp.feOut)} y2={H-mg.bottom} stroke="#34d399" strokeWidth="2" strokeDasharray="8 6" />
                <text x={sx(isMp.feOut)+5} y={mg.top+16} fill="#34d399" fontSize="12">Y*</text>
              </>}

              {/* ── Change-path arrows only (no ghost curves) ── */}
              {hasGhost && (() => {
                const xDir = curEq.x > ghostEq.x ? 1 : -1;
                const yDir = curEq.y > ghostEq.y ? 1 : -1;
                return (
                  <>
                    {/* Drop lines from E₁ */}
                    <line x1={gx} y1={gy} x2={gx} y2={xBot} stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
                    <line x1={mg.left} y1={gy} x2={gx} y2={gy} stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
                    {/* Drop lines from E₂ */}
                    <line x1={cx} y1={cy} x2={cx} y2={xBot} stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
                    <line x1={mg.left} y1={cy} x2={cx} y2={cy} stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />

                    {/* Horizontal arrow on x-axis */}
                    <line
                      x1={gx + (xDir > 0 ? 5 : -5)} y1={xArrowY}
                      x2={cx - (xDir > 0 ? 9 : -9)} y2={xArrowY}
                      stroke="#60a5fa" strokeWidth="2" markerEnd="url(#arrBlue)" />
                    <text x={gx} y={xArrowY+15} fontSize="11" fill="#60a5fa" textAnchor="middle">{ghostEq.x.toFixed(0)}</text>
                    <text x={cx} y={xArrowY+15} fontSize="11" fill="#f1f5f9" textAnchor="middle">{curEq.x.toFixed(0)}</text>

                    {/* Vertical arrow on y-axis */}
                    <line
                      x1={yArrowX} y1={gy + (yDir > 0 ? 5 : -5)}
                      x2={yArrowX} y2={cy - (yDir > 0 ? 9 : -9)}
                      stroke="#60a5fa" strokeWidth="2" markerEnd="url(#arrBlue)" />
                    <text x={yArrowX-4} y={gy+4} fontSize="11" fill="#60a5fa" textAnchor="end">{ghostEq.y.toFixed(1)}</text>
                    <text x={yArrowX-4} y={cy+4} fontSize="11" fill="#f1f5f9" textAnchor="end">{curEq.y.toFixed(1)}</text>

                    {/* E₁ open circle */}
                    <circle cx={gx} cy={gy} r="6" fill="none" stroke="#60a5fa" strokeWidth="2" />
                    <text x={gx-14} y={gy-10} fontSize="12" fill="#60a5fa" fontWeight="700">E₁</text>
                  </>
                );
              })()}

              {/* ── Current equilibrium ── */}
              <circle cx={cx} cy={cy} r="7" fill="#f1f5f9" />
              <text x={cx+10} y={cy-10} fontSize="13" fill="#f1f5f9" fontWeight="700">{hasGhost ? "E₂" : "E"}</text>
              {!hasGhost && <>
                <text x={cx}        y={xBot+18} fontSize="12" fill="#a1a1aa" textAnchor="middle">{curEq.x.toFixed(0)}</text>
                <text x={mg.left-8} y={cy+4}    fontSize="12" fill="#a1a1aa" textAnchor="end">{curEq.y.toFixed(1)}</text>
              </>}
            </svg>
          </div>
        </section>
      </main>
    </div>
  );
}








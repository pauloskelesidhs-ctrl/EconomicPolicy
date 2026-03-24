import React, { useMemo, useState, useRef } from "react";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function SliderField({ label, value, min, max, step = 1, dec = 0, onChange, onDown, onUp }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="slider-row">
        <input type="range" min={min} max={max} step={step} value={value}
          onPointerDown={onDown} onPointerUp={onUp}
          onChange={(e) => onChange(+e.target.value)} />
        <input type="number" min={min} max={max} step={step}
          value={dec > 0 ? parseFloat(value).toFixed(dec) : Math.round(value)}
          onPointerDown={onDown}
          onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(clamp(v, min, max)); }} />
      </div>
    </label>
  );
}

export default function App() {
  const [model, setModel] = useState("IS-LM");
  const [policyType, setPolicyType] = useState("Fiscal");
  const [govSpending, setGovSpending] = useState(2000);
  const [taxes, setTaxes] = useState(30);
  const [moneySupply, setMoneySupply] = useState(10000);
  const [interestRate, setInterestRate] = useState(4);
  const [inflation, setInflation] = useState(4);
  const [shockType, setShockType] = useState("None");
  const [shockStrength, setShockStrength] = useState(0);
  const [mpSlope, setMpSlope] = useState(0.05);
  const [naturalRate, setNaturalRate] = useState(2);
  const [outputGap, setOutputGap] = useState(0);
  const [savingsRate, setSavingsRate] = useState(0.30);
  const [depreciation, setDepreciation] = useState(0.05);
  const [popGrowth, setPopGrowth] = useState(0.01);
  const [techGrowth, setTechGrowth] = useState(0.02);
  const [capitalShock, setCapitalShock] = useState(0);
  const [shockQuery, setShockQuery] = useState("");
  const [shockResult, setShockResult] = useState("");
  const [ghost, setGhost] = useState(null);
  const dragging = useRef(false);

  const snap = (m) => ({ model: m, govSpending, taxes, moneySupply, interestRate, inflation, shockType, shockStrength, mpSlope, naturalRate, outputGap, savingsRate, depreciation, popGrowth, techGrowth, capitalShock });
  const onDown = (m) => { if (!dragging.current) { dragging.current = true; setGhost(snap(m)); } };
  const onUp = () => { dragging.current = false; };
  const clear = () => setShockResult("");

  const W = 820, H = 520;
  const mg = { top: 30, right: 30, bottom: 70, left: 68 };
  const iW = W - mg.left - mg.right;
  const iH = H - mg.top - mg.bottom;
  const ALPHA = 0.35;

  function buildAdAs(p) {
    const adShift = (p.govSpending - 2000) * 0.0025 - (p.taxes - 30) * 0.6
      + (p.moneySupply - 10000) * 0.0025 - (p.interestRate - 4) * 4
      + (p.shockType === "Demand" ? p.shockStrength * 8 : 0);
    const srasShift = (p.shockType === "Supply" ? p.shockStrength * 12 : 0) + p.inflation * 1.3;
    const AD = (y) => 170 - 0.7 * y + adShift;
    const SRAS = (y) => 30 + 0.6 * y + srasShift;
    const eqY = (170 + adShift - 30 - srasShift) / 1.3;
    return { AD, SRAS, po: 110, eq: { x: clamp(eqY, 0, 200), y: clamp(AD(eqY), 0, 200) } };
  }

  function buildIsLm(p) {
    const isShift = (p.govSpending - 2000) * 0.00111 - (p.taxes - 30) * 0.04;
    const lmShift = (p.moneySupply - 10000) * 0.0003 - (p.interestRate - 4) * 0.6;
    const IS = (y) => 18 - 0.07 * y + isShift;
    const LM = (y) => -2 + 0.09 * y - lmShift;
    const eqY = (20 + isShift + lmShift) / 0.16;
    return { IS, LM, fe: 110, eq: { x: clamp(eqY, 0, 200), y: clamp(IS(eqY), -10, 20) } };
  }

  function buildIsMp(p) {
    const isShift = (p.govSpending - 2000) * 0.00111 - (p.taxes - 30) * 0.04;
    const feOut = 110 + p.outputGap * 2;
    const IS = (y) => 12 - 0.06 * y + isShift;
    const MP = (y) => p.naturalRate + p.mpSlope * (y - feOut);
    const eqY = (12 + isShift - p.naturalRate + p.mpSlope * feOut) / (0.06 + p.mpSlope);
    return { IS, MP, feOut, nr: p.naturalRate, eq: { x: clamp(eqY, 0, 200), y: clamp(IS(eqY), -2, 14) } };
  }

  function buildSolow(p) {
    const { savingsRate: s, depreciation: d, popGrowth: n, techGrowth: g, capitalShock: shock } = p;
    const breakEvenRate = Math.max(d + n + g, 0.001);
    const kStar = Math.pow(s / breakEvenRate, 1 / (1 - ALPHA));
    const yStar = Math.pow(Math.max(kStar, 0.01), ALPHA);
    const iStar = s * yStar;
    const kCurrent = clamp(kStar + shock, 0.5, kStar * 4);
    const prodFn = (k) => Math.pow(Math.max(k, 0.01), ALPHA);
    const investFn = (k) => s * Math.pow(Math.max(k, 0.01), ALPHA);
    const breakEven = (k) => breakEvenRate * k;
    return { prodFn, investFn, breakEven, kStar: clamp(kStar, 0.5, 9999), yStar: clamp(yStar, 0, 9999), iStar: clamp(iStar, 0, 9999), kCurrent, breakEvenRate };
  }

  const cp = { govSpending, taxes, moneySupply, interestRate, inflation, shockType, shockStrength, mpSlope, naturalRate, outputGap, savingsRate, depreciation, popGrowth, techGrowth, capitalShock };
  const adAs  = useMemo(() => buildAdAs(cp),  [govSpending, taxes, moneySupply, interestRate, inflation, shockType, shockStrength]);
  const isLm  = useMemo(() => buildIsLm(cp),  [govSpending, taxes, moneySupply, interestRate]);
  const isMp  = useMemo(() => buildIsMp(cp),  [govSpending, taxes, mpSlope, naturalRate, outputGap]);
  const solow = useMemo(() => buildSolow(cp), [savingsRate, depreciation, popGrowth, techGrowth, capitalShock]);

  const ghostAdAs  = useMemo(() => ghost && ghost.model === "AD-AS" ? buildAdAs(ghost)  : null, [ghost]);
  const ghostIsLm  = useMemo(() => ghost && ghost.model === "IS-LM" ? buildIsLm(ghost)  : null, [ghost]);
  const ghostIsMp  = useMemo(() => ghost && ghost.model === "IS-MP" ? buildIsMp(ghost)  : null, [ghost]);
  const ghostSolow = useMemo(() => ghost && ghost.model === "Solow"  ? buildSolow(ghost) : null, [ghost]);

  const ghostEqOnly = useMemo(() => {
    if (!ghost) return null;
    if (ghost.model === "AD-AS") return buildAdAs(ghost).eq;
    if (ghost.model === "IS-LM") return buildIsLm(ghost).eq;
    if (ghost.model === "IS-MP") return buildIsMp(ghost).eq;
    if (ghost.model === "Solow") { const g = buildSolow(ghost); return { x: g.kStar, y: g.iStar }; }
    return null;
  }, [ghost]);

  // Dynamic Solow axes
  const SOLOW_KMAX = Math.max(solow.kStar * 2.5, 10);
  const SOLOW_YMAX = Math.max(solow.prodFn(SOLOW_KMAX) * 1.15, 5);
  const yRanges = { "AD-AS": [0, 200], "IS-LM": [-10, 20], "IS-MP": [-2, 14] };
  const [yMin, yMax] = model === "Solow" ? [0, SOLOW_YMAX] : (yRanges[model] ?? [-10, 20]);
  const xMax = model === "Solow" ? SOLOW_KMAX : 200;
  const sx = (x) => mg.left + (x / xMax) * iW;
  const sy = (y) => H - mg.bottom - ((y - yMin) / (yMax - yMin)) * iH;

  const makePath = (fn, kmax = 200, steps = 100) => {
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const x = (kmax / steps) * i;
      d += i === 0 ? `M ${sx(x)} ${sy(fn(x))}` : ` L ${sx(x)} ${sy(fn(x))}`;
    }
    return d;
  };

  const applyPreset = (m, fn) => { dragging.current = false; setGhost(snap(m)); clear(); fn(); };

  const PRESETS = {
    "positive demand shock":   () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Demand");  setShockStrength(6);  setInflation(4); setShockResult("Positive demand shock: AD shifts right → higher output & prices."); }),
    "negative demand shock":   () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Demand");  setShockStrength(-6); setInflation(2); setShockResult("Negative demand shock: AD shifts left → lower output & prices."); }),
    "positive supply shock":   () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(-6); setInflation(1); setShockResult("Positive supply shock: SRAS shifts right → higher output, lower prices."); }),
    "negative supply shock":   () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(6);  setInflation(6); setShockResult("Negative supply shock: SRAS shifts left → lower output, higher prices."); }),
    "stagflation":             () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(8);  setInflation(8); setShockResult("Stagflation: severe negative supply shock → output ↓, prices ↑."); }),
    "expansionary fiscal":     () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Fiscal");   setGovSpending(3500); setTaxes(20);   setShockResult("Expansionary fiscal: IS shifts right → higher income & interest rate."); }),
    "contractionary fiscal":   () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Fiscal");   setGovSpending(1000); setTaxes(45);   setShockResult("Contractionary fiscal: IS shifts left → lower income & interest rate."); }),
    "expansionary monetary":   () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Monetary"); setMoneySupply(15000); setInterestRate(2); setShockResult("Expansionary monetary: LM shifts right → higher income, lower rate."); }),
    "contractionary monetary": () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Monetary"); setMoneySupply(5000);  setInterestRate(7); setShockResult("Contractionary monetary: LM shifts left → lower income, higher rate."); }),
    "higher savings rate":     () => applyPreset("Solow", () => { setModel("Solow"); setSavingsRate(0.45); setCapitalShock(0); setShockResult("Higher savings: s·f(k) shifts up → k* and y* increase."); }),
    "lower savings rate":      () => applyPreset("Solow", () => { setModel("Solow"); setSavingsRate(0.15); setCapitalShock(0); setShockResult("Lower savings: s·f(k) shifts down → k* and y* decrease."); }),
    "capital destruction":     () => applyPreset("Solow", () => { setModel("Solow"); setCapitalShock(-12); setShockResult("Capital destruction: k falls below k* → economy converges back."); }),
  };

  const applySearch = () => { const q = shockQuery.toLowerCase().trim().replace(/\s+/g, " "); const p = PRESETS[q]; if (p) p(); else alert("Try: " + Object.keys(PRESETS).join(", ")); };
  const applyExpFiscal  = () => applyPreset(model, () => { setPolicyType("Fiscal");   if (model !== "IS-MP" && model !== "AD-AS") setModel("IS-LM"); setGovSpending(3500); setTaxes(20); });
  const applyConFiscal  = () => applyPreset(model, () => { setPolicyType("Fiscal");   if (model !== "IS-MP" && model !== "AD-AS") setModel("IS-LM"); setGovSpending(1000); setTaxes(45); });
  const applyExpMon     = () => applyPreset(model, () => { setPolicyType("Monetary"); setModel("IS-LM"); setMoneySupply(15000); setInterestRate(2); });
  const applyConMon     = () => applyPreset(model, () => { setPolicyType("Monetary"); setModel("IS-LM"); setMoneySupply(5000);  setInterestRate(7); });
  const resetAll = () => { setModel("IS-LM"); setPolicyType("Fiscal"); setGovSpending(2000); setTaxes(30); setMoneySupply(10000); setInterestRate(4); setInflation(4); setShockType("None"); setShockStrength(0); setShockQuery(""); setShockResult(""); setNaturalRate(2); setMpSlope(0.05); setOutputGap(0); setSavingsRate(0.30); setDepreciation(0.05); setPopGrowth(0.01); setTechGrowth(0.02); setCapitalShock(0); setGhost(null); dragging.current = false; };

  const curEq = model === "AD-AS" ? adAs.eq : model === "IS-MP" ? isMp.eq : model === "Solow" ? { x: solow.kStar, y: solow.iStar } : isLm.eq;
  const cx = sx(curEq.x), cy = sy(curEq.y);
  const ghostEq = ghostEqOnly && ghost && model === ghost.model ? ghostEqOnly : null;
  const gx = ghostEq ? sx(ghostEq.x) : null;
  const gy = ghostEq ? sy(ghostEq.y) : null;
  const hasGhost = ghostEq !== null && (Math.abs(curEq.x - ghostEq.x) > 0.3 || Math.abs(curEq.y - ghostEq.y) > 0.03);

  const interpretation = useMemo(() => {
    if (model === "Solow") {
      if (shockResult) return shockResult;
      const { kStar, yStar, iStar, breakEvenRate } = solow;
      let t = `Steady state: k* = ${kStar.toFixed(1)}, y* = ${yStar.toFixed(2)}, i* = ${iStar.toFixed(2)}. `;
      t += `Break-even rate (δ+n+g) = ${(breakEvenRate * 100).toFixed(1)}%. `;
      if (capitalShock < -1) t += "k is below k* — economy converging upward.";
      else if (capitalShock > 1) t += "k is above k* — economy converging downward.";
      else t += "Economy at steady-state equilibrium.";
      return t;
    }
    if (shockResult) return shockResult;
    if (model === "AD-AS") {
      let t = "";
      if (shockType === "Supply") t += shockStrength >= 6 ? "Negative supply shock: SRAS shifts left. " : shockStrength > 0 ? "Mild negative supply shock. " : shockStrength <= -6 ? "Positive supply shock: SRAS shifts right. " : shockStrength < 0 ? "Mild positive supply shock. " : "";
      else if (shockType === "Demand") t += shockStrength >= 6 ? "Positive demand shock: AD shifts right. " : shockStrength > 0 ? "Mild positive demand shock. " : shockStrength <= -6 ? "Negative demand shock: AD shifts left. " : shockStrength < 0 ? "Mild negative demand shock. " : "";
      t += adAs.eq.x > adAs.po + 2 ? "Output above potential — inflationary gap." : adAs.eq.x < adAs.po - 2 ? "Output below potential — recessionary gap." : "Economy near long-run equilibrium.";
      return t;
    }
    if (model === "IS-MP") {
      let t = govSpending > 2000 || taxes < 30 ? "Expansionary fiscal: IS shifts right. " : govSpending < 2000 || taxes > 30 ? "Contractionary fiscal: IS shifts left. " : "Fiscal policy neutral. ";
      const g = isMp.eq.x - isMp.feOut;
      t += g > 2 ? "Output above CB target — MP tightens." : g < -2 ? "Output below CB target — MP eases." : "Economy at CB target.";
      return t;
    }
    let t = "";
    if (policyType === "Fiscal") t += govSpending > 2000 || taxes < 30 ? "Expansionary fiscal: IS shifts right. " : govSpending < 2000 || taxes > 30 ? "Contractionary fiscal: IS shifts left. " : "Fiscal policy neutral. ";
    if (policyType === "Monetary") t += moneySupply > 10000 || interestRate < 4 ? "Expansionary monetary: LM shifts right. " : moneySupply < 10000 || interestRate > 4 ? "Contractionary monetary: LM shifts left. " : "Monetary policy neutral. ";
    t += isLm.eq.x > isLm.fe + 2 ? "Output above full-employment." : isLm.eq.x < isLm.fe - 2 ? "Output below full-employment." : "Output near full-employment.";
    return t;
  }, [model, shockResult, policyType, govSpending, taxes, moneySupply, interestRate, shockType, shockStrength, adAs, isLm, isMp, solow, capitalShock]);

  const axisLabels = { "AD-AS": { x: "Real Output (Y)", y: "Price Level (P)" }, "IS-LM": { x: "Income / Output (Y)", y: "Interest Rate (i)" }, "IS-MP": { x: "Output (Y)", y: "Real Interest Rate (r)" }, "Solow": { x: "Capital per worker (k)", y: "Output / Investment" } };
  const { x: xLabel, y: yLabel } = axisLabels[model];
  const xBot = H - mg.bottom, xArrowY = xBot + 22, yArrowX = mg.left - 22;

  const ArrowOverlay = () => {
    if (!hasGhost) return null;
    const xDir = curEq.x > ghostEq.x ? 1 : -1;
    const yDir = curEq.y > ghostEq.y ? 1 : -1;
    const dec = model === "Solow" ? 1 : 0;
    const ydec = model === "Solow" ? 2 : 1;
    return (
      <>
        <line x1={gx} y1={gy} x2={gx} y2={xBot} stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
        <line x1={cx} y1={cy} x2={cx} y2={xBot} stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
        <line x1={mg.left} y1={gy} x2={gx} y2={gy} stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
        <line x1={mg.left} y1={cy} x2={cx} y2={cy} stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
        <line x1={gx+(xDir>0?5:-5)} y1={xArrowY} x2={cx-(xDir>0?9:-9)} y2={xArrowY} stroke="#60a5fa" strokeWidth="2" markerEnd="url(#arrBlue)" />
        <text x={gx} y={xArrowY+15} fontSize="11" fill="#60a5fa" textAnchor="middle">{ghostEq.x.toFixed(dec)}</text>
        <text x={cx} y={xArrowY+15} fontSize="11" fill="#f1f5f9" textAnchor="middle">{curEq.x.toFixed(dec)}</text>
        {Math.abs(curEq.y - ghostEq.y) > 0.03 && <>
          <line x1={yArrowX} y1={gy+(yDir>0?5:-5)} x2={yArrowX} y2={cy-(yDir>0?9:-9)} stroke="#60a5fa" strokeWidth="2" markerEnd="url(#arrBlue)" />
          <text x={yArrowX-4} y={gy+4} fontSize="11" fill="#60a5fa" textAnchor="end">{ghostEq.y.toFixed(ydec)}</text>
          <text x={yArrowX-4} y={cy+4} fontSize="11" fill="#f1f5f9" textAnchor="end">{curEq.y.toFixed(ydec)}</text>
        </>}
        <circle cx={gx} cy={gy} r="8" fill="#60a5fa" /><circle cx={gx} cy={gy} r="5" fill="#000" />
        <text x={gx-14} y={gy-12} fontSize="13" fill="#60a5fa" fontWeight="700">E₁</text>
      </>
    );
  };

  return (
    <div className="page">
      <header className="topbar"><h1>EconomicPolicy</h1></header>
      <main className="layout">
        <aside className="sidebar">
          <div className="card">
            <h2>Policy Controls</h2>
            <div className="panel-section">
              <label className="field">
                <span>Shock / Scenario Search</span>
                <input type="text" value={shockQuery} onChange={(e) => setShockQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applySearch()} placeholder="e.g. stagflation, higher savings rate…" />
              </label>
              <div className="button-row"><button onClick={applySearch}>Apply</button></div>
            </div>
            <label className="field">
              <span>Model</span>
              <select value={model} onChange={(e) => { clear(); setGhost(null); dragging.current = false; setModel(e.target.value); if (e.target.value === "IS-MP") setPolicyType("Monetary"); }}>
                <option>IS-LM</option><option>IS-MP</option><option>AD-AS</option><option>Solow</option>
              </select>
            </label>

            {model !== "Solow" && (
              <>
                <div className="policy-switch">
                  <button className={policyType === "Fiscal" ? "tab active" : "tab"} onClick={() => { clear(); setPolicyType("Fiscal"); }}>Fiscal</button>
                  <button className={policyType === "Monetary" ? "tab active" : "tab"} onClick={() => { clear(); setPolicyType("Monetary"); if (model !== "IS-MP" && model !== "AD-AS") setModel("IS-LM"); }}>Monetary</button>
                </div>
                {policyType === "Fiscal" && (
                  <div className="panel-section">
                    <SliderField label={`Gov. Spending (billion): ${govSpending.toLocaleString()}`} value={govSpending} min={100} max={5000} step={50} onChange={(v) => { clear(); setGovSpending(v); }} onDown={() => onDown(model)} onUp={onUp} />
                    <SliderField label={`Taxes: ${taxes}%`} value={taxes} min={0} max={100} onChange={(v) => { clear(); setTaxes(v); }} onDown={() => onDown(model)} onUp={onUp} />
                    <div className="button-row"><button onClick={applyExpFiscal}>Expansionary</button><button onClick={applyConFiscal}>Contractionary</button></div>
                  </div>
                )}
                {model === "IS-LM" && policyType === "Monetary" && (
                  <div className="panel-section">
                    <SliderField label={`Money supply: ${moneySupply.toLocaleString()}`} value={moneySupply} min={1000} max={50000} step={500} onChange={(v) => { clear(); setMoneySupply(v); }} onDown={() => onDown(model)} onUp={onUp} />
                    <SliderField label={`Interest rate: ${interestRate}%`} value={interestRate} min={-10} max={20} onChange={(v) => { clear(); setInterestRate(v); }} onDown={() => onDown(model)} onUp={onUp} />
                    <div className="button-row"><button onClick={applyExpMon}>Expansionary</button><button onClick={applyConMon}>Contractionary</button></div>
                  </div>
                )}
                {model === "AD-AS" && policyType === "Monetary" && (
                  <div className="panel-section">
                    <SliderField label={`Central Bank's Money Supply (billion): ${moneySupply.toLocaleString()}`} value={moneySupply} min={100} max={50000} step={100} onChange={(v) => { clear(); setMoneySupply(v); }} onDown={() => onDown(model)} onUp={onUp} />
                    <SliderField label={`Interest rate: ${interestRate}%`} value={interestRate} min={-10} max={20} onChange={(v) => { clear(); setInterestRate(v); }} onDown={() => onDown(model)} onUp={onUp} />
                    <div className="button-row">
                      <button onClick={() => applyPreset(model, () => { setMoneySupply(15000); setInterestRate(2); setShockResult("Expansionary monetary: AD shifts right."); })}>Expansionary</button>
                      <button onClick={() => applyPreset(model, () => { setMoneySupply(5000); setInterestRate(7); setShockResult("Contractionary monetary: AD shifts left."); })}>Contractionary</button>
                    </div>
                  </div>
                )}
                {model === "IS-MP" && policyType === "Monetary" && (
                  <div className="panel-section">
                    <SliderField label={`Natural rate r* = ${naturalRate.toFixed(1)}%`} value={naturalRate} min={0} max={8} step={0.1} dec={1} onChange={(v) => { clear(); setNaturalRate(v); }} onDown={() => onDown(model)} onUp={onUp} />
                    <SliderField label={`MP slope λ = ${mpSlope.toFixed(2)}`} value={mpSlope} min={0.01} max={0.2} step={0.01} dec={2} onChange={(v) => { clear(); setMpSlope(v); }} onDown={() => onDown(model)} onUp={onUp} />
                    <SliderField label={`CB target shift: ${outputGap > 0 ? "+" : ""}${outputGap}`} value={outputGap} min={-20} max={20} onChange={(v) => { clear(); setOutputGap(v); }} onDown={() => onDown(model)} onUp={onUp} />
                    <div className="info-hint">r = r* + λ·(Y − Y*)</div>
                  </div>
                )}
                {model === "AD-AS" && (
                  <div className="panel-section">
                    <SliderField label={`Inflation: ${inflation}%`} value={inflation} min={-10} max={50} onChange={(v) => { clear(); setInflation(v); }} onDown={() => onDown(model)} onUp={onUp} />
                    <label className="field">
                      <span>Shock type</span>
                      <select value={shockType} onChange={(e) => { onDown(model); clear(); setShockType(e.target.value); }}>
                        <option>None</option><option>Demand</option><option>Supply</option>
                      </select>
                    </label>
                    <SliderField label={`${shockType !== "None" ? shockType + " shock" : "Shock intensity"}: ${shockStrength}`} value={shockStrength} min={-10} max={10} onChange={(v) => { clear(); setShockStrength(v); }} onDown={() => onDown(model)} onUp={onUp} />
                  </div>
                )}
              </>
            )}

            {model === "Solow" && (
              <div className="panel-section">
                <div className="info-hint" style={{ marginBottom: "12px" }}>y = k^α (α = {ALPHA}) | steady state: s·f(k) = (δ+n+g)·k</div>
                <SliderField label={`Savings rate s = ${(savingsRate * 100).toFixed(0)}%`} value={savingsRate} min={0.01} max={0.99} step={0.01} dec={2} onChange={(v) => { clear(); setSavingsRate(v); }} onDown={() => onDown("Solow")} onUp={onUp} />
                <SliderField label={`Depreciation δ = ${(depreciation * 100).toFixed(1)}%`} value={depreciation} min={0.01} max={0.5} step={0.005} dec={3} onChange={(v) => { clear(); setDepreciation(v); }} onDown={() => onDown("Solow")} onUp={onUp} />
                <SliderField label={`Population growth n = ${(popGrowth * 100).toFixed(1)}%`} value={popGrowth} min={-0.05} max={0.15} step={0.001} dec={3} onChange={(v) => { clear(); setPopGrowth(v); }} onDown={() => onDown("Solow")} onUp={onUp} />
                <SliderField label={`Technology growth g = ${(techGrowth * 100).toFixed(1)}%`} value={techGrowth} min={0} max={0.15} step={0.001} dec={3} onChange={(v) => { clear(); setTechGrowth(v); }} onDown={() => onDown("Solow")} onUp={onUp} />
                <SliderField label={`Capital shock Δk = ${capitalShock > 0 ? "+" : ""}${capitalShock}`} value={capitalShock} min={-30} max={30} onChange={(v) => { clear(); setCapitalShock(v); }} onDown={() => onDown("Solow")} onUp={onUp} />
                <div className="button-row">
                  <button onClick={() => applyPreset("Solow", () => { setSavingsRate(0.45); setCapitalShock(0); setShockResult("Higher savings: s·f(k) shifts up → k* and y* increase."); })}>↑ Savings</button>
                  <button onClick={() => applyPreset("Solow", () => { setSavingsRate(0.15); setCapitalShock(0); setShockResult("Lower savings: s·f(k) shifts down → k* and y* decrease."); })}>↓ Savings</button>
                </div>
                <div className="button-row">
                  <button onClick={() => applyPreset("Solow", () => { setCapitalShock(-12); setShockResult("Capital destruction: k falls below k* → economy converges back up."); })}>Capital ↓</button>
                  <button onClick={() => applyPreset("Solow", () => { setCapitalShock(+12); setShockResult("Capital windfall: k rises above k* → economy converges back down."); })}>Capital ↑</button>
                </div>
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
              {model === "Solow" && <p><strong>k*:</strong> {solow.kStar.toFixed(1)}<br /><strong>y*:</strong> {solow.yStar.toFixed(2)}<br /><strong>i*:</strong> {solow.iStar.toFixed(2)}<br /><strong>δ+n+g:</strong> {(solow.breakEvenRate * 100).toFixed(1)}%{capitalShock !== 0 && <><br /><strong>k now:</strong> {solow.kCurrent.toFixed(1)}</>}</p>}
            </div>
          </div>
        </aside>

        <section className="graph-section">
          <div className="card graph-card">
            <h2>{model === "Solow" ? "Solow Growth Model" : `${model} Graph`}</h2>
            <svg viewBox={`0 0 ${W} ${H}`} className="graph-svg">
              <defs>
                <marker id="arrBlue" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0,8 3,0 6" fill="#60a5fa" />
                </marker>
              </defs>
              {[1,2,3,4,5,6,7].map(i => { const x = (xMax/8)*i; return <line key={"gx"+i} x1={sx(x)} y1={mg.top} x2={sx(x)} y2={H-mg.bottom} stroke="#27272a" strokeWidth="1" />; })}
              {[0.25,0.5,0.75].map(t => { const yv = yMin+(yMax-yMin)*t; return <line key={"gy"+t} x1={mg.left} y1={sy(yv)} x2={W-mg.right} y2={sy(yv)} stroke="#27272a" strokeWidth="1" />; })}
              <line x1={mg.left} y1={H-mg.bottom} x2={W-mg.right} y2={H-mg.bottom} stroke="#52525b" strokeWidth="2" />
              <line x1={mg.left} y1={H-mg.bottom} x2={mg.left} y2={mg.top} stroke="#52525b" strokeWidth="2" />
              <text x={W/2-55} y={H-8} fontSize="13" fill="#a1a1aa">{xLabel}</text>
              <text x="10" y="22" fontSize="13" fill="#a1a1aa">{yLabel}</text>

              {/* ── AD-AS ── */}
              {model === "AD-AS" && (() => {
                const adShifted   = ghostAdAs && Math.abs(ghostAdAs.AD(100)   - adAs.AD(100))   > 0.05;
                const srasShifted = ghostAdAs && Math.abs(ghostAdAs.SRAS(100) - adAs.SRAS(100)) > 0.05;
                return <>
                  {adShifted && <>
                    <path d={makePath(ghostAdAs.AD)}   fill="none" stroke="#818cf8" strokeWidth="2.5" />
                    <text x={sx(190)} y={sy(ghostAdAs.AD(190))+14}   fill="#818cf8" fontSize="12" fontWeight="700">AD₁</text>
                  </>}
                  {srasShifted && <>
                    <path d={makePath(ghostAdAs.SRAS)} fill="none" stroke="#f87171" strokeWidth="2.5" />
                    <text x={sx(185)} y={sy(ghostAdAs.SRAS(185))-10} fill="#f87171" fontSize="12" fontWeight="700">SRAS₁</text>
                  </>}
                  <path d={makePath(adAs.AD)}   fill="none" stroke="#818cf8" strokeWidth="2.5" />
                  <text x={sx(190)} y={sy(adAs.AD(190))-8}   fill="#818cf8" fontSize="12" fontWeight="700">{adShifted ? "AD₂" : "AD"}</text>
                  <path d={makePath(adAs.SRAS)} fill="none" stroke="#f87171" strokeWidth="2.5" />
                  <text x={sx(185)} y={sy(adAs.SRAS(185))-10} fill="#f87171" fontSize="12" fontWeight="700">{srasShifted ? "SRAS₂" : "SRAS"}</text>
                  <line x1={sx(adAs.po)} y1={mg.top} x2={sx(adAs.po)} y2={H-mg.bottom} stroke="#34d399" strokeWidth="2" strokeDasharray="8 6" />
                  <text x={sx(adAs.po)+5} y={mg.top+16} fill="#34d399" fontSize="12">LRAS</text>
                </>;
              })()}

              {/* ── IS-LM ── */}
              {model === "IS-LM" && (() => {
                const isShifted = ghostIsLm && Math.abs(ghostIsLm.IS(100) - isLm.IS(100)) > 0.05;
                const lmShifted = ghostIsLm && Math.abs(ghostIsLm.LM(100) - isLm.LM(100)) > 0.05;
                return <>
                  {isShifted && <>
                    <path d={makePath(ghostIsLm.IS)} fill="none" stroke="#818cf8" strokeWidth="2.5" />
                    <text x={sx(192)} y={sy(ghostIsLm.IS(192))+14} fill="#818cf8" fontSize="12" fontWeight="700">IS₁</text>
                  </>}
                  {lmShifted && <>
                    <path d={makePath(ghostIsLm.LM)} fill="none" stroke="#f87171" strokeWidth="2.5" />
                    <text x={sx(192)} y={sy(ghostIsLm.LM(192))-8}  fill="#f87171" fontSize="12" fontWeight="700">LM₁</text>
                  </>}
                  <path d={makePath(isLm.IS)} fill="none" stroke="#818cf8" strokeWidth="2.5" />
                  <text x={sx(192)} y={sy(isLm.IS(192))-8}  fill="#818cf8" fontSize="12" fontWeight="700">{isShifted ? "IS₂" : "IS"}</text>
                  <path d={makePath(isLm.LM)} fill="none" stroke="#f87171" strokeWidth="2.5" />
                  <text x={sx(192)} y={sy(isLm.LM(192))+14} fill="#f87171" fontSize="12" fontWeight="700">{lmShifted ? "LM₂" : "LM"}</text>
                  <line x1={sx(isLm.fe)} y1={mg.top} x2={sx(isLm.fe)} y2={H-mg.bottom} stroke="#34d399" strokeWidth="2" strokeDasharray="8 6" />
                  <text x={sx(isLm.fe)+5} y={mg.top+16} fill="#34d399" fontSize="12">FE</text>
                </>;
              })()}

              {/* ── IS-MP ── */}
              {model === "IS-MP" && (() => {
                const isShifted = ghostIsMp && Math.abs(ghostIsMp.IS(100) - isMp.IS(100)) > 0.05;
                const mpShifted = ghostIsMp && Math.abs(ghostIsMp.MP(100) - isMp.MP(100)) > 0.05;
                return <>
                  {isShifted && <>
                    <path d={makePath(ghostIsMp.IS)} fill="none" stroke="#818cf8" strokeWidth="2.5" />
                    <text x={sx(192)} y={sy(ghostIsMp.IS(192))+14} fill="#818cf8" fontSize="12" fontWeight="700">IS₁</text>
                  </>}
                  {mpShifted && <>
                    <path d={makePath(ghostIsMp.MP)} fill="none" stroke="#f87171" strokeWidth="2.5" />
                    <text x={sx(192)} y={sy(ghostIsMp.MP(192))-8}  fill="#f87171" fontSize="12" fontWeight="700">MP₁</text>
                  </>}
                  <path d={makePath(isMp.IS)} fill="none" stroke="#818cf8" strokeWidth="2.5" />
                  <text x={sx(192)} y={sy(isMp.IS(192))-8}  fill="#818cf8" fontSize="12" fontWeight="700">{isShifted ? "IS₂" : "IS"}</text>
                  <path d={makePath(isMp.MP)} fill="none" stroke="#f87171" strokeWidth="2.5" />
                  <text x={sx(192)} y={sy(isMp.MP(192))+14} fill="#f87171" fontSize="12" fontWeight="700">{mpShifted ? "MP₂" : "MP"}</text>
                  <line x1={mg.left} y1={sy(isMp.nr)} x2={W-mg.right} y2={sy(isMp.nr)} stroke="#c084fc" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.7" />
                  <text x={mg.left+4} y={sy(isMp.nr)-5} fill="#c084fc" fontSize="11">r*</text>
                  <line x1={sx(isMp.feOut)} y1={mg.top} x2={sx(isMp.feOut)} y2={H-mg.bottom} stroke="#34d399" strokeWidth="2" strokeDasharray="8 6" />
                  <text x={sx(isMp.feOut)+5} y={mg.top+16} fill="#34d399" fontSize="12">Y*</text>
                </>;
              })()}

              {/* ── Solow ── */}
              {model === "Solow" && (() => {
                const sfShifted = ghostSolow && Math.abs(ghostSolow.investFn(solow.kStar) - solow.investFn(solow.kStar)) > 0.001;
                const beShifted = ghostSolow && Math.abs(ghostSolow.breakEvenRate - solow.breakEvenRate) > 0.0001;
                return <>
                  {ghostSolow && sfShifted && <>
                    <path d={makePath(ghostSolow.investFn, SOLOW_KMAX)} fill="none" stroke="#818cf8" strokeWidth="2.5" />
                    <text x={sx(SOLOW_KMAX*0.95)} y={sy(ghostSolow.investFn(SOLOW_KMAX*0.95))+14} fill="#818cf8" fontSize="12" fontWeight="700">s₁·f(k)</text>
                  </>}
                  {ghostSolow && beShifted && <>
                    <path d={makePath(ghostSolow.breakEven, SOLOW_KMAX)} fill="none" stroke="#f87171" strokeWidth="2.5" />
                    <text x={sx(SOLOW_KMAX*0.92)} y={sy(ghostSolow.breakEven(SOLOW_KMAX*0.92))+14} fill="#f87171" fontSize="12" fontWeight="700">(δ+n+g)₁k</text>
                    <line x1={sx(ghostSolow.kStar)} y1={mg.top} x2={sx(ghostSolow.kStar)} y2={H-mg.bottom} stroke="#34d399" strokeWidth="1.5" strokeDasharray="6 4" />
                    <text x={sx(ghostSolow.kStar)+5} y={mg.top+32} fill="#34d399" fontSize="12">k₁*</text>
                  </>}
                  <path d={makePath(solow.prodFn,   SOLOW_KMAX)} fill="none" stroke="#fbbf24" strokeWidth="2.5" />
                  <text x={sx(SOLOW_KMAX*0.95)} y={sy(solow.prodFn(SOLOW_KMAX*0.95))-9}   fill="#fbbf24" fontSize="12" fontWeight="700">y=kᵅ</text>
                  <path d={makePath(solow.investFn, SOLOW_KMAX)} fill="none" stroke="#818cf8" strokeWidth="2.5" />
                  <text x={sx(SOLOW_KMAX*0.95)} y={sy(solow.investFn(SOLOW_KMAX*0.95))-9} fill="#818cf8" fontSize="12" fontWeight="700">{ghostSolow && sfShifted ? "s₂·f(k)" : "s·f(k)"}</text>
                  <path d={makePath(solow.breakEven,SOLOW_KMAX)} fill="none" stroke="#f87171" strokeWidth="2.5" />
                  <text x={sx(SOLOW_KMAX*0.92)} y={sy(solow.breakEven(SOLOW_KMAX*0.92))-9} fill="#f87171" fontSize="12" fontWeight="700">{ghostSolow && beShifted ? "(δ+n+g)₂k" : "(δ+n+g)k"}</text>
                  <line x1={sx(solow.kStar)} y1={mg.top} x2={sx(solow.kStar)} y2={H-mg.bottom} stroke="#34d399" strokeWidth="2" strokeDasharray="8 6" />
                  <text x={sx(solow.kStar)+5} y={mg.top+16} fill="#34d399" fontSize="12">{ghostSolow && beShifted ? "k₂*" : "k*"}</text>
                  {capitalShock !== 0 && <>
                    <line x1={sx(solow.kCurrent)} y1={mg.top} x2={sx(solow.kCurrent)} y2={H-mg.bottom} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.8" />
                    <text x={sx(solow.kCurrent)+5} y={mg.top+32} fill="#f59e0b" fontSize="11">k</text>
                    {(() => { const dir = solow.kStar > solow.kCurrent ? 1 : -1; return <line x1={sx(solow.kCurrent)+(dir>0?6:-6)} y1={xBot-14} x2={sx(solow.kStar)-(dir>0?10:-10)} y2={xBot-14} stroke="#f59e0b" strokeWidth="2" markerEnd="url(#arrBlue)" />; })()}
                  </>}
                </>;
              })()}

              <ArrowOverlay />

              {/* E₂ / E — black center, large yellow ring */}
              <circle cx={cx} cy={cy} r="11" fill="#fbbf24" />
              <circle cx={cx} cy={cy} r="7"  fill="#000" />
              <text x={cx+13} y={cy-12} fontSize="14" fill="#fbbf24" fontWeight="700">{hasGhost ? "E₂" : "E"}</text>
              {!hasGhost && <>
                <text x={cx} y={xBot+18} fontSize="12" fill="#a1a1aa" textAnchor="middle">{curEq.x.toFixed(model === "Solow" ? 1 : 0)}</text>
                <text x={mg.left-8} y={cy+4} fontSize="12" fill="#a1a1aa" textAnchor="end">{curEq.y.toFixed(model === "Solow" ? 2 : 1)}</text>
              </>}
            </svg>
          </div>
        </section>
      </main>
    </div>
  );
}















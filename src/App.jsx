import React, { useMemo, useState, useRef } from "react";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function SliderField({ label, value, min, max, step = 1, dec = 0, onChange, onDown, onUp }) {
  const [draft, setDraft] = React.useState(null);
  const displayVal = draft !== null ? draft : (dec > 0 ? parseFloat(value).toFixed(dec) : Math.round(value));

  const commit = (raw) => {
    setDraft(null);
    const v = parseFloat(raw);
    if (!isNaN(v)) onChange(clamp(v, min, max));
  };

  return (
    <label className="field">
      <span>{label}</span>
      <div className="slider-row">
        <input type="range" min={min} max={max} step={step} value={value}
          onPointerDown={onDown} onPointerUp={onUp}
          onChange={(e) => { setDraft(null); onChange(+e.target.value); }} />
        <input type="number" min={min} max={max} step={step}
          value={displayVal}
          onPointerDown={onDown}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(e.target.value); }} />
      </div>
    </label>
  );
}

const ALPHA = 0.35;

function buildAdAs(p) {
  const adShift = (p.govSpending - 2000) * 0.0025 - (p.taxes - 30) * 0.6
    + (p.moneySupply - 10000) * 0.0025 - (p.interestRate - 4) * 4
    + (p.shockType === "Demand" ? p.shockStrength * 8 : 0);
  const srasShift = (p.shockType === "Supply" ? p.shockStrength * 12 : 0) + p.inflation * 1.3;
  const AD   = (y) => 170 - 0.7 * y + adShift;
  const SRAS = (y) => 30  + 0.6 * y + srasShift;
  const eqY  = (170 + adShift - 30 - srasShift) / 1.3;
  return { AD, SRAS, po: 110, adShift, srasShift, eq: { x: clamp(eqY, 0, 200), y: clamp(AD(eqY), 0, 200) } };
}

function buildIsLm(p) {
  const isShift = (p.govSpending - 2000) * 0.00111 - (p.taxes - 30) * 0.04;
  const lmShift = (p.moneySupply - 10000) * 0.0003 - (p.interestRate - 4) * 0.6;
  const IS  = (y) => 18 - 0.07 * y + isShift;
  const LM  = (y) => -2 + 0.09 * y - lmShift;
  const eqY = (20 + isShift + lmShift) / 0.16;
  return { IS, LM, fe: 110, isShift, lmShift, eq: { x: clamp(eqY, 0, 200), y: clamp(IS(eqY), -10, 20) } };
}

function buildIsMp(p) {
  const isShift = (p.govSpending - 2000) * 0.00111 - (p.taxes - 30) * 0.04;
  const feOut   = 110 + p.outputGap * 2;
  const IS  = (y) => 12 - 0.06 * y + isShift;
  const MP  = (y) => p.naturalRate + p.mpSlope * (y - feOut);
  const eqY = (12 + isShift - p.naturalRate + p.mpSlope * feOut) / (0.06 + p.mpSlope);
  return { IS, MP, feOut, nr: p.naturalRate, isShift, mpSlope: p.mpSlope, naturalRate: p.naturalRate, eq: { x: clamp(eqY, 0, 200), y: clamp(IS(eqY), -2, 14) } };
}

function buildSolow(p) {
  const { savingsRate: s, depreciation: d, popGrowth: n, techGrowth: g, capitalShock: shock } = p;
  const breakEvenRate = Math.max(d + n + g, 0.001);
  const kStar    = Math.pow(s / breakEvenRate, 1 / (1 - ALPHA));
  const yStar    = Math.pow(Math.max(kStar, 0.01), ALPHA);
  const iStar    = s * yStar;
  const kCurrent = clamp(kStar + shock, 0.5, kStar * 4);
  const prodFn    = (k) => Math.pow(Math.max(k, 0.01), ALPHA);
  const investFn  = (k) => s * Math.pow(Math.max(k, 0.01), ALPHA);
  const breakEven = (k) => breakEvenRate * k;
  return { prodFn, investFn, breakEven, kStar: clamp(kStar, 0.5, 9999), yStar, iStar, kCurrent, breakEvenRate, s, eq: { x: clamp(kStar, 0.5, 9999), y: clamp(iStar, 0, 9999) } };
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

  // History: array of param snapshots — accumulates all past states
  const [history, setHistory] = useState([]);
  const dragging = useRef(false);

  const snap = () => ({ model, govSpending, taxes, moneySupply, interestRate, inflation, shockType, shockStrength, mpSlope, naturalRate, outputGap, savingsRate, depreciation, popGrowth, techGrowth, capitalShock });

  const pushHistory = () => {
    if (!dragging.current) {
      dragging.current = true;
      setHistory(h => [...h.slice(-9), snap()]); // keep max 10 entries
    }
  };
  const onUp = () => { dragging.current = false; };
  const clear = () => setShockResult("");

  // Current built models
  const cp = { govSpending, taxes, moneySupply, interestRate, inflation, shockType, shockStrength, mpSlope, naturalRate, outputGap, savingsRate, depreciation, popGrowth, techGrowth, capitalShock };
  const adAs  = useMemo(() => buildAdAs(cp),  [govSpending, taxes, moneySupply, interestRate, inflation, shockType, shockStrength]);
  const isLm  = useMemo(() => buildIsLm(cp),  [govSpending, taxes, moneySupply, interestRate]);
  const isMp  = useMemo(() => buildIsMp(cp),  [govSpending, taxes, mpSlope, naturalRate, outputGap]);
  const solow = useMemo(() => buildSolow(cp), [savingsRate, depreciation, popGrowth, techGrowth, capitalShock]);

  // History built models
  const historyBuilt = useMemo(() =>
    history.map(p => ({
      adAs:  buildAdAs(p),
      isLm:  buildIsLm(p),
      isMp:  buildIsMp(p),
      solow: buildSolow(p),
      model: p.model,
    })),
    [history]
  );

  // Only show history entries for current model
  const relevantHistory = historyBuilt.filter(h => h.model === model);

  // SVG geometry
  const W = 820, H = 520;
  const mg = { top: 30, right: 40, bottom: 70, left: 68 };
  const iW = W - mg.left - mg.right;
  const iH = H - mg.top - mg.bottom;

  // Solow dynamic axes based on current solow
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

  // Current equilibrium
  const curEq = model === "AD-AS" ? adAs.eq : model === "IS-MP" ? isMp.eq : model === "Solow" ? solow.eq : isLm.eq;
  const cx = sx(curEq.x), cy = sy(curEq.y);
  const xBot = H - mg.bottom;

  // Total equilibrium count = history entries (for current model) + 1 (current)
  const eqNumber = relevantHistory.length + 1;

  // Presets
  const applyPreset = (m, fn) => {
    dragging.current = false;
    setHistory(h => [...h.slice(-9), snap()]);
    clear();
    fn();
  };

  const PRESETS = {
    "positive demand shock":   () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Demand");  setShockStrength(6);  setInflation(4); setShockResult("Positive demand shock: AD shifts right → higher output & prices."); }),
    "negative demand shock":   () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Demand");  setShockStrength(-6); setInflation(2); setShockResult("Negative demand shock: AD shifts left → lower output & prices."); }),
    "positive supply shock":   () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(-6); setInflation(1); setShockResult("Positive supply shock: SRAS shifts right → higher output, lower prices."); }),
    "negative supply shock":   () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(6);  setInflation(6); setShockResult("Negative supply shock: SRAS shifts left → lower output, higher prices."); }),
    "stagflation":             () => applyPreset(model, () => { setModel("AD-AS"); setShockType("Supply");  setShockStrength(8);  setInflation(8); setShockResult("Stagflation: severe negative supply shock → output ↓, prices ↑."); }),
    "expansionary fiscal":     () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Fiscal");   setGovSpending(3500); setTaxes(20);   setShockResult("Expansionary fiscal: IS shifts right."); }),
    "contractionary fiscal":   () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Fiscal");   setGovSpending(1000); setTaxes(45);   setShockResult("Contractionary fiscal: IS shifts left."); }),
    "expansionary monetary":   () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Monetary"); setMoneySupply(15000); setInterestRate(2); setShockResult("Expansionary monetary: LM shifts right."); }),
    "contractionary monetary": () => applyPreset(model, () => { setModel("IS-LM"); setPolicyType("Monetary"); setMoneySupply(5000);  setInterestRate(7); setShockResult("Contractionary monetary: LM shifts left."); }),
    "higher savings rate":     () => applyPreset("Solow", () => { setModel("Solow"); setSavingsRate(0.45); setCapitalShock(0); setShockResult("Higher savings: s·f(k) shifts up → k* and y* increase."); }),
    "lower savings rate":      () => applyPreset("Solow", () => { setModel("Solow"); setSavingsRate(0.15); setCapitalShock(0); setShockResult("Lower savings: s·f(k) shifts down → k* and y* decrease."); }),
    "capital destruction":     () => applyPreset("Solow", () => { setModel("Solow"); setCapitalShock(-12); setShockResult("Capital destruction: k falls below k*."); }),
  };

  const applySearch = () => { const q = shockQuery.toLowerCase().trim().replace(/\s+/g, " "); const p = PRESETS[q]; if (p) p(); else alert("Try: " + Object.keys(PRESETS).join(", ")); };
  const applyExpFiscal  = () => applyPreset(model, () => { setPolicyType("Fiscal");   if (model !== "IS-MP" && model !== "AD-AS") setModel("IS-LM"); setGovSpending(3500); setTaxes(20); });
  const applyConFiscal  = () => applyPreset(model, () => { setPolicyType("Fiscal");   if (model !== "IS-MP" && model !== "AD-AS") setModel("IS-LM"); setGovSpending(1000); setTaxes(45); });
  const applyExpMon     = () => applyPreset(model, () => { setPolicyType("Monetary"); setModel("IS-LM"); setMoneySupply(15000); setInterestRate(2); });
  const applyConMon     = () => applyPreset(model, () => { setPolicyType("Monetary"); setModel("IS-LM"); setMoneySupply(5000);  setInterestRate(7); });

  const resetAll = () => {
    setModel("IS-LM"); setPolicyType("Fiscal");
    setGovSpending(2000); setTaxes(30); setMoneySupply(10000); setInterestRate(4);
    setInflation(4); setShockType("None"); setShockStrength(0);
    setShockQuery(""); setShockResult("");
    setNaturalRate(2); setMpSlope(0.05); setOutputGap(0);
    setSavingsRate(0.30); setDepreciation(0.05); setPopGrowth(0.01); setTechGrowth(0.02); setCapitalShock(0);
    setHistory([]); dragging.current = false;
  };

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
      t += isMp.eq.x - isMp.feOut > 2 ? "Output above CB target." : isMp.eq.x - isMp.feOut < -2 ? "Output below CB target." : "Economy at CB target.";
      return t;
    }
    let t = "";
    if (policyType === "Fiscal") t += govSpending > 2000 || taxes < 30 ? "Expansionary fiscal: IS shifts right. " : govSpending < 2000 || taxes > 30 ? "Contractionary fiscal: IS shifts left. " : "Fiscal policy neutral. ";
    if (policyType === "Monetary") t += moneySupply > 10000 || interestRate < 4 ? "Expansionary monetary: LM shifts right. " : moneySupply < 10000 || interestRate > 4 ? "Contractionary monetary: LM shifts left. " : "Monetary policy neutral. ";
    t += isLm.eq.x > isLm.fe + 2 ? "Output above full-employment." : isLm.eq.x < isLm.fe - 2 ? "Output below full-employment." : "Output near full-employment.";
    return t;
  }, [model, shockResult, policyType, govSpending, taxes, moneySupply, interestRate, shockType, shockStrength, adAs, isLm, isMp, solow, capitalShock]);

  const axisLabels = {
    "AD-AS": { x: "Real Output (Y)", y: "Price Level (P)" },
    "IS-LM": { x: "Income / Output (Y)", y: "Interest Rate (i)" },
    "IS-MP": { x: "Output (Y)", y: "Real Interest Rate (r)" },
    "Solow": { x: "Capital per worker (k)", y: "Output / Investment" },
  };
  const { x: xLabel, y: yLabel } = axisLabels[model];

  // Curve colors
  const C1 = "#818cf8"; // indigo — IS / AD / s·f(k)
  const C2 = "#f87171"; // red   — LM / SRAS / (δ+n+g)k / MP
  const C3 = "#34d399"; // green — FE / LRAS / k*
  const C4 = "#fbbf24"; // amber — production fn

  // Helper: render one set of curves for a given built model + index
  const renderCurves = (built, idx, isLast) => {
    const label = (base) => `${base}${idx + 1}`;
    const opacity = 1; // all curves fully solid
    const sw = 2.5;

    if (model === "AD-AS") {
      return (
        <g key={idx} opacity={opacity}>
          <path d={makePath(built.adAs.AD)}   fill="none" stroke={C1} strokeWidth={sw} />
          <path d={makePath(built.adAs.SRAS)} fill="none" stroke={C2} strokeWidth={sw} />
          {isLast && <>
            <text x={sx(192)} y={sy(built.adAs.AD(192))-8}    fill={C1} fontSize="12" fontWeight="700">{label("AD")}</text>
            <text x={sx(188)} y={sy(built.adAs.SRAS(188))-8}  fill={C2} fontSize="12" fontWeight="700">{label("SRAS")}</text>
          </>}
        </g>
      );
    }
    if (model === "IS-LM") {
      return (
        <g key={idx} opacity={opacity}>
          <path d={makePath(built.isLm.IS)} fill="none" stroke={C1} strokeWidth={sw} />
          <path d={makePath(built.isLm.LM)} fill="none" stroke={C2} strokeWidth={sw} />
          {isLast && <>
            <text x={sx(192)} y={sy(built.isLm.IS(192))-8}  fill={C1} fontSize="12" fontWeight="700">{label("IS")}</text>
            <text x={sx(192)} y={sy(built.isLm.LM(192))+14} fill={C2} fontSize="12" fontWeight="700">{label("LM")}</text>
          </>}
        </g>
      );
    }
    if (model === "IS-MP") {
      return (
        <g key={idx} opacity={opacity}>
          <path d={makePath(built.isMp.IS)} fill="none" stroke={C1} strokeWidth={sw} />
          <path d={makePath(built.isMp.MP)} fill="none" stroke={C2} strokeWidth={sw} />
          {isLast && <>
            <text x={sx(192)} y={sy(built.isMp.IS(192))-8}  fill={C1} fontSize="12" fontWeight="700">{label("IS")}</text>
            <text x={sx(192)} y={sy(built.isMp.MP(192))+14} fill={C2} fontSize="12" fontWeight="700">{label("MP")}</text>
          </>}
        </g>
      );
    }
    if (model === "Solow") {
      return (
        <g key={idx} opacity={opacity}>
          <path d={makePath(built.solow.investFn,  SOLOW_KMAX)} fill="none" stroke={C1} strokeWidth={sw} />
          <path d={makePath(built.solow.breakEven, SOLOW_KMAX)} fill="none" stroke={C2} strokeWidth={sw} />
          {isLast && <>
            <text x={sx(SOLOW_KMAX*0.94)} y={sy(built.solow.investFn(SOLOW_KMAX*0.94))-9}  fill={C1} fontSize="12" fontWeight="700">{label("s·f(k)")}</text>
            <text x={sx(SOLOW_KMAX*0.90)} y={sy(built.solow.breakEven(SOLOW_KMAX*0.90))-9} fill={C2} fontSize="12" fontWeight="700">{label("(δ+n+g)k")}</text>
          </>}
        </g>
      );
    }
    return null;
  };

  // Render equilibrium dot for a history entry
  const renderHistEq = (eq, idx) => {
    const ex = sx(eq.x), ey = sy(eq.y);
    const n = idx + 1;
    return (
      <g key={"eq"+idx}>
        <line x1={ex} y1={ey} x2={ex} y2={xBot} stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
        <line x1={mg.left} y1={ey} x2={ex} y2={ey} stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
        <circle cx={ex} cy={ey} r="8" fill="#60a5fa" />
        <circle cx={ex} cy={ey} r="5" fill="#000" />
        <text x={ex+10} y={ey-10} fontSize="13" fill="#60a5fa" fontWeight="700">E{n}</text>
        <text x={ex} y={xBot+18} fontSize="11" fill="#60a5fa" textAnchor="middle">{eq.x.toFixed(model === "Solow" ? 1 : 0)}</text>
        <text x={mg.left-8} y={ey+4} fontSize="11" fill="#60a5fa" textAnchor="end">{eq.y.toFixed(model === "Solow" ? 2 : 1)}</text>
      </g>
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
              <select value={model} onChange={(e) => { clear(); setModel(e.target.value); if (e.target.value === "IS-MP") setPolicyType("Monetary"); }}>
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
                    <SliderField label={`Gov. Spending (billion): ${govSpending.toLocaleString()}`} value={govSpending} min={100} max={5000} step={50} onChange={(v) => { clear(); setGovSpending(v); }} onDown={pushHistory} onUp={onUp} />
                    <SliderField label={`Taxes: ${taxes}%`} value={taxes} min={0} max={100} onChange={(v) => { clear(); setTaxes(v); }} onDown={pushHistory} onUp={onUp} />
                    <div className="button-row"><button onClick={applyExpFiscal}>Expansionary</button><button onClick={applyConFiscal}>Contractionary</button></div>
                  </div>
                )}
                {model === "IS-LM" && policyType === "Monetary" && (
                  <div className="panel-section">
                    <SliderField label={`Money supply: ${moneySupply.toLocaleString()}`} value={moneySupply} min={1000} max={50000} step={500} onChange={(v) => { clear(); setMoneySupply(v); }} onDown={pushHistory} onUp={onUp} />
                    <SliderField label={`Interest rate: ${interestRate}%`} value={interestRate} min={-10} max={20} onChange={(v) => { clear(); setInterestRate(v); }} onDown={pushHistory} onUp={onUp} />
                    <div className="button-row"><button onClick={applyExpMon}>Expansionary</button><button onClick={applyConMon}>Contractionary</button></div>
                  </div>
                )}
                {model === "AD-AS" && policyType === "Monetary" && (
                  <div className="panel-section">
                    <SliderField label={`Central Bank's Money Supply (billion): ${moneySupply.toLocaleString()}`} value={moneySupply} min={100} max={50000} step={100} onChange={(v) => { clear(); setMoneySupply(v); }} onDown={pushHistory} onUp={onUp} />
                    <SliderField label={`Interest rate: ${interestRate}%`} value={interestRate} min={-10} max={20} onChange={(v) => { clear(); setInterestRate(v); }} onDown={pushHistory} onUp={onUp} />
                    <div className="button-row">
                      <button onClick={() => applyPreset(model, () => { setMoneySupply(15000); setInterestRate(2); setShockResult("Expansionary monetary: AD shifts right."); })}>Expansionary</button>
                      <button onClick={() => applyPreset(model, () => { setMoneySupply(5000); setInterestRate(7); setShockResult("Contractionary monetary: AD shifts left."); })}>Contractionary</button>
                    </div>
                  </div>
                )}
                {model === "IS-MP" && policyType === "Monetary" && (
                  <div className="panel-section">
                    <SliderField label={`Natural rate r* = ${naturalRate.toFixed(1)}%`} value={naturalRate} min={0} max={8} step={0.1} dec={1} onChange={(v) => { clear(); setNaturalRate(v); }} onDown={pushHistory} onUp={onUp} />
                    <SliderField label={`MP slope λ = ${mpSlope.toFixed(2)}`} value={mpSlope} min={0.01} max={0.2} step={0.01} dec={2} onChange={(v) => { clear(); setMpSlope(v); }} onDown={pushHistory} onUp={onUp} />
                    <SliderField label={`CB target shift: ${outputGap > 0 ? "+" : ""}${outputGap}`} value={outputGap} min={-20} max={20} onChange={(v) => { clear(); setOutputGap(v); }} onDown={pushHistory} onUp={onUp} />
                    <div className="info-hint">r = r* + λ·(Y − Y*)</div>
                  </div>
                )}
                {model === "AD-AS" && (
                  <div className="panel-section">
                    <SliderField label={`Inflation: ${inflation}%`} value={inflation} min={-10} max={50} onChange={(v) => { clear(); setInflation(v); }} onDown={pushHistory} onUp={onUp} />
                    <label className="field">
                      <span>Shock type</span>
                      <select value={shockType} onChange={(e) => { pushHistory(); clear(); setShockType(e.target.value); }}>
                        <option>None</option><option>Demand</option><option>Supply</option>
                      </select>
                    </label>
                    <SliderField label={`${shockType !== "None" ? shockType + " shock" : "Shock intensity"}: ${shockStrength}`} value={shockStrength} min={-10} max={10} onChange={(v) => { clear(); setShockStrength(v); }} onDown={pushHistory} onUp={onUp} />
                  </div>
                )}
              </>
            )}

            {model === "Solow" && (
              <div className="panel-section">
                <div className="info-hint" style={{ marginBottom: "12px" }}>y = k^α (α = {ALPHA}) | s·f(k) = (δ+n+g)·k at k*</div>
                <SliderField label={`Savings rate s = ${(savingsRate * 100).toFixed(0)}%`} value={savingsRate} min={0.01} max={0.99} step={0.01} dec={2} onChange={(v) => { clear(); setSavingsRate(v); }} onDown={pushHistory} onUp={onUp} />
                <SliderField label={`Depreciation δ = ${(depreciation * 100).toFixed(1)}%`} value={depreciation} min={0.01} max={0.5} step={0.005} dec={3} onChange={(v) => { clear(); setDepreciation(v); }} onDown={pushHistory} onUp={onUp} />
                <SliderField label={`Population growth n = ${(popGrowth * 100).toFixed(1)}%`} value={popGrowth} min={-0.05} max={0.15} step={0.001} dec={3} onChange={(v) => { clear(); setPopGrowth(v); }} onDown={pushHistory} onUp={onUp} />
                <SliderField label={`Technology growth g = ${(techGrowth * 100).toFixed(1)}%`} value={techGrowth} min={0} max={0.15} step={0.001} dec={3} onChange={(v) => { clear(); setTechGrowth(v); }} onDown={pushHistory} onUp={onUp} />
                <SliderField label={`Capital shock Δk = ${capitalShock > 0 ? "+" : ""}${capitalShock}`} value={capitalShock} min={-30} max={30} onChange={(v) => { clear(); setCapitalShock(v); }} onDown={pushHistory} onUp={onUp} />
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
              {relevantHistory.length > 0 && (
                <button className="clear-btn" onClick={() => setHistory(h => h.slice(0, -1))}>Undo</button>
              )}
            </div>

            <div className="info-box">
              <strong>Interpretation</strong>
              <p>{interpretation}</p>
              {relevantHistory.length > 0 && <p style={{color:"#71717a",fontSize:"12px"}}>{eqNumber - 1} previous state{eqNumber > 2 ? "s" : ""} saved — current is E{eqNumber}</p>}
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

              {/* Grid */}
              {[1,2,3,4,5,6,7].map(i => { const x = (xMax/8)*i; return <line key={"gx"+i} x1={sx(x)} y1={mg.top} x2={sx(x)} y2={H-mg.bottom} stroke="#27272a" strokeWidth="1" />; })}
              {[0.25,0.5,0.75].map(t => { const yv = yMin+(yMax-yMin)*t; return <line key={"gy"+t} x1={mg.left} y1={sy(yv)} x2={W-mg.right} y2={sy(yv)} stroke="#27272a" strokeWidth="1" />; })}

              {/* Axes */}
              <line x1={mg.left} y1={H-mg.bottom} x2={W-mg.right} y2={H-mg.bottom} stroke="#52525b" strokeWidth="2" />
              <line x1={mg.left} y1={H-mg.bottom} x2={mg.left} y2={mg.top} stroke="#52525b" strokeWidth="2" />
              <text x={W/2-55} y={H-8} fontSize="13" fill="#a1a1aa">{xLabel}</text>
              <text x="10" y="22" fontSize="13" fill="#a1a1aa">{yLabel}</text>

              {/* Reference lines (always shown once) */}
              {model === "AD-AS" && <>
                <line x1={sx(adAs.po)} y1={mg.top} x2={sx(adAs.po)} y2={H-mg.bottom} stroke={C3} strokeWidth="2" strokeDasharray="8 6" />
                <text x={sx(adAs.po)+5} y={mg.top+16} fill={C3} fontSize="12">LRAS</text>
              </>}
              {model === "IS-LM" && <>
                <line x1={sx(isLm.fe)} y1={mg.top} x2={sx(isLm.fe)} y2={H-mg.bottom} stroke={C3} strokeWidth="2" strokeDasharray="8 6" />
                <text x={sx(isLm.fe)+5} y={mg.top+16} fill={C3} fontSize="12">FE</text>
              </>}
              {model === "IS-MP" && <>
                <line x1={mg.left} y1={sy(isMp.nr)} x2={W-mg.right} y2={sy(isMp.nr)} stroke="#c084fc" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.7" />
                <text x={mg.left+4} y={sy(isMp.nr)-5} fill="#c084fc" fontSize="11">r*</text>
                <line x1={sx(isMp.feOut)} y1={mg.top} x2={sx(isMp.feOut)} y2={H-mg.bottom} stroke={C3} strokeWidth="2" strokeDasharray="8 6" />
                <text x={sx(isMp.feOut)+5} y={mg.top+16} fill={C3} fontSize="12">Y*</text>
              </>}
              {model === "Solow" && <>
                <path d={makePath(solow.prodFn, SOLOW_KMAX)} fill="none" stroke={C4} strokeWidth="2.5" />
                <text x={sx(SOLOW_KMAX*0.95)} y={sy(solow.prodFn(SOLOW_KMAX*0.95))-9} fill={C4} fontSize="12" fontWeight="700">y=kᵅ</text>
              </>}

              {/* ── History curves (oldest first) ── */}
              {relevantHistory.map((h, i) => {
                const isLastHistory = i === relevantHistory.length - 1;
                // Only show label on each unique curve position (check if same as next)
                return renderCurves(h, i, true);
              })}

              {/* History equilibrium dots */}
              {relevantHistory.map((h, i) => {
                const eq = model === "AD-AS" ? h.adAs.eq : model === "IS-MP" ? h.isMp.eq : model === "Solow" ? h.solow.eq : h.isLm.eq;
                return renderHistEq(eq, i);
              })}

              {/* Solow k* lines for history */}
              {model === "Solow" && relevantHistory.map((h, i) => {
                const kx = sx(h.solow.kStar);
                return (
                  <g key={"kstar"+i}>
                    <line x1={kx} y1={mg.top} x2={kx} y2={H-mg.bottom} stroke={C3} strokeWidth="1.5" strokeDasharray="5 4" opacity="0.6" />
                    <text x={kx+4} y={mg.top+28+i*14} fill={C3} fontSize="11">k{i+1}*</text>
                  </g>
                );
              })}

              {/* ── Current curves (drawn last so on top) ── */}
              {(() => {
                const n = eqNumber;
                const sw = 2.5;
                if (model === "AD-AS") return <>
                  <path d={makePath(adAs.AD)}   fill="none" stroke={C1} strokeWidth={sw} />
                  <path d={makePath(adAs.SRAS)} fill="none" stroke={C2} strokeWidth={sw} />
                  <text x={sx(192)} y={sy(adAs.AD(192))-8}   fill={C1} fontSize="12" fontWeight="700">AD{n}</text>
                  <text x={sx(188)} y={sy(adAs.SRAS(188))-8} fill={C2} fontSize="12" fontWeight="700">SRAS{n}</text>
                </>;
                if (model === "IS-LM") return <>
                  <path d={makePath(isLm.IS)} fill="none" stroke={C1} strokeWidth={sw} />
                  <path d={makePath(isLm.LM)} fill="none" stroke={C2} strokeWidth={sw} />
                  <text x={sx(192)} y={sy(isLm.IS(192))-8}  fill={C1} fontSize="12" fontWeight="700">IS{n}</text>
                  <text x={sx(192)} y={sy(isLm.LM(192))+14} fill={C2} fontSize="12" fontWeight="700">LM{n}</text>
                </>;
                if (model === "IS-MP") return <>
                  <path d={makePath(isMp.IS)} fill="none" stroke={C1} strokeWidth={sw} />
                  <path d={makePath(isMp.MP)} fill="none" stroke={C2} strokeWidth={sw} />
                  <text x={sx(192)} y={sy(isMp.IS(192))-8}  fill={C1} fontSize="12" fontWeight="700">IS{n}</text>
                  <text x={sx(192)} y={sy(isMp.MP(192))+14} fill={C2} fontSize="12" fontWeight="700">MP{n}</text>
                </>;
                if (model === "Solow") return <>
                  <path d={makePath(solow.investFn,  SOLOW_KMAX)} fill="none" stroke={C1} strokeWidth={sw} />
                  <path d={makePath(solow.breakEven, SOLOW_KMAX)} fill="none" stroke={C2} strokeWidth={sw} />
                  <text x={sx(SOLOW_KMAX*0.94)} y={sy(solow.investFn(SOLOW_KMAX*0.94))-9}  fill={C1} fontSize="12" fontWeight="700">s{n}·f(k)</text>
                  <text x={sx(SOLOW_KMAX*0.90)} y={sy(solow.breakEven(SOLOW_KMAX*0.90))-9} fill={C2} fontSize="12" fontWeight="700">(δ+n+g){n}k</text>
                  <line x1={sx(solow.kStar)} y1={mg.top} x2={sx(solow.kStar)} y2={H-mg.bottom} stroke={C3} strokeWidth="2" strokeDasharray="8 6" />
                  <text x={sx(solow.kStar)+5} y={mg.top+16} fill={C3} fontSize="12">k{n}*</text>
                  {capitalShock !== 0 && <>
                    <line x1={sx(solow.kCurrent)} y1={mg.top} x2={sx(solow.kCurrent)} y2={H-mg.bottom} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.8" />
                    <text x={sx(solow.kCurrent)+5} y={mg.top+32} fill="#f59e0b" fontSize="11">k</text>
                    {(() => { const dir = solow.kStar > solow.kCurrent ? 1 : -1; return <line x1={sx(solow.kCurrent)+(dir>0?6:-6)} y1={xBot-14} x2={sx(solow.kStar)-(dir>0?10:-10)} y2={xBot-14} stroke="#f59e0b" strokeWidth="2" markerEnd="url(#arrBlue)" />; })()}
                  </>}
                </>;
                return null;
              })()}

              {/* ── Current equilibrium dot (E_n) ── */}
              <line x1={cx} y1={cy} x2={cx} y2={xBot} stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
              <line x1={mg.left} y1={cy} x2={cx} y2={cy} stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
              <circle cx={cx} cy={cy} r="11" fill="#fbbf24" />
              <circle cx={cx} cy={cy} r="7"  fill="#000" />
              <text x={cx+13} y={cy-12} fontSize="14" fill="#fbbf24" fontWeight="700">E{eqNumber}</text>
              <text x={cx} y={xBot+18} fontSize="12" fill="#fbbf24" textAnchor="middle">{curEq.x.toFixed(model === "Solow" ? 1 : 0)}</text>
              <text x={mg.left-8} y={cy+4} fontSize="12" fill="#fbbf24" textAnchor="end">{curEq.y.toFixed(model === "Solow" ? 2 : 1)}</text>
            </svg>
          </div>
        </section>
      </main>
    </div>
  );
}

















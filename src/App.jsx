import React, { useMemo, useState } from "react";

export default function App() {
  const [model, setModel] = useState("IS-LM");
  const [policyType, setPolicyType] = useState("Fiscal");

  const [govSpending, setGovSpending] = useState(120);
  const [taxes, setTaxes] = useState(30);

  const [moneySupply, setMoneySupply] = useState(100);
  const [interestRate, setInterestRate] = useState(4);

  const [inflation, setInflation] = useState(4);
  const [oilShock, setOilShock] = useState(1);

  const width = 820;
  const height = 540;
  const margin = { top: 30, right: 30, bottom: 55, left: 70 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xMin = 0;
  const xMax = 200;
  const yMin = 0;
  const yMax = 200;

  const scaleX = (x) =>
    margin.left + ((x - xMin) / (xMax - xMin)) * innerWidth;

  const scaleY = (y) =>
    height - margin.bottom - ((y - yMin) / (yMax - yMin)) * innerHeight;

  const policyEffects = useMemo(() => {
    const fiscalADShift = (govSpending - 120) * 0.7 - (taxes - 30) * 0.6;
    const monetaryADShift =
      (moneySupply - 100) * 0.5 - (interestRate - 4) * 4;

    const totalADShift = fiscalADShift + monetaryADShift;
    const totalSRASShift = oilShock * 12 + inflation * 1.3;

    return {
      totalADShift,
      totalSRASShift,
      potentialOutput: 110,
    };
  }, [govSpending, taxes, moneySupply, interestRate, oilShock, inflation]);

  const AD = (y) => 170 - 0.7 * y + policyEffects.totalADShift;
  const SRAS = (y) => 30 + 0.6 * y + policyEffects.totalSRASShift;

  const equilibrium = useMemo(() => {
    const y =
      (170 + policyEffects.totalADShift - 30 - policyEffects.totalSRASShift) /
      (0.7 + 0.6);
    const p = AD(y);
    return { y, p };
  }, [policyEffects]);

  const makePath = (fn) => {
    let d = "";
    for (let x = 0; x <= 200; x += 2) {
      const y = fn(x);
      const px = scaleX(x);
      const py = scaleY(y);
      d += x === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
    }
    return d;
  };

  const adPath = makePath(AD);
  const srasPath = makePath(SRAS);

  const eqX = scaleX(equilibrium.y);
  const eqY = scaleY(equilibrium.p);
  const lrasX = scaleX(policyEffects.potentialOutput);

  const interpretation = useMemo(() => {
    let text = "";

    if (policyType === "Fiscal") {
      if (govSpending > 120 || taxes < 30) {
        text +=
          "Expansionary fiscal policy shifts aggregate demand to the right. ";
      } else if (govSpending < 120 || taxes > 30) {
        text +=
          "Contractionary fiscal policy shifts aggregate demand to the left. ";
      } else {
        text += "Fiscal policy is neutral. ";
      }
    }

    if (policyType === "Monetary") {
      if (moneySupply > 100 || interestRate < 4) {
        text +=
          "Expansionary monetary policy supports higher aggregate demand. ";
      } else if (moneySupply < 100 || interestRate > 4) {
        text += "Contractionary monetary policy reduces aggregate demand. ";
      } else {
        text += "Monetary policy is neutral. ";
      }
    }

    if (oilShock > 1) {
      text +=
        "A stronger oil shock shifts SRAS left, raising prices and reducing output. ";
    }

    if (equilibrium.y > policyEffects.potentialOutput + 2) {
      text += "Output is above potential, suggesting an inflationary gap.";
    } else if (equilibrium.y < policyEffects.potentialOutput - 2) {
      text += "Output is below potential, suggesting a recessionary gap.";
    } else {
      text += "The economy is near long-run equilibrium.";
    }

    return text;
  }, [
    policyType,
    govSpending,
    taxes,
    moneySupply,
    interestRate,
    oilShock,
    equilibrium,
    policyEffects.potentialOutput,
  ]);

  const resetAll = () => {
    setModel("IS-LM");
    setPolicyType("Fiscal");
    setGovSpending(120);
    setTaxes(30);
    setMoneySupply(100);
    setInterestRate(4);
    setInflation(4);
    setOilShock(1);
  };

  const applyExpansionaryFiscal = () => {
    setPolicyType("Fiscal");
    setModel("IS-LM");
    setGovSpending(150);
    setTaxes(20);
  };

  const applyContractionaryFiscal = () => {
    setPolicyType("Fiscal");
    setModel("IS-LM");
    setGovSpending(95);
    setTaxes(45);
  };

  const applyExpansionaryMonetary = () => {
    setPolicyType("Monetary");
    setModel("IS-LM");
    setMoneySupply(130);
    setInterestRate(2);
  };

  const applyContractionaryMonetary = () => {
    setPolicyType("Monetary");
    setModel("IS-LM");
    setMoneySupply(80);
    setInterestRate(7);
  };

  return (
    <div className="page">
      <header className="topbar">
        <h1>EconomicPolicy</h1>
      </header>

      <main className="layout">
        <aside className="sidebar">
          <div className="card">
            <h2>{policyType} Policy Controls</h2>

            <label className="field">
              <span>Model</span>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option>IS-LM</option>
                <option>AD-AS</option>
              </select>
            </label>

            <div className="policy-switch">
              <button
                className={policyType === "Fiscal" ? "tab active" : "tab"}
                onClick={() => {
                  setPolicyType("Fiscal");
                  setModel("IS-LM");
                }}
              >
                Fiscal Policy
              </button>

              <button
                className={policyType === "Monetary" ? "tab active" : "tab"}
                onClick={() => {
                  setPolicyType("Monetary");
                  setModel("IS-LM");
                }}
              >
                Monetary Policy
              </button>
            </div>

            {policyType === "Fiscal" && (
              <div className="panel-section">
                <label className="field">
                  <span>Government spending: {govSpending}</span>
                  <input
                    type="range"
                    min="80"
                    max="180"
                    value={govSpending}
                    onChange={(e) => setGovSpending(Number(e.target.value))}
                  />
                </label>

                <label className="field">
                  <span>Taxes: {taxes}</span>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    value={taxes}
                    onChange={(e) => setTaxes(Number(e.target.value))}
                  />
                </label>

                <div className="button-row">
                  <button onClick={applyExpansionaryFiscal}>Expansionary</button>
                  <button onClick={applyContractionaryFiscal}>
                    Contractionary
                  </button>
                </div>
              </div>
            )}

            {policyType === "Monetary" && (
              <div className="panel-section">
                <label className="field">
                  <span>Money supply: {moneySupply}</span>
                  <input
                    type="range"
                    min="60"
                    max="160"
                    value={moneySupply}
                    onChange={(e) => setMoneySupply(Number(e.target.value))}
                  />
                </label>

                <label className="field">
                  <span>Interest rate: {interestRate}%</span>
                  <input
                    type="range"
                    min="0"
                    max="12"
                    value={interestRate}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                  />
                </label>

                <div className="button-row">
                  <button onClick={applyExpansionaryMonetary}>
                    Expansionary
                  </button>
                  <button onClick={applyContractionaryMonetary}>
                    Contractionary
                  </button>
                </div>
              </div>
            )}

            <div className="panel-section">
              <label className="field">
                <span>Inflation: {inflation}%</span>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={inflation}
                  onChange={(e) => setInflation(Number(e.target.value))}
                />
              </label>

              <label className="field">
                <span>Oil shock: {oilShock}</span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={oilShock}
                  onChange={(e) => setOilShock(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="button-row">
              <button className="reset-btn" onClick={resetAll}>
                Reset
              </button>
            </div>

            <div className="info-box">
              <strong>Interpretation</strong>
              <p>{interpretation}</p>
              <p>
                <strong>Equilibrium output:</strong> {equilibrium.y.toFixed(1)}
                <br />
                <strong>Price level:</strong> {equilibrium.p.toFixed(1)}
              </p>
            </div>
          </div>
        </aside>

        <section className="graph-section">
          <div className="card graph-card">
            <h2>{model} Graph</h2>

            <svg viewBox={`0 0 ${width} ${height}`} className="graph-svg">
              <line
                x1={margin.left}
                y1={height - margin.bottom}
                x2={width - margin.right}
                y2={height - margin.bottom}
                stroke="#111827"
                strokeWidth="2"
              />
              <line
                x1={margin.left}
                y1={height - margin.bottom}
                x2={margin.left}
                y2={margin.top}
                stroke="#111827"
                strokeWidth="2"
              />

              <text x={width / 2 - 40} y={height - 15} fontSize="16">
                Real Output (Y)
              </text>
              <text x="18" y="28" fontSize="16">
                Price Level (P)
              </text>

              <path d={adPath} fill="none" stroke="#2563eb" strokeWidth="3" />
              <text x={scaleX(160)} y={scaleY(AD(160)) - 8} fill="#2563eb">
                AD
              </text>

              <path d={srasPath} fill="none" stroke="#dc2626" strokeWidth="3" />
              <text x={scaleX(145)} y={scaleY(SRAS(145)) - 8} fill="#dc2626">
                SRAS
              </text>

              <line
                x1={lrasX}
                y1={margin.top}
                x2={lrasX}
                y2={height - margin.bottom}
                stroke="#16a34a"
                strokeWidth="3"
                strokeDasharray="8 6"
              />
              <text x={lrasX + 8} y={margin.top + 18} fill="#16a34a">
                LRAS
              </text>

              <line
                x1={eqX}
                y1={eqY}
                x2={eqX}
                y2={height - margin.bottom}
                stroke="#6b7280"
                strokeDasharray="5 5"
              />
              <line
                x1={margin.left}
                y1={eqY}
                x2={eqX}
                y2={eqY}
                stroke="#6b7280"
                strokeDasharray="5 5"
              />

              <circle cx={eqX} cy={eqY} r="5" fill="#111827" />
              <text x={eqX + 8} y={eqY - 8}>
                E
              </text>

              <text x={eqX - 12} y={height - margin.bottom + 20} fontSize="14">
                {equilibrium.y.toFixed(0)}
              </text>
              <text x={margin.left - 42} y={eqY + 5} fontSize="14">
                {equilibrium.p.toFixed(0)}
              </text>
            </svg>
          </div>
        </section>
      </main>
    </div>
  );
}

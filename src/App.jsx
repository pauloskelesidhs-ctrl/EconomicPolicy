import React, { useMemo, useState } from "react";

export default function App() {
  const [model, setModel] = useState("IS-LM");
  const [policyType, setPolicyType] = useState("Fiscal");

  const [govSpending, setGovSpending] = useState(120);
  const [taxes, setTaxes] = useState(30);

  const [moneySupply, setMoneySupply] = useState(100);
  const [interestRate, setInterestRate] = useState(4);

  const [inflation, setInflation] = useState(4);
  const [supplyShock, setSupplyShock] = useState(0);

  const [shockQuery, setShockQuery] = useState("");
  const [shockResult, setShockResult] = useState("");

  const width = 820;
  const height = 540;
  const margin = { top: 30, right: 30, bottom: 55, left: 70 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xMin = 0;
  const xMax = 200;

  const currentYMin = model === "AD-AS" ? 0 : -10;
  const currentYMax = model === "AD-AS" ? 200 : 20;

  const scaleX = (x) =>
    margin.left + ((x - xMin) / (xMax - xMin)) * innerWidth;

  const scaleY = (y) =>
    height -
    margin.bottom -
    ((y - currentYMin) / (currentYMax - currentYMin)) * innerHeight;

  // ---------- AD-AS ----------
  const adAsEffects = useMemo(() => {
    const fiscalADShift = (govSpending - 120) * 0.7 - (taxes - 30) * 0.6;
    const monetaryADShift =
      (moneySupply - 100) * 0.5 - (interestRate - 4) * 4;

    const totalADShift = fiscalADShift + monetaryADShift;
    const totalSRASShift = supplyShock * 12 + inflation * 1.3;

    return {
      totalADShift,
      totalSRASShift,
      potentialOutput: 110,
    };
  }, [govSpending, taxes, moneySupply, interestRate, supplyShock, inflation]);

  const AD = (y) => 170 - 0.7 * y + adAsEffects.totalADShift;
  const SRAS = (y) => 30 + 0.6 * y + adAsEffects.totalSRASShift;
  const LRAS = adAsEffects.potentialOutput;

  const adAsEquilibrium = useMemo(() => {
    const y =
      (170 + adAsEffects.totalADShift - 30 - adAsEffects.totalSRASShift) /
      (0.7 + 0.6);
    const p = AD(y);
    return { y, p };
  }, [adAsEffects]);

  // ---------- IS-LM ----------
  const isLmEffects = useMemo(() => {
    const fiscalISShift = (govSpending - 120) * 0.05 - (taxes - 30) * 0.04;
    const monetaryLMShift =
      (moneySupply - 100) * 0.05 - (interestRate - 4) * 0.6;

    return {
      fiscalISShift,
      monetaryLMShift,
      fullEmploymentOutput: 110,
    };
  }, [govSpending, taxes, moneySupply, interestRate]);

  const IS = (y) => 18 - 0.07 * y + isLmEffects.fiscalISShift;
  const LM = (y) => -2 + 0.09 * y - isLmEffects.monetaryLMShift;
  const FE = isLmEffects.fullEmploymentOutput;

  const isLmEquilibrium = useMemo(() => {
    const y =
      (18 + 2 + isLmEffects.fiscalISShift + isLmEffects.monetaryLMShift) /
      (0.07 + 0.09);
    const i = IS(y);
    return { y, i };
  }, [isLmEffects]);

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

  const applyShockSearch = () => {
    const q = shockQuery.toLowerCase().trim();

    if (!q) return;

    if (q === "positive demand shock") {
      setModel("AD-AS");
      setGovSpending(150);
      setTaxes(20);
      setSupplyShock(0);
      setInflation(4);
      setShockResult("Positive demand shock detected: AD shifts right.");
      return;
    }

    if (q === "negative demand shock") {
      setModel("AD-AS");
      setGovSpending(95);
      setTaxes(45);
      setSupplyShock(0);
      setInflation(2);
      setShockResult("Negative demand shock detected: AD shifts left.");
      return;
    }

    if (q === "positive supply shock") {
      setModel("AD-AS");
      setGovSpending(120);
      setTaxes(30);
      setSupplyShock(-6);
      setInflation(1);
      setShockResult("Positive supply shock detected: SRAS shifts right.");
      return;
    }

    if (q === "negative supply shock") {
      setModel("AD-AS");
      setGovSpending(120);
      setTaxes(30);
      setSupplyShock(6);
      setInflation(6);
      setShockResult("Negative supply shock detected: SRAS shifts left.");
      return;
    }

    if (q === "stagflation") {
      setModel("AD-AS");
      setGovSpending(120);
      setTaxes(30);
      setSupplyShock(8);
      setInflation(8);
      setShockResult(
        "Stagflation detected: negative supply shock with higher inflation and lower output."
      );
      return;
    }

    alert(
      "Use one of these exact inputs: positive demand shock, negative demand shock, positive supply shock, negative supply shock, stagflation."
    );
  };

  const resetAll = () => {
    setModel("IS-LM");
    setPolicyType("Fiscal");
    setGovSpending(120);
    setTaxes(30);
    setMoneySupply(100);
    setInterestRate(4);
    setInflation(4);
    setSupplyShock(0);
    setShockQuery("");
    setShockResult("");
  };

  const clearShockResult = () => setShockResult("");

  const applyExpansionaryFiscal = () => {
    clearShockResult();
    setPolicyType("Fiscal");
    setModel("IS-LM");
    setGovSpending(150);
    setTaxes(20);
  };

  const applyContractionaryFiscal = () => {
    clearShockResult();
    setPolicyType("Fiscal");
    setModel("IS-LM");
    setGovSpending(95);
    setTaxes(45);
  };

  const applyExpansionaryMonetary = () => {
    clearShockResult();
    setPolicyType("Monetary");
    setModel("IS-LM");
    setMoneySupply(130);
    setInterestRate(2);
  };

  const applyContractionaryMonetary = () => {
    clearShockResult();
    setPolicyType("Monetary");
    setModel("IS-LM");
    setMoneySupply(80);
    setInterestRate(7);
  };

  const interpretation = useMemo(() => {
    if (shockResult) return shockResult;

    if (model === "AD-AS") {
      let text = "";

      if (supplyShock >= 6) {
        text += "Negative supply shock: SRAS shifts left. ";
      } else if (supplyShock > 0) {
        text += "Mild negative supply shock. ";
      } else if (supplyShock <= -6) {
        text += "Positive supply shock: SRAS shifts right. ";
      } else if (supplyShock < 0) {
        text += "Mild positive supply shock. ";
      }

      if (
        govSpending > 120 ||
        taxes < 30 ||
        moneySupply > 100 ||
        interestRate < 4
      ) {
        text += "Demand conditions are relatively expansionary. ";
      } else if (
        govSpending < 120 ||
        taxes > 30 ||
        moneySupply < 100 ||
        interestRate > 4
      ) {
        text += "Demand conditions are relatively contractionary. ";
      }

      if (supplyShock > 5 && adAsEquilibrium.y < adAsEffects.potentialOutput - 2) {
        text += "This creates stagflation-like conditions. ";
      }

      if (adAsEquilibrium.y > adAsEffects.potentialOutput + 2) {
        text += "Output is above potential, suggesting an inflationary gap.";
      } else if (adAsEquilibrium.y < adAsEffects.potentialOutput - 2) {
        text += "Output is below potential, suggesting a recessionary gap.";
      } else {
        text += "The economy is near long-run equilibrium.";
      }

      return text;
    }

    let text = "";

    if (policyType === "Fiscal") {
      if (govSpending > 120 || taxes < 30) {
        text += "Expansionary fiscal policy shifts IS to the right. ";
      } else if (govSpending < 120 || taxes > 30) {
        text += "Contractionary fiscal policy shifts IS to the left. ";
      } else {
        text += "Fiscal policy is neutral. ";
      }
    }

    if (policyType === "Monetary") {
      if (moneySupply > 100 || interestRate < 4) {
        text += "Expansionary monetary policy shifts LM to the right/down. ";
      } else if (moneySupply < 100 || interestRate > 4) {
        text += "Contractionary monetary policy shifts LM to the left/up. ";
      } else {
        text += "Monetary policy is neutral. ";
      }
    }

    if (isLmEquilibrium.y > FE + 2) {
      text += "Output is above full-employment output.";
    } else if (isLmEquilibrium.y < FE - 2) {
      text += "Output is below full-employment output.";
    } else {
      text += "Output is close to full-employment output.";
    }

    return text;
  }, [
    shockResult,
    model,
    policyType,
    govSpending,
    taxes,
    moneySupply,
    interestRate,
    supplyShock,
    adAsEquilibrium,
    adAsEffects.potentialOutput,
    isLmEquilibrium,
    FE,
  ]);

  const currentEq =
    model === "AD-AS"
      ? { x: adAsEquilibrium.y, y: adAsEquilibrium.p }
      : { x: isLmEquilibrium.y, y: isLmEquilibrium.i };

  const currentEqX = scaleX(currentEq.x);
  const currentEqY = scaleY(currentEq.y);

  const adPath = makePath(AD);
  const srasPath = makePath(SRAS);
  const isPath = makePath(IS);
  const lmPath = makePath(LM);

  const lrasX = scaleX(LRAS);
  const feX = scaleX(FE);

  return (
    <div className="page">
      <header className="topbar">
        <h1>EconomicPolicy</h1>
      </header>

      <main className="layout">
        <aside className="sidebar">
          <div className="card">
            <h2>{policyType} Policy Controls</h2>

            <div className="panel-section">
              <label className="field">
                <span>Shock Search Engine</span>
                <input
                  type="text"
                  value={shockQuery}
                  onChange={(e) => setShockQuery(e.target.value)}
                  placeholder="positive demand shock, negative supply shock, stagflation"
                />
              </label>

              <div className="button-row">
                <button onClick={applyShockSearch}>Apply Shock</button>
              </div>
            </div>

            <label className="field">
              <span>Model</span>
              <select
                value={model}
                onChange={(e) => {
                  clearShockResult();
                  setModel(e.target.value);
                }}
              >
                <option>IS-LM</option>
                <option>AD-AS</option>
              </select>
            </label>

            <div className="policy-switch">
              <button
                className={policyType === "Fiscal" ? "tab active" : "tab"}
                onClick={() => {
                  clearShockResult();
                  setPolicyType("Fiscal");
                  setModel("IS-LM");
                }}
              >
                Fiscal Policy
              </button>

              <button
                className={policyType === "Monetary" ? "tab active" : "tab"}
                onClick={() => {
                  clearShockResult();
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
                    onChange={(e) => {
                      clearShockResult();
                      setGovSpending(Number(e.target.value));
                    }}
                  />
                </label>

                <label className="field">
                  <span>Taxes: {taxes}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={taxes}
                    onChange={(e) => {
                      clearShockResult();
                      setTaxes(Number(e.target.value));
                    }}
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
                    onChange={(e) => {
                      clearShockResult();
                      setMoneySupply(Number(e.target.value));
                    }}
                  />
                </label>

                <label className="field">
                  <span>Interest rate: {interestRate}%</span>
                  <input
                    type="range"
                    min="-10"
                    max="20"
                    value={interestRate}
                    onChange={(e) => {
                      clearShockResult();
                      setInterestRate(Number(e.target.value));
                    }}
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

            {model === "AD-AS" && (
              <div className="panel-section">
                <label className="field">
                  <span>Inflation: {inflation}%</span>
                  <input
                    type="range"
                    min="-10"
                    max="50"
                    value={inflation}
                    onChange={(e) => {
                      clearShockResult();
                      setInflation(Number(e.target.value));
                    }}
                  />
                </label>

                <label className="field">
                  <span>Supply shock: {supplyShock}</span>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    value={supplyShock}
                    onChange={(e) => {
                      clearShockResult();
                      setSupplyShock(Number(e.target.value));
                    }}
                  />
                </label>
              </div>
            )}

            <div className="button-row">
              <button className="reset-btn" onClick={resetAll}>
                Reset
              </button>
            </div>

            <div className="info-box">
              <strong>Interpretation</strong>
              <p>{interpretation}</p>

              {model === "AD-AS" ? (
                <p>
                  <strong>Equilibrium output:</strong>{" "}
                  {adAsEquilibrium.y.toFixed(1)}
                  <br />
                  <strong>Price level:</strong> {adAsEquilibrium.p.toFixed(1)}
                </p>
              ) : (
                <p>
                  <strong>Equilibrium income:</strong>{" "}
                  {isLmEquilibrium.y.toFixed(1)}
                  <br />
                  <strong>Interest rate:</strong>{" "}
                  {isLmEquilibrium.i.toFixed(1)}
                </p>
              )}
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

              {model === "AD-AS" ? (
                <>
                  <text x={width / 2 - 40} y={height - 15} fontSize="16">
                    Real Output (Y)
                  </text>
                  <text x="18" y="28" fontSize="16">
                    Price Level (P)
                  </text>
                </>
              ) : (
                <>
                  <text x={width / 2 - 55} y={height - 15} fontSize="16">
                    Income / Output (Y)
                  </text>
                  <text x="18" y="28" fontSize="16">
                    Interest Rate (i)
                  </text>
                </>
              )}

              {model === "AD-AS" ? (
                <>
                  <path d={adPath} fill="none" stroke="#2563eb" strokeWidth="3" />
                  <text x={scaleX(160)} y={scaleY(AD(160)) - 8} fill="#2563eb">
                    AD
                  </text>

                  <path
                    d={srasPath}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="3"
                  />
                  <text
                    x={scaleX(145)}
                    y={scaleY(SRAS(145)) - 8}
                    fill="#dc2626"
                  >
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
                </>
              ) : (
                <>
                  <path d={isPath} fill="none" stroke="#2563eb" strokeWidth="3" />
                  <text x={scaleX(160)} y={scaleY(IS(160)) - 8} fill="#2563eb">
                    IS
                  </text>

                  <path d={lmPath} fill="none" stroke="#dc2626" strokeWidth="3" />
                  <text x={scaleX(145)} y={scaleY(LM(145)) - 8} fill="#dc2626">
                    LM
                  </text>

                  <line
                    x1={feX}
                    y1={margin.top}
                    x2={feX}
                    y2={height - margin.bottom}
                    stroke="#16a34a"
                    strokeWidth="3"
                    strokeDasharray="8 6"
                  />
                  <text x={feX + 8} y={margin.top + 18} fill="#16a34a">
                    FE
                  </text>
                </>
              )}

              <line
                x1={currentEqX}
                y1={currentEqY}
                x2={currentEqX}
                y2={height - margin.bottom}
                stroke="#6b7280"
                strokeDasharray="5 5"
              />
              <line
                x1={margin.left}
                y1={currentEqY}
                x2={currentEqX}
                y2={currentEqY}
                stroke="#6b7280"
                strokeDasharray="5 5"
              />

              <circle cx={currentEqX} cy={currentEqY} r="5" fill="#111827" />
              <text x={currentEqX + 8} y={currentEqY - 8}>
                E
              </text>

              <text
                x={currentEqX - 12}
                y={height - margin.bottom + 20}
                fontSize="14"
              >
                {currentEq.x.toFixed(0)}
              </text>
              <text x={margin.left - 42} y={currentEqY + 5} fontSize="14">
                {currentEq.y.toFixed(0)}
              </text>
            </svg>
          </div>
        </section>
      </main>
    </div>
  );
}

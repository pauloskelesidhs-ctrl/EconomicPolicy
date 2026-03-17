import React, { useMemo, useRef, useState } from "react";
import { CreateMLCEngine } from "@mlc-ai/web-llm";

export default function App() {
  const [model, setModel] = useState("IS-LM");
  const [policyType, setPolicyType] = useState("Fiscal");

  const [govSpending, setGovSpending] = useState(120);
  const [taxes, setTaxes] = useState(30);

  const [moneySupply, setMoneySupply] = useState(100);
  const [interestRate, setInterestRate] = useState(4);

  const [inflation, setInflation] = useState(4);
  const [oilShock, setOilShock] = useState(1);

  const [scenarioText, setScenarioText] = useState("");

  const [aiReady, setAiReady] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState("AI not loaded");
  const [aiExplanation, setAiExplanation] = useState("");

  const engineRef = useRef(null);

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
    const totalSRASShift = oilShock * 12 + inflation * 1.3;

    return {
      totalADShift,
      totalSRASShift,
      potentialOutput: 110,
    };
  }, [govSpending, taxes, moneySupply, interestRate, oilShock, inflation]);

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

  const applyStructuredShock = (result) => {
    const shockModel = result.model || "AD-AS";
    const curve = result.curve || "";
    const direction = result.direction || "";
    const policy = result.policyType || "None";
    const strength = Math.max(1, Math.min(10, Number(result.strength) || 5));

    setAiExplanation(result.explanation || "");

    if (shockModel === "AD-AS") {
      setModel("AD-AS");

      if (curve === "SRAS" && direction === "left") {
        setOilShock(strength);
        return;
      }

      if (curve === "AD" && direction === "right") {
        setGovSpending(120 + strength * 4);
        setTaxes(Math.max(0, 30 - strength * 2));
        return;
      }

      if (curve === "AD" && direction === "left") {
        setGovSpending(Math.max(80, 120 - strength * 3));
        setTaxes(Math.min(100, 30 + strength * 2));
        return;
      }
    }

    if (shockModel === "IS-LM") {
      setModel("IS-LM");

      if (policy === "Fiscal" || curve === "IS") {
        setPolicyType("Fiscal");

        if (direction === "right") {
          setGovSpending(120 + strength * 4);
          setTaxes(Math.max(0, 30 - strength * 2));
          return;
        }

        if (direction === "left") {
          setGovSpending(Math.max(80, 120 - strength * 3));
          setTaxes(Math.min(100, 30 + strength * 2));
          return;
        }
      }

      if (policy === "Monetary" || curve === "LM") {
        setPolicyType("Monetary");

        if (direction === "right" || direction === "down") {
          setMoneySupply(100 + strength * 4);
          setInterestRate(Math.max(-10, 4 - Math.round(strength / 2)));
          return;
        }

        if (direction === "left" || direction === "up") {
          setMoneySupply(Math.max(60, 100 - strength * 4));
          setInterestRate(Math.min(20, 4 + Math.round(strength / 2)));
          return;
        }
      }
    }
  };

  const loadAI = async () => {
    if (engineRef.current) {
      setAiReady(true);
      setAiStatus("AI ready");
      return;
    }

    try {
      setAiLoading(true);
      setAiStatus("Loading AI model...");

      const engine = await CreateMLCEngine(
        "Llama-3.1-8B-Instruct-q4f32_1-MLC",
        {
          initProgressCallback: (report) => {
            if (report?.text) {
              setAiStatus(report.text);
            } else {
              setAiStatus("Loading AI model...");
            }
          },
        }
      );

      engineRef.current = engine;
      setAiReady(true);
      setAiStatus("AI ready");
    } catch (error) {
      console.error(error);
      setAiStatus("AI failed to load");
      alert(
        "AI could not load on this device/browser. Your manual scenario rules can still be used."
      );
    } finally {
      setAiLoading(false);
    }
  };

  const analyzeScenarioWithAI = async () => {
    if (!scenarioText.trim()) return;

    if (!engineRef.current) {
      await loadAI();
    }

    if (!engineRef.current) return;

    try {
      setAiStatus("Analyzing scenario...");

      const messages = [
        {
          role: "system",
          content: `
You are an economics classifier for a teaching app.
Return ONLY valid JSON with this exact schema:
{
  "model": "AD-AS" or "IS-LM",
  "policyType": "Fiscal" or "Monetary" or "None",
  "shockType": "short phrase",
  "curve": "AD" or "SRAS" or "IS" or "LM" or "FE",
  "direction": "left" or "right" or "up" or "down",
  "strength": number from 1 to 10,
  "explanation": "one short explanation for students"
}

Rules:
- Cost increases, wars, shipping/transport costs, energy price spikes, gas price increases -> AD-AS, SRAS, left
- Government spending increases or tax cuts -> IS-LM, Fiscal, IS, right
- Government spending cuts or tax increases -> IS-LM, Fiscal, IS, left
- Money supply increases or interest-rate cuts by the central bank -> IS-LM, Monetary, LM, right
- Money supply decreases or interest-rate hikes by the central bank -> IS-LM, Monetary, LM, left
- Consumer confidence or investment falls -> AD-AS, AD, left

Return JSON only.
          `.trim(),
        },
        {
          role: "user",
          content: scenarioText,
        },
      ];

      const response = await engineRef.current.chat.completions.create({
        messages,
        temperature: 0.2,
      });

      const raw = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);

      applyStructuredShock(parsed);
      setAiStatus("Scenario analyzed");
    } catch (error) {
      console.error(error);
      setAiStatus("AI analysis failed");
      alert("AI could not parse the scenario. Try a shorter sentence.");
    }
  };

  const resetAll = () => {
    setModel("IS-LM");
    setPolicyType("Fiscal");
    setGovSpending(120);
    setTaxes(30);
    setMoneySupply(100);
    setInterestRate(4);
    setInflation(4);
    setOilShock(1);
    setScenarioText("");
    setAiExplanation("");
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

  const interpretation = useMemo(() => {
    if (aiExplanation) return aiExplanation;

    if (model === "AD-AS") {
      let text = "";

      if (oilShock > 1) {
        text +=
          "This looks like a negative supply shock, so SRAS shifts left. ";
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
    aiExplanation,
    model,
    policyType,
    govSpending,
    taxes,
    moneySupply,
    interestRate,
    oilShock,
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
                <span>Scenario Engine</span>
                <input
                  type="text"
                  value={scenarioText}
                  onChange={(e) => setScenarioText(e.target.value)}
                  placeholder="Example: A war increases transport costs"
                />
              </label>

              <div className="button-row">
                <button onClick={loadAI} disabled={aiLoading}>
                  {aiLoading ? "Loading AI..." : aiReady ? "AI Ready" : "Load AI"}
                </button>
                <button onClick={analyzeScenarioWithAI}>
                  Analyze with AI
                </button>
              </div>

              <div className="info-box">
                <strong>AI status:</strong> {aiStatus}
              </div>
            </div>

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
                  <span>Taxes: {taxes}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
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
                    min="-10"
                    max="20"
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

            {model === "AD-AS" && (
              <div className="panel-section">
                <label className="field">
                  <span>Inflation: {inflation}%</span>
                  <input
                    type="range"
                    min="-10"
                    max="50"
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

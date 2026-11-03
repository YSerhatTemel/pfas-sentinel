# PFAS-Sentinel™ | Mid-Bed MIP-Electrochemical Sensing & PINN Breakthrough Digital Twin

**Challenge #2: Water Quality — Xylem Global Student Innovation Challenge 2026**  
**Technology Readiness Level:** TRL 3 (Analytical, Numerical & Cyber-Physical Digital Twin Prototype)

**PFAS-Sentinel** (*Microfluidic MIP-Electrochemical Biosensor & Physics-Informed Neural Network Digital Twin for Real-Time PFAS Early Warning and Media Lifecycle Optimization*) is a cyber-physical hardware-enabled SaaS concept designed to eliminate centralized laboratory latency (10–14 day LC-MS/MS turnaround), prevent "blind breakthrough" and short-chain chromatographic roll-up ($C_t > C_0$), and extend Granular Activated Carbon (GAC) and Selective Ion Exchange (IX) resin bed life by 25–30%.

---

## Core Engineering Architecture

1. **Hardware Layer (Proposed 32-Channel Microfluidic MIP & Amine-Functionalized Nanocarbon Array)**
   - **Retrofitting Existing Mid-Bed Sample Ports**: Rather than requiring new filtration vessels, PFAS-Sentinel connects directly to the existing `1/4" NPT` Influent ($C_0$), **Mid-Bed ($C_{\text{mid}}$ at $z/L = 0.50$)**, and Effluent ($C_t$) sampling ports already installed on municipal GAC and IX vessels—transforming manual monthly grab-sample ports into automated 15-minute telemetry nodes.
   - **32-Channel Multiplexed Cartridge & Exact 4×4 Tikhonov Matrix Deconvolution**: Groups 28 working electrodes into four imprinted cavity sub-classes (**PFBA** C4-carboxylate sentinel tracer, **PFBS** C4-sulfonate Hazard Index analyte, **PFOA** C8-carboxylate, and **PFOS** C8-sulfonate) alongside **4 Non-Imprinted Polymer (NIP) blank reference channels** (building on Oseyemi & Rezai Sept 2025 stand-alone MIP and UConn amine-functionalized nanocarbon architectures). Executes exact $4\times 4$ Gauss-Jordan Tikhonov-regularized cross-selectivity matrix inversion (`solveTikhonov4x4Deconvolution`, $\hat{\mathbf{c}} = (\mathbf{S}^\top\mathbf{S} + \lambda\mathbf{I})^{-1}\mathbf{S}^\top\mathbf{r}_{\text{purified}}$, $\kappa_2(\mathbf{S}) = 1.34$, $\det(\mathbf{S}) = 0.941$).
   - **Strict Two-Stage Blind Inverse Calibration & Xylem YSI EXO2 Context Fusion**: Physically separates the forward electrochemical testbench (`simulatePhysicalSensorImpedance`) from the blind edge inverse estimator (`predictPfasFromImpedance` — which takes **zero** `truePpt` or `nomMgL` inputs, operating strictly on observable $\Delta R_{\text{ct,MIP}}$, $\Delta R_{\text{ct,NIP}}$, and **Xylem YSI EXO2 / WTW** multiparameter sonde telemetry: pH, temperature, conductivity, turbidity, and **fDOM [Fluorescent Dissolved Organic Matter, QSU]** as a real-time optical proxy for humic/fulvic NOM; *note: YSI EXO2 does not sense PFAS directly*) on an **ARM Cortex-M33 + AD5940** EIS node (in-silico multi-matrix stress test MAE ~4.5%).

2. **Software & AI Layer (Designed for Xylem Vue powered by GoAigua — Smart Water Engine)**
   - **Hybrid Physics-Informed Neural Network (PINN) Spatiotemporal PDE Solver with Learned Parameter Propagation**: Assimilates 15-minute Mid-Bed ($z/L = 0.50$) telemetry alongside **Xylem Sensus / MJK** flow rate ($Q$) by optimizing physical Thomas parameters $\theta_{\text{phys}} = [k_{\text{Th}}, q_0]$ and a 2-layer neural residual network $\mathcal{N}_{\mathbf{W}}(\tilde{z}, \tilde{t})$ via analytical chain-rule backpropagation and Adam optimization over both data loss and 1D Advection-Sorption PDE collocation residuals (zero ground-truth parameter leakage). Crucially, the assimilated parameters (`learnedKth`, `learnedQ0`) and trained neural residual directly drive both the effluent trajectory (`pinnEffluentPpt`) and the 4.0 ppt breakthrough forecast (`assimilatedEffluent4PptDay` $\pm$ 95% CI):
     $$\mathcal{L}_{\text{PINN}}(\theta_{\text{phys}}, \mathbf{W}) = \left\|\hat{C}(z_{\text{mid}}, t) - C_{\text{mid}}^{\text{obs}}\right\|_2^2 + \lambda_{\text{PDE}} \left\|\frac{\partial \hat{C}}{\partial t} + u_{\text{MTZ}} \frac{\partial \hat{C}}{\partial \tilde{z}} - S_{\text{kin}}(\hat{C})\right\|_2^2$$
     where $\hat{C}(\tilde{z}, t) = C_{\text{Thomas}}(\tilde{z}, t; k_{\text{Th}}, q_0) + \mathcal{N}_{\mathbf{W}}(\tilde{z}, t)$ and $u_{\text{MTZ}} = \frac{Q C_0}{q_0 M}$.
   - **Temporal Train/Test Split (`Days 30–135` Train vs. `Days 155–210` Holdout Test) & Static Thomas Baseline Comparison**: Trains strictly on the early-to-mid-run checkpoints (`Days 30, 60, 90, 115, 135`) and evaluates out-of-sample generalization on the future breakthrough holdout checkpoints (`Days 155, 180, 210`) from `PUBLISHED_PILOT_GAC_RATIOS` (*McCleaf et al., Water Research 2017*; *Park et al., EST 2020*; `PILOT_DATASET_PROVENANCE`), achieving a **3x–5x reduction in Holdout Test RMSE** compared to the Static Thomas Baseline while capturing multi-solute chromatographic roll-up ($C_t / C_0 > 1.0$).
   - **Exact US EPA (April 2024) & EU (Jan 2026) Statutory Distinctions vs. Internal SCADA Trigger**: Explicitly distinguishes binding statutory limits (**PFOA / PFOS: 4.0 ppt MCL**; **PFHxS / PFNA / GenX: 10.0 ppt MCL**; **PFBS: EPA Hazard Index $\text{HI} \le 1.0$, HBWC 2000 ppt**; **PFBA: UCMR5 Sentinel Tracer**; **EU 2026 DWD: `Sum of 20 PFAS` $\le 100\text{ ng/L}$ and `PFAS Total` $\le 500\text{ ng/L}$**) from the **4.0 ppt Internal Early-Warning SCADA Trigger** used on mid-bed sentinel ports.
   - **Interlocked SCADA Control & Human-in-the-Loop Governance**: Supports both **Human-in-the-Loop Operator Approval Mode** and **Automated Closed-Loop Simulation**, guarded by three PLC safety interlocks (YSI EXO2 Modbus heartbeat watchdog, 32-Ch EIS replicate variance gate $\text{CV} < 10\%$, and lead-lag vessel differential pressure interlock $\Delta P < 18\text{ psi}$) before actuating lead-lag switchover (`MV-104`/`MV-105`), scheduling **Evoqua** just-in-time media regeneration, or dispatching **Xylem MitiGATOR™** mobile treatment units.

3. **Servitization Business Model, Documented Literature Validation & TRL 3 → TRL 6 Roadmap**
   - Eliminates upfront utility CAPEX via a projected **$11.80 "razor-and-blade" disposable cartridge** (target BOM at scale) bundled into performance-based O&M contracts, extending GAC/IX bed utilization by **25–30%** while retaining quarterly LC-MS/MS for statutory certification.
   - Grounded in verifiable secondary evidence: **US EPA Final PFAS Rule (89 FR 32532)**, **AWWA National Cost Analysis**, **Published Xylem/Evoqua Municipal Case Studies (KKWWD Maine & SHWSD Colorado)**, and peer-reviewed filtration literature.

---

## Running Locally

```bash
# Install dependencies
npm.cmd install

# Start interactive development server
npm.cmd run dev

# Build production bundle (for Vercel / GitHub Pages deployment)
npm.cmd run build
```

## Python Spatiotemporal PINN PDE & Non-Circular Inverse EIS Simulation

```bash
python simulation/pfas_sentinel_pinn_model.py
```

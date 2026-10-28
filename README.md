# PFAS-Sentinel™ | Mid-Bed MIP-Electrochemical Sensing & PINN Breakthrough Digital Twin

**Challenge #2: Water Quality — Xylem Global Student Innovation Challenge 2026**  
**Technology Readiness Level:** TRL 3 (Analytical, Numerical & Cyber-Physical Digital Twin Prototype)

**PFAS-Sentinel** (*Microfluidic MIP-Electrochemical Biosensor & Physics-Informed Neural Network Digital Twin for Real-Time PFAS Early Warning and Media Lifecycle Optimization*) is a cyber-physical hardware-enabled SaaS concept designed to eliminate centralized laboratory latency (10–14 day LC-MS/MS turnaround), prevent "blind breakthrough" and short-chain chromatographic roll-up ($C_t > C_0$), and extend Granular Activated Carbon (GAC) and Selective Ion Exchange (IX) resin bed life by 25–30%.

---

## Core Engineering Architecture

1. **Hardware Layer (Proposed 32-Channel Microfluidic MIP & Amine-Functionalized Nanocarbon Array)**
   - **Retrofitting Existing Mid-Bed Sample Ports**: Rather than requiring new filtration vessels, PFAS-Sentinel connects directly to the existing `1/4" NPT` Influent ($C_0$), **Mid-Bed ($C_{\text{mid}}$ at $z/L = 0.50$)**, and Effluent ($C_t$) sampling ports already installed on municipal GAC and IX vessels—transforming manual monthly grab-sample ports into automated 15-minute telemetry nodes.
   - **32-Channel Multiplexed Cartridge & 4×4 Cross-Selectivity Deconvolution**: Groups 28 working electrodes into four imprinted cavity sub-classes (**PFBA** C4-carboxylate sentinel tracer, **PFBS** C4-sulfonate Hazard Index analyte, **PFOA** C8-carboxylate, and **PFOS** C8-sulfonate) alongside **4 Non-Imprinted Polymer (NIP) blank reference channels** (building on Oseyemi & Rezai Sept 2025 stand-alone MIP and UConn amine-functionalized nanocarbon architectures).
   - **Non-Circular Inverse Calibration & Sonde Fusion**: Subtracts NIP blank impedance ($\Delta R_{\text{ct,NIP}}$), fuses **Xylem YSI / WTW** sonde telemetry (pH, temperature, conductivity, turbidity), and applies Tikhonov-regularized 4×4 selectivity matrix inversion ($\hat{\mathbf{c}} = (\mathbf{S}^\top\mathbf{S} + \lambda\mathbf{I})^{-1}\mathbf{S}^\top\Delta\mathbf{R}_{\text{purified}}$) on an **ARM Cortex-M33 + AD5940** EIS node (in-silico multi-matrix stress test MAE ~4.5%).

2. **Software & AI Layer (Compatible with Xylem Vue powered by GoAigua — Smart Water Engine)**
   - **Hybrid Physics-Informed Neural Network (PINN) Spatiotemporal PDE Solver**: Assimilates 15-minute Mid-Bed ($z/L = 0.50$) telemetry alongside **Xylem Sensus / MJK** flow rate ($Q$) by optimizing physical Thomas parameters $\theta_{\text{phys}} = [k_{\text{Th}}, q_0]$ and a 2-layer neural residual network $\mathcal{N}_{\mathbf{W}}(\tilde{z}, \tilde{t})$ via analytical chain-rule backpropagation and Adam optimization over both data loss and 1D Advection-Sorption PDE collocation residuals (zero ground-truth parameter leakage):
     $$\mathcal{L}_{\text{PINN}}(\theta_{\text{phys}}, \mathbf{W}) = \left\|\hat{C}(z_{\text{mid}}, t) - C_{\text{mid}}^{\text{obs}}\right\|_2^2 + \lambda_{\text{PDE}} \left\|\frac{\partial \hat{C}}{\partial t} + u_{\text{MTZ}} \frac{\partial \hat{C}}{\partial \tilde{z}} - S_{\text{kin}}(\hat{C})\right\|_2^2$$
     where $\hat{C}(\tilde{z}, t) = C_{\text{Thomas}}(\tilde{z}, t; k_{\text{Th}}, q_0) + \mathcal{N}_{\mathbf{W}}(\tilde{z}, t)$ and $u_{\text{MTZ}} = \frac{Q C_0}{q_0 M}$.
   - **Chromatographic Roll-Up ($C_t / C_0 > 1.0$) & Literature Benchmarking**: Models multi-solute competitive displacement of short-chain C4 PFAS by long-chain PFOS/PFOA and humic NOM (benchmarked against published pilot-column data from *McCleaf et al., Water Research 2017* and *Park et al., EST 2020*), while continuously tracking both **Operating Days** and **Bed Volumes (BV)** against the binding **US EPA 4.0 ppt PFOA/PFOS MCL**, **EPA Hazard Index ($\text{HI} \le 1.0$)**, and **EU 2026 Sum-of-20 PFAS ($<100\text{ ng/L}$)**.
   - **Closed-Loop SCADA Control**: Automatically actuates lead-lag vessel switchover via PLC before effluent reaches 4.0 ppt, schedules **Evoqua** just-in-time media regeneration, or dispatches **Xylem MitiGATOR™** mobile treatment units during emergency AFFF surges.

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

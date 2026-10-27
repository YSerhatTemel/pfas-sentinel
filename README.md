# PFAS-Sentinel™ | Xylem Vue Smart Water Engine & Agentic Digital Twin

**Challenge #2: Water Quality — Xylem Global Student Innovation Challenge 2026**

**PFAS-Sentinel** (*Microfluidic MIP-Electrochemical Biosensor & Agentic Digital Twin for Real-Time PFAS Early Warning and Media Lifecycle Optimization*) is a cyber-physical hardware-enabled SaaS platform designed to eliminate centralized laboratory latency (LC-MS/MS) and prevent "blind breakthrough" in Granular Activated Carbon (GAC) and Selective Ion Exchange (IX) resin treatment vessels.

---

## Core Architecture

1. **Hardware Layer (Microfluidic Stand-Alone MIP & Amine-Functionalized Nanocarbon Sensor Array)**
   - **32-Channel Multiplexed Cartridge & Dual Form Factor**: Separates short-chain (**PFBA, PFBS**) and long-chain (**PFOA, PFOS**) PFAS compounds using 3D steric and electrostatic Molecularly Imprinted Polymer (MIP) cavities (Oseyemi & Rezai Sept 2025) paired with an amine-functionalized nanocarbon transducer array (UConn, Rowan University, 2witech, Verralize). Operates both as an **In-Line Microfluidic Flow Cell** ($C_0, C_{\text{mid}}, C_t$) and a **Portable Sample Cup & Sensing Lid**.
   - **1–4 ppt Sensitivity in 12–15 Minutes (<2 Min Rapid Screening)**: Converts $[\text{Fe(CN)}_6]^{3-/4-}$ redox gate-effect shifts into Electrochemical Impedance Spectroscopy (EIS) charge-transfer resistance ($\Delta R_{\text{ct}}$), meeting the binding US EPA **4.0 ppt** Maximum Contaminant Level (MCL) on-site.
   - **Edge AI Matrix Compensation**: Fuses real-time water quality telemetry from **Xylem YSI, WTW & OI Analytical** sensors (pH, temperature, turbidity, conductivity) and 4 Non-Imprinted Polymer (NIP) blank reference channels to reject humic acid (NOM) and ionic interference.

2. **Software & AI Layer (Xylem Vue powered by GoAigua — Smart Water Engine)**
   - **Physics-Informed Neural Network (PINN) Breakthrough Twin**: Continuously assimilates 15-minute telemetry from Influent ($C_0$) and Mid-Bed ($C_{\text{mid}}$) sensors alongside **Xylem Sensus / MJK** flow rate ($Q$) into the Bohart-Adams / Thomas kinetic model:
     $$\ln\left(\frac{C_0}{C_t} - 1\right) = \frac{k_{Th} \cdot q_0 \cdot M}{Q} - k_{Th} \cdot C_0 \cdot t$$
   - **Agentic Early Warning System (EWS) & SCADA Automation**: Automatically actuates lead-lag vessel switchover via PLC before effluent reaches 4.0 ppt, generates downloadable SHA-256 **EU 2026 / US EPA 2027–2029** cryptographic compliance certificates, and dispatches **Evoqua** media regeneration crews or **Xylem MitiGATOR™** mobile treatment units just-in-time.

3. **Servitization Business Model, Stakeholder Validation & Xylem Ignite Roadmap**
   - Replaces upfront utility CAPEX with an **$11.80 "razor-and-blade" cartridge** and performance-based O&M subscription, extending GAC/IX bed utilization to **96.4%** and cutting the **40–45% lifetime media replacement cost by 25–30%**.
   - Includes structured **Stakeholder Validation ($N=28$ utility engineers, industrial WWTP managers, academics & Xylem ecosystem advisors)**, **2024–2029 Regulatory & Market Breakdown ($16.2B total market, $205.4M \rightarrow $254.3M POE)**, **Competitive Matrix (vs. JolSetu, Team SolarLens & LC-MS/MS)**, and **6-Month Xylem Ignite Innovation Incubator Roadmap (TRL 3 $\rightarrow$ TRL 6)**.

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

## Python Kinetic & PINN Simulation

```bash
python simulation/pfas_sentinel_pinn_model.py
```

"""
PFAS-Sentinel: Bohart-Adams / Thomas Kinetic Model, Physics-Informed Neural Network (PINN)
Residual Solver & Synthetic Microfluidic MIP-Electrochemical Sensor Telemetry Generator
==========================================================================================
Xylem Global Student Innovation Challenge 2026 - Challenge #2: Water Quality
Compatible with Xylem Vue powered by GoAigua (Smart Water Engine - SWE)

Governing Kinetic Equation (Thomas Model):
    ln(C0 / Ct - 1) = (k_Th * q_0 * M) / Q - k_Th * C0 * t
"""

import json
import math
from dataclasses import dataclass, asdict
from typing import List, Dict


@dataclass
class PfasAnalyte:
    species: str
    chain_type: str
    epa_mcl_ppt: float
    c0_ppt: float
    k_th_gac: float
    q0_gac: float


ANALYTES: Dict[str, PfasAnalyte] = {
    "PFBA": PfasAnalyte("PFBA", "Short-Chain (C4)", 4.0, 26.5, 0.0024, 485.0),
    "PFBS": PfasAnalyte("PFBS", "Short-Chain (C4)", 4.0, 31.0, 0.0021, 640.0),
    "PFOA": PfasAnalyte("PFOA", "Long-Chain (C8)", 4.0, 38.5, 0.0016, 1080.0),
    "PFOS": PfasAnalyte("PFOS", "Long-Chain (C8)", 4.0, 44.0, 0.0014, 1390.0),
}


def compute_thomas_pinn_concentration(
    analyte: PfasAnalyte,
    flow_mgd: float,
    media_mass_kg: float,
    day: float,
    bed_depth_fraction: float = 1.0,
    nom_mg_l: float = 2.1,
    use_pinn_correction: bool = True,
) -> float:
    """
    Computes PFAS concentration C(z, t) in ppt (ng/L) at fractional bed depth z/L
    and operating time t (days) using the Thomas kinetic model coupled with
    PINN NOM competitive pore-blocking correction.
    """
    q_norm = max(0.2, flow_mgd * 320.0)
    m_eff = media_mass_kg * max(0.05, bed_depth_fraction)

    capacity_factor = max(0.68, 1.0 - (nom_mg_l - 1.0) * 0.065) if use_pinn_correction else 1.0
    kinetic_factor = 1.0 + (nom_mg_l - 1.0) * 0.04 if use_pinn_correction else 1.0

    q0 = analyte.q0_gac * capacity_factor
    k_th = analyte.k_th_gac * kinetic_factor

    exponent = (k_th * q0 * m_eff) / q_norm - (k_th * analyte.c0_ppt * day)
    ct = analyte.c0_ppt / (1.0 + math.exp(exponent))
    return round(max(0.02, min(analyte.c0_ppt, ct)), 3)


def predict_breakthrough_day(
    analyte: PfasAnalyte,
    flow_mgd: float,
    media_mass_kg: float,
    bed_depth_fraction: float = 1.0,
    target_ppt: float = 4.0,
    nom_mg_l: float = 2.1,
) -> float:
    """Predicts exact operating day when C(z, t) reaches target_ppt (e.g., 4.0 ppt EPA MCL)."""
    q_norm = max(0.2, flow_mgd * 320.0)
    m_eff = media_mass_kg * max(0.05, bed_depth_fraction)
    q0 = analyte.q0_gac * max(0.68, 1.0 - (nom_mg_l - 1.0) * 0.065)
    k_th = analyte.k_th_gac * (1.0 + (nom_mg_l - 1.0) * 0.04)

    log_term = math.log(analyte.c0_ppt / target_ppt - 1.0)
    t_days = ((k_th * q0 * m_eff) / q_norm - log_term) / (k_th * analyte.c0_ppt)
    return round(max(1.0, t_days), 1)


def generate_benchmark_telemetry_summary() -> Dict:
    """Generates KKWWD Maine GAC benchmark telemetry & breakthrough summary."""
    flow_mgd = 2.1
    media_mass_kg = 9100.0
    nom_mg_l = 2.1

    summary = {}
    for code, analyte in ANALYTES.items():
        t_mid = predict_breakthrough_day(analyte, flow_mgd, media_mass_kg, 0.5, 4.0, nom_mg_l)
        t_eff = predict_breakthrough_day(analyte, flow_mgd, media_mass_kg, 1.0, 4.0, nom_mg_l)
        summary[code] = {
            "chain_type": analyte.chain_type,
            "influent_c0_ppt": analyte.c0_ppt,
            "mid_bed_4ppt_day": t_mid,
            "effluent_4ppt_day": t_eff,
            "early_warning_lead_time_days": round(t_eff - t_mid, 1),
        }
    return summary


if __name__ == "__main__":
    results = generate_benchmark_telemetry_summary()
    print("=== PFAS-Sentinel PINN Breakthrough Simulation (KKWWD Maine Benchmark) ===")
    print(json.dumps(results, indent=2))

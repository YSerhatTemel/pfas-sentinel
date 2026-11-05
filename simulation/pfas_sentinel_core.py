"""
PFAS-Sentinel reference core (Python 3.8+, standard library only).

Line-for-line mirror of the app engine so that the README numbers and the live demo agree:
  - src/data/rng.ts         -> mulberry32, gaussian, seed_from, hundredths
  - src/data/linalg.ts      -> small dense linear algebra
  - src/data/hybridTwin.ts  -> testbench ("virtual plant") and breakthrough twin
  - src/data/sensorModel.ts -> 4-channel-group MIP sensor, calibration and blind estimator

The cross-language test (src/data/__tests__/crossLanguage.test.ts) compares the app against
simulation/reference_outputs.json written by simulation/validation_report.py.
"""

import math
from typing import Callable, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------------------------
# rng.ts
# ---------------------------------------------------------------------------------------------
M32 = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    return (a * b) & M32


class Mulberry32:
    """Bit-exact port of mulberry32 (see src/data/rng.ts)."""

    def __init__(self, seed: int):
        self.a = seed & M32

    def __call__(self) -> float:
        self.a = (self.a + 0x6D2B79F5) & M32
        t = self.a
        t = _imul(t ^ (t >> 15), t | 1)
        t = (t ^ ((t + _imul(t ^ (t >> 7), t | 61)) & M32)) & M32
        return ((t ^ (t >> 14)) & M32) / 4294967296.0


def gaussian(rand: Callable[[], float]) -> float:
    u1 = max(rand(), 1e-12)
    u2 = rand()
    return math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)


SEED_PRIMES = [7919, 104729, 1299709, 15485863, 32452843, 49979687, 86028121, 122949823]


def seed_from(*parts: float) -> int:
    acc = 0
    for i, p in enumerate(parts):
        acc = (acc + (int(math.floor(abs(p))) % 1000003) * SEED_PRIMES[i % len(SEED_PRIMES)]) % 2147483647
    return acc


def hundredths(x: float) -> int:
    return int(math.floor(x * 100 + 0.5))


def round1(x: float) -> float:
    return math.floor(x * 10 + 0.5) / 10


def round2(x: float) -> float:
    return math.floor(x * 100 + 0.5) / 100


def round3(x: float) -> float:
    return math.floor(x * 1000 + 0.5) / 1000


# ---------------------------------------------------------------------------------------------
# linalg.ts
# ---------------------------------------------------------------------------------------------
Matrix = List[List[float]]


def transpose(a: Matrix) -> Matrix:
    return [[a[i][j] for i in range(len(a))] for j in range(len(a[0]))]


def mat_mul(a: Matrix, b: Matrix) -> Matrix:
    return [[sum(a[i][k] * b[k][j] for k in range(len(b))) for j in range(len(b[0]))] for i in range(len(a))]


def mat_vec(a: Matrix, x: List[float]) -> List[float]:
    return [sum(v * x[k] for k, v in enumerate(row)) for row in a]


def solve_linear_system(a: Matrix, b: List[float]) -> List[float]:
    n = len(b)
    aug = [list(row) + [b[i]] for i, row in enumerate(a)]
    for col in range(n):
        pivot = col
        for r in range(col + 1, n):
            if abs(aug[r][col]) > abs(aug[pivot][col]):
                pivot = r
        if abs(aug[pivot][col]) < 1e-14:
            raise ValueError("Singular matrix")
        aug[col], aug[pivot] = aug[pivot], aug[col]
        div = aug[col][col]
        for j in range(col, n + 1):
            aug[col][j] /= div
        for r in range(n):
            if r == col:
                continue
            f = aug[r][col]
            if f == 0:
                continue
            for j in range(col, n + 1):
                aug[r][j] -= f * aug[col][j]
    return [row[n] for row in aug]


def least_squares(x: Matrix, y: List[float], ridge: float = 0.0) -> List[float]:
    xt = transpose(x)
    xtx = mat_mul(xt, x)
    for i in range(len(xtx)):
        xtx[i][i] += ridge
    return solve_linear_system(xtx, mat_vec(xt, y))


def determinant(a: Matrix) -> float:
    n = len(a)
    m = [list(row) for row in a]
    det = 1.0
    for col in range(n):
        pivot = col
        for r in range(col + 1, n):
            if abs(m[r][col]) > abs(m[pivot][col]):
                pivot = r
        if m[pivot][col] == 0:
            return 0.0
        if pivot != col:
            m[col], m[pivot] = m[pivot], m[col]
            det = -det
        det *= m[col][col]
        for r in range(col + 1, n):
            f = m[r][col] / m[col][col]
            for j in range(col, n):
                m[r][j] -= f * m[col][j]
    return det


def symmetric_eigenvalues(a: Matrix, sweeps: int = 60) -> List[float]:
    n = len(a)
    m = [list(row) for row in a]
    for _ in range(sweeps):
        off = sum(m[p][q] * m[p][q] for p in range(n) for q in range(p + 1, n))
        if off < 1e-24:
            break
        for p in range(n):
            for q in range(p + 1, n):
                if abs(m[p][q]) < 1e-300:
                    continue
                theta = (m[q][q] - m[p][p]) / (2 * m[p][q])
                sign = 1.0 if (theta if theta != 0 else 1.0) > 0 else -1.0
                t = sign / (abs(theta) + math.sqrt(theta * theta + 1))
                c = 1 / math.sqrt(t * t + 1)
                sn = t * c
                for k in range(n):
                    mkp, mkq = m[k][p], m[k][q]
                    m[k][p] = c * mkp - sn * mkq
                    m[k][q] = sn * mkp + c * mkq
                for k in range(n):
                    mpk, mqk = m[p][k], m[q][k]
                    m[p][k] = c * mpk - sn * mqk
                    m[q][k] = sn * mpk + c * mqk
    return sorted(m[i][i] for i in range(n))


def condition_number2(a: Matrix) -> float:
    eig = symmetric_eigenvalues(mat_mul(transpose(a), a))
    return math.sqrt(eig[-1] / max(eig[0], 1e-300))


# ---------------------------------------------------------------------------------------------
# species.ts (kinetic subset)
# ---------------------------------------------------------------------------------------------
SPECIES_ORDER = ["PFBA", "PFBS", "PFOA", "PFOS"]
MEDIA_ORDER = ["GAC", "IX", "HYBRID"]

SPECIES_KINETICS: Dict[str, Dict[str, float]] = {
    "PFBA": {"kTh_GAC": 0.0024, "q0_GAC": 485.0, "kTh_IX": 0.0021, "q0_IX": 780.0, "rollupGAC": 0.28, "rollupIX": 0.16},
    "PFBS": {"kTh_GAC": 0.0021, "q0_GAC": 640.0, "kTh_IX": 0.0019, "q0_IX": 1120.0, "rollupGAC": 0.19, "rollupIX": 0.09},
    "PFOA": {"kTh_GAC": 0.0016, "q0_GAC": 1080.0, "kTh_IX": 0.0015, "q0_IX": 1450.0, "rollupGAC": 0.05, "rollupIX": 0.03},
    "PFOS": {"kTh_GAC": 0.0014, "q0_GAC": 1390.0, "kTh_IX": 0.0013, "q0_IX": 1820.0, "rollupGAC": 0.0, "rollupIX": 0.0},
}

# ---------------------------------------------------------------------------------------------
# hybridTwin.ts
# ---------------------------------------------------------------------------------------------
T_REF_DAYS = 400.0
FLOW_NORM_FACTOR = 320.0
OBSERVATION_DAYS = [30, 60, 90, 115, 135, 155, 180, 210]
TRAIN_DAYS = [30, 60, 90, 115, 135]
LAST_OBSERVATION_DAY = 210
OPERATIONAL_DAYS = [15 * (i + 1) for i in range(80)]
MID_BED_Z = 0.5
TARGET_PPT = 4.0
TRUTH_SHAPE_NU = 0.7
OBS_NOISE = {"relative": 0.15, "absolutePpt": 0.2, "floorPpt": 0.02}
TRUTH_FOULING_EXPONENT = {
    "PFBA": {"capacity": 1.2, "kinetic": 1.1},
    "PFBS": {"capacity": 1.1, "kinetic": 1.0},
    "PFOA": {"capacity": 0.95, "kinetic": 0.95},
    "PFOS": {"capacity": 0.85, "kinetic": 0.9},
}
COLLOCATION_POINTS = [(z, t) for z in (0.5, 1.0) for t in (60, 120, 180, 240, 300, 360)]

TWIN_CONFIG: Dict[str, float] = {
    "epochs": 250,
    "lrPhys": 0.02,
    "lrNn": 0.02,
    "beta1": 0.9,
    "beta2": 0.999,
    "eps": 1e-8,
    "lambdaAdv": 0.0,
    "lambdaKin": 0.0,
    "lambdaPrior": 0.008,
    "lambdaWeight": 0.001,
    "phiBound": math.log(1.6),
    "tChar": 120.0,
    "dt": 0.1,
    "dz": 0.002,
    "priorSigma": 0.25,
    "noiseFloor": 0.01,
    "uncertaintyZ": 1.96,
    "discrepancyPerDay": 0.05,
    "useNetwork": False,
    "networkUsesSpaceTime": True,
    "fitPhysics": True,
}
EXPERIMENTAL_HYBRID_CONFIG = {"useNetwork": True, "lambdaAdv": 0.2, "lambdaKin": 0.2}

N_HIDDEN = 4
N_PARAMS = 2 + N_HIDDEN * 3 + N_HIDDEN + N_HIDDEN + 1
INIT_W1 = [[0.06, -0.04, 0.08], [-0.05, 0.07, -0.06], [0.04, 0.06, 0.05], [-0.04, -0.06, 0.07]]
INIT_W2 = [0.04, -0.03, 0.03, -0.04]


def clamp(x: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, x))


def flow_norm(flow_mgd: float) -> float:
    return max(0.2, flow_mgd * FLOW_NORM_FACTOR)


def prior_kinetics(sp: str, media: str) -> Dict[str, float]:
    k = SPECIES_KINETICS[sp]
    if media == "IX":
        return {"kTh": k["kTh_IX"], "q0": k["q0_IX"], "rollup": k["rollupIX"]}
    if media == "HYBRID":
        return {
            "kTh": (k["kTh_GAC"] + k["kTh_IX"]) * 0.52,
            "q0": (k["q0_GAC"] + k["q0_IX"]) * 0.62,
            "rollup": k["rollupGAC"] * 0.45,
        }
    return {"kTh": k["kTh_GAC"], "q0": k["q0_GAC"], "rollup": k["rollupGAC"]}


def nom_fouling_factors(nom: float, sp: str) -> Dict[str, float]:
    capacity = max(0.62, 1 - (nom - 1) * 0.065 - math.pow(max(0.0, nom - 2), 1.35) * 0.012)
    kinetic = 1 + (nom - 1) * 0.042
    e = TRUTH_FOULING_EXPONENT[sp]
    return {"capacity": math.pow(capacity, e["capacity"]), "kinetic": math.pow(kinetic, e["kinetic"])}


def truth_concentration(plant: Dict, sp: str, z: float, t: float) -> float:
    c0 = plant["C0"][sp]
    prior = prior_kinetics(sp, plant["mediaType"])
    foul = nom_fouling_factors(plant["nomMgL"], sp)
    k = prior["kTh"] * foul["kinetic"]
    q = prior["q0"] * foul["capacity"]
    qn = flow_norm(plant["flowRateMGD"])
    xi = clamp((k * q * plant["mediaMassKg"] * z) / qn - k * c0 * t, -35, 35)
    base = c0 * math.pow(1 + TRUTH_SHAPE_NU * math.exp(xi), -1 / TRUTH_SHAPE_NU)
    bump = 0.0
    if plant["includeRollup"] and prior["rollup"] > 0 and t > 1 and base / c0 > 0.35:
        tau50 = (q * plant["mediaMassKg"] * z) / (qn * max(1.0, c0))
        width = max(2.5, tau50 * 0.18)
        wave = math.exp(-math.pow((t - tau50 * 1.16) / width, 2))
        gate = 1 / (1 + math.exp(-clamp((t - tau50 * 1.02) / max(1.2, tau50 * 0.04), -30, 30)))
        depth_scale = 1.0 if z >= 0.85 else 0.25 * z
        bump = c0 * prior["rollup"] * depth_scale * (0.85 + 0.12 * plant["nomMgL"]) * wave * gate
    return max(0.0, min(c0 * 1.42, base + bump))


def static_prior_concentration(plant: Dict, sp: str, z: float, t: float) -> float:
    c0 = plant["C0"][sp]
    prior = prior_kinetics(sp, plant["mediaType"])
    qn = flow_norm(plant["flowRateMGD"])
    xi = clamp((prior["kTh"] * prior["q0"] * plant["mediaMassKg"] * z) / qn - prior["kTh"] * c0 * t, -35, 35)
    return c0 / (1 + math.exp(xi))


def make_context(plant: Dict, sp: str) -> Dict[str, float]:
    prior = prior_kinetics(sp, plant["mediaType"])
    return {"C0": plant["C0"][sp], "qn": flow_norm(plant["flowRateMGD"]), "M": plant["mediaMassKg"], "k0": prior["kTh"], "q0": prior["q0"]}


def initial_params(use_network: bool = True, network_uses_space_time: bool = True) -> List[float]:
    theta = [0.0] * N_PARAMS
    for j in range(N_HIDDEN):
        for k in range(3):
            theta[2 + 3 * j + k] = INIT_W1[j][k] if (network_uses_space_time or k == 2) else 0.0
        theta[18 + j] = INIT_W2[j] if use_network else 0.0
    return theta


def eval_twin(ctx: Dict[str, float], theta: List[float], z: float, t: float, grad: Optional[List[float]] = None) -> float:
    k = ctx["k0"] * math.exp(theta[0])
    q = ctx["q0"] * math.exp(theta[1])
    cap = (k * q * ctx["M"] * z) / ctx["qn"]
    xi_raw = cap - k * ctx["C0"] * t
    xi = clamp(xi_raw, -35, 35)
    sig = 1 / (1 + math.exp(xi))
    g = sig * (1 - sig)
    x = (z, t / T_REF_DAYS, sig)
    h = []
    dh = []
    n = theta[22]
    for j in range(N_HIDDEN):
        a = theta[14 + j] + theta[2 + 3 * j] * x[0] + theta[3 + 3 * j] * x[1] + theta[4 + 3 * j] * x[2]
        hj = math.tanh(clamp(a, -15, 15))
        h.append(hj)
        dh.append(1 - hj * hj if abs(a) < 15 else 0.0)
        n += theta[18 + j] * hj
    c = ctx["C0"] * (sig + g * n)
    if grad is not None:
        dn_dsig = 0.0
        for j in range(N_HIDDEN):
            dn_dsig += theta[18 + j] * dh[j] * theta[4 + 3 * j]
        dc_dxi = ctx["C0"] * (-g - n * g * (1 - 2 * sig) - g * g * dn_dsig) if abs(xi_raw) < 35 else 0.0
        grad[0] = dc_dxi * xi_raw
        grad[1] = dc_dxi * cap
        for j in range(N_HIDDEN):
            gj = ctx["C0"] * g * theta[18 + j] * dh[j]
            grad[2 + 3 * j] = gj * x[0]
            grad[3 + 3 * j] = gj * x[1]
            grad[4 + 3 * j] = gj * x[2]
            grad[14 + j] = gj
            grad[18 + j] = ctx["C0"] * g * h[j]
        grad[22] = ctx["C0"] * g
    return c


def loss_and_grad(plant: Dict, species: List[str], theta: List[float], obs: List[Dict], cfg: Dict, grad: Optional[List[float]] = None,
                  contexts: Optional[Dict[str, Dict[str, float]]] = None) -> Dict[str, float]:
    """`contexts` (Python-only, used by external_validation.py) replaces the built-in species priors with
    caller-supplied ones; the default path is identical to hybridTwin.ts."""
    P = N_PARAMS
    if grad is not None:
        for p in range(P):
            grad[p] = 0.0
    ctxs = contexts if contexts is not None else {sp: make_context(plant, sp) for sp in SPECIES_ORDER}
    gi = [0.0] * P
    data = 0.0
    for o in obs:
        ctx = ctxs[o["sp"]]
        c = eval_twin(ctx, theta, o["z"], o["t"], gi if grad is not None else None)
        r = (c - o["y"]) / ctx["C0"]
        data += (r * r) / len(obs)
        if grad is not None:
            f = (2 * r) / (len(obs) * ctx["C0"])
            for p in range(P):
                grad[p] += f * gi[p]

    adv = 0.0
    kin = 0.0
    if cfg["lambdaAdv"] > 0 or cfg["lambdaKin"] > 0:
        m = len(COLLOCATION_POINTS) * len(species)
        want = grad is not None
        g_tp = [0.0] * P
        g_tm = [0.0] * P
        g_zp = [0.0] * P
        g_zm = [0.0] * P
        g_c = [0.0] * P
        for sp in species:
            ctx = ctxs[sp]
            k = ctx["k0"] * math.exp(theta[0])
            q = ctx["q0"] * math.exp(theta[1])
            u = (ctx["qn"] * ctx["C0"]) / (q * ctx["M"])
            s = cfg["tChar"] / ctx["C0"]
            for (zc, tc) in COLLOCATION_POINTS:
                zp = zc + cfg["dz"]
                zm = max(0.0, zc - cfg["dz"])
                c_tp = eval_twin(ctx, theta, zc, tc + cfg["dt"], g_tp if want else None)
                c_tm = eval_twin(ctx, theta, zc, tc - cfg["dt"], g_tm if want else None)
                c_zp = eval_twin(ctx, theta, zp, tc, g_zp if want else None)
                c_zm = eval_twin(ctx, theta, zm, tc, g_zm if want else None)
                c_c = eval_twin(ctx, theta, zc, tc, g_c if want else None)
                dcdt = (c_tp - c_tm) / (2 * cfg["dt"])
                dcdz = (c_zp - c_zm) / (zp - zm)
                r_adv = s * (dcdt + u * dcdz)
                rho = c_c / ctx["C0"]
                kin_term = k * ctx["C0"] * ctx["C0"] * rho * (1 - rho)
                r_kin = s * (dcdt - kin_term)
                adv += (r_adv * r_adv) / m
                kin += (r_kin * r_kin) / m
                if want:
                    for p in range(P):
                        d_dt = (g_tp[p] - g_tm[p]) / (2 * cfg["dt"])
                        d_dz = (g_zp[p] - g_zm[p]) / (zp - zm)
                        d_adv = s * (d_dt + u * d_dz)
                        if p == 1:
                            d_adv -= s * u * dcdz
                        d_rho = g_c[p] / ctx["C0"]
                        d_kin = s * (d_dt - k * ctx["C0"] * ctx["C0"] * (1 - 2 * rho) * d_rho)
                        if p == 0:
                            d_kin -= s * kin_term
                        grad[p] += (cfg["lambdaAdv"] * 2 * r_adv * d_adv + cfg["lambdaKin"] * 2 * r_kin * d_kin) / m

    prior = cfg["lambdaPrior"] * (theta[0] * theta[0] + theta[1] * theta[1])
    weight = sum(theta[p] * theta[p] for p in range(2, 14)) + sum(theta[p] * theta[p] for p in range(18, 22))
    weight *= cfg["lambdaWeight"]
    if grad is not None:
        grad[0] += 2 * cfg["lambdaPrior"] * theta[0]
        grad[1] += 2 * cfg["lambdaPrior"] * theta[1]
        for p in list(range(2, 14)) + list(range(18, 22)):
            grad[p] += 2 * cfg["lambdaWeight"] * theta[p]
    total = data + cfg["lambdaAdv"] * adv + cfg["lambdaKin"] * kin + prior + weight
    return {"total": total, "data": data, "adv": adv, "kin": kin, "prior": prior, "weight": weight}


def pde_residual_rms(plant: Dict, theta: List[float]) -> Dict[str, float]:
    cfg = dict(TWIN_CONFIG)
    cfg.update({"lambdaAdv": 1.0, "lambdaKin": 1.0})
    lb = loss_and_grad(plant, SPECIES_ORDER, theta, [], cfg)
    return {"adv": math.sqrt(lb["adv"]), "kin": math.sqrt(lb["kin"])}


def observation_seed(plant: Dict, replicate: int) -> int:
    c0 = plant["C0"]
    return seed_from(
        MEDIA_ORDER.index(plant["mediaType"]) + 1,
        hundredths(plant["flowRateMGD"]),
        int(math.floor(plant["mediaMassKg"] + 0.5)),
        hundredths(plant["nomMgL"]),
        2 if plant["includeRollup"] else 1,
        replicate + 1,
        hundredths(c0["PFBA"]) + 3 * hundredths(c0["PFBS"]),
        hundredths(c0["PFOA"]) + 3 * hundredths(c0["PFOS"]),
    )


def generate_observations(plant: Dict, replicate: int = 0, days: Optional[List[int]] = None, train_until_day: Optional[float] = None) -> Dict[str, List[Dict]]:
    days = OBSERVATION_DAYS if days is None else days
    train_until_day = TRAIN_DAYS[-1] if train_until_day is None else train_until_day
    rand = Mulberry32(observation_seed(plant, replicate))

    def noisy(c: float) -> float:
        return max(OBS_NOISE["floorPpt"], c * (1 + OBS_NOISE["relative"] * gaussian(rand)) + OBS_NOISE["absolutePpt"] * gaussian(rand))

    out: Dict[str, List[Dict]] = {}
    for sp in SPECIES_ORDER:
        pts = []
        for day in days:
            truth_mid = truth_concentration(plant, sp, MID_BED_Z, day)
            truth_eff = truth_concentration(plant, sp, 1.0, day)
            pts.append({
                "day": day,
                "split": "TRAIN" if day <= train_until_day else "TEST",
                "observedMidBedPpt": noisy(truth_mid),
                "observedEffluentPpt": noisy(truth_eff),
                "truthMidBedPpt": truth_mid,
                "truthEffluentPpt": truth_eff,
            })
        out[sp] = pts
    return out


def crossing_day(fn: Callable[[float], float], target: float, t_max: int = 1500) -> float:
    if fn(0) >= target:
        return 0.0
    for t in range(1, t_max + 1):
        if fn(t) >= target:
            lo = t - 1.0
            hi = float(t)
            for _ in range(40):
                mid = 0.5 * (lo + hi)
                if fn(mid) >= target:
                    hi = mid
                else:
                    lo = mid
            return hi
    return float(t_max)


def train_twin(plant: Dict, species: List[str], obs: List[Dict], cfg: Dict, contexts: Optional[Dict[str, Dict[str, float]]] = None) -> Dict:
    theta = initial_params(cfg["useNetwork"], cfg["networkUsesSpaceTime"])
    P = N_PARAMS
    g = [0.0] * P
    m1 = [0.0] * P
    m2 = [0.0] * P
    history = []
    initial = loss_and_grad(plant, species, theta, obs, cfg, None, contexts)
    if not obs:
        return {"theta": theta, "history": history, "initial": initial, "final": initial}
    for ep in range(1, int(cfg["epochs"]) + 1):
        lb = loss_and_grad(plant, species, theta, obs, cfg, g, contexts)
        if ep == 1 or ep % 10 == 0:
            history.append({"epoch": ep, "total": lb["total"], "data": lb["data"], "adv": lb["adv"], "kin": lb["kin"]})
        for p in range(P):
            space_time_weight = 2 <= p < 14 and (p - 2) % 3 != 2
            trainable = cfg["fitPhysics"] if p < 2 else (cfg["useNetwork"] and (cfg["networkUsesSpaceTime"] or not space_time_weight))
            if not trainable:
                continue
            m1[p] = cfg["beta1"] * m1[p] + (1 - cfg["beta1"]) * g[p]
            m2[p] = cfg["beta2"] * m2[p] + (1 - cfg["beta2"]) * g[p] * g[p]
            mh = m1[p] / (1 - math.pow(cfg["beta1"], ep))
            vh = m2[p] / (1 - math.pow(cfg["beta2"], ep))
            theta[p] -= ((cfg["lrPhys"] if p < 2 else cfg["lrNn"]) * mh) / (math.sqrt(vh) + cfg["eps"])
        theta[0] = clamp(theta[0], -cfg["phiBound"], cfg["phiBound"])
        theta[1] = clamp(theta[1], -cfg["phiBound"], cfg["phiBound"])
    final = loss_and_grad(plant, species, theta, obs, cfg, None, contexts)
    return {"theta": theta, "history": history, "initial": initial, "final": final}


def breach_uncertainty(plant: Dict, theta: List[float], obs: List[Dict], cfg: Dict, sp: str, z: float = 1.0, target: float = TARGET_PPT,
                       contexts: Optional[Dict[str, Dict[str, float]]] = None) -> Dict[str, float]:
    def context(s: str) -> Dict[str, float]:
        return contexts[s] if contexts is not None else make_context(plant, s)

    gi = [0.0] * N_PARAMS
    ssr = h00 = h01 = h11 = 0.0
    last_obs_day = 0.0
    for o in obs:
        ctx_o = context(o["sp"])
        c = eval_twin(ctx_o, theta, o["z"], o["t"], gi)
        r = (c - o["y"]) / ctx_o["C0"]
        ssr += r * r
        j0 = gi[0] / ctx_o["C0"]
        j1 = gi[1] / ctx_o["C0"]
        h00 += j0 * j0
        h01 += j0 * j1
        h11 += j1 * j1
        last_obs_day = max(last_obs_day, o["t"])
    s2 = max(ssr / max(1, len(obs) - 2), cfg["noiseFloor"] * cfg["noiseFloor"])
    prec = 1 / (cfg["priorSigma"] * cfg["priorSigma"])
    a = h00 / s2 + prec
    b = h01 / s2
    d = h11 / s2 + prec
    det = a * d - b * b
    cov = [[d / det, -b / det], [-b / det, a / det]]
    ctx = context(sp)
    step = 1e-3
    dT = []
    for i in (0, 1):
        plus = list(theta)
        minus = list(theta)
        plus[i] += step
        minus[i] -= step
        tp = crossing_day(lambda t: eval_twin(ctx, plus, z, t), target)
        tm = crossing_day(lambda t: eval_twin(ctx, minus, z, t), target)
        dT.append((tp - tm) / (2 * step))
    variance = dT[0] * dT[0] * cov[0][0] + 2 * dT[0] * dT[1] * cov[0][1] + dT[1] * dT[1] * cov[1][1]
    parametric = math.sqrt(max(0.0, variance))
    forecast = crossing_day(lambda t: eval_twin(ctx, theta, z, t), target)
    model_form = cfg["discrepancyPerDay"] * max(0.0, forecast - last_obs_day)
    sigma = math.sqrt(parametric * parametric + model_form * model_form)
    return {"sigmaDays": sigma, "bandDays": cfg["uncertaintyZ"] * sigma + 0.5, "parametricSigmaDays": parametric, "modelFormSigmaDays": model_form}


def _rmse(errors: List[float]) -> float:
    return math.sqrt(sum(e * e for e in errors) / max(1, len(errors)))


def fit_plant_twin(plant: Dict, replicate: int = 0, config: Optional[Dict] = None, train_on: Optional[List[str]] = None, as_of_day: Optional[float] = None) -> Dict:
    cfg = dict(TWIN_CONFIG)
    if config:
        cfg.update(config)
    train_on = list(SPECIES_ORDER) if train_on is None else train_on
    operational = as_of_day is not None
    if operational:
        observations = generate_observations(plant, replicate, OPERATIONAL_DAYS, as_of_day)
    else:
        observations = generate_observations(plant, replicate)
    train_obs = [
        {"sp": sp, "z": MID_BED_Z, "t": p["day"], "y": p["observedMidBedPpt"]}
        for sp in train_on
        for p in observations[sp]
        if p["split"] == "TRAIN"
    ]
    last_data_day = max([o["t"] for o in train_obs], default=0)
    tr = train_twin(plant, train_on, train_obs, cfg)
    theta = tr["theta"]
    zeros = [0.0] * N_PARAMS

    species: Dict[str, Dict] = {}
    obs_all: List[float] = []
    pred_all: List[float] = []
    for sp in SPECIES_ORDER:
        ctx = make_context(plant, sp)

        def twin_at(z: float, t: float, ctx=ctx) -> float:
            return max(0.0, eval_twin(ctx, theta, z, t))

        def static_at(z: float, t: float, ctx=ctx) -> float:
            return max(0.0, eval_twin(ctx, zeros, z, t))

        points = []
        for p in observations[sp]:
            q = dict(p)
            q["twinMidBedPpt"] = twin_at(MID_BED_Z, p["day"])
            q["twinEffluentPpt"] = twin_at(1.0, p["day"])
            q["staticMidBedPpt"] = static_at(MID_BED_Z, p["day"])
            q["staticEffluentPpt"] = static_at(1.0, p["day"])
            points.append(q)
            obs_all.extend([p["observedMidBedPpt"], p["observedEffluentPpt"]])
            pred_all.extend([q["twinMidBedPpt"], q["twinEffluentPpt"]])
        train = [p for p in points if p["split"] == "TRAIN"]
        test = [p for p in points if p["split"] == "TEST"]
        unc = breach_uncertainty(plant, theta, train_obs, cfg, sp)
        species[sp] = {
            "priorKth": ctx["k0"],
            "priorQ0": ctx["q0"],
            "learnedKth": ctx["k0"] * math.exp(theta[0]),
            "learnedQ0": ctx["q0"] * math.exp(theta[1]),
            "midBed4PptDay": crossing_day(lambda t: twin_at(MID_BED_Z, t), TARGET_PPT),
            "effluent4PptDay": crossing_day(lambda t: twin_at(1.0, t), TARGET_PPT),
            "staticEffluent4PptDay": crossing_day(lambda t: static_at(1.0, t), TARGET_PPT),
            "testbenchEffluent4PptDay": crossing_day(lambda t, sp=sp: truth_concentration(plant, sp, 1.0, t), TARGET_PPT),
            "uncertaintySigmaDays": unc["sigmaDays"],
            "uncertaintyBandDays": unc["bandDays"],
            "parametricSigmaDays": unc["parametricSigmaDays"],
            "modelFormSigmaDays": unc["modelFormSigmaDays"],
            "points": points,
            "trainRmsePpt": _rmse([p["twinMidBedPpt"] - p["observedMidBedPpt"] for p in train]),
            "testRmsePpt": _rmse([e for p in test for e in (p["twinMidBedPpt"] - p["observedMidBedPpt"], p["twinEffluentPpt"] - p["observedEffluentPpt"])]),
            "staticTestRmsePpt": _rmse([e for p in test for e in (p["staticMidBedPpt"] - p["observedMidBedPpt"], p["staticEffluentPpt"] - p["observedEffluentPpt"])]),
        }
    mean = sum(obs_all) / len(obs_all)
    ss_res = sum((v - pred_all[i]) ** 2 for i, v in enumerate(obs_all))
    ss_tot = sum((v - mean) ** 2 for v in obs_all)
    return {
        "plant": plant,
        "mode": "operational" if operational else "validation",
        "asOfDay": as_of_day,
        "lastDataDay": last_data_day,
        "trainedOn": train_on,
        "theta": theta,
        "config": cfg,
        "history": tr["history"],
        "initialLoss": tr["initial"],
        "finalLoss": tr["final"],
        "species": species,
        "r2All": 1 - ss_res / ss_tot if ss_tot > 1e-9 else 0.0,
        "rmseAll": _rmse([v - pred_all[i] for i, v in enumerate(obs_all)]),
    }


# ---------------------------------------------------------------------------------------------
# sensorModel.ts
# ---------------------------------------------------------------------------------------------
CROSS_SELECTIVITY = [
    [1.0, 0.14, 0.11, 0.04],
    [0.12, 1.0, 0.05, 0.13],
    [0.09, 0.04, 1.0, 0.15],
    [0.03, 0.11, 0.14, 1.0],
]
GROUP_SENSITIVITY_OHM = [59.0, 64.0, 72.0, 78.0]
GROUP_FOULING_COUPLING = [1.0, 1.05, 0.96, 1.03]
NIP_FOULING_COUPLING = 0.92
NIP_NONSPECIFIC_FRACTION = 0.0075
CHANNELS_PER_GROUP = 7
NIP_CHANNELS = 4
BASELINE_RCT_OHM = 400.0
CHANNEL_NOISE_OHM = 4.0
CHANNEL_GAIN_SPREAD = 0.03
SONDE_NOISE = {"tempC": 0.1, "pH": 0.02, "conductivityRel": 0.01, "turbidityRel": 0.03, "fdomRel": 0.05}
FDOM_QSU_PER_MG_L = 24.5
TIKHONOV_LAMBDA_REL = 1e-3
ACTIVATION_ENERGY_OVER_R = 2165.0
AMINE_PKA = 8.4
DEBYE_OFFSET_NM = 1.5
CALIBRATION_SEED = 20261105
STANDARD_LEVELS_PPT = [0.0, 2.0, 5.0, 10.0, 25.0, 50.0]
CALIBRATION_REPLICATES = 3
CALIBRATION_MATRICES = 48
SPIKE_PPT = 10.0
REFERENCE_MATRIX = {"tempC": 20.0, "pH": 7.0, "conductivityUsCm": 300.0, "turbidityNTU": 0.1, "nomMgL": 0.2, "cartridgeAgeDays": 0.0}
CALIBRATION_RANGES = {"t": (6, 26), "ph": (6.4, 8.3), "ec": (90, 700), "tu": (0.1, 2.5), "nom": (0.3, 4.5)}
BENCHMARK_RANGES = {"t": (4, 28), "ph": (6.2, 8.5), "ec": (80, 750), "tu": (0.05, 3.0), "nom": (0.2, 5.0)}
ESTIMATOR_METHODS = ["uncompensated", "nipOnly", "diagonal", "full"]


def debye_length_nm(conductivity: float) -> float:
    return 0.304 / math.sqrt(max(5e-4, conductivity * 1.6e-5))


def amine_protonation_fraction(ph: float) -> float:
    return 1 / (1 + math.pow(10, ph - AMINE_PKA))


def true_gain(m: Dict[str, float], opts: Optional[Dict] = None) -> float:
    opts = opts or {}
    g_t = math.exp(ACTIVATION_ENERGY_OVER_R * (1 / 293.15 - 1 / (m["tempC"] + 273.15)))
    g_p = amine_protonation_fraction(m["pH"]) / amine_protonation_fraction(7.0)
    lam = debye_length_nm(m["conductivityUsCm"])
    lam_ref = debye_length_nm(300)
    g_d = lam / (lam + DEBYE_OFFSET_NM) / (lam_ref / (lam_ref + DEBYE_OFFSET_NM))
    g_age = 1 - 0.004 * m["cartridgeAgeDays"]
    g_mode = (0.78 if opts.get("assayMode") == "screening" else 1.0) * (0.94 if opts.get("formFactor") == "sample-cup" else 1.0)
    return g_t * g_p * g_d * g_age * g_mode


def baseline_drift_ohm(m: Dict[str, float]) -> float:
    d_t = m["tempC"] - 20
    return -1.48 * d_t + 0.018 * d_t * d_t - 9.4 * (m["pH"] - 7) - 0.037 * (m["conductivityUsCm"] - 300)


def fouling_ohm(m: Dict[str, float]) -> float:
    return (6.4 * math.pow(m["nomMgL"], 1.12) * (1 + 0.08 * (7.2 - m["pH"])) + 4.7 * m["turbidityNTU"]) * (1 + 0.01 * m["cartridgeAgeDays"])


def _mean(v: List[float]) -> float:
    return sum(v) / len(v)


def _sample_sd(v: List[float]) -> float:
    m = _mean(v)
    return math.sqrt(sum((x - m) ** 2 for x in v) / max(1, len(v) - 1))


def simulate_sensor(mix: List[float], m: Dict[str, float], rand: Callable[[], float], opts: Optional[Dict] = None) -> Dict:
    """Forward simulator (hidden physics); `mix` is ppt in SPECIES_ORDER."""
    opts = opts or {}
    gain = true_gain(m, opts)
    x = [math.log1p(max(0.0, c)) for c in mix]
    specific = [GROUP_SENSITIVITY_OHM[g] * gain * sum(s * x[j] for j, s in enumerate(row)) for g, row in enumerate(CROSS_SELECTIVITY)]
    cross = [GROUP_SENSITIVITY_OHM[g] * gain * sum(s * x[j] for j, s in enumerate(row) if j != g) for g, row in enumerate(CROSS_SELECTIVITY)]
    drift = baseline_drift_ohm(m)
    foul = fouling_ohm(m)
    noise_sd = CHANNEL_NOISE_OHM * (1 + m["cartridgeAgeDays"] / 30) * opts.get("noiseScale", 1.0)
    group_mean = []
    group_cv = []
    for g in range(4):
        values = []
        for _ in range(CHANNELS_PER_GROUP):
            z1 = gaussian(rand)
            z2 = gaussian(rand)
            values.append(specific[g] * (1 + CHANNEL_GAIN_SPREAD * z1) + drift + GROUP_FOULING_COUPLING[g] * foul + noise_sd * z2)
        mean = _mean(values)
        group_mean.append(mean)
        group_cv.append((_sample_sd(values) / max(1e-9, BASELINE_RCT_OHM + mean)) * 100)
    mean_sens = _mean(GROUP_SENSITIVITY_OHM)
    nip_pfas = NIP_NONSPECIFIC_FRACTION * mean_sens * gain * sum(x)
    nip = [drift + NIP_FOULING_COUPLING * foul + nip_pfas + noise_sd * gaussian(rand) for _ in range(NIP_CHANNELS)]
    sonde = {
        "tempC": m["tempC"] + SONDE_NOISE["tempC"] * gaussian(rand),
        "pH": m["pH"] + SONDE_NOISE["pH"] * gaussian(rand),
        "conductivityUsCm": m["conductivityUsCm"] * (1 + SONDE_NOISE["conductivityRel"] * gaussian(rand)),
        "turbidityNTU": m["turbidityNTU"] * (1 + SONDE_NOISE["turbidityRel"] * gaussian(rand)),
        "fdomQsu": FDOM_QSU_PER_MG_L * m["nomMgL"] * (1 + SONDE_NOISE["fdomRel"] * gaussian(rand)),
        "cartridgeAgeDays": m["cartridgeAgeDays"],
    }
    return {
        "groupMeanOhm": group_mean,
        "groupCvPct": group_cv,
        "nipMeanOhm": _mean(nip),
        "specificOhm": specific,
        "crossTalkOhm": cross,
        "driftOhm": drift,
        "foulingOhm": foul,
        "gain": gain,
        "debyeLengthNm": debye_length_nm(m["conductivityUsCm"]),
        "amineProtonationPct": amine_protonation_fraction(m["pH"]) * 100,
        "sonde": sonde,
    }


def offset_features(s: Dict[str, float]) -> List[float]:
    """Centred on the reference matrix, so the offset correction is anchored to 0 there."""
    ref = REFERENCE_MATRIX
    d_t = s["tempC"] - ref["tempC"]
    return [
        d_t,
        d_t * d_t,
        s["pH"] - ref["pH"],
        (s["conductivityUsCm"] - ref["conductivityUsCm"]) / 100,
        s["fdomQsu"] / FDOM_QSU_PER_MG_L - ref["nomMgL"],
        s["turbidityNTU"] - ref["turbidityNTU"],
        s["cartridgeAgeDays"] / 30,
    ]


def gain_features(s: Dict[str, float]) -> List[float]:
    """Zero at the reference matrix, so the gain correction is anchored to 1 there."""
    d_t = s["tempC"] - 20
    return [d_t, d_t * d_t, s["pH"] - 7, (s["conductivityUsCm"] - 300) / 100, s["cartridgeAgeDays"] / 30]


def _dot(a: List[float], b: List[float]) -> float:
    return sum(v * b[i] for i, v in enumerate(a))


def _draw_matrix(rand: Callable[[], float], r: Dict) -> Dict[str, float]:
    def u(lo: float, hi: float) -> float:
        return lo + (hi - lo) * rand()

    return {
        "tempC": u(*r["t"]),
        "pH": u(*r["ph"]),
        "conductivityUsCm": u(*r["ec"]),
        "turbidityNTU": u(*r["tu"]),
        "nomMgL": u(*r["nom"]),
        "cartridgeAgeDays": u(0, 30),
    }


def calibrate_edge_estimator(seed: int = CALIBRATION_SEED) -> Dict:
    """Simulated factory calibration: pure standards at the reference matrix, then matrix blanks/spikes."""
    rand = Mulberry32(seed)
    rows: List[List[float]] = []
    ys: List[List[float]] = [[], [], [], []]
    raw_blank: List[List[float]] = [[], [], [], []]
    for s in range(4):
        for c in STANDARD_LEVELS_PPT:
            for _ in range(CALIBRATION_REPLICATES):
                mix = [0.0, 0.0, 0.0, 0.0]
                mix[s] = c
                r = simulate_sensor(mix, REFERENCE_MATRIX, rand)
                rows.append([1.0] + [math.log1p(v) for v in mix])
                for g in range(4):
                    ys[g].append(r["groupMeanOhm"][g] - r["nipMeanOhm"])
                    if c == 0:
                        raw_blank[g].append(r["groupMeanOhm"][g])
    sensitivity = []
    blank_offset = []
    for g in range(4):
        beta = least_squares(rows, ys[g], 1e-9)
        blank_offset.append(beta[0])
        sensitivity.append(beta[1:])
    raw_blank_ref = [_mean(v) for v in raw_blank]

    off_rows = []
    off_y: List[List[float]] = [[], [], [], []]
    spikes = []
    for _ in range(CALIBRATION_MATRICES):
        m = _draw_matrix(rand, CALIBRATION_RANGES)
        blank = simulate_sensor([0.0, 0.0, 0.0, 0.0], m, rand)
        spikes.append(simulate_sensor([SPIKE_PPT] * 4, m, rand))
        off_rows.append(offset_features(blank["sonde"]))
        for g in range(4):
            off_y[g].append(blank["groupMeanOhm"][g] - blank["nipMeanOhm"] - blank_offset[g])
    offset_coef = [least_squares(off_rows, y, 1e-6) for y in off_y]
    xs = math.log1p(SPIKE_PPT)
    gain_rows = [gain_features(r["sonde"]) for r in spikes]
    gain_coef = []
    for g in range(4):
        expected = sum(v * xs for v in sensitivity[g])
        ratios = [
            (r["groupMeanOhm"][g] - r["nipMeanOhm"] - blank_offset[g] - _dot(offset_coef[g], offset_features(r["sonde"]))) / expected - 1
            for r in spikes
        ]
        gain_coef.append(least_squares(gain_rows, ratios, 1e-6))
    ata = mat_mul(transpose(sensitivity), sensitivity)
    lam = (TIKHONOV_LAMBDA_REL * (ata[0][0] + ata[1][1] + ata[2][2] + ata[3][3])) / 4
    return {
        "sensitivity": sensitivity,
        "blankOffsetOhm": blank_offset,
        "rawBlankRefOhm": raw_blank_ref,
        "offsetCoef": offset_coef,
        "gainCoef": gain_coef,
        "lambda": lam,
        "conditionNumberS": condition_number2(CROSS_SELECTIVITY),
        "determinantS": determinant(CROSS_SELECTIVITY),
        "conditionNumberCalibrated": condition_number2(sensitivity),
    }


def estimate_mixture(reading: Dict, cal: Dict) -> Dict:
    """Blind edge estimator: no true concentration and no true NOM in the signature."""
    compensated = []
    diagonal = []
    nip_only = []
    uncompensated = []
    fo = offset_features(reading["sonde"])
    fg = gain_features(reading["sonde"])
    for g in range(4):
        diff = reading["groupMeanOhm"][g] - reading["nipMeanOhm"]
        offset = cal["blankOffsetOhm"][g] + _dot(cal["offsetCoef"][g], fo)
        gain = max(0.2, 1 + _dot(cal["gainCoef"][g], fg))
        y = (diff - offset) / gain
        compensated.append(y)
        sgg = cal["sensitivity"][g][g]
        diagonal.append(math.expm1(max(0.0, y / sgg)))
        nip_only.append(math.expm1(max(0.0, (diff - cal["blankOffsetOhm"][g]) / sgg)))
        uncompensated.append(math.expm1(max(0.0, (reading["groupMeanOhm"][g] - cal["rawBlankRefOhm"][g]) / sgg)))
    a = cal["sensitivity"]
    ata = mat_mul(transpose(a), a)
    for i in range(4):
        ata[i][i] += cal["lambda"]
    aty = [sum(a[g][j] * compensated[g] for g in range(4)) for j in range(4)]
    log_signal = solve_linear_system(ata, aty)
    return {
        "estimatePpt": [math.expm1(max(0.0, v)) for v in log_signal],
        "logSignal": log_signal,
        "diagonalPpt": diagonal,
        "nipOnlyPpt": nip_only,
        "uncompensatedPpt": uncompensated,
        "compensatedOhm": compensated,
    }


def _summarize(apes: List[float], lows: List[float]) -> Dict[str, float]:
    s = sorted(apes)
    return {
        "mapePct": _mean(apes) if apes else 0.0,
        "medianApePct": s[int(math.floor(0.5 * (len(s) - 1)))] if s else 0.0,
        "p90ApePct": s[int(math.floor(0.9 * (len(s) - 1)))] if s else 0.0,
        "maeLowPpt": _mean(lows) if lows else 0.0,
    }


def run_mixture_benchmark(cal: Dict, n: int = 200, seed: int = 777, noise_scale: float = 1.0) -> Dict:
    rand = Mulberry32(seed)
    apes: Dict[str, List[float]] = {k: [] for k in ESTIMATOR_METHODS}
    lows: Dict[str, List[float]] = {k: [] for k in ESTIMATOR_METHODS}
    by_sp = {sp: {"ape": [], "low": []} for sp in SPECIES_ORDER}
    for _ in range(n):
        mix = [math.exp(math.log(0.5) + rand() * (math.log(50) - math.log(0.5))) for _ in range(4)]
        m = _draw_matrix(rand, BENCHMARK_RANGES)
        est = estimate_mixture(simulate_sensor(mix, m, rand, {"noiseScale": noise_scale}), cal)
        by_method = {"uncompensated": est["uncompensatedPpt"], "nipOnly": est["nipOnlyPpt"], "diagonal": est["diagonalPpt"], "full": est["estimatePpt"]}
        for s in range(4):
            for method in ESTIMATOR_METHODS:
                e = by_method[method][s]
                if mix[s] >= 2:
                    apes[method].append(abs(e - mix[s]) / mix[s] * 100)
                else:
                    lows[method].append(abs(e - mix[s]))
            e = est["estimatePpt"][s]
            if mix[s] >= 2:
                by_sp[SPECIES_ORDER[s]]["ape"].append(abs(e - mix[s]) / mix[s] * 100)
            else:
                by_sp[SPECIES_ORDER[s]]["low"].append(abs(e - mix[s]))
    return {
        "samples": n,
        "noiseScale": noise_scale,
        "methods": {k: _summarize(apes[k], lows[k]) for k in ESTIMATOR_METHODS},
        "fullBySpecies": {sp: _summarize(by_sp[sp]["ape"], by_sp[sp]["low"]) for sp in SPECIES_ORDER},
    }


def simulated_lod_ppt(cal: Dict, n: int = 60, seed: int = 991) -> List[float]:
    """Model-based LOD per species: mean + 3 SD of blank estimates across random water matrices."""
    rand = Mulberry32(seed)
    est: List[List[float]] = [[], [], [], []]
    for _ in range(n):
        m = _draw_matrix(rand, BENCHMARK_RANGES)
        e = estimate_mixture(simulate_sensor([0.0, 0.0, 0.0, 0.0], m, rand), cal)
        for s in range(4):
            est[s].append(math.expm1(e["logSignal"][s]))
    return [max(0.0, _mean(v) + 3 * _sample_sd(v)) for v in est]

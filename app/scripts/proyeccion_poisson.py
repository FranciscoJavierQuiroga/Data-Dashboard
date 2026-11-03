"""
Ajuste de modelos de proyección de mortalidad por cáncer — Sogamoso.

Reemplaza la regresión lineal ordinaria que antes se calculaba en el
frontend (PoissonPanel.tsx) por un GLM de Poisson con enlace logarítmico
y offset poblacional, que es la técnica estándar en literatura de
epidemiología para series de conteos de eventos raros (ver p. ej.
Colombia cancer mortality trends 1984-2008, European cancer mortality
predictions), ya usada como referencia en la propuesta.

Modelo:
    log(mu_t) = beta0 + beta1 * año_t + log(poblacion_t)

Donde mu_t es el número esperado de defunciones en el año t.
Esto equivale a modelar la TASA como:
    tasa_t = mu_t / poblacion_t = exp(beta0 + beta1 * año_t)

beta1 es directamente interpretable como el Cambio Porcentual Anual
Estimado (CPAE / EAPC):
    CPAE (%) = (exp(beta1) - 1) * 100

Requisitos:
    pip install statsmodels pandas numpy --break-system-packages

Entradas (deben existir antes de correr este script):
    public/data/comportamiento_cancer.json  -> [{indicador, year, cases}, ...]
    public/data/poblacion_sogamoso.json     -> [{year, poblacion}, ...]

Salida:
    public/data/proyeccion_poisson.json

Ejecutar desde la raíz del proyecto:
    python scripts/proyeccion_poisson.py
"""

import json
import os

import numpy as np
import pandas as pd
import statsmodels.api as sm

# Rutas resueltas respecto a la ubicación de este archivo (no al directorio
# desde el que se invoque `python`), asumiendo la estructura:
#   app/
#     scripts/proyeccion_poisson.py   <- este archivo
#     public/data/...                 <- entradas y salida
# Así el script funciona igual si lo corres desde app/, desde scripts/, o
# desde cualquier otro directorio.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "public", "data")
INPUT_CANCER = os.path.join(DATA_DIR, "comportamiento_cancer.json")
INPUT_POBLACION = os.path.join(DATA_DIR, "poblacion_sogamoso.json")
OUTPUT_PATH = os.path.join(DATA_DIR, "proyeccion_poisson.json")

# Mínimo de años con datos para considerar que el ajuste es confiable.
# Con menos puntos que esto, un GLM de un solo predictor es demasiado
# inestable para usarse en una proyección — se documenta como límite
# metodológico explícito en vez de ajustarlo "de todas formas".
MIN_YEARS = 5

# Umbral de dispersión (Pearson chi2 / grados de libertad) a partir del
# cual se considera que el supuesto Poisson (varianza = media) no se
# sostiene y se advierte sobre subestimación del intervalo de confianza.
OVERDISPERSION_THRESHOLD = 1.5


def fit_poisson_glm(g: pd.DataFrame):
    """Ajusta el GLM de Poisson con offset para un subconjunto (una patología)."""
    X = sm.add_constant(g["year"].astype(float))
    y = g["cases"].astype(float)
    offset = np.log(g["poblacion"].astype(float))

    model = sm.GLM(y, X, family=sm.families.Poisson(), offset=offset)
    fit = model.fit()

    beta0 = float(fit.params["const"])
    beta1 = float(fit.params["year"])

    cov = fit.cov_params()
    var_b0 = float(cov.loc["const", "const"])
    var_b1 = float(cov.loc["year", "year"])
    cov_b0b1 = float(cov.loc["const", "year"])

    se_beta1 = float(np.sqrt(var_b1))
    cpae_pct = float((np.exp(beta1) - 1) * 100)
    cpae_ci_low = float((np.exp(beta1 - 1.96 * se_beta1) - 1) * 100)
    cpae_ci_high = float((np.exp(beta1 + 1.96 * se_beta1) - 1) * 100)

    dispersion = float(fit.pearson_chi2 / fit.df_resid) if fit.df_resid > 0 else 1.0

    fitted_rate = np.exp(beta0 + beta1 * g["year"].astype(float))
    fitted_cases = fitted_rate * g["poblacion"].astype(float)

    model_out = {
        "beta0": beta0,
        "beta1": beta1,
        "cov_beta0_beta0": var_b0,
        "cov_beta1_beta1": var_b1,
        "cov_beta0_beta1": cov_b0b1,
        "dispersion": dispersion,
        "overdispersed": dispersion > OVERDISPERSION_THRESHOLD,
        "cpae_pct": cpae_pct,
        "cpae_ci_low": cpae_ci_low,
        "cpae_ci_high": cpae_ci_high,
        "deviance": float(fit.deviance),
        "df_resid": int(fit.df_resid),
        "aic": float(fit.aic),
    }

    fitted_out = [
        {"year": int(yr), "rate_fitted": float(r), "cases_fitted": float(c)}
        for yr, r, c in zip(g["year"], fitted_rate, fitted_cases)
    ]

    return model_out, fitted_out


def main():
    # utf-8-sig tolera un BOM al inicio del archivo (frecuente si el JSON
    # se guardó/exportó con herramientas de Windows); si no hay BOM, se
    # comporta igual que utf-8 normal.
    with open(INPUT_CANCER, encoding="utf-8-sig") as f:
        cancer_records = json.load(f)
    with open(INPUT_POBLACION, encoding="utf-8-sig") as f:
        pop_records = json.load(f)

    df_cancer = pd.DataFrame(cancer_records)   # indicador, year, cases
    df_pop = pd.DataFrame(pop_records)         # year, poblacion

    df = df_cancer.merge(df_pop, on="year", how="left")
    df = df.dropna(subset=["poblacion"])
    df = df[df["poblacion"] > 0]

    results = []

    for indicador, g in df.groupby("indicador"):
        g = g.sort_values("year").reset_index(drop=True)
        n = len(g)

        entry = {
            "indicador": indicador,
            "n_years": n,
            "first_year": int(g["year"].min()),
            "last_year": int(g["year"].max()),
            "observed": [
                {
                    "year": int(row.year),
                    "cases": int(row.cases),
                    "poblacion": float(row.poblacion),
                    "rate_observed": float(row.cases / row.poblacion) if row.poblacion > 0 else None,
                }
                for row in g.itertuples()
            ],
            "model": None,
            "fitted": None,
            "warning": None,
        }

        if n < MIN_YEARS:
            entry["warning"] = (
                f"Solo hay {n} año(s) con datos para '{indicador}' (mínimo recomendado: "
                f"{MIN_YEARS}). No se ajustó un modelo; se sugiere usar la tasa de "
                f"referencia (Globocan) hasta contar con más histórico."
            )
            results.append(entry)
            continue

        try:
            model_out, fitted_out = fit_poisson_glm(g)
        except Exception as exc:  # noqa: BLE001 - queremos capturar cualquier falla de ajuste
            entry["warning"] = f"No fue posible ajustar el modelo para '{indicador}': {exc}"
            results.append(entry)
            continue

        entry["model"] = model_out
        entry["fitted"] = fitted_out

        if model_out["overdispersed"]:
            entry["warning"] = (
                f"Dispersión = {model_out['dispersion']:.2f} (> {OVERDISPERSION_THRESHOLD}): "
                f"la varianza observada excede la esperada bajo Poisson. Los intervalos de "
                f"confianza podrían ser más estrechos de lo real; se recomienda considerar "
                f"un modelo binomial negativo en trabajo futuro."
            )

        results.append(entry)

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    ajustados = [r for r in results if r["model"] is not None]
    print(f"✅ {OUTPUT_PATH} generado — {len(ajustados)} de {len(results)} patologías con modelo ajustado.\n")
    for r in results:
        if r["model"]:
            m = r["model"]
            flag = " ⚠ sobredispersión" if m["overdispersed"] else ""
            print(
                f"  {r['indicador']}: CPAE = {m['cpae_pct']:.2f}% anual "
                f"(IC95%: {m['cpae_ci_low']:.2f}% a {m['cpae_ci_high']:.2f}%), "
                f"n={r['n_years']} años{flag}"
            )
        else:
            print(f"  {r['indicador']}: sin modelo — {r['warning']}")


if __name__ == "__main__":
    main()
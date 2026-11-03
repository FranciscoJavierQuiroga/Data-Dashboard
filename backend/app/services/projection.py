from __future__ import annotations

from typing import Any

MIN_YEARS = 5
OVERDISPERSION_THRESHOLD = 1.5


def build_projection(
    cancer_rows: list[dict[str, Any]],
    population_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    try:
        import numpy as np
        import pandas as pd
        import statsmodels.api as sm
    except ImportError:
        return [
            {
                "indicador": indicator,
                "n_years": 0,
                "first_year": None,
                "last_year": None,
                "observed": [],
                "model": None,
                "fitted": None,
                "warning": "statsmodels no está instalado; no se pudo calcular la proyección",
            }
            for indicator in sorted({row["indicador"] for row in cancer_rows})
        ]

    population = {int(row["year"]): int(row["poblacion"]) for row in population_rows}
    frame = pd.DataFrame(cancer_rows)
    if frame.empty:
        return []
    frame["year"] = frame["year"].astype(int)
    frame["cases"] = frame["cases"].astype(float)
    frame["poblacion"] = frame["year"].map(population)
    frame = frame.dropna(subset=["poblacion"])
    frame = frame[frame["poblacion"] > 0]

    results: list[dict[str, Any]] = []
    for indicator, group in frame.groupby("indicador"):
        group = group.sort_values("year").reset_index(drop=True)
        n = len(group)
        entry: dict[str, Any] = {
            "indicador": indicator,
            "n_years": n,
            "first_year": int(group["year"].min()) if n else None,
            "last_year": int(group["year"].max()) if n else None,
            "observed": [
                {
                    "year": int(row.year),
                    "cases": int(row.cases),
                    "poblacion": float(row.poblacion),
                    "rate_observed": float(row.cases / row.poblacion)
                    if row.poblacion > 0
                    else None,
                }
                for row in group.itertuples()
            ],
            "model": None,
            "fitted": None,
            "warning": None,
        }

        if n < MIN_YEARS:
            entry["warning"] = (
                f"Solo hay {n} año(s) con datos para '{indicator}' (mínimo recomendado: "
                f"{MIN_YEARS}). No se ajustó un modelo; se sugiere usar la tasa de "
                f"referencia (Globocan) hasta contar con más histórico."
            )
            results.append(entry)
            continue

        try:
            x = sm.add_constant(group["year"].astype(float))
            y = group["cases"].astype(float)
            offset = np.log(group["poblacion"].astype(float))
            fit = sm.GLM(y, x, family=sm.families.Poisson(), offset=offset).fit()

            beta0 = float(fit.params["const"])
            beta1 = float(fit.params["year"])
            covariance = fit.cov_params()
            var_b0 = float(covariance.loc["const", "const"])
            var_b1 = float(covariance.loc["year", "year"])
            cov_b0b1 = float(covariance.loc["const", "year"])
            se_beta1 = float(np.sqrt(var_b1))
            dispersion = float(fit.pearson_chi2 / fit.df_resid) if fit.df_resid > 0 else 1.0
            fitted_rate = np.exp(beta0 + beta1 * group["year"].astype(float))
            fitted_cases = fitted_rate * group["poblacion"].astype(float)

            entry["model"] = {
                "beta0": beta0,
                "beta1": beta1,
                "cov_beta0_beta0": var_b0,
                "cov_beta1_beta1": var_b1,
                "cov_beta0_beta1": cov_b0b1,
                "dispersion": dispersion,
                "overdispersed": dispersion > OVERDISPERSION_THRESHOLD,
                "cpae_pct": float((np.exp(beta1) - 1) * 100),
                "cpae_ci_low": float((np.exp(beta1 - 1.96 * se_beta1) - 1) * 100),
                "cpae_ci_high": float((np.exp(beta1 + 1.96 * se_beta1) - 1) * 100),
                "deviance": float(fit.deviance),
                "df_resid": int(fit.df_resid),
                "aic": float(fit.aic),
            }
            entry["fitted"] = [
                {
                    "year": int(year),
                    "rate_fitted": float(rate),
                    "cases_fitted": float(cases),
                }
                for year, rate, cases in zip(
                    group["year"], fitted_rate, fitted_cases, strict=False
                )
            ]
            if dispersion > OVERDISPERSION_THRESHOLD:
                entry["warning"] = (
                    f"Dispersión = {dispersion:.2f} (> {OVERDISPERSION_THRESHOLD}): "
                    "la varianza observada excede la esperada bajo Poisson. Los intervalos de "
                    "confianza podrían ser más estrechos de lo real; se recomienda considerar "
                    "un modelo binomial negativo en trabajo futuro."
                )
        except Exception as exc:  # noqa: BLE001
            entry["warning"] = f"No fue posible ajustar el modelo para '{indicator}': {exc}"

        results.append(entry)

    return results

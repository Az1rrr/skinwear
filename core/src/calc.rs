use anyhow::{Context, Result};
use itertools::Itertools;
use rust_decimal::Decimal;
use std::str::FromStr;

use crate::types::{CalcInput, CalcProgress, MaterialEntry, OptimalResult, TargetWearResult};

/// Load wear values from raw text content (one per line).
pub fn parse_wears(data: &str) -> Result<Vec<Decimal>> {
    let mut wears = Vec::new();
    for line in data.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let d = Decimal::from_str(trimmed)
            .with_context(|| format!("无效的磨损值: {trimmed}"))?;
        wears.push(d);
    }
    Ok(wears)
}

/// Validate calculation input parameters.
pub fn validate_calc_input(input: &CalcInput) -> Result<()> {
    let input_range = input.input_max - input.input_min;
    if input_range.is_zero() {
        anyhow::bail!("素材最高磨损和最低磨损不能相等");
    }
    let output_range = input.output_max - input.output_min;
    if output_range.is_zero() {
        anyhow::bail!("产物最高磨损和最低磨损不能相等");
    }
    if input.top_n < 10 {
        anyhow::bail!("top_n 必须大于等于 10（汰换需要 10 把素材）");
    }
    Ok(())
}

/// Pure calculation: given ranges and target wear, compute required average wear.
pub fn calculate_target(input: &CalcInput) -> Result<TargetWearResult> {
    validate_calc_input(input)?;

    let input_range = input.input_max - input.input_min;
    let output_range = input.output_max - input.output_min;

    // 反推: target_avg_t = (期望成品 − output_min) / output_range
    let target_avg_t = (input.target_wear - input.output_min) / output_range;
    if target_avg_t < Decimal::ZERO || target_avg_t > Decimal::ONE {
        anyhow::bail!(
            "期望成品磨损（{}）不在产物皮肤磨损范围 [{}, {}] 内",
            input.target_wear,
            input.output_min,
            input.output_max
        );
    }

    // target_avg_actual = target_avg_t × input_range + input_min
    let target_avg_actual = target_avg_t * input_range + input.input_min;
    let target_total = target_avg_actual * Decimal::from(10u8);

    Ok(TargetWearResult {
        target_avg_t,
        target_avg_actual,
        target_total,
        input_range,
        output_range,
    })
}

/// Find optimal C(N,10) combination from wear data.
/// `wears` should be all available wear values (the original list for position lookup).
/// `on_progress` is called periodically with (completed, total) combination counts.
pub fn find_optimal<F>(
    wears: &[Decimal],
    input: &CalcInput,
    mut on_progress: F,
) -> Result<OptimalResult>
where
    F: FnMut(CalcProgress),
{
    validate_calc_input(input)?;

    let total_wears = wears.len();
    if input.top_n > total_wears {
        anyhow::bail!(
            "top_n（{}）不能超过已加载的磨损数据数量（{total_wears}）",
            input.top_n
        );
    }

    let target = calculate_target(input)?;
    let input_range = input.input_max - input.input_min;
    let output_range = input.output_max - input.output_min;

    // Sort by proximity to target average actual wear
    let mut sorted: Vec<(usize, Decimal)> = wears.iter().enumerate().map(|(i, w)| (i, *w)).collect();
    sorted.sort_by(|a, b| {
        let da = (a.1 - target.target_avg_actual).abs();
        let db = (b.1 - target.target_avg_actual).abs();
        da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
    });

    let candidates: Vec<Decimal> = sorted.iter().take(input.top_n).map(|(_, w)| *w).collect();
    let candidate_indices: Vec<usize> = sorted.iter().take(input.top_n).map(|(i, _)| *i).collect();

    // Progress reporting: total = C(top_n, 10); throttle to ~200 events max
    let total_combos = num_combinations(candidates.len() as u64, 10);
    let emit_step = (total_combos / 200).max(1);
    let mut completed_combos: u64 = 0;
    let mut last_emitted: u64 = 0;

    let mut best_combination: Option<Vec<Decimal>> = None;
    let mut best_indices: Option<Vec<usize>> = None;
    let mut best_deviation = Decimal::MAX;
    let mut best_avg_actual = Decimal::ZERO;
    let mut best_avg_t = Decimal::ZERO;

    for combo_indices in (0..candidates.len()).combinations(10) {
        completed_combos += 1;
        if completed_combos - last_emitted >= emit_step || completed_combos == total_combos {
            last_emitted = completed_combos;
            on_progress(CalcProgress {
                current: completed_combos,
                total: total_combos,
            });
        }

        let total: Decimal = combo_indices.iter().map(|&i| candidates[i]).sum();
        let avg_actual = total / Decimal::from(10u8);
        let avg_t = (avg_actual - input.input_min) / input_range;
        let output_wear = avg_t * output_range + input.output_min;
        let deviation = (output_wear - input.target_wear).abs();
        if deviation < best_deviation {
            best_deviation = deviation;
            best_avg_actual = avg_actual;
            best_avg_t = avg_t;
            best_combination = Some(combo_indices.iter().map(|&i| candidates[i]).collect());
            best_indices = Some(combo_indices.iter().map(|&i| candidate_indices[i]).collect());
        }
    }

    match (best_combination, best_indices) {
        (Some(combo), Some(indices)) => {
            let output_wear = best_avg_t * output_range + input.output_min;
            let materials: Vec<MaterialEntry> = combo
                .iter()
                .zip(indices.iter())
                .map(|(wear, &pos)| MaterialEntry {
                    wear: *wear,
                    page: pos / 10 + 1,
                    row: pos % 10,
                })
                .collect();
            let wear_values: Vec<Decimal> = combo.iter().copied().collect();

            Ok(OptimalResult {
                output_wear,
                deviation: best_deviation,
                avg_actual: best_avg_actual,
                avg_t: best_avg_t,
                materials,
                wear_values,
            })
        }
        _ => anyhow::bail!("未找到有效组合（至少需要 10 条磨损数据）"),
    }
}

/// Calculate number of combinations C(n, r)
pub fn num_combinations(n: u64, r: u64) -> u64 {
    if r > n {
        return 0;
    }
    let r = r.min(n - r);
    let mut result = 1u64;
    for i in 0..r {
        result = result * (n - i) / (i + 1);
    }
    result
}

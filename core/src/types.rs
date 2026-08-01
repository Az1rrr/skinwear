use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Unified Cookie JSON structure (shared between cookie and scrape modules)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CookieJson {
    pub name: String,
    pub value: String,
    pub domain: String,
    pub path: String,
}

/// Parameters for scraping wear data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapeParams {
    pub url: String,
    pub pages: usize,
}

/// Parsed goods info extracted from a BUFF URL
#[derive(Debug, Clone)]
pub struct GoodsInfo {
    pub goods_id: String,
    pub min_paintwear: Option<Decimal>,
    pub max_paintwear: Option<Decimal>,
}

/// Input parameters for wear calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalcInput {
    pub input_max: Decimal,
    pub input_min: Decimal,
    pub output_max: Decimal,
    pub output_min: Decimal,
    pub target_wear: Decimal,
    pub top_n: usize,
}

/// Result of a single material entry in optimal combination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialEntry {
    pub wear: Decimal,
    pub page: usize,
    pub row: usize,
}

/// Result of optimal combination search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimalResult {
    pub output_wear: Decimal,
    pub deviation: Decimal,
    pub avg_actual: Decimal,
    pub avg_t: Decimal,
    pub materials: Vec<MaterialEntry>,
    pub wear_values: Vec<Decimal>,
}

/// Result of standalone target wear calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetWearResult {
    pub target_avg_t: Decimal,
    pub target_avg_actual: Decimal,
    pub target_total: Decimal,
    pub input_range: Decimal,
    pub output_range: Decimal,
}

/// Progress event emitted during scraping
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapeProgress {
    pub current_page: usize,
    pub total_pages: usize,
    pub wears_collected: usize,
}

use std::collections::HashMap;
use std::fmt;

use crate::errors::StageError;

pub fn normalize_bank_key(bank: &str) -> String {
    bank.trim().to_ascii_lowercase()
}

pub fn normalize_variant_segment(variant: Option<&str>) -> Option<String> {
    match variant {
        None => None,
        Some(v) => {
            let cleaned = v.trim().to_ascii_lowercase();
            if cleaned.is_empty() || cleaned == "default" {
                None
            } else {
                Some(cleaned)
            }
        }
    }
}

#[cfg(test)]
pub fn bank_variant_key(bank: &str, variant: Option<&str>) -> String {
    let bank_key = normalize_bank_key(bank);
    match normalize_variant_segment(variant) {
        None => bank_key,
        Some(variant_key) => format!("{}/{}", bank_key, variant_key),
    }
}

pub fn handler_registry_key(bank: &str, variant: Option<&str>) -> String {
    let bank_key = normalize_bank_key(bank);
    match normalize_variant_segment(variant) {
        None => format!("{}/default", bank_key),
        Some(variant_key) => format!("{}/{}", bank_key, variant_key),
    }
}

pub struct Registry<T> {
    items: HashMap<String, T>,
    default: Option<T>,
    key_fn: fn(&str, Option<&str>) -> String,
}

impl<T: Clone> Registry<T> {
    pub fn with_key_fn(default: Option<T>, key_fn: fn(&str, Option<&str>) -> String) -> Self {
        Self {
            items: HashMap::new(),
            default,
            key_fn,
        }
    }

    pub fn register(&mut self, bank: &str, variant: Option<&str>, value: T) {
        let key = (self.key_fn)(bank, variant);
        self.items.insert(key, value);
    }

    pub fn get(&self, bank: &str, variant: Option<&str>) -> Result<T, StageError> {
        let bank_key = normalize_bank_key(bank);
        let variant_key = normalize_variant_segment(variant);

        if let Some(ref vk) = variant_key {
            let exact_key = (self.key_fn)(&bank_key, Some(vk));
            if let Some(value) = self.items.get(&exact_key) {
                return Ok(value.clone());
            }
        }

        let fallback_key = (self.key_fn)(&bank_key, None);
        if let Some(value) = self.items.get(&fallback_key) {
            return Ok(value.clone());
        }

        if let Some(default) = &self.default {
            return Ok(default.clone());
        }

        let known = if self.items.is_empty() {
            "(none registered)".to_string()
        } else {
            self.items.keys().cloned().collect::<Vec<_>>().join(", ")
        };
        let variant_msg = variant
            .map(|v| format!(" variant {:?}", v))
            .unwrap_or_default();
        Err(StageError::new(format!(
            "no registry entry for {:?}{} (known: {})",
            bank_key, variant_msg, known
        )))
    }

    pub fn keys(&self) -> Vec<String> {
        let mut keys = self.items.keys().cloned().collect::<Vec<_>>();
        keys.sort();
        keys
    }
}

impl<T> fmt::Debug for Registry<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Registry")
            .field("count", &self.items.len())
            .finish()
    }
}

#[cfg(test)]
mod test_registry;

use super::{bank_variant_key, handler_registry_key, normalize_bank_key, Registry};

#[test]
fn normalize_bank_key_trims_and_lowercases() {
    assert_eq!(normalize_bank_key(" HDFC "), "hdfc");
}

#[test]
fn bank_variant_key_default_variant() {
    assert_eq!(bank_variant_key("HDFC", None), "hdfc");
    assert_eq!(bank_variant_key("HDFC", Some("default")), "hdfc");
    assert_eq!(bank_variant_key("HDFC", Some("swiggy")), "hdfc/swiggy");
}

#[test]
fn handler_registry_key_includes_default_segment() {
    assert_eq!(handler_registry_key("HDFC", None), "hdfc/default");
    assert_eq!(handler_registry_key("HDFC", Some("swiggy")), "hdfc/swiggy");
}

#[test]
fn registry_exact_then_fallback() {
    let mut registry = Registry::with_key_fn(None, bank_variant_key);
    registry.register("hdfc", None, "default-handler");
    registry.register("hdfc", Some("swiggy"), "swiggy-handler");

    assert_eq!(
        registry.get("HDFC", Some("swiggy")).unwrap(),
        "swiggy-handler"
    );
    assert_eq!(
        registry.get("HDFC", Some("unknown")).unwrap(),
        "default-handler"
    );
    assert_eq!(registry.get("HDFC", None).unwrap(), "default-handler");
}

#[test]
fn registry_global_default() {
    let registry = Registry::with_key_fn(Some("fallback".to_string()), bank_variant_key);
    assert_eq!(registry.get("unknown", None).unwrap(), "fallback");
}

#[test]
fn registry_keys_sorted() {
    let mut registry = Registry::<String>::with_key_fn(None, bank_variant_key);
    registry.register("yes", None, "a".to_string());
    registry.register("hdfc", None, "b".to_string());
    assert_eq!(registry.keys(), vec!["hdfc", "yes"]);
}

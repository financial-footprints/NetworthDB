use std::sync::{Arc, OnceLock};

use crate::banks::registry::{handler_registry_key, Registry};
use crate::errors::StageError;

use super::base::BankHandler;
use super::bob::{BobDefaultHandler, BobEasyHandler};
use super::csb::{CsbDefaultHandler, CsbEdgeHandler};
use super::federal::{FederalDefaultHandler, FederalEdgeHandler, FederalSignetHandler};
use super::hdfc::{
    HdfcDefaultHandler, HdfcDinersHandler, HdfcRegaliaGoldHandler, HdfcRegaliaHandler,
    HdfcSwiggyHandler, HdfcTataNeuInfinityHandler,
};
use super::icici::{
    IciciAmazonHandler, IciciCoralHandler, IciciDefaultHandler, IciciPlatinumHandler,
};
use super::idfc::{IdfcDefaultHandler, IdfcWowHandler};
use super::indusind::{IndusindAmexEpayHandler, IndusindAuraedgeHandler, IndusindDefaultHandler};
use super::onecard::OnecardDefaultHandler;
use super::pnb::{PnbHandler, PnbPlatinumHandler};
use super::yes::{YesAceHandler, YesDefaultHandler};

fn handlers() -> &'static Registry<Arc<dyn BankHandler>> {
    static REGISTRY: OnceLock<Registry<Arc<dyn BankHandler>>> = OnceLock::new();
    REGISTRY.get_or_init(|| {
        let mut registry = Registry::with_key_fn(None, handler_registry_key);
        registry.register(
            "onecard",
            Some("default"),
            Arc::new(OnecardDefaultHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "yes",
            Some("default"),
            Arc::new(YesDefaultHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "yes",
            Some("ace"),
            Arc::new(YesAceHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "bob",
            Some("default"),
            Arc::new(BobDefaultHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "bob",
            Some("easy"),
            Arc::new(BobEasyHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "csb",
            Some("default"),
            Arc::new(CsbDefaultHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "csb",
            Some("edge"),
            Arc::new(CsbEdgeHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "federal",
            Some("default"),
            Arc::new(FederalDefaultHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "federal",
            Some("signet"),
            Arc::new(FederalSignetHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "federal",
            Some("edge"),
            Arc::new(FederalEdgeHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "indusind",
            Some("default"),
            Arc::new(IndusindDefaultHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "indusind",
            Some("auraedge"),
            Arc::new(IndusindAuraedgeHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "indusind",
            Some("amex-epay"),
            Arc::new(IndusindAmexEpayHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "idfc",
            Some("default"),
            Arc::new(IdfcDefaultHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "idfc",
            Some("wow"),
            Arc::new(IdfcWowHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "hdfc",
            Some("default"),
            Arc::new(HdfcDefaultHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "hdfc",
            Some("regalia"),
            Arc::new(HdfcRegaliaHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "hdfc",
            Some("regalia-gold"),
            Arc::new(HdfcRegaliaGoldHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "hdfc",
            Some("diners-privilege"),
            Arc::new(HdfcDinersHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "hdfc",
            Some("swiggy"),
            Arc::new(HdfcSwiggyHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "hdfc",
            Some("tata-neu-infinity"),
            Arc::new(HdfcTataNeuInfinityHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "icici",
            Some("default"),
            Arc::new(IciciDefaultHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "icici",
            Some("coral"),
            Arc::new(IciciCoralHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "icici",
            Some("platinum"),
            Arc::new(IciciPlatinumHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "icici",
            Some("amazon"),
            Arc::new(IciciAmazonHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "pnb",
            Some("default"),
            Arc::new(PnbHandler) as Arc<dyn BankHandler>,
        );
        registry.register(
            "pnb",
            Some("platinum"),
            Arc::new(PnbPlatinumHandler) as Arc<dyn BankHandler>,
        );
        registry
    })
}

pub fn get_handler(bank: &str, variant: Option<&str>) -> Result<Arc<dyn BankHandler>, StageError> {
    handlers().get(bank, variant)
}

pub fn list_handler_keys() -> Vec<String> {
    handlers().keys()
}

pub fn list_banks() -> Vec<(String, String, Option<String>, String)> {
    handlers()
        .keys()
        .into_iter()
        .filter_map(|key| {
            let parts: Vec<&str> = key.split('/').collect();
            if parts.len() != 2 {
                return None;
            }
            let bank = parts[0].to_string();
            let variant = if parts[1] == "default" {
                Some("default".to_string())
            } else {
                Some(parts[1].to_string())
            };
            Some((key, bank, variant, "credit_card".to_string()))
        })
        .collect()
}

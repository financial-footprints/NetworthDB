use std::sync::{Arc, OnceLock};

use crate::banks::registry::{handler_registry_key, Registry};
use crate::errors::StageError;

use super::bob::BobStatementParser;
use super::csb::CsbStatementParser;
use super::federal::{FederalDefaultParser, FederalEdgeParser, FederalSignetParser};
use super::hdfc::HdfcStatementParser;
use super::icici::IciciStatementParser;
use super::idfc::IdfcWowStatementParser;
use super::indusind::IndusindStatementParser;
use super::onecard::OnecardStatementParser;
use super::pnb::PnbStatementParser;
use super::yes::YesStatementParser;

pub trait StatementParser: Send + Sync {
    fn parse(&self, text: &str, source_file: &str) -> Vec<super::common::Transaction>;
}

struct OnecardParser;
struct YesParser;
struct BobParser;
struct CsbParser;
struct FederalDefaultParserWrapper;
struct FederalSignetParserWrapper;
struct FederalEdgeParserWrapper;
struct IndusindParser;
struct IdfcWowParser;
struct HdfcParser;
struct IciciParser;
struct PnbParser;

impl StatementParser for OnecardParser {
    fn parse(&self, text: &str, source_file: &str) -> Vec<super::common::Transaction> {
        OnecardStatementParser::parse(text, source_file)
    }
}

impl StatementParser for YesParser {
    fn parse(&self, text: &str, source_file: &str) -> Vec<super::common::Transaction> {
        YesStatementParser::parse(text, source_file)
    }
}

impl StatementParser for BobParser {
    fn parse(&self, text: &str, source_file: &str) -> Vec<super::common::Transaction> {
        BobStatementParser::parse(text, source_file)
    }
}

impl StatementParser for CsbParser {
    fn parse(&self, text: &str, source_file: &str) -> Vec<super::common::Transaction> {
        CsbStatementParser::parse(text, source_file)
    }
}

impl StatementParser for FederalDefaultParserWrapper {
    fn parse(&self, text: &str, source_file: &str) -> Vec<super::common::Transaction> {
        FederalDefaultParser::parse(text, source_file)
    }
}

impl StatementParser for FederalSignetParserWrapper {
    fn parse(&self, text: &str, source_file: &str) -> Vec<super::common::Transaction> {
        FederalSignetParser::parse(text, source_file)
    }
}

impl StatementParser for FederalEdgeParserWrapper {
    fn parse(&self, text: &str, source_file: &str) -> Vec<super::common::Transaction> {
        FederalEdgeParser::parse(text, source_file)
    }
}

impl StatementParser for IndusindParser {
    fn parse(&self, text: &str, source_file: &str) -> Vec<super::common::Transaction> {
        IndusindStatementParser::parse(text, source_file)
    }
}

impl StatementParser for IdfcWowParser {
    fn parse(&self, text: &str, source_file: &str) -> Vec<super::common::Transaction> {
        IdfcWowStatementParser::parse(text, source_file)
    }
}

impl StatementParser for HdfcParser {
    fn parse(&self, text: &str, source_file: &str) -> Vec<super::common::Transaction> {
        HdfcStatementParser::parse(text, source_file)
    }
}

impl StatementParser for IciciParser {
    fn parse(&self, text: &str, source_file: &str) -> Vec<super::common::Transaction> {
        IciciStatementParser::parse(text, source_file)
    }
}

impl StatementParser for PnbParser {
    fn parse(&self, text: &str, source_file: &str) -> Vec<super::common::Transaction> {
        PnbStatementParser::parse(text, source_file)
    }
}

fn parsers() -> &'static Registry<Arc<dyn StatementParser>> {
    static REGISTRY: OnceLock<Registry<Arc<dyn StatementParser>>> = OnceLock::new();
    REGISTRY.get_or_init(|| {
        let mut registry = Registry::with_key_fn(None, handler_registry_key);
        registry.register(
            "onecard",
            None,
            Arc::new(OnecardParser) as Arc<dyn StatementParser>,
        );
        registry.register("yes", None, Arc::new(YesParser) as Arc<dyn StatementParser>);
        registry.register(
            "yes",
            Some("ace"),
            Arc::new(YesParser) as Arc<dyn StatementParser>,
        );
        registry.register("bob", None, Arc::new(BobParser) as Arc<dyn StatementParser>);
        registry.register(
            "bob",
            Some("easy"),
            Arc::new(BobParser) as Arc<dyn StatementParser>,
        );
        registry.register("csb", None, Arc::new(CsbParser) as Arc<dyn StatementParser>);
        registry.register(
            "csb",
            Some("edge"),
            Arc::new(CsbParser) as Arc<dyn StatementParser>,
        );
        registry.register(
            "federal",
            None,
            Arc::new(FederalDefaultParserWrapper) as Arc<dyn StatementParser>,
        );
        registry.register(
            "federal",
            Some("signet"),
            Arc::new(FederalSignetParserWrapper) as Arc<dyn StatementParser>,
        );
        registry.register(
            "federal",
            Some("edge"),
            Arc::new(FederalEdgeParserWrapper) as Arc<dyn StatementParser>,
        );
        registry.register(
            "indusind",
            None,
            Arc::new(IndusindParser) as Arc<dyn StatementParser>,
        );
        registry.register(
            "indusind",
            Some("auraedge"),
            Arc::new(IndusindParser) as Arc<dyn StatementParser>,
        );
        registry.register(
            "indusind",
            Some("amex-epay"),
            Arc::new(IndusindParser) as Arc<dyn StatementParser>,
        );
        registry.register(
            "idfc",
            None,
            Arc::new(IdfcWowParser) as Arc<dyn StatementParser>,
        );
        registry.register(
            "idfc",
            Some("wow"),
            Arc::new(IdfcWowParser) as Arc<dyn StatementParser>,
        );
        registry.register(
            "hdfc",
            None,
            Arc::new(HdfcParser) as Arc<dyn StatementParser>,
        );
        registry.register(
            "icici",
            None,
            Arc::new(IciciParser) as Arc<dyn StatementParser>,
        );
        registry.register(
            "icici",
            Some("coral"),
            Arc::new(IciciParser) as Arc<dyn StatementParser>,
        );
        registry.register(
            "icici",
            Some("platinum"),
            Arc::new(IciciParser) as Arc<dyn StatementParser>,
        );
        registry.register(
            "icici",
            Some("amazon"),
            Arc::new(IciciParser) as Arc<dyn StatementParser>,
        );
        registry.register("pnb", None, Arc::new(PnbParser) as Arc<dyn StatementParser>);
        registry.register(
            "pnb",
            Some("platinum"),
            Arc::new(PnbParser) as Arc<dyn StatementParser>,
        );
        registry
    })
}

pub fn get_parser(
    bank: &str,
    variant: Option<&str>,
) -> Result<Arc<dyn StatementParser>, StageError> {
    parsers().get(bank, variant)
}

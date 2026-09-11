use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MailRules {
    pub subjects: Vec<String>,
    pub body_contains: Vec<String>,
    pub from_addresses: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StatementRules {
    pub text_contains: Vec<String>,
    pub text_not_contains: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub user_id: String,
    pub account_type: String,
    pub bank: String,
    pub variant: Option<String>,
    pub label: String,
    pub opening_date: String,
    pub closing_date: Option<String>,
    pub account_number: String,
    pub passwords: Vec<String>,
    pub mail: Option<MailRules>,
    pub statement: Option<StatementRules>,
    pub created_at: String,
    pub updated_at: String,
}

impl Account {
    pub fn has_passwords(&self) -> bool {
        !self.passwords.is_empty()
    }

    pub fn has_mail_settings(&self) -> bool {
        self.mail.as_ref().is_some_and(|mail| {
            !mail.subjects.is_empty()
                || !mail.body_contains.is_empty()
                || !mail.from_addresses.is_empty()
        })
    }

    pub fn has_statement_rules(&self) -> bool {
        self.statement.as_ref().is_some_and(|rules| {
            !rules.text_contains.is_empty() || !rules.text_not_contains.is_empty()
        })
    }

    pub fn normalize_variant(variant: Option<&str>) -> Option<String> {
        match variant {
            None => None,
            Some(v) => {
                let trimmed = v.trim();
                if trimmed.is_empty() || trimmed == "default" {
                    None
                } else {
                    Some(trimmed.to_string())
                }
            }
        }
    }

    pub fn label_from(bank: &str, variant: Option<&str>) -> String {
        match Self::normalize_variant(variant) {
            None => bank.to_string(),
            Some(v) => format!("{} ({})", bank, v),
        }
    }
}

use super::models::Alert;

#[derive(Debug, Clone)]
pub struct AlertService {
    alerts: Vec<Alert>,
}

impl AlertService {
    pub fn new() -> Self {
        Self { alerts: Vec::new() }
    }

    pub fn alerts(&self) -> &[Alert] {
        &self.alerts
    }

    pub fn emit(&mut self, alert: Alert) {
        self.alerts.push(alert);
    }
}

impl Default for AlertService {
    fn default() -> Self {
        Self::new()
    }
}

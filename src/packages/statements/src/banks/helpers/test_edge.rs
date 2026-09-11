use super::inject_edge_summary_labels;

#[test]
fn inject_edge_summary_labels_on_unlabeled_column() {
    let text = "\
    Rs. 500.00                           05/02/2021
                    21/12/2020                                           Rs. 0.00
                                                                       Rs. 180.00
                                                                         Rs. 0.00
                                                                         Rs. 3.50
                                                                         Rs. 0.60
                                                                      Rs. 830.00
                                                                         Rs. 0.00
                                                                      Rs. -650.25";
    let labeled = inject_edge_summary_labels(text);
    assert!(labeled.contains("Opening Balance  21/12/2020  Rs. 0.00"));
    assert!(labeled.contains("Spends  Rs. 180.00"));
    assert!(labeled.contains("Total Amount Due  Rs. -650.25"));
}

#[test]
fn inject_edge_summary_labels_idempotent_when_labeled() {
    let text = "\
                    Opening Balance  21/12/2020  Rs. 0.00
                    Spends  Rs. 180.00
                    Cash Advances  Rs. 0.00
                    Fees & Charges  Rs. 3.50
                    Interest Charges  Rs. 0.60
                    Repayments & Refunds  Rs. 830.00
                    Paid via points  Rs. 0.00
                    Total Amount Due  Rs. -650.25";
    assert_eq!(inject_edge_summary_labels(text), text);
}

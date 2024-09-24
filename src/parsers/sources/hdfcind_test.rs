#[cfg(test)]
mod tests {
    use crate::parsers::sources::hdfcind::get_parser;
    use crate::reader::types::{File, FileType};

    #[test]
    fn test_identify_valid_file() {
        let file = File {
            file_type: FileType::Xls,
            data: vec![
                vec!["HDFC BANK Ltd.".to_string()],
                vec!["Some other data".to_string()],
            ],
        };

        let parser = get_parser();
        assert!(parser.identify(&file));
    }

    #[test]
    fn test_identify_invalid_file_type() {
        let file = File {
            file_type: FileType::Pdf,
            data: vec![
                vec!["HDFC BANK Ltd.".to_string()],
                vec!["Some other data".to_string()],
            ],
        };

        let parser = get_parser();
        assert!(!parser.identify(&file));
    }

    #[test]
    fn test_identify_invalid_file_content() {
        let file = File {
            file_type: FileType::Xls,
            data: vec![
                vec!["Some other bank".to_string()],
                vec!["Some other data".to_string()],
            ],
        };

        let parser = get_parser();
        assert!(!parser.identify(&file));
    }

    #[test]
    fn test_parse_valid_file() {
        let file = File {
            file_type: FileType::Xls,
            data: vec![
                vec![
                    "Date".to_string(),
                    "Narration".to_string(),
                    "Chq./Ref.No.".to_string(),
                    "Value Dt".to_string(),
                    "Withdrawal Amt.".to_string(),
                    "Deposit Amt.".to_string(),
                    "Closing Balance".to_string(),
                ],
                vec!["***".to_string()],
                vec![
                    "01-01-2021".to_string(),
                    "Description 1".to_string(),
                    "".to_string(),
                    "".to_string(),
                    "100.0".to_string(),
                    "0.0".to_string(),
                    "900.0".to_string(),
                ],
                vec![
                    "02-01-2021".to_string(),
                    "Description 2".to_string(),
                    "".to_string(),
                    "".to_string(),
                    "0.0".to_string(),
                    "200.0".to_string(),
                    "1100.0".to_string(),
                ],
                vec!["".to_string(); 7],
            ],
        };

        let parser = get_parser();
        let statements = parser.parse(&file);

        assert_eq!(statements.len(), 2);
        assert_eq!(statements[0].date, "01-01-2021");
        assert_eq!(statements[0].description, "Description 1");
        assert_eq!(statements[0].withdrawal, 100.0);
        assert_eq!(statements[0].deposit, 0.0);
        assert_eq!(statements[0].balance, 900.0);

        assert_eq!(statements[1].date, "02-01-2021");
        assert_eq!(statements[1].description, "Description 2");
        assert_eq!(statements[1].withdrawal, 0.0);
        assert_eq!(statements[1].deposit, 200.0);
        assert_eq!(statements[1].balance, 1100.0);
    }

    #[test]
    #[should_panic(expected = "error.parser.hdfcind.start_of_data_not_found")]
    fn test_parse_missing_data_start() {
        let file = File {
            file_type: FileType::Xls,
            data: vec![vec!["Some other data".to_string()]],
        };

        let parser = get_parser();
        parser.parse(&file);
    }

    #[test]
    #[should_panic(expected = "error.parser.hdfcind.end_of_data_not_found")]
    fn test_parse_missing_data_end() {
        let file = File {
            file_type: FileType::Xls,
            data: vec![
                vec![
                    "Date".to_string(),
                    "Narration".to_string(),
                    "Chq./Ref.No.".to_string(),
                    "Value Dt".to_string(),
                    "Withdrawal Amt.".to_string(),
                    "Deposit Amt.".to_string(),
                    "Closing Balance".to_string(),
                ],
                vec![],
                vec![
                    "01-01-2021".to_string(),
                    "Description 1".to_string(),
                    "".to_string(),
                    "".to_string(),
                    "100.0".to_string(),
                    "0.0".to_string(),
                    "900.0".to_string(),
                ],
            ],
        };

        let parser = get_parser();
        parser.parse(&file);
    }
}

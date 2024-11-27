#[cfg(test)]
mod tests {
    #[cfg(test)]
    mod xls {
        use crate::parsers::sources::hdfcind::get_parser;
        use crate::reader::types::{File, FileData, FileType};

        #[test]
        fn test_identify_valid_file() {
            let file = File {
                file_type: FileType::Xls,
                data: FileData::Table(vec![
                    vec!["HDFC BANK Ltd.".to_string()],
                    vec!["Some other data".to_string()],
                ]),
            };

            let parser = get_parser();
            assert!(parser.identify(&file));
        }

        #[test]
        fn test_identify_invalid_file_content() {
            let file = File {
                file_type: FileType::Xls,
                data: FileData::Table(vec![
                    vec!["Some other bank".to_string()],
                    vec!["Some other data".to_string()],
                ]),
            };

            let parser = get_parser();
            assert!(!parser.identify(&file));
        }

        #[test]
        fn test_parse_valid_file() {
            let file = File {
                file_type: FileType::Xls,
                data: FileData::Table(vec![
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
                ]),
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
                data: FileData::Table(vec![vec!["Some other data".to_string()]]),
            };

            let parser = get_parser();
            parser.parse(&file);
        }

        #[test]
        #[should_panic(expected = "error.parser.hdfcind.end_of_data_not_found")]
        fn test_parse_missing_data_end() {
            let file = File {
                file_type: FileType::Xls,
                data: FileData::Table(vec![
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
                ]),
            };

            let parser = get_parser();
            parser.parse(&file);
        }
    }

    #[cfg(test)]
    mod pdf {
        use crate::parsers::sources::hdfcind::get_parser;
        use crate::reader::types::{File, FileData, FileType};

        fn _common_pdf_data() -> FileData {
            FileData::Text("\nDate \nNarration \nChq./Ref.No. \nValueDt \nWithdrawalAmt. \nDepositAmt. \nClosingBalance \n01/01/23 \nUPI-TESTUSER-TEST@BANK \n0000000000000001 \n01/01/23 \n1,000.00 \n10,000.00 \nTEST-TRANSACTION-1 \n02/01/23 \nNEFT-TESTBANK-TESTUSER \n0000000000000002 \n02/01/23 \n500.00 \n9,500.00 \n03/01/23 \nPOS-TESTSHOP-TESTCITY \n0000000000000003 \n03/01/23 \n200.009,700.00 \nTEST-TRANSACTION-3\n\nTestMore\nPageNo.:1Statementofaccount \nMR.Tester TesterAddress JOINTHOLDERS: Holder1 Nomination:Nomination1 StatementFrom:01/04/1900To:31/03/1910 \nAccountBranch:Branch Address ODLimit:10Currency:INR Email:email@example.com CustID:12345 AccountNo:123456789 A/COpenDate:11/01/1900 AccountStatus:Regular RTGS/NEFTIFSC :HDFC0000001MICR:1000000 BranchCode:000ProductCode:100 HDFCBANKLIMITED *Closingbalanceincludesfundsearmarkedforholdandunclearedfunds Contentsofthisstatementwillbeconsideredcorrectifnoerrorisreportedwithin30daysofreceiptofstatement.TheaddressonthisstatementisthatonrecordwiththeBankasatthedayofrequesting thisstatement. StateaccountbranchGSTN:12345 HDFCBankGSTINnumberdetailsareavailableathttps://www.hdfcbank.com/personal/making-payments/online-tax-payment/goods-and-service-tax. RegisteredOfficeAddress:HDFCBankHouse,SenapatiBapatMarg,LowerParel,Mumbai400013".to_string())
        }

        #[test]
        fn test_identify_valid_file() {
            let file = File {
                file_type: FileType::Pdf,
                data: _common_pdf_data(),
            };

            let parser = get_parser();
            assert!(parser.identify(&file));
        }

        #[test]
        fn test_identify_invalid_file_content() {
            let file = File {
                file_type: FileType::Xls,
                data: FileData::Text("Some other bank".to_string()),
            };

            let parser = get_parser();
            assert!(!parser.identify(&file));
        }

        #[test]
        fn test_parse_valid_file() {
            let file = File {
                file_type: FileType::Pdf,
                data: _common_pdf_data(),
            };

            let parser = get_parser();
            let statements = parser.parse(&file);

            assert_eq!(statements.len(), 3);
            assert_eq!(statements[0].date, "01/01/23");
            assert_eq!(
                statements[0].description,
                "UPI-TESTUSER-TEST@BANKTEST-TRANSACTION-1"
            );
            assert_eq!(statements[0].ref_no, "0000000000000001");
            assert_eq!(statements[0].withdrawal, 1000.0);
            assert_eq!(statements[0].deposit, 0.0);
            assert_eq!(statements[0].balance, 10000.0);

            assert_eq!(statements[1].date, "02/01/23");
            assert_eq!(statements[1].description, "NEFT-TESTBANK-TESTUSER");
            assert_eq!(statements[1].ref_no, "0000000000000002");
            assert_eq!(statements[1].withdrawal, 500.0);
            assert_eq!(statements[1].deposit, 0.0);
            assert_eq!(statements[1].balance, 9500.0);

            assert_eq!(statements[2].date, "03/01/23");
            assert_eq!(
                statements[2].description,
                "POS-TESTSHOP-TESTCITYTEST-TRANSACTION-3TestMore"
            );
            assert_eq!(statements[2].ref_no, "0000000000000003");
            assert_eq!(statements[2].withdrawal, 0.0);
            assert_eq!(statements[2].deposit, 200.0);
            assert_eq!(statements[2].balance, 9700.0);
        }

        #[test]
        #[should_panic(expected = "error.parser.hdfcind.line1_not_found")]
        fn test_parse_missing_data_start() {
            let file = File {
                file_type: FileType::Pdf,
                data: FileData::Text("\n1,000.00 \n10,000.00 \nTEST-TRANSACTION-1 \n \nNEFT-TESTBANK-TESTUSER \n0000000000000002 \n021/23 \n500.00 \n9,500.00 \n03/0123 \nPOS-TESTSHOP-TESTCITY \n0000000000000003 \n001/23 \n200.009,700.00 \nTEST-TRANSACTION-3\n\nTestMore\nPageNo.:1Statementofaccount \nMR.Tester TesterAddress JOINTHOLDERS: Holder1 Nomination:Nomination1 StatementFrom:01/04/1900To:3/1910 \nAccountBranch:Branch Address ODLimit:10Currency:INR Email:email@example.com CustID:12345 AccountNo:123456789 A/COpenDate:11/01/1900 AccountStatus:Regular RTGS/NEFTIFSC :HDFC0000001MICR:1000000 BranchCode:000ProductCode:100 HDFCBANKLIMITED *Closingbalanceincludesfundsearmarkedforholdandunclearedfunds Contentsofthisstatementwillbeconsideredcorrectifnoerrorisreportedwithin30daysofreceiptofstatement.TheaddressonthisstatementisthatonrecordwiththeBankasatthedayofrequesting thisstatement. StateaccountbranchGSTN:12345 HDFCBankGSTINnumberdetailsareavailableathttps://www.hdfcbank.com/personal/making-payments/online-tax-payment/goods-and-service-tax. RegisteredOfficeAddress:HDFCBankHouse,SenapatiBapatMarg,LowerParel,Mumbai400013".to_string()),
            };

            let parser = get_parser();
            parser.parse(&file);
        }
    }
}

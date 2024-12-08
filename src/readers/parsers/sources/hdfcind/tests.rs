use sea_orm::{prelude::DateTimeUtc, sqlx::types::chrono::Utc};

pub fn _today_date_str(date: DateTimeUtc) -> String {
    return date
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_local_timezone(Utc)
        .unwrap()
        .to_string();
}

#[cfg(test)]
mod xls {
    use crate::{
        models::entities::sea_orm_active_enums::AccountType,
        readers::{
            parsers::sources::hdfcind::{get_parser, tests::_today_date_str},
            types::{File, FileData, FileType},
        },
        utils,
    };
    use sea_orm::sqlx::types::chrono::Utc;

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
        assert!(parser.identify(&file).unwrap());
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
        assert!(!parser.identify(&file).unwrap());
    }

    #[test]
    fn test_parse_valid_file() {
        let file = File {
            file_type: FileType::Xls,
            data: FileData::Table(vec![
                vec!["Account No : 123456789".to_string()],
                vec!["Statement From : 01/01/2021 To  : 02/01/2021".to_string()],
                vec!["Statement of accounts".to_string()],
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
                    "01/01/2021".to_string(),
                    "Description 1".to_string(),
                    "".to_string(),
                    "".to_string(),
                    "100.0".to_string(),
                    "0.0".to_string(),
                    "900.0".to_string(),
                ],
                vec![
                    "02/01/2021".to_string(),
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
        let statements = parser.parse(&file).unwrap();

        assert_eq!(
            statements.date,
            utils::datetime::date_str_to_datetime(&"02/01/2021")
        );

        let transactions = &statements.transactions;
        assert_eq!(transactions.len(), 2);
        assert_eq!(
            transactions[0].date,
            utils::datetime::date_str_to_datetime(&"01/01/2021")
        );
        assert_eq!(transactions[0].description, "Description 1");
        assert_eq!(transactions[0].withdrawal, 100.0);
        assert_eq!(transactions[0].deposit, 0.0);
        assert_eq!(transactions[0].balance, 900.0);

        assert_eq!(
            transactions[1].date,
            utils::datetime::date_str_to_datetime(&"02/01/2021")
        );
        assert_eq!(transactions[1].description, "Description 2");
        assert_eq!(transactions[1].withdrawal, 0.0);
        assert_eq!(transactions[1].deposit, 200.0);
        assert_eq!(transactions[1].balance, 1100.0);
    }

    #[test]
    fn test_parse_without_required_data() {
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
                    "01/01/2021".to_string(),
                    "Description 1".to_string(),
                    "".to_string(),
                    "".to_string(),
                    "100.0".to_string(),
                    "0.0".to_string(),
                    "900.0".to_string(),
                ],
                vec!["".to_string(); 7],
            ]),
        };

        let parser = get_parser();
        let statements = parser.parse(&file).unwrap();

        assert_eq!(
            _today_date_str(statements.date),
            _today_date_str(Utc::now())
        );
        assert_eq!(statements.account_type, AccountType::Unknown);
    }

    #[test]
    fn test_parse_missing_data_start() {
        let file = File {
            file_type: FileType::Xls,
            data: FileData::Table(vec![vec!["Some other data".to_string()]]),
        };

        let parser = get_parser();
        assert_eq!(
            parser.parse(&file).unwrap_err(),
            "error.parser.hdfcind.start_of_data_not_found"
        );
    }

    #[test]
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
                    "01/01/2021".to_string(),
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
        assert_eq!(
            parser.parse(&file).unwrap_err(),
            "error.parser.hdfcind.end_of_data_not_found"
        );
    }
}

#[cfg(test)]
mod pdf {
    use crate::{
        models::entities::sea_orm_active_enums::AccountType,
        readers::{
            parsers::sources::hdfcind::{get_parser, tests::_today_date_str},
            types::{File, FileData, FileType},
        },
        utils,
    };
    use sea_orm::sqlx::types::chrono::Utc;

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
        assert!(parser.identify(&file).unwrap());
    }

    #[test]
    fn test_identify_invalid_file_content() {
        let file = File {
            file_type: FileType::Xls,
            data: FileData::Text("Some other bank".to_string()),
        };

        let parser = get_parser();
        assert!(!parser.identify(&file).unwrap());
    }

    #[test]
    fn test_parse_valid_file() {
        let file = File {
            file_type: FileType::Pdf,
            data: _common_pdf_data(),
        };

        let parser = get_parser();
        let statements = parser.parse(&file).unwrap();

        assert_eq!(statements.account_type, AccountType::SavingsAccount);
        assert_eq!(statements.date.to_string(), "1910-03-31 00:00:00 UTC");

        assert_eq!(statements.transactions.len(), 3);

        let transaction = &statements.transactions[0];
        assert_eq!(
            transaction.date,
            utils::datetime::date_str_to_datetime(&"01/01/23")
        );
        assert_eq!(
            transaction.description,
            "UPI-TESTUSER-TEST@BANKTEST-TRANSACTION-1"
        );
        assert_eq!(transaction.ref_no, "0000000000000001");
        assert_eq!(transaction.withdrawal, 1000.0);
        assert_eq!(transaction.deposit, 0.0);
        assert_eq!(transaction.balance, 10000.0);

        let transaction = &statements.transactions[1];
        assert_eq!(
            transaction.date,
            utils::datetime::date_str_to_datetime(&"02/01/23")
        );
        assert_eq!(transaction.description, "NEFT-TESTBANK-TESTUSER");
        assert_eq!(transaction.ref_no, "0000000000000002");
        assert_eq!(transaction.withdrawal, 500.0);
        assert_eq!(transaction.deposit, 0.0);
        assert_eq!(transaction.balance, 9500.0);

        let transaction = &statements.transactions[2];
        assert_eq!(
            transaction.date,
            utils::datetime::date_str_to_datetime(&"03/01/23")
        );
        assert_eq!(
            transaction.description,
            "POS-TESTSHOP-TESTCITYTEST-TRANSACTION-3TestMore"
        );
        assert_eq!(transaction.ref_no, "0000000000000003");
        assert_eq!(transaction.withdrawal, 0.0);
        assert_eq!(transaction.deposit, 200.0);
        assert_eq!(transaction.balance, 9700.0);
    }

    #[test]
    fn test_parse_without_required_data() {
        let file = File {
                file_type: FileType::Pdf,
                data: FileData::Text("\nDate \nNarration \nChq./Ref.No. \nValueDt \nWithdrawalAmt. \nDepositAmt. \nClosingBalance \n01/01/23 \nUPI-TESTUSER-TEST@BANK \n0000000000000001 \n01/01/23 \n1,000.00 \n10,000.00 \nTEST-TRANSACTION-1 \nPageNo.:1 \nMR.Tester TesterAddress JOINTHOLDERS: Holder1 Nomination:Nomination1 StatementFrom:01/04/1900To:A1/03/1910 \nAccountBranch:Branch Address ODLimit:10Currency:INR Email:email@example.com CustID:12345 A/COpenDate:11/01/1900 AccountStatus:Regular RTGS/NEFTIFSC :HDFC0000001MICR:1000000 BranchCode:000ProductCode:100 HDFCBANKLIMITED *Closingbalanceincludesfundsearmarkedforholdandunclearedfunds Contentsofthisstatementwillbeconsideredcorrectifnoerrorisreportedwithin30daysofreceiptofstatement.TheaddressonthisstatementisthatonrecordwiththeBankasatthedayofrequesting thisstatement. StateaccountbranchGSTN:12345 HDFCBankGSTINnumberdetailsareavailableathttps://www.hdfcbank.com/personal/making-payments/online-tax-payment/goods-and-service-tax. RegisteredOfficeAddress:HDFCBankHouse,SenapatiBapatMarg,LowerParel,Mumbai400013".to_string()),
            };

        let parser = get_parser();
        let statements = parser.parse(&file).unwrap();

        assert_eq!(statements.account_type, AccountType::Unknown);
        assert_eq!(
            _today_date_str(statements.date),
            _today_date_str(Utc::now())
        );
    }

    #[test]
    fn test_parse_missing_data_start() {
        let file = File {
                file_type: FileType::Pdf,
                data: FileData::Text("\n1,000.00 \n10,000.00 \nTEST-TRANSACTION-1 \n \nNEFT-TESTBANK-TESTUSER \n0000000000000002 \n021/23 \n500.00 \n9,500.00 \n03/0123 \nPOS-TESTSHOP-TESTCITY \n0000000000000003 \n001/23 \n200.009,700.00 \nTEST-TRANSACTION-3\n\nTestMore\nPageNo.:1Statementofaccount \nMR.Tester TesterAddress JOINTHOLDERS: Holder1 Nomination:Nomination1 StatementFrom:01/04/1900To:3/1910 \nAccountBranch:Branch Address ODLimit:10Currency:INR Email:email@example.com CustID:12345 AccountNo:123456789 A/COpenDate:11/01/1900 AccountStatus:Regular RTGS/NEFTIFSC :HDFC0000001MICR:1000000 BranchCode:000ProductCode:100 HDFCBANKLIMITED *Closingbalanceincludesfundsearmarkedforholdandunclearedfunds Contentsofthisstatementwillbeconsideredcorrectifnoerrorisreportedwithin30daysofreceiptofstatement.TheaddressonthisstatementisthatonrecordwiththeBankasatthedayofrequesting thisstatement. StateaccountbranchGSTN:12345 HDFCBankGSTINnumberdetailsareavailableathttps://www.hdfcbank.com/personal/making-payments/online-tax-payment/goods-and-service-tax. RegisteredOfficeAddress:HDFCBankHouse,SenapatiBapatMarg,LowerParel,Mumbai400013".to_string()),
            };

        let parser = get_parser();
        assert_eq!(
            parser.parse(&file).unwrap_err(),
            "error.parser.hdfcind.line1_not_found"
        );
    }
}

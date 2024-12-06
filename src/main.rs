use networth_db;
mod config;

use sea_orm::EntityTrait;

#[tokio::main]
async fn main() {
    let config = config::get_config().await;
    let statement =
        match networth_db::readers::get_statement_from_file(&config.file_path, &config.file_secret)
        {
            Ok(result) => result,
            Err(error) => panic!("{}", error),
        };

    println!("Statement Details:");
    println!("Account Number: {}", &statement.account_number);
    println!("Account Type: {:?}", &statement.account_type);
    println!("Statement Date: {}", &statement.date);
    println!("\nTransactions:");
    for transaction in &statement.transactions {
        println!(
            "Date: {}, Description: {}, Ref No: {}, Withdrawal: {}, Deposit: {}, Balance: {}",
            transaction.date,
            transaction.description,
            transaction.ref_no,
            transaction.withdrawal,
            transaction.deposit,
            transaction.balance
        );
    }

    match networth_db::models::manage::imports::create_import(&config.db, &statement).await {
        Ok(_) => (),
        Err(error) => panic!("{}", error),
    };

    let imports = networth_db::models::entities::imports::Entity::find()
        .all(&config.db)
        .await;

    println!("\nImports:");
    match imports {
        Ok(imports) => {
            for import in imports {
                println!(
                    "Id: {}, Account: {}, File At: {}, Created At: {}",
                    import.id, import.account_number, import.source_file_date, import.import_date
                );
            }
        }
        Err(e) => println!("Error fetching imports: {}", e),
    }
}

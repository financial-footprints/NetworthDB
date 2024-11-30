//! Filling the gaps where seaORM fails to generate desired entity

// I've spend too much time to get sea-orm to generate the account enum
// for me, but for the love of god, I can't figure out how to do it.
// So, I am manually defining it here and leaving the problem for later.
// It's possible that the problem is due the fact that seaORM doesn't have
// First class support with SQLLite, it might work automatically with Postgres
pub mod account;

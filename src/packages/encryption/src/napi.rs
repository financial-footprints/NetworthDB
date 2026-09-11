//! NAPI boundary — exports are called from Bun/JavaScript, not from Rust.

#![allow(dead_code)]

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::key::{decode_key, KeyError};
use crate::nwenc::{self, decrypt_bytes, encrypt_bytes, is_encrypted_blob, NwencError};

fn key_error(err: KeyError) -> Error {
    Error::new(Status::GenericFailure, err.to_string())
}

fn nwenc_error(err: NwencError) -> Error {
    Error::new(Status::GenericFailure, err.to_string())
}

#[napi]
pub const DATA_KEY_LEN: u32 = nwenc::DATA_KEY_LEN as u32;

#[napi(js_name = "decodeKey")]
pub fn decode_key_napi(raw: String) -> Result<Buffer> {
    decode_key(&raw).map(Buffer::from).map_err(key_error)
}

#[napi]
pub fn encrypt(key: Buffer, plaintext: Buffer) -> Result<Buffer> {
    encrypt_bytes(key.as_ref(), plaintext.as_ref())
        .map(Buffer::from)
        .map_err(nwenc_error)
}

#[napi]
pub fn decrypt(key: Buffer, blob: Buffer) -> Result<Buffer> {
    decrypt_bytes(key.as_ref(), blob.as_ref())
        .map(Buffer::from)
        .map_err(nwenc_error)
}

#[napi(js_name = "isEncrypted")]
pub fn is_encrypted(blob: Buffer) -> bool {
    is_encrypted_blob(blob.as_ref())
}

#[napi(js_name = "encryptString")]
pub fn encrypt_string(key: Buffer, plaintext: String) -> Result<Buffer> {
    encrypt_bytes(key.as_ref(), plaintext.as_bytes())
        .map(Buffer::from)
        .map_err(nwenc_error)
}

#[napi(js_name = "decryptString")]
pub fn decrypt_string(key: Buffer, blob: Buffer) -> Result<String> {
    let plaintext = decrypt_bytes(key.as_ref(), blob.as_ref()).map_err(nwenc_error)?;
    String::from_utf8(plaintext).map_err(|_| {
        Error::new(
            Status::GenericFailure,
            "encryption.nwenc.decrypt.invalid-utf8",
        )
    })
}

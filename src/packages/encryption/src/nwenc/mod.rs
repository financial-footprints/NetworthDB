use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};

pub const DATA_KEY_LEN: usize = 32;
const NWENC_MAGIC: &[u8] = b"NWENC1\n";
const NONCE_LEN: usize = 12;
const AUTH_TAG_LEN: usize = 16;

#[derive(Debug, thiserror::Error)]
pub enum NwencError {
    #[error("encryption.nwenc.invalid.key-length")]
    InvalidKeyLength,
    #[error("encryption.nwenc.invalid.not-nwenc1-blob")]
    NotNwencBlob,
    #[error("encryption.nwenc.invalid.blob-format")]
    InvalidBlobFormat,
    #[error("encryption.nwenc.decrypt.failed")]
    DecryptFailed,
}

pub fn is_encrypted_blob(data: &[u8]) -> bool {
    data.len() >= NWENC_MAGIC.len() && data.starts_with(NWENC_MAGIC)
}

pub fn encrypt_bytes(key: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, NwencError> {
    if key.len() != DATA_KEY_LEN {
        return Err(NwencError::InvalidKeyLength);
    }

    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| NwencError::InvalidKeyLength)?;
    let nonce_bytes = rand_nonce()?;
    let nonce = Nonce::from(nonce_bytes);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|_| NwencError::DecryptFailed)?;

    let packed = format!(
        "{}.{}",
        b64url_encode(&nonce_bytes),
        b64url_encode(&ciphertext)
    );

    let mut blob = Vec::with_capacity(NWENC_MAGIC.len() + packed.len());
    blob.extend_from_slice(NWENC_MAGIC);
    blob.extend_from_slice(packed.as_bytes());
    Ok(blob)
}

pub fn decrypt_bytes(key: &[u8], blob: &[u8]) -> Result<Vec<u8>, NwencError> {
    if !is_encrypted_blob(blob) {
        return Err(NwencError::NotNwencBlob);
    }
    if key.len() != DATA_KEY_LEN {
        return Err(NwencError::InvalidKeyLength);
    }

    let packed = &blob[NWENC_MAGIC.len()..];
    let packed_str = std::str::from_utf8(packed).map_err(|_| NwencError::InvalidBlobFormat)?;
    let separator = packed_str.find('.').ok_or(NwencError::InvalidBlobFormat)?;
    let nonce = b64url_decode(
        packed_str
            .get(..separator)
            .ok_or(NwencError::InvalidBlobFormat)?,
    )?;
    let combined = b64url_decode(
        packed_str
            .get(separator + 1..)
            .ok_or(NwencError::InvalidBlobFormat)?,
    )?;

    if combined.len() < AUTH_TAG_LEN {
        return Err(NwencError::InvalidBlobFormat);
    }

    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| NwencError::InvalidKeyLength)?;
    let nonce = Nonce::try_from(nonce.as_slice()).map_err(|_| NwencError::InvalidBlobFormat)?;
    cipher
        .decrypt(&nonce, combined.as_ref())
        .map_err(|_| NwencError::DecryptFailed)
}

fn rand_nonce() -> Result<[u8; NONCE_LEN], NwencError> {
    let mut nonce = [0u8; NONCE_LEN];
    getrandom::fill(&mut nonce).map_err(|_| NwencError::DecryptFailed)?;
    Ok(nonce)
}

fn b64url_encode(data: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(data)
}

fn b64url_decode(data: &str) -> Result<Vec<u8>, NwencError> {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(data)
        .map_err(|_| NwencError::InvalidBlobFormat)
}

#[cfg(test)]
pub(crate) fn encrypt_bytes_with_nonce(
    key: &[u8],
    plaintext: &[u8],
    nonce_bytes: &[u8; NONCE_LEN],
) -> Result<Vec<u8>, NwencError> {
    if key.len() != DATA_KEY_LEN {
        return Err(NwencError::InvalidKeyLength);
    }

    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| NwencError::InvalidKeyLength)?;
    let nonce = Nonce::from(*nonce_bytes);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|_| NwencError::DecryptFailed)?;

    let packed = format!(
        "{}.{}",
        b64url_encode(nonce_bytes),
        b64url_encode(&ciphertext)
    );

    let mut blob = Vec::with_capacity(NWENC_MAGIC.len() + packed.len());
    blob.extend_from_slice(NWENC_MAGIC);
    blob.extend_from_slice(packed.as_bytes());
    Ok(blob)
}

#[cfg(test)]
mod test_nwenc;

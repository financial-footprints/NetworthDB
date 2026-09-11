use crate::nwenc::DATA_KEY_LEN;

const HEX_KEY_LEN: usize = DATA_KEY_LEN * 2;

#[derive(Debug, thiserror::Error)]
pub enum KeyError {
    #[error("encryption.key.empty")]
    Empty,
    #[error("encryption.key.invalid-length")]
    InvalidLength,
    #[error("encryption.key.invalid-encoding")]
    InvalidEncoding,
}

pub fn decode_key(raw: &str) -> Result<Vec<u8>, KeyError> {
    let value = raw.trim();
    if value.is_empty() {
        return Err(KeyError::Empty);
    }

    let key = if is_hex_key(value) {
        hex::decode(value).map_err(|_| KeyError::InvalidEncoding)?
    } else {
        b64url_decode(value).map_err(|_| KeyError::InvalidEncoding)?
    };

    if key.len() != DATA_KEY_LEN {
        return Err(KeyError::InvalidLength);
    }

    Ok(key)
}

fn is_hex_key(value: &str) -> bool {
    value.len() == HEX_KEY_LEN && value.bytes().all(|b| b.is_ascii_hexdigit())
}

fn b64url_decode(data: &str) -> Result<Vec<u8>, ()> {
    use base64::Engine;
    let padding = "=".repeat((4 - (data.len() % 4)) % 4);
    let normalized = data.replace('-', "+").replace('_', "/");
    base64::engine::general_purpose::STANDARD
        .decode(format!("{normalized}{padding}"))
        .map_err(|_| ())
}

#[cfg(test)]
mod test_key;

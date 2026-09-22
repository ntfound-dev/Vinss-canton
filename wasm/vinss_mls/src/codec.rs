use openmls::prelude::{
    MlsMessageIn,
    MlsMessageOut,
};
use tls_codec::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

pub(crate) fn encode_message(
    message: &MlsMessageOut,
) -> Result<Vec<u8>, JsError> {
    message
        .tls_serialize_detached()
        .map_err(|error| {
            JsError::new(&format!(
                "MLS message serialization failed: {error}"
            ))
        })
}

pub(crate) fn decode_message(
    bytes: &[u8],
) -> Result<MlsMessageIn, JsError> {
    let mut input = bytes;

    MlsMessageIn::tls_deserialize(&mut input)
        .map_err(|error| {
            JsError::new(&format!(
                "MLS message decode failed: {error}"
            ))
        })
}

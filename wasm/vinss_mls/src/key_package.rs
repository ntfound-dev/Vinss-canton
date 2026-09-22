use openmls::{
    key_packages::{
        KeyPackage as OpenMlsKeyPackage,
        KeyPackageIn,
    },
    prelude::ProtocolVersion,
};
use openmls_rust_crypto::RustCrypto;
use tls_codec::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct KeyPackage(pub(crate) OpenMlsKeyPackage);

#[wasm_bindgen]
impl KeyPackage {
    pub fn to_bytes(&self) -> Result<Vec<u8>, JsError> {
        self.0
            .tls_serialize_detached()
            .map_err(|error| {
                JsError::new(&format!(
                    "KeyPackage serialization failed: {error}"
                ))
            })
    }

    pub fn from_bytes(
        bytes: &[u8],
    ) -> Result<KeyPackage, JsError> {
        let mut input = bytes;

        let key_package =
            KeyPackageIn::tls_deserialize(&mut input)
                .map_err(|error| {
                    JsError::new(&format!(
                        "KeyPackage decode failed: {error}"
                    ))
                })?;

        let validated = key_package
            .validate(
                &RustCrypto::default(),
                ProtocolVersion::Mls10,
            )
            .map_err(|error| {
                JsError::new(&format!(
                    "KeyPackage validation failed: {error}"
                ))
            })?;

        Ok(KeyPackage(validated))
    }
}

use wasm_bindgen::prelude::*;

/// Bootstrap-only export.
///
/// We deliberately do not expose fake encrypt/decrypt functions here.
/// The next change will wire real OpenMLS group state, credentials,
/// KeyPackages, Welcome processing, commits, and application messages.
#[wasm_bindgen]
pub fn vinss_mls_api_version() -> String {
    "vinss-mls/0.1-openmls-0.9".to_owned()
}

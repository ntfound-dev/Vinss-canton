mod codec;
mod config;
mod group;
mod identity;
mod key_package;
mod provider;

pub use group::{AddMemberResult, Group, ProcessResult};
pub use identity::Identity;
pub use key_package::KeyPackage;
pub use provider::Provider;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn vinss_mls_api_version() -> String {
    "vinss-mls/0.2-openmls-0.9".to_owned()
}

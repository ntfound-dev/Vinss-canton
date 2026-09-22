use openmls_rust_crypto::OpenMlsRustCrypto;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Default)]
pub struct Provider(pub(crate) OpenMlsRustCrypto);

impl AsRef<OpenMlsRustCrypto> for Provider {
    fn as_ref(&self) -> &OpenMlsRustCrypto {
        &self.0
    }
}

impl AsMut<OpenMlsRustCrypto> for Provider {
    fn as_mut(&mut self) -> &mut OpenMlsRustCrypto {
        &mut self.0
    }
}

#[wasm_bindgen]
impl Provider {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }
}

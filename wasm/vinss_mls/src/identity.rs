use crate::{
    config::CIPHERSUITE,
    key_package::KeyPackage,
    provider::Provider,
};
use openmls::prelude::*;
use openmls_basic_credential::SignatureKeyPair;
use openmls_traits::OpenMlsProvider;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Identity {
    pub(crate) credential: CredentialWithKey,
    pub(crate) signer: SignatureKeyPair,
}

#[wasm_bindgen]
impl Identity {
    #[wasm_bindgen(constructor)]
    pub fn new(
        provider: &Provider,
        identity: &str,
    ) -> Result<Identity, JsError> {
        let credential =
            BasicCredential::new(identity.as_bytes().to_vec());

        let signer =
            SignatureKeyPair::new(CIPHERSUITE.signature_algorithm())?;

        signer.store(provider.as_ref().storage())?;

        let credential = CredentialWithKey {
            credential: credential.into(),
            signature_key: signer.to_public_vec().into(),
        };

        Ok(Self {
            credential,
            signer,
        })
    }

    pub fn create_key_package(
        &self,
        provider: &Provider,
    ) -> Result<KeyPackage, JsError> {
        let bundle = openmls::prelude::KeyPackage::builder()
            .key_package_extensions(Extensions::empty())
            .build(
                CIPHERSUITE,
                provider.as_ref(),
                &self.signer,
                self.credential.clone(),
            )?;

        Ok(KeyPackage(bundle.key_package().to_owned()))
    }
}

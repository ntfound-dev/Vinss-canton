use crate::{
    codec::{decode_message, encode_message},
    config::CIPHERSUITE,
    identity::Identity,
    key_package::KeyPackage,
    provider::Provider,
};

use openmls::prelude::*;
use openmls_traits::OpenMlsProvider;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Group {
    inner: MlsGroup,
}

#[wasm_bindgen]
pub struct AddMemberResult {
    commit: Vec<u8>,
    welcome: Vec<u8>,
}

#[wasm_bindgen]
impl AddMemberResult {
    #[wasm_bindgen(getter)]
    pub fn commit(&self) -> Vec<u8> {
        self.commit.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn welcome(&self) -> Vec<u8> {
        self.welcome.clone()
    }
}

#[wasm_bindgen]
pub struct ProcessResult {
    kind: String,
    payload: Vec<u8>,
    epoch: u64,
}

impl ProcessResult {
    fn new(
        kind: &str,
        payload: Vec<u8>,
        epoch: u64,
    ) -> Self {
        Self {
            kind: kind.to_owned(),
            payload,
            epoch,
        }
    }
}

#[wasm_bindgen]
impl ProcessResult {
    #[wasm_bindgen(getter)]
    pub fn kind(&self) -> String {
        self.kind.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn payload(&self) -> Vec<u8> {
        self.payload.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn epoch(&self) -> u64 {
        self.epoch
    }
}

#[wasm_bindgen]
impl Group {
    pub fn create(
        provider: &Provider,
        founder: &Identity,
        group_id: &str,
    ) -> Result<Group, JsError> {
        let config = MlsGroupCreateConfig::builder()
            .ciphersuite(CIPHERSUITE)
            .use_ratchet_tree_extension(true)
            .build();

        let inner = MlsGroup::new_with_group_id(
            provider.as_ref(),
            &founder.signer,
            &config,
            GroupId::from_slice(group_id.as_bytes()),
            founder.credential.clone(),
        )?;

        Ok(Self { inner })
    }

    pub fn join(
        provider: &Provider,
        welcome_bytes: &[u8],
    ) -> Result<Group, JsError> {
        let welcome = match decode_message(welcome_bytes)?.extract() {
            MlsMessageBodyIn::Welcome(welcome) => welcome,
            other => {
                return Err(JsError::new(&format!(
                    "Expected MLS Welcome, got {other:?}"
                )));
            }
        };

        let config = MlsGroupJoinConfig::builder()
            .use_ratchet_tree_extension(true)
            .build();

        let inner = StagedWelcome::new_from_welcome(
            provider.as_ref(),
            &config,
            welcome,
            None,
        )?
        .into_group(provider.as_ref())?;

        Ok(Self { inner })
    }

    pub fn epoch(&self) -> u64 {
        self.inner.epoch().as_u64()
    }

    pub fn member_count(&self) -> usize {
        self.inner.members().count()
    }

    pub fn member_index(
        &self,
        identity: &str,
    ) -> Option<u32> {
        let identity = identity.as_bytes();

        self.inner.members().find_map(|member| {
            if member.credential.serialized_content() == identity {
                Some(member.index.u32())
            } else {
                None
            }
        })
    }

    pub fn add_member(
        &mut self,
        provider: &Provider,
        sender: &Identity,
        new_member: &KeyPackage,
    ) -> Result<AddMemberResult, JsError> {
        let (commit, welcome, _) = self.inner.add_members(
            provider.as_ref(),
            &sender.signer,
            &[new_member.0.clone()],
        )?;

        Ok(AddMemberResult {
            commit: encode_message(&commit)?,
            welcome: encode_message(&welcome)?,
        })
    }

    pub fn remove_member(
        &mut self,
        provider: &Provider,
        sender: &Identity,
        leaf_index: u32,
    ) -> Result<Vec<u8>, JsError> {
        let (commit, _, _) = self.inner.remove_members(
            provider.as_ref(),
            &sender.signer,
            &[LeafNodeIndex::new(leaf_index)],
        )?;

        encode_message(&commit)
    }

    pub fn merge_pending_commit(
        &mut self,
        provider: &mut Provider,
    ) -> Result<(), JsError> {
        // Advance local state only after the commit was accepted for delivery.
        self.inner
            .merge_pending_commit(provider.as_mut())?;

        Ok(())
    }

    pub fn encrypt(
        &mut self,
        provider: &Provider,
        sender: &Identity,
        plaintext: &[u8],
    ) -> Result<Vec<u8>, JsError> {
        let message = self.inner.create_message(
            provider.as_ref(),
            &sender.signer,
            plaintext,
        )?;

        encode_message(&message)
    }

    pub fn process(
        &mut self,
        provider: &mut Provider,
        message_bytes: &[u8],
    ) -> Result<ProcessResult, JsError> {
        let protocol_message = decode_message(message_bytes)?
            .try_into_protocol_message()
            .map_err(|error| {
                JsError::new(&format!(
                    "Expected MLS protocol message: {error}"
                ))
            })?;

        let processed = self
            .inner
            .process_message(
                provider.as_ref(),
                protocol_message,
            )?;

        let epoch = processed.epoch().as_u64();

        match processed.into_content() {
            ProcessedMessageContent::ApplicationMessage(message) => {
                Ok(ProcessResult::new(
                    "application",
                    message.into_bytes(),
                    epoch,
                ))
            }

            ProcessedMessageContent::ProposalMessage(proposal) => {
                self.inner.store_pending_proposal(
                    provider.as_ref().storage(),
                    *proposal,
                )?;

                Ok(ProcessResult::new(
                    "proposal",
                    Vec::new(),
                    epoch,
                ))
            }

            ProcessedMessageContent::StagedCommitMessage(commit) => {
                self.inner.merge_staged_commit(
                    provider.as_mut(),
                    *commit,
                )?;

                Ok(ProcessResult::new(
                    "commit",
                    Vec::new(),
                    epoch,
                ))
            }

            ProcessedMessageContent::OwnPendingCommit => {
                self.inner
                    .merge_pending_commit(provider.as_mut())?;

                Ok(ProcessResult::new(
                    "own_commit",
                    Vec::new(),
                    epoch,
                ))
            }

            ProcessedMessageContent::OwnPrivateMessage => {
                Ok(ProcessResult::new(
                    "own_private",
                    Vec::new(),
                    epoch,
                ))
            }

            _ => Ok(ProcessResult::new(
                "control",
                Vec::new(),
                epoch,
            )),
        }
    }
}

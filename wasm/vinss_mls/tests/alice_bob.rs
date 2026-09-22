use openmls::prelude::*;
use openmls_basic_credential::SignatureKeyPair;
use openmls_rust_crypto::OpenMlsRustCrypto;
use openmls_traits::OpenMlsProvider;

const CIPHERSUITE: Ciphersuite =
    Ciphersuite::MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519;

fn credential(
    identity: &[u8],
    provider: &OpenMlsRustCrypto,
) -> (CredentialWithKey, SignatureKeyPair) {
    let credential = BasicCredential::new(identity.to_vec());

    let signer =
        SignatureKeyPair::new(CIPHERSUITE.signature_algorithm())
            .expect("create signature keypair");

    signer
        .store(provider.storage())
        .expect("store signature keypair");

    (
        CredentialWithKey {
            credential: credential.into(),
            signature_key: signer.to_public_vec().into(),
        },
        signer,
    )
}

#[test]
fn alice_bob_group_rekeys_after_bob_is_removed() {
    let alice_provider = OpenMlsRustCrypto::default();
    let bob_provider = OpenMlsRustCrypto::default();

    let (alice_credential, alice_signer) =
        credential(b"Alice", &alice_provider);

    let (bob_credential, bob_signer) =
        credential(b"Bob", &bob_provider);

    let bob_key_package = KeyPackage::builder()
        .key_package_extensions(Extensions::empty())
        .build(
            CIPHERSUITE,
            &bob_provider,
            &bob_signer,
            bob_credential,
        )
        .expect("build Bob KeyPackage")
        .key_package()
        .to_owned();

    let config = MlsGroupCreateConfig::builder()
        .ciphersuite(CIPHERSUITE)
        .use_ratchet_tree_extension(true)
        .build();

    let mut alice_group = MlsGroup::new_with_group_id(
        &alice_provider,
        &alice_signer,
        &config,
        GroupId::from_slice(b"vinss-alice-bob"),
        alice_credential,
    )
    .expect("Alice creates group");

    let (_, welcome, _) = alice_group
        .add_members(
            &alice_provider,
            &alice_signer,
            &[bob_key_package],
        )
        .expect("Alice adds Bob");

    alice_group
        .merge_pending_commit(&alice_provider)
        .expect("Alice merges add commit");

    assert_eq!(alice_group.members().count(), 2);

    let welcome: MlsMessageIn = welcome.into();

    let welcome = match welcome.extract() {
        MlsMessageBodyIn::Welcome(welcome) => welcome,
        _ => panic!("expected Welcome message"),
    };

    let mut bob_group =
        StagedWelcome::new_from_welcome(
            &bob_provider,
            config.join_config(),
            welcome,
            None,
        )
        .expect("Bob stages Welcome")
        .into_group(&bob_provider)
        .expect("Bob joins group");

    let epoch_before =
        alice_group.epoch_authenticator().as_slice().to_vec();

    let message = alice_group
        .create_message(
            &alice_provider,
            &alice_signer,
            b"hello Bob",
        )
        .expect("Alice encrypts");

    let message: MlsMessageIn = message.into();

    let processed = bob_group
        .process_message(
            &bob_provider,
            message
                .try_into_protocol_message()
                .expect("protocol message"),
        )
        .expect("Bob decrypts");

    match processed.into_content() {
        ProcessedMessageContent::ApplicationMessage(message) => {
            assert_eq!(message.into_bytes(), b"hello Bob");
        }
        other => panic!(
            "expected application message, got {other:?}"
        ),
    }

    alice_group
        .remove_members(
            &alice_provider,
            &alice_signer,
            &[LeafNodeIndex::new(1)],
        )
        .expect("Alice removes Bob");

    alice_group
        .merge_pending_commit(&alice_provider)
        .expect("Alice merges removal");

    assert_eq!(alice_group.members().count(), 1);

    assert_ne!(
        epoch_before,
        alice_group.epoch_authenticator().as_slice()
    );

    let secret_message = alice_group
        .create_message(
            &alice_provider,
            &alice_signer,
            b"Bob must not decrypt this",
        )
        .expect("post removal message");

    let secret_message: MlsMessageIn = secret_message.into();

    let result = bob_group.process_message(
        &bob_provider,
        secret_message
            .try_into_protocol_message()
            .expect("protocol message"),
    );

    assert!(
        result.is_err(),
        "removed Bob decrypted new MLS epoch"
    );
}

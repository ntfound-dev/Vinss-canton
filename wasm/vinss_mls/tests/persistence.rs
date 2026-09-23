use vinss_mls::{
    Group,
    Identity,
    Provider,
};

#[test]
fn restores_provider_identity_and_group() {
    let provider =
        Provider::new();

    let identity =
        Identity::new(
            &provider,
            "alice:browser",
        )
        .expect(
            "create identity",
        );

    let public_key =
        identity.public_key();

    let mut group =
        Group::create(
            &provider,
            &identity,
            "persistent-deal",
        )
        .expect(
            "create group",
        );

    assert_eq!(
        group.member_count(),
        1,
    );

    let epoch_before =
        group.epoch();

    let before =
        group
            .encrypt(
                &provider,
                &identity,
                b"before restore",
            )
            .expect(
                "encrypt before restore",
            );

    assert!(
        !before.is_empty(),
    );

    let snapshot =
        provider
            .export_storage()
            .expect(
                "export OpenMLS storage",
            );

    assert!(
        !snapshot.is_empty(),
    );

    drop(group);
    drop(identity);
    drop(provider);

    let mut restored_provider =
        Provider::new();

    restored_provider
        .import_storage(
            &snapshot,
        )
        .expect(
            "import OpenMLS storage",
        );

    let restored_identity =
        Identity::load(
            &restored_provider,
            "alice:browser",
            &public_key,
        )
        .expect(
            "restore identity",
        );

    let mut restored_group =
        Group::load(
            &restored_provider,
            "persistent-deal",
        )
        .expect(
            "restore group",
        );

    assert_eq!(
        restored_group.epoch(),
        epoch_before,
    );

    assert_eq!(
        restored_group.member_count(),
        1,
    );

    let after =
        restored_group
            .encrypt(
                &restored_provider,
                &restored_identity,
                b"after restore",
            )
            .expect(
                "encrypt after restore",
            );

    assert!(
        !after.is_empty(),
    );
}

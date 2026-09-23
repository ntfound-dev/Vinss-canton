use crate::provider::Provider;

use openmls_traits::OpenMlsProvider;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

const MAGIC: &[u8; 8] = b"VINSSMLS";
const FORMAT_VERSION: u16 = 1;

const MAX_SNAPSHOT_BYTES: usize =
    128 * 1024 * 1024;

const MAX_RECORDS: u64 =
    1_000_000;

#[wasm_bindgen]
impl Provider {
    /// Export the complete OpenMLS storage working set.
    ///
    /// This contains private cryptographic material.
    /// The browser must encrypt these bytes before durable persistence.
    pub fn export_storage(
        &self,
    ) -> Result<Vec<u8>, JsError> {
        let values = self
            .as_ref()
            .storage()
            .values
            .read()
            .map_err(|_| {
                JsError::new(
                    "OpenMLS storage lock poisoned",
                )
            })?;

        let mut records =
            values.iter().collect::<Vec<_>>();

        // Stable output makes checkpoints easier to test.
        records.sort_unstable_by(
            |(left, _), (right, _)| {
                left.cmp(right)
            },
        );

        let mut output =
            Vec::new();

        output.extend_from_slice(
            MAGIC,
        );

        output.extend_from_slice(
            &FORMAT_VERSION
                .to_be_bytes(),
        );

        push_u64(
            &mut output,
            records.len() as u64,
        );

        for (key, value) in records {
            push_u64(
                &mut output,
                key.len() as u64,
            );

            push_u64(
                &mut output,
                value.len() as u64,
            );

            output.extend_from_slice(
                key,
            );

            output.extend_from_slice(
                value,
            );
        }

        Ok(output)
    }

    /// Replace the complete OpenMLS storage working set.
    pub fn import_storage(
        &mut self,
        bytes: &[u8],
    ) -> Result<(), JsError> {
        let restored =
            decode_snapshot(bytes)
                .map_err(
                    |error| {
                        JsError::new(
                            &error,
                        )
                    },
                )?;

        let mut values = self
            .as_ref()
            .storage()
            .values
            .write()
            .map_err(|_| {
                JsError::new(
                    "OpenMLS storage lock poisoned",
                )
            })?;

        // Replace instead of merge.
        // Stale cryptographic state must not survive a restore.
        *values = restored;

        Ok(())
    }
}

fn decode_snapshot(
    bytes: &[u8],
) -> Result<
    HashMap<Vec<u8>, Vec<u8>>,
    String,
> {
    if (
        bytes.len() >
        MAX_SNAPSHOT_BYTES
    ) {
        return Err(
            "OpenMLS snapshot is too large"
                .to_owned(),
        );
    }

    let mut reader =
        Reader::new(bytes);

    let magic =
        reader.read_exact(
            MAGIC.len(),
        )?;

    if magic != MAGIC {
        return Err(
            "Invalid OpenMLS snapshot magic"
                .to_owned(),
        );
    }

    let version =
        reader.read_u16()?;

    if version != FORMAT_VERSION {
        return Err(format!(
            "Unsupported OpenMLS snapshot version: {version}"
        ));
    }

    let count =
        reader.read_u64()?;

    if count > MAX_RECORDS {
        return Err(
            "OpenMLS snapshot contains too many records"
                .to_owned(),
        );
    }

    let mut values =
        HashMap::with_capacity(
            usize::try_from(count)
                .map_err(|_| {
                    "OpenMLS record count overflow"
                        .to_owned()
                })?,
        );

    for _ in 0..count {
        let key_length =
            reader.read_length()?;

        let value_length =
            reader.read_length()?;

        let key =
            reader
                .read_exact(
                    key_length,
                )?
                .to_vec();

        let value =
            reader
                .read_exact(
                    value_length,
                )?
                .to_vec();

        if (
            values
                .insert(
                    key,
                    value,
                )
                .is_some()
        ) {
            return Err(
                "Duplicate OpenMLS storage key"
                    .to_owned(),
            );
        }
    }

    if !reader.is_finished() {
        return Err(
            "Trailing bytes in OpenMLS snapshot"
                .to_owned(),
        );
    }

    Ok(values)
}

fn push_u64(
    output: &mut Vec<u8>,
    value: u64,
) {
    output.extend_from_slice(
        &value.to_be_bytes(),
    );
}

struct Reader<'a> {
    bytes: &'a [u8],
    position: usize,
}

impl<'a> Reader<'a> {
    fn new(
        bytes: &'a [u8],
    ) -> Self {
        Self {
            bytes,
            position: 0,
        }
    }

    fn read_exact(
        &mut self,
        length: usize,
    ) -> Result<
        &'a [u8],
        String,
    > {
        let end = self
            .position
            .checked_add(length)
            .ok_or_else(|| {
                "OpenMLS snapshot length overflow"
                    .to_owned()
            })?;

        if end > self.bytes.len() {
            return Err(
                "Truncated OpenMLS snapshot"
                    .to_owned(),
            );
        }

        let result =
            &self.bytes[
                self.position..end
            ];

        self.position = end;

        Ok(result)
    }

    fn read_u16(
        &mut self,
    ) -> Result<u16, String> {
        let bytes =
            self.read_exact(2)?;

        Ok(
            u16::from_be_bytes(
                [bytes[0], bytes[1]],
            ),
        )
    }

    fn read_u64(
        &mut self,
    ) -> Result<u64, String> {
        let bytes =
            self.read_exact(8)?;

        Ok(
            u64::from_be_bytes(
                bytes
                    .try_into()
                    .map_err(|_| {
                        "Invalid OpenMLS integer"
                            .to_owned()
                    })?,
            ),
        )
    }

    fn read_length(
        &mut self,
    ) -> Result<usize, String> {
        usize::try_from(
            self.read_u64()?,
        )
        .map_err(|_| {
            "OpenMLS snapshot length overflow"
                .to_owned()
        })
    }

    fn is_finished(
        &self,
    ) -> bool {
        self.position ==
            self.bytes.len()
    }
}

use anchor_lang::prelude::*;

#[error]
pub enum ScrtEscrowErrors {
    #[msg("Initializer token amount must be greater or equal to 1")]
    InvalidInitializerTokenlockAmount,

    #[msg("Taker token amount must be greater or equal to 1")]
    InvalidTakerTokenlockAmount,
}

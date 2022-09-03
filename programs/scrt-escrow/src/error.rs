use anchor_lang::prelude::*;

#[error]
pub enum ScrtEscrowErrors {
    #[msg("Initializer token amount must be greater or equal to 1")]
    InvalidInitializerTokenAmount,

    #[msg("Taker token amount must be greater or equal to 1")]
    InvalidTakerTokenAmount,

    #[msg("Initializer token amount is not enough")]
    InitializerTokenAmountInsufficient,

    #[msg("Taker token amount is not enough")]
    TakerTokenAmountInsufficient,

    #[msg("Initializer fee amount is not enough")]
    InitializerFeeAmountInsufficient,

    #[msg("Taker fee amount is not enough")]
    TakerFeeAmountInsufficient,
}

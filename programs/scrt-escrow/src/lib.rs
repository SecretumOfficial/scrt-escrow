use anchor_lang::prelude::*;
use anchor_spl::token::{self};
use spl_token::instruction::AuthorityType;

pub mod account;
use account::*;

declare_id!("Hv4LktuBNs6T62X7LEkmqJZseGvVCxwCkAjqFq3pZqCb");

#[program]
pub mod scrt_escrow {
    use super::*;

    const ESCROW_PDA_SEED: &[u8] = b"escrow";

    pub fn initialize(
        ctx: Context<Initialize>,
        initializer_amount: u64,
        taker_amount: u64,
        fee_amount_token_a: u64,
        fee_amount_token_b: u64,
    ) -> ProgramResult {
        //check amounts
        if initializer_amount < fee_amount_token_a {
            return Err(ProgramError::Custom(4001));
        }

        if taker_amount < fee_amount_token_b {
            return Err(ProgramError::Custom(4002));
        }

        ctx.accounts.escrow_account.initializer_key = *ctx.accounts.initializer.key;
        ctx.accounts
            .escrow_account
            .initializer_deposit_token_account = *ctx
            .accounts
            .initializer_deposit_token_account
            .to_account_info()
            .key;
        ctx.accounts
            .escrow_account
            .initializer_receive_token_account = *ctx
            .accounts
            .initializer_receive_token_account
            .to_account_info()
            .key;
        ctx.accounts.escrow_account.vault_account =
            *ctx.accounts.vault_account.to_account_info().key;

        ctx.accounts.escrow_account.initializer_amount = initializer_amount;
        ctx.accounts.escrow_account.taker_amount = taker_amount;

        let (vault_authority, _vault_authority_bump) = Pubkey::find_program_address(
            &[
                ESCROW_PDA_SEED,
                ctx.accounts.escrow_account.to_account_info().key.as_ref(),
            ],
            ctx.program_id,
        );
        token::set_authority(
            ctx.accounts.into_set_authority_context(),
            AuthorityType::AccountOwner,
            Some(vault_authority),
        )?;

        token::transfer(
            ctx.accounts.into_transfer_to_pda_context(),
            ctx.accounts.escrow_account.initializer_amount,
        )?;

        ctx.accounts.escrow_account.initialized = 1;
        ctx.accounts.escrow_account.fee_collect_token_a_account = *ctx
            .accounts
            .fee_collect_token_a_account
            .to_account_info()
            .key;
        ctx.accounts.escrow_account.fee_collect_token_b_account = *ctx
            .accounts
            .fee_collect_token_b_account
            .to_account_info()
            .key;
        ctx.accounts.escrow_account.fee_amount_token_a = fee_amount_token_a;
        ctx.accounts.escrow_account.fee_amount_token_b = fee_amount_token_b;
        Ok(())
    }

    pub fn cancel(ctx: Context<Cancel>) -> ProgramResult {
        let (_vault_authority, vault_authority_bump) = Pubkey::find_program_address(
            &[
                ESCROW_PDA_SEED,
                ctx.accounts.escrow_account.to_account_info().key.as_ref(),
            ],
            ctx.program_id,
        );
        let authority_seeds = &[
            &ESCROW_PDA_SEED[..],
            ctx.accounts.escrow_account.to_account_info().key.as_ref(),
            &[vault_authority_bump],
        ];

        token::transfer(
            ctx.accounts
                .into_transfer_to_initializer_context()
                .with_signer(&[&authority_seeds[..]]),
            ctx.accounts.escrow_account.initializer_amount,
        )?;

        token::close_account(
            ctx.accounts
                .into_close_context()
                .with_signer(&[&authority_seeds[..]]),
        )?;

        ctx.accounts.escrow_account.initialized = 0;
        Ok(())
    }

    pub fn exchange(ctx: Context<Exchange>) -> ProgramResult {
        let (_vault_authority, vault_authority_bump) = Pubkey::find_program_address(
            &[
                ESCROW_PDA_SEED,
                ctx.accounts.escrow_account.to_account_info().key.as_ref(),
            ],
            ctx.program_id,
        );
        let authority_seeds = &[
            &ESCROW_PDA_SEED[..],
            ctx.accounts.escrow_account.to_account_info().key.as_ref(),
            &[vault_authority_bump],
        ];

        //collect fee
        token::transfer(
            ctx.accounts.into_transfer_to_fee_collct_b_context(),
            ctx.accounts.escrow_account.fee_amount_token_b,
        )?;

        token::transfer(
            ctx.accounts
                .into_transfer_to_fee_collct_a_context()
                .with_signer(&[&authority_seeds[..]]),
            ctx.accounts.escrow_account.fee_amount_token_a,
        )?;

        token::transfer(
            ctx.accounts.into_transfer_to_initializer_context(),
            ctx.accounts.escrow_account.taker_amount
                - ctx.accounts.escrow_account.fee_amount_token_b,
        )?;

        token::transfer(
            ctx.accounts
                .into_transfer_to_taker_context()
                .with_signer(&[&authority_seeds[..]]),
            ctx.accounts.escrow_account.initializer_amount
                - ctx.accounts.escrow_account.fee_amount_token_a,
        )?;

        token::close_account(
            ctx.accounts
                .into_close_context()
                .with_signer(&[&authority_seeds[..]]),
        )?;
        ctx.accounts.escrow_account.initialized = 0;
        Ok(())
    }
}

use anchor_lang::prelude::*;
use anchor_spl::token::{self};
use spl_token::instruction::AuthorityType;

pub mod account;
pub mod error;

use account::*;
use error::*;

declare_id!("Hv4LktuBNs6T62X7LEkmqJZseGvVCxwCkAjqFq3pZqCb");

#[program]
pub mod scrt_escrow {
    use super::*;

    const ESCROW_PDA_SEED: &[u8] = b"escrow";

    pub fn initialize_pda(ctx: Context<InitializePda>) -> ProgramResult {
        let (vault_fee_authority, _vault_authority_bump) = Pubkey::find_program_address(
            &[
                ctx.accounts.pda_account.to_account_info().key.as_ref(),
                ESCROW_PDA_SEED,
            ],
            ctx.program_id,
        );
        //set vault fee account authority
        token::set_authority(
            ctx.accounts.into_set_authority_context(),
            AuthorityType::AccountOwner,
            Some(vault_fee_authority),
        )?;

        //set authority
        ctx.accounts.pda_account.initializer_key = *ctx.accounts.initializer.key;
        ctx.accounts.pda_account.fee_token = *ctx.accounts.fee_token.key;
        ctx.accounts.pda_account.vault_fee_account =
            *ctx.accounts.vault_fee_account.to_account_info().key;
        ctx.accounts.pda_account.vault_fee_authority = vault_fee_authority;
        Ok(())
    }

    pub fn initialize(
        ctx: Context<Initialize>,
        initializer_amount: u64,
        taker_amount: u64,
        fee_amount_initializer: u64,
        fee_amount_taker: u64,
    ) -> ProgramResult {
        // check amounts
        if initializer_amount == 0{
            return Err(ScrtEscrowErrors::InvalidInitializerTokenlockAmount.into());
        }
        if taker_amount == 0{
            return Err(ScrtEscrowErrors::InvalidTakerTokenlockAmount.into());
        }

        //initializer
        ctx.accounts.escrow_account.initializer_key = *ctx.accounts.initializer.key;
        //initializer_deposit
        ctx.accounts
            .escrow_account
            .initializer_deposit_token_account = *ctx
            .accounts
            .initializer_deposit_token_account
            .to_account_info()
            .key;
        //initializer_receive
        ctx.accounts
            .escrow_account
            .initializer_receive_token_account = *ctx
            .accounts
            .initializer_receive_token_account
            .to_account_info()
            .key;
        //vault
        ctx.accounts.escrow_account.vault_account =
            *ctx.accounts.vault_account.to_account_info().key;

        //vault authority
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
        ctx.accounts.escrow_account.vault_authority = vault_authority;


        //deposit token
        ctx.accounts.escrow_account.deposit_token = *ctx.accounts.deposit_token.key;
        //recevie token
        ctx.accounts.escrow_account.receive_token = *ctx.accounts.receive_token.key;
        //fee token
        ctx.accounts.escrow_account.fee_token = *ctx.accounts.fee_token.key;

        //trading amounts
        ctx.accounts.escrow_account.initializer_amount = initializer_amount;
        ctx.accounts.escrow_account.taker_amount = taker_amount;

        //deposit initializer token
        token::transfer(
            ctx.accounts.into_transfer_to_vault_context(),
            ctx.accounts.escrow_account.initializer_amount,
        )?;

        //deposit fee from initializer fee paying token
        if fee_amount_initializer > 0{
            token::transfer(
                ctx.accounts.into_transfer_fee_to_vault_fee_context(),
                fee_amount_initializer,
            )?;    
        }

        ctx.accounts.escrow_account.initialized = 1;
        //fee colecting account
        ctx.accounts.escrow_account.fee_collect_token_account =
            *ctx.accounts.fee_collect_token_account.to_account_info().key;

        //fee amounts
        ctx.accounts.escrow_account.fee_amount_initializer = fee_amount_initializer;
        ctx.accounts.escrow_account.fee_amount_taker = fee_amount_taker;

        // initializer fee paying token account
        ctx.accounts
            .escrow_account
            .initializer_fee_paying_token_account = *ctx
            .accounts
            .initializer_fee_paying_token_account
            .to_account_info()
            .key;
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

        //withdraw initilzier token
        token::transfer(
            ctx.accounts
                .into_transfer_to_initializer_context()
                .with_signer(&[&authority_seeds[..]]),
            ctx.accounts.escrow_account.initializer_amount,
        )?;

        //withdraw fee
        let (_vault_fee_authority, vault_fee_authority_bump) = Pubkey::find_program_address(
            &[
                ctx.accounts.pda_account.to_account_info().key.as_ref(),
                ESCROW_PDA_SEED
            ],
            ctx.program_id,
        );        
        let authority_seeds1 = &[
            ctx.accounts.pda_account.to_account_info().key.as_ref(),
            &ESCROW_PDA_SEED[..],
            &[vault_fee_authority_bump],
        ];

        if ctx.accounts.escrow_account.fee_amount_initializer > 0{
            token::transfer(
                ctx.accounts
                    .into_transfer_to_initializer_fee_paying_context()
                    .with_signer(&[&authority_seeds1[..]]),
                ctx.accounts.escrow_account.fee_amount_initializer,
            )?;    
        }

        ctx.accounts.escrow_account.initialized = 0;
        //close
        token::close_account(
            ctx.accounts
                .into_close_vault_context()
                .with_signer(&[&authority_seeds[..]]),
        )?;
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

        // take taker fee
        if ctx.accounts.escrow_account.fee_amount_taker > 0{
            token::transfer(
                ctx.accounts.into_transfer_fee_from_taker_context(),
                ctx.accounts.escrow_account.fee_amount_taker,
            )?;    
        }

        let (_vault_fee_authority, vault_fee_authority_bump) = Pubkey::find_program_address(
            &[
                ctx.accounts.pda_account.to_account_info().key.as_ref(),
                ESCROW_PDA_SEED
            ],
            ctx.program_id,
        );        
        let authority_seeds1 = &[
            ctx.accounts.pda_account.to_account_info().key.as_ref(),
            &ESCROW_PDA_SEED[..],
            &[vault_fee_authority_bump],
        ];

        // take initializer fee from valut
        if ctx.accounts.escrow_account.fee_amount_initializer > 0{
            token::transfer(
                ctx.accounts
                    .into_transfer_fee_from_vault_context()
                    .with_signer(&[&authority_seeds1[..]]),
                ctx.accounts.escrow_account.fee_amount_initializer,
            )?;    
        }

        //exchange tokens
        token::transfer(
            ctx.accounts.into_transfer_to_initializer_context(),
            ctx.accounts.escrow_account.taker_amount,
        )?;

        token::transfer(
            ctx.accounts
                .into_transfer_to_taker_context()
                .with_signer(&[&authority_seeds[..]]),
            ctx.accounts.escrow_account.initializer_amount,
        )?;

        //close account
        token::close_account(
            ctx.accounts
                .into_close_vault_context()
                .with_signer(&[&authority_seeds[..]]),
        )?;
        ctx.accounts.escrow_account.initialized = 0;
        Ok(())
    }
}

use anchor_lang::prelude::*;
use anchor_spl::token::{CloseAccount, SetAuthority, TokenAccount, Transfer};

#[account]
#[derive(Default)]
pub struct PdaAccount {
    pub initializer_key: Pubkey,
    pub signer_pubkey: Vec<u8>,
}

#[account]
#[derive(Default)]
pub struct EscrowAccount {
    pub initializer_key: Pubkey,
    pub initializer_deposit_token_account: Pubkey,
    pub initializer_receive_token_account: Pubkey,
    pub initializer_fee_paying_token_account: Pubkey,    
    pub vault_account: Pubkey,
    pub vault_fee_account: Pubkey,
    pub initializer_amount: u64,
    pub taker_amount: u64,
    pub initialized: u8,
    pub fee_collect_token_account: Pubkey,
    pub fee_amount_initializer: u64,
    pub fee_amount_taker: u64,
}

#[derive(Accounts)]
#[instruction(initializer_amount: u64, fee_amount_initializer: u64)]
pub struct Initialize<'info> {
    #[account(mut, signer)]
    pub initializer: AccountInfo<'info>,
    pub deposit_token: AccountInfo<'info>,
    #[account(init,
        seeds = [initializer.key.as_ref(), deposit_token.key.as_ref(), receive_token.key.as_ref()],
        bump,
        payer = initializer,
        space = 8 + 32 * 6 + 8 + 8 + 1 + 32 + 8 + 8
    )]
    pub escrow_account: ProgramAccount<'info, EscrowAccount>,

    #[account(
        init,
        seeds = [escrow_account.to_account_info().key.as_ref()],
        bump,
        payer = initializer,
        token::mint = deposit_token,
        token::authority = initializer,
    )]
    pub vault_account: Box<Account<'info, TokenAccount>>,

    // //token for fee collecting
    pub fee_token : AccountInfo<'info>,

    #[account(
        constraint = initializer_fee_paying_token_account.mint == *fee_token.key,
        constraint = *fee_collect_token_account.to_account_info().owner == *token_program.key,
    )]
    pub fee_collect_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        seeds = [escrow_account.to_account_info().key.as_ref(), fee_token.key.as_ref()],
        bump,
        payer = initializer,
        token::mint = fee_token,
        token::authority = initializer,
    )]
    pub vault_fee_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = *initializer_deposit_token_account.to_account_info().owner == *token_program.key,
        constraint = initializer_deposit_token_account.amount >= initializer_amount,
        constraint = initializer_deposit_token_account.mint == *deposit_token.key,
        constraint = initializer_deposit_token_account.owner == *initializer.key
    )]
    pub initializer_deposit_token_account: Box<Account<'info, TokenAccount>>,

    pub receive_token: AccountInfo<'info>,
    #[account(
        constraint = *initializer_receive_token_account.to_account_info().owner == *token_program.key,
        constraint = initializer_receive_token_account.mint == *receive_token.key,
        constraint = initializer_receive_token_account.owner == *initializer.key
    )]
    pub initializer_receive_token_account: Box<Account<'info, TokenAccount>>,

    // //token for paying fee
    #[account(
        mut,
        constraint = initializer_fee_paying_token_account.mint == *fee_token.key,
        constraint = initializer_fee_paying_token_account.amount >= fee_amount_initializer,
        constraint = initializer_fee_paying_token_account.owner == *initializer.key
    )]
    pub initializer_fee_paying_token_account: Box<Account<'info, TokenAccount>>,


    #[account(address = anchor_spl::token::ID)]
    pub token_program: AccountInfo<'info>,

    pub system_program: AccountInfo<'info>,

    pub rent: Sysvar<'info, Rent>,
}

impl<'info> Initialize<'info> {
    pub fn into_transfer_to_pda_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self
                .initializer_deposit_token_account
                .to_account_info()
                .clone(),
            to: self.vault_account.to_account_info().clone(),
            authority: self.initializer.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    pub fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.vault_account.to_account_info().clone(),
            current_authority: self.initializer.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    pub fn into_transfer_to_vault_fee_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self
                .initializer_fee_paying_token_account
                .to_account_info()
                .clone(),
            to: self.vault_fee_account.to_account_info().clone(),
            authority: self.initializer.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    pub fn into_set_authority_vault_fee_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.vault_fee_account.to_account_info().clone(),
            current_authority: self.initializer.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}

/////////Cancel////////////////
#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(mut, signer)]
    pub initializer: AccountInfo<'info>,
    #[account(mut,
        constraint = escrow_account.vault_account == *vault_account.to_account_info().key,
    )]
    pub vault_account: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = escrow_account.vault_fee_account== *vault_fee_account.to_account_info().key,
    )]
    pub vault_fee_account: Box<Account<'info, TokenAccount>>,
    pub vault_authority: AccountInfo<'info>,

    #[account(mut)]
    pub initializer_deposit_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub initializer_fee_paying_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = escrow_account.initializer_key == *initializer.key,
        constraint = escrow_account.initializer_deposit_token_account == *initializer_deposit_token_account.to_account_info().key,
        constraint = escrow_account.initializer_fee_paying_token_account == *initializer_fee_paying_token_account.to_account_info().key,
        close = initializer
    )]
    pub escrow_account: ProgramAccount<'info, EscrowAccount>,

    #[account(address = anchor_spl::token::ID)]
    pub token_program: AccountInfo<'info>,
}

impl<'info> Cancel<'info> {
    pub fn into_transfer_to_initializer_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.vault_account.to_account_info().clone(),
            to: self
                .initializer_deposit_token_account
                .to_account_info()
                .clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    pub fn into_close_context(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        let cpi_accounts = CloseAccount {
            account: self.vault_account.to_account_info().clone(),
            destination: self.initializer.clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    pub fn into_transfer_to_initializer_fee_paying_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.vault_fee_account.to_account_info().clone(),
            to: self
                .initializer_fee_paying_token_account
                .to_account_info()
                .clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    pub fn into_close_vault_fee_context(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        let cpi_accounts = CloseAccount {
            account: self.vault_fee_account.to_account_info().clone(),
            destination: self.initializer.clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

}

///////////Exchange///////////////////
#[derive(Accounts)]
pub struct Exchange<'info> {
    #[account(mut, signer)]
    pub taker: AccountInfo<'info>,

    #[account(mut,
        constraint = taker_deposit_token_account.owner == *taker.key,
        constraint = taker_deposit_token_account.amount >= escrow_account.taker_amount,
        constraint = *taker_deposit_token_account.to_account_info().owner == *token_program.key,
    )]
    pub taker_deposit_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut,
        constraint = taker_receive_token_account.owner == *taker.key,
        constraint = taker_receive_token_account.mint == vault_account.mint,
        constraint = *taker_receive_token_account.to_account_info().owner == *token_program.key,
    )]
    pub taker_receive_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut,
        constraint = initializer_receive_token_account.mint == taker_deposit_token_account.mint,
        constraint = *initializer_receive_token_account.to_account_info().key == escrow_account.initializer_receive_token_account
    )]
    pub initializer_receive_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub initializer: AccountInfo<'info>,

    #[account(
        mut,
        constraint = escrow_account.initializer_key == *initializer.key,
        close = initializer
    )]
    pub escrow_account: ProgramAccount<'info, EscrowAccount>,

    #[account(mut,
        constraint = escrow_account.vault_account == *vault_account.to_account_info().key,
    )]
    pub vault_account: Box<Account<'info, TokenAccount>>,

    #[account(mut,
        constraint = escrow_account.vault_fee_account == *vault_fee_account.to_account_info().key,
    )]
    pub vault_fee_account: Box<Account<'info, TokenAccount>>,

    #[account(mut,
        constraint = *fee_collect_token_account.to_account_info().key == escrow_account.fee_collect_token_account,
    )]
    pub fee_collect_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut,
        constraint = taker_fee_paying_token_account.owner == *taker.key,
        constraint = taker_fee_paying_token_account.mint == fee_collect_token_account.mint,
        constraint = taker_fee_paying_token_account.owner == *taker.key,
        constraint = taker_fee_paying_token_account.amount >= escrow_account.fee_amount_taker,
    )]
    pub taker_fee_paying_token_account: Box<Account<'info, TokenAccount>>,

    pub vault_authority: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
}

impl<'info> Exchange<'info> {
    pub fn into_transfer_to_initializer_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.taker_deposit_token_account.to_account_info().clone(),
            to: self
                .initializer_receive_token_account
                .to_account_info()
                .clone(),
            authority: self.taker.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
    pub fn into_transfer_to_fee_collct_b_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.taker_fee_paying_token_account.to_account_info().clone(),
            to: self.fee_collect_token_account.to_account_info().clone(),
            authority: self.taker.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    pub fn into_transfer_to_taker_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.vault_account.to_account_info().clone(),
            to: self.taker_receive_token_account.to_account_info().clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    pub fn into_transfer_to_fee_collct_a_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.vault_fee_account.to_account_info().clone(),
            to: self.fee_collect_token_account.to_account_info().clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    pub fn into_close_context(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        let cpi_accounts = CloseAccount {
            account: self.vault_account.to_account_info().clone(),
            destination: self.initializer.clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    pub fn into_close_vault_fee_context(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        let cpi_accounts = CloseAccount {
            account: self.vault_fee_account.to_account_info().clone(),
            destination: self.initializer.clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

}

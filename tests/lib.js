const anchor = require('@project-serum/anchor');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const utils = require('../lib/utils');

const PDA_SEED  = "ser-escrow";

async function initializePda(
    program,
    feeToken,
    signer,
) {

    const [pdaAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [program.programId.toBuffer(), feeToken.toBuffer(), Buffer.from(PDA_SEED)], program.programId);

    const [vaultFeeAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [pdaAccount.toBuffer()], program.programId);
    
    const pdaData = await utils.getPdaAccount(program, pdaAccount);
    if(pdaData == null)
    {
        await program.rpc.initializePda(
            {
                accounts: {
                    initializer: signer.publicKey,
                    pdaAccount,
                    vaultFeeAccount,
                    feeToken,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: anchor.web3.SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                },
                signers: [signer],
            },
        );
        return 'ok';
    } else{
        return 'alreday exist';
    }
}


async function initialize(
    program,    
    initDepositTokenAmount,
    takerAmount,
    depositToken,
    initDepositTokenAcc,
    receiveToken,    
    initReceiveTokenAcc,
    feeToken,
    feeCollectTokenAccount,    
    feeAmountInitializer,
    feeAmountTaker,
    initFeePayTokenAcc,
    signer,
) {

    const [pdaAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [program.programId.toBuffer(), feeToken.toBuffer(), Buffer.from(PDA_SEED)], program.programId);
    const pdaData = await utils.getPdaAccount(program, pdaAccount);
    if(pdaData == null){
        return 'pda is not initialized';
    }

    const [escrow] = await anchor.web3.PublicKey.findProgramAddress(
        [signer.publicKey.toBuffer(), depositToken.toBuffer(), receiveToken.toBuffer()], program.programId);
    const [vaultAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [escrow.toBuffer()], program.programId);
    const [vaultFeeAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [escrow.toBuffer(), feeToken.toBuffer()], program.programId);
    
    const escrowData = await utils.getEscrowAccount(program, escrow);
    if(escrowData == null)
    {
        await program.rpc.initialize(
            new anchor.BN(initDepositTokenAmount),
            new anchor.BN(takerAmount),
            new anchor.BN(feeAmountInitializer),
            new anchor.BN(feeAmountTaker),
            {
                accounts: {
                    initializer: signer.publicKey,
                    feeToken,
                    pdaAccount,
                    escrowAccount: escrow,
                    vaultAccount: vaultAccount,
                    depositToken: depositToken,
                    initializerDepositTokenAccount: initDepositTokenAcc,
                    receiveToken: receiveToken,
                    initializerReceiveTokenAccount: initReceiveTokenAcc,                    
                    vaultFeeAccount: pdaData.vaultFeeAccount,
                    feeCollectTokenAccount,
                    initializerFeePayingTokenAccount: initFeePayTokenAcc,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: anchor.web3.SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                },
                signers: [signer],
            },
        );
        return 'ok';
    } else{
        return 'alreday started';
    }
}

async function cancel(
    program,
    depositToken,
    receiveToken,
    feeToken,
    signer,
) {

    const [pdaAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [program.programId.toBuffer(), feeToken.toBuffer(), Buffer.from(PDA_SEED)], program.programId);
    const pdaData = await utils.getPdaAccount(program, pdaAccount);
    if(pdaData == null){
        return 'pda is not initialized';
    }

    const [escrow] = await anchor.web3.PublicKey.findProgramAddress(
        [signer.publicKey.toBuffer(), depositToken.toBuffer(), receiveToken.toBuffer()], program.programId);

    const escrowData = await utils.getEscrowAccount(program, escrow);
    if(escrowData == null)
    {
        return 'no exist escrow';
    }

    await program.rpc.cancel(
        {
            accounts: {
                initializer: signer.publicKey,
                pdaAccount,
                escrowAccount: escrow,
                vaultAccount: escrowData.vaultAccount,
                vaultAuthority: escrowData.vaultAuthority,          
                vaultFeeAccount: pdaData.vaultFeeAccount,
                vaultFeeAuthority: pdaData.vaultFeeAuthority,
                initializerDepositTokenAccount: escrowData.initializerDepositTokenAccount,
                initializerFeePayingTokenAccount: escrowData.initializerFeePayingTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [signer],
        },
    );
}

async function exchange(
    program,
    initializer,
    depositToken,
    receiveToken,
    takerDepositToken,
    takerReceiveToken,
    takerFeePayAcc,
    feeToken,
    signer,
) {

    const [pdaAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [program.programId.toBuffer(), feeToken.toBuffer(), Buffer.from(PDA_SEED)], program.programId);
    const pdaData = await utils.getPdaAccount(program, pdaAccount);
    if(pdaData == null){
        return 'pda is not initialized';
    }

    const [escrow] = await anchor.web3.PublicKey.findProgramAddress(
        [initializer.toBuffer(), depositToken.toBuffer(), receiveToken.toBuffer()], program.programId);

    const escrowData = await utils.getEscrowAccount(program, escrow);
    if(escrowData == null)
    {
        return 'no exist escrow';
    }
    if(escrowData.initialized == 0)
    {
        return 'escrow is not initailized';
    }

    await program.rpc.exchange(
        {
            accounts: {
                taker: signer.publicKey,
                pdaAccount,
                initializer,
                escrowAccount: escrow,
                takerDepositTokenAccount: takerDepositToken,
                takerReceiveTokenAccount: takerReceiveToken,
                initializerReceiveTokenAccount: escrowData.initializerReceiveTokenAccount,
                vaultAccount: escrowData.vaultAccount,
                vaultAuthority: escrowData.vaultAuthority,
                vaultFeeAccount: pdaData.vaultFeeAccount,
                vaultFeeAuthority: pdaData.vaultFeeAuthority,
                feeCollectTokenAccount: escrowData.feeCollectTokenAccount,
                takerFeePayingTokenAccount: takerFeePayAcc,                
                tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [signer],
        },
    );
    return "ok";
}

module.exports = {
    initializePda,
    initialize,
    cancel,
    exchange,
}


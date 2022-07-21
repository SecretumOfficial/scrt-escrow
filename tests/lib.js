const anchor = require('@project-serum/anchor');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const utils = require('../lib/utils');


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
                    escrowAccount: escrow,
                    vaultAccount: vaultAccount,
                    depositToken: depositToken,
                    initializerDepositTokenAccount: initDepositTokenAcc,
                    receiveToken: receiveToken,
                    initializerReceiveTokenAccount: initReceiveTokenAcc,
                    feeToken,
                    vaultFeeAccount,
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
    signer,
) {

    const [escrow] = await anchor.web3.PublicKey.findProgramAddress(
        [signer.publicKey.toBuffer(), depositToken.toBuffer(), receiveToken.toBuffer()], program.programId);

    const escrowData = await utils.getEscrowAccount(program, escrow);
    if(escrowData == null)
    {
        return 'no exist escrow';
    }

    const [vaultAuthority] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from('escrow'), escrow.toBuffer()], program.programId);

    await program.rpc.cancel(
        {
            accounts: {
                initializer: signer.publicKey,
                escrowAccount: escrow,
                vaultAccount: escrowData.vaultAccount,
                vaultFeeAccount: escrowData.vaultFeeAccount,
                vaultAuthority: vaultAuthority,                
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
    signer,
) {

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

    const [vaultAuthority] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from('escrow'), escrow.toBuffer()], program.programId);

    await program.rpc.exchange(
        {
            accounts: {
                taker: signer.publicKey,
                takerDepositTokenAccount: takerDepositToken,
                takerReceiveTokenAccount: takerReceiveToken,
                initializerReceiveTokenAccount: escrowData.initializerReceiveTokenAccount,
                initializer: initializer,
                escrowAccount: escrow,
                vaultAccount: escrowData.vaultAccount,
                vaultFeeAccount: escrowData.vaultFeeAccount,
                feeCollectTokenAccount: escrowData.feeCollectTokenAccount,
                takerFeePayingTokenAccount: takerFeePayAcc,
                vaultAuthority: vaultAuthority,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [signer],
        },
    );
    return "ok";
}

module.exports = {
    initialize,   
    cancel,
    exchange,
}


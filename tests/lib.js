const anchor = require('@project-serum/anchor');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const utils = require('../lib/utils');

async function initializeSigner(program, signer, pubkey){
    const [pdaAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [program.programId.toBuffer(), Buffer.from('signer_pda')], program.programId);

    const pdaData = await utils.getPdaAccount(program, pdaAccount);
    if(pdaData == null){
        await program.rpc.initializeSigner(
            pubkey,
            {
                accounts: {
                    initializer: signer.publicKey,
                    pdaAccount: pdaAccount,
                    systemProgram: anchor.web3.SystemProgram.programId,
                },
                signers: [signer],
            },
        );
        return 'ok';
    }else{
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
    signer,
) {

    const [escrow] = await anchor.web3.PublicKey.findProgramAddress(
        [signer.publicKey.toBuffer(), depositToken.toBuffer(), receiveToken.toBuffer()], program.programId);
    const [vaultAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [escrow.toBuffer()], program.programId);

    const escrowData = await utils.getEscrowAccount(program, escrow);
    if(escrowData == null)
    {
        await program.rpc.initialize(
            new anchor.BN(initDepositTokenAmount),
            new anchor.BN(takerAmount),
            {
                accounts: {
                    initializer: signer.publicKey,
                    escrowAccount: escrow,
                    vaultAccount: vaultAccount,
                    depositToken: depositToken,
                    initializerDepositTokenAccount: initDepositTokenAcc,
                    receiveToken: receiveToken,
                    initializerReceiveTokenAccount: initReceiveTokenAcc,
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
                vaultAuthority: vaultAuthority,
                initializerDepositTokenAccount: escrowData.initializerDepositTokenAccount,
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
    feeCollectTokenAAccount,
    feeCollectTokenBAccount,
    tokenAFee,
    tokenBFee,
    r,
    s,
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

    const [pdaAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [program.programId.toBuffer(), Buffer.from('signer_pda')], program.programId);

    const  pdaData=  await utils.getPdaAccount(pdaAccount);
    // if(pdaData == null){
    //     return 'no initialized PDA';
    // }
    // console.log("pda=", pdaData);

    const [vaultAuthority] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from('escrow'), escrow.toBuffer()], program.programId);

    await program.rpc.exchange(
        new anchor.BN(tokenAFee),
        new anchor.BN(tokenBFee),
        r, s,
        {
            accounts: {
                taker: signer.publicKey,
                takerDepositTokenAccount: takerDepositToken,
                takerReceiveTokenAccount: takerReceiveToken,
                initializerReceiveTokenAccount: escrowData.initializerReceiveTokenAccount,
                initializer: initializer,
                escrowAccount: escrow,
                vaultAccount: escrowData.vaultAccount,
                signerPdaAccount: pdaAccount,
                feeCollectTokenAAccount: feeCollectTokenAAccount,
                feeCollectTokenBAccount: feeCollectTokenBAccount,
                vaultAuthority: vaultAuthority,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [signer],
        },
    );
    return "ok";
}

module.exports = {
    initializeSigner,
    initialize,   
    cancel,
    exchange,
}


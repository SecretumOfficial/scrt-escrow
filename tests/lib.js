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
    signer,
) {

    const [escrow] = await anchor.web3.PublicKey.findProgramAddress(
        [signer.publicKey.toBuffer(), depositToken.toBuffer(), receiveToken.toBuffer()], program.programId);
    const [vaultAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [escrow.toBuffer()], program.programId);

    const escrowData = await getEscrowAccount(program, escrow);
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

async function getEscrowAccount(program, escrowAccount)
{
    try{
        const accData = await program.account.escrowAccount.fetch(escrowAccount);
        return accData;
    }catch(e)
    {
        return null;
    }  
}

async function getEscrowAccountData(program, initializer, depositToken,  receiveToken)
{
    const [escrow] = await anchor.web3.PublicKey.findProgramAddress(
        [initializer.toBuffer(), depositToken.toBuffer(), receiveToken.toBuffer()], program.programId);
    return await getEscrowAccount(program, escrow);
}

async function cancel(
    program,
    depositToken,
    receiveToken,
    signer,
) {

    const [escrow] = await anchor.web3.PublicKey.findProgramAddress(
        [signer.publicKey.toBuffer(), depositToken.toBuffer(), receiveToken.toBuffer()], program.programId);

    const escrowData = await getEscrowAccount(program, escrow);
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
    signer,
) {

    const [escrow] = await anchor.web3.PublicKey.findProgramAddress(
        [initializer.toBuffer(), depositToken.toBuffer(), receiveToken.toBuffer()], program.programId);

    const escrowData = await getEscrowAccount(program, escrow);
    if(escrowData == null)
    {
        return 'no exist escrow';
    }
    if(escrowData.initialized == 0)
    {
        return 'escrow is not initailized';
    }

    // const takerDepositTokenAccount = await utils.getAssociatedTokenAddress(receiveToken, signer.publicKey, false);
    // const takerReceiveTokenAccount = await utils.getAssociatedTokenAddress(depositToken, signer.publicKey, false);    

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
                vaultAuthority: vaultAuthority,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [signer],
        },
    );
}

module.exports = {
    initialize,   
    cancel,
    exchange,
    getEscrowAccountData,
}


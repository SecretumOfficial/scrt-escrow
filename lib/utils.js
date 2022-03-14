const splToken = require('@solana/spl-token');
const anchor = require('@project-serum/anchor');

async function performInstructions(connection, signers, insts) {
    const trx = new anchor.web3.Transaction().add(...insts);
    trx.feePayer = signers[0].publicKey;
    trx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
    trx.sign(...signers);

    const transactionSignature = await connection.sendRawTransaction(
        trx.serialize(),
        { skipPreflight: true },
    );

    const confirmRes = await connection.confirmTransaction(transactionSignature);
    if (confirmRes.value.err == null) {
        return [true, null];
    }

    console.log(confirmRes.value.err);
    return [false, confirmRes.value.err];
}

async function getAssociatedTokenAddress(mintAddr, owner, allowOwnerOffCurve = false) {
    const mint = new splToken.Token(
        null,
        mintAddr,
        splToken.TOKEN_PROGRAM_ID,
        null,
    );

    const acc = await splToken.Token.getAssociatedTokenAddress(
        mint.associatedProgramId,
        splToken.TOKEN_PROGRAM_ID,
        mintAddr,
        owner,
        allowOwnerOffCurve,
    );
    return acc;
}

async function createAssociatedTokenAccount(connection, mintAddr, signer, owner, allowOwnerOffCurve = false) {
    const mint = new splToken.Token(
        connection,
        mintAddr,
        splToken.TOKEN_PROGRAM_ID,
        signer.publicKey,
    );

    const acc = await splToken.Token.getAssociatedTokenAddress(
        mint.associatedProgramId,
        splToken.TOKEN_PROGRAM_ID,
        mintAddr,
        owner,
        allowOwnerOffCurve,
    );

    const accInfo = await connection.getAccountInfo(acc);
    if (accInfo == null) {
        const inst = splToken.Token.createAssociatedTokenAccountInstruction(
            mint.associatedProgramId,
            splToken.TOKEN_PROGRAM_ID,
            mintAddr,
            acc,
            owner,
            signer.publicKey,
        );

        const instructions = [];
        instructions.push(inst);
        const res = await performInstructions(connection, [signer], instructions);
        if (res[0]) return acc;
        return null;
    }
    return acc;
}

async function createWallet(connection, wallet, lamports) {
    let bal = await connection.getBalance(wallet);
    if (bal < lamports) {
        const sig = await connection.requestAirdrop(wallet, lamports - bal);
        await connection.confirmTransaction(sig);
        bal = await connection.getBalance(wallet);
    }
    return wallet;
}

async function createAccountWithSeed(provider, programId, wallet, seed, space, extLamports) {
    const pubkey = await anchor.web3.PublicKey.createWithSeed(wallet.publicKey, seed, programId);
    const accInfo = await provider.connection.getAccountInfo(pubkey);
    if (accInfo != null) return pubkey;

    const fee = await provider.connection.getMinimumBalanceForRentExemption(space);

    const tx = new anchor.web3.Transaction();
    tx.add(
        anchor.web3.SystemProgram.createAccountWithSeed({
            fromPubkey: wallet.publicKey,
            newAccountPubkey: pubkey,
            basePubkey: wallet.publicKey,
            seed,
            space,
            lamports: fee + extLamports,
            programId,
        }),
    );
    // Execute the transaction against the cluster.
    await provider.send(tx, [wallet]);
    return pubkey;
}

async function getTokenAccountBalance(connection, tokenAccount) {
    try{
        const accInfo = await connection.getTokenAccountBalance(tokenAccount);
        if(accInfo == null)
            return Number(0);    
        return Number(accInfo.value.amount);
    }catch(e)
    {
        return Number(0);
    }
}

module.exports = {
    performInstructions,
    getAssociatedTokenAddress,
    createAssociatedTokenAccount,
    createWallet,
    createAccountWithSeed,
    getTokenAccountBalance,
};

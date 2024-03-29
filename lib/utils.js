const splToken = require('@solana/spl-token');
const anchor = require('@project-serum/anchor');
const borsh = require('borsh');

async function performInstructions(connection, signer, insts, signers = null) {
    const trx = new anchor.web3.Transaction().add(...insts);
    trx.feePayer = signer.publicKey;
    trx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;

    if (signers !== null) {
        trx.partialSign(...signers);
    }

    const signed = await signer.signTransaction(trx, signers);

    const transactionSignature = await connection.sendRawTransaction(
        signed.serialize(),
        { skipPreflight: true },
    );
    console.log('signature: ', transactionSignature);
    const confirmRes = await connection.confirmTransaction(transactionSignature, 'confirmed');
    if (confirmRes.value.err == null) {
        return [true, transactionSignature];
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
    let instructions = [];

    if (accInfo == null) {        
        instructions.push(splToken.Token.createAssociatedTokenAccountInstruction(
            mint.associatedProgramId,
            splToken.TOKEN_PROGRAM_ID,
            mintAddr,
            acc,
            owner,
            signer.publicKey,
        ));
    }
    return [acc, instructions];
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

async function mintTo(connection, mintAddr, tokenAddr, amount, signer)
{
    let instructions = [];
    instructions.push(
        splToken.Token.createMintToInstruction(splToken.TOKEN_PROGRAM_ID,
            mintAddr, 
            tokenAddr,
            signer.publicKey,
            [],
            amount)
    );
    const res = await performInstructions(connection, signer, instructions);
    if(res[0])
        return amount;
    return null;
}


async function transferToken(connection, fromAddr, toAddr, amount, signer)
{
    let instructions = [];
    instructions.push(
        splToken.Token.createTransferInstruction(
            splToken.TOKEN_PROGRAM_ID,
            fromAddr,
            toAddr,
            signer.publicKey,
            [],
            amount,
        )
      );
    const res = await performInstructions(connection, signer, instructions);
    if(res[0])
        return amount;
    return null;
}

async function getPdaAccount(program, pdaAccount)
{
    try{
        const accData = await program.account.pdaAccount.fetch(pdaAccount);
        return accData;
    }catch(e)
    {
        return null;
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

async function getPdaAccountData(program, feeToken)
{
    const [pdaAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [program.programId.toBuffer(), feeToken.toBuffer(), Buffer.from('ser-escrow')], program.programId);
    return await getPdaAccount(program, pdaAccount);
}

async function createToken(connection, signer, decimals)
{
    const mintAccount = anchor.web3.Keypair.generate();
    const balanceNeeded = await splToken.Token.getMinBalanceRentForExemptMint(connection);
    let instructions = [];

    instructions.push(anchor.web3.SystemProgram.createAccount({
      fromPubkey: signer.publicKey,
      newAccountPubkey: mintAccount.publicKey,
      lamports: balanceNeeded,
      space: 82, //MintLayout.span,
      programId: splToken.TOKEN_PROGRAM_ID
    }));

    instructions.push(splToken.Token.createInitMintInstruction(
        splToken.TOKEN_PROGRAM_ID, 
        mintAccount.publicKey, 
        decimals, 
        signer.publicKey, signer.publicKey));

    const res = await performInstructions(connection, signer, instructions, [mintAccount]);

    if(res[0])
    {
        const token = new splToken.Token(
            connection,
            mintAccount.publicKey,
            splToken.TOKEN_PROGRAM_ID,
            signer.publicKey
        );        
        return token;
    }
    return null;
}

class Clock{
    slot = 0
    epoch_start_timestamp = 0;
    epoch = 0;
    leader_schedule_epoch = 0;
    unix_timestamp =0;
    deser(buffer){
        const reader = new borsh.BinaryReader(buffer);
        this.slot = reader.readU64().toNumber();
        this.epoch_start_timestamp = reader.readU64().toNumber();
        this.epoch = reader.readU64().toNumber();
        this.leader_schedule_epoch = reader.readU64().toNumber();
        this.unix_timestamp = reader.readU64().toNumber();
    }
}

async function getNowTs(connection){
    const accountInfo = await connection.getAccountInfo(anchor.web3.SYSVAR_CLOCK_PUBKEY);
    let clock = new Clock();
    clock.deser(accountInfo.data);
    return clock.unix_timestamp;
}



class EscrowAccount{     
    initializerKey = null;
    initializerDepositTokenAccount = null;
    initializerReceiveTokenAccount = null;
    initializerFeePayingTokenAccount = null;
    vaultAccount = null;
    vaultAuthority = null;
    depositToken = null;
    receiveToken = null;
    feeToken = null;
    initializerAmount = 0;
    takerAmount = 0;
    initialized = 0;
    feeCollectTokenAccount = null;
    feeAmountInitializer = 0;
    feeAmountTaker = 0;

    deser(buffer){
        const reader = new borsh.BinaryReader(buffer);

        //read 8 bytes anchor using
        reader.readU64();

        this.initializerKey = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.initializerDepositTokenAccount = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.initializerReceiveTokenAccount = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.initializerFeePayingTokenAccount = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.vaultAccount = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.vaultAuthority = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.depositToken = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.receiveToken = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.feeToken = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.initializerAmount = reader.readU64().toNumber();
        this.takerAmount = reader.readU64().toNumber();
        this.initialized = reader.readU8();
        this.feeCollectTokenAccount = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.feeAmountInitializer = reader.readU64().toNumber();
        this.feeAmountTaker = reader.readU64().toNumber();
    }
}

async function getEscrowData(connection, escrowAcc){
    const accountInfo = await connection.getAccountInfo(escrowAcc);
    let escrow = new EscrowAccount();
    escrow.deser(accountInfo.data);
    return escrow;
}
async function getEscrowData1(connection, programId, initializer, depositToken,  receiveToken){
    const [escrow] = await anchor.web3.PublicKey.findProgramAddress(
        [initializer.toBuffer(), depositToken.toBuffer(), receiveToken.toBuffer()], programId);
    let escrowData = await getEscrowData(connection, escrow);
    return escrowData;
}


class InitializeEvent{
    initializerKey = null;
    depositToken = null;
    receiveToken = null;
    feeToken = null;
    feeCollectTokenAccount = null;
    initializerAmount = 0;
    takerAmount = 0;
    feeAmountInitializer = 0;
    feeAmountTaker = 0;

    deser(buffer){
        const reader = new borsh.BinaryReader(buffer);

        //read 8 bytes anchor using
        reader.readU64();

        this.initializerKey = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.depositToken = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.receiveToken = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.feeToken = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.feeCollectTokenAccount = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.initializerAmount = reader.readU64().toNumber();
        this.takerAmount = reader.readU64().toNumber();
        this.feeAmountInitializer = reader.readU64().toNumber();
        this.feeAmountTaker = reader.readU64().toNumber();
    }
}

class CancelEvent{
    initializerKey = null;
    depositToken = null;
    receiveToken = null;
    initializerAmount = 0;
    receiveAmount = 0;

    deser(buffer){
        const reader = new borsh.BinaryReader(buffer);

        //read 8 bytes anchor using
        reader.readU64();

        this.initializerKey = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.depositToken = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.receiveToken = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.initializerAmount = reader.readU64().toNumber();
        this.receiveAmount = reader.readU64().toNumber();
    }
}

class ExchangeEvent{
    initializerKey = null;
    takerKey = null;
    depositToken = null;
    receiveToken = null;
    initializerAmount = 0;
    receiveAmount = 0;

    deser(buffer){
        const reader = new borsh.BinaryReader(buffer);
        
        //read 8 bytes anchor using
        reader.readU64();

        this.initializerKey = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.takerKey = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.depositToken = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.receiveToken = new anchor.web3.PublicKey(reader.readFixedArray(32));
        this.initializerAmount = reader.readU64().toNumber();
        this.receiveAmount = reader.readU64().toNumber();
    }
}

function parseEventName(buffer){
    const reader = new borsh.BinaryReader(buffer);
    const eventCode = reader.readU64().toString('hex');

    const events = [
        {name: 'init', code: 'd5a22e93612a781c'},
        {name: 'exchange', code: '694f11b084d43c61'},
        {name: 'cancel', code: '2ff203dc64ef8947'},
    ];

    for(let i=0; i<events.length; i++){
        if(events[i].code == eventCode)
            return events[i].name;
    };
    return null;
}

function parseEvent(buffer){
    const eventName = parseEventName(buffer);
    if(eventName == 'init'){
        let initializeEvent = new InitializeEvent;
        initializeEvent.deser(buffer);
        return [eventName, initializeEvent];

    }else if(eventName == 'exchange'){

        let exchangeEvent = new ExchangeEvent;
        exchangeEvent.deser(buffer);
        return [eventName, exchangeEvent];

    }else if(eventName == 'cancel'){
        let cancelEvent = new CancelEvent;
        cancelEvent.deser(buffer);
        return [eventName, cancelEvent];
    }
    return null;
}

function parseLogs(logs){
    for(let i =0; i<logs.length; i++)
    {
        const log = logs[i];
        if(log.startsWith("Program log: ") && !log.startsWith("Program log: Instruction: "))
        {
            let base64Str = log.substring(13);
            try{
                const buffer = Buffer.from(base64Str, 'base64');
                if(buffer.length > 8)
                    return  parseEvent(buffer);
            }catch(e){

            }
        }
    };
    return null;
}

module.exports = {
    performInstructions,
    getAssociatedTokenAddress,
    createAssociatedTokenAccount,
    createWallet,
    getTokenAccountBalance,
    mintTo,
    transferToken,
    createToken,
    getNowTs,
    
    getEscrowAccount,
    getEscrowAccountData,
    getPdaAccount,
    getPdaAccountData,     

    getEscrowData,
    getEscrowData1,

    parseLogs,
};




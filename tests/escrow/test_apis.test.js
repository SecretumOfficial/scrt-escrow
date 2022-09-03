const utils = require('../../lib/utils');

const assert = require('assert');
const anchor = require('@project-serum/anchor');
const splToken = require('@solana/spl-token');
const process = require('process');
const os = require('os');
const fs = require('fs');
const lib = require('../lib');


describe('Escrow tests', () => {
    const homedir = os.homedir();
    process.env.ANCHOR_WALLET = `${homedir}/.config/solana/id.json`;

    // Configure the local cluster.
    const provider = anchor.Provider.local();
    anchor.setProvider(provider);

    // Read the generated IDL.
    const idl = JSON.parse(fs.readFileSync('./target/idl/scrt_escrow.json', 'utf8'));

    // Address of the deployed program.
    const programId = new anchor.web3.PublicKey(idl.metadata.address);
    const program = new anchor.Program(idl, programId);
    const mintAuthorityA = anchor.web3.Keypair.generate();
    const mintAuthorityB = anchor.web3.Keypair.generate();
    const mintAuthorityC = anchor.web3.Keypair.generate();

    program.provider.connection.onLogs(new anchor.web3.PublicKey("HbzBdq7txgxVSWGUgyifsCPEGhGmQs5j7ReD9qc1Pdbx"), (logs, ctx)=>{
        const ev = utils.parseLogs(logs.logs);            
        if(ev != null)
            console.log(ev);        
    })


    let mintA;
    let mintB;
    let mintC;
    let walletA;
    let walletB;
    let walletFeeCollector;

    let feeCollectTokenAccount;    

    let initializerDepositTokenAccount;
    let initializerReceiveTokenAccount;
    let initializerFeePayTokenAccount;
    let takerDepositTokenAccount;
    let takerReceiveTokenAccount;
    let takerFeePayTokenAccount;

    beforeEach(async () => {
        // create wallet A
        walletA = anchor.web3.Keypair.generate();
        await utils.createWallet(provider.connection, walletA.publicKey, 1000_000_000);
        walletB = anchor.web3.Keypair.generate();
        await utils.createWallet(provider.connection, walletB.publicKey, 1000_000_000);
        walletFeeCollector = anchor.web3.Keypair.generate();
        await utils.createWallet(provider.connection, walletFeeCollector.publicKey, 1000_000_000);

        mintA = await splToken.Token.createMint(
            provider.connection,
            walletA,
            mintAuthorityA.publicKey,
            null,
            0,
            splToken.TOKEN_PROGRAM_ID,
        );
        mintB = await splToken.Token.createMint(
            provider.connection,
            walletA,
            mintAuthorityB.publicKey,
            null,
            0,
            splToken.TOKEN_PROGRAM_ID,
        );
        mintC = await splToken.Token.createMint(
            provider.connection,
            walletA,
            mintAuthorityC.publicKey,
            null,
            0,
            splToken.TOKEN_PROGRAM_ID,
        );
        
        // initializer
        initializerDepositTokenAccount = await mintA.createAccount(walletA.publicKey);
        await mintA.mintTo(initializerDepositTokenAccount, mintAuthorityA.publicKey, [mintAuthorityA], 100_000_000_000);

        initializerReceiveTokenAccount = await mintB.createAccount(walletA.publicKey);
        initializerFeePayTokenAccount = await mintC.createAccount(walletA.publicKey);
        await mintC.mintTo(initializerFeePayTokenAccount, mintAuthorityC.publicKey, [mintAuthorityC], 100_000_000_000);

        //taker
        takerDepositTokenAccount = await mintB.createAccount(walletB.publicKey);        
        takerReceiveTokenAccount = await mintA.createAccount(walletB.publicKey);
        await mintB.mintTo(takerDepositTokenAccount, mintAuthorityB.publicKey, [mintAuthorityB], 100_000_000_000);
        takerFeePayTokenAccount = await mintC.createAccount(walletB.publicKey);
        await mintC.mintTo(takerFeePayTokenAccount, mintAuthorityC.publicKey, [mintAuthorityC], 100_000_000_000);

        //create fee collecting wallet    
        feeCollectTokenAccount = await mintC.createAccount(walletFeeCollector.publicKey);

        //initialize pda
        console.log("init pda...")
        const res = await lib.initializePda(program, mintC.publicKey, walletFeeCollector);
        console.log(res);
    });

    it('check escrow after init', async () => {
        console.log("init ....");
        await lib.initialize(
            program,
            1000,
            2000,
            mintA.publicKey,
            initializerDepositTokenAccount,
            mintB.publicKey,
            initializerReceiveTokenAccount,
            mintC.publicKey,            
            feeCollectTokenAccount,
            10,
            20,
            initializerFeePayTokenAccount,
            walletA
        );

        console.log("getting esrow data...");
        const escrowData = await utils.getEscrowData1(provider.connection, programId, walletA.publicKey, mintA.publicKey, mintB.publicKey);
        console.log(escrowData.initializerKey.toBase58(), walletA.publicKey.toBase58());
        console.log(escrowData);
    });

    it('init already setteled', async () => {

        let initializerDepositerBalance =  await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        console.log("init ....");
        await lib.initialize(
            program,
            1000,
            2000,
            mintA.publicKey,
            initializerDepositTokenAccount,
            mintB.publicKey,
            initializerReceiveTokenAccount,
            mintC.publicKey,            
            feeCollectTokenAccount,
            10,
            20,
            initializerFeePayTokenAccount,
            walletA
        );

        let initializerDepositerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance1  == initializerDepositerBalance - 1000);

        console.log("init 2....");
        const res = await lib.initialize(
            program,
            1000,
            2000,
            mintA.publicKey,
            initializerDepositTokenAccount,
            mintB.publicKey,
            initializerReceiveTokenAccount,
            mintC.publicKey,            
            feeCollectTokenAccount,
            10,
            20,
            initializerFeePayTokenAccount,
            walletA
        );
        assert(res == 'alreday started')
    });

    it('Test cancel', async () => {

        let initializerDepositerBalance =  await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        let initializerFeePayBalance = await utils.getTokenAccountBalance(program.provider.connection, initializerFeePayTokenAccount);
        console.log("init...");
        await lib.initialize(
            program,
            1000,
            2000,
            mintA.publicKey,
            initializerDepositTokenAccount,
            mintB.publicKey,
            initializerReceiveTokenAccount,
            mintC.publicKey,            
            feeCollectTokenAccount,
            10,
            20,
            initializerFeePayTokenAccount,
            walletA
        );
        let initializerFeePayBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerFeePayTokenAccount);
        assert(initializerFeePayBalance1  == initializerFeePayBalance - 10);

        let initializerDepositerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance1  == initializerDepositerBalance - 1000);

        console.log("cancel...");
        await lib.cancel(program, mintA.publicKey, mintB.publicKey, mintC.publicKey, walletA);
        let initializerDepositerBalance2 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance  == initializerDepositerBalance2);

        let initializerFeePayBalance2 = await utils.getTokenAccountBalance(program.provider.connection, initializerFeePayTokenAccount);
        assert(initializerFeePayBalance2  == initializerFeePayBalance);
    });

    it('twice init & cancel', async () => {

        let initializerDepositerBalance =  await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        console.log("init...");
        await lib.initialize(
            program,
            1000,
            2000,
            mintA.publicKey,
            initializerDepositTokenAccount,
            mintB.publicKey,
            initializerReceiveTokenAccount,
            mintC.publicKey,            
            feeCollectTokenAccount,
            10,
            20,
            initializerFeePayTokenAccount,
            walletA
        );
        let initializerDepositerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance1  == initializerDepositerBalance - 1000);

        console.log("cancel...");
        await lib.cancel(program, mintA.publicKey, mintB.publicKey, mintC.publicKey, walletA);
        let initializerDepositerBalance2 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance  == initializerDepositerBalance2);

        console.log("init2...");
        await lib.initialize(
            program,
            1000,
            2000,
            mintA.publicKey,
            initializerDepositTokenAccount,
            mintB.publicKey,
            initializerReceiveTokenAccount,
            mintC.publicKey,            
            feeCollectTokenAccount,
            10,
            20,
            initializerFeePayTokenAccount,
            walletA
        );
        initializerDepositerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance1  == initializerDepositerBalance - 1000);

        console.log("cancel2...");
        await lib.cancel(program, mintA.publicKey, mintB.publicKey, mintC.publicKey, walletA);
        initializerDepositerBalance2 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance  == initializerDepositerBalance2);
    });

    it('exchange', async () => {
        //initialize signer
        let initializerDepositerBalance =  await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        let initializerFeePayerBalance = await utils.getTokenAccountBalance(program.provider.connection, initializerFeePayTokenAccount); 
        
        console.log("init ....");
        await lib.initialize(
            program,
            1000,
            2000,
            mintA.publicKey,
            initializerDepositTokenAccount,
            mintB.publicKey,
            initializerReceiveTokenAccount,
            mintC.publicKey,            
            feeCollectTokenAccount,
            10,
            20,
            initializerFeePayTokenAccount,
            walletA
        );
        let initializerDepositerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance1  == initializerDepositerBalance - 1000);

        let initializerFeePayerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerFeePayTokenAccount);
        assert(initializerFeePayerBalance1  == initializerFeePayerBalance - 10);


        let initializerReceiverBalance = await utils.getTokenAccountBalance(program.provider.connection, initializerReceiveTokenAccount);
        let takerReceiverBalance = await utils.getTokenAccountBalance(program.provider.connection, takerReceiveTokenAccount);
        let takerDepositBalance = await utils.getTokenAccountBalance(program.provider.connection, takerDepositTokenAccount);

        let feeCollectTokenBalance = await utils.getTokenAccountBalance(program.provider.connection, feeCollectTokenAccount);

        console.log("exchange ....");
        const res = await lib.exchange(
            program, 
            walletA.publicKey, 
            mintA.publicKey, 
            mintB.publicKey,  
            takerDepositTokenAccount, 
            takerReceiveTokenAccount, 
            takerFeePayTokenAccount,
            mintC.publicKey,
            walletB
        );
        let feeCollectTokenBalance1 = await utils.getTokenAccountBalance(program.provider.connection, feeCollectTokenAccount);
        assert(feeCollectTokenBalance1  == feeCollectTokenBalance + 30);


        //not change initDepositToken balance
        initializerDepositerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance1  == initializerDepositerBalance - 1000);

        //changed initReceiverToken bal
        let initializerReceiverBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerReceiveTokenAccount);
        assert(initializerReceiverBalance1  == initializerReceiverBalance + 2000);

        //check taker bals
        let takerReceiverBalance1 = await utils.getTokenAccountBalance(program.provider.connection, takerReceiveTokenAccount);
        assert(takerReceiverBalance1 == takerReceiverBalance + 1000);

        let takerDepositBalance1 = await utils.getTokenAccountBalance(program.provider.connection, takerDepositTokenAccount);
        assert(takerDepositBalance1 == takerDepositBalance - 2000);

        console.log({feeCollectTokenBalance1});
    });

    it('exchange with same token', async () => {
        //initialize signer
        let initializerDepositerBalance =  await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        let initializerFeePayerBalance = await utils.getTokenAccountBalance(program.provider.connection, initializerFeePayTokenAccount); 
        
        console.log("init ....");
        await lib.initialize(
            program,
            1000,
            2000,
            mintC.publicKey,
            initializerFeePayTokenAccount,
            mintC.publicKey,
            initializerFeePayTokenAccount,
            mintC.publicKey,
            feeCollectTokenAccount,
            10,
            20,
            initializerFeePayTokenAccount,
            walletA
        );
    //     let initializerDepositerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
    //     assert(initializerDepositerBalance1  == initializerDepositerBalance - 1000);

    //     let initializerFeePayerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerFeePayTokenAccount);
    //     assert(initializerFeePayerBalance1  == initializerFeePayerBalance - 10);


    //     let initializerReceiverBalance = await utils.getTokenAccountBalance(program.provider.connection, initializerReceiveTokenAccount);
    //     let takerReceiverBalance = await utils.getTokenAccountBalance(program.provider.connection, takerReceiveTokenAccount);
    //     let takerDepositBalance = await utils.getTokenAccountBalance(program.provider.connection, takerDepositTokenAccount);

    //     let feeCollectTokenBalance = await utils.getTokenAccountBalance(program.provider.connection, feeCollectTokenAccount);

    //     console.log("exchange ....");
    //     const res = await lib.exchange(
    //         program, 
    //         walletA.publicKey, 
    //         mintA.publicKey, 
    //         mintB.publicKey,  
    //         takerDepositTokenAccount, 
    //         takerReceiveTokenAccount, 
    //         takerFeePayTokenAccount,
    //         mintC.publicKey,
    //         walletB
    //     );
    //     let feeCollectTokenBalance1 = await utils.getTokenAccountBalance(program.provider.connection, feeCollectTokenAccount);
    //     assert(feeCollectTokenBalance1  == feeCollectTokenBalance + 30);


    //     //not change initDepositToken balance
    //     initializerDepositerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
    //     assert(initializerDepositerBalance1  == initializerDepositerBalance - 1000);

    //     //changed initReceiverToken bal
    //     let initializerReceiverBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerReceiveTokenAccount);
    //     assert(initializerReceiverBalance1  == initializerReceiverBalance + 2000);

    //     //check taker bals
    //     let takerReceiverBalance1 = await utils.getTokenAccountBalance(program.provider.connection, takerReceiveTokenAccount);
    //     assert(takerReceiverBalance1 == takerReceiverBalance + 1000);

    //     let takerDepositBalance1 = await utils.getTokenAccountBalance(program.provider.connection, takerDepositTokenAccount);
    //     assert(takerDepositBalance1 == takerDepositBalance - 2000);

    //     console.log({feeCollectTokenBalance1});
    });

})
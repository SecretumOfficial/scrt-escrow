const utils = require('../../lib/utils');

const assert = require('assert');
const anchor = require('@project-serum/anchor');
const splToken = require('@solana/spl-token');
const process = require('process');
const os = require('os');
const fs = require('fs');
const lib = require('../lib');
const sign = require('../sign');

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

    let mintA;
    let mintB;
    let walletA;
    let walletB;
    let walletFeeCollector;
    let feeCollectTokenAccountA;
    let feeCollectTokenAccountB;

    let initializerDepositTokenAccount;
    let initializerReceiveTokenAccount;
    let takerDepositTokenAccount;
    let takerReceiveTokenAccount;

    beforeEach(async () => {
        // create wallet A
        walletA = anchor.web3.Keypair.generate();
        await utils.createWallet(provider.connection, walletA.publicKey, 1000_000_000);
        mintA = await splToken.Token.createMint(
            provider.connection,
            walletA,
            mintAuthorityA.publicKey,
            null,
            0,
            splToken.TOKEN_PROGRAM_ID,
        );
        initializerDepositTokenAccount = await mintA.createAccount(walletA.publicKey);
        await mintA.mintTo(initializerDepositTokenAccount, mintAuthorityA.publicKey, [mintAuthorityA], 100_000_000_000);

        walletB = anchor.web3.Keypair.generate();
        await utils.createWallet(provider.connection, walletB.publicKey, 1000_000_000);
        mintB = await splToken.Token.createMint(
            provider.connection,
            walletA,
            mintAuthorityB.publicKey,
            null,
            0,
            splToken.TOKEN_PROGRAM_ID,
        );
        initializerReceiveTokenAccount = await mintB.createAccount(walletA.publicKey);
        //await mintB.mintTo(initializerReceiveTokenAccount, mintAuthorityB.publicKey, [mintAuthorityB], 100_000_000_000);

        takerDepositTokenAccount = await mintB.createAccount(walletB.publicKey);        
        takerReceiveTokenAccount = await mintA.createAccount(walletB.publicKey);

        //create fee collecting wallet    
        walletFeeCollector = anchor.web3.Keypair.generate();
        await utils.createWallet(provider.connection, walletFeeCollector.publicKey, 1000_000_000);
        feeCollectTokenAccountA = await mintA.createAccount(walletFeeCollector.publicKey);
        feeCollectTokenAccountB = await mintB.createAccount(walletFeeCollector.publicKey);

        await mintB.mintTo(takerDepositTokenAccount, mintAuthorityB.publicKey, [mintAuthorityB], 100_000_000_000);
    });

    it.skip('init already setteled', async () => {

        let initializerDepositerBalance =  await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        await lib.initialize(
            program,
            1000,
            2000,
            mintA.publicKey,
            initializerDepositTokenAccount,
            mintB.publicKey,
            initializerReceiveTokenAccount,
            walletA
        );
        let initializerDepositerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance1  == initializerDepositerBalance - 1000);

        const res = await lib.initialize(
            program,
            1000,
            2000,
            mintA.publicKey,
            initializerDepositTokenAccount,
            mintB.publicKey,
            initializerReceiveTokenAccount,
            walletA
        );
        assert(res == 'alreday started')
    });

    it.skip('Test cancel', async () => {

        let initializerDepositerBalance =  await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        await lib.initialize(
            program,
            1000,
            2000,
            mintA.publicKey,
            initializerDepositTokenAccount,
            mintB.publicKey,
            initializerReceiveTokenAccount,
            walletA
        );
        let initializerDepositerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance1  == initializerDepositerBalance - 1000);

        await lib.cancel(program, mintA.publicKey, mintB.publicKey, walletA);
        let initializerDepositerBalance2 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance  == initializerDepositerBalance2);
    });

    it.skip('twice init & cancel', async () => {

        let initializerDepositerBalance =  await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        await lib.initialize(
            program,
            1000,
            2000,
            mintA.publicKey,
            initializerDepositTokenAccount,
            mintB.publicKey,
            initializerReceiveTokenAccount,
            walletA
        );
        let initializerDepositerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance1  == initializerDepositerBalance - 1000);

        await lib.cancel(program, mintA.publicKey, mintB.publicKey, walletA);
        let initializerDepositerBalance2 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance  == initializerDepositerBalance2);

        await lib.initialize(
            program,
            1000,
            2000,
            mintA.publicKey,
            initializerDepositTokenAccount,
            mintB.publicKey,
            initializerReceiveTokenAccount,
            walletA
        );
        initializerDepositerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance1  == initializerDepositerBalance - 1000);

        await lib.cancel(program, mintA.publicKey, mintB.publicKey, walletA);
        initializerDepositerBalance2 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance  == initializerDepositerBalance2);
    });

    it('exchange', async () => {
        //initialize signer
        let pubKeyBytes = [115, 64, 83, 51, 6, 108, 15, 142, 22, 181, 92, 134, 173, 233, 177, 51, 90, 120, 185, 37, 37, 57, 187, 31, 241, 126, 77, 104, 79, 201, 143, 136, 148, 132, 165, 22, 101, 74, 164, 180, 237, 31, 69, 119, 215, 111, 97, 108, 117, 108, 250, 129, 177, 189, 127, 127, 115, 61, 235, 12, 185, 78, 37, 140];
        const res0 = await lib.initializeSigner(program, walletA, pubKeyBytes);
        console.log("initializeSigner res=", res0);


        let initializerDepositerBalance =  await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        await lib.initialize(
            program,
            1000,
            2000,
            mintA.publicKey,
            initializerDepositTokenAccount,
            mintB.publicKey,
            initializerReceiveTokenAccount,
            walletA
        );
        let initializerDepositerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance1  == initializerDepositerBalance - 1000);

        let initializerReceiverBalance = await utils.getTokenAccountBalance(program.provider.connection, initializerReceiveTokenAccount);
        let takerReceiverBalance = await utils.getTokenAccountBalance(program.provider.connection, takerReceiveTokenAccount);
        let takerDepositBalance = await utils.getTokenAccountBalance(program.provider.connection, takerDepositTokenAccount);


        const sig = sign.sign(mintA.publicKey, mintB.publicKey, 10, 20);
        const res = await lib.exchange(program, walletA.publicKey, mintA.publicKey, mintB.publicKey,  takerDepositTokenAccount, takerReceiveTokenAccount, 
            feeCollectTokenAccountA, feeCollectTokenAccountB, 10, 20, sig[0], sig[1], walletB);
        console.log("exchange res=", res);

        //not change initDepositToken balance
        initializerDepositerBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerDepositTokenAccount);
        assert(initializerDepositerBalance1  == initializerDepositerBalance - 1000);

        //changed initReceiverToken bal
        let initializerReceiverBalance1 = await utils.getTokenAccountBalance(program.provider.connection, initializerReceiveTokenAccount);
        console.log(initializerReceiverBalance1  , initializerReceiverBalance);

        //assert(initializerReceiverBalance1  == initializerReceiverBalance + 2000 - 20);

        //check taker bals
        let takerReceiverBalance1 = await utils.getTokenAccountBalance(program.provider.connection, takerReceiveTokenAccount);
        console.log(takerReceiverBalance1  , takerReceiverBalance);

        //assert(takerReceiverBalance1 == takerReceiverBalance + 1000 - 10);        

        let takerDepositBalance1 = await utils.getTokenAccountBalance(program.provider.connection, takerDepositTokenAccount);
        //assert(takerDepositBalance1 == takerDepositBalance - 2000);

        const b = await utils.getTokenAccountBalance(program.provider.connection, feeCollectTokenAccountA);
        const c = await utils.getTokenAccountBalance(program.provider.connection, feeCollectTokenAccountB);
        console.log({b, c});
    });
})
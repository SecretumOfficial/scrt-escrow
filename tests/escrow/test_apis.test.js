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

    let mintA;
    let mintB;
    let walletA;
    let walletB;
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
        await mintB.mintTo(takerDepositTokenAccount, mintAuthorityB.publicKey, [mintAuthorityB], 100_000_000_000);    
    });
    it('init already setteled', async () => {

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

    it('Test cancel', async () => {

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

    it('twice init & cancel', async () => {

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
        await lib.exchange(program, walletA.publicKey, mintA.publicKey, mintB.publicKey,  takerDepositTokenAccount, takerReceiveTokenAccount, walletB);
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
    });
})
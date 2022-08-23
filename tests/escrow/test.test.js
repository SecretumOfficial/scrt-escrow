const utils = require('../../lib/utils');

const assert = require('assert');
const anchor = require('@project-serum/anchor');
const splToken = require('@solana/spl-token');
const process = require('process');
const os = require('os');
const fs = require('fs');
const lib = require('../lib');
const web3 = require("@solana/web3.js");

const URL = 

describe('Escrow tests', () => {
    const homedir = os.homedir();
    const connection = new web3.Connection('https://api.testnet.solana.com', 'confirmed');
    // Configure the local cluster.    
    const provider = new anchor.Provider(connection);
    anchor.setProvider(provider);

    const programId = new anchor.web3.PublicKey('HbzBdq7txgxVSWGUgyifsCPEGhGmQs5j7ReD9qc1Pdbx');
    const initializer = new anchor.web3.PublicKey('8UXorNrAWW47iLNX5rUVyMi2dEhHGaJVJdKrrpxLSkwo');
    const initializerToken = new anchor.web3.PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
    const takerToken = new anchor.web3.PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
    
    it('escrow data', async () => {
        const data = await utils.getEscrowData1(connection, programId, initializer, initializerToken, takerToken);
        console.log(data);
    });
})
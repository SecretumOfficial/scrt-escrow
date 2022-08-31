const utils = require('../../lib/utils');

const assert = require('assert');
const anchor = require('@project-serum/anchor');
const splToken = require('@solana/spl-token');
const process = require('process');
const os = require('os');
const fs = require('fs');
const lib = require('../lib');
const web3 = require("@solana/web3.js");
const { base64 } = require('@project-serum/anchor/dist/cjs/utils/bytes');


function sleep(ms){
    return new Promise((resolve)=>{
        setTimeout(resolve, ms);
    })
}

async function main(){
    console.log("on_main");
    const connection = new web3.Connection('https://api.testnet.solana.com', 'confirmed');
    // Configure the local cluster.    
    const programId = new anchor.web3.PublicKey('HbzBdq7txgxVSWGUgyifsCPEGhGmQs5j7ReD9qc1Pdbx');
    connection.onLogs(programId, (logs, ctx)=>{
        let res = utils.parseLogs(logs.logs);
        if(res!=null){
            console.log(res);
        }        
    })
    await sleep(1000*1000);
    console.log("on_main_end");
}

main();

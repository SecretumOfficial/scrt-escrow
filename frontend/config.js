import * as web3 from "@solana/web3.js";
const anchor = require('@project-serum/anchor');
import config from './src/config.json';
const  network = config.network;
export const URL = config[network].url;
export const programId = new web3.PublicKey(config[network].program);

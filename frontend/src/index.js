import './style.css'
import * as web3 from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import * as anchor from "@project-serum/anchor";
import tokenlockIdl from './idl/scrt_escrow.json';
import {
  programId,
  URL
} from '../config';
const lib = require("./lib");
const utils = require("../../lib/utils");

window.Buffer = window.Buffer || require('buffer').Buffer;

const getProvider = async () => {
  if ("solana" in window) {
    await window.solana.connect(); // opens wallet to connect to

    const provider = window.solana;
    if (provider.isPhantom) {
      //console.log("Is Phantom installed?  ", provider.isPhantom);
      return provider;
    }
  } else {
    document.write('Install https://www.phantom.app/');
  }
};

const connectWallet = async () => {
  const provider = await getProvider();
  if (provider) {
    try {
      const resp = await window.solana.connect();
      const addressElement = document.getElementById('wallet_address')
      addressElement.innerHTML = resp.publicKey.toString();
    } catch (err) {
      console.log('err', err);
    }
  }

};

const getAnchorProvider = async () => {
  const wallet = await getProvider();
  const connection = new web3.Connection(URL, 'confirmed');

  const provider = new anchor.Provider(
    connection, wallet, 'confirmed',
  );

  return provider;
};


const createMint = async () => {
  const decimals = document.getElementById('mint_decimal').value;
  const connection = new web3.Connection(URL, 'confirmed');
  const provider = await getProvider();
  console.log(provider.publicKey.toString());
  const mint = await utils.createToken(connection, provider, decimals);
  if(mint!=null)
  {
    document.getElementById('mint_address').value = mint.publicKey.toBase58();
    //document.getElementById('mint_authority').value = JSON.stringify(Array.from(mint.payer.secretKey));
  }else{
    alert('error!');
  }  
}


const refreshAccounts = async () => {
  const mintAddr = new anchor.web3.PublicKey(document.getElementById('mint_address').value);  
  const provider = await getProvider();
  const connection = new web3.Connection(URL, 'confirmed');
  let accs = await connection.getTokenAccountsByOwner(provider.publicKey, {mint: mintAddr});
  let accsStr = "";
  accs.value.forEach(acc =>{
    accsStr = accsStr + acc.pubkey.toBase58() + "\n";
  });  
  document.getElementById('accounts').value = accsStr;  
}

const createNewAccount = async () => {
  const mintAddr = new anchor.web3.PublicKey(document.getElementById('mint_address').value);
  const connection = new web3.Connection(URL, 'confirmed');
  const provider = await getProvider();
  const acc = await utils.createAssociatedTokenAccount(connection, mintAddr, provider, provider.publicKey);

  if(acc !=null)
    await refreshAccounts();
}


const accountInfo = async () => {
  const mintAddr = new anchor.web3.PublicKey(document.getElementById('mint_address').value);  
  const provider = await getProvider();
  const connection = new web3.Connection(URL, 'confirmed');
  const mint = new splToken.Token(
    connection,
    mintAddr,
    splToken.TOKEN_PROGRAM_ID,
    provider.publicKey
  );
  const acc = new web3.PublicKey(document.getElementById("transfer_to_address").value);
  let info = await mint.getAccountInfo(acc);
  document.getElementById("acc_info_bal").value = info.amount.toNumber();
}

const mintTo = async () => {
  const mintAddr = new anchor.web3.PublicKey(document.getElementById('mint_address').value);    
  const provider = await getProvider();
  const destPublicKey = new web3.PublicKey(document.getElementById("transfer_to_address").value);  
  const amount = document.getElementById('transfer_amount').value;  
  const connection = new web3.Connection(URL, 'confirmed');

  const res = utils.mintTo(connection, mintAddr, destPublicKey, amount, provider);
  if(res != null)
    alert('minto success');
}

const transfer = async () => {
  const destPublicKey = new web3.PublicKey(document.getElementById('transfer_to_address').value);
  const mintPublicKey = new web3.PublicKey(document.getElementById('mint_address').value);
  const amount = document.getElementById('transfer_amount').value;

  const connection = new web3.Connection(URL, 'confirmed');
  const provider = await getProvider();

  const token = new splToken.Token(
    connection,
    mintPublicKey,
    splToken.TOKEN_PROGRAM_ID,
    provider.publicKey,
  );

  const fromTokenAccountPK = (await token.getOrCreateAssociatedAccountInfo(
    provider.publicKey,
  )).address;

  const receiverAccount = await connection.getAccountInfo(destPublicKey);
  if (receiverAccount === null) {
    alert('There is no token account for recipient');
    return
  }
  const res = await utils.transferToken(connection, 
    fromTokenAccountPK, 
    destPublicKey,
    amount,
    provider);

  if(res!=null)
    await refreshAccounts();
};


const initialize = async () => {
  const mintA = new web3.PublicKey(document.getElementById('mint_a').value);
  const mintB = new web3.PublicKey(document.getElementById('mint_b').value);  

  const initializer_amount = document.getElementById('initializer_amount').value;
  const taker_amount = document.getElementById('taker_amount').value;

  const connection = new web3.Connection(URL, 'confirmed');
  const provider = await getProvider();
  const anchor_provider = await getAnchorProvider();
  const program = new anchor.Program(tokenlockIdl, programId, anchor_provider);

  const res = await lib.initialize(program, connection,
    initializer_amount, taker_amount, mintA, mintB, provider);

  if(res[0] == null)
  {
    alert(res[1]);
  }else{
    document.getElementById("escrow_account").value = res[0];
  }
}

const cancel = async () => {
  const mintA = new web3.PublicKey(document.getElementById('mint_a').value);
  const mintB = new web3.PublicKey(document.getElementById('mint_b').value);  

  const connection = new web3.Connection(URL, 'confirmed');
  const provider = await getProvider();
  const anchor_provider = await getAnchorProvider();
  const program = new anchor.Program(tokenlockIdl, programId, anchor_provider);

  const res = await lib.cancel(program, connection,  mintA, mintB, provider);

  if(res[0] == null)
  {
    alert(res[1]);
  }else{
    document.getElementById("escrow_account").value = "";
    alert("cancel success!");
  }
}


const exchange = async () => {
  const mintA = new web3.PublicKey(document.getElementById('mint_a').value);
  const mintB = new web3.PublicKey(document.getElementById('mint_b').value);  
  const initializer = new web3.PublicKey(document.getElementById('initializer').value);

  const connection = new web3.Connection(URL, 'confirmed');
  const provider = await getProvider();
  const anchor_provider = await getAnchorProvider();
  const program = new anchor.Program(tokenlockIdl, programId, anchor_provider);

  const res = await lib.exchange(program, connection, initializer, mintA, mintB, provider);

  if(res[0] == null)
  {
    alert(res[1]);
  }else{
    document.getElementById("escrow_account").value = '';
    alert("exchange success!");
  }
}


const stat_refresh = async () => {
  const anchor_provider = await getAnchorProvider();
  const program = new anchor.Program(tokenlockIdl, programId, anchor_provider);
  const escrow = new anchor.web3.PublicKey(document.getElementById("escrow_account").value);
  let escrowData = await program.account.escrowAccount.fetch(escrow);

  document.getElementById('initializer_amount1').innerHTML = escrowData.initializerAmount.toNumber();
  document.getElementById('taker_amount1').innerHTML = escrowData.takerAmount.toNumber();
  document.getElementById('vault_account').innerHTML = escrowData.vaultAccount.toString();
}


(() => {
  const btn_connect = document.getElementById('connect_btn');
  btn_connect.addEventListener('click', connectWallet);

  const btn_transfer = document.getElementById('transfer_btn');
  btn_transfer.addEventListener('click', transfer);

  const create_mint_btn = document.getElementById('create_mint_btn');
  create_mint_btn.addEventListener('click', createMint);


  const refresh_btn = document.getElementById('refresh_btn');  
  refresh_btn.addEventListener('click', refreshAccounts);

  const create_new_btn = document.getElementById('create_new_btn');  
  create_new_btn.addEventListener('click', createNewAccount);

  const acc_info_btn = document.getElementById('acc_info_btn');  
  acc_info_btn.addEventListener('click', accountInfo);

  const mintto_btn = document.getElementById('mintto_btn');  
  mintto_btn.addEventListener('click', mintTo);

  const init_btn = document.getElementById('init_btn');  
  init_btn.addEventListener('click', initialize);

  const cancel_btn = document.getElementById('cancel_btn');  
  cancel_btn.addEventListener('click', cancel);

  const excahnge_btn = document.getElementById('excahnge_btn');  
  excahnge_btn.addEventListener('click', exchange);
  

  const pda_state_btn = document.getElementById('pda_state_btn');  
  pda_state_btn.addEventListener('click', stat_refresh); 

})();

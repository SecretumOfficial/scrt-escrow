const anchor = require('@project-serum/anchor');
const borsh = require('borsh');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
var sha256 = require('js-sha256');
const { v4: uuidv4 } = require('uuid');
const BIPS_PRECISION = 10000;
const utils = require("./utils");
const { programId } = require('../config');


function formatError(errors, err)
{
    if(err.InstructionError != null && err.InstructionError.length==2)
    {
        const err_code = err.InstructionError[1].Custom;
        if(err_code >= errors[0].code && err_code <= errors[errors.length-1].code)
        {
            return errors[err_code-errors[0].code].msg;
        }
        return "Custom erro code= " + err_code;
    }
    console.log(err);
    return "unknown error";
}

async function initialize(program, connection, 
    initializerAmount, takerAmount, mintA, mintB, signer){

    //create tokenA account
    let initializerTokenAccountA = await utils.createAssociatedTokenAccount(
        connection, mintA, signer, signer.publicKey, false);

    //create tokenB account        
    let initializerTokenAccountB = await utils.createAssociatedTokenAccount(
        connection, mintB, signer, signer.publicKey, false);

    //creating escrow account
    let escrow = await utils.createAccount(connection, signer, 8 + 4 * 32 + 16, program.programId);
        
    // const [vault_account_pda, vault_account_bump] = await anchor.web3.PublicKey.findProgramAddress(
    //     [Buffer.from(anchor.utils.bytes.utf8.encode("token-seed"))],
    //     program.programId
    // );

    const [vault_authority_pda, _vault_authority_bump] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("escrow")), escrow.toBuffer()],
        program.programId
      );

    const vault_account = await utils.createAssociatedTokenAccount(
        connection, mintA, signer, vault_authority_pda, true);
    console.log("vault_account=",vault_account.toString());

    let instr = program.instruction.initialize(
//        vault_account_bump,
        new anchor.BN(initializerAmount),
        new anchor.BN(takerAmount),  
        {
            accounts: {
                initializer: signer.publicKey,
                //vaultAccount: vault_account_pda,
                vaultAccount: vault_account,
                mint: mintA,
                initializerDepositTokenAccount: initializerTokenAccountA,
                initializerReceiveTokenAccount: initializerTokenAccountB,
                escrowAccount: escrow,                
                // systemProgram: anchor.web3.SystemProgram.programId,
                // rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                tokenProgram: TOKEN_PROGRAM_ID,      
            }
        }
    );

    const res = await utils.performInstructions(connection, signer, [instr]);
    if(res[0])
        return [escrow, 'ok'];
    return [null, formatError(program._idl.errors, res[1])];
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

async function get_now_ts(provider){
    const accountInfo = await provider.connection.getAccountInfo(anchor.web3.SYSVAR_CLOCK_PUBKEY);
    let clock = new Clock();
    clock.deser(accountInfo.data);
    return clock.unix_timestamp;
}


module.exports = {
    initialize,
    get_now_ts,
};

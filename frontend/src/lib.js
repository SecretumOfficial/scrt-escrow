const anchor = require('@project-serum/anchor');
const borsh = require('borsh');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
var sha256 = require('js-sha256');
const { v4: uuidv4 } = require('uuid');
const BIPS_PRECISION = 10000;
const utils = require("../../lib/utils");
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
    initializerAmount, takerAmount, depositToken, receiveToken, signer){

    let instructions = []; 
    //create tokenA account
    let [initializerDepositTokenAccount, insts] = await utils.createAssociatedTokenAccount(
        connection, depositToken, signer, signer.publicKey, false);
    instructions.push(...insts);

    //create tokenB account        
    let [initializerReceiveTokenAccount, insts1] = await utils.createAssociatedTokenAccount(
        connection, receiveToken, signer, signer.publicKey, false);
    instructions.push(...insts1);

    const [escrow] = await anchor.web3.PublicKey.findProgramAddress(
        [signer.publicKey.toBuffer(), depositToken.toBuffer(), receiveToken.toBuffer()], program.programId);
    const [vaultAccount] = await anchor.web3.PublicKey.findProgramAddress(
        [escrow.toBuffer()], program.programId);
    
    let instr = program.instruction.initialize(
        new anchor.BN(initializerAmount),
        new anchor.BN(takerAmount),  
        {
            accounts: {
                initializer: signer.publicKey,
                vaultAccount: vaultAccount,
                depositToken: depositToken,
                receiveToken: receiveToken,
                initializerDepositTokenAccount: initializerDepositTokenAccount,
                initializerReceiveTokenAccount: initializerReceiveTokenAccount,
                escrowAccount: escrow,                
                systemProgram: anchor.web3.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                tokenProgram: TOKEN_PROGRAM_ID,
            }
        }
    );
    instructions.push(instr);

    console.log("insts coount=", instructions.length);

    const res = await utils.performInstructions(connection, signer, instructions);
    if(res[0])
        return [escrow, 'ok'];
    return [null, formatError(program._idl.errors, res[1])];
}


async function cancel(
    program,
    connection,
    depositToken,
    receiveToken,
    signer,
) {

    const [escrow] = await anchor.web3.PublicKey.findProgramAddress(
        [signer.publicKey.toBuffer(), depositToken.toBuffer(), receiveToken.toBuffer()], program.programId);

    const escrowData = await utils.getEscrowAccount(program, escrow);
    if(escrowData == null)
    {
        return [null, 'no exist escrow'];
    }

    const [vaultAuthority] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from('escrow'), escrow.toBuffer()], program.programId);

    const instr = program.instruction.cancel(
        {
            accounts: {
                initializer: signer.publicKey,
                escrowAccount: escrow,
                vaultAccount: escrowData.vaultAccount,
                vaultAuthority: vaultAuthority,
                initializerDepositTokenAccount: escrowData.initializerDepositTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
        },
    );
    const res = await utils.performInstructions(connection, signer, [instr]);
    if(res[0])
    {
        const res1 = await connection.getParsedConfirmedTransaction(res[1], 'confirmed');
        console.log(res1);
        return [escrow, 'ok'];
    }
        
    return [null, formatError(program._idl.errors, res[1])];
}

async function exchange(
    program,
    connection,
    initializer,
    depositToken,
    receiveToken,
    signer,
) {

    const [escrow] = await anchor.web3.PublicKey.findProgramAddress(
        [initializer.toBuffer(), depositToken.toBuffer(), receiveToken.toBuffer()], program.programId);

    const escrowData = await utils.getEscrowAccount(program, escrow);
    if(escrowData == null)
    {
        return [null, 'no exist escrow'];
    }

    const takerDepositTokenAccount = await utils.getAssociatedTokenAddress(receiveToken, signer.publicKey, false);
    const takerReceiveTokenAccount = await utils.getAssociatedTokenAddress(depositToken, signer.publicKey, false);    

    const [vaultAuthority] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from('escrow'), escrow.toBuffer()], program.programId);

    const instr = program.instruction.exchange(
        {
            accounts: {
                taker: signer.publicKey,
                takerDepositTokenAccount: takerDepositTokenAccount,
                takerReceiveTokenAccount: takerReceiveTokenAccount,
                initializerReceiveTokenAccount: escrowData.initializerReceiveTokenAccount,
                initializer: initializer,
                escrowAccount: escrow,
                vaultAccount: escrowData.vaultAccount,
                vaultAuthority: vaultAuthority,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
        },
    );
    const res = await utils.performInstructions(connection, signer, [instr]);
    if(res[0])
        return [escrow, 'ok'];
    return [null, formatError(program._idl.errors, res[1])];
}



module.exports = {
    initialize,
    cancel,
    exchange
};

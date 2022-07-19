const anchor = require('@project-serum/anchor');
const ECDSA = require('ecdsa-secp256r1'); 

function sign(tokenAAddress, tokenBAddress, tokenAFee, tokenBFee){
    const jwt = {
        kty: 'EC',
        crv: 'P-256',
        x: 'c0BTMwZsD44WtVyGremxM1p4uSUlObsf8X5NaE_Jj4g',
        y: 'lISlFmVKpLTtH0V3129hbHVs-oGxvX9_cz3rDLlOJYw',
        d: 'I56ulBOeQLm0MR0V9Mv8YeQ7vJdTOYwavImU3ExYsSg'
      }
    const key = ECDSA.fromJWK(jwt);

    //make stream data to sign
    let data = new Uint8Array(32 + 32 + 8 + 8);
    data.set(tokenAAddress.toBuffer(), 0);
    data.set(tokenBAddress.toBuffer(), 32);
    data.set( (new anchor.BN(tokenAFee)).toBuffer(), 64);
    data.set( (new anchor.BN(tokenBFee)).toBuffer(), 72);
    //console.log(data);
    const sig = key.sign(new TextEncoder().encode(data));

    let r = [];
    let s = [];
    let sigDatas = Buffer.from(sig, 'base64')        
    for(let i=0; i<32; i++){
        r.push(sigDatas[i]);
    }
    for(let i=32; i<64; i++){
        s.push(sigDatas[i-32]);
    }
    return [r, s];
}

module.exports = {
    sign,
}

// describe('Verify tests', () => {
//     const keypair = ECDSA.generateKey()

//     it.skip('init already setteled', async () => {        
//         const private_key = new Uint8Array([
//             120, 98, 137, 187, 66, 103, 105, 24, 148, 58, 105, 17, 12, 54, 199, 180,
//             70, 152, 69, 71, 40, 206, 23, 137, 96, 118, 162, 176, 58, 175, 183, 17
//         ]);
//         const data = new TextEncoder().encode("ECDSA proves knowledge of a secret number in the context of a single message")
//         console.log(data)
//         //sign({ data, private_key }).then(console.log)
//         const sig = await sign({ data, private_key });
//         console.log(sig)

//     });

//     it('xxxxxxxxxxxx', async () => {
//         const private_key = new Uint8Array([
//             120, 98, 137, 187, 66, 103, 105, 24, 148, 58, 105, 17, 12, 54, 199, 180,
//             70, 152, 69, 71, 40, 206, 23, 137, 96, 118, 162, 176, 58, 175, 183, 17
//         ]);

//         const jwt = {
//             kty: 'EC',
//             crv: 'P-256',
//             x: 'c0BTMwZsD44WtVyGremxM1p4uSUlObsf8X5NaE_Jj4g',
//             y: 'lISlFmVKpLTtH0V3129hbHVs-oGxvX9_cz3rDLlOJYw',
//             d: 'I56ulBOeQLm0MR0V9Mv8YeQ7vJdTOYwavImU3ExYsSg'
//           }
//         const key = ECDSA.fromJWK(jwt)

//         let privKey = "priv=["
//         key.d.forEach(c => {
//             privKey = privKey + c.toString() + ", ";
//         });
//         console.log(privKey + "]")
//         console.log(key.d)

//         let pubKey = "pub=["
//         key.x.forEach(c => {
//             pubKey = pubKey + c.toString() + ", ";
//         });
//         key.y.forEach(c => {
//             pubKey = pubKey + c.toString() + ", ";
//         });
//         console.log(pubKey + "]")

//         console.log(key.x)
//         console.log(key.y)
//         const data = "ECDSA proves knowledge of a secret number in the context of a single message";        
//         const sig = key.sign(new TextEncoder().encode(data));
//         console.log(sig);

//         console.log(Buffer.from(sig, 'base64'))
//         let sigDatas = Buffer.from(sig, 'base64')        
//         let sigStr = "r=["
//         for(let i=0; i<32; i++){
//             sigStr = sigStr + sigDatas[i].toString() + ", ";
//         }
//         console.log(sigStr + "]")

//         sigStr = "s=["
//         for(let i=32; i<64; i++){
//             sigStr = sigStr + sigDatas[i].toString() + ", ";
//         }
//         console.log(sigStr + "]")
//     });    
// })
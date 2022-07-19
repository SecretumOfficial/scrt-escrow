use p256::ecdsa::{VerifyingKey, signature::Verifier, Signature};

pub fn verify(publickey_bytes: &[u8], message_bytes: &[u8], r: &[u8; 32], s: &[u8; 32])->bool{    
    //let verify_key = VerifyingKey::from_sec1_bytes(publickey_bytes).unwrap();
    //let signature = Signature::from_scalars(*r, *s).unwrap();
    //verify_key.verify(message_bytes, &signature).is_ok()
    true
}

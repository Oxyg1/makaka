// Проверка TON Connect ton_proof — доказательство владения кошельком.
// Алгоритм по спецификации TON Connect:
//   message  = "ton-proof-item-v2/" ‖ workchain(4 BE) ‖ addr_hash(32)
//              ‖ domain_len(4 LE) ‖ domain ‖ ts(8 LE) ‖ payload
//   signed   = sha256( 0xffff ‖ "ton-connect" ‖ sha256(message) )
//   verify ed25519(signature, signed, pubkey)
// pubkey берём ИЗ stateInit (а не из присланного поля) и проверяем, что адрес
// выводится из этого stateInit — иначе можно было бы привязать чужой адрес.

import { Address, Cell, contractAddress, loadStateInit } from '@ton/core';
import nacl from 'tweetnacl';
import { createHash } from 'crypto';

const ALLOWED_DOMAINS = (process.env.TONPROOF_DOMAINS ?? 'frog-swamp.duckdns.org').split(',').map(s => s.trim());
const PROOF_TTL_SEC = 15 * 60;

export interface IncomingProof {
  address?: string;
  public_key?: string;
  wallet_state_init?: string;
  proof?: {
    timestamp?: number;
    domain?: { lengthBytes?: number; value?: string };
    signature?: string;
    payload?: string;
    state_init?: string;
  };
}

function le32(n: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0, 0); return b; }
function be32(n: number): Buffer { const b = Buffer.alloc(4); b.writeInt32BE(n | 0, 0); return b; }
function le64(n: number): Buffer { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n), 0); return b; }

export function verifyTonProof(p: IncomingProof, expectedPayload: string): { ok: boolean; address?: string; error?: string } {
  try {
    const proof = p.proof;
    if (!proof || !proof.signature || !proof.domain?.value || proof.timestamp == null) return { ok: false, error: 'incomplete proof' };
    if (proof.payload !== expectedPayload) return { ok: false, error: 'payload mismatch' };
    if (!ALLOWED_DOMAINS.includes(proof.domain.value)) return { ok: false, error: `domain ${proof.domain.value} not allowed` };
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - proof.timestamp) > PROOF_TTL_SEC) return { ok: false, error: 'timestamp expired' };
    if (!p.address) return { ok: false, error: 'no address' };

    const stateInitB64 = proof.state_init ?? p.wallet_state_init;
    if (!stateInitB64) return { ok: false, error: 'no state_init' };

    const si = loadStateInit(Cell.fromBase64(stateInitB64).beginParse());
    const claimed = Address.parse(p.address);
    const derived = contractAddress(claimed.workChain, si);
    if (!derived.equals(claimed)) return { ok: false, error: 'address does not match state_init' };
    if (!si.data) return { ok: false, error: 'no wallet data' };

    // Стандартные кошельки v3/v4: data = seqno(32) ‖ subwallet(32) ‖ pubkey(256)
    const ds = si.data.beginParse();
    ds.skip(64);
    const pubkey = ds.loadBuffer(32);

    const message = Buffer.concat([
      Buffer.from('ton-proof-item-v2/'),
      be32(claimed.workChain),
      claimed.hash,
      le32(proof.domain.lengthBytes ?? Buffer.byteLength(proof.domain.value)),
      Buffer.from(proof.domain.value),
      le64(proof.timestamp),
      Buffer.from(proof.payload ?? ''),
    ]);
    const msgHash = createHash('sha256').update(message).digest();
    const signed = createHash('sha256')
      .update(Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from('ton-connect'), msgHash]))
      .digest();

    const sig = Buffer.from(proof.signature, 'base64');
    const ok = nacl.sign.detached.verify(new Uint8Array(signed), new Uint8Array(sig), new Uint8Array(pubkey));
    if (!ok) return { ok: false, error: 'bad signature' };

    return { ok: true, address: claimed.toRawString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

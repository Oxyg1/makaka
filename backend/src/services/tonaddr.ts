import { Address } from '@ton/core';

// Приводим любой TON-адрес (EQ.../UQ.../raw) к каноничному raw "0:hex",
// чтобы адреса из парсера и из ton_proof матчились между собой.
export function normAddr(a?: string | null): string | null {
  if (!a) return null;
  try { return Address.parse(a).toRawString(); } catch { return a; }
}

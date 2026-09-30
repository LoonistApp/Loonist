export interface AuditLedgerEntry {
  id: string;
  index: number;
  sequence: number;
  timestamp: string;
  action: 'MEASUREMENT_LOGGED' | 'TOLERANCE_MODIFIED' | 'BALLOON_REPOSITIONED' | 'CHARACTERISTIC_DELETED' | 'REPORT_EXPORTED';
  charId?: string;
  itemNumber?: string | number;
  details: Record<string, any>;
  inspector: string;
  previousHash: string;
  hash: string;
}

/**
 * No real per-user login exists in this app. Rather than defaulting to a
 * plausible-looking fake inspector ID (which would make every entry look
 * equally "signed" whether or not a real inspector was actually provided),
 * unattributed entries get an explicit sentinel so a ledger review can
 * immediately see which entries lack real attribution.
 */
export const UNSPECIFIED_INSPECTOR = 'UNSPECIFIED';

export class AuditLedgerService {
  private static readonly GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
  private static inMemoryLedger: AuditLedgerEntry[] = [];
  private static hydrated = false;

  /**
   * Fast synchronous SHA-256 implementation ensuring 100% offline air-gapped cryptographic integrity.
   * Used for the renderer's local mirror (synchronous UI reads, browser/test fallback when Electron's
   * window.api is unavailable). The authoritative, tamper-evident, disk-persisted chain lives in the
   * main process (electron/database.ts), which computes its own hashes with Node's real crypto module
   * over this exact same payload shape — the renderer is never trusted to assert a hash on its own.
   */
  public static computeSha256(input: string): string {
    // SHA-256 Constants
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    const utf8 = unescape(encodeURIComponent(input));
    const words: number[] = [];
    for (let i = 0; i < utf8.length; i++) {
      words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
    }

    const bitLength = utf8.length * 8;
    words[bitLength >> 5] |= 0x80 << (24 - (bitLength % 32));
    words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

    const w = new Int32Array(64);

    for (let i = 0; i < words.length; i += 16) {
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

      for (let j = 0; j < 64; j++) {
        if (j < 16) {
          w[j] = words[i + j] | 0;
        } else {
          const gamma0 = ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^ ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^ (w[j - 15] >>> 3);
          const gamma1 = ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^ ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^ (w[j - 2] >>> 10);
          w[j] = (w[j - 16] + gamma0 + w[j - 7] + gamma1) | 0;
        }

        const ch = (e & f) ^ (~e & g);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const sigma0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const sigma1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));

        const t1 = (h + sigma1 + ch + K[j] + w[j]) | 0;
        const t2 = (sigma0 + maj) | 0;

        h = g;
        g = f;
        f = e;
        e = (d + t1) | 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) | 0;
      }

      h0 = (h0 + a) | 0;
      h1 = (h1 + b) | 0;
      h2 = (h2 + c) | 0;
      h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0;
      h5 = (h5 + f) | 0;
      h6 = (h6 + g) | 0;
      h7 = (h7 + h) | 0;
    }

    const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
    return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
  }

  /**
   * Appends an action entry to the audit ledger, cryptographically chained to the previous entry.
   * Payload shape intentionally matches the main process's appendAuditEvent exactly (id, not a local
   * index) so entries computed on either side hash identically and hydrate() can merge them safely.
   */
  public static appendEntry(
    ledger: AuditLedgerEntry[],
    action: AuditLedgerEntry['action'],
    details: Record<string, any>,
    charId?: string,
    itemNumber?: string | number,
    inspector: string = UNSPECIFIED_INSPECTOR
  ): AuditLedgerEntry[] {
    const previousHash = ledger.length > 0 ? ledger[ledger.length - 1].hash : AuditLedgerService.GENESIS_HASH;
    const index = ledger.length + 1;
    const timestamp = new Date().toISOString();
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const payload = `${id}|${timestamp}|${action}|${charId || ''}|${JSON.stringify(details)}|${inspector}|${previousHash}`;
    const hash = AuditLedgerService.computeSha256(payload);

    const newEntry: AuditLedgerEntry = {
      id,
      index,
      sequence: index,
      timestamp,
      action,
      charId,
      itemNumber,
      details,
      inspector,
      previousHash,
      hash
    };

    return [...ledger, newEntry];
  }

  /**
   * Verifies the cryptographic integrity of the entire audit chain.
   * Returns true if all SHA-256 block links are mathematically intact.
   */
  public static verifyChain(ledger: AuditLedgerEntry[]): { isValid: boolean; brokenIndex?: number } {
    let prev = AuditLedgerService.GENESIS_HASH;

    for (let i = 0; i < ledger.length; i++) {
      const entry = ledger[i];
      if (entry.previousHash !== prev) {
        return { isValid: false, brokenIndex: i + 1 };
      }

      const payload = `${entry.id}|${entry.timestamp}|${entry.action}|${entry.charId || ''}|${JSON.stringify(entry.details)}|${entry.inspector}|${entry.previousHash}`;
      const recomputed = AuditLedgerService.computeSha256(payload);

      if (recomputed !== entry.hash) {
        return { isValid: false, brokenIndex: i + 1 };
      }

      prev = entry.hash;
    }

    return { isValid: true };
  }

  /**
   * Appends an entry to the singleton in-memory ledger (synchronous — existing call sites and the
   * test suite depend on an immediate return value), and fires a best-effort, fire-and-forget
   * persistence call to the main process so the entry survives restarts. The main process recomputes
   * its own hash independently rather than trusting one asserted by the renderer.
   */
  public static recordEntry(params: {
    characteristicId?: string;
    itemNumber?: string | number;
    subNumber?: string;
    action: string;
    inspectorInitials?: string;
    previousValue?: any;
    newValue?: any;
    conformanceStatus?: string;
    details?: string;
  }): AuditLedgerEntry {
    const actionKey: AuditLedgerEntry['action'] =
      params.action === 'MEASUREMENT_RECORDED' ? 'MEASUREMENT_LOGGED' :
      params.action === 'LIMITS_MODIFIED' ? 'TOLERANCE_MODIFIED' :
      params.action === 'BALLOON_REPOSITIONED' ? 'BALLOON_REPOSITIONED' :
      params.action === 'CHARACTERISTIC_DELETED' ? 'CHARACTERISTIC_DELETED' :
      params.action === 'REPORT_EXPORTED' ? 'REPORT_EXPORTED' :
      'MEASUREMENT_LOGGED';

    const details = {
      previousValue: params.previousValue,
      newValue: params.newValue,
      conformanceStatus: params.conformanceStatus,
      details: params.details,
      subNumber: params.subNumber
    };
    const inspector = params.inspectorInitials || UNSPECIFIED_INSPECTOR;

    AuditLedgerService.inMemoryLedger = AuditLedgerService.appendEntry(
      AuditLedgerService.inMemoryLedger,
      actionKey,
      details,
      params.characteristicId,
      params.itemNumber,
      inspector
    );

    const newEntry = AuditLedgerService.inMemoryLedger[AuditLedgerService.inMemoryLedger.length - 1];

    // Best-effort, non-blocking persistence. The renderer's local entry above is the source of
    // truth for this session's synchronous UI reads; the main process's independently-computed
    // and disk-persisted chain (fetched back via hydrate()) is the durable, authoritative record.
    const api = AuditLedgerService.getApi();
    if (api?.auditAppend) {
      api.auditAppend({
        action: actionKey,
        details,
        charId: params.characteristicId,
        itemNumber: params.itemNumber,
        inspector
      }).catch((err) => {
        console.error('Failed to persist audit entry to disk — it only exists in this session:', err);
      });
    }

    return newEntry;
  }

  /**
   * Loads the persisted chain from prior sessions into the in-memory mirror. Call once on app
   * startup. No-op outside Electron (browser dev fallback, test scripts) — the in-memory-only
   * behavior from before this hardening pass is preserved there.
   */
  public static async hydrate(): Promise<void> {
    const api = AuditLedgerService.getApi();
    if (AuditLedgerService.hydrated || !api?.auditGetAll) return;
    try {
      const persisted = await api.auditGetAll();
      AuditLedgerService.inMemoryLedger = persisted.map((p) => ({
        id: p.id,
        index: p.seq,
        sequence: p.seq,
        timestamp: p.timestamp,
        action: p.action as AuditLedgerEntry['action'],
        charId: p.charId,
        itemNumber: p.itemNumber,
        details: p.details,
        inspector: p.inspector,
        previousHash: p.previousHash,
        hash: p.hash
      }));
      AuditLedgerService.hydrated = true;
    } catch (err) {
      console.error('Failed to load audit ledger history from disk:', err);
    }
  }

  public static getEntries(): AuditLedgerEntry[] {
    return AuditLedgerService.inMemoryLedger;
  }

  /** Fast, synchronous check of the local in-memory mirror. */
  public static verifyIntegrity(): { isValid: boolean; brokenSequence?: number } {
    const res = AuditLedgerService.verifyChain(AuditLedgerService.inMemoryLedger);
    return {
      isValid: res.isValid,
      brokenSequence: res.brokenIndex
    };
  }

  /** Authoritative check against the disk-persisted chain in the main process. */
  public static async verifyAuthoritative(): Promise<{ isValid: boolean; brokenSequence?: number }> {
    const api = AuditLedgerService.getApi();
    if (!api?.auditVerify) {
      return AuditLedgerService.verifyIntegrity();
    }
    return api.auditVerify();
  }

  public static clearLedger(): void {
    AuditLedgerService.inMemoryLedger = [];
    AuditLedgerService.hydrated = false;
  }

  /** Safe in any environment: plain Node test scripts have no `window` global at all. */
  private static getApi(): Window['api'] | undefined {
    return typeof window !== 'undefined' ? window.api : undefined;
  }
}

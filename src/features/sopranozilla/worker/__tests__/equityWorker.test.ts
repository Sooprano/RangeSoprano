import { describe, expect, it } from 'vitest';
import { parseCards } from '../../engine/cards';
import { comboId, weightsFromHandRange } from '../../engine/combos';
import { equityVsRange } from '../../engine/equity';
import { EquityClient, SupersededError, type WorkerLike } from '../equityClient';
import { handleEqRequest, type EqRequest, type EqResponse } from '../protocol';

const hero = parseCards('AhAd')!;
const flop = parseCards('Ks 7c 2d')!;
const kk = comboId(parseCards('Kc')![0]!, parseCards('Kd')![0]!);

describe('worker handler', () => {
  it('reports progress and returns per-combo equity', () => {
    const msgs: EqResponse[] = [];
    const combos = Array.from({ length: 60 }, (_, i) => i).concat(kk);
    handleEqRequest({ type: 'eqCombos', requestId: 7, hero, board: flop, combos }, (m) =>
      msgs.push(m),
    );
    const progress = msgs.filter((m) => m.type === 'progress');
    expect(progress.length).toBeGreaterThanOrEqual(2);
    const result = msgs.at(-1);
    expect(result?.type).toBe('result');
    if (result?.type !== 'result') return;
    expect(result.requestId).toBe(7);
    expect(result.eq[result.combos.indexOf(kk)]).toBeCloseTo(85 / 990, 12);
  });

  it('answers with an error for an invalid spot', () => {
    const msgs: EqResponse[] = [];
    handleEqRequest({ type: 'eqCombos', requestId: 1, hero, board: [0], combos: [] }, (m) =>
      msgs.push(m),
    );
    expect(msgs).toEqual([{ type: 'error', requestId: 1, message: expect.any(String) }]);
  });
});

/** In-process fake: runs the real handler asynchronously, like a worker. */
function fakeWorkerFactory(log: EqRequest[]): () => WorkerLike {
  return () => {
    let alive = true;
    const w: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage: (req) => {
        log.push(req);
        setTimeout(() => {
          handleEqRequest(req, (msg) => {
            if (alive) w.onmessage?.({ data: msg } as MessageEvent<EqResponse>);
          });
        }, 0);
      },
      terminate: () => {
        alive = false;
      },
    };
    return w;
  };
}

describe('EquityClient', () => {
  it('computes only what is missing and serves the rest from the cache', async () => {
    const log: EqRequest[] = [];
    const client = new EquityClient(fakeWorkerFactory(log));
    const weights = weightsFromHandRange('KK, QQ');

    const table = await client.ensure(hero, flop, weights);
    expect(log).toHaveLength(1);
    expect(log[0]!.combos).toHaveLength(3 + 6); // KK minus Ks, all QQ
    expect(equityVsRange(table, weights, hero, flop).missing).toBe(0);

    await client.ensure(hero, flop, weights);
    expect(log).toHaveLength(1); // cache hit

    await client.ensure(hero, flop, weightsFromHandRange('KK, QQ, JJ'));
    expect(log).toHaveLength(2);
    expect(log[1]!.combos).toHaveLength(6); // only JJ is new
    client.dispose();
  });

  it('a request already covered by the running one shares it (no restart)', async () => {
    const log: EqRequest[] = [];
    const client = new EquityClient(fakeWorkerFactory(log));
    const weights = weightsFromHandRange('QQ, JJ');
    const first = client.ensure(hero, flop, weights);
    const second = client.ensure(hero, flop, weightsFromHandRange('QQ'));
    expect(second).toBe(first);
    await expect(second).resolves.toBeInstanceOf(Float64Array);
    expect(log).toHaveLength(1);
    client.dispose();
  });

  it('a newer request supersedes the pending one', async () => {
    const client = new EquityClient(fakeWorkerFactory([]));
    const first = client.ensure(hero, flop, weightsFromHandRange('QQ'));
    const second = client.ensure(hero, parseCards('Ks 7c 3d')!, weightsFromHandRange('QQ'));
    await expect(first).rejects.toBeInstanceOf(SupersededError);
    await expect(second).resolves.toBeInstanceOf(Float64Array);
    client.dispose();
  });
});

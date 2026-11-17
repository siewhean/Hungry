// @ts-nocheck
import { handleNotificationWorker, expoRequest } from './index.ts';
function assert(value, message) { if (!value) throw new Error(message); }
const job = (id = 'job-1') => ({ id, user_id: 'user-1', category: 'weekly_picks', attempts: 1,
  created_at: '2026-11-16T12:00:00Z', title: 'test', body: 'test', deep_link: 'hungry://home' });
function database(jobs = [job()], options = {}) {
  const updates = []; const tickets = []; const settled = [];
  const client = {
    rpc(name, args) {
      if (name === 'claim_notification_receipts') return Promise.resolve({ data: options.receipts ?? [] });
      if (name === 'claim_notification_jobs') return Promise.resolve({ data: jobs });
      if (name === 'record_notification_tickets') { tickets.push(...args.p_tickets); return Promise.resolve({ error: options.ticketError }); }
      if (name === 'settle_notification_receipts') { settled.push(...args.p_results); return Promise.resolve({}); }
      throw new Error(name);
    },
    from(table) {
      let write = false; let fields;
      const query = {
        select() { return query; }, in() { return query; }, eq() { return query; }, gte() { return query; },
        update(value) { write = true; fields = value; updates.push(value); return query; },
        delete() { write = true; return query; },
        single() { return query; },
        then(resolve) {
          if (write) return Promise.resolve({ data: { id: 'job-1' }, error: options.updateError?.(fields) }).then(resolve);
          const data = table === 'notification_preferences' ? [{ user_id: 'user-1', weekly_picks: true }]
            : table === 'user_push_tokens' ? [{ user_id: 'user-1', token: 'ExponentPushToken[test]' }] : [];
          return Promise.resolve({ data, error: options.lookupError === table ? { message: 'injected' } : null }).then(resolve);
        },
      }; return query;
    },
  }; return { client, updates, tickets, settled };
}
async function run(db, fetcher = () => Promise.resolve(Response.json({ data: [{ status: 'ok', id: 'ticket-1' }] })), extra = {}) {
  const names = ['NOTIFICATION_WORKER_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const old = names.map(name => Deno.env.get(name));
  names.forEach((name, i) => Deno.env.set(name, ['local-test-token', 'https://test.invalid', 'local-test-key'][i]));
  try { return await handleNotificationWorker(new Request('https://test.invalid', {
    method: 'POST', headers: { Authorization: 'Bearer local-test-token' }, body: '{}',
  }), { client: db.client, fetcher, now: () => new Date('2026-11-16T13:00:00Z'), timeoutMs: 20, ...extra }); }
  finally { names.forEach((name, i) => old[i] === undefined ? Deno.env.delete(name) : Deno.env.set(name, old[i])); }
}
Deno.test('failed lookups preserve jobs and never send or permanently skip', async () => {
  for (const table of ['notification_preferences','user_push_tokens','dishes','notification_jobs']) {
    const db = database([job()], { lookupError: table }); let calls = 0;
    const response = await run(db, () => { calls++; throw new Error('must not send'); });
    assert(response.status === 503 && calls === 0, `must defer on ${table} failure`);
    assert(db.updates.length === 1 && db.updates[0].status === 'pending' && db.updates[0].attempts === 0, 'must release retry without consuming attempt');
  }
});
Deno.test('accepted tickets persist before job acceptance and never count as sent', async () => {
  const db = database(); const response = await run(db); const body = await response.json();
  assert(response.status === 200 && body.accepted === 1 && body.sent === undefined, 'ticket acceptance differs from receipt confirmation');
  assert(db.tickets[0].ticket_id === 'ticket-1' && db.tickets[0].token === 'ExponentPushToken[test]', 'must persist ticket/token association');
  assert(db.updates[0].status === 'delivery_unknown' && db.updates[1].status === 'accepted', 'must guard transport before dispatch');
});
Deno.test('failed acceptance persistence is visible and cannot schedule blind resend', async () => {
  const db = database([job()], { updateError: fields => fields.status === 'accepted' ? { message: 'offline' } : null });
  const response = await run(db);
  assert(response.status === 503, 'must not report completion');
  assert(!db.updates.some(row => row.status === 'pending'), 'known acceptance must not resend');
});
Deno.test('request and body deadlines bound hung transport and retain ambiguous delivery', async () => {
  for (const fetcher of [() => new Promise(() => {}), () => Promise.resolve({ ok: true, json: () => new Promise(() => {}) })]) {
    const db = database(); const response = await run(db, fetcher); const result = await response.json();
    assert(response.status === 200 && result.unknown === 1, 'ambiguous timeout remains observable and unretried');
    assert(db.updates.at(-1).status === 'delivery_unknown', 'timeout must not duplicate a potentially accepted push');
  }
});
Deno.test('receipt poll runs without pending send jobs and processes delayed provider errors', async () => {
  const db = database([], { receipts: [{ ticket_id: 'old-ticket' }] }); let endpoint;
  const response = await run(db, url => { endpoint = url; return Promise.resolve(Response.json({ data: { 'old-ticket': { status: 'error', details: { error: 'DeviceNotRegistered' } } } })); });
  assert(response.status === 200 && endpoint.endsWith('getReceipts'), 'receipt polling must run independently');
  assert(db.settled[0].status === 'error' && db.settled[0].error_code === 'DeviceNotRegistered', 'receipt error must reach transactional token cleanup');
});
Deno.test('quiet hour is recomputed after a preceding send crosses 22:00 Singapore', async () => {
  const db = database([job('one'), job('two')]); let clockCalls = 0; let sends = 0;
  const response = await run(db, () => { sends++; return Promise.resolve(Response.json({ data: [{status: 'ok', id: 'ticket'}] })); }, {
    now: () => new Date(++clockCalls <= 2 ? '2026-11-16T13:59:59Z' : '2026-11-16T14:00:01Z'),
  });
  const result = await response.json();
  assert(sends === 1 && result.deferred === 1, 'second send must observe new quiet hour');
});

Deno.test('ticket persistence failure remains an observable uncertainty hold', async () => {
  const db = database([job()], { ticketError: { message: 'injected unavailable storage' } });
  const response = await run(db);
  assert(response.status === 503 && db.updates.at(-1).status === 'delivery_unknown', 'must not claim acceptance or blindly requeue after ticket loss');
});
Deno.test('explicit provider rejection retries safely and failed finalization is not success', async () => {
  const db = database();
  const response = await run(db, () => Promise.resolve(Response.json({ errors: [] }, { status: 503 })));
  assert(response.status === 200 && db.updates.at(-1).status === 'pending', 'explicit refusal may retry');
  const failing = database([job()], { updateError: fields => fields.status === 'pending' ? { message: 'offline' } : null });
  const failed = await run(failing, () => Promise.resolve(Response.json({}, { status: 503 })));
  assert(failed.status === 503, 'failed retry finalization must be visible');
});

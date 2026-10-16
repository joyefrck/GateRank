import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { requestUrlByAddress } from '../src/services/websiteProbe';
test('a stalled 418 body cannot erase the received HTTP error', async () => {
  const server = http.createServer((_req,res) => { res.writeHead(418,{'Content-Type':'text/html'}); res.write('<html>'); });
  server.listen(0);
  await new Promise<void>((resolve) => server.once('listening',resolve));
  const controller = new AbortController();
  try {
    const result = await requestUrlByAddress(new URL(`http://localhost:${(server.address() as AddressInfo).port}/`),{address:'127.0.0.1',family:4},100,controller.signal);
    assert.equal(result.status,418);
    assert.notEqual(result.waf_challenge,true);
  } finally { controller.abort(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});

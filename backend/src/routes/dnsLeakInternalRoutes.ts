import { Router } from 'express';
import {
  DnsLeakTestServiceError,
  type DnsLeakTestService,
} from '../services/dnsLeakTestService';
import { sendError } from '../utils/http';

export function createDnsLeakInternalRoutes(service: DnsLeakTestService): Router {
  const router = Router();

  router.post('/tools/dns-leak-test/observations', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    try {
      service.recordObservation(
        req.body,
        String(req.header('x-dns-probe-timestamp') || ''),
        String(req.header('x-dns-probe-signature') || ''),
      );
      res.status(202).json({ accepted: true });
    } catch (error) {
      if (error instanceof DnsLeakTestServiceError) {
        sendError(
          res,
          error.status,
          error.code,
          dnsLeakInternalErrorMessage(error.code),
          req.requestId || 'unknown',
        );
        return;
      }
      throw error;
    }
  });

  return router;
}

function dnsLeakInternalErrorMessage(code: DnsLeakTestServiceError['code']): string {
  if (code === 'DNS_LEAK_TEST_INVALID_SIGNATURE') return 'DNS 探针回报签名无效';
  if (code === 'DNS_LEAK_TEST_REPLAYED_OBSERVATION') return 'DNS 探针回报已处理';
  if (code === 'DNS_LEAK_TEST_SESSION_NOT_FOUND') return 'DNS 检测会话不存在或已过期';
  if (code === 'DNS_LEAK_TEST_NOT_CONFIGURED') return 'DNS 泄漏检测尚未配置';
  return 'DNS 探针回报格式无效';
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRiskReasonSummary, deriveRiskReasonCodes } from '../src/utils/risk';

test('buildRiskReasonSummary uses probe-specific wording for domain probe failures', () => {
  const summary = buildRiskReasonSummary({
    metrics: {
      domain_ok: false,
      ssl_days_left: null,
      recent_complaints_count: 0,
      history_incidents: 0,
    },
    score: {
      r: 65,
      details: {
        ssl_penalty: 5,
        complaint_penalty: 0,
        history_penalty: 0,
      },
    },
  });

  assert.equal(summary, '官网自动探测未通过，且仍存在SSL 告警。');
});

test('buildRiskReasonSummary describes recovered reachability as current probe normal', () => {
  const summary = buildRiskReasonSummary({
    metrics: {
      domain_ok: true,
      ssl_days_left: 90,
      recent_complaints_count: 2,
      history_incidents: 0,
    },
    score: {
      r: 82,
      details: {
        ssl_penalty: 0,
        complaint_penalty: 6,
        history_penalty: 0,
      },
    },
  });

  assert.equal(summary, '官网当前探测正常，当前风险主要来自近期投诉 2 条。');
});

test('deriveRiskReasonCodes still reports domain and ssl reasons independently', () => {
  const reasons = deriveRiskReasonCodes({
    metrics: {
      domain_ok: false,
      ssl_days_left: null,
      recent_complaints_count: 0,
      history_incidents: 0,
    },
    score: {
      r: 65,
      details: {
        ssl_penalty: 5,
        complaint_penalty: 0,
        history_penalty: 0,
      },
    },
  });

  assert.deepEqual(reasons, ['domain_unreachable', 'ssl_warning']);
});

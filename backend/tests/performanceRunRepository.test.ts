import test from 'node:test';
import assert from 'node:assert/strict';

import { PerformanceRunRepository } from '../src/repositories/performanceRunRepository';

test('PerformanceRunRepository maps legacy rows to explicit compatibility fields', async () => {
  const repository = new PerformanceRunRepository({
    query: async (sql: string) => {
      if (sql.includes('FROM airport_performance_runs') && sql.includes('ORDER BY')) {
        return [[{
          id: 7,
          airport_id: 9,
          sampled_at: '2026-08-08 12:00:00',
          sampled_date: null,
          source: 'cron-performance',
          status: 'success',
          subscription_format: 'plain',
          parsed_nodes_count: 1,
          supported_nodes_count: 1,
          selected_nodes_json: '[]',
          tested_nodes_json: '[]',
          available_nodes_count: 1,
          unavailable_nodes_count: 0,
          node_availability_percent: 100,
          node_unavailability_percent: 0,
          median_latency_ms: 80,
          median_download_mbps: 200,
          packet_loss_percent: 0,
          error_code: null,
          error_message: null,
          diagnostics_json: '{}',
          job_id: null,
          probe_id: null,
          region_code: null,
          provider: null,
          bandwidth_mbps: null,
          run_mode: null,
          test_profile: null,
          scoring_rule_version: null,
          config_version: null,
          calibration_status: null,
          calibration_mbps: null,
          review_status: null,
          review_reasons_json: null,
        }]];
      }
      return [[]];
    },
  } as never);

  const rows = await repository.listByAirportAndDate(9, '2026-08-08');

  assert.equal(rows[0]?.probe_id, 'legacy-control');
  assert.equal(rows[0]?.scoring_rule_version, 'legacy_v1');
  assert.equal(rows[0]?.run_mode, 'official');
  assert.equal(rows[0]?.sampled_date, '2026-08-08');
  assert.equal(rows[0]?.review_status, 'normal');
});

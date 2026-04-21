import mysql from 'mysql2/promise';
import { computeMedian, generateAirportTags } from './backend/src/services/taggingService.ts';

(async () => {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'gaterank',
  });

  const [airportRows] = await conn.query<any[]>(
    "SELECT id,name,website,status,plan_price_month,has_trial,subscription_url,created_at,tags_json FROM airports WHERE name='大象网络' LIMIT 1",
  );
  if (!airportRows.length) {
    console.log(JSON.stringify({ ok: false, message: '未找到机场 大象网络' }, null, 2));
    await conn.end();
    return;
  }

  const airport = airportRows[0];
  const [dateRows] = await conn.query<any[]>(
    "SELECT DATE_FORMAT(MAX(date), '%Y-%m-%d') AS date_str FROM airport_scores_daily WHERE airport_id = ?",
    [airport.id],
  );
  const date = dateRows[0]?.date_str as string | null;

  if (!date) {
    await conn.query('UPDATE airports SET tags_json = ? WHERE id = ?', [JSON.stringify(['不推荐']), airport.id]);
    console.log(JSON.stringify({ ok: true, airport_id: airport.id, airport_name: airport.name, date: null, tags: ['不推荐'], reason: '无评分数据' }, null, 2));
    await conn.end();
    return;
  }

  const [metricsRows] = await conn.query<any[]>(
    `SELECT airport_id, DATE_FORMAT(date, '%Y-%m-%d') AS date, uptime_percent_30d, median_latency_ms, median_download_mbps,
            packet_loss_percent, stable_days_streak, domain_ok, ssl_days_left, recent_complaints_count, history_incidents
       FROM airport_metrics_daily
      WHERE airport_id = ? AND date = ?
      LIMIT 1`,
    [airport.id, date],
  );

  const [scoreRows] = await conn.query<any[]>(
    `SELECT airport_id, DATE_FORMAT(date, '%Y-%m-%d') AS date, score_s AS s, score_p AS p, score_c AS c, score_r AS r,
            risk_penalty, score, recent_score, historical_score, final_score, details_json AS details
       FROM airport_scores_daily
      WHERE airport_id = ? AND date = ?
      LIMIT 1`,
    [airport.id, date],
  );

  const [priceRows] = await conn.query<any[]>(
    `SELECT a.plan_price_month
       FROM airport_scores_daily s
       JOIN airports a ON a.id = s.airport_id
      WHERE s.date = ?`,
    [date],
  );

  const priceMedian = computeMedian(priceRows.map((r) => Number(r.plan_price_month)));
  const metrics = metricsRows[0] || null;
  const score = scoreRows[0]
    ? {
        ...scoreRows[0],
        details: typeof scoreRows[0].details === 'string' ? JSON.parse(scoreRows[0].details) : (scoreRows[0].details || {}),
      }
    : null;

  const tags = generateAirportTags({
    date,
    airport: {
      id: Number(airport.id),
      name: String(airport.name),
      website: String(airport.website || ''),
      status: airport.status,
      is_listed: true,
      plan_price_month: Number(airport.plan_price_month),
      has_trial: Boolean(airport.has_trial),
      subscription_url: airport.subscription_url,
      tags: [],
      created_at: String(airport.created_at).slice(0, 10),
    },
    metrics,
    score,
    priceMedian,
  });

  await conn.query('UPDATE airports SET tags_json = ? WHERE id = ?', [JSON.stringify(tags), airport.id]);

  const [afterRows] = await conn.query<any[]>(
    'SELECT tags_json FROM airports WHERE id = ?',
    [airport.id],
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        airport_id: airport.id,
        airport_name: airport.name,
        date,
        tags,
        stored_tags: afterRows[0]?.tags_json,
        basis: {
          final_score: score?.final_score ?? null,
          recent_score: score?.recent_score ?? null,
          risk_score: score?.r ?? null,
          performance_score: score?.p ?? null,
          stability_score: Number(score?.details?.stability_score ?? 0),
          stable_days_streak: metrics?.stable_days_streak ?? null,
          price_score: Number(score?.details?.price_score ?? 0),
          recent_complaints_count: metrics?.recent_complaints_count ?? null,
          history_incidents: metrics?.history_incidents ?? null,
          has_trial: Boolean(airport.has_trial),
          plan_price_month: Number(airport.plan_price_month),
          price_median: priceMedian,
        },
      },
      null,
      2,
    ),
  );

  await conn.end();
})();

import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { applyBackendEnvToProcessEnv } from "../src/utils/backendEnv";
import { TopicRepository } from "../src/topics/topicRepository";
import { TopicService } from "../src/topics/topicService";
import { seedTopics } from "../src/topics/topicSeeds";
import { EMPTY_SEO_TOPIC, type SeoTopicInput } from "../../shared/seoTopics";

test(
  "MySQL topic transactions, path ownership, manual relationships, prices and repeatable seeds",
  { skip: process.env.TOPIC_TEST_MYSQL !== "1" },
  async () => {
    applyBackendEnvToProcessEnv();
    const host = process.env.MYSQL_HOST || "127.0.0.1";
    assert.ok(
      ["127.0.0.1", "localhost", "::1"].includes(host),
      "Integration tests require local MySQL",
    );
    const config = {
      host,
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
    };
    const admin = await mysql.createConnection(config);
    const name = `gaterank_topic_test_${process.pid}_${Date.now()}`;
    await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
    const pool = mysql.createPool({
      ...config,
      database: name,
      decimalNumbers: true,
    });
    try {
      await pool.query(
        "CREATE TABLE airports(id INT PRIMARY KEY,airport_profile_json JSON)",
      );
      await pool.query("INSERT INTO airports VALUES(1,?),(2,?),(3,?)", [
        JSON.stringify({
          plan: { supports_monthly: true, lowest_monthly_price: 10 },
        }),
        JSON.stringify({
          plan: {
            supports_monthly: false,
            lowest_monthly_price: 1,
            lowest_annual_monthly_price: 1,
          },
        }),
        JSON.stringify({
          plan: { supports_monthly: true, lowest_monthly_price: 5 },
        }),
      ]);
      const repo = new TopicRepository(pool);
      await repo.ensureSchema();
      await repo.ensureSchema();
      const base: SeoTopicInput = {
        ...EMPTY_SEO_TOPIC,
        name: "数据库验收",
        h1: "数据库验收",
        path: "/db-test",
        content_markdown: "## 指南",
        seo_title: "标题",
        seo_description: "描述",
        airports: [
          { airport_id: 3, reason: "先选" },
          { airport_id: 1, reason: "后选" },
        ],
      };
      const draft = await repo.save(base);
      assert.equal((await repo.list(true)).length, 0);
      const renamed = await repo.save(
        { ...base, path: "/db-renamed" },
        draft.id,
      );
      assert.equal(await repo.resolve("/db-test"), null);
      await repo.save({ ...renamed, status: "published" }, draft.id);
      const moved = await repo.save(
        { ...renamed, path: "/db-final", status: "published" },
        draft.id,
      );
      await repo.save({ ...moved, path: "/db-latest" }, draft.id);
      assert.equal((await repo.resolve("/db-renamed"))?.path, "/db-latest");
      assert.equal((await repo.resolve("/db-final"))?.path, "/db-latest");
      await assert.rejects(repo.save({ ...base, path: "/db-renamed" }), /URL/);
      const [before] = await pool.query(
        "SELECT * FROM seo_topic_airports WHERE topic_id=? ORDER BY position",
        [draft.id],
      );
      assert.deepEqual(
        (before as { airport_id: number }[]).map((row) => row.airport_id),
        [3, 1],
      );
      await assert.rejects(
        repo.save(
          { ...moved, path: "/must-rollback", related_ids: [999999] },
          draft.id,
        ),
      );
      assert.equal((await repo.get(draft.id))?.path, "/db-latest");
      assert.equal(await repo.resolve("/must-rollback"), null);
      assert.deepEqual((await repo.get(draft.id))?.airports, base.airports);
      const current = (await repo.get(draft.id))!;
      await repo.save({ ...current, status: "archived" }, draft.id);
      assert.equal((await repo.resolve("/db-renamed"))?.status, "archived");
      const prices = await repo.monthlyPrices([1, 2, 3]);
      assert.deepEqual(
        [...prices],
        [
          [1, 10],
          [3, 5],
        ],
      );
      const service = new TopicService(repo, {
        getFullRankingView: async () => ({
          total_pages: 1,
          items: [1, 2, 3].map((id) => ({
            airport_id: id,
            name: `机场${id}`,
            report_url: `/airports/${id}`,
            plan_price_month: 1,
            score: 50,
            capabilities: {
              clients: [
                { key: "clash", label: "Clash" },
                { key: "shadowrocket", label: "Shadowrocket" },
              ],
              streaming: [{ key: "chatgpt", label: "ChatGPT" }],
            },
          })),
        }),
      } as never);
      assert.deepEqual(await seedTopics(service), { created: 5, skipped: 0 });
      const cheap = (await repo.list()).find(
        (t) => t.path === "/rankings/cheap-airports",
      )!;
      assert.deepEqual(
        cheap.airports.map((a) => a.airport_id),
        [3, 1],
      );
      const clash = (await repo.list()).find(
        (t) => t.path === "/rankings/clash-airports",
      )!;
      await repo.save(
        { ...clash, path: "/renamed-seed", content_markdown: "管理员编辑内容" },
        clash.id,
      );
      assert.deepEqual(await seedTopics(service), { created: 0, skipped: 5 });
      assert.equal(
        (await repo.get(clash.id))?.content_markdown,
        "管理员编辑内容",
      );
      const results = await Promise.allSettled([
        repo.save({ ...base, path: "/concurrent" }),
        repo.save({ ...base, path: "/concurrent" }),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        (await repo.list()).filter((t) => t.path === "/concurrent").length,
        1,
      );
    } finally {
      await pool.end();
      await admin.query(`DROP DATABASE \`${name}\``);
      await admin.end();
    }
  },
);

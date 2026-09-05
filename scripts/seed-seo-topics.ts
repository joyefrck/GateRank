import "dotenv/config";
import { applyBackendEnvToProcessEnv } from "../backend/src/utils/backendEnv";
import { getDbPool } from "../backend/src/db/mysql";
import { TopicRepository } from "../backend/src/topics/topicRepository";
import { TopicService } from "../backend/src/topics/topicService";
import { seedTopics } from "../backend/src/topics/topicSeeds";
import type { FullRankingView } from "../backend/src/types/domain";

applyBackendEnvToProcessEnv();
// Seed only the local database. Deployments can invoke seedTopics explicitly with their service.
if (
  !["127.0.0.1", "localhost", "::1"].includes(
    process.env.MYSQL_HOST || "127.0.0.1",
  )
)
  throw new Error("此命令仅允许初始化本地数据库");
const base = process.env.TOPIC_SEED_API || "http://127.0.0.1:8787";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname))
  throw new Error("种子数据源必须是本地 API");
const pool = getDbPool();
try {
  const repository = new TopicRepository(pool);
  await repository.ensureSchema();
  const service = new TopicService(repository, {
    async getFullRankingView(date, page, pageSize) {
      const response = await fetch(
        `${base}/api/v1/pages/full-ranking?date=${date}&page=${page}&page_size=${pageSize}`,
      );
      if (!response.ok) throw new Error(`公开数据读取失败: ${response.status}`);
      return (await response.json()) as FullRankingView;
    },
  });
  console.log(JSON.stringify(await seedTopics(service)));
} finally {
  await pool.end();
}

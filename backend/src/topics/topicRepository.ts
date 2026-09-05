import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import type { SeoTopic, SeoTopicInput } from "../../../shared/seoTopics";
import { HttpError } from "../middleware/errorHandler";

export class TopicRepository {
  constructor(private pool: Pool) {}
  async ensureSchema() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS seo_topics (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, path VARCHAR(240) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
      seed_key VARCHAR(40) NULL UNIQUE, status VARCHAR(20) NOT NULL, sort_order INT NOT NULL DEFAULT 0, document JSON NOT NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX(status, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const [columns] = await this.pool.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM seo_topics LIKE 'seed_key'",
    );
    if (!columns.length) {
      try {
        await this.pool.query(
          "ALTER TABLE seo_topics ADD COLUMN seed_key VARCHAR(40) NULL UNIQUE",
        );
      } catch (error) {
        if ((error as { code?: string }).code !== "ER_DUP_FIELDNAME")
          throw error;
      }
    }
    await this.pool.query(`CREATE TABLE IF NOT EXISTS seo_topic_paths (
      path VARCHAR(240) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, topic_id INT UNSIGNED NOT NULL,
      was_published BOOLEAN NOT NULL DEFAULT FALSE, INDEX(topic_id),
      FOREIGN KEY(topic_id) REFERENCES seo_topics(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS seo_topic_airports (
      topic_id INT UNSIGNED NOT NULL, airport_id INT UNSIGNED NOT NULL, position INT NOT NULL, reason TEXT NOT NULL,
      PRIMARY KEY(topic_id, airport_id), FOREIGN KEY(topic_id) REFERENCES seo_topics(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS seo_topic_related (
      topic_id INT UNSIGNED NOT NULL, related_id INT UNSIGNED NOT NULL, position INT NOT NULL,
      PRIMARY KEY(topic_id, related_id), FOREIGN KEY(topic_id) REFERENCES seo_topics(id) ON DELETE CASCADE,
      FOREIGN KEY(related_id) REFERENCES seo_topics(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
  }
  async hasSeed(key: string): Promise<boolean> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT id FROM seo_topics WHERE seed_key=?",
      [key],
    );
    return rows.length > 0;
  }
  async monthlyPrices(ids: number[]): Promise<Map<number, number>> {
    if (!ids.length) return new Map();
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT id, airport_profile_json FROM airports WHERE id IN (?)",
      [ids],
    );
    return new Map(
      rows.flatMap((row) => {
        const profile =
          typeof row.airport_profile_json === "string"
            ? JSON.parse(row.airport_profile_json)
            : row.airport_profile_json;
        const plan = profile?.plan;
        const price = Number(plan?.lowest_monthly_price);
        return plan?.supports_monthly === true &&
          price > 0 &&
          Number.isFinite(price)
          ? [[Number(row.id), price] as [number, number]]
          : [];
      }),
    );
  }
  async list(publishedOnly = false): Promise<SeoTopic[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM seo_topics ${publishedOnly ? "WHERE status='published'" : ""} ORDER BY sort_order, id`,
    );
    return rows.map((row) => this.map(row));
  }
  async get(id: number): Promise<SeoTopic | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM seo_topics WHERE id=?",
      [id],
    );
    return rows[0] ? this.map(rows[0]) : null;
  }
  async resolve(path: string): Promise<SeoTopic | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT t.* FROM seo_topics t JOIN seo_topic_paths p ON p.topic_id=t.id WHERE p.path=? AND (p.path=t.path OR p.was_published=1)`,
      [path],
    );
    return rows[0] ? this.map(rows[0]) : null;
  }
  private map(row: RowDataPacket): SeoTopic {
    const doc =
      typeof row.document === "string"
        ? JSON.parse(row.document)
        : row.document;
    return {
      ...doc,
      id: Number(row.id),
      path: row.path,
      status: row.status,
      sort_order: row.sort_order,
      updated_at:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at),
    };
  }
  async save(
    input: SeoTopicInput,
    id?: number,
    seedKey?: string,
  ): Promise<SeoTopic> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      let oldPath: string | undefined;
      if (id) {
        const [old] = await connection.query<RowDataPacket[]>(
          "SELECT path FROM seo_topics WHERE id=? FOR UPDATE",
          [id],
        );
        if (!old[0]) throw new HttpError(404, "TOPIC_NOT_FOUND", "专题不存在");
        oldPath = old[0].path;
      }
      if (input.related_ids.includes(id || 0))
        throw new HttpError(400, "BAD_REQUEST", "不能关联专题自身");
      if (input.airports.length) {
        const [existing] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM airports WHERE id IN (?)",
          [input.airports.map((a) => a.airport_id)],
        );
        if (existing.length !== input.airports.length)
          throw new HttpError(
            400,
            "BAD_REQUEST",
            "所选机场已不存在，请移除后保存",
          );
      }
      if (!id) {
        const [insert] = await connection.query<ResultSetHeader>(
          "INSERT INTO seo_topics(path,status,sort_order,document,seed_key) VALUES(?,?,?,?,?)",
          [
            input.path,
            input.status,
            input.sort_order,
            JSON.stringify(input),
            seedKey || null,
          ],
        );
        id = insert.insertId;
      }
      const [owners] = await connection.query<RowDataPacket[]>(
        "SELECT topic_id FROM seo_topic_paths WHERE path=? FOR UPDATE",
        [input.path],
      );
      if (owners[0] && Number(owners[0].topic_id) !== id)
        throw new HttpError(
          409,
          "TOPIC_PATH_CONFLICT",
          "URL 已被其他专题或历史地址占用",
        );
      await connection.query(
        `INSERT INTO seo_topic_paths(path,topic_id,was_published) VALUES(?,?,?) ON DUPLICATE KEY UPDATE was_published=GREATEST(was_published,VALUES(was_published))`,
        [input.path, id, input.status === "published"],
      );
      await connection.query(
        "UPDATE seo_topics SET path=?,status=?,sort_order=?,document=?,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?",
        [input.path, input.status, input.sort_order, JSON.stringify(input), id],
      );
      if (oldPath && oldPath !== input.path)
        await connection.query(
          "DELETE FROM seo_topic_paths WHERE path=? AND topic_id=? AND was_published=0",
          [oldPath, id],
        );
      await connection.query(
        "DELETE FROM seo_topic_airports WHERE topic_id=?",
        [id],
      );
      for (const [position, airport] of input.airports.entries())
        await connection.query(
          "INSERT INTO seo_topic_airports VALUES(?,?,?,?)",
          [id, airport.airport_id, position, airport.reason],
        );
      await connection.query("DELETE FROM seo_topic_related WHERE topic_id=?", [
        id,
      ]);
      for (const [position, related] of input.related_ids.entries())
        await connection.query("INSERT INTO seo_topic_related VALUES(?,?,?)", [
          id,
          related,
          position,
        ]);
      await connection.commit();
      return (await this.get(id))!;
    } catch (error) {
      await connection.rollback();
      const code = (error as { code?: string }).code;
      if (code === "ER_DUP_ENTRY")
        throw new HttpError(
          409,
          "TOPIC_PATH_CONFLICT",
          "URL 已被其他专题或历史地址占用",
        );
      if (code === "ER_NO_REFERENCED_ROW_2")
        throw new HttpError(400, "BAD_REQUEST", "相关专题不存在");
      throw error;
    } finally {
      connection.release();
    }
  }
}

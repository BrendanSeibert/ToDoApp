import neo4j, { type Driver } from "neo4j-driver";

export interface SessionRepository {
  // Returns false if the user doesn't exist.
  createSession(userId: string, tokenHash: string, ttlSeconds: number): Promise<boolean>;
  // Returns null for an unknown or expired session.
  findUserIdByTokenHash(tokenHash: string): Promise<string | null>;
  deleteSession(tokenHash: string): Promise<void>;
}

export function createSessionRepository(driver: Driver): SessionRepository {
  return {
    async createSession(userId, tokenHash, ttlSeconds) {
      const session = driver.session();
      try {
        // Also prunes the user's expired sessions, so they don't accumulate.
        const result = await session.run(
          `MATCH (u:User {id: $userId})
           OPTIONAL MATCH (u)-[:HAS_SESSION]->(expired:Session)
             WHERE expired.expiresAt <= datetime()
           DETACH DELETE expired
           WITH DISTINCT u
           CREATE (u)-[:HAS_SESSION]->(s:Session {
             tokenHash: $tokenHash,
             createdAt: datetime(),
             expiresAt: datetime() + duration({seconds: $ttlSeconds})
           })
           RETURN s.tokenHash AS tokenHash`,
          { userId, tokenHash, ttlSeconds: neo4j.int(ttlSeconds) },
        );
        return result.records.length > 0;
      } finally {
        await session.close();
      }
    },

    async findUserIdByTokenHash(tokenHash) {
      const session = driver.session();
      try {
        const result = await session.run(
          `MATCH (u:User)-[:HAS_SESSION]->(s:Session {tokenHash: $tokenHash})
           WHERE s.expiresAt > datetime()
           RETURN u.id AS userId`,
          { tokenHash },
        );
        if (result.records.length === 0) return null;
        return result.records[0].get("userId") as string;
      } finally {
        await session.close();
      }
    },

    async deleteSession(tokenHash) {
      const session = driver.session();
      try {
        await session.run(`MATCH (s:Session {tokenHash: $tokenHash}) DETACH DELETE s`, { tokenHash });
      } finally {
        await session.close();
      }
    },
  };
}

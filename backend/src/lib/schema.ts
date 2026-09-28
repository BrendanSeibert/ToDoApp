import type { Driver } from "neo4j-driver";

export async function ensureConstraints(driver: Driver): Promise<void> {
  const session = driver.session();
  try {
    await session.run(
      `CREATE CONSTRAINT user_email_unique IF NOT EXISTS
       FOR (u:User) REQUIRE u.email IS UNIQUE`,
    );
    await session.run(
      `CREATE CONSTRAINT user_id_unique IF NOT EXISTS
       FOR (u:User) REQUIRE u.id IS UNIQUE`,
    );
    await session.run(
      `CREATE CONSTRAINT todo_id_unique IF NOT EXISTS
       FOR (t:Todo) REQUIRE t.id IS UNIQUE`,
    );
    await session.run(
      `CREATE CONSTRAINT session_token_hash_unique IF NOT EXISTS
       FOR (s:Session) REQUIRE s.tokenHash IS UNIQUE`,
    );
  } finally {
    await session.close();
  }
}

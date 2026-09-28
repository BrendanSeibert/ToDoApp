import neo4j, { type Driver } from "neo4j-driver";

// Direct database access, for arranging state the API can't (e.g. an expired session)
// and for asserting what the API stored.
let driver: Driver | undefined;

function getTestDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI;
    const user = process.env.NEO4J_USER;
    const password = process.env.NEO4J_PASSWORD;
    if (!uri || !user || !password) {
      throw new Error("Integration tests need NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD");
    }
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }
  return driver;
}

export async function runQuery(query: string, params: Record<string, unknown> = {}) {
  const session = getTestDriver().session();
  try {
    return (await session.run(query, params)).records;
  } finally {
    await session.close();
  }
}

export async function closeTestDriver(): Promise<void> {
  await driver?.close();
  driver = undefined;
}

export async function getSessionTokenHashes(email: string): Promise<string[]> {
  const records = await runQuery(
    `MATCH (:User {email: $email})-[:HAS_SESSION]->(s:Session) RETURN s.tokenHash AS tokenHash`,
    { email },
  );
  return records.map((record) => record.get("tokenHash") as string);
}

export async function expireSessions(email: string): Promise<void> {
  await runQuery(
    `MATCH (:User {email: $email})-[:HAS_SESSION]->(s:Session)
     SET s.expiresAt = datetime() - duration({seconds: 1})`,
    { email },
  );
}

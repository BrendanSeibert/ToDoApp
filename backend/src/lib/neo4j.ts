import neo4j, { type Driver } from "neo4j-driver";
import { ensureConstraints } from "./schema";

let driver: Driver | undefined;

export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI;
    const user = process.env.NEO4J_USER;
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !user || !password) {
      throw new Error(
        "Missing Neo4j connection environment variables: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD",
      );
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    // Fire-and-forget: constraints are idempotent (IF NOT EXISTS) and this avoids
    // making every route await a startup step. Leaves a brief window on cold start
    // where the uniqueness constraint isn't yet enforced.
    ensureConstraints(driver).catch((error) => {
      console.error("Failed to ensure Neo4j constraints", error);
    });
  }

  return driver;
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = undefined;
  }
}

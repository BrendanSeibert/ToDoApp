import { v4 as uuidv4 } from "uuid";
import { Neo4jError, type Driver } from "neo4j-driver";

const CONSTRAINT_VIOLATION_CODE = "Neo.ClientError.Schema.ConstraintValidationFailed";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super("A user with this email already exists");
  }
}

// Only the email constraint: a violation on User.id would be a genuine bug, not a duplicate signup.
function isEmailConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Neo4jError && error.code === CONSTRAINT_VIOLATION_CODE && error.message.includes("`email`")
  );
}

export interface UserRepository {
  // Throws EmailAlreadyExistsError if the email is taken.
  createUser(email: string, passwordHash: string): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  deleteUser(id: string): Promise<void>;
}

export function createUserRepository(driver: Driver): UserRepository {
  return {
    async createUser(email, passwordHash) {
      const session = driver.session();
      try {
        const id = uuidv4();
        const createdAt = new Date().toISOString();
        const result = await session.run(
          `CREATE (u:User {id: $id, email: $email, passwordHash: $passwordHash, createdAt: $createdAt})
           RETURN u`,
          { id, email, passwordHash, createdAt },
        );
        return result.records[0].get("u").properties as User;
      } catch (error) {
        if (isEmailConstraintViolation(error)) throw new EmailAlreadyExistsError();
        throw error;
      } finally {
        await session.close();
      }
    },

    async findByEmail(email) {
      const session = driver.session();
      try {
        const result = await session.run(`MATCH (u:User {email: $email}) RETURN u`, { email });
        if (result.records.length === 0) return null;
        return result.records[0].get("u").properties as User;
      } finally {
        await session.close();
      }
    },

    async findById(id) {
      const session = driver.session();
      try {
        const result = await session.run(`MATCH (u:User {id: $id}) RETURN u`, { id });
        if (result.records.length === 0) return null;
        return result.records[0].get("u").properties as User;
      } finally {
        await session.close();
      }
    },

    async deleteUser(id) {
      const session = driver.session();
      try {
        await session.run(
          `MATCH (u:User {id: $id})
           OPTIONAL MATCH (u)-[:OWNS]->(t:Todo)
           OPTIONAL MATCH (u)-[:HAS_SESSION]->(s:Session)
           DETACH DELETE u, t, s`,
          { id },
        );
      } finally {
        await session.close();
      }
    },
  };
}

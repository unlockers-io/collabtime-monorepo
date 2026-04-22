import { compare, hash } from "bcryptjs";

const SALT_ROUNDS = 12;

const hashPassword = (password: string): Promise<string> => hash(password, SALT_ROUNDS);

const verifyPassword = (password: string, hashed: string): Promise<boolean> =>
  compare(password, hashed);

export { hashPassword, verifyPassword };

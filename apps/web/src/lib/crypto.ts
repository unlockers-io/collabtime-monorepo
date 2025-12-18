import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export { hashPassword, verifyPassword };

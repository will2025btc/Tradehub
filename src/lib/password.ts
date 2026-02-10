import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plain text password with a hashed password
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: '密码至少需要 8 个字符' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '密码需要包含至少一个大写字母' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '密码需要包含至少一个小写字母' };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码需要包含至少一个数字' };
  }
  
  return { valid: true };
}

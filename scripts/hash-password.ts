import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const password = process.argv[2];
if (!password) {
  console.error('Uso: npm run hash-password -- "sua-senha"');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = await scrypt(password, salt, 64);
console.log(`ADMIN_PASSWORD_HASH=scrypt:${salt.toString("hex")}:${hash.toString("hex")}`);
console.log(`AUTH_SECRET=${randomBytes(32).toString("hex")}`);
console.log(`CRON_SECRET=${randomBytes(24).toString("hex")}`);
console.log(`INDEXNOW_KEY=${randomBytes(16).toString("hex")}`);

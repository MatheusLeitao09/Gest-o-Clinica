import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = crypto
  .createHash('sha256')
  .update(process.env.CRYPTO_SECRET_KEY || 'chave_padrao_desenvolvimento_32b')
  .digest();

export function limparCPF(cpf) {
  return String(cpf || '').replace(/\D/g, '');
}

export function formatarCPF(cpfLimpo) {
  const digits = limparCPF(cpfLimpo);
  if (digits.length !== 11) return digits;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function gerarHashCPF(cpf) {
  const limpo = limparCPF(cpf);
  return crypto.createHmac('sha256', SECRET_KEY).update(limpo).digest('hex');
}

export function criptografarCPF(cpf) {
  const limpo = limparCPF(cpf);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(limpo, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function descriptografarCPF(textoCriptografado) {
  if (!textoCriptografado) return '';
  if (textoCriptografado.startsWith('PLAIN:')) {
    return formatarCPF(textoCriptografado.replace('PLAIN:', ''));
  }
  try {
    const [ivHex, encryptedHex] = textoCriptografado.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return formatarCPF(decrypted);
  } catch (err) {
    return 'CPF Protegido';
  }
}

export async function hashSenha(senha) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(senha, salt);
}

export async function verificarSenha(senha, hash) {
  return bcrypt.compare(senha, hash);
}
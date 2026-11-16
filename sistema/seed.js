import pool from './config/db.js';
import { gerarHashCPF, criptografarCPF, hashSenha } from './utils/crypto.js';

async function seed() {
  try {
    console.log('Iniciando povoamento seguro do banco de dados...');

    await pool.query('TRUNCATE TABLE atendimentos, criancas, responsaveis, usuarios RESTART IDENTITY CASCADE');

    const senhaPadraoHash = await hashSenha('123456');

    const usuarios = [
      { nome: 'Dra. Mariana Costa', cpf: '11122233344' },
      { nome: 'Carlos Eduardo Mendes', cpf: '22233344455' },
      { nome: 'Fernanda Oliveira', cpf: '33344455566' },
    ];

    for (const u of usuarios) {
      await pool.query(
        'INSERT INTO usuarios (nome, cpf_hash, cpf_criptografado, senha_hash) VALUES ($1, $2, $3, $4)',
        [u.nome, gerarHashCPF(u.cpf), criptografarCPF(u.cpf), senhaPadraoHash]
      );
    }

    const responsaveis = [
      { nome: 'Ana Paula Silva', cpf: '44455566677', email: 'ana.silva@email.com', telefone: '(11) 98765-4321' },
      { nome: 'Roberto Almeida Santos', cpf: '55566677788', email: 'roberto.santos@email.com', telefone: '(11) 97654-3210' },
      { nome: 'Juliana Ferreira Lima', cpf: '66677788899', email: 'juliana.lima@email.com', telefone: '(11) 96543-2109' },
    ];

    for (const r of responsaveis) {
      await pool.query(
        'INSERT INTO responsaveis (nome, cpf_criptografado, email, telefone) VALUES ($1, $2, $3, $4)',
        [r.nome, criptografarCPF(r.cpf), r.email, r.telefone]
      );
    }

    await pool.query(`
      INSERT INTO criancas (nome, data_nascimento, responsavel_id) VALUES
      ('Lucas Silva', '2021-05-14', 1),
      ('Sofia Almeida Santos', '2023-09-22', 2),
      ('Mateus Ferreira Lima', '2020-02-10', 3),
      ('Helena Silva', '2024-01-30', 1)
    `);

    await pool.query(`
      INSERT INTO atendimentos (crianca_id, data_atendimento, horario, motivo, situacao) VALUES
      (2, '2026-11-20', '14:30:00', 'Consulta de rotina e acompanhamento de crescimento', 'Agendado'),
      (1, '2026-11-18', '09:00:00', 'Avaliação de quadro gripal e febre leve', 'Confirmado'),
      (3, '2026-11-18', '08:15:00', 'Retorno para análise de exames laboratoriais', 'Agendado'),
      (4, '2026-11-25', '10:00:00', 'Vacinação e puericultura mensal', 'Agendado')
    `);

    console.log('Banco povoado com sucesso!');
    console.log('Operador de teste -> CPF: 11122233344 | Senha: 123456');
  } catch (error) {
    console.error('Erro ao povoar banco:', error);
  } finally {
    await pool.end();
  }
}

seed();
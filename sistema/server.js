import express from 'express';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import pool from './config/db.js';
import { verificarAutenticacao } from './middlewares/auth.js';
import {
  limparCPF,
  gerarHashCPF,
  criptografarCPF,
  descriptografarCPF,
  verificarSenha,
} from './utils/crypto.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'segredo_clinica_pequenos_passos',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      maxAge: 30 * 60 * 1000,
    },
  })
);

// AUTENTICAÇÃO
app.get('/login', (req, res) => {
  if (req.session && req.session.usuario) {
    return res.redirect('/');
  }
  let mensagemErro = null;
  if (req.query.erro === 'sessao_expirada') {
    mensagemErro = 'Sua sessão expirou ou você precisa fazer login para acessar o sistema.';
  }
  res.render('login', { erro: mensagemErro });
});

app.post('/login', async (req, res) => {
  const { cpf, senha } = req.body;

  if (!cpf || !senha) {
    return res.render('login', { erro: 'Preencha o CPF e a senha.' });
  }

  try {
    const cpfHash = gerarHashCPF(cpf);
    const result = await pool.query(
      'SELECT id, nome, senha_hash FROM usuarios WHERE cpf_hash = $1',
      [cpfHash]
    );

    if (result.rows.length === 0) {
      return res.render('login', { erro: 'CPF ou senha inválidos.' });
    }

    const usuario = result.rows[0];
    const senhaValida = await verificarSenha(senha, usuario.senha_hash);

    if (!senhaValida) {
      return res.render('login', { erro: 'CPF ou senha inválidos.' });
    }

    req.session.usuario = {
      id: usuario.id,
      nome: usuario.nome,
    };

    return res.redirect('/');
  } catch (error) {
    console.error('Erro no login:', error);
    return res.render('login', { erro: 'Erro interno ao processar autenticação.' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

// PÁGINA INICIAL
app.get('/', verificarAutenticacao, async (req, res) => {
  try {
    const [respCount, criancasCount, atendCount] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM responsaveis'),
      pool.query('SELECT COUNT(*) FROM criancas'),
      pool.query('SELECT COUNT(*) FROM atendimentos'),
    ]);

    res.render('index', {
      totais: {
        responsaveis: respCount.rows[0].count,
        criancas: criancasCount.rows[0].count,
        atendimentos: atendCount.rows[0].count,
      },
    });
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    res.status(500).send('Erro ao carregar página inicial.');
  }
});

// RESPONSÁVEIS
app.get('/responsaveis', verificarAutenticacao, async (req, res) => {
  const busca = (req.query.busca || '').trim();
  const erro = req.query.erro || null;
  const sucesso = req.query.sucesso || null;

  try {
    let query = 'SELECT id, nome, cpf_criptografado, email, telefone FROM responsaveis';
    const params = [];

    if (busca) {
      query += ' WHERE nome ILIKE $1';
      params.push(`%${busca}%`);
    }

    query += ' ORDER BY nome ASC';

    const result = await pool.query(query, params);
    const responsaveis = result.rows.map((r) => ({
      ...r,
      cpf: descriptografarCPF(r.cpf_criptografado),
    }));

    res.render('responsaveis/index', { responsaveis, busca, erro, sucesso });
  } catch (error) {
    console.error('Erro ao listar responsáveis:', error);
    res.status(500).send('Erro ao carregar responsáveis.');
  }
});

app.get('/responsaveis/novo', verificarAutenticacao, (req, res) => {
  res.render('responsaveis/form', { responsavel: null, erro: null });
});

app.post('/responsaveis', verificarAutenticacao, async (req, res) => {
  const { nome, cpf, email, telefone } = req.body;
  const cpfLimpo = limparCPF(cpf);

  if (!nome || cpfLimpo.length !== 11 || !email || !telefone) {
    return res.render('responsaveis/form', {
      responsavel: { nome, cpf, email, telefone },
      erro: 'Todos os campos são obrigatórios e o CPF deve conter 11 dígitos.',
    });
  }

  try {
    const cpfCripto = criptografarCPF(cpfLimpo);
    await pool.query(
      'INSERT INTO responsaveis (nome, cpf_criptografado, email, telefone) VALUES ($1, $2, $3, $4)',
      [nome.trim(), cpfCripto, email.trim(), telefone.trim()]
    );
    res.redirect('/responsaveis?sucesso=Responsável cadastrado com sucesso!');
  } catch (error) {
    console.error('Erro ao cadastrar responsável:', error);
    res.render('responsaveis/form', {
      responsavel: { nome, cpf, email, telefone },
      erro: 'Erro ao salvar responsável no banco de dados.',
    });
  }
});

app.get('/responsaveis/:id/editar', verificarAutenticacao, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM responsaveis WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.redirect('/responsaveis?erro=Responsável não encontrado.');
    }
    const r = result.rows[0];
    r.cpf = descriptografarCPF(r.cpf_criptografado);
    res.render('responsaveis/form', { responsavel: r, erro: null });
  } catch (error) {
    res.redirect('/responsaveis?erro=Erro ao carregar dados.');
  }
});

app.post('/responsaveis/:id/editar', verificarAutenticacao, async (req, res) => {
  const { nome, cpf, email, telefone } = req.body;
  const { id } = req.params;
  const cpfLimpo = limparCPF(cpf);

  if (!nome || cpfLimpo.length !== 11 || !email || !telefone) {
    return res.render('responsaveis/form', {
      responsavel: { id, nome, cpf, email, telefone },
      erro: 'Todos os campos são obrigatórios e o CPF deve conter 11 dígitos.',
    });
  }

  try {
    const cpfCripto = criptografarCPF(cpfLimpo);
    await pool.query(
      'UPDATE responsaveis SET nome = $1, cpf_criptografado = $2, email = $3, telefone = $4 WHERE id = $5',
      [nome.trim(), cpfCripto, email.trim(), telefone.trim(), id]
    );
    res.redirect('/responsaveis?sucesso=Responsável atualizado com sucesso!');
  } catch (error) {
    res.redirect('/responsaveis?erro=Erro ao atualizar responsável.');
  }
});

app.post('/responsaveis/:id/excluir', verificarAutenticacao, async (req, res) => {
  try {
    await pool.query('DELETE FROM responsaveis WHERE id = $1', [req.params.id]);
    res.redirect('/responsaveis?sucesso=Responsável excluído com sucesso!');
  } catch (error) {
    if (error.code === '23503') {
      return res.redirect(
        '/responsaveis?erro=Não é possível excluir este responsável pois existem crianças vinculadas a ele.'
      );
    }
    res.redirect('/responsaveis?erro=Erro ao excluir responsável.');
  }
});

// CRIANÇAS
app.get('/criancas', verificarAutenticacao, async (req, res) => {
  const erro = req.query.erro || null;
  const sucesso = req.query.sucesso || null;

  try {
    const result = await pool.query(`
      SELECT 
        c.id, 
        c.nome, 
        TO_CHAR(c.data_nascimento, 'DD/MM/YYYY') AS data_nascimento_formatada,
        r.nome AS responsavel_nome
      FROM criancas c
      INNER JOIN responsaveis r ON c.responsavel_id = r.id
      ORDER BY c.nome ASC
    `);

    res.render('criancas/index', { criancas: result.rows, erro, sucesso });
  } catch (error) {
    res.status(500).send('Erro ao listar crianças.');
  }
});

app.get('/criancas/novo', verificarAutenticacao, async (req, res) => {
  try {
    const respResult = await pool.query('SELECT id, nome FROM responsaveis ORDER BY nome ASC');
    res.render('criancas/form', {
      crianca: null,
      responsaveis: respResult.rows,
      erro: null,
    });
  } catch (error) {
    res.redirect('/criancas?erro=Erro ao carregar responsáveis.');
  }
});

app.post('/criancas', verificarAutenticacao, async (req, res) => {
  const { nome, data_nascimento, responsavel_id } = req.body;

  if (!nome || !data_nascimento || !responsavel_id) {
    const respResult = await pool.query('SELECT id, nome FROM responsaveis ORDER BY nome ASC');
    return res.render('criancas/form', {
      crianca: { nome, data_nascimento, responsavel_id },
      responsaveis: respResult.rows,
      erro: 'Todos os campos são obrigatórios, incluindo o responsável.',
    });
  }

  try {
    await pool.query(
      'INSERT INTO criancas (nome, data_nascimento, responsavel_id) VALUES ($1, $2, $3)',
      [nome.trim(), data_nascimento, responsavel_id]
    );
    res.redirect('/criancas?sucesso=Criança cadastrada com sucesso!');
  } catch (error) {
    res.redirect('/criancas?erro=Erro ao cadastrar criança.');
  }
});

app.get('/criancas/:id/editar', verificarAutenticacao, async (req, res) => {
  try {
    const [criancaRes, respRes] = await Promise.all([
      pool.query(
        "SELECT id, nome, TO_CHAR(data_nascimento, 'YYYY-MM-DD') AS data_nascimento, responsavel_id FROM criancas WHERE id = $1",
        [req.params.id]
      ),
      pool.query('SELECT id, nome FROM responsaveis ORDER BY nome ASC'),
    ]);

    if (criancaRes.rows.length === 0) {
      return res.redirect('/criancas?erro=Criança não encontrada.');
    }

    res.render('criancas/form', {
      crianca: criancaRes.rows[0],
      responsaveis: respRes.rows,
      erro: null,
    });
  } catch (error) {
    res.redirect('/criancas?erro=Erro ao carregar dados da criança.');
  }
});

app.post('/criancas/:id/editar', verificarAutenticacao, async (req, res) => {
  const { nome, data_nascimento, responsavel_id } = req.body;
  const { id } = req.params;

  if (!nome || !data_nascimento || !responsavel_id) {
    return res.redirect(`/criancas/${id}/editar`);
  }

  try {
    await pool.query(
      'UPDATE criancas SET nome = $1, data_nascimento = $2, responsavel_id = $3 WHERE id = $4',
      [nome.trim(), data_nascimento, responsavel_id, id]
    );
    res.redirect('/criancas?sucesso=Cadastro da criança atualizado!');
  } catch (error) {
    res.redirect('/criancas?erro=Erro ao atualizar criança.');
  }
});

app.post('/criancas/:id/excluir', verificarAutenticacao, async (req, res) => {
  try {
    await pool.query('DELETE FROM criancas WHERE id = $1', [req.params.id]);
    res.redirect('/criancas?sucesso=Criança excluída com sucesso!');
  } catch (error) {
    if (error.code === '23503') {
      return res.redirect(
        '/criancas?erro=Não é possível excluir esta criança pois existem atendimentos vinculados a ela.'
      );
    }
    res.redirect('/criancas?erro=Erro ao excluir criança.');
  }
});

// ATENDIMENTOS
app.get('/atendimentos', verificarAutenticacao, async (req, res) => {
  const erro = req.query.erro || null;
  const sucesso = req.query.sucesso || null;

  try {
    const result = await pool.query(`
      SELECT 
        a.id,
        TO_CHAR(a.data_atendimento, 'DD/MM/YYYY') AS data_formatada,
        TO_CHAR(a.horario, 'HH24:MI') AS horario_formatado,
        a.motivo,
        a.situacao,
        c.nome AS crianca_nome,
        r.nome AS responsavel_nome
      FROM atendimentos a
      INNER JOIN criancas c ON a.crianca_id = c.id
      INNER JOIN responsaveis r ON c.responsavel_id = r.id
      ORDER BY a.data_atendimento ASC, a.horario ASC
    `);

    res.render('atendimentos/index', {
      atendimentos: result.rows,
      erro,
      sucesso,
    });
  } catch (error) {
    res.status(500).send('Erro ao listar atendimentos.');
  }
});

app.get('/atendimentos/novo', verificarAutenticacao, async (req, res) => {
  try {
    const criancasRes = await pool.query(`
      SELECT c.id, c.nome, r.nome AS responsavel_nome
      FROM criancas c
      INNER JOIN responsaveis r ON c.responsavel_id = r.id
      ORDER BY c.nome ASC
    `);

    res.render('atendimentos/form', {
      atendimento: null,
      criancas: criancasRes.rows,
      erro: null,
    });
  } catch (error) {
    res.redirect('/atendimentos?erro=Erro ao carregar lista de crianças.');
  }
});

app.post('/atendimentos', verificarAutenticacao, async (req, res) => {
  const { crianca_id, data_atendimento, horario, motivo, situacao } = req.body;

  if (!crianca_id || !data_atendimento || !horario || !motivo || !situacao) {
    const criancasRes = await pool.query(`
      SELECT c.id, c.nome, r.nome AS responsavel_nome
      FROM criancas c
      INNER JOIN responsaveis r ON c.responsavel_id = r.id
      ORDER BY c.nome ASC
    `);
    return res.render('atendimentos/form', {
      atendimento: { crianca_id, data_atendimento, horario, motivo, situacao },
      criancas: criancasRes.rows,
      erro: 'Todos os campos do atendimento são obrigatórios.',
    });
  }

  try {
    await pool.query(
      'INSERT INTO atendimentos (crianca_id, data_atendimento, horario, motivo, situacao) VALUES ($1, $2, $3, $4, $5)',
      [crianca_id, data_atendimento, horario, motivo.trim(), situacao]
    );
    res.redirect('/atendimentos?sucesso=Atendimento agendado com sucesso!');
  } catch (error) {
    res.redirect('/atendimentos?erro=Erro ao salvar atendimento.');
  }
});

app.get('/atendimentos/:id/editar', verificarAutenticacao, async (req, res) => {
  try {
    const [atendRes, criancasRes] = await Promise.all([
      pool.query(
        `SELECT id, crianca_id, 
         TO_CHAR(data_atendimento, 'YYYY-MM-DD') AS data_atendimento, 
         TO_CHAR(horario, 'HH24:MI') AS horario, 
         motivo, situacao 
         FROM atendimentos WHERE id = $1`,
        [req.params.id]
      ),
      pool.query(`
        SELECT c.id, c.nome, r.nome AS responsavel_nome
        FROM criancas c
        INNER JOIN responsaveis r ON c.responsavel_id = r.id
        ORDER BY c.nome ASC
      `),
    ]);

    if (atendRes.rows.length === 0) {
      return res.redirect('/atendimentos?erro=Atendimento não encontrado.');
    }

    res.render('atendimentos/form', {
      atendimento: atendRes.rows[0],
      criancas: criancasRes.rows,
      erro: null,
    });
  } catch (error) {
    res.redirect('/atendimentos?erro=Erro ao carregar atendimento.');
  }
});

app.post('/atendimentos/:id/editar', verificarAutenticacao, async (req, res) => {
  const { crianca_id, data_atendimento, horario, motivo, situacao } = req.body;
  const { id } = req.params;

  if (!crianca_id || !data_atendimento || !horario || !motivo || !situacao) {
    return res.redirect(`/atendimentos/${id}/editar`);
  }

  try {
    await pool.query(
      `UPDATE atendimentos 
       SET crianca_id = $1, data_atendimento = $2, horario = $3, motivo = $4, situacao = $5 
       WHERE id = $6`,
      [crianca_id, data_atendimento, horario, motivo.trim(), situacao, id]
    );
    res.redirect('/atendimentos?sucesso=Atendimento atualizado com sucesso!');
  } catch (error) {
    res.redirect('/atendimentos?erro=Erro ao atualizar atendimento.');
  }
});

app.post('/atendimentos/:id/excluir', verificarAutenticacao, async (req, res) => {
  try {
    await pool.query('DELETE FROM atendimentos WHERE id = $1', [req.params.id]);
    res.redirect('/atendimentos?sucesso=Atendimento excluído com sucesso!');
  } catch (error) {
    res.redirect('/atendimentos?erro=Erro ao excluir atendimento.');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor da Clínica Pediátrica rodando em http://localhost:${PORT}`);
});
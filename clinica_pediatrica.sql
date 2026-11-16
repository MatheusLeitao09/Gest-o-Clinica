DROP TABLE IF EXISTS atendimentos CASCADE;
DROP TABLE IF EXISTS criancas CASCADE;
DROP TABLE IF EXISTS responsaveis CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    cpf_hash VARCHAR(64) NOT NULL UNIQUE,
    cpf_criptografado TEXT NOT NULL,
    senha_hash VARCHAR(255) NOT NULL
);

CREATE TABLE responsaveis (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    cpf_criptografado TEXT NOT NULL,
    email VARCHAR(120) NOT NULL,
    telefone VARCHAR(20) NOT NULL
);

CREATE TABLE criancas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    data_nascimento DATE NOT NULL,
    responsavel_id INTEGER NOT NULL,
    CONSTRAINT fk_crianca_responsavel
        FOREIGN KEY (responsavel_id)
        REFERENCES responsaveis (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE TABLE atendimentos (
    id SERIAL PRIMARY KEY,
    crianca_id INTEGER NOT NULL,
    data_atendimento DATE NOT NULL,
    horario TIME NOT NULL,
    motivo TEXT NOT NULL,
    situacao VARCHAR(30) NOT NULL DEFAULT 'Agendado',
    CONSTRAINT fk_atendimento_crianca
        FOREIGN KEY (crianca_id)
        REFERENCES criancas (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

INSERT INTO usuarios (nome, cpf_hash, cpf_criptografado, senha_hash) VALUES
('Dra. Mariana Costa', 'a2b82a23f0791878223d280e1b096124e7634218a919044d6c4e6b4d2534b3c1', '0102030405060708090a0b0c0d0e0f10:9a3f8e7d6c5b4a3f2e1d0c9b8a7f6e5d', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQ1.a1/0.7t1B/y1G.v9u5L6e7F8G.'),
('Carlos Eduardo Mendes', 'f1e2d3c4b5a69788796a5b4c3d2e1f00112233445566778899aabbccddeeff00', '0102030405060708090a0b0c0d0e0f10:1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQ1.a1/0.7t1B/y1G.v9u5L6e7F8G.'),
('Fernanda Oliveira', '99887766554433221100ffeeddccbbaa99887766554433221100ffeeddccbbaa', '0102030405060708090a0b0c0d0e0f10:5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQ1.a1/0.7t1B/y1G.v9u5L6e7F8G.');

INSERT INTO responsaveis (nome, cpf_criptografado, email, telefone) VALUES
('Ana Paula Silva', 'PLAIN:44455566677', 'ana.silva@email.com', '(11) 98765-4321'),
('Roberto Almeida Santos', 'PLAIN:55566677788', 'roberto.santos@email.com', '(11) 97654-3210'),
('Juliana Ferreira Lima', 'PLAIN:66677788899', 'juliana.lima@email.com', '(11) 96543-2109');

INSERT INTO criancas (nome, data_nascimento, responsavel_id) VALUES
('Lucas Silva', '2021-05-14', 1),
('Sofia Almeida Santos', '2023-09-22', 2),
('Mateus Ferreira Lima', '2020-02-10', 3),
('Helena Silva', '2024-01-30', 1);

INSERT INTO atendimentos (crianca_id, data_atendimento, horario, motivo, situacao) VALUES
(2, '2026-11-20', '14:30:00', 'Consulta de rotina e acompanhamento de crescimento', 'Agendado'),
(1, '2026-11-18', '09:00:00', 'Avaliação de quadro gripal e febre leve', 'Confirmado'),
(3, '2026-11-18', '08:15:00', 'Retorno para análise de exames laboratoriais', 'Agendado'),
(4, '2026-11-25', '10:00:00', 'Vacinação e puericultura mensal', 'Agendado');
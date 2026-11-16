# Clínica Pediátrica Pequenos Passos - Sistema de Gestão

Sistema web local desenvolvido em Node.js, Express, EJS e PostgreSQL para controle de responsáveis, crianças e agendamentos pediátricos.

## Passo a Passo para Execução

1. Crie um banco de dados chamado `clinica_pediatrica` no PostgreSQL (porta `7777`) e execute o script `../clinica_pediatrica.sql`.
2. Dentro da pasta `sistema/`, copie `.env.example` para `.env` e ajuste as credenciais do banco.
3. Instale as dependências:
   ```bash
   npm install
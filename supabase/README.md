# Supabase

Este diretório contém a configuração local, as migrações do banco e as Edge Functions da Argos.

> O formulário atual do site prepara um pedido e abre o WhatsApp configurado em `src/js/config.js`; ele não envia e-mail nem chama a Edge Function. A função `project-request` abaixo é o fluxo legado de recebimento por e-mail e só deve ser usada se esse fluxo voltar a ser ativado.

## Estrutura

- `config.toml`: configuração do Supabase CLI. A função `project-request` não exige JWT; ela valida a origem permitida e os dados recebidos.
- `migrations/`: alterações versionadas do banco. A migração atual cria o controle de limite de pedidos.
- `functions/project-request/`: função que recebe pedidos, aplica o limite de requisições e encaminha os dados por e-mail.
- `.env.example`: nomes das variáveis para desenvolvimento local, sem credenciais.

## Desenvolvimento local

1. Instale e inicie o Supabase CLI na raiz do projeto:

   ```sh
   supabase start
   ```

2. Copie `.env.example` para `.env` nesta pasta e preencha as configurações locais. Use um valor aleatório e privado para `RATE_LIMIT_SALT`.
3. Aplique as migrações no banco local:

   ```sh
   supabase migration up --local
   ```

4. Em outro terminal, inicie a função:

   ```sh
   supabase functions serve project-request --env-file supabase/.env
   ```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são disponibilizadas automaticamente no ambiente hospedado do Supabase. Para testes locais, preencha os valores correspondentes ao projeto iniciado pelo CLI.

## Publicação

Vincule o CLI ao projeto Supabase e configure os segredos da função no painel do projeto ou com `supabase secrets set`. Configure `ALLOWED_ORIGIN` com a origem exata do site publicado, além de `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CONTACT_EMAIL` e `RATE_LIMIT_SALT`. Não publique nem compartilhe o arquivo `.env`.

Envie as migrações e publique a função usando o Supabase CLI:

```sh
supabase db push
supabase functions deploy project-request
```

# Supabase

Este diretório contém a configuração local, as migrações do banco e as Edge Functions da Argos.

> O formulário atual do site prepara um pedido e abre o WhatsApp configurado em `src/js/config.js`; ele não envia e-mail nem chama a Edge Function. A função `project-request` abaixo é o fluxo legado de recebimento por e-mail e só deve ser usada se esse fluxo voltar a ser ativado.

## Estrutura

- `config.toml`: configuração do Supabase CLI. A função `project-request` não exige JWT; ela valida a origem permitida e os dados recebidos.
- `migrations/`: alterações versionadas do banco. As migrações criam o controle de limite de pedidos e as tabelas do painel administrativo.
- `functions/project-request/`: função que recebe pedidos, aplica o limite de requisições e encaminha os dados por e-mail.
- `.env.example`: nomes das variáveis para desenvolvimento local, sem credenciais.

O painel administrativo está em `../app-argus`. As migrações criam as tabelas de clientes e lançamentos financeiros, com RLS para que cada usuário autenticado acesse somente os próprios registros, e habilitam links privados individuais para os portais de cliente. O portal anônimo acessa somente os campos públicos do projeto associado ao token, nunca os dados financeiros. Consulte `../app-argus/README.md` para configurar o acesso.

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

O `supabase db push` envia todas as migrations pendentes, inclusive as do painel e do portal. Não é necessário iniciar o Supabase local com Docker para publicar em um projeto hospedado. A configuração da chave pública do painel fica em `../src/js/config.js`; as variáveis de `.env` servem somente à Edge Function legada.

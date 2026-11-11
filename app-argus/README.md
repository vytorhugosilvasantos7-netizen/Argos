# Painel administrativo Argos

Painel web para acompanhar clientes, status dos projetos e lucro por meio de lançamentos de receitas e despesas. O acesso é feito com Supabase Auth; o cadastro de usuários fica desativado na interface e deve ser feito pelo administrador no painel Supabase.

## Configuração do projeto Supabase

O painel administrativo e o portal de clientes usam o mesmo projeto Supabase. O endereço do projeto já está preenchido em `../src/js/config.js`; ainda é preciso configurar a chave pública e aplicar as migrations no projeto hospedado.

1. No Supabase, abra **Project Settings → API** e copie a chave pública `anon` ou `publishable` para `supabaseAnonKey` em `../src/js/config.js`. A URL já está configurada.
2. No **SQL Editor**, execute, nesta ordem, os arquivos em `../supabase/migrations/`:
   - `20261109000000_create_form_rate_limits.sql`
   - `20261111000000_create_admin_dashboard.sql`
   - `20261112000000_create_client_portal.sql`
3. Em **Authentication → Users**, crie o usuário administrativo. Não habilite cadastro público para este painel.
4. Abra `index.html` por um servidor web local ou publique a pasta `app-argus`. O portal individual está em `../src/cliente.html`; publique também a pasta `src` no mesmo site para que os links dos clientes funcionem.

Alternativamente, para aplicar as migrations pelo CLI contra o projeto hospedado, instale o Supabase CLI, autentique com `supabase login` e, na raiz `Argos`, execute `supabase link --project-ref fnbhulysivjphxjupvul` e `supabase db push`. Isso não requer iniciar a stack local com Docker.

Use somente a chave pública do projeto no navegador. Nunca coloque uma chave `service_role` neste app nem em `src/js/config.js`. As políticas RLS restringem cada registro administrativo ao usuário autenticado. O portal usa um link privado individual; qualquer pessoa com esse link poderá ver somente o projeto associado a ele. Não inclua informações financeiras no portal.

O arquivo `../supabase/.env.example` é destinado somente à Edge Function legada `project-request`; ele não configura o painel nem o portal.

## O que o painel acompanha

- Visão geral de clientes, projetos em andamento e concluídos.
- Cadastro, edição, busca e exclusão de clientes e previsão de entrega.
- Edição de progresso, etapas, escopo e prévias para computador/celular, compartilhadas com o portal individual em `../src/cliente.html`.
- Os links privados estão nas ações de cada cliente; o portal busca as atualizações automaticamente a cada 30 segundos enquanto estiver aberto.
- Lançamentos de receitas e despesas, com totais e lucro acumulado.
- Indicadores financeiros de receitas, despesas e resultado do mês.

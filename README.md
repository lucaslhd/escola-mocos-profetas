# Escola de Moços e Profetas — Página de Inscrição

Landing page premium pronta para GitHub Pages, com formulário de inscrição conectado ao Supabase.

## Por que não usar "banco offline" no GitHub Pages?

GitHub Pages é hospedagem estática. Um banco offline/local (como `localStorage`) salva dados apenas no navegador de cada visitante e você não teria um cadastro centralizado.

Para receber inscrições de pessoas diferentes e acompanhar a quantidade, esta versão usa **Supabase** como banco online. O plano gratuito normalmente é suficiente para eventos pequenos e médios.

## 1. Criar o banco

1. Crie uma conta/projeto em https://supabase.com
2. No projeto, vá em **SQL Editor**
3. Cole e execute o conteúdo de `supabase.sql`
4. Vá em **Project Settings > API**
5. Copie:
   - Project URL
   - anon/public key

## 2. Configurar o site

Abra `config.js` e substitua:

```js
SUPABASE_URL: "COLE_AQUI_SUA_SUPABASE_URL",
SUPABASE_ANON_KEY: "COLE_AQUI_SUA_SUPABASE_ANON_KEY"
```

> A chave `anon` pode ficar no front-end. A proteção da tabela é feita pelas policies RLS do Supabase.

## 3. Publicar no GitHub Pages

1. Crie um repositório no GitHub
2. Envie todos os arquivos deste projeto
3. Abra **Settings > Pages**
4. Em **Build and deployment**, selecione **Deploy from a branch**
5. Branch: `main` / pasta `/root`
6. Salve e aguarde a URL ficar disponível

## 4. Ver inscritos

No painel do Supabase, abra **Table Editor > registrations**.

Para contar:

```sql
select count(*) as total_inscritos
from public.registrations
where event_slug = 'escola-mocos-profetas-07-08-11';
```

## Estrutura

- `index.html` — página principal
- `styles.css` — design system e responsividade
- `app.js` — validação e envio para o banco
- `config.js` — configuração do Supabase
- `supabase.sql` — criação e segurança da tabela
- `assets/folder-evento.png` — folder do evento

## Observações de segurança

- Não coloque `service_role` no front-end.
- Mantenha SELECT bloqueado para usuários anônimos.
- Para administrar e exportar dados, use o painel autenticado do Supabase.

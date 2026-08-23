# Deploy do Sinergia Comercial — GitHub Pages

Site publicado em: **https://sinergiacomunicacao.github.io/vendedor-app**

Repositório: `sinergiacomunicacao/vendedor-app` (organização do GitHub, não conta pessoal).

## Como funciona

O deploy é automático via GitHub Actions (`.github/workflows/deploy.yml`): todo `git push` na
branch `main` builda o app web (`npx expo export --platform web`) e publica no GitHub Pages.
Não é necessário rodar nada manualmente.

- Settings → Pages → Source: **GitHub Actions**
- `app.json` tem `experiments.baseUrl: "/vendedor-app"` — necessário porque o site fica numa
  subpasta (`sinergiacomunicacao.github.io/vendedor-app`), não na raiz do domínio. Se o nome do
  repositório mudar, esse valor precisa mudar junto.

## Secrets do GitHub Actions

O build usa as variáveis públicas do Firebase (não são segredos sensíveis, mas ficam como
Secrets por conveniência). Em Settings → Secrets and variables → Actions:

```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
```

Os valores são os mesmos do `.env` local do projeto.

## Firebase — domínio autorizado

Console Firebase → Authentication → Settings → Authorized domains já tem
`sinergiacomunicacao.github.io` cadastrado. Se o site for movido para outro domínio/subdomínio,
adicionar o novo domínio ali (sem isso o login por e-mail/senha pode ser bloqueado).

## Testar

- Acessar o link pelo celular do vendedor
- Fazer login
- No navegador, usar "Adicionar à tela inicial" para ganhar ícone e abertura em tela cheia

## Rodar o export manualmente (debug local)

Só necessário para depurar problemas de build sem esperar o Actions rodar:

```bash
npx expo export --platform web
```

Gera a pasta `dist/` (ignorada pelo git) com os arquivos estáticos.

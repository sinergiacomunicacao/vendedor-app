# Deploy do App Vendedor Externo — GitHub Pages

## 1. Exportar build web
Rodar na raiz do projeto Expo:
```bash
npx expo export --platform web
```
Gera a pasta `dist/` com os arquivos estáticos (HTML/JS/CSS).

## 2. Criar o repositório no GitHub
- Nome sugerido: `vendedor-app`
- Pode ser público (recomendado, já que não há dados sensíveis no código — só no Firebase)

## 3. Subir os arquivos

### Opção A — Manual (mais simples)
```bash
git init
git remote add origin https://github.com/SEU_USUARIO/vendedor-app.git
git add dist -f
git commit -m "deploy inicial"
git subtree push --prefix dist origin gh-pages
```

Para atualizar depois de uma mudança:
```bash
npx expo export --platform web
git add dist -f
git commit -m "update"
git subtree push --prefix dist origin gh-pages
```

### Opção B — Automática (GitHub Actions)
Ver `.github/workflows/deploy.yml` neste pacote. Basta copiar essa pasta `.github` para a raiz do seu projeto e configurar:
- Settings → Pages → Source: **GitHub Actions**

A partir daí, todo `git push` na branch `main` builda e publica sozinho.

## 4. Ativar o GitHub Pages
- Repositório → Settings → Pages
- Se usar Opção A: Source = branch `gh-pages`, pasta `/ (root)`
- Se usar Opção B: Source = GitHub Actions
- O link fica: `https://SEU_USUARIO.github.io/vendedor-app`

## 5. Ajustar o Firebase
- Console Firebase → Authentication → Settings → Authorized domains
- Adicionar: `SEU_USUARIO.github.io`
(sem isso, o login por e-mail/senha pode ser bloqueado)

## 6. Testar
- Acessar o link pelo celular do vendedor
- Fazer login
- No navegador, usar "Adicionar à tela inicial" para ganhar ícone e abertura em tela cheia

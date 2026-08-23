# Sinergia Comercial

App para a equipe comercial da Sinergia. Cada vendedor cria uma conta, faz
login e cadastra fichas de clientes potenciais com CNPJ, razão social,
telefone, email e produto de interesse.

- **Stack:** React Native com [Expo](https://expo.dev) + TypeScript
- **Backend:** Firebase (Authentication + Firestore)

## 1. Criar o projeto Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e crie um novo projeto.
2. Em **Build > Authentication > Sign-in method**, ative o provedor **Email/senha**.
3. Em **Build > Firestore Database**, crie o banco (modo produção).
4. Em **Firestore Database > Regras**, cole o conteúdo do arquivo [`firestore.rules`](./firestore.rules) deste projeto e publique. Isso garante que cada vendedor só veja os próprios clientes.
5. Em **Configurações do projeto > Geral > Seus apps**, adicione um app **Web** (o SDK do Firebase para Web funciona tanto no Expo Android/iOS quanto no navegador) e copie as credenciais mostradas.

## 2. Configurar as credenciais no app

Copie o arquivo `.env.example` para `.env` (já existe um `.env` vazio pronto) e preencha com os valores do passo anterior:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

Sem isso, o app mostra uma tela avisando que o Firebase não foi configurado.

## 3. Rodar o app

```bash
npm install
npx expo start
```

- Instale o app **Expo Go** (Android/iOS) na loja e escaneie o QR code que aparece no terminal para testar no celular físico — mais rápido para o dia a dia de desenvolvimento.
- `npx expo start --android` / `--ios` abrem um emulador/simulador, se instalado.
- `npx expo start --web` roda no navegador (útil para testes rápidos de UI).

## 4. Como funciona

- **Cadastro/Login** (`src/screens/CadastroScreen.tsx`, `LoginScreen.tsx`): autenticação por email/senha via Firebase Auth.
- **Lista de clientes** (`src/screens/ClientesScreen.tsx`): mostra em tempo real os clientes cadastrados pelo vendedor logado.
- **Nova ficha de cliente** (`src/screens/NovoClienteScreen.tsx`): formulário com máscara e validação de CNPJ, telefone e email, e seleção do produto de interesse.
- Cada cliente salvo no Firestore (`clientes`) é vinculado ao `vendedorId` (uid do Firebase Auth), então cada vendedor só vê a própria carteira.

## 5. Versão web (já publicada)

O app também roda no navegador, publicado em **https://sinergiacomunicacao.github.io/vendedor-app**
via GitHub Pages, com deploy automático a cada push na branch `main`. Detalhes de como esse
deploy funciona (secrets, domínio autorizado no Firebase, etc.) estão em [`DEPLOY.md`](./DEPLOY.md).

## 6. Publicar nas lojas (próximo passo)

Quando o app estiver pronto para os vendedores usarem de verdade como app nativo:

```bash
npx eas build --platform android
npx eas build --platform ios
```

Isso requer uma conta gratuita na [Expo (EAS)](https://expo.dev/eas) — no caso do iOS, também uma conta de desenvolvedor Apple (paga). Podemos configurar isso quando chegar a hora.

## Ideias para próximas versões

- Campo de observações/status do lead (ex: contatado, em negociação, fechado).
- Exportar relatório de clientes por vendedor.

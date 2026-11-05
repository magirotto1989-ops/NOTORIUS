# Renda+ — consolidador de renda extra

App mobile (Android/iOS, com versão web) que ajuda as pessoas a **descobrir, começar e acompanhar** fontes de renda extra — de casa ou na rua, em real ou em dólar.

| Funcionalidade | O que faz |
| --- | --- |
| **Quiz + match** | 8 perguntas (modalidade, horas, meta, habilidades, bens, inglês, capital, urgência). Um motor de recomendação elimina o que é inviável para a pessoa (ex.: sem carro → sem Uber) e ranqueia o resto de 0 a 100%, mostrando o porquê. |
| **Catálogo** | 33 oportunidades reais (freelas, aulas, afiliados, IA, entregas, serviços locais, aluguel, comida…), com ganho estimado por hora e por mês, investimento, tempo até o 1º pagamento, prós/contras, alertas antigolpe, nota tributária e **fontes**. Busca, filtros e ordenação. |
| **Trilhas** | Passo a passo do zero ao 1º pagamento, com checklist e progresso salvo. Etapas avançadas (roteiros, precificação, modelos) são Premium. |
| **Controle de ganhos** | Lançamentos em R$ ou US$ (conversão automática), meta mensal, projeção, gráfico mensal, quebra por fonte e exportação CSV para o IR (Premium). |
| **Monetização** | Freemium (assinatura via App Store/Google Play com RevenueCat) + links de afiliado/indicação rastreados por clique. |
| **Conformidade** | Exclusão de conta e exportação de dados pelo app (LGPD e exigência das lojas), senhas com bcrypt, refresh token com rotação e detecção de reuso. |

---

## Arquitetura

```
renda-extra/
├── api/      Node 22 + TypeScript + Fastify 5 + Prisma 6 + PostgreSQL
│   ├── prisma/schema.prisma      modelo de dados
│   ├── prisma/data/*.ts          catálogo de oportunidades e trilhas (conteúdo)
│   ├── prisma/seed.ts            sincroniza o catálogo (idempotente)
│   ├── src/domain/match.ts       motor de recomendação (função pura, testada)
│   ├── src/routes/*              auth, me, opportunities, tracks, earnings, billing, admin
│   └── test/                     21 testes (unitários + integração com banco real)
└── mobile/   Expo SDK 58 + Expo Router + React Query (roda em Android, iOS e web)
    ├── src/app/                  telas (rotas)
    ├── src/components/           design system (ui.tsx, gráficos, cards)
    └── src/lib/                  cliente HTTP, auth, cobrança (RevenueCat), queries
```

Documentação interativa da API (Swagger): `http://localhost:3333/docs`.

---

## Rodando localmente

Pré-requisitos: Node 20+ e PostgreSQL 14+ (ou Docker).

**1. Banco** (opção Docker):

```bash
docker compose up -d db
```

**2. API:**

```bash
cd api && cp .env.example .env && npm install
```

```bash
npm run db:migrate && npm run db:seed
```

```bash
npm run dev
```

O seed cria a conta demo **demo@rendamais.app / demo12345** (com histórico de ganhos). Em produção ela não é criada.

**3. App:**

```bash
cd mobile && npm install
```

```bash
npx expo start
```

Abra no celular com o app **Expo Go** (lendo o QR code) ou pressione `w` para a versão web. Em desenvolvimento o app encontra a API sozinho pelo IP da sua máquina (porta 3333); para outro endereço, defina `EXPO_PUBLIC_API_URL` em `mobile/.env`.

**Testes e qualidade:**

```bash
cd api && npm test
```

```bash
cd mobile && npx tsc --noEmit && npx expo lint
```

Os testes da API usam um banco separado (`rendamais_test`, ou `TEST_DATABASE_URL`) e recusam rodar em bancos sem o sufixo `_test`.

---

## Como o app ganha dinheiro

### 1. Assinatura Premium (freemium)

| Grátis | Premium (R$ 19,90/mês ou R$ 149,90/ano — editável em `api/src/routes/billing.ts`) |
| --- | --- |
| Quiz, catálogo completo, recomendações | Tudo do grátis |
| Até 2 trilhas ativas | Trilhas ilimitadas |
| Etapas básicas das trilhas | Etapas avançadas (roteiros, precificação, modelos) |
| Histórico de ganhos dos últimos 3 meses | Histórico ilimitado + gráfico de 12 meses + exportação CSV |

As regras são aplicadas **no servidor** (`FREE_LIMITS` em `api/src/domain/meta.ts`), não só na tela.

**Configurar a cobrança real (RevenueCat):**

1. Crie as assinaturas nas lojas com os IDs `rendamais_premium_monthly` e `rendamais_premium_yearly`.
2. No RevenueCat: crie o entitlement `premium`, uma offering *current* com os pacotes *Monthly* e *Annual*.
3. Em **Integrations → Webhooks**, aponte para `https://SUA-API/billing/revenuecat/webhook` e defina um valor de *Authorization header*. Coloque o mesmo valor em `REVENUECAT_WEBHOOK_AUTH` na API.
4. Coloque as chaves públicas em `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` e gere um *development build* (`npx eas-cli@latest build --profile development`). Compras não funcionam no Expo Go.

Sem as chaves, o paywall entra em **modo demonstração** (libera 30 dias via `ALLOW_DEV_BILLING=true`). Em produção essa flag é bloqueada pela própria API.

### 2. Afiliados e indicações

Toda vez que alguém toca em “Acessar” numa plataforma, a API registra o clique e redireciona. Se a plataforma tiver um **link de afiliado** cadastrado, ele é usado no lugar do link oficial. Programas com indicação remunerada que valem a pena checar: Shopee/Mercado Livre/Amazon (afiliados), Hotmart/Kiwify, Wise/Payoneer, Preply, Upwork, entre outros.

Para cadastrar: registre-se com um e-mail listado em `ADMIN_EMAILS` (vira admin), abra `/docs` e use `PATCH /admin/platforms/{id}` com `{ "affiliateUrl": "https://..." }`. O seed **nunca sobrescreve** esses links. O perfil do admin no app mostra um painel com usuários, conversão para Premium, conclusão do quiz e cliques por plataforma.

> Transparência: informe na política de privacidade e na descrição da loja que o app pode receber comissão por indicações.

---

## Deploy

**API** — qualquer host Node/Docker (Render, Railway, Fly.io, AWS) + Postgres gerenciado (Neon, Supabase, RDS). O `Dockerfile` aplica as migrações, sincroniza o catálogo e sobe o servidor. Variáveis obrigatórias: `DATABASE_URL`, `JWT_SECRET` (48+ bytes aleatórios), `NODE_ENV=production`; recomendadas: `CORS_ORIGINS`, `ADMIN_EMAILS`, `REVENUECAT_WEBHOOK_AUTH`.

**App** — com EAS (serviço de build da Expo):

```bash
cd mobile && npx eas-cli@latest build --platform all --profile production
```

```bash
npx eas-cli@latest submit --platform all
```

Antes, troque `https://SUA-API-DE-PRODUCAO` em `mobile/eas.json` e confirme `bundleIdentifier`/`package` (`app.rendamais`) em `mobile/app.json`.

---

## Checklist para publicar

- [ ] Contas de desenvolvedor: Apple (US$ 99/ano) e Google Play (US$ 25, taxa única).
- [ ] Nome e marca: “Renda+” é provisório — verifique disponibilidade no INPI e nas lojas.
- [ ] Ícone, splash e screenshots com a marca final (`mobile/assets/`).
- [ ] Política de Privacidade e Termos de Uso publicados (LGPD), com menção a comissões de afiliados. Atualize o e-mail de contato (`contato@rendamais.app`) na tela de Perfil.
- [ ] Recuperação de senha por e-mail (próximo passo recomendado: integrar Resend/SES).
- [ ] Revisar as estimativas do catálogo a cada trimestre (`api/prisma/data/*.ts` — cada item tem `sources` e a data de revisão aparece no app).

## Atualizando o catálogo

O conteúdo está em `api/prisma/data/online.ts` e `local.ts`. Edite e rode `npm run db:seed` (ou faça deploy: o container roda o seed sozinho). O progresso dos usuários e os links de afiliado são preservados. Ajustes rápidos sem deploy: `PATCH /admin/opportunities/{slug}`.

---

**Aviso:** os valores do app são estimativas baseadas em fontes públicas e relatos de mercado (ex.: dados do iFood sobre ganho médio por hora, levantamentos de lucro de motoristas de app, comparativos de plataformas). O app deixa claro em todas as telas que não há promessa de renda.

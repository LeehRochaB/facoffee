# Participantes
Isabela Fernandes Lopes  
Letícia Batista Rocha  
Yan Victor Gomes   

# users-service

Serviço responsável pelo domínio de usuários da aplicação FACOFFEE — sistema para divisão de custos da copa da FACOM/UFMS.

---

# Tecnologias

| Tecnologia | Uso |
|------------|-----|
| Node.js + Express | Runtime e framework HTTP |
| Prisma + SQLite | Banco de dados local |
| Keycloak | Autenticação e autorização (JWT) |
| RabbitMQ | Publicação de eventos de domínio |
| Jest + Supertest | Testes unitários e de integração |

---

# Pré-requisitos

- Node.js 18+
- Docker Desktop
- Git

---

# Setup local

## 1. Clonar o repositório e subir a infraestrutura

```bash
git clone https://github.com/LeehRochaB/trabalho-facoffee.git
cd facoffee
docker compose up -d
```

Verificar serviços:

```bash
docker compose ps
```

---

## 2. Instalar dependências

```bash
cd users-service
npm install
```

---

## 3. Configurar variáveis de ambiente

Criar arquivo `.env` na raiz do `users-service`:

```env
PORT=3001
DATABASE_URL="file:./dev.db"
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=facoffee
KEYCLOAK_CLIENT_ID=facoffee-private
KEYCLOAK_CLIENT_SECRET=facoffee-private-secret
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

---

## 4. Criar banco de dados

```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

## 5. Iniciar o serviço

```bash
npm run dev
```

Serviço disponível em:

```txt
http://localhost:3001/users
```

---

# Endpoints

| Método | Rota | Auth | Descrição |
|--------|------|------|----------|
| POST | /users | Público | Criar usuário |
| GET | /users | MANAGER | Listar usuários |
| GET | /users/:userId | MANAGER ou próprio | Obter usuário |
| PATCH | /users/:userId | MANAGER ou próprio | Atualizar dados |
| DELETE | /users/:userId | MANAGER ou próprio | Desativar usuário |
| PUT | /users/:userId/roles | MANAGER | Substituir roles |

---

As rotas também estão disponíveis via API Gateway:

```txt
http://localhost:8000/api/users
```

---

# Exemplos de uso

## Obter token (MANAGER)

```http
POST http://localhost:8080/realms/facoffee/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded
```

```http
grant_type=password
client_id=facoffee-public
username=facoffee@facom.ufms.br
password=facoffee
```

---

## Criar usuário

```http
POST http://localhost:3001/users
Content-Type: application/json
```

```json
{
  "name": "Usuário teste",
  "email": "teste@facom.ufms.br",
  "roles": ["PARTICIPANT"]
}
```

---

## Listar usuários

```http
GET http://localhost:3001/users
Authorization: Bearer <access_token>
```

---

## Desativar usuário

```http
DELETE http://localhost:3001/users/:userId
Authorization: Bearer <access_token>
```

---

# Regras de negócio

- E-mail deve ser único no domínio
- Usuário inicia com status `ACTIVE`
- Role padrão: `PARTICIPANT` (se não informada)
- Apenas `MANAGER` pode listar usuários
- `PARTICIPANT` só acessa seu próprio usuário
- Roles são substituídas integralmente

---

# Eventos publicados

| Evento | Trigger |
|--------|--------|
| user.created | POST /users |
| user.deactivated | DELETE /users/:userId |
| user.roles.replaced | PUT /users/:userId/roles |

---

# Testes

```bash
npm test
```

Resultado esperado:

```txt
PASS tests/usersController.test.js
PASS tests/users.integration.test.js

Test Suites: 2 passed, 2 total
Tests: 37 passed, 37 total
```

---

# Cobertura dos testes

## Unitários (usersController.test.js)

- Criação de usuário
- Validação de nome/email
- Email duplicado (409)
- Role padrão
- Busca por ID
- Atualização de usuário
- Desativação e validações
- Substituição de roles

---

## Integração (users.integration.test.js)

- MANAGER acesso permitido
- PARTICIPANT bloqueado (403)
- Sem token (401)
- Conflito de email (409)
- Fluxo completo dos endpoints

---

# Estrutura do projeto

```txt
users-service/
├── src/
│   ├── controllers/
│   │   └── usersController.js
│   ├── middlewares/
│   │   └── auth.js
│   ├── routes/
│   │   └── users.js
│   ├── services/
│   │   ├── keycloakService.js
│   │   └── rabbitService.js
│   ├── app.js
│   └── index.js
├── prisma/
│   └── schema.prisma
├── tests/
│   ├── usersController.test.js
│   └── users.integration.test.js
├── jest.config.js
├── .env
└── package.json
```

---

# Infraestrutura

| Serviço | URL | Credenciais |
|--------|-----|-------------|
| API Gateway | http://localhost:8000 | — |
| Keycloak | http://localhost:8080 | facoffee / facoffee |
| RabbitMQ | http://localhost:15672 | facoffee / facoffee |
| Mailpit | http://localhost:8025 | — |

---

# Arquitetura

Este serviço segue o padrão:

Decomposition by Business Capability

O microsserviço:

- possui banco próprio
- encapsula domínio isolado
- não compartilha persistência
- se comunica via eventos (RabbitMQ)

---

# Evidências de testes

- Execução de testes unitários (evidência 1)
- Execução de testes de integração (evidência 2)
- Logs de autenticação Keycloak (evidência 3)
- Testes via Postman (evidência 4)
- Validação de roles MANAGER/PARTICIPANT (evidência 5)

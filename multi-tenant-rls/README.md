# multi-tenant-rls

Várias empresas no mesmo banco, cada uma enxergando só os próprios dados, com o isolamento garantido pelo PostgreSQL e não só pelo código da aplicação.

Fiz esse repositório a partir do que aprendi num SaaS multiempresa. Lá medimos o isolamento em todas as tabelas com dados de clientes. Aqui está a mesma ideia reduzida a duas tabelas e duas empresas fictícias, com testes que provam o isolamento.

## Por que no banco

Se o isolamento depende de todo `SELECT` lembrar do `WHERE organization_id = ...`, basta uma consulta esquecida para uma empresa ver os clientes da outra. Com Row-Level Security o próprio banco aplica o filtro em toda consulta, inclusive nas que alguém esquecer.

## Como funciona

1. **Dois papéis.** `app_owner` é dono das tabelas e roda as migrations. `app_user` é o que a aplicação usa: não é dono, não é superusuário e não tem `BYPASSRLS`. Se a aplicação conectasse com o dono, o RLS não valeria para ela.
2. **Organização por transação.** A aplicação abre uma transação e define a empresa com `set_config('app.org_id', <id>, true)`. O `true` faz o valor durar só até o fim da transação, então ele não fica preso na conexão do pool para a próxima requisição.
3. **Política.** Em `leads`, `USING` filtra o que dá para ler, alterar e apagar, e `WITH CHECK` impede gravar linha com o id de outra empresa.
4. **Sem empresa, sem dados.** Se ninguém definiu `app.org_id`, a função `current_org()` devolve `NULL` e nenhuma linha passa no filtro.

O SQL está em `sql/`, em três arquivos: papéis, tabelas com políticas e dados de exemplo.

## O que os testes provam

Os testes conectam como `app_user` e conferem antes que esse papel não consegue ignorar o RLS. Depois:

- a Clínica Alfa vê os 2 leads dela e a Academia Beta vê o 1 dela;
- filtrar pelo id da outra empresa devolve zero linhas;
- sem empresa definida, zero linhas;
- depois do `COMMIT` a empresa não continua valendo na conexão;
- inserir lead com o id da outra empresa dá erro de `row-level security`;
- `DELETE` e `UPDATE` em leads da outra empresa afetam zero linhas;
- não dá para mover um lead próprio para a outra empresa.

Também conferi o contrário: desligando o RLS da tabela `leads`, 8 dos 9 testes falham. O único que continua passando é o que grava na própria empresa, que deve funcionar com ou sem RLS.

## Rodando

Precisa de Node 20 ou mais novo e de um PostgreSQL (14 ou mais novo) com um usuário que possa criar papéis.

```bash
createdb rls_demo
npm install
ADMIN_URL=postgres://postgres:SUA_SENHA@localhost:5432/rls_demo npm run setup
ADMIN_URL=postgres://postgres:SUA_SENHA@localhost:5432/rls_demo npm test
```

No Windows (Git Bash) o comando é o mesmo. As senhas de `app_owner` e `app_user` em `sql/01_roles.sql` são só para teste local.

O GitHub Actions sobe um PostgreSQL 16 e roda tudo isso a cada push.

## O que fica de fora

- **Pool de conexões.** Em produção, a conexão do `app_user` costuma passar por um pool. Por isso o teste confere que a empresa não vaza de uma transação para a outra.
- **`FORCE ROW LEVEL SECURITY`.** Não usei de propósito. Ele faria o RLS valer também para o dono e quebraria as migrations e o seed. Com os dois papéis separados, ele não é necessário.

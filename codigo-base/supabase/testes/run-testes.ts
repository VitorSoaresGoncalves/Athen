/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { Client } from 'pg';

interface NoticeMessage {
  message?: string;
}

interface QuestionHandler {
  (query: string): Promise<string>;
}

// Exige a string de conexão via variável de ambiente, sem expor credenciais no código
const CONNECTION_STRING: string | undefined = process.env.SUPABASE_DB_URL;

if (!CONNECTION_STRING) {
  console.error('\nErro Crítico: A variável de ambiente SUPABASE_DB_URL não está definida.');
  console.error('Execute o script passando a variável, ex: SUPABASE_DB_URL="sua_url" npx ts-node arquivo.ts\n');
  process.exit(1);
}

async function executarScript(caminhoArquivo: string): Promise<boolean> {
  const client = new Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    client.on('notice', (msg: NoticeMessage): void => {
      if (msg.message) {
        console.warn(msg.message);
      }
    });

    const fullPath: string = path.resolve(caminhoArquivo);
    if (!fs.existsSync(fullPath)) {
      console.error(`\n Arquivo não encontrado: ${fullPath}`);
      return false;
    }

    const sql: string = fs.readFileSync(fullPath, 'utf8');
    await client.query(sql);
    return true;
  } catch (err: unknown) {
    console.error('\n Erro durante a execução do script SQL:');
    console.error(err instanceof Error ? err.message : String(err));
    return false;
  } finally {
    await client.end();
  }
}

function exibirMenu(): void {
  console.log('\n===========================================================');
  console.log('             SUÍTE DE TESTES SUPABASE - ATHEN              ');
  console.log('===========================================================');
  console.log(' 1. Executar 01_create.sql (Criação de Entidades)');
  console.log(' 2. Executar 02_read.sql   (Validação de Leituras e Triggers)');
  console.log(' 3. Executar 03_update.sql (Atualizações e Regras de Negócio)');
  console.log(' 4. Executar 04_delete.sql (Exclusão e Deleção em Cascata)');
  console.log(' 5. Executar todos os testes em sequência (1 -> 2 -> 3 -> 2 -> 4 -> 2)');
  console.log(' 0. Sair');
  console.log('===========================================================');
}

async function main(): Promise<void> {
  const rl: readline.Interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question: QuestionHandler = (query: string): Promise<string> =>
    new Promise((resolve: (value: string | PromiseLike<string>) => void) =>
      rl.question(query, resolve)
    );

  let continuar: boolean = true;

  while (continuar) {
    exibirMenu();
    const opcao: string = (await question('\nEscolha uma opção: ')).trim();

    switch (opcao) {
      case '1':
        console.log('\n Executando 01_create.sql...\n');
        await executarScript('./01_create.sql');
        break;
      case '2':
        console.log('\n Executando 02_read.sql...\n');
        await executarScript('./02_read.sql');
        break;
      case '3':
        console.log('\n Executando 03_update.sql...\n');
        await executarScript('./03_update.sql');
        break;
      case '4':
        console.log('\n Executando 04_delete.sql...\n');
        await executarScript('./04_delete.sql');
        break;
      case '5':
        console.log('\n Executando TODA a suíte de testes em sequência...\n');
        console.log('--- [PASSO 1] ---');
        await executarScript('./01_create.sql');
        console.log('\n--- [PASSO 2.1] ---');
        await executarScript('./02_read.sql');
        console.log('\n--- [PASSO 3] ---');
        await executarScript('./03_update.sql');
        console.log('\n--- [PASSO 2.2] ---');
        await executarScript('./02_read.sql');
        console.log('\n--- [PASSO 4] ---');
        await executarScript('./04_delete.sql');
        break;
      case '0':
        console.log('\nSaindo...');
        continuar = false;
        break;
      default:
        console.log('\n Opção inválida, tente novamente.');
        break;
    }
  }

  rl.close();
}

main().catch(console.error);
// Base de dados Postgres gerida pela própria Netlify ("Netlify Database").
// getDatabase() resolve sozinho a ligação certa para o ambiente/branch atual — nada de strings
// de ligação para copiar manualmente. Exige o pacote @netlify/database instalado (é isso que
// despoleta o aprovisionamento automático no primeiro deploy) e as migrações em
// netlify/database/migrations/ aplicadas pela própria Netlify nesse deploy.
//
// IMPORTANTE: nunca correr DDL (CREATE/ALTER/DROP) diretamente contra esta ligação — alterações
// de esquema só através de novos ficheiros de migração, para não desalinhar o histórico.
import { getDatabase } from '@netlify/database';

export const db = getDatabase();

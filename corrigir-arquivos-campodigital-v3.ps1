$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$backend = Join-Path $root 'campodigital-backend'
if (!(Test-Path $backend)) { throw 'Execute este script na raiz do projeto Campo-Digital.' }

@'
import express, { Router } from 'express';

export function createCategorySuggestionRouter(service, requireAuth, invoiceAnalysisService = null, productionCategoryService = null) {
  const router = Router();
  router.use(requireAuth);
  router.post('/sugerir-categoria', async (request, response) => {
    response.json(await service.suggest(request.auth.sub, request.body));
  });
  if (productionCategoryService) {
    router.post('/sugerir-categorias-producao', async (request, response) => {
      response.json(productionCategoryService.suggest(request.body?.atividade ?? request.body ?? {}));
    });
  }
  if (invoiceAnalysisService) {
    router.post('/analisar-comprovante', express.raw({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      limit: '5mb',
    }), async (request, response) => {
      response.json(await invoiceAnalysisService.analyze(
        request.auth.sub,
        request.body,
        request.get('content-type')?.split(';')[0].trim().toLowerCase(),
      ));
    });
  }
  return router;
}
'@ | Set-Content (Join-Path $backend 'src\ai\category-suggestion.routes.js') -Encoding UTF8

@'
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

const required = {
  usuarios: ['id', 'nombre', 'email', 'telefone', 'nome_propriedade', 'localidade', 'password_hash', 'rol', 'activo'],
  actividades_productivas: ['id', 'usuario_id', 'nombre', 'descripcion', 'tipo_producao', 'produtos_trabalhados', 'porte_producao', 'activa'],
  categorias_financieras: ['id', 'usuario_id', 'nombre', 'tipo', 'es_sistema', 'activa'],
  movimientos_financieros: ['id', 'usuario_id', 'categoria_id', 'categoria_sugerida_id', 'confianza_ia', 'tipo', 'descripcion', 'valor', 'fecha'],
  insights_financieros: ['id', 'usuario_id', 'periodo_inicio', 'periodo_fin', 'tipo', 'titulo', 'mensaje', 'datos_referencia', 'es_sugerencia', 'foi_util', 'avaliado_em', 'creado_en'],
  preferencias_alertas: ['id', 'usuario_id', 'alertas_activas', 'frecuencia', 'porcentaje_variacion', 'actualizado_en'],
};

const connection = await mysql.createConnection({ host: env.database.host, port: env.database.port, user: env.database.user, password: env.database.password, database: env.database.name });
try {
  const [rows] = await connection.execute(`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?`, [env.database.name]);
  const available = new Map();
  for (const row of rows) { if (!available.has(row.tableName)) available.set(row.tableName, new Set()); available.get(row.tableName).add(row.columnName); }
  const missing = [];
  for (const [table, columns] of Object.entries(required)) for (const column of columns) if (!available.get(table)?.has(column)) missing.push(`${table}.${column}`);
  if (missing.length) { console.error('Esquema incompleto. Execute npm run db:migrate.'); console.error(`Campos ausentes: ${missing.join(', ')}`); process.exitCode = 1; } else console.log(`Esquema de ${env.database.name} compatível com o CampoDigital.`);
} finally { await connection.end(); }
'@ | Set-Content (Join-Path $backend 'src\database\check-schema.js') -Encoding UTF8

$appPath = Join-Path $backend 'src\app.js'
$app = Get-Content -Raw $appPath
if ($app -notmatch 'production-category.service.js') { $app = $app.Replace("import { createCategorySuggestionService } from './ai/category-suggestion.service.js';", "import { createCategorySuggestionService } from './ai/category-suggestion.service.js';`r`nimport { createProductionCategoryService } from './ai/production-category.service.js';") }
if ($app -notmatch 'const productionCategoryService') { $app = $app.Replace('  const movementService = overrides.movementService', "  const productionCategoryService = overrides.productionCategoryService ?? createProductionCategoryService();`r`n  const movementService = overrides.movementService") }
$app = $app -replace 'createCategorySuggestionRouter\(categorySuggestionService, requireAuth(, invoiceAnalysisService)?\)', 'createCategorySuggestionRouter(categorySuggestionService, requireAuth, invoiceAnalysisService, productionCategoryService)'
$app = $app -replace '(?m)^<<<<<<<.*\r?\n|^=======.*\r?\n|^>>>>>>>.*\r?\n', ''
Set-Content $appPath $app -Encoding UTF8

git add campodigital-backend/src/ai/category-suggestion.routes.js campodigital-backend/src/database/check-schema.js campodigital-backend/src/app.js
Write-Host 'Arquivos corrigidos e adicionados ao stage.' -ForegroundColor Green

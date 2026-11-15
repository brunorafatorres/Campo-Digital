$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$packagePath = Join-Path $root 'campodigital-backend\package.json'
$appPath = Join-Path $root 'campodigital-backend\src\app.js'
if (!(Test-Path $packagePath) -or !(Test-Path $appPath)) { throw 'Execute na raiz do projeto Campo-Digital.' }

# Remove marcadores restantes do package.json. A primeira execução já deixou o comando válido.
$package = Get-Content -Raw $packagePath
$package = $package -replace '(?m)^<<<<<<<.*\r?\n|^=======.*\r?\n|^>>>>>>>.*\r?\n', ''
Set-Content $packagePath $package -Encoding UTF8

$app = Get-Content -Raw $appPath
# Em um conflito, preserva o bloco "ours" (a versão que já estava na sua pasta).
$block = '(?s)<<<<<<<[^\r\n]*\r?\n(.*?)\r?\n=======\r?\n.*?\r?\n>>>>>>>[^\r\n]*'
while ([regex]::IsMatch($app, $block)) { $app = [regex]::Replace($app, $block, '$1', 1) }
$app = $app -replace '(?m)^<<<<<<<.*\r?\n|^=======.*\r?\n|^>>>>>>>.*\r?\n', ''

if ($app -notmatch "production-category\.service\.js") {
  $app = $app.Replace("import { createCategorySuggestionService } from './ai/category-suggestion.service.js';", "import { createCategorySuggestionService } from './ai/category-suggestion.service.js';`r`nimport { createProductionCategoryService } from './ai/production-category.service.js';")
}
if ($app -notmatch 'const productionCategoryService') {
  $needle = '  const movementService = overrides.movementService'
  $insert = "  const productionCategoryService = overrides.productionCategoryService ?? createProductionCategoryService();`r`n"
  $app = $app.Replace($needle, $insert + $needle)
}
$app = $app -replace 'createCategorySuggestionRouter\(categorySuggestionService, requireAuth\)', 'createCategorySuggestionRouter(categorySuggestionService, requireAuth, productionCategoryService)'
Set-Content $appPath $app -Encoding UTF8

$remaining = Get-ChildItem -Recurse -File -Path (Join-Path $root 'campodigital-backend') | Select-String -Pattern '<<<<<<<|=======|>>>>>>>' -SimpleMatch
if ($remaining) { throw 'Ainda existem marcadores de conflito no backend.' }
git add campodigital-backend/package.json campodigital-backend/src/app.js
Write-Host 'Conflitos corrigidos e arquivos preparados.' -ForegroundColor Green

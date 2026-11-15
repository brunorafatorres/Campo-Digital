import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionCategoryService } from '../src/ai/production-category.service.js';
test('produção de soja e milho recebe categorias contextualizadas', () => { const result = createProductionCategoryService().suggest({ tipo_producao: 'Agricultura', produtos_trabalhados: 'soja e milho' }); assert.equal(result.origem, 'PERFIL_PRODUTIVO'); assert.ok(result.categorias.some((item) => item.nome === 'Fertilizantes e insumos')); assert.ok(result.categorias.some((item) => item.tipo === 'INGRESO')); });
test('produção sem correspondência recebe sugestões gerais', () => { const result = createProductionCategoryService().suggest({ produtos_trabalhados: 'produção familiar' }); assert.equal(result.categorias.length, 3); assert.equal(result.categorias[0].tipo, 'GASTO'); });

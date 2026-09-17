import assert from 'node:assert/strict';
import { test } from 'node:test';

import { categoryKey } from '../src/ai/category-key.js';
import { createCategorySuggestionService } from '../src/ai/category-suggestion.service.js';

const categories = [
  { id: 1, nombre: 'Venda de producao', tipo: 'INGRESO', activa: true },
  { id: 2, nombre: 'Combustivel', tipo: 'GASTO', activa: true },
  { id: 3, nombre: 'Outros gastos', tipo: 'GASTO', activa: true },
];
const categoryService = {
  async list(userId, type) {
    assert.equal(userId, '7');
    return categories.filter((item) => item.tipo === type);
  },
};

test('IA: reconhece as chaves das categorias do banco antigo', () => {
  assert.equal(categoryKey('Venda de produção', 'INGRESO'), 'VENDA_PRODUCAO');
  assert.equal(categoryKey('Ração e alimentação animal', 'GASTO'), 'RACAO');
  assert.equal(categoryKey('Manutenção de equipamentos', 'GASTO'), 'MANUTENCAO');
});

test('IA: devolve uma categoria visível do produtor e informa que é sugestão', async () => {
  const client = { async suggest(input) {
    assert.deepEqual(input.categorias_disponiveis, ['COMBUSTIVEL', 'OUTROS_GASTOS']);
    return { categoria_chave: 'COMBUSTIVEL', confianca: 88.4 };
  } };
  const result = await createCategorySuggestionService(categoryService, client)
    .suggest('7', { descripcion: 'abastecimento do trator', tipo: 'GASTO' });
  assert.equal(result.categoria.id, 2);
  assert.equal(result.confianca, 88.4);
  assert.equal(result.gerada_por_ia, true);
  assert.match(result.aviso, /pode alterar/i);
});

test('IA: falha do serviço não impede o uso manual', async () => {
  const client = { async suggest() {
    throw Object.assign(new Error('Sugestão de IA indisponível. Selecione a categoria manualmente.'), { status: 503 });
  } };
  await assert.rejects(
    createCategorySuggestionService(categoryService, client)
      .suggest('7', { descripcion: 'diesel', tipo: 'GASTO' }),
    (error) => error.status === 503 && /manualmente/.test(error.message),
  );
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createInvoiceAnalysisService } from '../src/ai/invoice-analysis.service.js';

const image = Buffer.from('image-bytes');

test('comprovante: preenche rascunho com dados extraídos e sugestão de categoria', async () => {
  const aiClient = { async readInvoice(receivedImage, contentType) {
    assert.deepEqual(receivedImage, image);
    assert.equal(contentType, 'image/jpeg');
    return {
      fornecedor: 'Agropecuária São José', data: '2026-09-07', valor: '123.45',
      confianca_leitura: 91.2,
      campos_extraidos: { fornecedor: true, data: true, valor: true },
    };
  } };
  const categoryService = { async suggest(userId, input) {
    assert.equal(userId, 'produtor-7');
    assert.equal(input.tipo, 'GASTO');
    assert.match(input.descripcion, /São José/);
    return { categoria: { id: 4, nombre: 'Insumos' }, confianca: 87, aprendeu_com_correcao: false };
  } };
  const result = await createInvoiceAnalysisService(aiClient, categoryService)
    .analyze('produtor-7', image, 'image/jpeg');

  assert.equal(result.movimentacao.tipo, 'GASTO');
  assert.equal(result.movimentacao.valor, '123.45');
  assert.equal(result.movimentacao.fecha, '2026-09-07');
  assert.equal(result.movimentacao.categoria_sugerida_id, 4);
  assert.deepEqual(result.campos_para_conferir, []);
  assert.match(result.aviso, /não é armazenada/);
});

test('comprovante: continua com preenchimento manual quando a categoria não pode ser sugerida', async () => {
  const aiClient = { async readInvoice() {
    return { fornecedor: null, data: null, valor: null, confianca_leitura: 20,
      campos_extraidos: { fornecedor: false, data: false, valor: false } };
  } };
  const categoryService = { async suggest() { throw Object.assign(new Error('IA indisponível'), { status: 503 }); } };
  const result = await createInvoiceAnalysisService(aiClient, categoryService)
    .analyze('produtor-7', image, 'image/png');

  assert.equal(result.movimentacao.valor, '');
  assert.equal(result.movimentacao.fecha, '');
  assert.equal(result.movimentacao.categoria, null);
  assert.deepEqual(result.campos_para_conferir, ['fornecedor', 'valor', 'data']);
  assert.match(result.aviso_categoria, /Fornecedor não identificado/);
});

test('comprovante: rejeita MIME e tamanho fora do limite sem chamar a IA', async () => {
  const aiClient = { async readInvoice() { assert.fail('não deve ser chamado'); } };
  const service = createInvoiceAnalysisService(aiClient, { async suggest() {} });
  await assert.rejects(service.analyze('7', image, 'application/pdf'), (error) => error.status === 400);
  await assert.rejects(service.analyze('7', Buffer.alloc(5 * 1024 * 1024 + 1), 'image/jpeg'),
    (error) => error.status === 400);
});

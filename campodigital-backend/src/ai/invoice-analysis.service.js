const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function createInvoiceAnalysisService(aiClient, categorySuggestionService) {
  return {
    async analyze(userId, image, contentType) {
      if (!Buffer.isBuffer(image) || image.length === 0 || image.length > MAX_IMAGE_BYTES) {
        throw fail('Selecione uma imagem válida de até 5 MB.');
      }
      if (!ALLOWED_TYPES.has(contentType)) {
        throw fail('Envie uma imagem JPEG, PNG ou WebP.');
      }

      const extracted = await aiClient.readInvoice(image, contentType);
      const supplier = typeof extracted.fornecedor === 'string' ? extracted.fornecedor.trim().slice(0, 120) : '';
      const description = supplier ? `Compra - ${supplier}` : 'Despesa identificada em comprovante';
      let category = null;
      let categoryError = supplier
        ? null : 'Fornecedor não identificado; escolha a categoria manualmente.';
      if (supplier) {
        try {
          const result = await categorySuggestionService.suggest(userId, {
            descripcion: description,
            tipo: 'GASTO',
          });
          category = {
            ...result.categoria,
            confianca: result.confianca,
            aprendeu_com_correcao: result.aprendeu_com_correcao,
          };
        } catch (error) {
          categoryError = error.status === 503
            ? 'Não foi possível sugerir a categoria; escolha uma manualmente.'
            : 'Não há uma categoria disponível para esta sugestão; escolha uma manualmente.';
        }
      }

      const campos = extracted.campos_extraidos ?? {};
      const missing = [];
      if (!supplier) missing.push('fornecedor');
      if (!extracted.valor) missing.push('valor');
      if (!extracted.data) missing.push('data');
      return {
        movimentacao: {
          tipo: 'GASTO',
          descricao: description,
          valor: extracted.valor ?? '',
          fecha: extracted.data ?? '',
          categoria: category,
          categoria_sugerida_id: category?.id ?? null,
          confianza_ia: category?.confianca ?? null,
        },
        fornecedor: supplier || null,
        confianca_leitura: extracted.confianca_leitura ?? 0,
        campos_extraidos: campos,
        aviso: 'Rascunho preenchido. Confira e corrija os dados antes de salvar; a imagem não é armazenada.',
        aviso_categoria: categoryError,
        campos_para_conferir: missing,
      };
    },
  };
}

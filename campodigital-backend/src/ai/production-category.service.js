const RULES = [
  { keys: ['soja', 'milho', 'arroz', 'feijão', 'feijao', 'trigo'], categories: [['Sementes e mudas', 'GASTO'], ['Fertilizantes e insumos', 'GASTO'], ['Defensivos agrícolas', 'GASTO'], ['Venda de grãos', 'INGRESO']] },
  { keys: ['gado', 'bovino', 'leite', 'vaca', 'pecuária', 'pecuaria'], categories: [['Ração e alimentação animal', 'GASTO'], ['Medicamentos veterinários', 'GASTO'], ['Manutenção da ordenha', 'GASTO'], ['Venda de produção animal', 'INGRESO']] },
  { keys: ['hortaliça', 'hortalica', 'verdura', 'tomate', 'alface', 'fruta'], categories: [['Sementes e mudas', 'GASTO'], ['Irrigação', 'GASTO'], ['Embalagens', 'GASTO'], ['Venda de hortaliças', 'INGRESO']] },
  { keys: ['abelha', 'mel', 'apicultura'], categories: [['Colmeias e equipamentos', 'GASTO'], ['Alimentação das abelhas', 'GASTO'], ['Venda de mel', 'INGRESO']] },
];
export function createProductionCategoryService() {
  return { suggest(activity = {}) {
    const text = [activity.nombre, activity.tipo_producao, activity.produtos_trabalhados, activity.descripcion].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
    const matched = RULES.find((rule) => rule.keys.some((key) => text.includes(key)));
    const categories = matched?.categories ?? [['Insumos da produção', 'GASTO'], ['Manutenção de equipamentos', 'GASTO'], ['Venda de produção', 'INGRESO']];
    return { origem: 'PERFIL_PRODUTIVO', mensagem: 'Sugestões geradas a partir do seu perfil produtivo. Escolha quais deseja adicionar.', categorias: categories.map(([nome, tipo]) => ({ nome, tipo })) };
  } };
}

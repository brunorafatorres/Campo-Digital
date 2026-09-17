function normalize(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function categoryKey(name, type) {
  const text = normalize(name);
  if (type === 'INGRESO') {
    if (/venda|venta|producao|produccion/.test(text)) return 'VENDA_PRODUCAO';
    if (/outr|otro/.test(text)) return 'OUTROS_INGRESSOS';
    return null;
  }
  if (/semente|muda/.test(text)) return 'SEMENTES_MUDAS';
  if (/racao|alimentacao animal/.test(text)) return 'RACAO';
  if (/combustivel|diesel|gasolina/.test(text)) return 'COMBUSTIVEL';
  if (/fertilizante|insumo/.test(text)) return 'INSUMOS';
  if (/manutencao|equipamento|maquina/.test(text)) return 'MANUTENCAO';
  if (/transporte|frete/.test(text)) return 'TRANSPORTE';
  if (/mao de obra|mano de obra|salario|diaria/.test(text)) return 'MAO_OBRA';
  if (/outr|otro/.test(text)) return 'OUTROS_GASTOS';
  return null;
}

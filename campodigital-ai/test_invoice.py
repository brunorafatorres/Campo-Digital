import unittest

from invoice import parse_invoice_text


class InvoiceParserTests(unittest.TestCase):
    def test_extracts_supplier_date_and_total(self):
        result = parse_invoice_text(
            "AGROPECUARIA SAO JOSE\nCNPJ 00.000.000/0001-00\nData: 07/09/2026\n"
            "Subtotal R$ 90,00\nVALOR TOTAL R$ 1.234,56",
            91.2,
        )
        self.assertEqual(result["fornecedor"], "AGROPECUARIA SAO JOSE")
        self.assertEqual(result["data"], "2026-09-07")
        self.assertEqual(result["valor"], "1234.56")
        self.assertEqual(result["confianca_leitura"], 91.2)

    def test_invalid_date_and_missing_total_remain_empty(self):
        result = parse_invoice_text("Loja Rural\nData 31/02/2026\nObrigado", 0)
        self.assertIsNone(result["data"])
        self.assertIsNone(result["valor"])

    def test_amount_parser_handles_dot_decimal_and_ignores_subtotal(self):
        result = parse_invoice_text("Loja Rural\nSUBTOTAL R$ 90.00\nTOTAL R$ 123.45", 80)
        self.assertEqual(result["valor"], "123.45")


if __name__ == "__main__":
    unittest.main()

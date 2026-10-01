import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


SERVER_PATH = Path(__file__).with_name("server.py")


class OptionalTensorFlowTests(unittest.TestCase):
    def test_server_imports_and_reports_model_unavailable_when_tensorflow_dll_is_blocked(self):
        real_import = __import__

        def import_without_tensorflow(name, *args, **kwargs):
            if name == "tensorflow":
                raise OSError("simulated Windows Application Control DLL block")
            return real_import(name, *args, **kwargs)

        spec = importlib.util.spec_from_file_location("campodigital_server_test", SERVER_PATH)
        module = importlib.util.module_from_spec(spec)
        sys.path.insert(0, str(SERVER_PATH.parent))
        try:
            with patch("builtins.__import__", side_effect=import_without_tensorflow):
                spec.loader.exec_module(module)
        finally:
            sys.path.pop(0)

        self.assertIsNone(module.MODEL)
        self.assertIsInstance(module.MODEL_ERROR, OSError)
        with self.assertRaises(module.ModelUnavailableError):
            module.predict({"descripcion": "adubo", "tipo": "GASTO"})


if __name__ == "__main__":
    unittest.main()

import ast
import pathlib
import unittest


PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
MANAGER_FACADE_PATH = PROJECT_ROOT / "backend" / "app" / "manager_facade.py"


def _load_tree():
    return ast.parse(
        MANAGER_FACADE_PATH.read_text(encoding="utf-8"),
        filename=str(MANAGER_FACADE_PATH),
    )


class ManagerFacadeStructureTest(unittest.TestCase):
    def test_backend_or_fallback_is_used_only_inside_backend_partial_call(self):
        tree = _load_tree()
        violations = []
        for node in tree.body:
            if not isinstance(node, ast.FunctionDef):
                continue
            for child in ast.walk(node):
                if isinstance(child, ast.Call) and isinstance(child.func, ast.Name):
                    if child.func.id == "_backend_or_fallback" and node.name != "_backend_partial_call":
                        violations.append(node.name)
        self.assertFalse(
            violations,
            "Direct _backend_or_fallback usage is allowed only in _backend_partial_call: "
            + ", ".join(sorted(set(violations))),
        )

    def test_backend_partial_call_is_widely_used(self):
        tree = _load_tree()
        count = 0
        for child in ast.walk(tree):
            if isinstance(child, ast.Call) and isinstance(child.func, ast.Name):
                if child.func.id == "_backend_partial_call":
                    count += 1
        self.assertGreaterEqual(
            count,
            60,
            f"Expected thin-shim dispatch via _backend_partial_call in >=60 call-sites, got {count}",
        )

    def test_manager_facade_has_no_lambda_nodes(self):
        tree = _load_tree()
        lambdas = [node for node in ast.walk(tree) if isinstance(node, ast.Lambda)]
        self.assertFalse(lambdas, "manager_facade.py should not contain inline lambda nodes")


if __name__ == "__main__":
    unittest.main()

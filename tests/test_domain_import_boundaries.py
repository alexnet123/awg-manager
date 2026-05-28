import ast
import pathlib
import unittest


PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
DOMAINS_ROOT = PROJECT_ROOT / "backend" / "domains"


def _module_name(path: pathlib.Path) -> str:
    rel = path.relative_to(PROJECT_ROOT).with_suffix("")
    return ".".join(rel.parts)


class DomainImportBoundariesTest(unittest.TestCase):
    def test_domains_do_not_import_other_domains(self):
        violations = []
        for file_path in DOMAINS_ROOT.rglob("*.py"):
            if file_path.name == "__init__.py":
                continue
            domain_name = file_path.parent.name
            tree = ast.parse(file_path.read_text(encoding="utf-8"), filename=str(file_path))
            current_module = _module_name(file_path)
            current_prefix = ".".join(current_module.split(".")[:-1])
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        name = alias.name
                        if name.startswith("backend.domains."):
                            imported_domain = name.split(".")[2] if len(name.split(".")) > 2 else ""
                            if imported_domain and imported_domain != domain_name:
                                violations.append(f"{file_path}: import {name}")
                elif isinstance(node, ast.ImportFrom):
                    imported = node.module or ""
                    if node.level > 0:
                        # Resolve relative import to absolute module path.
                        parts = current_prefix.split(".")
                        base = parts[: len(parts) - node.level + 1]
                        if imported:
                            base.extend(imported.split("."))
                        imported = ".".join(x for x in base if x)
                    if imported.startswith("backend.domains."):
                        imported_domain = imported.split(".")[2] if len(imported.split(".")) > 2 else ""
                        if imported_domain and imported_domain != domain_name:
                            violations.append(f"{file_path}: from {imported} import ...")
        self.assertFalse(
            violations,
            "Cross-domain imports are not allowed:\n" + "\n".join(violations),
        )


if __name__ == "__main__":
    unittest.main()

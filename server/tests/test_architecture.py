"""The layering and API-surface rules as tests (findings A1, A6, A8, A9), checked on the SOURCE with ``ast``.

They need no running app, so they also pass where FastAPI is not installed, and they fail the day somebody puts a
MongoDB query in a route or forgets a ``response_model``.
"""

import ast
import re
import unittest
from pathlib import Path

SERVER = Path(__file__).resolve().parent.parent
APP = SERVER / "app"
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "api_route"}
RAW_QUERY = re.compile(r"""\bdb\s*\[|\._c\b|\.db\s*\[""")  # db["tasks"], self._c, notifier.db["users"]


def python_files(folder: Path):
    return sorted(p for p in folder.rglob("*.py") if "__pycache__" not in p.parts)


def parse(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def imports_of(tree: ast.Module) -> set[str]:
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            found.add(node.module)
    return found


def route_decorators(path: Path):
    """``(function name, http method, path argument, keywords)`` for every ``@router.<method>(...)`` in a file."""
    for node in ast.walk(parse(path)):
        if not isinstance(node, ast.AsyncFunctionDef | ast.FunctionDef):
            continue
        for decorator in node.decorator_list:
            call = decorator
            if (
                isinstance(call, ast.Call)
                and isinstance(call.func, ast.Attribute)
                and call.func.attr in HTTP_METHODS
                and isinstance(call.func.value, ast.Name)
                and not call.func.value.id.startswith("__")
            ):
                first = call.args[0].value if call.args and isinstance(call.args[0], ast.Constant) else None
                keywords = {kw.arg: kw.value for kw in call.keywords}
                yield node, call.func.attr, first, keywords


def decorator_names(function: ast.AST) -> set[str]:
    names = set()
    for decorator in function.decorator_list:
        target = decorator.func if isinstance(decorator, ast.Call) else decorator
        if isinstance(target, ast.Attribute):
            names.add(ast.unparse(target))
    return names


V1_FILES = [p for p in python_files(APP / "api" / "v1") if p.name != "__init__.py"]


class ApiSurfaceTests(unittest.TestCase):
    def test_there_are_v1_route_modules(self):
        self.assertGreaterEqual(len(V1_FILES), 7)

    def test_every_v1_route_declares_a_response_model(self):
        """A8: nothing leaves the API as an un-typed dict that could leak a field."""
        missing = []
        for path in V1_FILES:
            for function, method, route, keywords in route_decorators(path):
                if "response_model" not in keywords and not (
                    isinstance(keywords.get("include_in_schema"), ast.Constant) and keywords["include_in_schema"].value is False
                ):
                    missing.append(f"{path.name}:{function.name} ({method.upper()} {route})")
        self.assertEqual(missing, [])

    def test_no_v1_route_path_ends_with_a_slash(self):
        """A6: ``/tasks`` and ``/tasks/`` must not be two different URLs (and nothing redirects between them)."""
        offenders = [
            f"{path.name}:{function.name} {route!r}"
            for path in V1_FILES
            for function, _method, route, _kw in route_decorators(path)
            if isinstance(route, str) and route.endswith("/")
        ]
        self.assertEqual(offenders, [])

    def test_the_app_factory_turns_slash_redirects_off_and_mounts_v1(self):
        source = (APP / "main.py").read_text(encoding="utf-8")
        self.assertRegex(source, r"redirect_slashes\s*=\s*False")
        self.assertIn("app.include_router(api_router)", source)
        v1 = (APP / "api" / "v1" / "__init__.py").read_text(encoding="utf-8")
        self.assertRegex(v1, r'APIRouter\(\s*prefix="/v1"')
        for prefix in ("/auth", "/tasks", "/integrations/telegram", "/admin"):
            self.assertIn(f'prefix="{prefix}"', v1)

    def test_the_token_url_points_at_the_versioned_login(self):
        self.assertIn('OAuth2PasswordBearer(tokenUrl="/v1/auth/login")', (APP / "api" / "deps.py").read_text(encoding="utf-8"))

    def test_the_legacy_surface_is_hidden_from_the_schema_and_switchable(self):
        legacy = (APP / "api" / "legacy.py").read_text(encoding="utf-8")
        self.assertIn("APIRouter(include_in_schema=False)", legacy)
        self.assertRegex((APP / "main.py").read_text(encoding="utf-8"), r"if settings\.legacy_api_enabled:\s+app\.include_router\(legacy_router\)")

    def test_sensitive_routes_are_rate_limited(self):
        expected = {
            "auth.py": {"signup", "login", "refresh", "logout", "forgot_password", "reset_password"},
            "tasks.py": {"magic_add"},
            "users.py": {"upload_avatar"},
            "telegram.py": {"get_telegram_link"},
            "admin.py": {"broadcast"},
        }
        for filename, names in expected.items():
            path = APP / "api" / "v1" / filename
            limited = {f.name for f, *_ in route_decorators(path) if "limiter.limit" in decorator_names(f)}
            self.assertEqual(names - limited, set(), filename)

    def test_the_webhook_is_the_only_limiter_exemption(self):
        exempt = [
            f"{path.name}:{f.name}"
            for path in V1_FILES
            for f, *_ in route_decorators(path)
            if "limiter.exempt" in decorator_names(f)
        ]
        self.assertEqual(exempt, ["telegram.py:telegram_webhook"])

    def test_every_route_that_needs_a_user_gets_it_from_the_token(self):
        """No route takes ``user_id`` from the URL, the query string or the body (the IDOR of finding S1)."""
        public = {"signup", "login", "refresh", "logout", "forgot_password", "reset_password", "list_updates",
                  "telegram_webhook", "broadcast", "root", "health_check"}
        for path in V1_FILES:
            for function, _m, route, _kw in route_decorators(path):
                if isinstance(route, str) and "{user_id}" in route:
                    self.fail(f"{path.name}:{function.name} takes a user id from the URL")
                if function.name in public:
                    continue
                annotations = " ".join(ast.unparse(a.annotation) for a in function.args.args + function.args.kwonlyargs if a.annotation)
                self.assertRegex(annotations, r"UserId|CurrentUser|AdminUser", f"{path.name}:{function.name} has no authenticated user")


class LayeringTests(unittest.TestCase):
    def test_only_repositories_and_index_setup_talk_to_mongodb(self):
        offenders = []
        for path in python_files(APP):
            relative = path.relative_to(APP).as_posix()
            if relative.startswith("repositories/") or relative == "db/indexes.py":
                continue
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if line.lstrip().startswith(("#", '"')):
                    continue
                if RAW_QUERY.search(line):
                    offenders.append(f"{relative}:{number}: {line.strip()[:80]}")
        self.assertEqual(offenders, [], "MongoDB access outside app/repositories")

    def test_routes_contain_no_database_or_crypto_code(self):
        for path in python_files(APP / "api"):
            imported = imports_of(parse(path))
            for forbidden in ("pymongo", "utils.crypto", "utils.task_store"):
                self.assertNotIn(forbidden, imported, f"{path.name} imports {forbidden}")
            self.assertFalse(re.search(r"\bdb\[", path.read_text(encoding="utf-8")), path.name)

    def test_services_and_repositories_know_nothing_about_http(self):
        for folder in ("services", "repositories"):
            for path in python_files(APP / folder):
                imported = imports_of(parse(path))
                self.assertFalse({m for m in imported if m == "fastapi" or m.startswith(("fastapi.", "starlette"))}, path.name)
                self.assertFalse({m for m in imported if m.startswith("app.api")}, path.name)

    def test_repositories_do_not_depend_on_services(self):
        for path in python_files(APP / "repositories"):
            self.assertFalse({m for m in imports_of(parse(path)) if m.startswith("app.services")}, path.name)

    def test_route_functions_stay_thin(self):
        too_long = []
        for path in V1_FILES:
            for function, *_ in route_decorators(path):
                body = [n for n in function.body if not (isinstance(n, ast.Expr) and isinstance(n.value, ast.Constant))]
                if sum(len(ast.unparse(n).splitlines()) for n in body) > 40:
                    too_long.append(f"{path.name}:{function.name}")
        self.assertEqual(too_long, [])

    def test_the_target_layout_exists(self):
        for name in ("main.py", "core", "api/v1", "services", "repositories", "integrations", "db", "notifications"):
            self.assertTrue((APP / name).exists(), name)
        self.assertFalse((SERVER / "routes").exists(), "the old routes/ package must be gone")
        self.assertFalse((SERVER / "database.py").exists(), "database.py is replaced by app.state.db")

    def test_the_old_entrypoint_is_only_a_shim(self):
        source = (SERVER / "main.py").read_text(encoding="utf-8")
        self.assertIn("from app.main import app", source)
        self.assertLessEqual(len(source.strip().splitlines()), 8)


if __name__ == "__main__":
    unittest.main()

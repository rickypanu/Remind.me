"""pytest bootstrap: prepare the test environment BEFORE any test module imports the application.

Several test files only worked when they happened to be collected after one that imported ``auth_stubs``; a single
file run on its own (``pytest tests/test_backend.py``) could fail with "SECRET_KEY field required". Importing it here
puts server/ on sys.path, sets ENVIRONMENT=test plus valid secrets, and installs stand-ins only for packages that
are not installed.
"""

from tests import auth_stubs  # noqa: F401

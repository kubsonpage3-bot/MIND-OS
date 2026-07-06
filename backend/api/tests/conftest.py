import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def clear_cache():
    """
    Clears the Django cache before each test.
    This prevents throttling limits from leaking between tests during a full test suite run.
    """
    cache.clear()

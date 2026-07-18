import pytest
from django.contrib.auth.models import User
from api.auth_backends import CaseInsensitiveModelBackend


@pytest.mark.django_db
def test_authenticate_by_username_exact():
    user = User.objects.create_user(
        username="KubsonM", email="kubsonpage3@gmail.com", password="securepassword123"
    )
    backend = CaseInsensitiveModelBackend()

    auth_user = backend.authenticate(
        request=None, username="KubsonM", password="securepassword123"
    )
    assert auth_user == user


@pytest.mark.django_db
def test_authenticate_by_username_case_insensitive():
    user = User.objects.create_user(
        username="KubsonM", email="kubsonpage3@gmail.com", password="securepassword123"
    )
    backend = CaseInsensitiveModelBackend()

    auth_user = backend.authenticate(
        request=None, username="kubsonm", password="securepassword123"
    )
    assert auth_user == user


@pytest.mark.django_db
def test_authenticate_by_email_case_insensitive():
    user = User.objects.create_user(
        username="KubsonM", email="kubsonpage3@gmail.com", password="securepassword123"
    )
    backend = CaseInsensitiveModelBackend()

    auth_user = backend.authenticate(
        request=None, username="KUBSONPAGE3@GMAIL.COM", password="securepassword123"
    )
    assert auth_user == user


@pytest.mark.django_db
def test_authenticate_invalid_credentials():
    User.objects.create_user(
        username="KubsonM", email="kubsonpage3@gmail.com", password="securepassword123"
    )
    backend = CaseInsensitiveModelBackend()

    auth_user = backend.authenticate(
        request=None, username="KubsonM", password="wrongpassword"
    )
    assert auth_user is None

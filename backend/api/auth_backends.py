from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import User
from django.db.models import Q


class CaseInsensitiveModelBackend(ModelBackend):
    """
    Case-insensitive authentication backend for Django.
    Allows users to log in with either Username or Email (case-insensitive).
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
            if username is None:
                return None

        try:
            # Look up user case-insensitively by username or email
            user = User._default_manager.filter(
                Q(username__iexact=username) | Q(email__iexact=username)
            ).first()
            if not user:
                raise User.DoesNotExist
        except User.DoesNotExist:
            # Run the default password hasher once to reduce timing differences
            User().set_password(password)
        else:
            if user.check_password(password) and self.user_can_authenticate(user):
                return user
        return None

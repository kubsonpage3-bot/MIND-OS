from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import User


class CaseInsensitiveModelBackend(ModelBackend):
    """
    Case-insensitive authentication backend for Django.
    Allows users to log in regardless of username casing (e.g., 'KubsonM' vs 'kubsonm').
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
            if username is None:
                return None

        try:
            # Look up user case-insensitively
            case_insensitive_username_field = "{}__iexact".format(User.USERNAME_FIELD)
            user = User._default_manager.get(
                **{case_insensitive_username_field: username}
            )
        except User.DoesNotExist:
            # Run the default password hasher once to reduce the timing
            # difference between an existing and a nonexistent user.
            User().set_password(password)
        else:
            if user.check_password(password) and self.user_can_authenticate(user):
                return user
        return None

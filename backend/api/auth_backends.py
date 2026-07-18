import logging
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import User
from django.db.models import Q

logger = logging.getLogger(__name__)


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
                logger.warning(f"[AUTH] No user found for identifier: '{username}'")
                raise User.DoesNotExist
        except User.DoesNotExist:
            # Run the default password hasher once to reduce timing differences
            User().set_password(password)
        else:
            logger.info(
                f"[AUTH] Found user '{user.username}' (is_active={user.is_active}) for identifier '{username}'"
            )
            pw_ok = user.check_password(password)
            logger.info(f"[AUTH] Password check result for '{user.username}': {pw_ok}")
            if pw_ok and self.user_can_authenticate(user):
                return user
            elif not pw_ok:
                logger.warning(f"[AUTH] Wrong password for user '{user.username}'")
            elif not self.user_can_authenticate(user):
                logger.warning(
                    f"[AUTH] User '{user.username}' is inactive (is_active=False)"
                )
        return None

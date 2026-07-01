import os

path = "backend/api/views.py"
with open(path, "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

bad_idx = text.find("#")
# Actually wait, let me just replace the bottom part.
# The corrupted part starts around line 1250 maybe. Let me just find ResetDataView

valid_code = '''
# ——— Rival System ————————————————————————————————————————————————
from .services.rival_service import compute_rival_data

class RivalView(generics.GenericAPIView):
    """
    GET /api/rival/
    Returns rival data generated deterministically for the current day.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = UserProfile.objects.get(user=request.user)
            rival_data = compute_rival_data(profile)
            return Response(rival_data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error computing rival data: {str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to compute rival data"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
'''

# Find the end of ResetDataView
end_reset_idx = text.find("Internal server error during data reset")
if end_reset_idx != -1:
    end_reset_idx = text.find(")", end_reset_idx) + 1
    text = text[:end_reset_idx]

with open(path, "w", encoding="utf-8") as f:
    f.write(text.strip() + "\n\n" + valid_code)

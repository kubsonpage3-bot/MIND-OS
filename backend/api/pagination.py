from rest_framework.pagination import PageNumberPagination


class FlexiblePageNumberPagination(PageNumberPagination):
    """
    Default list pagination (25/page), but a client that needs the WHOLE list --
    the calendar, the dashboard's task columns -- can ask for a bigger page with
    ?page_size=N. It used to be fixed at 25, and those views only read
    `.results`, so the 26th task/event silently vanished.
    """

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 500

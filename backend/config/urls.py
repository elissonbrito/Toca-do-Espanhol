"""
URL Configuration for Toca do Espanhol.
"""
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health_check(request):
    return JsonResponse({'status': 'ok', 'service': 'Toca do Espanhol API'})


urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path('health/', health_check),
    path('api/auth/', include('apps.auth.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/tables/', include('apps.tables.urls')),
    path('api/orders/', include('apps.orders.urls')),
    path('api/menu/', include('apps.menu.urls')),
    path('api/fiscal/', include('apps.fiscal.urls')),
    path('api/queue/', include('apps.queue.urls')),
    path('api/kitchen/', include('apps.kitchen.urls')),
    path('api/cash-register/', include('apps.cash_register.urls')),
    path('api/audit/', include('apps.audit.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/printing/', include('apps.printing.urls')),
    path('api/reports/', include('apps.reports.urls')),
]

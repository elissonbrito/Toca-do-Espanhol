"""
Auth views - login (JWT), refresh, logout (blacklist) e /me.
"""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.views import TokenRefreshView as _TokenRefreshView

from apps.users.serializers import UserSerializer
from .serializers import LoginSerializer, LogoutSerializer
from .services import AuthService
from .throttles import LoginRateThrottle, LoginEmailRateThrottle, RefreshRateThrottle

User = get_user_model()


class LoginView(APIView):
    """POST /api/auth/login/ -> { access, refresh, user }"""
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle, LoginEmailRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        tokens = AuthService.issue_tokens_for(user, request=request)
        return Response({**tokens, 'user': UserSerializer(user).data})


class TokenRefreshView(_TokenRefreshView):
    """POST /api/auth/refresh/ -> { access[, refresh] } (SimpleJWT padrão)."""
    permission_classes = [AllowAny]
    throttle_classes = [RefreshRateThrottle]


class LogoutView(APIView):
    """POST /api/auth/logout/ { refresh } -> revoga o refresh token."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            AuthService.revoke_refresh_token(
                serializer.validated_data['refresh'],
                user=request.user,
                request=request,
            )
        except TokenError:
            return Response({'detail': 'Token inválido ou expirado.'},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Logout realizado com sucesso.'})


class MeView(APIView):
    """GET /api/auth/me/ -> usuário autenticado."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

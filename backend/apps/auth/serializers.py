"""
Auth app serializers - validação de entrada para login/logout.
"""
from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

from apps.users.serializers import UserSerializer


class LoginSerializer(serializers.Serializer):
    """Valida credenciais e resolve o usuário autenticado em ``validated_data['user']``.

    Campos ausentes/malformados -> 400 (ValidationError).
    Credenciais inválidas ou conta inativa -> 401 (resposta genérica, não
    revela se a conta existe). O 403 abaixo é só defesa extra caso outro
    backend de autenticação aceite usuário inativo.
    """
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        email = attrs['email'].strip().lower()
        password = attrs['password']

        user = authenticate(
            self.context.get('request'),
            username=email,
            password=password,
        )
        if user is None:
            raise AuthenticationFailed('Credenciais inválidas.', code='invalid_credentials')
        if not user.is_active:
            raise PermissionDenied('Conta desativada. Contate o administrador.', code='inactive')

        attrs['user'] = user
        return attrs


class LogoutSerializer(serializers.Serializer):
    """Recebe o refresh token a ser revogado (blacklist)."""
    refresh = serializers.CharField()


class TokenPairResponseSerializer(serializers.Serializer):
    """Apenas para documentação da resposta de login/refresh."""
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer(read_only=True)

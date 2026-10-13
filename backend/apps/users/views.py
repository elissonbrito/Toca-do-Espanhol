"""
Users app views.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .models import User, UserRole
from .serializers import UserSerializer, UserCreateSerializer, UserUpdateSerializer, ChangePasswordSerializer
from .permissions import IsAdminMaximo, IsManager
from apps.audit.services import AuditService
from apps.utils import parse_id


def _revoke_all_sessions(user):
    """Coloca na blacklist todos os refresh tokens ainda válidos do usuário."""
    for token in OutstandingToken.objects.filter(user=user).exclude(blacklistedtoken__isnull=False):
        BlacklistedToken.objects.get_or_create(token=token)


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for user management."""
    queryset = User.objects.all().order_by('name')
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['role', 'is_active']
    search_fields = ['name', 'email']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ['me', 'change_password']:
            return [IsAuthenticated()]  # regra fina dentro da própria action
        if self.action in ['list', 'retrieve']:
            return [IsManager()]
        return [IsAdminMaximo()]

    def perform_create(self, serializer):
        user = serializer.save()
        AuditService.log(
            user=self.request.user,
            action='CREATE',
            entity='User',
            entity_id=user.id,
            details=f'Usuário {user.name} ({user.email}) criado com perfil {user.role}'
        )

    def perform_update(self, serializer):
        # Evita o ADM se trancar para fora (rebaixar/desativar a si mesmo).
        if serializer.instance.pk == self.request.user.pk:
            data = serializer.validated_data
            if data.get('is_active') is False or data.get('role', self.request.user.role) != self.request.user.role:
                raise ValidationError('Você não pode desativar nem alterar o próprio perfil.')
        user = serializer.save()
        if not user.is_active:
            _revoke_all_sessions(user)
        AuditService.log(
            user=self.request.user,
            action='UPDATE',
            entity='User',
            entity_id=user.id,
            details=f'Usuário {user.name} atualizado'
        )

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            raise ValidationError('Você não pode desativar a própria conta.')
        AuditService.log(
            user=self.request.user,
            action='DELETE',
            entity='User',
            entity_id=instance.id,
            details=f'Usuário {instance.name} desativado'
        )
        instance.is_active = False
        instance.save()
        _revoke_all_sessions(instance)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def change_password(self, request, pk=None):
        """Troca de senha.

        - O próprio usuário: exige ``old_password``.
        - ADM_MAXIMO redefinindo a senha de outra pessoa: não exige a antiga.
        Em ambos os casos derruba as sessões (refresh tokens) do usuário-alvo.
        """
        user = User.objects.filter(pk=parse_id(pk)).first()
        is_self = user is not None and user.pk == request.user.pk
        if not is_self and request.user.role != UserRole.ADM_MAXIMO:
            return Response({'detail': 'Você não tem permissão para executar essa ação.'}, status=403)
        if user is None:
            return Response({'detail': 'Não encontrado.'}, status=404)

        serializer = ChangePasswordSerializer(data=request.data, context={'require_old': is_self})
        serializer.is_valid(raise_exception=True)
        if is_self and not user.check_password(serializer.validated_data['old_password']):
            return Response({'old_password': 'Senha atual incorreta.'}, status=400)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        _revoke_all_sessions(user)
        AuditService.log(
            user=request.user, action='UPDATE', entity='User', entity_id=user.id,
            details=f'Senha de {user.email} alterada' + ('' if is_self else ' pelo administrador'),
            request=request,
        )
        return Response({'message': 'Senha alterada com sucesso.'})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

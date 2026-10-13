"""
Management command to seed initial data for Toca do Espanhol.
Usage: python manage.py seed_data

- DEBUG=True (dev): cria admin + usuários de exemplo com a senha 123456.
- DEBUG=False (produção): NÃO cria usuários de exemplo. O admin só é criado
  se ADMIN_EMAIL e ADMIN_PASSWORD estiverem definidos (senha forte obrigatória).
"""
import os

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from apps.tables.models import Table

User = get_user_model()


class Command(BaseCommand):
    help = 'Seeds initial data: admin user and sample tables'

    def handle(self, *args, **options):
        self.stdout.write('🍖 Iniciando seed da Toca do Espanhol...\n')

        if not settings.DEBUG:
            self._seed_production()
            # Em produção só cria mesas num banco vazio (respeita mesas removidas).
            if not Table.objects.exists():
                self._seed_tables()
            return

        # Create admin user
        if not User.objects.filter(email='admin@toca.com').exists():
            User.objects.create_superuser(
                email='admin@toca.com',
                password='123456',
                name='Administrador',
                role='ADM_MAXIMO',
            )
            self.stdout.write(self.style.SUCCESS('✅ Admin criado: admin@toca.com / 123456'))
        else:
            self.stdout.write('ℹ️  Admin já existe.')

        # Create sample users
        sample_users = [
            {'email': 'gerente@toca.com', 'name': 'Carlos Gerente', 'role': 'GERENTE'},
            {'email': 'garcom@toca.com', 'name': 'João Garçom', 'role': 'GARCOM'},
            {'email': 'cozinha@toca.com', 'name': 'Maria Cozinheira', 'role': 'COZINHA'},
            {'email': 'parrilla@toca.com', 'name': 'Pedro Parrilla', 'role': 'PARRILLA'},
            {'email': 'caixa@toca.com', 'name': 'Ana Caixa', 'role': 'CAIXA'},
            {'email': 'recepcao@toca.com', 'name': 'Lucia Recepção', 'role': 'RECEPCAO'},
        ]
        for u in sample_users:
            if not User.objects.filter(email=u['email']).exists():
                User.objects.create_user(password='123456', **u)
                self.stdout.write(self.style.SUCCESS(f"✅ Usuário criado: {u['email']}"))

        self._seed_tables()

        self.stdout.write(self.style.SUCCESS('\n🎉 Seed concluído com sucesso!\n'))
        self.stdout.write('Credenciais padrão (senha: 123456):')
        self.stdout.write('  admin@toca.com       → ADM_MAXIMO')
        self.stdout.write('  gerente@toca.com     → GERENTE')
        self.stdout.write('  garcom@toca.com      → GARCOM')
        self.stdout.write('  cozinha@toca.com     → COZINHA')
        self.stdout.write('  parrilla@toca.com    → PARRILLA')
        self.stdout.write('  caixa@toca.com       → CAIXA')
        self.stdout.write('  recepcao@toca.com    → RECEPCAO')

    def _seed_tables(self):
        for n in range(1, 21):
            seats = 2 if n <= 4 else (6 if n >= 17 else 4)
            Table.objects.get_or_create(number=n, defaults={'seats': seats})
        self.stdout.write(self.style.SUCCESS('✅ 20 mesas criadas.'))

    def _seed_production(self):
        """Produção: só o admin, com credenciais vindas do ambiente."""
        email = os.environ.get('ADMIN_EMAIL', '').strip().lower()
        password = os.environ.get('ADMIN_PASSWORD', '')
        if User.objects.filter(role='ADM_MAXIMO', is_active=True).exists():
            self.stdout.write('ℹ️  Já existe administrador ativo — nenhum usuário criado.')
            return
        if not email or not password:
            self.stdout.write(self.style.WARNING(
                '⚠️  Nenhum admin criado: defina ADMIN_EMAIL e ADMIN_PASSWORD.'))
            return
        try:
            validate_password(password)
        except ValidationError as e:
            raise CommandError(f'ADMIN_PASSWORD fraca: {" ".join(e.messages)}')
        User.objects.create_superuser(email=email, password=password,
                                      name='Administrador', role='ADM_MAXIMO')
        self.stdout.write(self.style.SUCCESS(f'✅ Admin criado: {email}'))

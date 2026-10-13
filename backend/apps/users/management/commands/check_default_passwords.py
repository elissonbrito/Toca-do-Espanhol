"""
Detecta contas ainda com senhas padrão/fracas conhecidas (ex.: as do seed de dev).

Usage:
    python manage.py check_default_passwords            # só lista
    python manage.py check_default_passwords --disable  # desativa as contas encontradas
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()

WEAK_PASSWORDS = ['123456', '12345678', 'admin', 'senha', 'password', 'toca123']


class Command(BaseCommand):
    help = 'Lista (ou desativa) usuários ativos com senha padrão/fraca conhecida.'

    def add_arguments(self, parser):
        parser.add_argument('--disable', action='store_true',
                            help='Desativa as contas encontradas.')

    def handle(self, *args, **options):
        found = [u for u in User.objects.filter(is_active=True)
                 if any(u.check_password(p) for p in WEAK_PASSWORDS)]
        if not found:
            self.stdout.write(self.style.SUCCESS('✅ Nenhuma conta ativa com senha padrão.'))
            return
        for u in found:
            self.stdout.write(self.style.WARNING(f'⚠️  {u.email} ({u.role}) usa senha padrão/fraca'))
        if options['disable']:
            User.objects.filter(pk__in=[u.pk for u in found]).update(is_active=False)
            self.stdout.write(self.style.SUCCESS(f'🔒 {len(found)} conta(s) desativada(s).'))
        else:
            self.stdout.write('Troque essas senhas (ou rode com --disable).')

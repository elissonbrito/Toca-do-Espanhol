"""
Testes de gestão de usuários: troca de senha, proteção contra auto-bloqueio
do ADM e seed seguro em produção.
"""
import os
from io import StringIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings
from rest_framework.test import APITestCase

User = get_user_model()

STRONG = 'Parrilla#2026!'


class ChangePasswordTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(name='A', email='a@t.com', password='Old-Pass#1', role='ADM_MAXIMO')
        cls.garcom = User.objects.create_user(name='G', email='g@t.com', password='Old-Pass#1', role='GARCOM')
        cls.caixa = User.objects.create_user(name='C', email='c@t.com', password='Old-Pass#1', role='CAIXA')

    def _change(self, actor, target, **data):
        self.client.force_authenticate(actor)
        body = {'new_password': STRONG, 'new_password_confirm': STRONG, **data}
        return self.client.post(f'/api/users/{target.id}/change_password/', body, format='json')

    def test_user_changes_own_password_with_old(self):
        r = self._change(self.garcom, self.garcom, old_password='Old-Pass#1')
        self.assertEqual(r.status_code, 200)
        self.garcom.refresh_from_db()
        self.assertTrue(self.garcom.check_password(STRONG))

    def test_own_password_requires_old(self):
        self.assertEqual(self._change(self.garcom, self.garcom).status_code, 400)
        self.assertEqual(self._change(self.garcom, self.garcom, old_password='errada').status_code, 400)

    def test_weak_password_rejected(self):
        self.client.force_authenticate(self.garcom)
        r = self.client.post(f'/api/users/{self.garcom.id}/change_password/', {
            'old_password': 'Old-Pass#1', 'new_password': '123456', 'new_password_confirm': '123456',
        }, format='json')
        self.assertEqual(r.status_code, 400)

    def test_non_admin_cannot_change_others_password(self):
        self.assertEqual(self._change(self.garcom, self.caixa, old_password='Old-Pass#1').status_code, 403)
        self.caixa.refresh_from_db()
        self.assertTrue(self.caixa.check_password('Old-Pass#1'))

    def test_admin_resets_others_password_without_old(self):
        self.assertEqual(self._change(self.admin, self.caixa).status_code, 200)

    def test_password_change_revokes_sessions(self):
        self.client.force_authenticate(None)
        refresh = self.client.post('/api/auth/login/', {'email': 'c@t.com', 'password': 'Old-Pass#1'},
                                   format='json').data['refresh']
        self._change(self.admin, self.caixa)
        self.client.force_authenticate(None)
        r = self.client.post('/api/auth/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(r.status_code, 401)


class AdminLockoutTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(name='A', email='a@t.com', password='x', role='ADM_MAXIMO')
        cls.other = User.objects.create_user(name='G', email='g@t.com', password='x', role='GARCOM')

    def setUp(self):
        self.client.force_authenticate(self.admin)

    def test_admin_cannot_deactivate_self(self):
        self.assertEqual(self.client.delete(f'/api/users/{self.admin.id}/').status_code, 400)
        r = self.client.patch(f'/api/users/{self.admin.id}/', {'is_active': False}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_admin_cannot_demote_self(self):
        r = self.client.patch(f'/api/users/{self.admin.id}/', {'role': 'GARCOM'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.role, 'ADM_MAXIMO')

    def test_admin_can_deactivate_other(self):
        self.assertEqual(self.client.delete(f'/api/users/{self.other.id}/').status_code, 204)
        self.other.refresh_from_db()
        self.assertFalse(self.other.is_active)

    def test_role_cannot_be_escalated_via_create_by_non_admin(self):
        self.client.force_authenticate(self.other)
        r = self.client.post('/api/users/', {
            'name': 'X', 'email': 'x@t.com', 'password': STRONG, 'password_confirm': STRONG,
            'role': 'ADM_MAXIMO'}, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertFalse(User.objects.filter(email='x@t.com').exists())

    def test_password_hash_never_exposed(self):
        r = self.client.get(f'/api/users/{self.other.id}/')
        self.assertEqual(r.status_code, 200)
        self.assertNotIn('password', r.data)


@override_settings(DEBUG=False)
class ProductionSeedTests(APITestCase):
    def _seed(self, **env):
        with mock.patch.dict(os.environ, env, clear=False):
            call_command('seed_data', stdout=StringIO())

    def test_no_default_users_in_production(self):
        self._seed(ADMIN_EMAIL='', ADMIN_PASSWORD='')
        self.assertFalse(User.objects.exists())

    def test_admin_from_env(self):
        self._seed(ADMIN_EMAIL='Dono@Toca.com', ADMIN_PASSWORD=STRONG)
        admin = User.objects.get()
        self.assertEqual(admin.email, 'dono@toca.com')
        self.assertTrue(admin.check_password(STRONG))

    def test_weak_admin_password_refused(self):
        with self.assertRaises(CommandError):
            self._seed(ADMIN_EMAIL='dono@toca.com', ADMIN_PASSWORD='123456')
        self.assertFalse(User.objects.exists())

    def test_check_default_passwords_detects_and_disables(self):
        User.objects.create_user(name='W', email='w@t.com', password='123456', role='GARCOM')
        User.objects.create_user(name='S', email='s@t.com', password=STRONG, role='GARCOM')
        out = StringIO()
        call_command('check_default_passwords', '--disable', stdout=out)
        self.assertIn('w@t.com', out.getvalue())
        self.assertFalse(User.objects.get(email='w@t.com').is_active)
        self.assertTrue(User.objects.get(email='s@t.com').is_active)


class UserApiShapeTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(name='A', email='a@t.com', password='x', role='ADM_MAXIMO')

    def setUp(self):
        self.client.force_authenticate(self.admin)

    def test_create_returns_id_without_password(self):
        r = self.client.post('/api/users/', {'name': 'N', 'email': 'n@t.com', 'role': 'GARCOM',
                                             'password': STRONG, 'password_confirm': STRONG}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertIsInstance(r.data['id'], int)
        self.assertNotIn('password', r.data)

    def test_non_numeric_id_is_404_not_500(self):
        r = self.client.post('/api/users/abc/change_password/', {}, format='json')
        self.assertEqual(r.status_code, 404)

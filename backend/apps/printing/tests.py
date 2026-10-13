from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.menu.models import MenuCategory, MenuItem
from apps.orders.models import ItemSector
from apps.tables.models import Table
from .models import Printer, PrintJob, PrintJobStatus

User = get_user_model()


class PrintingFlowTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.garcom = User.objects.create_user(name='João', email='g@t.com', password='x', role='GARCOM')
        cls.table = Table.objects.create(number=7, seats=4)
        cat = MenuCategory.objects.create(name='Parrilla')
        cls.bife = MenuItem.objects.create(
            category=cat, name='Bife', sector=ItemSector.PARRILLA, price='25.00', sku='BIFE',
            ncm='02013000', cfop='5101', csosn='102', origem='0',
            unit_commercial='UN', unit_taxable='UN', pis_cst='49', cofins_cst='49',
        )

    def _launch(self):
        self.client.force_authenticate(self.garcom)
        oid = self.client.post('/api/orders/', {'table': self.table.id}, format='json').data['id']
        self.client.post(f'/api/orders/{oid}/add_item/',
                         {'menu_item': self.bife.id, 'quantity': 2, 'observations': 'ao ponto'},
                         format='json')
        return oid

    def test_no_printer_no_job(self):
        self._launch()
        self.assertFalse(PrintJob.objects.exists())

    def test_item_enqueues_ticket_for_sector_printer(self):
        Printer.objects.create(name='Parrilla', sector='PARRILLA', qz_printer_name='EPSON')
        Printer.objects.create(name='Bar', sector='BAR', qz_printer_name='BAR')
        Printer.objects.create(name='Off', sector='PARRILLA', qz_printer_name='X', is_active=False)
        self._launch()
        job = PrintJob.objects.get()
        self.assertEqual(job.sector, 'PARRILLA')
        for text in ('MESA 7', '2x  Bife', 'OBS: ao ponto', 'Garcom: João'):
            self.assertIn(text, job.body)

    def test_job_lifecycle(self):
        Printer.objects.create(name='Parrilla', sector='PARRILLA', qz_printer_name='EPSON')
        self._launch()
        job = PrintJob.objects.get()
        self.assertEqual(len(self.client.get('/api/printing/jobs/pending/').data), 1)

        r = self.client.post(f'/api/printing/jobs/{job.id}/mark-error/', {'message': 'x' * 1000}, format='json')
        self.assertEqual(r.data['status'], PrintJobStatus.ERRO)
        job.refresh_from_db()
        self.assertEqual(len(job.error_message), 300)  # truncado

        self.client.post(f'/api/printing/jobs/{job.id}/reprint/')
        self.client.post(f'/api/printing/jobs/{job.id}/mark-printed/')
        job.refresh_from_db()
        self.assertEqual(job.status, PrintJobStatus.IMPRESSO)
        self.assertIsNotNone(job.printed_at)
        self.assertEqual(self.client.get('/api/printing/jobs/pending/').data, [])

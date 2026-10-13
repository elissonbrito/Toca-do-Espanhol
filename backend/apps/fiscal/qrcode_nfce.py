"""
QR Code da NFC-e (NT 2015/002 e atualizações).

Modo online (padrão): o "p" do QR contém
  chave|versaoQRCode|tpAmb|cIdToken|cHashQRCode
onde cHashQRCode = SHA-1( "<parametros sem o hash>" + CSC ), em hexadecimal.
"""
import hashlib

VERSAO_QRCODE = '2'

# URLs de consulta do QR Code por UF (ambiente de homologação).
# Preencha/ajuste conforme o portal da SEFAZ do seu estado.
URL_CONSULTA_QRCODE_HOMOLOG = {
    'SP': 'https://www.homologacao.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx',
    'RS': 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx',
    'PR': 'http://www.fazenda.pr.gov.br/nfce/qrcode',
    'MG': 'https://hnfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml',
    'SC': 'https://hom.sat.sef.sc.gov.br/nfce/consulta',
    'BA': 'http://hnfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx',
    'GO': 'http://homolog.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe',
    'DF': 'http://www.fazenda.df.gov.br/nfce/qrcode',
}


def build_qrcode(*, chave: str, tp_amb: str, csc_id: str, csc_token: str, uf: str) -> str:
    """Retorna a URL completa do QR Code (modo online)."""
    base_url = URL_CONSULTA_QRCODE_HOMOLOG.get(uf.upper(), 'https://www.example-sefaz.gov.br/nfce/qrcode')
    params_sem_hash = f'{chave}|{VERSAO_QRCODE}|{tp_amb}|{csc_id}'
    # SHA-1 é imposto pelo leiaute do QR Code NFC-e (SEFAZ), não é escolha nossa.
    digest = hashlib.sha1((params_sem_hash + (csc_token or "")).encode(),
                          usedforsecurity=False).hexdigest().upper()
    p = f'{params_sem_hash}|{digest}'
    sep = '&' if '?' in base_url else '?'
    return f'{base_url}{sep}p={p}'

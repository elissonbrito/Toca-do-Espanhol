"""
Utilitários compartilhados entre os apps.
"""
from rest_framework.exceptions import ParseError
from rest_framework.parsers import JSONParser


def parse_id(value):
    """Converte um id vindo do cliente (URL/corpo) em int; None se inválido.

    Evita que ``filter(pk='abc')`` estoure ValueError (erro 500).
    """
    if isinstance(value, bool):
        return None
    try:
        n = int(str(value))
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None



class ObjectJSONParser(JSONParser):
    """JSON cujo topo precisa ser um objeto ``{...}``.

    Nenhum endpoint da API recebe lista/escalar no topo; sem esta checagem,
    ``request.data.get(...)`` num corpo ``[]`` ou ``"x"`` vira erro 500.
    """

    def parse(self, stream, media_type=None, parser_context=None):
        data = super().parse(stream, media_type, parser_context)
        if not isinstance(data, dict):
            raise ParseError('O corpo da requisição deve ser um objeto JSON.')
        return data

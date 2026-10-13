FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Usuário sem privilégios: o processo da API não roda como root.
RUN useradd --system --uid 10001 --home /app app \
    && mkdir -p /app/staticfiles \
    && DEBUG=False SECRET_KEY=build-only python manage.py collectstatic --no-input -v 0 \
    && chown -R app:app /app/staticfiles
USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/', timeout=4)"

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", \
     "--timeout", "60", "--max-requests", "2000", "--max-requests-jitter", "200", \
     "--forwarded-allow-ips", "*", "--access-logfile", "-"]
